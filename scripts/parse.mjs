#!/usr/bin/env node
// content.md → content.json. The format is documented in CLAUDE.md, "Data format".
//
// Structural problems (a field with no colon, text jammed under an entry, a table
// in a published section) are collected with their line numbers and stop the
// build. Schema rules — known keys, status values, links — live in validate.mjs.
//
// Usage: node scripts/parse.mjs [content.md] [content.json]

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOOD_KEYS, HELD_BACK } from './schema.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HEADING = /^(#+)\s+(.+?)\s*$/;
const BAD_HEADING = /^#+(?!#)(\S|\s*$)/;
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE = /^\s*(```|~~~)/;
const BULLET = /^[-*+]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const TABLE_ROW = /^\|/;
const CONTINUATION = /^\s+\S/;
const KEY = /^[a-z][a-z0-9-]*$/;
const TODO = /^TODO:\s*(.*)$/;
const NUMBERED_TITLE = /^(\d+(?:\.\d+)*)\.?\s+(.+)$/;
const PUBLISHED_PROSE = new Set(['paragraph', 'blockquote']);

export function parseContent(source) {
  const lines = source.split(/\r?\n/);
  const problems = [];
  const todos = [];
  const sections = [];
  const metaFields = [];
  const ids = new Set();

  let section = null;
  let subsection = null;
  let entry = null;
  let lastWasField = false;
  let prose = null;
  let fence = null;

  const problem = (line, message) => {
    problems.push({ line, message });
  };
  const container = () => subsection ?? section;

  function uniqueId(text) {
    const base = slugify(text);
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
    ids.add(id);
    return id;
  }

  function addTodo(text, line, key) {
    if (!text) problem(line, 'TODO has no description. Say what is missing.');
    todos.push({
      line,
      text,
      key: key ?? null,
      section: section?.heading ?? null,
      subsection: subsection?.heading ?? null,
      entry: entry?.name ?? null,
    });
  }

  function flushProse() {
    if (!prose) return;
    const block = prose;
    prose = null;
    if (!container()) {
      problem(block.line, 'Text before the first "#" section.');
      return;
    }
    if (block.kind === 'paragraph' || block.kind === 'blockquote') {
      const text = block.lines.join(' ');
      const todo = text.match(TODO);
      if (todo) return addTodo(todo[1], block.line);
      container().blocks.push({ type: 'prose', kind: block.kind, line: block.line, runs: inline(text) });
    } else if (block.kind === 'list') {
      const items = [];
      for (const item of block.items) {
        const todo = item.text.match(TODO);
        if (todo) addTodo(todo[1], item.line);
        else items.push({ line: item.line, runs: inline(item.text) });
      }
      if (items.length) container().blocks.push({ type: 'prose', kind: 'list', line: block.line, items });
    } else {
      container().blocks.push({ type: 'prose', kind: block.kind, line: block.line, text: block.lines.join('\n') });
    }
  }

  function closeEntry() {
    entry = null;
    lastWasField = false;
  }

  function parseField(text, line) {
    const todo = text.match(TODO);
    if (todo) return addTodo(todo[1], line);
    const colon = text.indexOf(':');
    if (colon === -1) {
      return problem(line, `"- ${text}" is not a "- key: value" field. There is no colon.`);
    }
    const key = text.slice(0, colon).trim();
    const value = text.slice(colon + 1).trim();
    if (!KEY.test(key)) {
      return problem(line, `"${key}" is not a valid key. Keys are lowercase words joined by hyphens, like "jummah-note".`);
    }
    if (!value) {
      return problem(line, `"${key}" has no value. Leave the key out entirely if the information is missing.`);
    }
    const valueTodo = value.match(TODO);
    if (valueTodo) return addTodo(valueTodo[1], line, key);
    return { key, value, line };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    const raw = lines[i];

    if (fence) {
      if (FENCE.test(raw)) {
        prose = fence;
        fence = null;
        flushProse();
      } else {
        fence.lines.push(raw);
      }
      continue;
    }

    if (FENCE.test(raw)) {
      if (entry && lastWasField) problem(line, `Code block directly under the fields of "${entry.name}".`);
      flushProse();
      closeEntry();
      fence = { kind: 'code', line, lines: [] };
      continue;
    }

    if (raw.trim() === '') {
      flushProse();
      lastWasField = false;
      continue;
    }

    if (raw.startsWith('#')) {
      flushProse();
      closeEntry();
      const match = raw.match(HEADING);
      if (!match || BAD_HEADING.test(raw)) {
        problem(line, `Malformed heading "${raw}". Write "# ", "## " or "### " followed by the name.`);
        continue;
      }
      const level = match[1].length;
      const heading = match[2];
      if (level === 1) {
        const [, number = null, title = heading] = heading.match(NUMBERED_TITLE) ?? [];
        section = {
          id: uniqueId(title),
          heading,
          number,
          title,
          line,
          published: !HELD_BACK.test(title),
          isHeader: false,
          blocks: [],
          subsections: [],
        };
        subsection = null;
        sections.push(section);
      } else if (level === 2) {
        if (!section) {
          problem(line, `"## ${heading}" appears before any "#" section.`);
          continue;
        }
        const [, number = null, title = heading] = heading.match(NUMBERED_TITLE) ?? [];
        subsection = { id: uniqueId(title), heading, number, title, line, isMeta: /^meta$/i.test(heading), blocks: [] };
        if (subsection.isMeta) section.isHeader = true;
        section.subsections.push(subsection);
      } else if (level === 3) {
        if (!section) {
          problem(line, `Entry "${heading}" appears before any "#" section.`);
          continue;
        }
        entry = { type: 'entry', id: uniqueId(heading), name: heading, line, fields: [] };
        container().blocks.push(entry);
      } else {
        problem(line, `"${match[1]}" headings are not part of the format. Use "###" for an entry.`);
      }
      continue;
    }

    if (RULE.test(raw)) {
      flushProse();
      closeEntry();
      continue;
    }

    if (entry) {
      if (raw.startsWith('- ')) {
        const field = parseField(raw.slice(2).trim(), line);
        if (field) entry.fields.push(field);
        lastWasField = true;
        continue;
      }
      if (lastWasField) {
        problem(line, `Unexpected text directly under the fields of "${entry.name}". Every fact must be one "- key: value" line; prose needs a blank line before it.`);
        continue;
      }
      closeEntry();
    }

    if (subsection?.isMeta && raw.startsWith('- ')) {
      flushProse();
      const field = parseField(raw.slice(2).trim(), line);
      if (field) metaFields.push(field);
      continue;
    }

    const quote = raw.match(QUOTE);
    const bullet = raw.match(BULLET) ?? raw.match(NUMBERED);

    if (prose?.kind === 'list' && CONTINUATION.test(raw)) {
      prose.items.at(-1).text += ` ${raw.trim()}`;
    } else if (quote) {
      if (prose?.kind !== 'blockquote') {
        flushProse();
        prose = { kind: 'blockquote', line, lines: [] };
      }
      if (quote[1].trim() === '') flushProse();
      else prose.lines.push(quote[1].trim());
    } else if (TABLE_ROW.test(raw)) {
      if (prose?.kind !== 'table') {
        flushProse();
        prose = { kind: 'table', line, lines: [] };
      }
      prose.lines.push(raw.trim());
    } else if (bullet) {
      if (prose?.kind !== 'list') {
        flushProse();
        prose = { kind: 'list', line, items: [] };
      }
      prose.items.push({ line, text: bullet[1].trim() });
    } else {
      if (prose?.kind !== 'paragraph') {
        flushProse();
        prose = { kind: 'paragraph', line, lines: [] };
      }
      prose.lines.push(raw.trim());
    }
  }

  flushProse();
  if (fence) problem(fence.line, 'Code block is never closed.');

  const headers = sections.filter((s) => s.isHeader);
  for (const extra of headers.slice(1)) {
    problem(extra.line, `A second "## META" block was found under "${extra.heading}". There must be exactly one.`);
  }

  for (const s of sections) {
    for (const { entry: e } of entriesOf(s)) {
      if (s.isHeader) {
        problem(e.line, `Entry "${e.name}" is inside the file header ("${s.heading}"), which is never published.`);
      }
      const keys = new Set(e.fields.map((f) => f.key));
      if (!keys.has('status') && FOOD_KEYS.some((k) => keys.has(k))) e.statusMissing = true;
    }
    if (!s.published || s.isHeader) continue;
    for (const c of [s, ...s.subsections]) {
      for (const block of c.blocks) {
        if (block.type === 'prose' && !PUBLISHED_PROSE.has(block.kind)) {
          problem(block.line, `A ${block.kind} is not allowed in the published section "${s.heading}". Use paragraphs, "> " quotes or "###" entries.`);
        }
      }
    }
  }

  problems.sort((a, b) => a.line - b.line);
  return {
    meta: Object.fromEntries(metaFields.map((f) => [f.key, f.value])),
    metaFields,
    hasMeta: headers.length > 0,
    sections: sections.filter((s) => !s.isHeader),
    todos,
    problems,
  };
}

// Only the published data goes into content.json. Held-back sections keep their
// heading so the build is honest about what exists, but none of their contents:
// content.json is publicly downloadable from the live site.
export function toPublicJson(doc) {
  return {
    source: 'content.md',
    meta: doc.meta,
    sections: doc.sections.map((s) => {
      const head = { id: s.id, heading: s.heading, number: s.number, title: s.title, line: s.line, published: s.published };
      if (!s.published) return head;
      return {
        ...head,
        blocks: s.blocks.map(publicBlock),
        subsections: s.subsections.map((sub) => ({
          id: sub.id,
          heading: sub.heading,
          number: sub.number,
          title: sub.title,
          line: sub.line,
          blocks: sub.blocks.map(publicBlock),
        })),
      };
    }),
  };
}

function publicBlock(block) {
  if (block.type === 'prose') return { type: 'prose', kind: block.kind, line: block.line, runs: block.runs };
  const out = {
    type: 'entry',
    id: block.id,
    name: block.name,
    line: block.line,
    fields: block.fields.map(({ key, value }) => ({ key, value })),
  };
  if (block.statusMissing) out.statusMissing = true;
  return out;
}

export function* entriesOf(section) {
  for (const block of section.blocks) if (block.type === 'entry') yield { entry: block, subsection: null };
  for (const sub of section.subsections ?? []) {
    for (const block of sub.blocks) if (block.type === 'entry') yield { entry: block, subsection: sub };
  }
}

export function countEntries(section) {
  return [...entriesOf(section)].length;
}

// **bold** and `code` only. Anything else stays literal text.
export function inline(text) {
  const runs = [];
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) runs.push({ text: text.slice(last, match.index) });
    if (match[1] !== undefined) runs.push({ text: match[1], strong: true });
    else runs.push({ text: match[2], code: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}

export function slugify(text) {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'item';
}

export function formatProblems(problems, file) {
  return problems.map((p) => `${file}:${p.line}: ${p.message}`);
}

function main() {
  const input = path.resolve(process.argv[2] ?? path.join(ROOT, 'content.md'));
  const output = path.resolve(process.argv[3] ?? path.join(ROOT, 'content.json'));
  const label = path.relative(process.cwd(), input) || input;
  const doc = parseContent(readFileSync(input, 'utf8'));

  if (doc.problems.length) {
    console.error(`Build failed: ${doc.problems.length} problem(s) in ${label}\n`);
    for (const line of formatProblems(doc.problems, label)) console.error(`  ${line}`);
    console.error('\ncontent.json was not written.');
    process.exit(1);
  }

  writeFileSync(output, `${JSON.stringify(toPublicJson(doc), null, 2)}\n`);
  const published = doc.sections.filter((s) => s.published);
  const total = published.reduce((n, s) => n + countEntries(s), 0);
  console.log(`Wrote ${path.relative(process.cwd(), output) || output}: ${total} entries in ${published.length} published sections.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
