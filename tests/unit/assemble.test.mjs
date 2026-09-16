// The published folder must carry a content hash on every asset link, or a
// phone can keep an old stylesheet after a deploy.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assemble } from '../../scripts/assemble.mjs';

test('every asset link carries a content hash', () => {
  const out = mkdtempSync(path.join(tmpdir(), 'musa-site-'));
  try {
    const version = assemble(out);
    const files = readdirSync(out);
    for (const name of ['index.html', 'app.js', 'guide.js', 'styles.css', 'background.jpg', 'content.json']) {
      assert.ok(files.includes(name), `${name} is missing from the published folder`);
    }

    const html = readFileSync(path.join(out, 'index.html'), 'utf8');
    assert.match(html, new RegExp(`styles\\.css\\?v=${version['styles.css']}`));
    assert.match(html, new RegExp(`app\\.js\\?v=${version['app.js']}`));

    const app = readFileSync(path.join(out, 'app.js'), 'utf8');
    assert.match(app, new RegExp(`\\./guide\\.js\\?v=${version['guide.js']}`), 'the module import needs the hash too');

    const css = readFileSync(path.join(out, 'styles.css'), 'utf8');
    assert.match(css, new RegExp(`background\\.jpg\\?v=${version['background.jpg']}`));

    // The same input must produce the same hashes, so unchanged files stay cached.
    const again = assemble(out);
    assert.deepEqual(again, version);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
