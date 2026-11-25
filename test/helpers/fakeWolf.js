// -----------------------------------------------------------------------------
// In-memory fake of the Wolf SmartSet portal, as a `fetch` implementation.
//
// It plays the sign-in (login form, antiforgery cookie, redirects, code
// exchange), the browser session and the portal API calls the integration
// uses, and records every request. Tests never touch the network.
// -----------------------------------------------------------------------------

export const USERNAME = 'john.doe';
export const PASSWORD = 'secret-password';
export const SYSTEM = { Id: 4242, GatewayId: 1717, Name: 'Maison' };

export const GUI_DESCRIPTION = {
  MenuItems: [
    {
      Name: 'Benutzer',
      TabViews: [
        {
          TabName: 'Heizgerät',
          BundleId: 1000,
          ParameterDescriptors: [
            {
              ValueId: 1,
              ParameterId: 101,
              Name: 'Kesseltemperatur',
              Unit: '°C',
              IsReadOnly: true,
            },
            { ValueId: 2, ParameterId: 102, Name: 'Anlagendruck', Unit: 'bar', IsReadOnly: true },
            { ValueId: 3, ParameterId: 103, Name: 'Modulationsgrad', Unit: '%', IsReadOnly: true },
            {
              ValueId: 4,
              ParameterId: 104,
              Name: 'Betriebsart',
              IsReadOnly: false,
              ListItems: [
                { Value: 0, DisplayText: 'Standby' },
                { Value: 1, DisplayText: 'Auto' },
                { Value: 2, DisplayText: 'Eco' },
              ],
            },
            {
              ValueId: 5,
              ParameterId: 105,
              Name: 'Warmwassersolltemperatur',
              Unit: '°C',
              IsReadOnly: false,
              MinValue: 20,
              MaxValue: 65,
            },
            {
              ValueId: 6,
              ParameterId: 106,
              Name: 'Betriebsstunden',
              Unit: 'Std',
              IsReadOnly: true,
            },
            {
              ValueId: 7,
              ParameterId: 107,
              Name: 'Brennerstatus',
              IsReadOnly: true,
              ListItems: [
                { Value: 0, DisplayText: 'Aus' },
                { Value: 1, DisplayText: 'Ein' },
              ],
            },
            {
              ValueId: 8,
              ParameterId: 108,
              Name: 'Pumpendrehzahl',
              Unit: 'U/min',
              IsReadOnly: true,
            },
            { ValueId: 9, ParameterId: 109, Name: 'Heizleistung', Unit: 'kW', IsReadOnly: true },
            { ValueId: 10, ParameterId: 110, Name: 'Wärmemenge', Unit: 'kWh', IsReadOnly: true },
            {
              ValueId: 11,
              ParameterId: 111,
              Name: 'Partydauer',
              IsReadOnly: false,
              MinValue: 0,
              MaxValue: 10,
            },
          ],
        },
        {
          TabName: 'Heizkreis',
          BundleId: 2000,
          SVGHeatingSchemaConfigDevices: [{ parameters: [{ valueId: 21, unit: '°C' }] }],
          ParameterDescriptors: [
            {
              ValueId: 20,
              ParameterId: 120,
              Name: 'HK_Heizkreis---Raumsolltemperatur',
              Unit: '°C',
              IsReadOnly: false,
              MinValue: 5,
              MaxValue: 30,
            },
            // Duplicated across tabs: published once.
            {
              ValueId: 1,
              ParameterId: 101,
              Name: 'Kesseltemperatur',
              Unit: '°C',
              IsReadOnly: true,
            },
            { ValueId: 21, ParameterId: 121, Name: 'Außentemperatur', IsReadOnly: true },
          ],
        },
      ],
    },
    {
      Name: 'Fachmann',
      TabViews: [
        {
          TabName: 'Fachmann',
          BundleId: 3000,
          ParameterDescriptors: [
            { ValueId: 30, ParameterId: 130, Name: 'Hysterese', Unit: '°C', IsReadOnly: true },
          ],
        },
      ],
    },
  ],
};

export const INITIAL_VALUES = {
  1: '61.5',
  2: '1.8',
  3: '42',
  4: '1',
  5: '50',
  6: '12034',
  7: '1',
  8: '1450',
  9: '12.5',
  10: '35210',
  11: '0',
  20: '20.5',
  21: '8.5',
  30: '5',
};

export const TEXTS_SCRIPT = `var localizedText = {
  culture: 'en',
  messages: {
    "Kesseltemperatur": "Boiler temperature",
    // A comment the JSON parser refuses: dropped.
    "Heizkreis": "Heating circuit",
    "Raumsolltemperatur": "Room setpoint",
    "Außentemperatur": "Outside temperature",
    "Betriebsart": "Operating mode"
  }
};`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const LOGIN_PAGE = `<html><body><form method="post">
<input name="Input.Username" type="text" />
<input name="__RequestVerificationToken" type="hidden" value="anti-forgery-token" />
</form></body></html>`;

