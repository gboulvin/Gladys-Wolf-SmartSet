// End-to-end: the SDK's fake Gladys drives the handlers of src/app.js, in
// front of the fake Wolf portal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../src/app.js';
import { MESSAGES } from '../src/i18n.js';
import { clientFactoryFor, CONFIG, createFakeWolf } from './helpers/fakeWolf.js';

async function start({ config = CONFIG, online = true } = {}) {
  const fake = createFakeWolf({ online });
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, { clientFactory: await clientFactoryFor(fake) });
  await gladys.connect();
  return { fake, gladys, app };
}

test('on connection, the systems are published and the status is connected', async (t) => {
  const { gladys, app } = await start();
  t.after(app.stop);
  assert.equal(gladys.fake.discoveredDevices.length, 1);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.ok(gladys.fake.widgetRefreshes.includes('wolf_system'));
});

test('without credentials, the status asks for them', async (t) => {
  const { gladys, fake, app } = await start({ config: {} });
  t.after(app.stop);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.deepEqual(gladys.fake.connectionStatus.message, MESSAGES.missingCredentials);
  assert.equal(fake.requests.length, 0);
});

test('wrong credentials are reported, never thrown', async (t) => {
  const { gladys, app } = await start({ config: { ...CONFIG, password: 'wrong' } });
  t.after(app.stop);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.deepEqual(gladys.fake.connectionStatus.message, MESSAGES.invalidCredentials);
  assert.equal(gladys.fake.discoveredDevices.length, 0);
});

test('a poll reads the created system and publishes its states', async (t) => {
  const { gladys, app } = await start();
  t.after(app.stop);
  const [device] = gladys.fake.discoveredDevices;
  assert.deepEqual(await gladys.fake.poll(device), { success: true });
  assert.equal(gladys.fake.lastState(`${device.external_id}:1`), 61.5);
});

test('a transient gateway error does not fail the poll', async (t) => {
  const { gladys, fake, app } = await start();
  t.after(app.stop);
  const [device] = gladys.fake.discoveredDevices;
  fake.readError = true;
  assert.deepEqual(await gladys.fake.poll(device), { success: true });
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('a command from Gladys reaches the boiler', async (t) => {
  const { gladys, fake, app } = await start();
  t.after(app.stop);
  const [device] = gladys.fake.discoveredDevices;
  const setpoint = device.features.find((f) => f.external_id.endsWith(':20'));
  assert.deepEqual(await gladys.fake.setValue(device, setpoint, 21), { success: true });
  assert.deepEqual(fake.writes[0].WriteParameterValues, [{ ValueId: 20, Value: '21' }]);
});

test('the test_connection action counts the systems', async (t) => {
  const { gladys, app } = await start();
  t.after(app.stop);
  const ack = await gladys.fake.action('test_connection');
  assert.equal(ack.success, true);
  const message = ack.data.message;
  assert.match(message.en, /1 system/);
  assert.ok(message.fr && message.de && message.es);
});

test('the list_parameters action lists the writable parameters with their ids', async (t) => {
  const { gladys, app } = await start();
  t.after(app.stop);
  const [device] = gladys.fake.discoveredDevices;
  const ack = await gladys.fake.action('list_parameters', { device: device.external_id });
  const { en } = ack.data.message;
  assert.match(en, /Operating mode \(4\)/);
  assert.match(en, /Standby \| Auto \| Eco/);
  assert.doesNotMatch(en, /Boiler temperature/, 'read-only parameters are not listed');
});

test('a configuration update re-publishes the names in the new language', async (t) => {
  const { gladys, fake, app } = await start();
  t.after(app.stop);
  fake.texts = 'var x = { messages: { "Kesseltemperatur": "Température chaudière" } };';
  await gladys.fake.configUpdated({ ...CONFIG, language: 'fr' });
  const [device] = gladys.fake.discoveredDevices;
  assert.ok(device.features.some((f) => f.name === 'Température chaudière'));
  assert.equal(app.getConfig().language, 'fr');
});

test('a scan request refreshes the systems', async (t) => {
  const { gladys, fake, app } = await start();
  t.after(app.stop);
  const before = fake.calls('GetSystemList').length;
  await gladys.fake.scanRequest();
  assert.equal(fake.calls('GetSystemList').length, before + 1);
});
