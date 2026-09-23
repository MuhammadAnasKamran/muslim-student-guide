// The PDF is what the committee prints and shares, so it must carry every published
// listing, with its halal status, warnings and pictures inside the file itself.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseContent, toPublicJson } from '../../scripts/parse.mjs';
import { buildHtml } from '../../scripts/make-pdf.mjs';
import { STATUS_LABELS, entryContexts, statusOf } from '../../src/guide.js';

const root = new URL('../../', import.meta.url);
const doc = toPublicJson(parseContent(readFileSync(new URL('content.md', root), 'utf8')));
const html = buildHtml();
const text = html.replace(/data:image\/jpeg;base64,[^"]+/g, 'PICTURE').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'");

test('every published listing is in the PDF, with its status and warning', () => {
  const missing = [];
  for (const { entry } of entryContexts(doc)) {
    if (!text.includes(entry.name)) missing.push(entry.name);
    const status = statusOf(entry);
    if (status && STATUS_LABELS[status.key] && !text.includes(STATUS_LABELS[status.key].label)) missing.push(`${entry.name}: status`);
    const warning = entry.fields.find((f) => f.key === 'warning')?.value;
    if (warning && !text.includes(warning)) missing.push(`${entry.name}: warning`);
    const link = entry.fields.find((f) => f.key === 'link')?.value;
    if (link && !text.includes(link)) missing.push(`${entry.name}: link`);
  }
  assert.deepEqual(missing, []);
});

test('every picture travels inside the PDF, so it prints without the repo', () => {
  // Counted as they appear: the curry menu and the ParknShop logo are each used more than once.
  const uses = entryContexts(doc).flatMap(({ entry }) => entry.fields.filter((f) => f.key === 'photo' || f.key === 'logo'));
  assert.ok(new Set(uses.map((f) => f.value)).size >= 5, `expected the pictures, found ${uses.length}`);
  assert.equal((html.match(/data:image\/jpeg;base64,/g) ?? []).length, uses.length);
  assert.doesNotMatch(html, /src="(?!data:)/, 'a picture would be missing from a printed copy');
});

test('the PDF names the guide, its version and the date it was made from', () => {
  assert.ok(text.includes(doc.meta.title));
  assert.ok(text.includes(doc.meta.updated));
  for (const section of doc.sections.filter((s) => s.published)) assert.ok(text.includes(section.title), section.title);
});
