// Photos: hidden metadata is stripped before a file can be published, and every
// photo in src/photos/ belongs to an entry.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { PHOTO_NAME, isMetadata, jpegSegments, stripJpeg } from '../../scripts/add-photo.mjs';

const root = new URL('../../', import.meta.url);
const photoDir = new URL('src/photos/', root);
const MAX_BYTES = 300 * 1024;

// A minimal JPEG: SOI, APP0, APP1 (EXIF), APP2 (colour), APP11 (C2PA), COM, SOS + data.
const segment = (marker, body) => [0xff, marker, 0, body.length + 2, ...body];
const sample = Buffer.from([
  0xff, 0xd8,
  ...segment(0xe0, [0x4a, 0x46]),
  ...segment(0xe1, [0x45, 0x78, 0x69, 0x66]),
  ...segment(0xe2, [0x49, 0x43]),
  ...segment(0xeb, [0x6a, 0x75]),
  ...segment(0xfe, [0x68, 0x69]),
  0xff, 0xda, 0, 2, 0x11, 0x22, 0xff, 0xd9,
]);

test('stripping removes EXIF, C2PA and comments, and keeps the picture', () => {
  const stripped = stripJpeg(sample);
  assert.deepEqual(jpegSegments(stripped).map((s) => s.marker.toString(16)), ['e0', 'e2', 'da']);
  assert.deepEqual([...stripped.subarray(-4)], [0x11, 0x22, 0xff, 0xd9], 'image data is untouched');
});

test('a file that is not a JPEG is refused', () => {
  assert.throws(() => stripJpeg(Buffer.from('not a jpeg')), /Not a JPEG/);
});

test('every published photo has no hidden metadata, is small, and belongs to an entry', () => {
  if (!existsSync(photoDir)) return;
  const content = readFileSync(new URL('content.md', root), 'utf8');
  for (const name of readdirSync(photoDir).filter((n) => n !== '.DS_Store')) {
    assert.match(name, PHOTO_NAME, `${name}: use lowercase letters, digits and dashes, ending .jpg`);
    const bytes = readFileSync(new URL(name, photoDir));
    const found = jpegSegments(bytes).filter((s) => isMetadata(s.marker)).map((s) => s.marker.toString(16));
    assert.deepEqual(found, [], `${name} still carries metadata; add it with scripts/add-photo.mjs`);
    assert.ok(bytes.length <= MAX_BYTES, `${name} is ${bytes.length} bytes; keep photos under ${MAX_BYTES} for phones`);
    assert.match(content, new RegExp(`^- (photo|logo): ${name.replace('.', '\\.')}$`, 'm'), `${name} is not used by any entry in content.md`);
  }
});
