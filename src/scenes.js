// -----------------------------------------------------------------------------
// Scene actions (SDK v0.14+, Gladys 5.1+).
//
// Declared in the manifest `scene_actions` field and handled here, keyed by
// the same `key`; src/app.js registers every entry with
// `gladys.onSceneAction(key, ...)`.
//
//   - refresh_system: read a system now, whatever the refresh interval;
//   - set_parameter:  write any writable parameter (setpoints and modes are
//                     also device features, but the other writable
//                     parameters are only reachable here);
//   - read_parameter: read one parameter into scene variables.
//
// The rules that matter: `fields` arrive RESOLVED (scene variables
// substituted, a `"source": "devices"` field is the chosen device
// external_id); the handler resolves the declared scalar `outputs`; throwing
// fails this action only. Never fire a scene event because of an action: the
// hub remembers what it wrote, so a write never fires `mode_changed`.
//
// Scene TRIGGERS are fired by the hub itself (src/devices/index.js).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { displayValue, toState } from './devices/features.js';

const logger = createLogger({ name: 'scenes' });

function requireSystem(hub, externalId) {
  const system = hub.getSystem(externalId);
  if (!system) {
    throw new Error(`Unknown Wolf system ${externalId}`);
  }
  return system;
}

export const SCENE_ACTIONS = {
  async refresh_system(hub, { fields }) {
    logger.info(`Scene action refresh_system <- ${fields.device}`);
    const system = requireSystem(hub, fields.device);
    const valuesRead = await hub.readSystem(system);
    hub.lastReads.set(system.externalId, hub.now());
    return { online: system.online === true, values_read: valuesRead };
  },

  async set_parameter(hub, { fields }) {
    logger.info(`Scene action set_parameter <- ${fields.device} ${fields.parameter}`);
    const system = requireSystem(hub, fields.device);
    const parameter = hub.findParameter(system, fields.parameter);
    if (!parameter) {
      throw new Error(`No parameter "${fields.parameter}" on ${system.name}`);
    }
    const written = await hub.writeParameter(system, parameter, fields.value);
    return { parameter: parameter.name, value: displayValue(parameter, written) };
  },

  async read_parameter(hub, { fields }) {
    logger.info(`Scene action read_parameter <- ${fields.device} ${fields.parameter}`);
    const system = requireSystem(hub, fields.device);
    const parameter = hub.findParameter(system, fields.parameter);
    if (!parameter) {
      // Not a failure: the scene author gates on `found`.
      return { found: false };
    }
    if (fields.refresh === true || !system.values.has(parameter.valueId)) {
      await hub.readSystem(system);
      hub.lastReads.set(system.externalId, hub.now());
    }
    const raw = system.values.get(parameter.valueId);
    if (raw === undefined) {
      return { found: true, parameter: parameter.name };
    }
    const state = toState(parameter, raw);
    const outputs = {
      found: true,
      parameter: parameter.name,
      value: displayValue(parameter, raw),
      raw_value: raw,
    };
    if (state?.state !== undefined) {
      outputs.numeric_value = state.state;
    }
    return outputs;
  },
};
