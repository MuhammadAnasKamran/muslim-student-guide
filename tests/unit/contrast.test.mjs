// WCAG AA contrast for every colour token pair the stylesheet uses, in light
// and dark mode. Reads the tokens straight from src/styles.css.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

function tokens(block) {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]));
}

const light = tokens(css.match(/^:root\s*{([^}]*)}/m)[1]);
const dark = { ...light, ...tokens(css.match(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/)[1]) };

function luminance(hex) {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)
    .map((c) => parseInt(c, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3;
const PAIRS = [
  ['ink', 'bg', TEXT],
  ['ink', 'surface', TEXT],
  ['ink', 'callout', TEXT],
  ['muted', 'bg', TEXT],
  ['muted', 'surface', TEXT],
  ['accent', 'bg', TEXT],
  ['accent', 'surface', TEXT],
  ['accent-ink', 'accent', TEXT],
  ['header-ink', 'header-bg', TEXT],
  ['header-muted', 'header-bg', TEXT],
  ['certified-ink', 'certified-bg', TEXT],
  ['amber-ink', 'amber-bg', TEXT],
  ['grey-ink', 'grey-bg', TEXT],
  ['control-border', 'surface', NON_TEXT],
  ['control-border', 'bg', NON_TEXT],
  ['focus', 'bg', NON_TEXT],
  ['focus', 'surface', NON_TEXT],
  ['focus', 'accent-ink', NON_TEXT],
];

test('brand tokens match CLAUDE.md in light mode', () => {
  assert.equal(light.accent.toUpperCase(), '#12695A');
  assert.equal(light.ink.toUpperCase(), '#1B2A26');
  assert.equal(light.muted.toUpperCase(), '#5F7068');
  assert.equal(light.bg.toUpperCase(), '#FAF7F0');
});

for (const [mode, palette] of [['light', light], ['dark', dark]]) {
  test(`${mode} mode meets WCAG AA`, () => {
    const failures = [];
    for (const [fg, bg, min] of PAIRS) {
      assert.ok(palette[fg] && palette[bg], `missing token --${fg} or --${bg}`);
      const ratio = contrast(palette[fg], palette[bg]);
      if (ratio < min) failures.push(`--${fg} on --${bg}: ${ratio.toFixed(2)} (needs ${min})`);
    }
    assert.deepEqual(failures, []);
  });
}

test('dark mode redefines its colours rather than reusing light ones', () => {
  for (const name of ['ink', 'bg', 'surface', 'accent', 'certified-bg', 'amber-bg', 'grey-bg']) {
    assert.notEqual(dark[name], light[name], `--${name}`);
  }
});

test('the three status families are visually distinct', () => {
  for (const palette of [light, dark]) {
    const bgs = new Set([palette['certified-bg'], palette['amber-bg'], palette['grey-bg']]);
    assert.equal(bgs.size, 3);
  }
});

test('no !important, webfonts, imports or external URLs', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /@font-face|@import/);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:/);
});
