import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseContent, toPublicJson } from '../../scripts/parse.mjs';

// Every fixture starts with the same header so line numbers are predictable:
// the first line of `body` is line 4.
const HEADER = '# Guide\n## META\n- title: Test guide\n';
const doc = (body) => parseContent(HEADER + body);

test('well-formed entry: name, fields in order, line numbers', () => {
  const parsed = doc('# 1. FOOD\n### Halal Place\n- where: Z Core\n- status: certified\n');
  assert.deepEqual(parsed.problems, []);
  assert.equal(parsed.meta.title, 'Test guide');
  const [section] = parsed.sections;
  assert.equal(section.number, '1');
  assert.equal(section.title, 'FOOD');
  assert.equal(section.published, true);
  const [entry] = section.blocks;
  assert.equal(entry.name, 'Halal Place');
  assert.equal(entry.line, 5);
  assert.deepEqual(entry.fields, [
    { key: 'where', value: 'Z Core', line: 6 },
    { key: 'status', value: 'certified', line: 7 },
  ]);
});

test('a value containing colons is split on the first colon only', () => {
  const parsed = doc('# 1. FOOD\n### Place\n- note: Open 10:00–18:00: ask first\n- link: https://example.com/a:b\n');
  assert.deepEqual(parsed.problems, []);
  const [entry] = parsed.sections[0].blocks;
  assert.equal(entry.fields[0].key, 'note');
  assert.equal(entry.fields[0].value, 'Open 10:00–18:00: ask first');
  assert.equal(entry.fields[1].value, 'https://example.com/a:b');
});

test('TODO lines are collected, never kept as fields', () => {
  const parsed = doc(
    '# 1. FOOD\n### Place\n- where: Z Core\n- TODO: confirm the brand name\n- address: TODO: street address\n' +
      '\n# HELD BACK FOR v2\n\nTODO: names needed for two\nplaces in Mong Kok.\n',
  );
  assert.deepEqual(parsed.problems, []);
  const [entry] = parsed.sections[0].blocks;
  assert.deepEqual(entry.fields.map((f) => f.key), ['where']);
  assert.deepEqual(
    parsed.todos.map(({ line, text, entry: name, key }) => ({ line, text, name, key })),
    [
      { line: 7, text: 'confirm the brand name', name: 'Place', key: null },
      { line: 8, text: 'street address', name: 'Place', key: 'address' },
      { line: 12, text: 'names needed for two places in Mong Kok.', name: null, key: null },
    ],
  );
  assert.equal(JSON.stringify(toPublicJson(parsed)).includes('TODO'), false);
});

test('prose and blockquotes keep document order around entries', () => {
  const parsed = doc('# 1. FOOD\n\nIntro line one\nline two.\n\n### A\n- where: X\n\n> **Please read.** Careful.\n\n### B\n- where: Y\n');
  assert.deepEqual(parsed.problems, []);
  const blocks = parsed.sections[0].blocks;
  assert.deepEqual(blocks.map((b) => b.kind ?? b.name), ['paragraph', 'A', 'blockquote', 'B']);
  assert.deepEqual(blocks[0].runs, [{ text: 'Intro line one line two.' }]);
  assert.deepEqual(blocks[2].runs, [{ text: 'Please read.', strong: true }, { text: ' Careful.' }]);
});

test('a bullet with no colon fails with its line number', () => {
  const parsed = doc('# 1. FOOD\n### Place\n- open late\n');
  assert.equal(parsed.problems.length, 1);
  assert.equal(parsed.problems[0].line, 6);
  assert.match(parsed.problems[0].message, /no colon/);
});

test('text jammed under an entry fails instead of being dropped', () => {
  const parsed = doc('# 1. FOOD\n### Place\n- where: X\nopen on Sundays\n');
  assert.equal(parsed.problems.length, 1);
  assert.equal(parsed.problems[0].line, 7);
});

test('tables and lists are rejected in published sections but allowed when held back', () => {
  const published = doc('# 1. FOOD\n\n| a | b |\n');
  assert.equal(published.problems[0].line, 6);
  const held = doc('# HELD BACK FOR v2\n\n| a | b |\n\n- **Idea** — later: maybe\n');
  assert.deepEqual(held.problems, []);
  assert.equal(held.sections[0].published, false);
  assert.deepEqual(toPublicJson(held).sections[0], {
    id: 'held-back-for-v2', heading: 'HELD BACK FOR v2', number: null, title: 'HELD BACK FOR v2', line: 4, published: false,
  });
});

test('headings inside code fences are not parsed', () => {
  const parsed = parseContent('# Guide\n## HOW\n```bash\n# not a heading\n```\n## META\n- title: T\n');
  assert.deepEqual(parsed.problems, []);
  assert.equal(parsed.sections.length, 0);
});

test('non-ASCII text survives intact', () => {
  const parsed = doc('# 1. FOOD\n### The Forest — VA\n- menu: Curry · Rice\n- price: HK$50–100\n');
  const [entry] = parsed.sections[0].blocks;
  assert.equal(entry.name, 'The Forest — VA');
  assert.equal(entry.fields[0].value, 'Curry · Rice');
  assert.equal(entry.fields[1].value, 'HK$50–100');
});

test('food entries with no status are flagged', () => {
  const parsed = doc('# 1. FOOD\n### A\n- walk: 5 minutes\n### B\n- note: Just a tip\n');
  const [a, b] = parsed.sections[0].blocks;
  assert.equal(a.statusMissing, true);
  assert.equal(b.statusMissing, undefined);
});
