// -----------------------------------------------------------------------------
// Wolf parameter -> Gladys device feature.
//
// A Wolf system exposes a variable list of parameters (it depends on the
// boiler, the heat pump, the mixer modules, the solar module...). Each one is
// mapped by its unit, or by its list of choices:
//
//   °C, read-only   -> temperature-sensor / probe (boiler, flow, outdoor... probes)
//   °C, writable    -> thermostat / target-temperature (setpoints, controllable)
//   bar             -> pressure-sensor / decimal
//   kW              -> energy-sensor / power
//   kWh             -> energy-sensor / energy
//   Std (hours)     -> duration / decimal
//   %               -> unknown / unknown in percent (modulation, pump speed...)
//   list of choices -> text / select (operating modes, programs, states),
//                      controllable when the portal allows writing it
//   anything else   -> text / text (rpm, l/min, Hz and free values keep their
//                      unit in the published text)
//
// Every feature carries name, min, max, read_only and has_feedback: Gladys
// stores them NOT NULL (see CLAUDE.md).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as GLADYS_UNITS,
} from '@gladysassistant/integration-sdk';
import { UNITS } from '../wolf/constants.js';

export const FEATURE_KINDS = {
  TEMPERATURE: 'temperature',
  SETPOINT: 'setpoint',
  PRESSURE: 'pressure',
  POWER: 'power',
  ENERGY: 'energy',
  HOURS: 'hours',
  PERCENT: 'percent',
  SELECT: 'select',
  TEXT: 'text',
};

// Default ranges when the portal does not give one.
const DEFAULT_RANGES = {
  [FEATURE_KINDS.TEMPERATURE]: [-50, 150],
  [FEATURE_KINDS.SETPOINT]: [5, 90],
  [FEATURE_KINDS.PRESSURE]: [0, 10],
  [FEATURE_KINDS.POWER]: [0, 1000],
  [FEATURE_KINDS.ENERGY]: [0, 1e9],
  [FEATURE_KINDS.HOURS]: [0, 1e7],
  [FEATURE_KINDS.PERCENT]: [0, 100],
};

/**
 * Which kind of feature a parameter becomes.
 */
export function featureKind(parameter) {
  if (parameter.items) {
    return FEATURE_KINDS.SELECT;
  }
  switch (parameter.unit) {
    case UNITS.CELSIUS:
      return parameter.readOnly ? FEATURE_KINDS.TEMPERATURE : FEATURE_KINDS.SETPOINT;
    case UNITS.BAR:
      return FEATURE_KINDS.PRESSURE;
    case UNITS.KILOWATT:
      return FEATURE_KINDS.POWER;
    case UNITS.KILOWATT_HOUR:
      return FEATURE_KINDS.ENERGY;
    case UNITS.HOURS:
    case 'h':
      return FEATURE_KINDS.HOURS;
    case UNITS.PERCENT:
      return FEATURE_KINDS.PERCENT;
    default:
      return FEATURE_KINDS.TEXT;
  }
}

/**
 * Whether Gladys can drive the feature directly (the other writable
 * parameters stay reachable through the `set_parameter` scene action).
 */
export function isControllable(parameter) {
  const kind = featureKind(parameter);
  return !parameter.readOnly && (kind === FEATURE_KINDS.SETPOINT || kind === FEATURE_KINDS.SELECT);
}

function range(parameter, kind) {
  const [defaultMin, defaultMax] = DEFAULT_RANGES[kind];
  const min = parameter.min ?? defaultMin;
  const max = parameter.max ?? defaultMax;
  return min < max ? { min, max } : { min: defaultMin, max: defaultMax };
}

