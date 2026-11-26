// A small static file server for dist/, shared by the scripts that need to browse the built site (serve-dist, a11y,
// prelaunch-audit). Behaves like Cloudflare Pages for the basics: directory index files, and an unknown path answers 404
// with dist/404.html. `port` 0 picks a free port.
// `production: true` also compresses text (Brotli, else gzip) and caches hashed /_astro/ files for a year, as Cloudflare Pages
// does, so performance measurements are not distorted. The default keeps responses uncached and uncompressed for tests.
import { existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, join, normalize } from 'node:path';
import zlib from 'node:zlib';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.xml', '.txt', '.json', '.ico']);

export async function startStaticServer(dist = join(process.cwd(), 'dist'), port = 0, { production = false } = {}) {
  if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/ is missing. Run `npm run build` first.');
  const cache = new Map();
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    let file = normalize(join(dist, p));
    let status = 200;
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(dist, '404.html');
      status = 404;
    }
    const ext = extname(file);
    const headers = { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-store' };
    let body = existsSync(file) ? readFileSync(file) : Buffer.from('not found');
    if (production) {
      headers['Cache-Control'] = p.startsWith('/_astro/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';
      const accept = String(req.headers['accept-encoding'] ?? '');
      const encoding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : '';
      if (encoding && COMPRESSIBLE.has(ext)) {
        const key = `${encoding}:${file}`;
        if (!cache.has(key)) cache.set(key, encoding === 'br' ? zlib.brotliCompressSync(body) : zlib.gzipSync(body));
        body = cache.get(key);
        headers['Content-Encoding'] = encoding;
        headers.Vary = 'Accept-Encoding';
      }
    }
    headers['Content-Length'] = body.length;
    res.writeHead(status, headers);
    res.end(body);
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
