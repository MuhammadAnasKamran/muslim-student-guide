import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseContent, toPublicJson } from '../../scripts/parse.mjs';
import {
  entryContexts,
  isInfoCard,
  menuItems,
  parseRoute,
  routeFor,
  rowParts,
  searchText,
  sharedFacts,
} from '../../src/guide.js';

const entry = (name, fields, extra = {}) => ({
  type: 'entry',
  id: name.toLowerCase(),
  name,
  line: 1,
  fields: Object.entries(fields).map(([key, value]) => ({ key, value })),
  ...extra,
});

test('facts identical on every row are shown once, highlights never are', () => {
  const a = entry('A', { tag: 'Main', access: 'Card', arrangement: 'Split', jummah: 'yes' });
  const b = entry('B', { tag: 'Second', access: 'Card', arrangement: 'Split', jummah: 'yes' });
  assert.deepEqual(sharedFacts([a, b]), [
    { key: 'access', value: 'Card' },
    { key: 'arrangement', value: 'Split' },
  ]);

  // A status shared by every row in a group moves above it; links never do.
  const k1 = entry('K1', { status: 'unverified', price: 'HK$40', link: 'https://a.example' });
  const k2 = entry('K2', { status: 'unverified', price: 'HK$40', link: 'https://a.example' });
  assert.deepEqual(sharedFacts([k1, k2]), [
    { key: 'status', value: 'unverified' },
    { key: 'price', value: 'HK$40' },
  ]);
  // Chips belong to their own row, never to the group.
  const t1 = entry('T1', { tags: 'South Asian meals', perk: 'Student discount' });
  const t2 = entry('T2', { tags: 'South Asian meals', perk: 'Student discount' });
  assert.deepEqual(sharedFacts([t1, t2]), []);
});

test('a status shown above its group is left off the rows', () => {
  const k = entry('K', { status: 'unverified', price: 'HK$40' });
  assert.equal(rowParts(k).status.label, 'Unverified');
  assert.equal(rowParts(k, [{ key: 'status', value: 'unverified' }]).status, null);
});

test('tags become one chip each, and prayers is a chip of its own', () => {
  const parts = rowParts(entry('Z', { prayers: 'Daily prayers + Jummah', tags: 'South Asian meals · Several options daily' }));
  assert.deepEqual(parts.chips.map((c) => c.text), ['Daily prayers + Jummah', 'South Asian meals', 'Several options daily']);
  assert.equal(parts.expandable, false, 'chips alone do not make a row open');
});

test('sharing needs two or more rows, and info cards do not count', () => {
  const k1 = entry('K1', { price: 'HK$40' });
  assert.deepEqual(sharedFacts([k1]), []);
  assert.deepEqual(sharedFacts([k1, entry('Tip', { note: 'HK$40' })]), []);
});

test('a prayer room row: summary, Jummah chip, facts and link', () => {
  const z = entry('Z302a', {
    tag: 'Main prayer room',
    location: 'Z Core',
    access: 'Card',
    wudu: 'Nearby',
    jummah: 'yes',
    'jummah-note': 'Held here',
    link: 'https://x.example',
    'link-label': 'Live prayer times',
  });
  const parts = rowParts(z, [{ key: 'access', value: 'Card' }]);
  assert.equal(parts.status, null);
  assert.equal(parts.summary, 'Main prayer room · Z Core');
  assert.deepEqual(parts.chips, [{ key: 'jummah', text: 'Jummah', muted: false }]);
  assert.deepEqual(parts.facts.map((f) => [f.label, f.value]), [['Wudu', 'Nearby'], ['Jummah', 'Held here']]);
  assert.equal(parts.link.text, 'Live prayer times');
  assert.equal(parts.expandable, true);
  assert.deepEqual(rowParts(entry('PQ', { jummah: 'no' })).chips, [{ key: 'jummah', text: 'No Jummah', muted: true }]);
});