const TYPE_BY_KIND = {
  [FEATURE_KINDS.TEMPERATURE]: {
    category: CATEGORIES.TEMPERATURE_SENSOR,
    type: TYPES.TEMPERATURE_SENSOR.PROBE,
    unit: GLADYS_UNITS.CELSIUS,
  },
  [FEATURE_KINDS.SETPOINT]: {
    category: CATEGORIES.THERMOSTAT,
    type: TYPES.THERMOSTAT.TARGET_TEMPERATURE,
    unit: GLADYS_UNITS.CELSIUS,
  },
  [FEATURE_KINDS.PRESSURE]: {
    category: CATEGORIES.PRESSURE_SENSOR,
    type: TYPES.SENSOR.DECIMAL,
    unit: GLADYS_UNITS.BAR,
  },
  [FEATURE_KINDS.POWER]: {
    category: CATEGORIES.ENERGY_SENSOR,
    type: TYPES.ENERGY_SENSOR.POWER,
    unit: GLADYS_UNITS.KILOWATT,
  },
  [FEATURE_KINDS.ENERGY]: {
    category: CATEGORIES.ENERGY_SENSOR,
    type: TYPES.ENERGY_SENSOR.ENERGY,
    unit: GLADYS_UNITS.KILOWATT_HOUR,
  },
  [FEATURE_KINDS.HOURS]: {
    category: CATEGORIES.DURATION,
    type: TYPES.DURATION.DECIMAL,
    unit: GLADYS_UNITS.HOURS,
  },
  [FEATURE_KINDS.PERCENT]: {
    category: CATEGORIES.UNKNOWN,
    type: TYPES.UNKNOWN.UNKNOWN,
    unit: GLADYS_UNITS.PERCENT,
  },
};

/**
 * The discovery payload of one parameter's feature.
 */
export function buildFeature(parameter, externalId) {
  const kind = featureKind(parameter);
  const name = parameter.name.slice(0, 255) || String(parameter.valueId);
  if (kind === FEATURE_KINDS.SELECT) {
    return {
      name,
      external_id: externalId,
      category: CATEGORIES.TEXT,
      type: TYPES.TEXT.SELECT,
      min: 0,
      max: 0,
      read_only: parameter.readOnly,
      has_feedback: !parameter.readOnly,
      keep_history: false,
      supported_options: parameter.items.map((item, index) => ({
        value: item.value,
        label: item.label,
        sort_order: index,
      })),
    };
  }
  if (kind === FEATURE_KINDS.TEXT) {
    return {
      name,
      external_id: externalId,
      category: CATEGORIES.TEXT,
      type: TYPES.TEXT.TEXT,
      min: 0,
      max: 0,
      read_only: true,
      has_feedback: false,
      keep_history: false,
    };
  }
  const controllable = kind === FEATURE_KINDS.SETPOINT;
  return {
    name,
    external_id: externalId,
    ...TYPE_BY_KIND[kind],
    ...range(parameter, kind),
    read_only: !controllable,
    has_feedback: controllable,
    keep_history: true,
  };
}

const toNumber = (raw) => {
  const number = Number(String(raw).trim().replace(',', '.'));
  return Number.isFinite(number) ? number : null;
};

/**
 * The Gladys state of a raw portal value: `{ state }`, `{ text }`, or `null`
 * when the value cannot be published (a numeric feature reading "---").
 */
export function toState(parameter, raw) {
  if (raw === undefined || raw === null) {
    return null;
  }
  const kind = featureKind(parameter);
  if (kind === FEATURE_KINDS.SELECT) {
    return { text: String(raw) };
  }
  if (kind === FEATURE_KINDS.TEXT) {
    const text = String(raw).trim();
    const unit = parameter.unit ? ` ${parameter.unit}` : '';
    return text ? { text: `${text}${unit}` } : null;
  }
  const state = toNumber(raw);
  return state === null ? null : { state };
}

/**
 * The human reading of a raw value: the list label, or the value + unit.
 */
export function displayValue(parameter, raw) {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (parameter.items) {
    return parameter.items.find((item) => item.value === String(raw))?.label ?? String(raw);
  }
  return parameter.unit ? `${raw} ${parameter.unit}` : String(raw);
}

/**
 * The portal value to write for a value coming from Gladys or a scene: a list
 * accepts the choice's value or its label (case-insensitive); a numeric
 * parameter is checked against its range. Throws on an invalid value.
 */
export function toPortalValue(parameter, value) {
  const raw = String(value).trim();
  if (parameter.items) {
    const item =
      parameter.items.find((candidate) => candidate.value === raw) ??
      parameter.items.find((candidate) => candidate.label.toLowerCase() === raw.toLowerCase());
    if (!item) {
      throw new Error(
        `"${raw}" is not a choice of "${parameter.name}" (${parameter.items
          .map((candidate) => candidate.label)
          .join(', ')})`,
      );
    }
    return item.value;
  }
  const number = toNumber(raw);
  if (number === null) {
    throw new Error(`"${raw}" is not a number`);
  }
  if (
    (parameter.min !== null && number < parameter.min) ||
    (parameter.max !== null && number > parameter.max)
  ) {
    throw new Error(
      `${number} is out of the range of "${parameter.name}" (${parameter.min} to ${parameter.max})`,
    );
  }
  return String(number);
}
