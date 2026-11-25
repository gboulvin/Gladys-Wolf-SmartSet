// -----------------------------------------------------------------------------
// Wolf SmartSet sign-in: OpenID Connect authorization code flow with PKCE,
// played like the web portal does (login form, redirects, code exchange).
//
// The portal offers no client-credentials grant: the only way to get an access
// token with a username and a password is to post the login form of the
// identity server, follow its redirects up to the portal callback, and trade
// the code it carries for a token.
// -----------------------------------------------------------------------------

import { createHash, randomBytes } from 'node:crypto';
import {
  AUTH_CLIENT_ID,
  AUTH_PATH,
  AUTH_REDIRECT_URI,
  AUTH_SCOPE,
  AUTH_URL,
  BASE_URL,
  MAX_PASSWORD_LENGTH,
} from './constants.js';

const MAX_REDIRECTS = 10;

export class WolfAuthError extends Error {
  constructor(message, { reason = 'invalid_credentials' } = {}) {
    super(message);
    this.name = 'WolfAuthError';
    // 'invalid_credentials' | 'password_too_long' | 'missing_credentials' | 'unexpected_response'
    this.reason = reason;
  }
}

const base64url = (buffer) =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * PKCE pair (RFC 7636, S256).
 */
export function createPkcePair() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

/**
 * Minimal cookie jar: one host, names only (the identity server sets its
 * antiforgery and session cookies on the path `/`).
 */
export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  store(response) {
    const lines =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter(Boolean);
    for (const line of lines) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      if (index > 0) {
        this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    }
  }

  header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

/**
 * Read the antiforgery token of the login form.
 */
export function extractVerificationToken(html) {
  const patterns = [
    /name="__RequestVerificationToken"[^>]*?value="([^"]+)"/i,
    /value="([^"]+)"[^>]*?name="__RequestVerificationToken"/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function authorizeParams(state, challenge) {
  return new URLSearchParams({
    client_id: AUTH_CLIENT_ID,
    redirect_uri: AUTH_REDIRECT_URI,
    response_type: 'code',
    scope: AUTH_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    response_mode: 'query',
  });
}

/**
 * Sign in to Wolf SmartSet and resolve `{ accessToken, expiresAt }`.
 *
 * @param {object} options
 * @param {string} options.username
 * @param {string} options.password
 * @param {typeof fetch} [options.fetchImpl] injected by the tests
 * @param {() => number} [options.now]
 */
export async function authenticate({ username, password, fetchImpl = fetch, now = Date.now }) {
  if (!username || !password) {
    throw new WolfAuthError('Missing Wolf SmartSet credentials', { reason: 'missing_credentials' });
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new WolfAuthError(
      `Wolf SmartSet refuses passwords longer than ${MAX_PASSWORD_LENGTH} characters`,
      { reason: 'password_too_long' },
    );
  }

  const jar = new CookieJar();
  const { verifier, challenge } = createPkcePair();
  const state = base64url(randomBytes(16));
  const returnUrl = `${AUTH_PATH}/connect/authorize/callback?${authorizeParams(state, challenge)}`;
  const loginUrl = `${AUTH_URL}/Account/Login?${new URLSearchParams({ ReturnUrl: returnUrl })}`;

  // 1. The login page: antiforgery cookie + token.
  const page = await fetchImpl(loginUrl, { redirect: 'manual' });
  jar.store(page);
  const token = extractVerificationToken(await page.text());
  if (!token) {
    throw new WolfAuthError('The Wolf SmartSet login page changed: no verification token', {
      reason: 'unexpected_response',
    });
  }

  // 2. Post the form, then follow the redirects up to the portal callback.
  let response = await fetchImpl(loginUrl, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.header(),
    },
    body: new URLSearchParams({
      'Input.Username': username,
      'Input.Password': password,
      __RequestVerificationToken: token,
    }).toString(),
  });
  let code = null;
  for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
    jar.store(response);
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      break;
    }
    const target = new URL(location, BASE_URL);
    if (target.href.startsWith(AUTH_REDIRECT_URI)) {
      code = target.searchParams.get('code');
      break;
    }
    response = await fetchImpl(target.href, {
      redirect: 'manual',
      headers: { Cookie: jar.header() },
    });
  }
  if (!code) {
    // The identity server answers the login form again: wrong credentials.
    throw new WolfAuthError('Wolf SmartSet refused the username or the password');
  }

  // 3. Trade the code for an access token.
  const tokenResponse = await fetchImpl(`${AUTH_URL}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: AUTH_CLIENT_ID,
      code,
      redirect_uri: AUTH_REDIRECT_URI,
      code_verifier: verifier,
      grant_type: 'authorization_code',
    }).toString(),
  });
  let body;
  try {
    body = await tokenResponse.json();
  } catch {
    body = null;
  }
  if (!tokenResponse.ok || !body?.access_token || body.error) {
    throw new WolfAuthError('Wolf SmartSet did not deliver an access token', {
      reason: 'unexpected_response',
    });
  }
  const expiresIn = Number(body.expires_in) || 3600;
  // Renew one minute early, so a request never leaves with an expired token.
  return { accessToken: body.access_token, expiresAt: now() + (expiresIn - 60) * 1000 };
}
