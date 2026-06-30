import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve('site');
const host = '127.0.0.1';
const port = 4173;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
};

function resolveRequestPath(urlPath) {
  let pathname = decodeURIComponent(urlPath || '/');
  if (pathname === '/') pathname = '/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';
  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  return path.join(rootDir, normalized);
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);
    const filePath = resolveRequestPath(requestUrl.pathname);
    const resolved = path.resolve(filePath);

    if (!resolved.startsWith(rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    const content = await fs.readFile(resolved);
    const ext = path.extname(resolved);
    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': contentType,
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
});

server.listen(port, host, () => {
  console.log(`Static server running at http://${host}:${port}`);
});
