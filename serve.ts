// Cendrawasih Airlift — serve.ts
// A tiny static file server for local play-testing: serves game/ on
// http://localhost:8080. Node 22, standard library only.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const PORT = 8080;
const GAME_DIR = join(process.cwd(), 'game');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = join(GAME_DIR, rel);
  if (!file.startsWith(GAME_DIR) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found\n');
    return;
  }
  try {
    const bytes = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(bytes);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('read error\n');
  }
});

server.listen(PORT, () => {
  console.log(`Cendrawasih Airlift at http://localhost:${PORT}/`);
});
