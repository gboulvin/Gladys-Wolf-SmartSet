// -----------------------------------------------------------------------------
// Wolf SmartSet cloud endpoints and payload keys.
//
// Wolf publishes no official API: these are the endpoints the Wolf SmartSet
// web portal itself uses, the same ones the Home Assistant `wolflink`
// integration reaches through the `wolf_comm` Python library.
// -----------------------------------------------------------------------------

export const BASE_URL = 'https://www.wolf-smartset.com';
export const PORTAL_URL = `${BASE_URL}/portal`;
export const AUTH_PATH = '/idsrv';
export const AUTH_URL = `${BASE_URL}${AUTH_PATH}`;
export const AUTH_CLIENT_ID = 'smartset.web';
export const AUTH_REDIRECT_URI = `${BASE_URL}/signin-callback.html`;
export const AUTH_SCOPE = 'openid profile api role';

// The login form of Wolf refuses longer passwords.
export const MAX_PASSWORD_LENGTH = 30;

// The portal drops a browser session that is not refreshed for a while.
export const SESSION_REFRESH_MS = 60 * 1000;

// Bundle used by the portal when a descriptor does not carry its own.
export const DEFAULT_BUNDLE_ID = 1000;

// Separator of the composite parameter names ("<prefix>---<name>").
export const NAME_SEPARATOR = '---';

// Languages the integration offers for the parameter names, all served by the
// portal as `text.culture.<code>.js`.
export const WOLF_LANGUAGES = ['en', 'fr', 'de', 'es'];

// The error message the portal answers when the gateway cannot read the
// boiler (offline, busy): retried at the next poll, not a fatal error.
export const ERROR_READ_PARAMETER = 'internal msg: ReadParameterValues error';

export const UNITS = {
  CELSIUS: '°C',
  BAR: 'bar',
  PERCENT: '%',
  HOURS: 'Std',
  KILOWATT: 'kW',
  KILOWATT_HOUR: 'kWh',
  RPM: 'U/min',
  FLOW: 'l/min',
  HERTZ: 'Hz',
};
