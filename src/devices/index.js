// -----------------------------------------------------------------------------
// Wolf systems as Gladys devices.
//
// One Wolf SmartSet "system" (a heating installation behind one gateway: ISM7,
// Link home, Link pro...) becomes one Gladys device; each of its parameters
// becomes a feature (see features.js). Unlike a fixed catalog, the list is
// discovered at runtime from the account, so the hub keeps it in memory and
// refreshes it on every (re)connection, configuration change and scan.
//
// External ids are forever: the device id is built from the Wolf system id,
// the feature ids from the parameter `ValueId` — never from a name, which
// changes with the language of the configuration.
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_POLL_FREQUENCIES,
  DEVICE_TRANSPORTS,
} from '@gladysassistant/integration-sdk';
import { WolfClient } from '../wolf/client.js';
import { WolfAuthError } from '../wolf/auth.js';
import { hasCredentials } from '../config.js';
import {
  buildFeature,
  displayValue,
  featureKind,
  FEATURE_KINDS,
  toPortalValue,
  toState,
} from './features.js';

const logger = createLogger({ name: 'wolf-hub' });

export const DEVICE_TYPE = 'system';

// Scene trigger keys, as declared in the manifest `scene_triggers` field.
// Keys are forever: scenes store them.
export const SCENE_TRIGGERS = {
  GATEWAY_STATUS_CHANGED: 'gateway_status_changed',
  MODE_CHANGED: 'mode_changed',
};
export const SCENE_TRIGGER_KEYS = Object.values(SCENE_TRIGGERS);

export const GATEWAY_STATUS = { ONLINE: 'online', OFFLINE: 'offline' };

// An unchanged value is re-sent every 30 minutes, so it stays recently dated
// in Gladys while keeping a large installation under the host API budget.
const HEARTBEAT_MS = 30 * 60 * 1000;

// Gladys' poll ticks drift by a few milliseconds: a read due within the next
// half-minute runs now, so a 120 s interval does not slip to 180 s.
const POLL_TOLERANCE_MS = DEVICE_POLL_FREQUENCIES.EVERY_MINUTES / 2;

export class WolfHub {
  /**
   * @param {object} gladys the SDK client
   * @param {object} [options]
   * @param {(credentials: object) => WolfClient} [options.clientFactory] injected by the tests
   * @param {() => number} [options.now]
   */
  constructor(
    gladys,
    { clientFactory = (credentials) => new WolfClient(credentials), now = Date.now } = {},
  ) {
    this.gladys = gladys;
    this.clientFactory = clientFactory;
    this.now = now;
    this.client = null;
    this.credentials = null;
    this.config = null;
    this.systems = new Map();
    this.lastReads = new Map();
    // Last error of the cloud, for the connection status and the widget.
    this.lastError = null;
  }

  /**
   * Apply a (new) configuration. A change of credentials drops the client
   * and the systems; the next `refresh()` signs in again.
   */
  configure(config) {
    const credentials = `${config.username}\u0000${config.password}`;
    if (credentials !== this.credentials) {
      this.credentials = credentials;
      this.client = hasCredentials(config)
        ? this.clientFactory({ username: config.username, password: config.password })
        : null;
      this.systems.clear();
      this.lastReads.clear();
    }
    this.config = config;
  }

  get ready() {
    return this.client !== null && this.lastError === null;
  }

  /**
   * Sign in if needed, list the systems and their parameters. Values already
   * read are kept, so a refresh never fires scene events by itself.
   */
  async refresh() {
    if (!this.client) {
      throw new WolfAuthError('Missing Wolf SmartSet credentials', {
        reason: 'missing_credentials',
      });
    }
    try {
      const systems = await this.client.getSystems();
      const fresh = new Map();
      for (const system of systems) {
        const ids = this.gladys.externalIds(DEVICE_TYPE, system.id);
        const previous = this.systems.get(ids.device);
        const parameters = await this.client.getParameters(system, {
          language: this.config.language,
          expert: this.config.expert_mode,
        });
        fresh.set(ids.device, {
          ...system,
          externalId: ids.device,
          ids,
          parameters,
          online: previous?.online ?? null,
          values: previous?.values ?? new Map(),
          lastUpdate: previous?.lastUpdate ?? null,
        });
      }
      this.systems = fresh;
      this.lastError = null;
      return [...fresh.values()];
    } catch (err) {
      this.lastError = err;
      throw err;
    }
  }

  getSystem(externalId) {
    return this.systems.get(externalId) ?? null;
  }

  listSystems() {
    return [...this.systems.values()];
  }

  buildDevices() {
    return this.listSystems().map((system) => ({
      name: system.name,
      external_id: system.externalId,
      // Polled every minute by Gladys, read at the interval of the config
      // (see poll()). Explicit should_poll for the older cores.
      should_poll: true,
      poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
      params: [
        { name: 'wolf_system_id', value: String(system.id) },
        { name: 'wolf_gateway_id', value: String(system.gatewayId) },
      ],
      features: system.parameters.map((parameter) =>
        buildFeature(parameter, system.ids.feature(String(parameter.valueId))),
      ),
    }));
  }

  async publishDevices() {
    await this.gladys.publishDiscoveredDevices(this.buildDevices());
  }

