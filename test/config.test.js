import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, DEFAULT_CONFIG, hasCredentials } from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('normalizeConfig keeps user values over the defaults', () => {
  const config = normalizeConfig({ username: ' john ', password: 'pw', language: 'de' });
  assert.equal(config.username, 'john', 'the username is trimmed');
  assert.equal(config.password, 'pw');
  assert.equal(config.language, 'de');
});

test('normalizeConfig coerces the values coming from a form', () => {
  const config = normalizeConfig({ poll_frequency: '600', expert_mode: 'true' });
  assert.equal(config.poll_frequency, 600);
  assert.equal(config.expert_mode, true);
});

test('normalizeConfig clamps the refresh interval and rejects an unknown language', () => {
  assert.equal(normalizeConfig({ poll_frequency: 5 }).poll_frequency, 60);
  assert.equal(normalizeConfig({ poll_frequency: 99999 }).poll_frequency, 3600);
  assert.equal(
    normalizeConfig({ poll_frequency: 'abc' }).poll_frequency,
    DEFAULT_CONFIG.poll_frequency,
  );
  assert.equal(normalizeConfig({ language: 'xx' }).language, 'en');
});

test('hasCredentials needs both the username and the password', () => {
  assert.equal(hasCredentials(normalizeConfig({ username: 'a', password: 'b' })), true);
  assert.equal(hasCredentials(normalizeConfig({ username: 'a' })), false);
  assert.equal(hasCredentials(normalizeConfig()), false);
});