/**
 * Build a fake portal. `fake.fetch` is the `fetchImpl` to inject.
 */
export function createFakeWolf({ online = true, values = INITIAL_VALUES } = {}) {
  const fake = {
    online,
    values: new Map(Object.entries(values).map(([id, value]) => [Number(id), value])),
    requests: [],
    writes: [],
    logins: 0,
    sessions: 0,
    // Set to a status code to make the next portal API call fail once.
    failNext: null,
    // Set to make GetParameterValues answer the gateway read error.
    readError: false,
    tokenExpiresIn: 3600,
    texts: TEXTS_SCRIPT,
  };

  fake.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body;
    const headers = new Headers(init.headers ?? {});
    fake.requests.push({ method, path: url.pathname, query: url.search, body, headers });

    // --- identity server --------------------------------------------------
    if (url.pathname === '/idsrv/Account/Login' && method === 'GET') {
      return new Response(LOGIN_PAGE, {
        status: 200,
        headers: { 'Set-Cookie': 'antiforgery=cookie-value; path=/; httponly' },
      });
    }
    if (url.pathname === '/idsrv/Account/Login' && method === 'POST') {
      const form = new URLSearchParams(body);
      const cookieOk = (headers.get('cookie') ?? '').includes('antiforgery=cookie-value');
      if (
        !cookieOk ||
        form.get('__RequestVerificationToken') !== 'anti-forgery-token' ||
        form.get('Input.Username') !== USERNAME ||
        form.get('Input.Password') !== PASSWORD
      ) {
        return new Response(LOGIN_PAGE, { status: 200 });
      }
      return new Response(null, {
        status: 302,
        headers: {
          Location: url.searchParams.get('ReturnUrl'),
          'Set-Cookie': 'idsrv=session; path=/',
        },
      });
    }
    if (url.pathname === '/idsrv/connect/authorize/callback') {
      if (!(headers.get('cookie') ?? '').includes('idsrv=session')) {
        return new Response('no session', { status: 400 });
      }
      fake.lastChallenge = url.searchParams.get('code_challenge');
      return new Response(null, {
        status: 302,
        headers: {
          Location: `https://www.wolf-smartset.com/signin-callback.html?code=auth-code&state=${url.searchParams.get('state')}`,
        },
      });
    }
    if (url.pathname === '/idsrv/connect/token') {
      const form = new URLSearchParams(body);
      if (form.get('code') !== 'auth-code' || !form.get('code_verifier')) {
        return json({ error: 'invalid_grant' }, 400);
      }
      fake.logins += 1;
      fake.lastVerifier = form.get('code_verifier');
      return json({ access_token: `token-${fake.logins}`, expires_in: fake.tokenExpiresIn });
    }
    if (url.pathname.startsWith('/js/localized-text/')) {
      return new Response(fake.texts, { status: 200 });
    }

    // --- portal API -----------------------------------------------------------
    if (!url.pathname.startsWith('/portal/api/portal/')) {
      return new Response('not found', { status: 404 });
    }
    if (!(headers.get('authorization') ?? '').startsWith('Bearer token-')) {
      return json({ Message: 'unauthorized' }, 401);
    }
    const call = url.pathname.slice('/portal/api/portal/'.length);
    if (call === 'CreateSession2') {
      fake.sessions += 1;
      return json({ BrowserSessionId: 9000 + fake.sessions });
    }
    if (fake.failNext) {
      const status = fake.failNext;
      fake.failNext = null;
      return json({ Message: 'failure' }, status);
    }
    const payload = body ? JSON.parse(body) : {};
    switch (call) {
      case 'UpdateSession':
        return json({});
      case 'GetSystemList':
        return json([SYSTEM]);
      case 'GetSystemStateList':
        return json([{ GatewayState: { IsOnline: fake.online } }]);
      case 'GetGuiDescriptionForGateway':
        return json(GUI_DESCRIPTION);
      case 'GetParameterValues':
        if (fake.readError) {
          return json({ ErrorCode: 1, Message: 'internal msg: ReadParameterValues error' });
        }
        return json({
          LastAccess: '2026-11-25T10:00:00Z',
          Values: payload.ValueIdList.filter((id) => fake.values.has(id)).map((id) => ({
            ValueId: id,
            Value: fake.values.get(id),
            State: 1,
          })),
        });
      case 'WriteParameterValues':
        fake.writes.push(payload);
        for (const { ValueId, Value } of payload.WriteParameterValues) {
          fake.values.set(ValueId, Value);
        }
        return json({ Values: [] });
      default:
        return new Response('not found', { status: 404 });
    }
  };

  fake.calls = (name) => fake.requests.filter((r) => r.path.endsWith(`/${name}`));
  return fake;
}

/**
 * A client factory for the hub, bound to a fake portal.
 */
export async function clientFactoryFor(fake) {
  const { WolfClient } = await import('../../src/wolf/client.js');
  return (credentials) => new WolfClient({ ...credentials, fetchImpl: fake.fetch });
}

export const CONFIG = { username: USERNAME, password: PASSWORD, language: 'en' };