test('a food row with no status says so, and shows its perk as a chip', () => {
  const turnep = entry('Turnep', { walk: '5 min', perk: 'Student discount', link: 'https://maps.app.goo.gl/x' }, { statusMissing: true });
  const parts = rowParts(turnep);
  assert.equal(parts.status.label, 'Status not recorded');
  assert.deepEqual(parts.chips.map((c) => c.text), ['Student discount']);
  assert.equal(parts.summary, '5 min');
  assert.equal(parts.link.text, 'Open in Google Maps');
  assert.equal(rowParts(entry('F', { where: 'VA210', status: 'certified-section' })).status.label, 'Certified section only');
});

test('Copy address appears only when there is no map link; rows with nothing more do not open', () => {
  const musolla = rowParts(entry('M', { district: 'Kwun Tong', address: 'Flat D' }));
  assert.equal(musolla.copyAddress, 'Flat D');
  assert.equal(musolla.expandable, true);
  assert.equal(rowParts(entry('N', { address: 'Y', link: 'https://maps.app.goo.gl/y' })).copyAddress, null);
  assert.equal(rowParts(entry('Hall', { location: '2/F' })).expandable, false);
});

test('a warning is shown on the row and never shown once for the group', () => {
  const canteen = entry('VA', { status: 'certified-section', tags: 'Chicken thigh curry', warning: 'Only these 3 meals are halal. Other dishes are not.' });
  assert.deepEqual(rowParts(canteen).warnings, ['Only these 3 meals are halal. Other dishes are not.']);
  const twin = entry('HH', { status: 'certified-section', tags: 'Chicken thigh curry', warning: 'Only these 3 meals are halal. Other dishes are not.' });
  assert.equal(sharedFacts([canteen, twin]).some((f) => f.key === 'warning'), false);
});

test('a key with no place on screen fails loudly', () => {
  assert.throws(() => rowParts(entry('X', { rating: '5' })), /No place to show "rating"/);
});

test('entries made of note and link are info cards', () => {
  assert.equal(isInfoCard(entry('Athan Plus', { note: 'Prayer times', link: 'https://play.google.com/x' })), true);
  assert.equal(isInfoCard(entry('Tip', { note: 'Check the pack' })), true);
  assert.equal(isInfoCard(entry('Shop', { note: 'x', address: 'y' })), false);
});

test('page addresses round-trip', () => {
  assert.deepEqual(parseRoute(''), { screen: null, entry: null });
  assert.deepEqual(parseRoute('#/'), { screen: null, entry: null });
  assert.deepEqual(parseRoute('#/halal-food'), { screen: 'halal-food', entry: null });
  assert.deepEqual(parseRoute('#/halal-food/pacific-coffee'), { screen: 'halal-food', entry: 'pacific-coffee' });
  assert.equal(parseRoute('#main'), null);
  assert.equal(routeFor(null), '#/');
  assert.equal(routeFor('halal-food'), '#/halal-food');
  assert.equal(routeFor('halal-food', 'pacific-coffee'), '#/halal-food/pacific-coffee');
});

test('search covers facts that are shown once above a group', () => {
  const text = searchText({ entry: entry('K1', { status: 'unverified', price: 'About HK$40 a meal' }), section: { title: 'Halal Food' }, subsection: null });
  assert.match(text, /hk\$40/);
  assert.match(text, /unverified/);
});

test('every published entry in the real content.md can be rendered', () => {
  const doc = toPublicJson(parseContent(readFileSync(new URL('../../content.md', import.meta.url), 'utf8')));
  const contexts = entryContexts(doc);
  assert.ok(contexts.length > 0);
  for (const { entry: e } of contexts) assert.doesNotThrow(() => rowParts(e), e.name);
  const menu = menuItems(doc);
  assert.equal(menu.length, doc.sections.filter((s) => s.published).length);
  assert.match(menu[0].title, /prayer/i, 'prayer comes before food');
});
