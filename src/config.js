// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. The SDK fetches it (`getConfig()`) and
// notifies every change (`onConfigUpdated()`); this module only provides the
// defaults and normalizes the received object.
// -----------------------------------------------------------------------------

import { WOLF_LANGUAGES } from './wolf/constants.js';

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (checked by test/manifest.test.js).
export const DEFAULT_CONFIG = {
  username: '',
  password: '',
  // Language of the parameter names, translated by the Wolf portal itself.
  language: 'en',
  // Expert mode: every parameter of the controller, not only the portal's
  // end-user view.
  expert_mode: false,
  // Seconds between two reads of the boiler values. The Wolf cloud is slow
  // and rate-limited: two minutes is a sensible pace, one minute the fastest.
  poll_frequency: 120,
};

export const POLL_FREQUENCY_BOUNDS = { min: 60, max: 3600 };

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const pollFrequency = Number(raw.poll_frequency ?? DEFAULT_CONFIG.poll_frequency);
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    username: String(raw.username ?? '').trim(),
    password: String(raw.password ?? ''),
    language: WOLF_LANGUAGES.includes(raw.language) ? raw.language : DEFAULT_CONFIG.language,
    // A form may send the boolean as a string.
    expert_mode: raw.expert_mode === true || raw.expert_mode === 'true',
    poll_frequency: Number.isFinite(pollFrequency)
      ? Math.min(Math.max(pollFrequency, POLL_FREQUENCY_BOUNDS.min), POLL_FREQUENCY_BOUNDS.max)
      : DEFAULT_CONFIG.poll_frequency,
  };
}

/**
 * Whether the user filled in what the integration needs to sign in.
 */
export function hasCredentials(config) {
  return Boolean(config.username && config.password);
}
