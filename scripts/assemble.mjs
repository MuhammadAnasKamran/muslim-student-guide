#!/usr/bin/env node
// Builds the folder that gets published: src/ plus content.json, with a content
// hash on every asset link.
//
// GitHub Pages serves everything with `cache-control: max-age=600`, so without
// this a phone can hold an old stylesheet for ten minutes or more, sometimes
// showing new markup with old styles. Hashed links change whenever a file
// changes, so a stale copy is never used.
//
// Usage: node scripts/assemble.mjs [_site]

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './parse.mjs';

const HASHED = ['styles.css', 'app.js', 'guide.js', 'background.jpg'];

export function assemble(outDir) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(path.join(ROOT, 'src'), outDir, { recursive: true });
  cpSync(path.join(ROOT, 'content.json'), path.join(outDir, 'content.json'));

  const version = Object.fromEntries(
    HASHED.map((name) => [name, createHash('sha256').update(readFileSync(path.join(outDir, name))).digest('hex').slice(0, 8)]),
  );

  // Rewrite every reference: the page's links, the module import, the CSS url().
  for (const file of ['index.html', 'app.js', 'styles.css']) {
    const full = path.join(outDir, file);
    let text = readFileSync(full, 'utf8');
    for (const [name, hash] of Object.entries(version)) {
      text = text
        .replaceAll(`"${name}"`, `"${name}?v=${hash}"`)
        .replaceAll(`'./${name}'`, `'./${name}?v=${hash}'`);
    }
    writeFileSync(full, text);
  }
  return version;
}

function main() {
  const outDir = path.resolve(process.argv[2] ?? path.join(ROOT, '_site'));
  const version = assemble(outDir);
  console.log(`Assembled ${path.relative(process.cwd(), outDir) || outDir}`);
  for (const [name, hash] of Object.entries(version)) console.log(`  ${name} -> ?v=${hash}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
