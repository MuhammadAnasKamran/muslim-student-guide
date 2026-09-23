#!/usr/bin/env node
// Builds a printable PDF of everything the website publishes: every section, listing,
// halal status, prayer time, washroom floor, warning, picture and link, in reading order.
// Generated from content.md, so the PDF and the site can never drift apart.
//
// Usage: npm run pdf    →  The-Muslim-Guide-to-PolyU.pdf

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { ROOT, parseContent, toPublicJson } from './parse.mjs';
import { FIELD_LABELS, STATUS_LABELS, STATUS_NOT_RECORDED, WASHROOM_TYPES, linkText, parseWashrooms, statusOf } from '../src/guide.js';

const OUT = path.join(ROOT, 'The-Muslim-Guide-to-PolyU.pdf');
const SUMMARY_KEYS = ['tag', 'location', 'where', 'walk', 'district', 'what', 'sells', 'price'];
const CHIP_KEYS = ['tags', 'perk', 'delivery'];
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Pictures travel inside the PDF, so a page built in memory can still show them.
const photo = (file) => `data:image/jpeg;base64,${readFileSync(path.join(ROOT, 'src', 'photos', file)).toString('base64')}`;

function entryHtml(entry) {
  const field = Object.fromEntries(entry.fields.map((f) => [f.key, f.value]));
  const status = statusOf(entry);
  const label = status ? (STATUS_LABELS[status.key]?.label ?? STATUS_NOT_RECORDED.label) : null;
  const out = [`<article class="entry">`, `<h3>`];
  if (field.logo) out.push(`<img class="logo" src="${photo(field.logo)}" alt="">`);
  out.push(`<span>${escape(entry.name)}</span>`);
  if (label) out.push(`<span class="status status-${status.key}">${escape(label)}</span>`);
  out.push(`</h3>`);

  const summary = entry.fields.filter((f) => SUMMARY_KEYS.includes(f.key)).map((f) => f.value);
  if (summary.length) out.push(`<p class="where">${escape(summary.join(' · '))}</p>`);
  const chips = entry.fields.filter((f) => CHIP_KEYS.includes(f.key)).flatMap((f) => f.value.split(' · '));
  if (chips.length) out.push(`<p class="chips">${chips.map((c) => `<span class="chip">${escape(c.trim())}</span>`).join('')}</p>`);
  if (field.prayers) {
    const jummah = field.jummah ? ` <strong>${field.jummah === 'yes' ? '★ Jummah held here' : 'No Jummah'}</strong>` : '';
    out.push(`<p class="prayers">Prayers: ${escape(field.prayers)}${jummah}</p>`);
  }
  if (field.washrooms) {
    const rows = parseWashrooms(field.washrooms)
      .map(({ floor, types }) => `<tr><th>${escape(floor)}</th><td>${types.map((t) => WASHROOM_TYPES[t]).join(', ')}</td></tr>`)
      .join('');
    out.push(`<table class="floors"><tbody>${rows}</tbody></table>`);
  }
  if (field.warning) out.push(`<p class="warning">${escape(field.warning)}</p>`);
  for (const { key, value } of entry.fields) {
    if (FIELD_LABELS[key] && key !== 'note') out.push(`<p class="fact"><span>${escape(FIELD_LABELS[key])}:</span> ${escape(value)}</p>`);
  }
  if (field.note) out.push(`<p class="note">${escape(field.note)}</p>`);
  if (field.photo) out.push(`<img class="photo" src="${photo(field.photo)}" alt="${escape(entry.name)}">`);
  if (field.link) {
    const { text } = linkText(field.link, field['link-label']);
    out.push(`<p class="link"><a href="${escape(field.link)}">${escape(text)}</a><br><span class="url">${escape(field.link)}</span></p>`);
  }
  out.push('</article>');
  return out.join('\n');
}

