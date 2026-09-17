#!/usr/bin/env node
// Builds the small map previews shown on "Open in Google Maps" buttons.
//
// For each Google Maps link in content.md it reads the place's coordinates from the
// link itself (opening it in a headless browser when the short link hides them),
// then saves the OpenStreetMap tiles around that point into src/maps/tiles/. The site
// serves those files itself, so a visitor's phone never contacts Google or OSM.
// Map data © OpenStreetMap contributors (ODbL); the credit shows on every preview.
//
// Run it after adding or changing a map link:  node scripts/make-map-previews.mjs

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, parseContent } from './parse.mjs';
import { linkText, previewTiles } from '../src/guide.js';

const MAP_DIR = path.join(ROOT, 'src', 'maps');
const TILE_DIR = path.join(MAP_DIR, 'tiles');
const INDEX = path.join(MAP_DIR, 'previews.json');
// OSM's tile policy asks for an identifying User-Agent and light, one-off use.
const USER_AGENT = 'MUSA-Muslim-Student-Guide/1.0 (student volunteer project; one-off preview build)';

const doc = parseContent(readFileSync(path.join(ROOT, 'content.md'), 'utf8'));
const links = [];
for (const section of doc.sections) {
  if (!section.published) continue;
  for (const block of [...section.blocks, ...section.subsections.flatMap((s) => s.blocks)]) {
    const link = block.fields?.find((f) => f.key === 'link')?.value;
    if (link && linkText(link).map) links.push({ link, name: block.name });
  }
}

const previous = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')).places : {};
const places = {};
let browser;
for (const { link, name } of links) {
  if (previous[link]) {
    places[link] = previous[link];
    continue;
  }
  let url = link;
  if (!/!3d-?[\d.]+!4d-?[\d.]+/.test(url)) {
    const { chromium } = await import('@playwright/test');
    browser ??= await chromium.launch();
    const page = await browser.newPage();
    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });
    for (let i = 0; i < 30 && !/!3d-?[\d.]+!4d-?[\d.]+/.test(page.url()); i++) await page.waitForTimeout(500);
    url = page.url();
    await page.close();
  }
  const match = url.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/);
  if (!match) throw new Error(`No coordinates found for "${name}": ${link}`);
  places[link] = { name, lat: Number(match[1]), lng: Number(match[2]) };
  console.log(`  ${name}: ${places[link].lat}, ${places[link].lng}`);
}
await browser?.close();

mkdirSync(TILE_DIR, { recursive: true });
const needed = new Set(Object.values(places).flatMap((p) => previewTiles(p.lat, p.lng).map((t) => `${t.z}-${t.x}-${t.y}.png`)));
for (const file of needed) {
  const target = path.join(TILE_DIR, file);
  if (existsSync(target)) continue;
  const [z, x, y] = file.replace('.png', '').split('-');
  const response = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Tile ${file} returned HTTP ${response.status}`);
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  console.log(`  saved tile ${file}`);
  await new Promise((resolve) => setTimeout(resolve, 300));
}
for (const file of readdirSync(TILE_DIR)) {
  if (!needed.has(file)) rmSync(path.join(TILE_DIR, file));
}

writeFileSync(INDEX, `${JSON.stringify({ credit: '© OpenStreetMap contributors', places }, null, 2)}\n`);
console.log(`Wrote src/maps/previews.json: ${Object.keys(places).length} previews, ${needed.size} tiles.`);