  /**
   * The cloud/unreachable badge of every system (the gateway reaches the
   * Wolf cloud, or not). A system never read yet reports nothing.
   */
  transportEntries() {
    return this.listSystems()
      .filter((system) => system.online !== null)
      .map((system) => ({
        external_id: system.externalId,
        transport: system.online ? DEVICE_TRANSPORTS.CLOUD : DEVICE_TRANSPORTS.UNREACHABLE,
      }));
  }

  async publishTransports() {
    const entries = this.transportEntries();
    if (entries.length > 0) {
      await this.gladys.publishTransports(entries);
    }
  }

  findParameter(system, reference) {
    const ref = String(reference ?? '').trim();
    if (!ref) {
      return null;
    }
    const lower = ref.toLowerCase();
    return (
      system.parameters.find((parameter) => String(parameter.valueId) === ref) ??
      system.parameters.find((parameter) => parameter.name.toLowerCase() === lower) ??
      system.parameters.find((parameter) => parameter.rawName.toLowerCase() === lower) ??
      null
    );
  }

  findParameterByFeature(system, featureExternalId) {
    return (
      system.parameters.find(
        (parameter) => system.ids.feature(String(parameter.valueId)) === featureExternalId,
      ) ?? null
    );
  }

  /**
   * Read a system now: gateway state, then every value. Publishes the
   * changed states and the transport badge, and fires the scene triggers on
   * the transitions. Resolves the number of values read.
   */
  async readSystem(system) {
    const online = await this.client.isOnline(system);
    const wasOnline = system.online;
    system.online = online;
    if (wasOnline !== online) {
      await this.publishTransports();
      if (wasOnline !== null) {
        // One event per transition, never on the first read.
        await this.gladys.publishSceneEvent(SCENE_TRIGGERS.GATEWAY_STATUS_CHANGED, {
          device: system.externalId,
          status: online ? GATEWAY_STATUS.ONLINE : GATEWAY_STATUS.OFFLINE,
        });
      }
    }
    if (!online) {
      return 0;
    }

    const values = await this.client.getValues(system, system.parameters);
    const states = [];
    const events = [];
    for (const parameter of system.parameters) {
      const raw = values.get(parameter.valueId);
      if (raw === undefined) {
        continue;
      }
      const previous = system.values.get(parameter.valueId);
      system.values.set(parameter.valueId, raw);
      const state = toState(parameter, raw);
      if (state) {
        states.push({
          device_feature_external_id: system.ids.feature(String(parameter.valueId)),
          ...state,
        });
      }
      if (parameter.items && previous !== undefined && previous !== raw) {
        events.push({
          device: system.externalId,
          parameter: parameter.name,
          parameter_id: String(parameter.valueId),
          value: displayValue(parameter, raw),
          previous_value: displayValue(parameter, previous),
        });
      }
    }
    system.lastUpdate = new Date(this.now()).toISOString();
    if (states.length > 0) {
      await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
    }
    for (const event of events) {
      await this.gladys.publishSceneEvent(SCENE_TRIGGERS.MODE_CHANGED, event);
    }
    return values.size;
  }

  /**
   * `onPoll` handler: read the system if its interval elapsed. Resolves
   * `true` when it was read, `false` when the poll was skipped.
   */
  async poll(device) {
    if (!this.client) {
      return false;
    }
    if (this.systems.size === 0 || this.lastError) {
      // Signed out (startup failure, cloud down): try again now.
      await this.refresh();
    }
    const system = this.getSystem(device.external_id);
    if (!system) {
      return false;
    }
    const now = this.now();
    const lastRead = this.lastReads.get(system.externalId);
    if (
      lastRead !== undefined &&
      now - lastRead < this.config.poll_frequency * 1000 - POLL_TOLERANCE_MS
    ) {
      return false;
    }
    await this.readSystem(system);
    this.lastReads.set(system.externalId, now);
    return true;
  }

  /**
   * Write one parameter, then reflect it in Gladys at once (the next read
   * confirms it). The written value is remembered as the known one: a write
   * never fires `mode_changed`, or a scene bound to it would loop.
   */
  async writeParameter(system, parameter, value) {
    if (parameter.readOnly) {
      throw new Error(`"${parameter.name}" is read-only`);
    }
    const portalValue = toPortalValue(parameter, value);
    logger.info(
      `Writing ${parameter.name} (${parameter.valueId}) = ${portalValue} on ${system.name}`,
    );
    await this.client.writeValue(system, parameter, portalValue);
    system.values.set(parameter.valueId, portalValue);
    const state = toState(parameter, portalValue);
    if (state) {
      const featureId = system.ids.feature(String(parameter.valueId));
      await this.gladys.publishState(
        featureId,
        state.text !== undefined ? { text: state.text } : state.state,
      );
    }
    return portalValue;
  }

  /**
   * `onSetValue` handler: a controllable feature (setpoint, mode) changed in
   * Gladys.
   */
  async setValue(device, feature, value) {
    const system = this.getSystem(device.external_id);
    if (!system) {
      throw new Error(`Unknown Wolf system ${device.external_id}`);
    }
    const parameter = this.findParameterByFeature(system, feature.external_id);
    if (!parameter) {
      throw new Error(`Unknown Wolf parameter ${feature.external_id}`);
    }
    const kind = featureKind(parameter);
    if (kind !== FEATURE_KINDS.SETPOINT && kind !== FEATURE_KINDS.SELECT) {
      throw new Error(`"${parameter.name}" cannot be controlled from Gladys`);
    }
    await this.writeParameter(system, parameter, value);
  }
}