export function buildHtml() {
  const doc = toPublicJson(parseContent(readFileSync(path.join(ROOT, 'content.md'), 'utf8')));
  const sections = doc.sections.filter((s) => s.published);
  const body = sections
    .map((section) => {
      const groups = [{ title: null, blocks: section.blocks }, ...section.subsections.map((sub) => ({ title: sub.title, blocks: sub.blocks }))];
      const inner = groups
        .filter((g) => g.blocks.length)
        .map((group) => {
          const parts = group.title ? [`<h2>${escape(group.title)}</h2>`] : [];
          for (const block of group.blocks) {
            if (block.type === 'prose') {
              const text = escape(block.runs.map((r) => r.text).join(''));
              parts.push(block.kind === 'blockquote' ? `<p class="note-block">${text}</p>` : `<p class="intro">${text}</p>`);
            } else {
              parts.push(entryHtml(block));
            }
          }
          return parts.join('\n');
        })
        .join('\n');
      return `<section class="screen"><h1>${escape(section.title)}</h1>\n${inner}</section>`;
    })
    .join('\n');

  const counts = sections
    .map((s) => `<li>${escape(s.title)} — ${[...s.blocks, ...s.subsections.flatMap((x) => x.blocks)].filter((b) => b.type === 'entry').length} listings</li>`)
    .join('');

  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(doc.meta.title)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 11pt/1.5 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #17211E; }
  .cover { display: flex; flex-direction: column; justify-content: center; min-height: 235mm; text-align: center; page-break-after: always; }
  .cover h1 { margin: 0 0 6mm; font-size: 30pt; line-height: 1.15; color: #0F2A24; }
  .cover p { margin: 0 0 3mm; font-size: 12pt; color: #46554F; }
  .cover ul { margin: 10mm auto 0; padding: 0; list-style: none; font-size: 11pt; color: #46554F; }
  .screen { page-break-before: always; }
  h1 { margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 2px solid #0F2A24; font-size: 19pt; color: #0F2A24; }
  h2 { margin: 7mm 0 3mm; font-size: 13pt; color: #1D6B59; }
  .entry { margin: 0 0 5mm; padding: 3.5mm 4mm; border: 0.4mm solid #D8E0DC; border-radius: 2.5mm; page-break-inside: avoid; }
  .entry h3 { display: flex; align-items: center; gap: 2.5mm; margin: 0 0 1.5mm; font-size: 12pt; }
  .entry h3 span:first-of-type { flex: 1; }
  .logo { width: 9mm; height: 9mm; object-fit: cover; border-radius: 1.5mm; }
  .status { padding: 0.6mm 2.2mm; border-radius: 1.5mm; font-size: 8.5pt; font-weight: 700; white-space: nowrap; }
  .status-certified { background: #DFF3E4; color: #17603A; }
  .status-certified-section { background: #FCF0D2; color: #7A5600; }
  .status-check-packaging { background: #FBE1DC; color: #8C2A1C; }
  .status-unverified, .status-none { background: #ECEFEE; color: #3C4A45; }
  .where { margin: 0 0 1.5mm; color: #46554F; }
  .chips { margin: 0 0 1.5mm; }
  .chip { display: inline-block; margin: 0 1.5mm 1.5mm 0; padding: 0.6mm 2.2mm; border: 0.3mm solid #1D6B59; border-radius: 6mm; font-size: 9pt; }
  .prayers { margin: 0 0 1.5mm; }
  .floors { margin: 1.5mm 0; border-collapse: collapse; font-size: 10pt; }
  .floors th, .floors td { padding: 0.8mm 3mm 0.8mm 0; text-align: left; }
  .floors th { width: 14mm; color: #1D6B59; }
  .warning { margin: 2mm 0; padding: 2mm 3mm; border-left: 1mm solid #C08A00; background: #FCF6E5; font-weight: 700; }
  .fact { margin: 0 0 1mm; }
  .fact span { color: #46554F; }
  .note, .intro { margin: 0 0 2mm; }
  .note-block { margin: 0 0 4mm; padding: 2mm 3mm; border-left: 1mm solid #1D6B59; background: #F1F6F4; }
  .photo { display: block; width: 100%; max-height: 95mm; object-fit: contain; margin: 2mm 0; border-radius: 2mm; }
  .link { margin: 2mm 0 0; }
  .link a { color: #14614F; font-weight: 700; text-decoration: none; }
  .url { color: #6A7973; font-size: 8.5pt; word-break: break-all; }
</style>
<body>
<div class="cover">
  <h1>${escape(doc.meta.title)}</h1>
  ${doc.meta.subtitle ? `<p>${escape(doc.meta.subtitle)}</p>` : ''}
  ${doc.meta.org ? `<p>${escape(doc.meta.org)}</p>` : ''}
  <p>Version ${escape(doc.meta.version ?? '')} · updated ${escape(doc.meta.updated ?? '')}</p>
  <ul>${counts}</ul>
  <p style="margin-top:10mm;font-size:10pt">Everything in this booklet is published on the MUSA guide website.<br>Edit <code>content.md</code> and run <code>npm run pdf</code> to make it again.</p>
</div>
${body}
</body></html>`;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(buildHtml(), { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="width:100%;padding:0 14mm;font-size:8pt;color:#6A7973;display:flex;justify-content:space-between"><span>The Muslim Guide to PolyU · MUSA</span><span class="pageNumber"></span></div>',
    margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
  });
  await browser.close();
  writeFileSync(OUT, pdf);
  console.log(`Wrote ${path.basename(OUT)} (${(pdf.length / 1024).toFixed(0)} KB)`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('make-pdf.mjs')) await main();
