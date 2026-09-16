// WCAG AA contrast for the colours the site actually paints: the tokens, the
// frosted app bar, and text over the background photograph.
//
// The photo's brightest and darkest pixels are recorded here; regenerate them
// with `node scripts/measure-background.mjs` after changing src/background.jpg.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

// Measured from src/background.jpg, as 0-255 channels.
const PHOTO = { brightest: [172, 108, 67], darkest: [79, 3, 24] };

function tokens(block) {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]));
}

const light = tokens(css.match(/^:root\s*{([^}]*)}/m)[1]);
const dark = { ...light, ...tokens(css.match(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/)[1]) };
const rgba = (name) => [...css.matchAll(new RegExp(`--${name}:\\s*rgb\\((\\d+) (\\d+) (\\d+) / ([\\d.]+%?)\\)`, 'g'))]
  .map((m) => ({ colour: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: m[4].endsWith('%') ? Number.parseFloat(m[4]) / 100 : Number(m[4]) }));

const channels = (hex) => hex.slice(1).match(/../g).map((c) => parseInt(c, 16));
const over = (fg, bg, alpha) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

function luminance(colour) {
  const [r, g, b] = colour.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3;
const PAIRS = [
  ['ink', 'bg', TEXT],
  ['ink', 'surface', TEXT],
  ['ink', 'accent-soft', TEXT],
  ['muted', 'surface', TEXT],
  ['accent', 'surface', TEXT],
  ['accent-ink', 'accent', TEXT],
  ['header-ink', 'header-bg', TEXT],
  ['warn-ink', 'warn-bg', TEXT],
  ['certified-ink', 'certified-bg', TEXT],
  ['amber-ink', 'amber-bg', TEXT],
  ['grey-ink', 'grey-bg', TEXT],
  ['control-border', 'surface', NON_TEXT],
  ['accent', 'accent-soft', NON_TEXT],
  ['focus', 'bg', NON_TEXT],
  ['focus', 'surface', NON_TEXT],
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
      const ratio = contrast(channels(palette[fg]), channels(palette[bg]));
      if (ratio < min) failures.push(`--${fg} on --${bg}: ${ratio.toFixed(2)} (needs ${min})`);
    }
    assert.deepEqual(failures, []);
  });
}

// The app bar is translucent, so the worst case is the lightest surface scrolling under it.
test('the frosted app bar keeps its title readable in both modes', () => {
  const glass = rgba('header-glass');
  assert.equal(glass.length, 2, 'light and dark both need a --header-glass');
  for (const [index, [mode, palette]] of [['light', light], ['dark', dark]].entries()) {
    const bar = over(glass[index].colour, channels(palette.surface), glass[index].alpha);
    const ratio = contrast(channels(palette['header-ink']), bar);
    assert.ok(ratio >= TEXT, `${mode}: app bar title is ${ratio.toFixed(2)}, needs ${TEXT}`);
  }
});

// Everything is painted over a photograph, so text is measured through the
// scrim, the photo, and the translucent pane where there is one.
test('text stays readable over the background photograph', () => {
  const scrims = rgba('scrim');
  const fills = rgba('glass-fill');
  assert.equal(scrims.length, 2);
  assert.equal(fills.length, 2);

  const failures = [];
  for (const [index, [mode, palette]] of [['light', light], ['dark', dark]].entries()) {
    for (const spot of ['brightest', 'darkest']) {
      const ground = over(scrims[index].colour, PHOTO[spot], scrims[index].alpha);
      const pane = over(fills[index].colour, ground, fills[index].alpha);
      const checks = [
        ['body text on the page', palette.ink, ground],
        ['headings on the page', palette.accent, ground],
        ['body text on a pane', palette.ink, pane],
        ['muted text on a pane', palette.muted, pane],
        ['link text on a pane', palette.accent, pane],
      ];
      for (const [what, colour, backdrop] of checks) {
        const ratio = contrast(channels(colour), backdrop);
        if (ratio < TEXT) failures.push(`${mode}, ${spot} part of the photo: ${what} is ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

// Muted grey is only strong enough on a pane, never straight on the page.
test('page-level text does not use the muted grey', () => {
  const ruleFor = (selector) => {
    const at = css.indexOf(selector);
    assert.ok(at >= 0, `${selector} is missing from the stylesheet`);
    return css.slice(at, css.indexOf('}', at));
  };
  for (const selector of ['.intro {', '.result-count {', '.site-footer {', '.home-subtitle {', '.loading,']) {
    assert.doesNotMatch(ruleFor(selector), /color:\s*var\(--muted\)/, `${selector} sits on the page, so it cannot use --muted`);
  }
});

test('dark mode redefines its colours rather than reusing light ones', () => {
  for (const name of ['ink', 'bg', 'surface', 'accent', 'accent-soft', 'warn-bg', 'certified-bg', 'amber-bg', 'grey-bg']) {
    assert.notEqual(dark[name], light[name], `--${name}`);
  }
});

test('the three status families are visually distinct', () => {
  for (const palette of [light, dark]) {
    const backgrounds = new Set([palette['certified-bg'], palette['amber-bg'], palette['grey-bg']]);
    assert.equal(backgrounds.size, 3);
  }
});

test('no !important, webfonts, imports or external URLs', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /@font-face|@import/);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:/);
});
