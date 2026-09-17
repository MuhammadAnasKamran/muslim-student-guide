#!/usr/bin/env node
// Copies a JPEG into src/photos/ with its hidden metadata removed: camera details,
// GPS location, editing history and AI provenance (EXIF, XMP, C2PA) all live in
// APP1–APP15 and comment segments, and none of it should reach a public site.
// The picture itself is left untouched. Then add "- photo: <name>.jpg" to the entry.
//
// Usage: node scripts/add-photo.mjs <input.jpg> <name>
//   e.g. node scripts/add-photo.mjs ~/Pictures/room.jpeg z302a

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './parse.mjs';

export const PHOTO_DIR = path.join(ROOT, 'src', 'photos');
export const PHOTO_NAME = /^[a-z0-9-]+\.jpg$/;

// Kept: APP0 (JFIF header) and APP2 (colour profile). Everything else in APPn and COM goes.
const KEEP_APP = new Set([0xe0, 0xe2]);

export function jpegSegments(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG file');
  const segments = [];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error(`Broken JPEG at byte ${i}`);
    const marker = bytes[i + 1];
    if (marker === 0xda) {
      segments.push({ marker, start: i, end: bytes.length }); // image data runs to the end
      break;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    segments.push({ marker, start: i, end: i + 2 + length });
    i += 2 + length;
  }
  return segments;
}

export function isMetadata(marker) {
  return (marker >= 0xe0 && marker <= 0xef && !KEEP_APP.has(marker)) || marker === 0xfe;
}

export function stripJpeg(bytes) {
  const kept = jpegSegments(bytes).filter((s) => !isMetadata(s.marker));
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...kept.map((s) => bytes.subarray(s.start, s.end))]);
}

function main() {
  const [input, name] = process.argv.slice(2);
  if (!input || !name) {
    console.error('Usage: node scripts/add-photo.mjs <input.jpg> <name>');
    process.exit(1);
  }
  const file = `${name}.jpg`;
  if (!PHOTO_NAME.test(file)) {
    console.error(`"${name}" must be lowercase letters, digits and dashes only.`);
    process.exit(1);
  }
  const before = readFileSync(input);
  const after = stripJpeg(before);
  mkdirSync(PHOTO_DIR, { recursive: true });
  writeFileSync(path.join(PHOTO_DIR, file), after);
  console.log(`Wrote src/photos/${file} (${before.length} → ${after.length} bytes). Add "- photo: ${file}" to the entry.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
