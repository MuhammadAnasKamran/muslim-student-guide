#!/usr/bin/env node
// Writes SNAPSHOT.md: everything the site shows, in one readable file with its
// pictures, so the committee has a dated baseline of the guide to keep and compare
// against later. Generated from content.md — never edit SNAPSHOT.md by hand.
//
// Usage: npm run snapshot

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, parseContent, toPublicJson } from './parse.mjs';
import { STATUS_LABELS, STATUS_NOT_RECORDED, FIELD_LABELS, linkText, parseWashrooms, statusOf, WASHROOM_TYPES } from '../src/guide.js';

const SHOWN_AS_TEXT = new Set(['tag', 'location', 'where', 'walk', 'district', 'what', 'sells', 'price', 'tags', 'perk', 'delivery']);

function entryLines(entry, depth) {
  const field = Object.fromEntries(entry.fields.map((f) => [f.key, f.value]));
  const status = statusOf(entry);
  const lines = [`${'#'.repeat(depth)} ${entry.name}${status ? ` — ${status === STATUS_NOT_RECORDED ? status.label : STATUS_LABELS[status.key]?.label ?? status.label}` : ''}`, ''];

  const facts = entry.fields.filter((f) => SHOWN_AS_TEXT.has(f.key)).map((f) => f.value);
  if (facts.length) lines.push(facts.join(' · '), '');
  if (field.prayers) lines.push(`Prayers: ${field.prayers}${field.jummah ? ` · ${field.jummah === 'yes' ? 'Jummah held here' : 'No Jummah'}` : ''}`, '');
  else if (field.jummah) lines.push(field.jummah === 'yes' ? 'Jummah held here' : 'No Jummah', '');
  if (field.washrooms) {
    lines.push('| Floor | Washrooms |', '| --- | --- |');
    for (const { floor, types } of parseWashrooms(field.washrooms)) lines.push(`| ${floor} | ${types.map((t) => WASHROOM_TYPES[t]).join(', ')} |`);
    lines.push('');
  }
  if (field.warning) lines.push(`**Warning: ${field.warning}**`, '');
  for (const { key, value } of entry.fields) {
    if (FIELD_LABELS[key] && key !== 'note') lines.push(`${FIELD_LABELS[key]}: ${value}`, '');
  }
  if (field.note) lines.push(field.note, '');
  if (field.logo) lines.push(`<img src="src/photos/${field.logo}" alt="${entry.name} logo" width="48">`, '');
  if (field.photo) lines.push(`![${entry.name}](src/photos/${field.photo})`, '');
  if (field.link) lines.push(`[${linkText(field.link, field['link-label']).text}](${field.link})`, '');
  for (const todo of entry.todos ?? []) lines.push(`_Still to confirm: ${todo}_`, '');
  return lines;
}

export function build() {
  const parsed = parseContent(readFileSync(path.join(ROOT, 'content.md'), 'utf8'));
  const doc = toPublicJson(parsed);
  const sections = doc.sections.filter((s) => s.published);
  const today = new Date().toLocaleDateString('en-CA'); // local date, not UTC
  let commit = '';
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
  } catch {
    commit = 'not a git checkout';
  }

  const out = [
    `# ${doc.meta.title} — snapshot`,
    '',
    `Everything the guide showed on ${today}${commit ? `, at commit \`${commit}\`` : ''}. Generated from \`content.md\` by \`npm run snapshot\`: edit the guide there, not here.`,
    '',
    `${doc.meta.org ?? ''}${doc.meta.version ? ` · version ${doc.meta.version}` : ''}`,
    '',
    '## What is in the guide',
    '',
    '| Section | Listings |',
    '| --- | --- |',
    ...sections.map((s) => `| ${s.title} | ${[...s.blocks, ...s.subsections.flatMap((x) => x.blocks)].filter((b) => b.type === 'entry').length} |`),
    '',
  ];

  for (const section of sections) {
    out.push(`## ${section.title}`, '');
    const groups = [{ title: null, blocks: section.blocks }, ...section.subsections.map((sub) => ({ title: sub.title, blocks: sub.blocks }))];
    for (const group of groups) {
      if (!group.blocks.length) continue;
      if (group.title) out.push(`### ${group.title}`, '');
      for (const block of group.blocks) {
        if (block.type === 'prose') {
          out.push(block.kind === 'blockquote' ? `> ${block.runs.map((r) => r.text).join('')}` : block.runs.map((r) => r.text).join(''), '');
          continue;
        }
        out.push(...entryLines(block, group.title ? 4 : 3));
      }
    }
  }

  const todos = parsed.todos ?? [];
  if (todos.length) {
    out.push('## Known gaps', '', 'Reported by `npm run check`.', '');
    for (const todo of todos) out.push(`- ${todo.entry ?? todo.key ?? todo.section}: ${todo.text}`);
    out.push('');
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(ROOT, 'SNAPSHOT.md'), build());
  console.log('Wrote SNAPSHOT.md');
}
