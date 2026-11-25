// -----------------------------------------------------------------------------
// SDK wiring: every handler is registered here, BEFORE connect().
//
// index.js only builds the SDK client, calls createApp() and connects; the
// tests call createApp() on the SDK's fake Gladys with a fake Wolf portal.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { hasCredentials, normalizeConfig } from './config.js';
import { WolfHub } from './devices/index.js';
import { ACTIONS } from './actions.js';
import { SCENE_ACTIONS } from './scenes.js';
import { WIDGETS, refreshWidgets } from './widgets.js';
import { MESSAGES } from './i18n.js';
import { errorMessage } from './status.js';

const logger = createLogger({ name: 'app' });

// While the cloud cannot be reached, try again every 5 minutes (the polls of
// the created devices retry too, but a first install has none yet).
const RETRY_INTERVAL_MS = 5 * 60 * 1000;

/**
 * @param {object} gladys the SDK client (or the fake one of the tests)
 * @param {object} [options] passed to the hub (clientFactory, now)
 */
export function createApp(gladys, options = {}) {
  const hub = new WolfHub(gladys, options);
  let config = normalizeConfig();
  let connected = null;
  let retryTimer = null;

  async function reportStatus(ok, message) {
    if (connected === ok && ok) {
      return;
    }
    connected = ok;
    await gladys.setConnectionStatus(ok, message).catch((err) => {
      logger.warn(`Could not report the connection status: ${err.message}`);
    });
  }

  function scheduleRetry() {
    if (retryTimer || !hasCredentials(config)) {
      return;
    }
    retryTimer = setInterval(() => {
      synchronize().catch((err) => logger.error('Retry failed', err));
    }, RETRY_INTERVAL_MS);
    retryTimer.unref?.();
  }

  function stopRetry() {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  }

  async function publishAll() {
    await hub.publishDevices();
    await hub.publishTransports();
    await reportStatus(true);
    stopRetry();
    refreshWidgets(gladys);
  }

  /**
   * Sign in, list the systems and their parameters, publish them as devices.
   * Never throws: a failure is reported in the connection status.
   */
  async function synchronize() {
    hub.configure(config);
    if (!hasCredentials(config)) {
      stopRetry();
      await reportStatus(false, MESSAGES.missingCredentials);
      refreshWidgets(gladys);
      return false;
    }
    try {
      await hub.refresh();
      await publishAll();
      return true;
    } catch (err) {
      // Never log the error object of a sign-in: it may carry the request.
      logger.error(`Wolf SmartSet synchronization failed: ${err.message}`);
      await reportStatus(false, errorMessage(err));
      scheduleRetry();
      refreshWidgets(gladys);
      return false;
    }
  }

  // --- Discovery: Gladys asks for the list of devices ------------------------
  gladys.onScanRequest(async () => {
    logger.info('onScanRequest -> refreshing the Wolf systems');
    await synchronize();
  });

  // --- Command: a setpoint or a mode changed in Gladys -----------------------
  gladys.onSetValue(async (device, feature, value) => {
    logger.info(`onSetValue <- ${feature.external_id} = ${value}`);
    await hub.setValue(device, feature, value);
    refreshWidgets(gladys);
  });

  // --- Polling: Gladys polls every created system once a minute --------------
  gladys.onPoll(async (device) => {
    try {
      if (await hub.poll(device)) {
        await reportStatus(true);
        refreshWidgets(gladys);
      }
    } catch (err) {
      if (err.transient) {
        // Gateway busy or offline: the next poll retries, nothing to report.
        logger.warn(`Poll of ${device.external_id} failed: ${err.message}`);
        return;
      }
      logger.error(`Poll of ${device.external_id} failed: ${err.message}`);
      await reportStatus(false, errorMessage(err));
      throw err;
    }
  });

  // --- Manifest actions: buttons of the Configuration screen -----------------
  for (const [key, handler] of Object.entries(ACTIONS)) {
    gladys.onAction(key, (fields) => handler(hub, { fields, publish: publishAll }));
  }

  // --- Scene actions ----------------------------------------------------------
  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(key, async (fields) => {
      const outputs = await handler(hub, { fields });
      refreshWidgets(gladys);
      return outputs;
    });
  }

  // --- Dashboard widgets -------------------------------------------------------
  for (const [key, widget] of Object.entries(WIDGETS)) {
    gladys.onWidgetGet(key, (request) => widget.get(hub, request));
    gladys.onWidgetAction(key, (actionKey, params, { settings } = {}) =>
      widget.action(hub, { actionKey, params, settings }),
    );
  }

  // --- Configuration updated by the user -------------------------------------
  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('onConfigUpdated -> new configuration received');
    config = normalizeConfig(newConfig);
    connected = null;
    await synchronize();
  });

  // --- Connection lifecycle ---------------------------------------------------
  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      connected = null;
      await synchronize();
    } catch (err) {
      logger.error(`Post-connection initialization failed: ${err.message}`);
      await reportStatus(false, MESSAGES.initFailed);
    }
  });

  return {
    hub,
    synchronize,
    getConfig: () => config,
    stop: stopRetry,
  };
}
