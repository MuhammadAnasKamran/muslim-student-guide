// Map previews: every map link in content.md has one, and every tile it needs is saved
// in src/maps/tiles/ (and nothing else is), so previews never load from a third party.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { parseContent, toPublicJson } from '../../scripts/parse.mjs';
import { entryContexts, linkText, previewTiles } from '../../src/guide.js';

const root = new URL('../../', import.meta.url);
const index = JSON.parse(readFileSync(new URL('src/maps/previews.json', root), 'utf8'));
const doc = toPublicJson(parseContent(readFileSync(new URL('content.md', root), 'utf8')));
const mapLinks = entryContexts(doc)
  .map(({ entry }) => entry.fields.find((f) => f.key === 'link')?.value)
  .filter((link) => link && linkText(link).map);

test('every map link has a preview, and every preview belongs to a map link', () => {
  assert.ok(mapLinks.length > 0);
  assert.deepEqual(Object.keys(index.places).sort(), [...new Set(mapLinks)].sort());
  assert.match(index.credit, /OpenStreetMap contributors/);
  for (const [link, place] of Object.entries(index.places)) {
    assert.ok(Math.abs(place.lat - 22.3) < 1 && Math.abs(place.lng - 114.2) < 1, `${place.name} (${link}) is not near PolyU`);
  }
});

test('the tiles on disk are exactly the tiles the previews need, and each is a PNG', () => {
  const needed = new Set(Object.values(index.places).flatMap((p) => previewTiles(p.lat, p.lng).map((t) => `${t.z}-${t.x}-${t.y}.png`)));
  const onDisk = readdirSync(new URL('src/maps/tiles/', root)).filter((n) => n !== '.DS_Store');
  assert.deepEqual(onDisk.sort(), [...needed].sort());
  for (const name of onDisk) {
    const bytes = readFileSync(new URL(`src/maps/tiles/${name}`, root));
    assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${name} is not a PNG`);
  }
});
