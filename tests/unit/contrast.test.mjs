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

function contrastRgb(a, b) {
  const [hi, lo] = [luminanceRgb(a), luminanceRgb(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function luminanceRgb(channels) {
  const [r, g, b] = channels.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
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
  ['muted', 'bg', TEXT],
  ['muted', 'surface', TEXT],
  ['accent', 'bg', TEXT],
  ['accent', 'surface', TEXT],
  ['accent-ink', 'accent', TEXT],
  ['header-ink', 'header-bg', TEXT],
  ['warn-ink', 'warn-bg', TEXT],
  ['certified-ink', 'certified-bg', TEXT],
  ['amber-ink', 'amber-bg', TEXT],
  ['grey-ink', 'grey-bg', TEXT],
  ['control-border', 'surface', NON_TEXT],
  ['control-border', 'bg', NON_TEXT],
  ['accent', 'accent-soft', NON_TEXT],
  ['focus', 'bg', NON_TEXT],
  ['focus', 'surface', NON_TEXT],
  ['header-ink', 'header-bg', NON_TEXT],
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

// The app bar is translucent, so the worst case is the lightest surface scrolling
// under it, plus the pattern overlay on top.
test('the frosted app bar keeps its title readable in both modes', () => {
  const glass = [...css.matchAll(/--header-glass:\s*rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)/g)];
  assert.equal(glass.length, 2, 'light and dark both need a --header-glass');
  const patternOpacity = Number(css.match(/\.appbar::before[^}]*opacity:\s*([\d.]+)/s)[1]);
  const rgb = (hex) => hex.slice(1).match(/../g).map((c) => parseInt(c, 16));
  const over = (fg, bg, alpha) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

  for (const [mode, palette, match] of [['light', light, glass[0]], ['dark', dark, glass[1]]]) {
    const ink = rgb(palette['header-ink']);
    const bar = over([Number(match[1]), Number(match[2]), Number(match[3])], rgb(palette.surface), Number(match[4]) / 100);
    const ratio = contrastRgb(ink, over(ink, bar, patternOpacity));
    assert.ok(ratio >= 4.5, `${mode}: app bar title is ${ratio.toFixed(2)}, needs 4.5`);
  }
});

// Cards carrying the geometric pattern still have to pass AA underneath it.
test('patterned surfaces keep their text readable', () => {
  const plate = Number(css.match(/\.pattern-plate::before,[\s\S]*?opacity:\s*([\d.]+)/)[1]);
  const legend = Number(css.match(/\.legend::before\s*{\s*opacity:\s*([\d.]+)/)[1]);
  const rgb = (hex) => hex.slice(1).match(/../g).map((c) => parseInt(c, 16));
  const over = (fg, bg, alpha) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

  for (const [mode, palette] of [['light', light], ['dark', dark]]) {
    const accent = rgb(palette.accent);
    const checks = [
      ['ink on a patterned info card', rgb(palette.ink), over(accent, rgb(palette['accent-soft']), plate)],
      ['warning text on a patterned alert', rgb(palette['warn-ink']), over(accent, rgb(palette['warn-bg']), plate)],
      ['muted text on the patterned labels card', rgb(palette.muted), over(accent, rgb(palette.surface), legend)],
    ];
    for (const [what, fg, bg] of checks) {
      const ratio = contrastRgb(fg, bg);
      assert.ok(ratio >= 4.5, `${mode}: ${what} is ${ratio.toFixed(2)}, needs 4.5`);
    }
  }
});

// Glass panes sit over the patterned page, so text on them is measured through
// both layers. Muted grey is only strong enough on a pane, never on the page.
test('text on glass panes meets AA, and nothing muted sits on the page', () => {
  const fills = [...css.matchAll(/--glass-fill:\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/g)];
  const strengths = [...css.matchAll(/--pattern-strength:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  assert.equal(fills.length, 2);
  assert.equal(strengths.length, 2);
  const rgb = (hex) => hex.slice(1).match(/../g).map((c) => parseInt(c, 16));
  const over = (fg, bg, alpha) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

  for (const [index, [mode, palette]] of [['light', light], ['dark', dark]].entries()) {
    const ground = over(rgb(palette.accent), rgb(palette.bg), strengths[index]);
    const fill = fills[index];
    const pane = over([Number(fill[1]), Number(fill[2]), Number(fill[3])], ground, Number(fill[4]));
    for (const [what, colour, backdrop] of [
      ['muted text on a pane', palette.muted, pane],
      ['body text on a pane', palette.ink, pane],
      ['link text on a pane', palette.accent, pane],
      ['body text on the page', palette.ink, ground],
      ['headings on the page', palette.accent, ground],
    ]) {
      const value = contrastRgb(rgb(colour), backdrop);
      assert.ok(value >= 4.5, `${mode}: ${what} is ${value.toFixed(2)}, needs 4.5`);
    }
  }

  // Text drawn straight on the patterned page must not use the muted grey.
  const ruleFor = (selector) => {
    const at = css.indexOf(selector);
    assert.ok(at >= 0, selector + ' is missing from the stylesheet');
    return css.slice(at, css.indexOf('}', at));
  };
  for (const selector of ['.intro {', '.result-count {', '.site-footer {', '.home-subtitle {', '.loading,']) {
    assert.doesNotMatch(ruleFor(selector), /color:\s*var\(--muted\)/, selector + ' sits on the page, so it cannot use --muted');
  }
});


test('dark mode redefines its colours rather than reusing light ones', () => {
  for (const name of ['ink', 'bg', 'surface', 'accent', 'accent-soft', 'warn-bg', 'certified-bg', 'amber-bg', 'grey-bg']) {
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
