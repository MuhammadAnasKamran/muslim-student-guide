#!/usr/bin/env node
// Validates content.md and reports every known gap (TODO).
// Exits non-zero, with line numbers, if anything would publish wrong or not at all.
//
// Usage: node scripts/validate.mjs [content.md]

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, countEntries, entriesOf, formatProblems, parseContent } from './parse.mjs';
import { ENTRY_KEYS, META_KEYS, PLACEHOLDER, STATUSES } from './schema.mjs';

const PHOTO_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'photos');

// photoExists is swappable so tests don't depend on files in src/photos.
export function validate(doc, { photoExists = (name) => existsSync(path.join(PHOTO_DIR, name)) } = {}) {
  const errors = [...doc.problems];
  const warnings = [];
  const error = (line, message) => errors.push({ line, message });

  if (!doc.hasMeta) error(1, 'No "## META" block found. The site needs at least "- title: ...".');
  else if (!doc.meta.title) error(1, 'The "## META" block has no "- title: ..." field.');
  checkFields(doc.metaFields, META_KEYS, 'META', error);

  for (const section of doc.sections) {
    if (!section.published) continue;
    const names = new Map();

    for (const { entry } of entriesOf(section)) {
      const where = `"${entry.name}"`;
      if (entry.fields.length === 0) {
        error(entry.line, `${where} has no fields, so it would show only a name.`);
      }
      checkFields(entry.fields, ENTRY_KEYS, where, error);

      const field = Object.fromEntries(entry.fields.map((f) => [f.key, f]));
      if (field.status && !STATUSES.includes(field.status.value)) {
        error(field.status.line, `${where} has status "${field.status.value}". Allowed: ${STATUSES.join(', ')}.`);
      }
      if (field.link) {
        const reason = linkProblem(field.link.value);
        if (reason) error(field.link.line, `${where} link ${reason}: ${field.link.value}`);
      }
      if (field['link-label'] && !field.link) {
        error(field['link-label'].line, `${where} has "link-label" but no "link".`);
      }
      if (field.photo) {
        if (!/^[a-z0-9-]+\.jpg$/.test(field.photo.value)) {
          error(field.photo.line, `${where} photo "${field.photo.value}" must be a file name like "z302a.jpg". Add it with scripts/add-photo.mjs.`);
        } else if (!photoExists(field.photo.value)) {
          error(field.photo.line, `${where} photo "${field.photo.value}" is not in src/photos/. Add it with scripts/add-photo.mjs.`);
        }
      }
      if (field.prayers) {
        const names = field.prayers.value.split(' · ').map((p) => p.trim());
        const known = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const unknown = names.filter((p) => !known.includes(p));
        if (unknown.length) {
          error(field.prayers.line, `${where} prayers has "${unknown.join('", "')}". Use ${known.join(', ')}, separated by " · ".`);
        } else if (names.join() !== known.filter((p) => names.includes(p)).join()) {
          error(field.prayers.line, `${where} prayers must be in the order of the day: ${known.join(' · ')}.`);
        }
      }
      if (field['jummah-note'] && !field.jummah) {
        error(field['jummah-note'].line, `${where} has "jummah-note" but no "jummah: yes" or "jummah: no".`);
      }
      if (field.jummah && !['yes', 'no'].includes(field.jummah.value)) {
        error(field.jummah.line, `${where} has jummah "${field.jummah.value}". Use "yes" or "no".`);
      }
      if (entry.statusMissing) {
        warnings.push({
          line: entry.line,
          message: `${where} looks like a food listing but has no "status". The site will say its halal status is not recorded.`,
        });
      }

      const normalised = entry.name.trim().toLowerCase().replace(/\s+/g, ' ');
      if (names.has(normalised)) {
        error(entry.line, `Duplicate entry name ${where} in "${section.heading}" (first used on line ${names.get(normalised)}).`);
      } else {
        names.set(normalised, entry.line);
      }
    }
  }

  errors.sort((a, b) => a.line - b.line);
  warnings.sort((a, b) => a.line - b.line);
  return { errors, warnings };
}

function checkFields(fields, allowed, where, error) {
  const seen = new Map();
  for (const { key, value, line } of fields) {
    if (!allowed.includes(key)) {
      error(line, `Unknown key "${key}" in ${where}. Allowed keys: ${allowed.join(', ')}.`);
    }
    if (seen.has(key)) error(line, `${where} has "${key}" twice (also on line ${seen.get(key)}).`);
    else seen.set(key, line);
    if (PLACEHOLDER.test(value)) {
      error(line, `${where} has the placeholder "${value}" for "${key}". Leave the key out, or add a TODO line instead.`);
    }
  }
}

export function linkProblem(value) {
  if (/\s/.test(value)) return 'contains a space';
  let url;
  try {
    url = new URL(value);
  } catch {
    return 'is not a valid URL';
  }
  if (url.protocol !== 'https:') return 'must start with https://';
  if (!url.hostname.includes('.')) return 'has no valid domain';
  return null;
}

export function todoGroups(doc) {
  const groups = new Map();
  for (const todo of doc.todos) {
    const section = doc.sections.find((s) => s.heading === todo.section);
    let label = todo.section ?? '(before any section)';
    if (!section) label = todo.subsection ?? label;
    else if (!section.published) label = `${label} (not published)`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(todo);
  }
  return groups;
}

function main() {
  const input = path.resolve(process.argv[2] ?? path.join(ROOT, 'content.md'));
  const label = path.relative(process.cwd(), input) || input;
  const doc = parseContent(readFileSync(input, 'utf8'));
  const { errors, warnings } = validate(doc);
  const out = [];

  const published = doc.sections.filter((s) => s.published);
  const total = published.reduce((n, s) => n + countEntries(s), 0);
  out.push(`Entries per section (${total} published)`);
  for (const s of doc.sections) {
    const count = s.published ? String(countEntries(s)) : 'not published';
    out.push(`  ${s.heading.padEnd(34, ' ')} ${count}`);
  }

  out.push('', `TODO gaps (${doc.todos.length})`);
  for (const [group, todos] of todoGroups(doc)) {
    out.push(`  ${group}`);
    for (const t of todos) {
      const subject = t.entry ?? t.key ?? t.subsection;
      out.push(`    line ${String(t.line).padEnd(4)} ${subject ? `${subject} — ` : ''}${t.text}`);
    }
  }

  if (warnings.length) {
    out.push('', `Warnings (${warnings.length}) — these do not block a deploy`);
    for (const line of formatProblems(warnings, label)) out.push(`  ${line}`);
  }
  console.log(out.join('\n'));

  if (errors.length) {
    console.error(`\nValidation FAILED: ${errors.length} error(s)`);
    for (const line of formatProblems(errors, label)) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(`\nValidation passed: ${label} has no errors.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
