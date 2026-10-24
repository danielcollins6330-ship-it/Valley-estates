import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('reviewer can reach complete offline credits from the game menu', () => {
  assert.match(read('index.html'), /href="credits.html"/);
  const credits = read('credits.html');
  for (const source of ['CREDITS.md', 'ASSET_CREDITS.md', 'AUDIO_CREDITS.md', 'THIRD_PARTY_LICENSES.txt']) {
    const original = read(source).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
    assert.ok(credits.includes(original), source + ' must be present verbatim, HTML-escaped');
  }
  assert.match(credits, /href="index.html"/);
});

test('native and web staging require credits and software licence notices', () => {
  const staging = read('scripts/stage-web.mjs');
  assert.match(staging, /"credits.html"/); assert.match(staging, /"THIRD_PARTY_LICENSES.txt"/);
  const licences = read('THIRD_PARTY_LICENSES.txt');
  assert.equal((licences.match(/Permission is hereby granted/g) || []).length, 3);
});

test('App Review packet retains the real-device recording and QA gate', () => {
  const response = read('store/app-review/response.md');
  for (let section = 1; section <= 6; section++) assert.match(response, new RegExp('## ' + section + '\\.'));
  assert.match(response, /PENDING OWNER RECORDING/); assert.match(response, /do not send or resubmit/i);
  assert.match(response, /Do not claim that changing review notes alone is a reply/);
  assert.match(read('store/app-review/recording-checklist.md'), /physical iPad QA pass/);
});

test('signed TestFlight archive runs regression tests before bundling', () => {
  const workflow = read('.github/workflows/ios-testflight.yml');
  assert.ok(workflow.indexOf('run: npm test') > 0);
  assert.ok(workflow.indexOf('run: npm test') < workflow.indexOf('- name: Bundle the game and sync iOS'));
});
