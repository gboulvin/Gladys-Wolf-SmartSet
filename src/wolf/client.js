// -----------------------------------------------------------------------------
// Wolf SmartSet portal client.
//
// Owns the access token and the portal "browser session" every call needs,
// renews both transparently, and exposes the handful of calls the integration
// uses: systems, gateway state, parameters, values, writes.
//
// `fetchImpl` is injectable: the tests run the client against an in-memory
// fake of the portal (test/helpers/fakeWolf.js), never the network.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { authenticate } from './auth.js';
import {
  BASE_URL,
  ERROR_READ_PARAMETER,
  PORTAL_URL,
  SESSION_REFRESH_MS,
  WOLF_LANGUAGES,
} from './constants.js';
import { parseGuiDescription, parseLocalizedTexts } from './parameters.js';

const logger = createLogger({ name: 'wolf-client' });

export class WolfApiError extends Error {
  constructor(message, { status = null, transient = false } = {}) {
    super(message);
    this.name = 'WolfApiError';
    this.status = status;
    // A transient error (gateway busy or offline) is retried at the next poll.
    this.transient = transient;
  }
}

const pad = (n) => String(n).padStart(2, '0');
function portalTimestamp(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export class WolfClient {
  /**
   * @param {object} options
   * @param {string} options.username
   * @param {string} options.password
   * @param {typeof fetch} [options.fetchImpl]
   * @param {() => number} [options.now]
   */
  constructor({ username, password, fetchImpl = fetch, now = Date.now }) {
    this.username = username;
    this.password = password;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.token = null;
    this.sessionId = null;
    this.sessionRefreshedAt = 0;
    this.textsCache = new Map();
  }

  async authorize() {
    this.token = await authenticate({
      username: this.username,
      password: this.password,
      fetchImpl: this.fetchImpl,
      now: this.now,
    });
    this.sessionId = await this.createSession();
    this.sessionRefreshedAt = this.now();
  }

  async createSession() {
    const response = await this.fetchImpl(`${PORTAL_URL}/api/portal/CreateSession2`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ Timestamp: portalTimestamp(new Date(this.now())) }),
    });
    if (!response.ok) {
      throw new WolfApiError(`CreateSession2 failed (HTTP ${response.status})`, {
        status: response.status,
      });
    }
    const body = await response.json();
    return body.BrowserSessionId;
  }

  headers() {
    return {
      Authorization: `Bearer ${this.token.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async ensureSession() {
    if (!this.token || this.token.expiresAt <= this.now()) {
      await this.authorize();
      return;
    }
    if (this.now() - this.sessionRefreshedAt >= SESSION_REFRESH_MS) {
      await this.fetchImpl(`${PORTAL_URL}/api/portal/UpdateSession`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ SessionId: this.sessionId }),
      });
      this.sessionRefreshedAt = this.now();
    }
  }

  /**
   * Call the portal API. A 401 or a 500 (the portal's answer to an expired
   * session) triggers one fresh sign-in and one retry.
   */
  async request(method, path, { query, body } = {}) {
    await this.ensureSession();
    const send = () => {
      const url = new URL(`${PORTAL_URL}/${path}`);
      for (const [key, value] of Object.entries(query ?? {})) {
        url.searchParams.set(key, String(value));
      }
      const payload =
        body && typeof body === 'object' && !Array.isArray(body)
          ? { ...body, SessionId: this.sessionId }
          : body;
      return this.fetchImpl(url.href, {
        method,
        headers: this.headers(),
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
    };
    let response = await send();
    if (response.status === 401 || response.status === 500) {
      logger.info(`Wolf SmartSet answered ${response.status}, signing in again`);
      await this.authorize();
      response = await send();
    }
    if (!response.ok) {
      throw new WolfApiError(`${path} failed (HTTP ${response.status})`, {
        status: response.status,
        transient: response.status >= 500,
      });
    }
    const result = await response.json();
    if (result && typeof result === 'object' && ('ErrorCode' in result || 'ErrorType' in result)) {
      const message = result.Message ?? 'unknown error';
      throw new WolfApiError(`${path}: ${message}`, {
        transient: message === ERROR_READ_PARAMETER,
      });
    }
    return result;
  }

  /**
   * The heating systems of the account: `[{ id, gatewayId, name }]`.
   */
  async getSystems() {
    const systems = await this.request('GET', 'api/portal/GetSystemList');
    return (systems ?? []).map((system) => ({
      id: system.Id,
      gatewayId: system.GatewayId,
      name: system.Name || `Wolf ${system.Id}`,
    }));
  }

  /**
   * Whether the gateway (ISM7, Link home...) of a system reaches the cloud.
   */
  async isOnline({ id, gatewayId }) {
    const states = await this.request('POST', 'api/portal/GetSystemStateList', {
      body: { SystemList: [{ SystemId: id, GatewayId: gatewayId }] },
    });
    return states?.[0]?.GatewayState?.IsOnline === true;
  }

  /**
   * The portal's translations of the parameter names, `{}` when unavailable
   * (the raw German names are kept then).
   */
  async getTexts(language) {
    const culture = WOLF_LANGUAGES.includes(language) ? language : 'en';
    if (this.textsCache.has(culture)) {
      return this.textsCache.get(culture);
    }
    let texts = {};
    try {
      const response = await this.fetchImpl(
        `${BASE_URL}/js/localized-text/text.culture.${culture}.js`,
      );
      if (response.ok) {
        texts = parseLocalizedTexts(await response.text()) ?? {};
      }
    } catch (err) {
      logger.warn(`Could not load the ${culture} texts of the portal: ${err.message}`);
    }
    this.textsCache.set(culture, texts);
    return texts;
  }

  async getParameters({ id, gatewayId }, { language = 'en', expert = false } = {}) {
    const texts = await this.getTexts(language);
    const description = await this.request('GET', 'api/portal/GetGuiDescriptionForGateway', {
      query: { GatewayId: gatewayId, SystemId: id },
    });
    return parseGuiDescription(description, { expert, texts });
  }

  /**
   * Current values, one request per bundle: `Map<valueId, string>`.
   */
  async getValues({ id, gatewayId }, parameters) {
    const bundles = new Map();
    for (const parameter of parameters) {
      if (!bundles.has(parameter.bundleId)) {
        bundles.set(parameter.bundleId, []);
      }
      bundles.get(parameter.bundleId).push(parameter.valueId);
    }
    const values = new Map();
    for (const [bundleId, valueIds] of bundles) {
      const result = await this.request('POST', 'api/portal/GetParameterValues', {
        body: {
          BundleId: bundleId,
          IsSubBundle: false,
          ValueIdList: valueIds,
          GatewayId: gatewayId,
          SystemId: id,
          GuiIdChanged: false,
          LastAccess: null,
        },
      });
      for (const entry of result?.Values ?? []) {
        if (entry.Value !== undefined && entry.Value !== null) {
          values.set(entry.ValueId, String(entry.Value));
        }
      }
    }
    return values;
  }

  async writeValue({ id, gatewayId }, parameter, value) {
    return this.request('POST', 'api/portal/WriteParameterValues', {
      body: {
        WriteParameterValues: [{ ValueId: parameter.valueId, Value: String(value) }],
        SystemId: id,
        GatewayId: gatewayId,
        BundleId: parameter.bundleId,
      },
    });
  }
}
