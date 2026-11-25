// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen.
//
//   - test_connection: sign in and count the systems of the account;
//   - list_parameters: list the writable parameters of a system, with the
//     identifiers the `set_parameter` scene action accepts.
//
// The resolved multi-language message is displayed under the button; throwing
// displays the error instead.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { displayValue } from './devices/features.js';
import { format, MESSAGES } from './i18n.js';
import { authErrorMessage } from './status.js';

const logger = createLogger({ name: 'actions' });

// Keep the message readable under the button.
const MAX_LIST_LENGTH = 900;

export const ACTIONS = {
  async test_connection(hub, { publish }) {
    logger.info('Action test_connection');
    let systems;
    try {
      systems = await hub.refresh();
    } catch (err) {
      const message = authErrorMessage(err);
      if (message) {
        return message;
      }
      throw err;
    }
    // Signed in: publish what was found and reflect it in the status.
    await publish();
    if (systems.length === 0) {
      return MESSAGES.noSystem;
    }
    return format(MESSAGES.connected, { count: systems.length });
  },

  async list_parameters(hub, { fields }) {
    logger.info(`Action list_parameters <- ${fields.device}`);
    const system = hub.getSystem(fields.device);
    if (!system) {
      return MESSAGES.unknownDevice;
    }
    const writable = system.parameters.filter((parameter) => !parameter.readOnly);
    if (writable.length === 0) {
      return format(MESSAGES.noWritableParameter, { name: system.name });
    }
    const entries = writable.map((parameter) => {
      const raw = system.values.get(parameter.valueId);
      const current = raw === undefined ? '' : ` = ${displayValue(parameter, raw)}`;
      const choices = parameter.items
        ? ` [${parameter.items.map((item) => item.label).join(' | ')}]`
        : '';
      return `${parameter.name} (${parameter.valueId})${current}${choices}`;
    });
    let list = entries.join('; ');
    if (list.length > MAX_LIST_LENGTH) {
      list = `${list.slice(0, MAX_LIST_LENGTH - 1)}…`;
    }
    return format(MESSAGES.writableParameters, { name: system.name, list });
  },
};
