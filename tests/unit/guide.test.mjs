import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseContent, toPublicJson } from '../../scripts/parse.mjs';
import {
  entryContexts,
  groupScreenId,
  hasGroupPages,
  directLinkEntry,
  isInfoCard,
  linkText,
  noteSaysStatus,
  parseWashrooms,
  previewTiles,
  worldPixel,
  menuItems,
  parentScreen,
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
  assert.equal(rowParts(k).status.label, 'Community-known');
  assert.equal(rowParts(k, [{ key: 'status', value: 'unverified' }]).status, null);
});

test('tags become one chip each; prayers and Jummah are read as the prayers held', () => {
  const parts = rowParts(entry('Z', { prayers: 'Dhuhr · Asr · Maghrib · Isha', jummah: 'yes', tags: 'Quiet · Carpeted' }));
  assert.deepEqual(parts.chips.map((c) => c.text), ['Quiet', 'Carpeted']);
  assert.deepEqual(parts.prayers, { held: ['Dhuhr', 'Asr', 'Maghrib', 'Isha'], jummah: true });
  assert.deepEqual(rowParts(entry('PQ', { prayers: 'Dhuhr', jummah: 'no' })).prayers, { held: ['Dhuhr'], jummah: false });
  assert.deepEqual(rowParts(entry('M', { prayers: 'Fajr · Isha' })).prayers, { held: ['Fajr', 'Isha'], jummah: null }, 'no jummah field: say nothing about it');
  assert.equal(rowParts(entry('H', { location: '2/F' })).prayers, null);
  assert.equal(parts.expandable, false, 'the prayers are on the row, so they give it nothing to open');
  assert.equal(parts.expandable, false, 'chips alone do not make a row open');
});

test('sharing needs two or more rows, and info cards do not count', () => {
  const k1 = entry('K1', { price: 'HK$40' });
  assert.deepEqual(sharedFacts([k1]), []);
  assert.deepEqual(sharedFacts([k1, entry('Tip', { note: 'HK$40' })]), []);
});

test('a prayer room row: summary, Jummah, facts and link', () => {
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
  assert.deepEqual(parts.chips, []);
  assert.equal(parts.prayers.jummah, true);
  assert.deepEqual(parts.facts.map((f) => [f.label, f.value]), [['Wudu', 'Nearby'], ['Jummah', 'Held here']]);
  assert.equal(parts.link.text, 'Live prayer times');
  assert.equal(parts.expandable, true);
  assert.equal(rowParts(entry('PQ', { jummah: 'no' })).prayers.jummah, false);
});

