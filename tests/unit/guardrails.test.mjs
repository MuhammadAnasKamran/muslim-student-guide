// Mechanical checks for the rules in CLAUDE.md that code review tends to miss.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { ENTRY_KEYS, STATUSES } from '../../scripts/schema.mjs';
import { CHIP_KEYS, FIELD_LABELS, PRAYER_KEYS, SPECIAL_KEYS, STATUS_LABELS, SUMMARY_KEYS } from '../../src/guide.js';

const root = new URL('../../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
// Text files only: src/ also holds the background photograph.
const srcFiles = readdirSync(new URL('src/', root))
  .filter((name) => /\.(html|css|js)$/.test(name))
  .map((name) => [name, read(`src/${name}`)]);

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
    const placed = SUMMARY_KEYS.includes(key) || CHIP_KEYS.includes(key) || PRAYER_KEYS.includes(key) || SPECIAL_KEYS.includes(key) || FIELD_LABELS[key];
    assert.ok(placed, `key "${key}" has no place in src/guide.js`);
  }
});

test('the site has a distinct word for exactly the four allowed statuses', () => {
  assert.deepEqual(Object.keys(STATUS_LABELS).sort(), [...STATUSES].sort());
  const words = Object.values(STATUS_LABELS).map((s) => s.label);
  assert.equal(new Set(words).size, words.length);
});

test('the background photo is sized to the large viewport, so it does not slide on a phone', () => {
  const css = read('src/styles.css');
  const rule = css.slice(css.indexOf('body::before {'), css.indexOf('}', css.indexOf('body::before {')));
  assert.match(rule, /position:\s*fixed/);
  assert.match(rule, /height:\s*100lvh/, 'inset: 0 resizes as the toolbar hides; 100lvh does not');
  assert.doesNotMatch(rule, /inset:\s*0/);
  const html = css.slice(css.indexOf('html {'), css.indexOf('}', css.indexOf('html {')));
  assert.match(html, /overscroll-behavior:\s*none/, 'the bounce at the page ends drags the background');
});
