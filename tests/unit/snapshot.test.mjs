// The snapshot is the committee's dated record of the guide, so it must carry every
// listing and every picture the site shows.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseContent, toPublicJson } from '../../scripts/parse.mjs';
import { build } from '../../scripts/snapshot.mjs';
import { entryContexts } from '../../src/guide.js';

const root = new URL('../../', import.meta.url);
const doc = toPublicJson(parseContent(readFileSync(new URL('content.md', root), 'utf8')));
const snapshot = build();

test('every published listing, with its status and link, is in the snapshot', () => {
  const missing = [];
  for (const { entry } of entryContexts(doc)) {
    if (!snapshot.includes(entry.name)) missing.push(entry.name);
    for (const { key, value } of entry.fields) {
      if (['link', 'note', 'warning', 'prayers', 'where', 'tags'].includes(key) && !snapshot.includes(value)) missing.push(`${entry.name}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every picture in the snapshot is a file in the repo', () => {
  const sources = [...snapshot.matchAll(/(?:!\[[^\]]*\]\(|<img src=")(src\/[^)"]+)/g)].map((m) => m[1]);
  assert.ok(sources.length >= 5, `expected the pictures, found ${sources.length}`);
  for (const src of new Set(sources)) assert.ok(existsSync(new URL(src, root)), `${src} is missing`);
});

test('the snapshot says when it was taken and where the guide is edited', () => {
  assert.match(snapshot, /^# .+ — snapshot$/m);
  assert.match(snapshot, /\d{4}-\d{2}-\d{2}/);
  assert.match(snapshot, /content\.md/);
});
