// WCAG AA contrast for the colours the site actually paints: the tokens, the
// frosted app bar, and text over the background photograph.
//
// The site is dark-only for now, so there is one palette. The photo's brightest
// and darkest pixels are recorded here; regenerate them with
// `node scripts/measure-background.mjs` after changing src/background.jpg.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

// Measured from src/background.jpg, as 0-255 channels.
const PHOTO = { brightest: [172, 108, 67], darkest: [79, 3, 24] };

const palette = Object.fromEntries(
  [...css.match(/^:root \{([\s\S]*?)\n\}/m)[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
);
const rgba = (name) => {
  const match = css.match(new RegExp(`--${name}:\\s*rgb\\((\\d+) (\\d+) (\\d+) / ([\\d.]+%?)\\)`));
  assert.ok(match, `--${name} is missing`);
  const alpha = match[4].endsWith('%') ? Number.parseFloat(match[4]) / 100 : Number(match[4]);
  return { colour: [Number(match[1]), Number(match[2]), Number(match[3])], alpha };
};

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

test('the site has one palette, and it is the dark one', () => {
  assert.doesNotMatch(css, /@media \(prefers-color-scheme/, 'a theme media query is back: give it its own contrast figures');
  assert.match(css, /color-scheme:\s*dark/);
  assert.ok(luminance(channels(palette.bg)) < 0.1, 'the background token should be dark');
  assert.ok(luminance(channels(palette.ink)) > 0.5, 'the text token should be light');
});

test('every token pair meets WCAG AA', () => {
  const failures = [];
  for (const [fg, bg, min] of [
    ['ink', 'bg', TEXT],
    ['ink', 'surface', TEXT],
    ['ink', 'accent-soft', TEXT],
    ['muted', 'surface', TEXT],
    ['accent', 'surface', TEXT],
    ['accent-ink', 'accent', TEXT],
    ['header-ink', 'header-bg', TEXT],
    ['warn-ink', 'warn-bg', TEXT],
    ['status-green', 'surface', TEXT],
    ['status-yellow', 'surface', TEXT],
    ['status-red', 'surface', TEXT],
    ['status-grey', 'surface', TEXT],
    ['grey-ink', 'grey-bg', TEXT],
    ['control-border', 'surface', NON_TEXT],
    ['accent', 'accent-soft', TEXT], // the Back button's word
    ['focus', 'bg', NON_TEXT],
    ['focus', 'surface', NON_TEXT],
  ]) {
    assert.ok(palette[fg] && palette[bg], `missing token --${fg} or --${bg}`);
    const ratio = contrast(channels(palette[fg]), channels(palette[bg]));
    if (ratio < min) failures.push(`--${fg} on --${bg}: ${ratio.toFixed(2)} (needs ${min})`);
  }
  assert.deepEqual(failures, []);
});

// The app bar is translucent, so the worst case is the lightest surface scrolling under it.
test('the frosted app bar keeps its title readable', () => {
  const glass = rgba('header-glass');
  const bar = over(glass.colour, channels(palette.surface), glass.alpha);
  const ratio = contrast(channels(palette['header-ink']), bar);
  assert.ok(ratio >= TEXT, `app bar title is ${ratio.toFixed(2)}, needs ${TEXT}`);
});

// Everything is painted over a photograph, so text is measured through the
// scrim, the photo, and the translucent pane where there is one.
test('text stays readable over the background photograph', () => {
  const scrim = rgba('scrim');
  const fill = rgba('glass-fill');
  const failures = [];
  for (const spot of ['brightest', 'darkest']) {
    const ground = over(scrim.colour, PHOTO[spot], scrim.alpha);
    const pane = over(fill.colour, ground, fill.alpha);
    for (const [what, colour, backdrop] of [
      ['body text on the page', palette.ink, ground],
      ['headings on the page', palette.accent, ground],
      ['body text on a pane', palette.ink, pane],
      ['muted text on a pane', palette.muted, pane],
      ['link text on a pane', palette.accent, pane],
      ['certified status on a pane', palette['status-green'], pane],
      ['section-only status on a pane', palette['status-yellow'], pane],
      ['check-packaging status on a pane', palette['status-red'], pane],
      ['community-known status on a pane', palette['status-grey'], pane],
      ['status above a group, on the page', palette['status-grey'], ground],
    ]) {
      const ratio = contrast(channels(colour), backdrop);
      if (ratio < TEXT) failures.push(`${spot} part of the photo: ${what} is ${ratio.toFixed(2)}`);
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

test('the four status colours are distinct, and each status keeps its own word', () => {
  const colours = new Set(['status-green', 'status-yellow', 'status-red', 'status-grey'].map((name) => palette[name]));
  assert.equal(colours.size, 4);
});

test('no !important, webfonts, imports or external URLs', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /@font-face|@import/);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:/);
});
