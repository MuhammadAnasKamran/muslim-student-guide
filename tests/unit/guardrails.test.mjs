// Mechanical checks for the rules in CLAUDE.md that code review tends to miss.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { ENTRY_KEYS, STATUSES } from '../../scripts/schema.mjs';
import { CHIP_KEYS, FIELD_LABELS, SPECIAL_KEYS, STATUS_LABELS, SUMMARY_KEYS } from '../../src/guide.js';

const root = new URL('../../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const srcFiles = readdirSync(new URL('src/', root)).map((name) => [name, read(`src/${name}`)]);

test('rule 3: no runtime dependencies, dev dependencies pinned exactly', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies, undefined);
  for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
    assert.match(version, /^\d+\.\d+\.\d+$/, `${name}@${version} must be an exact version`);
  }
});

test('rule 4: no CDN or external resources in the site', () => {
  // The SVG namespace is an identifier createElementNS needs, never a request.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  for (const [name, text] of srcFiles) {
    assert.doesNotMatch(text.split(SVG_NS).join(''), /https?:\/\//, `${name} references an external URL`);
  }
});

test('rule 5: no innerHTML or other HTML-string APIs', () => {
  for (const [name, text] of srcFiles) {
    assert.doesNotMatch(text, /\.(innerHTML|outerHTML)\b|insertAdjacentHTML|document\.write/, name);
  }
});

test('rule 7: no browser storage or caches', () => {
  for (const [name, text] of srcFiles) {
    assert.doesNotMatch(text, /localStorage|sessionStorage|indexedDB|caches\.|serviceWorker/, name);
  }
});

test('every allowed key has a place on screen, so nothing vanishes silently', () => {
  for (const key of ENTRY_KEYS) {
    const placed = SUMMARY_KEYS.includes(key) || CHIP_KEYS.includes(key) || SPECIAL_KEYS.includes(key) || FIELD_LABELS[key];
    assert.ok(placed, `key "${key}" has no place in src/guide.js`);
  }
});

test('the site has a distinct word for exactly the four allowed statuses', () => {
  assert.deepEqual(Object.keys(STATUS_LABELS).sort(), [...STATUSES].sort());
  const words = Object.values(STATUS_LABELS).map((s) => s.label);
  assert.equal(new Set(words).size, words.length);
});
