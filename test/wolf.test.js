import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authenticate, extractVerificationToken, WolfAuthError } from '../src/wolf/auth.js';
import { WolfClient } from '../src/wolf/client.js';
import { localizeName, parseGuiDescription, parseLocalizedTexts } from '../src/wolf/parameters.js';
import {
  createFakeWolf,
  GUI_DESCRIPTION,
  PASSWORD,
  SYSTEM,
  TEXTS_SCRIPT,
  USERNAME,
} from './helpers/fakeWolf.js';

const system = { id: SYSTEM.Id, gatewayId: SYSTEM.GatewayId, name: SYSTEM.Name };
const newClient = (fake, extra = {}) =>
  new WolfClient({ username: USERNAME, password: PASSWORD, fetchImpl: fake.fetch, ...extra });

// --- sign-in -----------------------------------------------------------------

test('authenticate plays the login form, the redirects and the PKCE code exchange', async () => {
  const fake = createFakeWolf();
  const token = await authenticate({
    username: USERNAME,
    password: PASSWORD,
    fetchImpl: fake.fetch,
  });
  assert.equal(token.accessToken, 'token-1');
  assert.ok(token.expiresAt > Date.now());
  // S256: the challenge sent to /authorize is the hash of the verifier sent to /token.
  const expected = createHash('sha256')
    .update(fake.lastVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  assert.equal(fake.lastChallenge, expected);
});

test('authenticate refuses wrong credentials', async () => {
  const fake = createFakeWolf();
  await assert.rejects(
    authenticate({ username: USERNAME, password: 'wrong', fetchImpl: fake.fetch }),
    (err) => err instanceof WolfAuthError && err.reason === 'invalid_credentials',
  );
});

test('authenticate refuses a password longer than Wolf accepts, without calling Wolf', async () => {
  const fake = createFakeWolf();
  await assert.rejects(
    authenticate({ username: USERNAME, password: 'x'.repeat(31), fetchImpl: fake.fetch }),
    (err) => err.reason === 'password_too_long',
  );
  assert.equal(fake.requests.length, 0);
});

test('authenticate refuses missing credentials', async () => {
  await assert.rejects(
    authenticate({ username: '', password: '' }),
    (err) => err.reason === 'missing_credentials',
  );
});

test('extractVerificationToken reads the token whatever the attribute order', () => {
  assert.equal(
    extractVerificationToken(
      '<input name="__RequestVerificationToken" type="hidden" value="abc" />',
    ),
    'abc',
  );
  assert.equal(
    extractVerificationToken(
      '<input type="hidden" value="xyz" name="__RequestVerificationToken" />',
    ),
    'xyz',
  );
  assert.equal(extractVerificationToken('<form></form>'), null);
});

// --- parameters --------------------------------------------------------------

test('the normal mode keeps the end-user tab views, once per ValueId', () => {
  const parameters = parseGuiDescription(GUI_DESCRIPTION);
  assert.deepEqual(
    parameters.map((p) => p.valueId),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20, 21],
  );
  const outdoor = parameters.find((p) => p.valueId === 21);
  assert.equal(outdoor.unit, '°C', 'the heating schema gives the unit of a descriptor without one');
  assert.equal(outdoor.bundleId, 2000, 'the bundle of the tab view');
  assert.equal(parameters.find((p) => p.valueId === 4).readOnly, false);
  assert.deepEqual(parameters.find((p) => p.valueId === 4).items[2], { value: '2', label: 'Eco' });
  assert.deepEqual(
    [parameters.find((p) => p.valueId === 5).min, parameters.find((p) => p.valueId === 5).max],
    [20, 65],
  );
});

test('the expert mode walks every menu', () => {
  const parameters = parseGuiDescription(GUI_DESCRIPTION, { expert: true });
  assert.ok(parameters.some((p) => p.valueId === 30));
  assert.equal(parameters.find((p) => p.valueId === 30).bundleId, 3000);
});

test('names are translated with the portal texts, composite names included', () => {
  const texts = parseLocalizedTexts(TEXTS_SCRIPT);
  assert.equal(texts.Heizkreis, 'Heating circuit', 'a line the JSON parser refuses is dropped');
  assert.equal(
    localizeName('HK_Heizkreis---Raumsolltemperatur', texts),
    'Heating circuit Room setpoint',
  );
  assert.equal(localizeName('Kesseltemperatur', texts), 'Boiler temperature');
  assert.equal(localizeName('Unbekannt', texts), 'Unbekannt', 'an unknown name stays as it is');
  assert.equal(parseLocalizedTexts('no messages here'), null);
});

// --- portal client -------------------------------------------------------------

test('the client signs in once and opens one browser session', async () => {
  const fake = createFakeWolf();
  const client = newClient(fake);
  assert.deepEqual(await client.getSystems(), [system]);
  assert.equal(await client.isOnline(system), true);
  assert.equal(fake.logins, 1);
  assert.equal(fake.sessions, 1);
  const stateCall = fake.calls('GetSystemStateList')[0];
  assert.equal(JSON.parse(stateCall.body).SessionId, 9001, 'every body carries the session');
});

test('getParameters translates the names in the configured language', async () => {
  const fake = createFakeWolf();
  const parameters = await newClient(fake).getParameters(system, { language: 'en' });
  assert.equal(parameters.find((p) => p.valueId === 1).name, 'Boiler temperature');
  assert.equal(parameters.find((p) => p.valueId === 1).rawName, 'Kesseltemperatur');
});

test('getValues sends one request per bundle', async () => {
  const fake = createFakeWolf();
  const client = newClient(fake);
  const parameters = await client.getParameters(system);
  const values = await client.getValues(system, parameters);
  assert.equal(values.get(1), '61.5');
  assert.equal(values.get(21), '8.5');
  const bundles = fake.calls('GetParameterValues').map((r) => JSON.parse(r.body).BundleId);
  assert.deepEqual(bundles.sort(), [1000, 2000]);
});

test('writeValue posts the value id, the value and the bundle', async () => {
  const fake = createFakeWolf();
  const client = newClient(fake);
  await client.writeValue(system, { valueId: 5, bundleId: 1000 }, '55');
  assert.deepEqual(fake.writes[0].WriteParameterValues, [{ ValueId: 5, Value: '55' }]);
  assert.equal(fake.writes[0].BundleId, 1000);
  assert.equal(fake.writes[0].SystemId, SYSTEM.Id);
});

test('a 401 signs in again and retries once', async () => {
  const fake = createFakeWolf();
  const client = newClient(fake);
  await client.getSystems();
  fake.failNext = 401;
  assert.deepEqual(await client.getSystems(), [system]);
  assert.equal(fake.logins, 2);
});

test('an expired token is renewed before the request', async () => {
  const fake = createFakeWolf();
  let now = Date.now();
  const client = newClient(fake, { now: () => now });
  await client.getSystems();
  now += 2 * 3600 * 1000;
  await client.getSystems();
  assert.equal(fake.logins, 2);
});

test('the session is refreshed after a minute', async () => {
  const fake = createFakeWolf();
  let now = Date.now();
  const client = newClient(fake, { now: () => now });
  await client.getSystems();
  now += 61 * 1000;
  await client.getSystems();
  assert.equal(fake.calls('UpdateSession').length, 1);
});

test('the gateway read error is transient', async () => {
  const fake = createFakeWolf();
  const client = newClient(fake);
  const parameters = await client.getParameters(system);
  fake.readError = true;
  await assert.rejects(client.getValues(system, parameters), (err) => err.transient === true);
});
