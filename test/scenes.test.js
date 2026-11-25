import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { WolfHub, SCENE_TRIGGERS } from '../src/devices/index.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { normalizeConfig } from '../src/config.js';
import { clientFactoryFor, CONFIG, createFakeWolf } from './helpers/fakeWolf.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const declarationOf = (list, key) => manifest[list].find((entry) => entry.key === key);
const keysOf = (list) => (list ?? []).map((entry) => entry.key);

async function setup() {
  const fake = createFakeWolf();
  const gladys = createFakeGladys();
  const hub = new WolfHub(gladys, { clientFactory: await clientFactoryFor(fake) });
  hub.configure(normalizeConfig(CONFIG));
  await hub.refresh();
  return { fake, gladys, hub, system: hub.listSystems()[0] };
}

function assertDeclaredOutputs(key, outputs) {
  const declared = keysOf(declarationOf('scene_actions', key).outputs);
  for (const [name, value] of Object.entries(outputs)) {
    assert.ok(declared.includes(name), `output "${name}" of ${key} is not declared`);
    assert.ok(value === null || typeof value !== 'object', `output "${name}" must be a scalar`);
  }
}

function assertDeclaredData(key, data) {
  const trigger = declarationOf('scene_triggers', key);
  const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
  for (const [name, value] of Object.entries(data)) {
    assert.ok(
      declared.includes(name),
      `data.${name} of ${key} is not declared, the core would drop it`,
    );
    assert.ok(value === null || typeof value !== 'object', `data.${name} must be a primitive`);
  }
}

test('refresh_system reads the system and returns the declared outputs', async () => {
  const { hub, system } = await setup();
  const outputs = await SCENE_ACTIONS.refresh_system(hub, {
    fields: { device: system.externalId },
  });
  assert.deepEqual(outputs, { online: true, values_read: 13 });
  assertDeclaredOutputs('refresh_system', outputs);
});

test('refresh_system reports an offline gateway through its output', async () => {
  const { hub, fake, system } = await setup();
  fake.online = false;
  const outputs = await SCENE_ACTIONS.refresh_system(hub, {
    fields: { device: system.externalId },
  });
  assert.deepEqual(outputs, { online: false, values_read: 0 });
});

test('set_parameter writes by identifier or by name, list labels included', async () => {
  const { hub, fake, system } = await setup();
  const byId = await SCENE_ACTIONS.set_parameter(hub, {
    fields: { device: system.externalId, parameter: '11', value: '3' },
  });
  const byName = await SCENE_ACTIONS.set_parameter(hub, {
    fields: { device: system.externalId, parameter: 'operating mode', value: 'Eco' },
  });
  assert.deepEqual(byId, { parameter: 'Partydauer', value: '3' });
  assert.deepEqual(byName, { parameter: 'Operating mode', value: 'Eco' });
  assertDeclaredOutputs('set_parameter', byName);
  assert.deepEqual(
    fake.writes.map((w) => w.WriteParameterValues[0]),
    [
      { ValueId: 11, Value: '3' },
      { ValueId: 4, Value: '2' },
    ],
  );
});

test('set_parameter fails on a read-only or unknown parameter', async () => {
  const { hub, fake, system } = await setup();
  const fields = (parameter, value) => ({
    fields: { device: system.externalId, parameter, value },
  });
  await assert.rejects(SCENE_ACTIONS.set_parameter(hub, fields('1', '50')), /read-only/);
  await assert.rejects(SCENE_ACTIONS.set_parameter(hub, fields('nope', '1')), /No parameter/);
  await assert.rejects(
    SCENE_ACTIONS.set_parameter(hub, { fields: { device: 'ext:x', parameter: '4', value: '1' } }),
    /Unknown Wolf system/,
  );
  assert.equal(fake.writes.length, 0);
});

test('read_parameter returns the value as text and as a number', async () => {
  const { hub, system } = await setup();
  const outputs = await SCENE_ACTIONS.read_parameter(hub, {
    fields: { device: system.externalId, parameter: 'Outside temperature' },
  });
  assert.deepEqual(outputs, {
    found: true,
    parameter: 'Outside temperature',
    value: '8.5 °C',
    raw_value: '8.5',
    numeric_value: 8.5,
  });
  assertDeclaredOutputs('read_parameter', outputs);
  const mode = await SCENE_ACTIONS.read_parameter(hub, {
    fields: { device: system.externalId, parameter: '4' },
  });
  assert.equal(mode.value, 'Auto');
});

test('read_parameter reports an unknown parameter through its output', async () => {
  const { hub, system } = await setup();
  const outputs = await SCENE_ACTIONS.read_parameter(hub, {
    fields: { device: system.externalId, parameter: 'nope' },
  });
  assert.deepEqual(outputs, { found: false });
});

test('the events fired by the hub only carry declared keys', async () => {
  const { hub, gladys, fake, system } = await setup();
  await hub.readSystem(system);
  fake.values.set(7, '0');
  fake.online = false;
  await hub.readSystem(system);
  fake.online = true;
  await hub.readSystem(system);
  const keys = [...new Set(gladys.fake.sceneEvents.map((event) => event.key))].sort();
  assert.deepEqual(keys, [SCENE_TRIGGERS.GATEWAY_STATUS_CHANGED, SCENE_TRIGGERS.MODE_CHANGED]);
  for (const { key, data } of gladys.fake.sceneEvents) {
    assertDeclaredData(key, data);
    assert.equal(data.device, system.externalId);
  }
  const status = gladys.fake.sceneEvents.find(
    (e) => e.key === SCENE_TRIGGERS.GATEWAY_STATUS_CHANGED,
  );
  const options = declarationOf(
    'scene_triggers',
    SCENE_TRIGGERS.GATEWAY_STATUS_CHANGED,
  ).fields.find((field) => field.key === 'status').options;
  assert.ok(options.some((option) => option.value === status.data.status));
});
