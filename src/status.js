// -----------------------------------------------------------------------------
// The connection status shown in the Configuration screen, from the last error
// of the Wolf cloud.
// -----------------------------------------------------------------------------

import { WolfAuthError } from './wolf/auth.js';
import { MESSAGES } from './i18n.js';

/**
 * The user message of a sign-in error, `null` for any other error.
 */
export function authErrorMessage(err) {
  if (!(err instanceof WolfAuthError)) {
    return null;
  }
  switch (err.reason) {
    case 'missing_credentials':
      return MESSAGES.missingCredentials;
    case 'password_too_long':
      return MESSAGES.passwordTooLong;
    case 'invalid_credentials':
      return MESSAGES.invalidCredentials;
    default:
      return MESSAGES.cloudUnreachable;
  }
}

/**
 * The user message of any error of the Wolf cloud.
 */
export function errorMessage(err) {
  return authErrorMessage(err) ?? MESSAGES.cloudUnreachable;
}
