// Every user-facing text exists in the four languages of the integration:
// English, French, German and Spanish.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { LANGUAGES, MESSAGES, format } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

// Collect every multi-language object of the manifest, with its path.
function multiLanguageTexts(node, path = 'manifest', found = []) {
  if (Array.isArray(node)) {
    node.forEach((child, index) => multiLanguageTexts(child, `${path}[${index}]`, found));
  } else if (node && typeof node === 'object') {
    if (typeof node.en === 'string') {
      found.push({ path, text: node });
      return found;
    }
    for (const [key, child] of Object.entries(node)) {
      multiLanguageTexts(child, `${path}.${key}`, found);
    }
  }
  return found;
}

test('every manifest text is translated in en, fr, de and es', () => {
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 50);
  for (const { path, text } of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), `${path}: languages`);
    for (const language of LANGUAGES) {
      assert.ok(text[language].trim().length > 0, `${path}.${language} is empty`);
    }
  }
});

test('every message is translated in en, fr, de and es, with the same placeholders', () => {
  for (const [key, message] of Object.entries(MESSAGES)) {
    assert.deepEqual(Object.keys(message).sort(), [...LANGUAGES].sort(), `${key}: languages`);
    const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const language of LANGUAGES) {
      assert.deepEqual(
        placeholders(message[language]),
        placeholders(message.en),
        `${key}.${language}`,
      );
    }
  }
});

test('format fills the placeholders of every language', () => {
  const message = format(MESSAGES.connected, { count: 2 });
  for (const language of LANGUAGES) {
    assert.ok(message[language].includes('2'), language);
    assert.ok(!message[language].includes('{count}'), language);
  }
});

test('the user documentation exists in every language', async () => {
  for (const language of LANGUAGES) {
    await access(new URL(`../docs/${language}.md`, import.meta.url));
  }
});
