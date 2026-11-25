// -----------------------------------------------------------------------------
// Dashboard widgets (SDK v0.14+, Gladys 5.1+).
//
// `wolf_system`: one Wolf installation at a glance — live tiles bound to its
// main probes (they follow the published states, nothing to refresh), the
// gateway connection, the last read and the current operating mode, and a
// button that reads the system now.
//
// The content is declarative (`text`, `value`, `status`, `button`): the core
// renders it with its own theme and translations. Checked in the tests with
// `validateWidgetContent` (exported by the SDK).
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { displayValue, featureKind, FEATURE_KINDS } from './devices/features.js';
import { format, MESSAGES } from './i18n.js';

const logger = createLogger({ name: 'widgets' });

// Widget key, as declared in the manifest `widgets` field.
export const SYSTEM_WIDGET = 'wolf_system';

// Keys of the `button` actions the content declares.
export const SYSTEM_WIDGET_ACTIONS = { REFRESH: 'refresh' };

const MAX_TILES = 4;
const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// The tiles worth a glance, in this order: probes (outdoor, flow, hot
// water...), pressure, then setpoints.
const TILE_KINDS = [FEATURE_KINDS.TEMPERATURE, FEATURE_KINDS.PRESSURE, FEATURE_KINDS.SETPOINT];

function pickTiles(system) {
  const tiles = [];
  for (const kind of TILE_KINDS) {
    for (const parameter of system.parameters) {
      if (tiles.length < MAX_TILES && featureKind(parameter) === kind) {
        tiles.push(parameter);
      }
    }
  }
  return tiles;
}

function gatewayStatus(system) {
  if (system.online === true) {
    return {
      value: { en: 'Online', fr: 'En ligne', de: 'Online', es: 'En línea' },
      color: WIDGET_COLORS.SUCCESS,
    };
  }
  if (system.online === false) {
    return {
      value: { en: 'Offline', fr: 'Hors ligne', de: 'Offline', es: 'Desconectada' },
      color: WIDGET_COLORS.DANGER,
    };
  }
  return {
    value: { en: 'Unknown', fr: 'Inconnue', de: 'Unbekannt', es: 'Desconocido' },
    color: WIDGET_COLORS.NEUTRAL,
  };
}

function formatTime(iso, language) {
  try {
    return new Date(iso).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

function notConnectedContent(hub) {
  const message = hub.client ? MESSAGES.cloudUnreachable : MESSAGES.missingCredentials;
  return {
    ttl_seconds: 60,
    components: [
      {
        type: 'text',
        variant: 'heading',
        text: 'Wolf SmartSet',
      },
      { type: 'text', variant: 'body', text: message },
    ],
  };
}

function systemContent(system, language) {
  const statusItems = [
    {
      label: { en: 'Gateway', fr: 'Passerelle', de: 'Gateway', es: 'Pasarela' },
      icon: 'wifi',
      ...gatewayStatus(system),
    },
  ];
  if (system.lastUpdate) {
    statusItems.push({
      label: {
        en: 'Last read',
        fr: 'Dernière lecture',
        de: 'Letzte Abfrage',
        es: 'Última lectura',
      },
      icon: 'clock',
      value: truncate(formatTime(system.lastUpdate, language), 40),
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  // The current state of the first list parameters (operating mode, program...).
  for (const parameter of system.parameters.filter((candidate) => candidate.items)) {
    if (statusItems.length >= 5) break;
    const raw = system.values.get(parameter.valueId);
    if (raw === undefined) continue;
    statusItems.push({
      label: truncate(parameter.name, 40),
      icon: 'sliders',
      value: truncate(displayValue(parameter, raw), 40),
      color: WIDGET_COLORS.INFO,
    });
  }

  return {
    // The tiles are live; the computed rows change with each read, and the
    // hub nudges the widget after every read (see app.js): the TTL is a
    // safety net.
    ttl_seconds: 300,
    components: [
      { type: 'text', variant: 'heading', text: truncate(system.name, 40) },
      ...pickTiles(system).map((parameter) => ({
        type: 'value',
        label: truncate(parameter.name, 24),
        icon: featureKind(parameter) === FEATURE_KINDS.PRESSURE ? 'droplet' : 'thermometer',
        device_feature: system.ids.feature(String(parameter.valueId)),
      })),
      { type: 'status', items: statusItems },
      // `params` are declared here and sent back as-is: never user input.
      {
        type: 'button',
        label: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
        icon: 'refresh-cw',
        style: 'secondary',
        action: { key: SYSTEM_WIDGET_ACTIONS.REFRESH, params: { device: system.externalId } },
      },
    ],
  };
}

export const WIDGETS = {
  [SYSTEM_WIDGET]: {
    // `settings.device` is the optional system chosen for this widget
    // instance (a `"source": "devices"` select); the first system otherwise.
    async get(hub, { settings = {}, language = 'en' }) {
      logger.debug(`onWidgetGet <- ${SYSTEM_WIDGET}`);
      const system =
        (settings.device && hub.getSystem(settings.device)) || hub.listSystems()[0] || null;
      if (!system) {
        return notConnectedContent(hub);
      }
      return systemContent(system, language);
    },

    // Resolves the toast. After a successful action the core drops the cached
    // content and every open dashboard refetches it.
    async action(hub, { actionKey, params }) {
      logger.info(`onWidgetAction <- ${SYSTEM_WIDGET}.${actionKey}`);
      if (actionKey !== SYSTEM_WIDGET_ACTIONS.REFRESH) {
        throw new Error(`Unknown widget action: ${actionKey}`);
      }
      const system = hub.getSystem(params.device);
      if (!system) {
        return MESSAGES.unknownDevice;
      }
      const count = await hub.readSystem(system);
      hub.lastReads.set(system.externalId, hub.now());
      if (!system.online) {
        return MESSAGES.gatewayOffline;
      }
      return format(MESSAGES.refreshed, { name: truncate(system.name, 60), count });
    },
  },
};

/**
 * Freshness nudge: ask the core to re-pull every widget now. Fire-and-forget,
 * rate-limited core-side to 1 per 10 s per widget.
 */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
