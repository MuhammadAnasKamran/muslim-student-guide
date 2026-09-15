import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseContent } from '../../scripts/parse.mjs';
import { validate } from '../../scripts/validate.mjs';

const HEADER = '# Guide\n## META\n- title: Test guide\n';
const check = (body) => validate(parseContent(HEADER + body));
const VALIDATOR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/validate.mjs');

test('a well-formed entry passes', () => {
  const { errors, warnings } = check('# 1. FOOD\n### Place\n- where: Z Core\n- status: certified-section\n- link: https://example.com\n- link-label: Menu\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('a value containing a colon is valid', () => {
  const { errors } = check('# 1. FOOD\n### Place\n- where: Z Core\n- status: certified\n- note: Opens 10:00: usually\n');
  assert.deepEqual(errors, []);
});

test('an invalid status fails with its line number', () => {
  const { errors } = check('# 1. FOOD\n### Place\n- where: Z Core\n- status: halal\n');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 7);
  assert.match(errors[0].message, /status "halal"/);
});

test('status values are exact: no case or spacing variants', () => {
  for (const bad of ['Certified', 'certified section', 'certified_section', 'verified']) {
    const { errors } = check(`# 1. FOOD\n### Place\n- where: Z\n- status: ${bad}\n`);
    assert.equal(errors.length, 1, bad);
  }
});

test('a duplicate name in the same section fails, even across subsections', () => {
  const { errors } = check('# 1. FOOD\n### Place\n- where: A\n- status: certified\n## 1.1 More\n### place\n- where: B\n- status: certified\n');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 9);
  assert.match(errors[0].message, /Duplicate entry name "place".*line 5/);
});

test('the same name in different sections is allowed', () => {
  const { errors } = check('# 1. FOOD\n### Place\n- where: A\n- status: certified\n# 2. SHOPS\n### Place\n- where: B\n- status: certified\n');
  assert.deepEqual(errors, []);
});

test('a TODO line is a gap, not an unknown key', () => {
  const doc = parseContent(`${HEADER}# 1. FOOD\n### Place\n- where: Z Core\n- status: certified\n- TODO: confirm brand\n`);
  assert.deepEqual(validate(doc).errors, []);
  assert.equal(doc.todos.length, 1);
  assert.equal(doc.todos[0].line, 8);
  assert.equal(doc.todos[0].text, 'confirm brand');
});

test('unknown keys, repeated keys, bad links and placeholders fail', () => {
  const { errors } = check(
    '# 1. FOOD\n### Place\n- where: Z\n- opening: 9am\n- where: Y\n- link: http://example.com\n- address: TBC\n' +
      '### Other\n- link-label: Menu\n- jummah-note: Here\n',
  );
  assert.deepEqual(errors.map((e) => e.line), [7, 8, 9, 10, 12, 13]);
});

test('an entry with no fields fails', () => {
  const { errors } = check('# 1. FOOD\n### Empty\n- TODO: everything\n');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 5);
});

test('held-back sections are not schema-checked', () => {
  const { errors } = check('# HELD BACK FOR v2\n### Idea\n- rating: 5 stars\n- status: halal-friendly\n');
  assert.deepEqual(errors, []);
});

test('the CLI exits non-zero and prints file:line on failure', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'musa-'));
  const file = path.join(dir, 'content.md');
  writeFileSync(file, `${HEADER}# 1. FOOD\n### Place\n- where: Z\n- status: halal\n`);
  const result = spawnSync(process.execPath, [VALIDATOR, file], { encoding: 'utf8', cwd: dir });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /content\.md:7: "Place" has status "halal"/);

  writeFileSync(file, `${HEADER}# 1. FOOD\n### Place\n- where: Z\n- status: certified\n`);
  assert.equal(spawnSync(process.execPath, [VALIDATOR, file], { encoding: 'utf8', cwd: dir }).status, 0);
});