test('a food row with no status says so, and shows its perk as a chip', () => {
  const turnep = entry('Turnep', { walk: '5 min', perk: 'Student discount', link: 'https://maps.app.goo.gl/x' }, { statusMissing: true });
  const parts = rowParts(turnep);
  assert.equal(parts.status.label, 'Status not recorded');
  assert.deepEqual(parts.chips.map((c) => c.text), ['Student discount']);
  assert.equal(parts.summary, '5 min');
  assert.equal(parts.link.text, 'Open in Google Maps');
  assert.equal(rowParts(entry('F', { where: 'VA210', status: 'certified-section' })).status.label, 'Section only');
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

test('a group that is only a link opens it from its card', () => {
  const card = entry('List', { note: 'Check its date first.', link: 'https://a.example/list.pdf' });
  assert.equal(directLinkEntry({ blocks: [card] }), card);
  assert.equal(directLinkEntry({ blocks: [card, entry('Shop', { where: 'VA' })] }), null);
  assert.equal(directLinkEntry({ blocks: [{ type: 'prose', kind: 'blockquote', runs: [] }, card] }), null, 'a warning needs a page to show on');
  assert.equal(directLinkEntry({ blocks: [entry('Tip', { note: 'Check the pack' })] }), null);
});

test('only the food screen gives each group its own page', () => {
  const withGroups = (title) => ({ title, subsections: [{}, {}] });
  assert.equal(hasGroupPages(withGroups('Halal Food Near You')), true);
  assert.equal(hasGroupPages(withGroups('Prayer Facilities')), false);
  assert.equal(hasGroupPages({ title: 'Halal Food', subsections: [{}] }), false, 'a single group needs no page of its own');
});

test('a key with no place on screen fails loudly', () => {
  assert.throws(() => rowParts(entry('X', { rating: '5' })), /No place to show "rating"/);
});

test('entries made of note and link are info cards', () => {
  assert.equal(isInfoCard(entry('Athan Plus', { note: 'Prayer times', link: 'https://play.google.com/x' })), true);
  assert.equal(isInfoCard(entry('Tip', { note: 'Check the pack' })), true);
  assert.equal(isInfoCard(entry('Athan Plus', { link: 'https://play.google.com/x', logo: 'athan-plus.jpg' })), true, 'a logo keeps it an info card');
  assert.deepEqual(rowParts(entry('Taste', { status: 'check-packaging', logo: 'logo-taste.jpg' })).logo, { src: 'photos/logo-taste.jpg' });
  assert.equal(sharedFacts([entry('A', { logo: 'x.jpg' }), entry('B', { logo: 'x.jpg' })]).length, 0, 'every row keeps its own logo');
  assert.equal(isInfoCard(entry('Shop', { note: 'x', address: 'y' })), false);
});

test('only Google Maps links are marked as maps, so only they get the pin', () => {
  assert.equal(linkText('https://maps.app.goo.gl/fpzSoC8n3iSdeTu69').map, true);
  assert.equal(linkText('https://www.google.com/maps/place/x').map, true);
  assert.equal(linkText('https://play.google.com/store/apps/details?id=x').map, false);
  assert.equal(linkText('https://www.google.com/search?q=x').map, false);
  assert.equal(linkText('https://chat.whatsapp.com/x').map, false);
  assert.equal(linkText('https://chat.whatsapp.com/x').whatsapp, true);
  assert.equal(linkText('https://maps.app.goo.gl/x').whatsapp, false);
});

test('a photo sits in the drop-down with alt text, and its file name is not searchable', () => {
  const room = entry('Z302a', { tags: '4 daily prayers', photo: 'z302a.jpg' });
  assert.deepEqual(rowParts(room).photo, { src: 'photos/z302a.jpg', alt: 'Photo of Z302a' });
  assert.equal(rowParts(room).expandable, true, 'the photo is in the drop-down, so the row opens');
  assert.doesNotMatch(searchText({ entry: room, section: { title: 'Prayer' }, subsection: null }), /jpg/);
  assert.equal(sharedFacts([room, entry('PQ', { photo: 'z302a.jpg' })]).length, 0, 'photos are never shared above a group');
});

test('washrooms read as floors, each with its washroom types in a fixed order', () => {
  const core = entry('Core C', { feature: 'Bidet', washrooms: 'G: female, accessible · 1: male · P: male, female' });
  assert.deepEqual(rowParts(core).washrooms, [
    { floor: 'G', types: ['female', 'accessible'] },
    { floor: '1', types: ['male'] },
    { floor: 'P', types: ['male', 'female'] },
  ]);
  assert.deepEqual(parseWashrooms('4: accessible, female'), [{ floor: '4', types: ['female', 'accessible'] }]);
});

test('a labelled link stays on the row; an unlabelled one waits in the drop-down', () => {
  const labelled = rowParts(entry('Z302a', { prayers: 'Dhuhr', link: 'https://x.example', 'link-label': 'Live prayer times' }));
  assert.equal(labelled.link.onRow, true);
  assert.equal(labelled.expandable, false, 'with its link on the row, nothing is left to open');
  const plain = rowParts(entry('Cafe', { where: 'Z Core', link: 'https://x.example' }));
  assert.equal(plain.link.onRow, false);
  assert.equal(plain.expandable, true);
});

test('a group note that already names the shared status stands in for the badge', () => {
  const note = (text) => ({ type: 'prose', kind: 'blockquote', runs: [{ text }] });
  assert.equal(noteSaysStatus([note('Community-known halal kitchens, but not endorsed by MUSA.')], 'unverified'), true);
  assert.equal(noteSaysStatus([note('Not checked by MUSA.')], 'unverified'), false, 'without the word, the badge stays');
  assert.equal(noteSaysStatus([{ type: 'prose', kind: 'paragraph', runs: [{ text: 'Community-known' }] }], 'unverified'), false, 'only a highlighted note counts');
});

test('map preview tiles cover the preview and put the place in the middle', () => {
  assert.deepEqual(worldPixel(0, 0, 0), { x: 128, y: 128 });
  const tiles = previewTiles(22.3059078, 114.1865903);
  for (const t of tiles) {
    assert.equal(t.z, 17);
    assert.ok(t.left <= 0 || t.left - 256 < 340, 'every tile reaches into the preview');
  }
  // The place's own tile contains the point.
  const home = tiles.find((t) => t.left <= 0 && t.left > -256 && t.top <= 0 && t.top > -256);
  assert.ok(home, 'one tile holds the place');
  const leftmost = Math.min(...tiles.map((t) => t.left));
  const rightmost = Math.max(...tiles.map((t) => t.left)) + 256;
  assert.ok(leftmost <= -340 && rightmost >= 340, 'tiles span the full preview width');
});

test('page addresses round-trip', () => {
  assert.deepEqual(parseRoute(''), { screen: null, entry: null });
  assert.deepEqual(parseRoute('#/'), { screen: null, entry: null });
  assert.deepEqual(parseRoute('#/halal-food'), { screen: 'halal-food', entry: null });
  assert.deepEqual(parseRoute('#/halal-food/pacific-coffee'), { screen: 'halal-food', entry: 'pacific-coffee' });
  assert.equal(parseRoute('#main'), null);
  const isScreen = (id) => id === 'halal-food/campus';
  assert.deepEqual(parseRoute('#/halal-food/campus', isScreen), { screen: 'halal-food/campus', entry: null });
  assert.deepEqual(parseRoute('#/halal-food/campus/pacific-coffee', isScreen), { screen: 'halal-food/campus', entry: 'pacific-coffee' });
  assert.deepEqual(parseRoute('#/halal-food/pacific-coffee', isScreen), { screen: 'halal-food', entry: 'pacific-coffee' });
  assert.equal(groupScreenId({ id: 'halal-food' }, { id: 'campus' }), 'halal-food/campus');
  assert.equal(routeFor('halal-food/campus', 'pacific-coffee'), '#/halal-food/campus/pacific-coffee');
  assert.equal(parentScreen('halal-food/campus'), 'halal-food');
  assert.equal(parentScreen('halal-food'), null);
  assert.equal(parentScreen(null), null);
  assert.equal(routeFor(null), '#/');
  assert.equal(routeFor('halal-food'), '#/halal-food');
  assert.equal(routeFor('halal-food', 'pacific-coffee'), '#/halal-food/pacific-coffee');
});

test('search covers facts that are shown once above a group', () => {
  const text = searchText({ entry: entry('K1', { status: 'unverified', price: 'About HK$40 a meal' }), section: { title: 'Halal Food' }, subsection: null });
  assert.match(text, /hk\$40/);
  assert.match(text, /community-known/);
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
