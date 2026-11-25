import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { WolfHub } from '../src/devices/index.js';
import { SYSTEM_WIDGET, WIDGETS, refreshWidgets } from '../src/widgets.js';
import { normalizeConfig } from '../src/config.js';
import { clientFactoryFor, CONFIG, createFakeWolf } from './helpers/fakeWolf.js';

const widget = WIDGETS[SYSTEM_WIDGET];

async function setup({ config = CONFIG, refresh = true } = {}) {
  const fake = createFakeWolf();
  const gladys = createFakeGladys();
  const hub = new WolfHub(gladys, { clientFactory: await clientFactoryFor(fake) });
  hub.configure(normalizeConfig(config));
  if (refresh) {
    await hub.refresh();
  }
  return { fake, gladys, hub, system: hub.listSystems()[0] };
}

const getContent = (hub, settings = {}) =>
  widget.get(hub, { settings, language: 'en', units: 'metric' });

test('the wolf_system content is rendered exactly as sent, before and after a read', async () => {
  const { hub, system } = await setup();
  assert.deepEqual(validateWidgetContent(await getContent(hub)), []);
  await hub.readSystem(system);
  const content = await getContent(hub, { device: system.externalId });
  assert.deepEqual(validateWidgetContent(content), []);
  const status = content.components.find((c) => c.type === 'status');
  assert.ok(
    status.items.some((item) => item.value === 'Auto'),
    'the current mode is shown',
  );
});

test('the not-connected contents are valid too', async () => {
  const withoutCredentials = await setup({ config: {}, refresh: false });
  const content = await getContent(withoutCredentials.hub);
  assert.deepEqual(validateWidgetContent(content), []);
  const signedOut = await setup({ refresh: false });
  assert.deepEqual(validateWidgetContent(await getContent(signedOut.hub)), []);
});

test('the live tiles reference features the integration publishes', async () => {
  const { hub } = await setup();
  const featureIds = new Set(
    hub.buildDevices().flatMap((d) => d.features.map((f) => f.external_id)),
  );
  const tiles = (await getContent(hub)).components.filter((c) => c.device_feature);
  assert.ok(tiles.length > 0 && tiles.length <= 4);
  for (const tile of tiles) {
    assert.ok(featureIds.has(tile.device_feature), `unknown feature ${tile.device_feature}`);
  }
});

test('every button action is handled and answers a short toast in four languages', async () => {
  const { hub, fake } = await setup();
  const buttons = (await getContent(hub)).components.filter((c) => c.type === 'button' && c.action);
  assert.ok(buttons.length > 0);
  for (const { action } of buttons) {
    const message = await widget.action(hub, {
      actionKey: action.key,
      params: action.params ?? {},
    });
    for (const language of ['en', 'fr', 'de', 'es']) {
      assert.ok(message[language], `toast in ${language}`);
      assert.ok(message[language].length <= 200);
    }
  }
  assert.equal(fake.calls('GetSystemStateList').length, 1, 'the refresh button read the system');
});

test('an unknown widget action fails, so the user sees the error', async () => {
  const { hub } = await setup();
  await assert.rejects(
    widget.action(hub, { actionKey: 'unknown', params: {} }),
    /Unknown widget action/,
  );
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.keys(WIDGETS));
});
