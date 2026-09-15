#!/usr/bin/env node
// Fetches every link in the published guide and reports any that don't end in
// HTTP 200 after redirects. It never fails the build: a dead link is a job for
// the committee, not a reason to take the guide offline.
//
// Limitation: WhatsApp invite pages return 200 even when the invite has been
// revoked, so a pass here does not prove a group link still works.
//
// Env: LINK_REPORT=file.md writes a Markdown report. In GitHub Actions the count
// of broken links is written to the step output `broken`.

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, entriesOf, formatProblems, parseContent } from './parse.mjs';

const TIMEOUT_MS = 20_000;
const CONCURRENCY = 5;
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; MUSA-Guide-LinkCheck/1.0)',
  accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
};

const doc = parseContent(readFileSync(path.join(ROOT, 'content.md'), 'utf8'));
if (doc.problems.length) {
  console.error('content.md has structural problems; run npm run check first.');
  for (const line of formatProblems(doc.problems, 'content.md')) console.error(`  ${line}`);
  process.exit(1);
}

const links = new Map();
for (const section of doc.sections.filter((s) => s.published)) {
  for (const { entry } of entriesOf(section)) {
    for (const field of entry.fields) {
      if (field.key !== 'link') continue;
      if (!links.has(field.value)) links.set(field.value, []);
      links.get(field.value).push(`${entry.name} (line ${field.line})`);
    }
  }
}

async function check(url) {
  try {
    const response = await fetch(url, { redirect: 'follow', headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    await response.body?.cancel();
    return { url, status: response.status, finalUrl: response.url };
  } catch (error) {
    const reason = error.name === 'TimeoutError' ? `timed out after ${TIMEOUT_MS / 1000}s` : (error.cause?.code ?? error.message);
    return { url, status: null, reason };
  }
}

const queue = [...links.keys()];
const results = [];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) results.push(await check(queue.shift()));
  }),
);
results.sort((a, b) => [...links.keys()].indexOf(a.url) - [...links.keys()].indexOf(b.url));

const broken = results.filter((r) => r.status !== 200);
console.log(`Checked ${results.length} unique links from content.md\n`);
for (const r of results) {
  const outcome = r.status === 200 ? ' 200' : r.status ? ` ${r.status}` : ' ERR';
  console.log(`${r.status === 200 ? 'ok  ' : 'FAIL'}${outcome}  ${r.url}`);
  if (r.status !== 200) {
    console.log(`           ${r.reason ?? `final URL: ${r.finalUrl}`}`);
    console.log(`           used by: ${links.get(r.url).join('; ')}`);
  }
}
console.log(`\n${broken.length} of ${results.length} links did not return 200.`);

if (process.env.LINK_REPORT) {
  const lines = [
    `The weekly link check found **${broken.length}** of ${results.length} links in \`content.md\` that did not return HTTP 200.`,
    '',
    '| Result | Link | Used by |',
    '|---|---|---|',
    ...broken.map((r) => `| ${r.status ?? r.reason} | ${r.url} | ${links.get(r.url).join('<br>')} |`),
    '',
    'Check each one by hand before editing `content.md`: some sites refuse automated requests but work in a browser.',
  ];
  writeFileSync(process.env.LINK_REPORT, `${lines.join('\n')}\n`);
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `broken=${broken.length}\n`);
