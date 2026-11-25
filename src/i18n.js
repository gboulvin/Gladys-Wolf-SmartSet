// -----------------------------------------------------------------------------
// User-facing messages, in the four languages of the integration.
//
// Gladys picks the user's language from a multi-language object and falls
// back to `en`: every message carries en, fr, de and es (checked by
// test/i18n.test.js).
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/**
 * Fill the `{name}` placeholders of every language of a message.
 */
export function format(message, values = {}) {
  return Object.fromEntries(
    Object.entries(message).map(([language, text]) => [
      language,
      text.replace(/\{(\w+)\}/g, (match, key) =>
        Object.hasOwn(values, key) ? String(values[key]) : match,
      ),
    ]),
  );
}

export const MESSAGES = {
  missingCredentials: {
    en: 'Enter your Wolf SmartSet username and password in the configuration.',
    fr: 'Renseignez votre identifiant et votre mot de passe Wolf SmartSet dans la configuration.',
    de: 'Geben Sie Ihren Wolf-SmartSet-Benutzernamen und Ihr Passwort in der Konfiguration ein.',
    es: 'Introduzca su usuario y contraseña de Wolf SmartSet en la configuración.',
  },
  invalidCredentials: {
    en: 'Wolf SmartSet refused the username or the password.',
    fr: 'Wolf SmartSet a refusé l’identifiant ou le mot de passe.',
    de: 'Wolf SmartSet hat den Benutzernamen oder das Passwort abgelehnt.',
    es: 'Wolf SmartSet rechazó el usuario o la contraseña.',
  },
  passwordTooLong: {
    en: 'Wolf SmartSet only accepts passwords of 30 characters or less.',
    fr: 'Wolf SmartSet n’accepte que les mots de passe de 30 caractères au plus.',
    de: 'Wolf SmartSet akzeptiert nur Passwörter mit höchstens 30 Zeichen.',
    es: 'Wolf SmartSet solo acepta contraseñas de 30 caracteres como máximo.',
  },
  cloudUnreachable: {
    en: 'The Wolf SmartSet cloud cannot be reached, retrying at the next poll.',
    fr: 'Le cloud Wolf SmartSet est injoignable, nouvel essai à la prochaine lecture.',
    de: 'Die Wolf-SmartSet-Cloud ist nicht erreichbar, neuer Versuch bei der nächsten Abfrage.',
    es: 'No se puede acceder a la nube de Wolf SmartSet, se reintentará en la próxima lectura.',
  },
  connected: {
    en: 'Connected to Wolf SmartSet: {count} system(s) found.',
    fr: 'Connecté à Wolf SmartSet : {count} installation(s) trouvée(s).',
    de: 'Mit Wolf SmartSet verbunden: {count} Anlage(n) gefunden.',
    es: 'Conectado a Wolf SmartSet: {count} instalación(es) encontrada(s).',
  },
  noSystem: {
    en: 'Connected, but this Wolf SmartSet account has no system.',
    fr: 'Connecté, mais ce compte Wolf SmartSet n’a aucune installation.',
    de: 'Verbunden, aber dieses Wolf-SmartSet-Konto hat keine Anlage.',
    es: 'Conectado, pero esta cuenta de Wolf SmartSet no tiene ninguna instalación.',
  },
  unknownDevice: {
    en: 'This device is not a Wolf SmartSet system of this account.',
    fr: 'Cet appareil n’est pas une installation Wolf SmartSet de ce compte.',
    de: 'Dieses Gerät ist keine Wolf-SmartSet-Anlage dieses Kontos.',
    es: 'Este dispositivo no es una instalación Wolf SmartSet de esta cuenta.',
  },
  gatewayOffline: {
    en: 'The Wolf gateway is offline.',
    fr: 'La passerelle Wolf est hors ligne.',
    de: 'Das Wolf-Gateway ist offline.',
    es: 'La pasarela Wolf está desconectada.',
  },
  refreshed: {
    en: '{name}: {count} values read.',
    fr: '{name} : {count} valeurs lues.',
    de: '{name}: {count} Werte gelesen.',
    es: '{name}: {count} valores leídos.',
  },
  writableParameters: {
    en: 'Writable parameters of {name}: {list}',
    fr: 'Paramètres modifiables de {name} : {list}',
    de: 'Änderbare Parameter von {name}: {list}',
    es: 'Parámetros modificables de {name}: {list}',
  },
  noWritableParameter: {
    en: '{name} has no writable parameter.',
    fr: '{name} n’a aucun paramètre modifiable.',
    de: '{name} hat keinen änderbaren Parameter.',
    es: '{name} no tiene ningún parámetro modificable.',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: 'L’initialisation a échoué, consultez les logs de l’intégration.',
    de: 'Die Initialisierung ist fehlgeschlagen, prüfen Sie die Protokolle der Integration.',
    es: 'La inicialización falló, revise los registros de la integración.',
  },
};
