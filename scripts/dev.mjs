#!/usr/bin/env node
// Serves src/ plus the built content.json. No dependencies: Node's http module only.
// Usage: npm run dev   (PORT=3000 npm run dev to change the port)

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

export function startServer(port = Number(process.env.PORT ?? 8080)) {
  const server = createServer(async (request, response) => {
    let file;
    try {
      const { pathname } = new URL(request.url, 'http://localhost');
      if (pathname === '/content.json') {
        file = path.join(ROOT, 'content.json');
      } else {
        file = path.join(SRC, path.normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname)));
        if (!file.startsWith(SRC + path.sep)) throw new Error('outside src');
      }
      const body = await readFile(file);
      response.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startServer();
  console.log(`Serving the guide at http://localhost:${server.address().port}`);
}
