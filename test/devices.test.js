import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { WolfHub, SCENE_TRIGGERS } from '../src/devices/index.js';
import { buildFeature, toPortalValue, toState } from '../src/devices/features.js';
import { normalizeConfig } from '../src/config.js';
import { clientFactoryFor, CONFIG, createFakeWolf } from './helpers/fakeWolf.js';

async function setup({ config = CONFIG, online = true } = {}) {
  const fake = createFakeWolf({ online });
  const gladys = createFakeGladys();
  let now = Date.now();
  const hub = new WolfHub(gladys, { clientFactory: await clientFactoryFor(fake), now: () => now });
  hub.configure(normalizeConfig(config));
  await hub.refresh();
  const [system] = hub.listSystems();
  return { fake, gladys, hub, system, tick: (ms) => (now += ms) };
}

const featureOf = (device, valueId) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${valueId}`));

test('one device per Wolf system, one feature per parameter', async () => {
  const { hub, gladys } = await setup();
  const [device] = hub.buildDevices();
  assert.equal(device.name, 'Maison');
  assert.equal(device.external_id, gladys.externalIds('system', 4242).device);
  assert.equal(device.features.length, 13);
  assert.equal(device.poll_frequency, DEVICE_POLL_FREQUENCIES.EVERY_MINUTES);
  assert.equal(device.should_poll, true);
});

test('Gladys accepts the discovery payload', async () => {
  const { hub, gladys } = await setup();
  await hub.publishDevices();
  assert.equal(gladys.fake.discoveredDevices.length, 1);
});

test('every feature carries the columns Gladys needs to create it', async () => {
  const { hub } = await setup({ config: { ...CONFIG, expert_mode: true } });
  for (const device of hub.buildDevices()) {
    for (const feature of device.features) {
      const where = `${device.name} / ${feature.name}`;
      assert.ok(typeof feature.name === 'string' && feature.name.length > 0, `${where}: name`);
      assert.ok(Number.isFinite(feature.min), `${where}: min`);
      assert.ok(Number.isFinite(feature.max), `${where}: max`);
      assert.ok(feature.min <= feature.max, `${where}: min <= max`);
      assert.equal(typeof feature.read_only, 'boolean', `${where}: read_only`);
      assert.equal(typeof feature.has_feedback, 'boolean', `${where}: has_feedback`);
    }
  }
});

test('parameters are mapped by unit and by list of choices', async () => {
  const { hub } = await setup();
  const [device] = hub.buildDevices();
  const expect = (valueId, category, type, readOnly) => {
    const feature = featureOf(device, valueId);
    assert.equal(feature.category, category, `${feature.name}: category`);
    assert.equal(feature.type, type, `${feature.name}: type`);
    assert.equal(feature.read_only, readOnly, `${feature.name}: read_only`);
  };
  const C = DEVICE_FEATURE_CATEGORIES;
  const T = DEVICE_FEATURE_TYPES;
  expect(1, C.TEMPERATURE_SENSOR, T.TEMPERATURE_SENSOR.PROBE, true);
  expect(2, C.PRESSURE_SENSOR, T.SENSOR.DECIMAL, true);
  expect(3, C.UNKNOWN, T.UNKNOWN.UNKNOWN, true);
  expect(4, C.TEXT, T.TEXT.SELECT, false);
  expect(5, C.THERMOSTAT, T.THERMOSTAT.TARGET_TEMPERATURE, false);
  expect(6, C.DURATION, T.DURATION.DECIMAL, true);
  expect(7, C.TEXT, T.TEXT.SELECT, true);
  expect(8, C.TEXT, T.TEXT.TEXT, true);
  expect(9, C.ENERGY_SENSOR, T.ENERGY_SENSOR.POWER, true);
  expect(10, C.ENERGY_SENSOR, T.ENERGY_SENSOR.ENERGY, true);
  // Writable without a unit: only reachable through the set_parameter scene action.
  expect(11, C.TEXT, T.TEXT.TEXT, true);
  expect(20, C.THERMOSTAT, T.THERMOSTAT.TARGET_TEMPERATURE, false);
  assert.deepEqual([featureOf(device, 5).min, featureOf(device, 5).max], [20, 65]);
  assert.deepEqual(
    featureOf(device, 4).supported_options.map((o) => o.label),
    ['Standby', 'Auto', 'Eco'],
  );
  assert.equal(featureOf(device, 20).name, 'Heating circuit Room setpoint');
});

test('feature ids follow the ValueId, not the name: a language change keeps them', async () => {
  const { hub } = await setup();
  const before = hub.buildDevices()[0].features.map((f) => f.external_id);
  hub.configure(normalizeConfig({ ...CONFIG, language: 'de' }));
  await hub.refresh();
  assert.deepEqual(
    hub.buildDevices()[0].features.map((f) => f.external_id),
    before,
  );
});

test('a read publishes the values as states, numbers and texts', async () => {
  const { hub, gladys, system } = await setup();
  assert.equal(await hub.readSystem(system), 13);
  assert.equal(gladys.fake.lastState(system.ids.feature('1')), 61.5);
  assert.equal(gladys.fake.lastState(system.ids.feature('2')), 1.8);
  const modeState = gladys.fake.states.find(
    (s) => s.device_feature_external_id === system.ids.feature('4'),
  );
  assert.equal(modeState.text, '1');
  const rpm = gladys.fake.states.find(
    (s) => s.device_feature_external_id === system.ids.feature('8'),
  );
  assert.equal(rpm.text, '1450 U/min');
  assert.deepEqual(gladys.fake.transports.at(-1), {
    device_external_id: system.externalId,
    transport: 'cloud',
  });
});

test('the poll follows the refresh interval of the configuration', async () => {
  const { hub, fake, system, tick } = await setup({ config: { ...CONFIG, poll_frequency: 300 } });
  const device = { external_id: system.externalId };
  assert.equal(await hub.poll(device), true);
  tick(60 * 1000);
  assert.equal(await hub.poll(device), false, 'not due after one minute');
  tick(240 * 1000);
  assert.equal(await hub.poll(device), true, 'due after five minutes');
  assert.equal(fake.calls('GetSystemStateList').length, 2);
});

test('mode_changed fires on a change of a list parameter, never on the first read', async () => {
  const { hub, gladys, fake, system } = await setup();
  await hub.readSystem(system);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'first read: no event');
  fake.values.set(4, '2');
  fake.values.set(1, '70'); // not a list: no event
  await hub.readSystem(system);
  assert.equal(gladys.fake.sceneEvents.length, 1);
  const [{ key, data }] = gladys.fake.sceneEvents;
  assert.equal(key, SCENE_TRIGGERS.MODE_CHANGED);
  assert.deepEqual(data, {
    device: system.externalId,
    parameter: 'Operating mode',
    parameter_id: '4',
    value: 'Eco',
    previous_value: 'Auto',
  });
});

test('a write never fires mode_changed (no scene loop)', async () => {
  const { hub, gladys, system } = await setup();
  await hub.readSystem(system);
  await hub.writeParameter(system, hub.findParameter(system, '4'), 'Eco');
  await hub.readSystem(system);
  assert.equal(gladys.fake.sceneEvents.length, 0);
});

test('gateway_status_changed fires on each transition, with the badge', async () => {
  const { hub, gladys, fake, system } = await setup();
  await hub.readSystem(system);
  fake.online = false;
  assert.equal(await hub.readSystem(system), 0, 'an offline gateway is not read');
  fake.online = true;
  await hub.readSystem(system);
  assert.deepEqual(
    gladys.fake.sceneEvents.map((e) => [e.key, e.data.status]),
    [
      [SCENE_TRIGGERS.GATEWAY_STATUS_CHANGED, 'offline'],
      [SCENE_TRIGGERS.GATEWAY_STATUS_CHANGED, 'online'],
    ],
  );
  assert.deepEqual(
    gladys.fake.transports.map((entry) => entry.transport),
    ['cloud', 'unreachable', 'cloud'],
  );
});

test('onSetValue writes a setpoint and a mode, and publishes them', async () => {
  const { hub, gladys, fake, system } = await setup();
  const [device] = hub.buildDevices();
  await hub.setValue(device, featureOf(device, 5), 55);
  await hub.setValue(device, featureOf(device, 4), '0');
  assert.deepEqual(
    fake.writes.map((w) => w.WriteParameterValues[0]),
    [
      { ValueId: 5, Value: '55' },
      { ValueId: 4, Value: '0' },
    ],
  );
  assert.equal(gladys.fake.lastState(system.ids.feature('5')), 55);
});

test('onSetValue refuses an out-of-range setpoint and a read-only feature', async () => {
  const { hub, fake } = await setup();
  const [device] = hub.buildDevices();
  await assert.rejects(hub.setValue(device, featureOf(device, 5), 90), /out of the range/);
  await assert.rejects(hub.setValue(device, featureOf(device, 1), 50), /cannot be controlled/);
  await assert.rejects(
    hub.setValue({ external_id: 'unknown' }, featureOf(device, 5), 50),
    /Unknown/,
  );
  assert.equal(fake.writes.length, 0);
});

test('toState and toPortalValue handle the portal formats', () => {
  const list = {
    name: 'Mode',
    items: [{ value: '1', label: 'Auto' }],
    readOnly: false,
    unit: null,
  };
  assert.deepEqual(toState({ unit: '°C', readOnly: true }, '21,5'), { state: 21.5 });
  assert.equal(toState({ unit: '°C', readOnly: true }, '---'), null);
  assert.equal(toPortalValue(list, 'auto'), '1', 'a label, case-insensitive');
  assert.equal(toPortalValue(list, '1'), '1');
  assert.throws(() => toPortalValue(list, 'Turbo'), /not a choice/);
  assert.throws(() => toPortalValue({ name: 'x', min: null, max: null }, 'abc'), /not a number/);
  // A feature name is never empty, even when the portal gives none.
  assert.equal(
    buildFeature({ name: '', valueId: 7, unit: '%', readOnly: true }, 'ext:x:7').name,
    '7',
  );
});
