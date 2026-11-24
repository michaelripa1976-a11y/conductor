// Local development server: serves public/ and routes /api/* and /a/* to the same handler Vercel runs.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import handler from './api/index.js';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/a/') || u.pathname.startsWith('/mcp')) return handler(req, res);
  const f = path.join('public', u.pathname === '/' ? 'index.html' : u.pathname);
  try { const d = await fs.readFile(f); res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'); res.end(d); }
  catch (e) { res.statusCode = 404; res.end('Not found'); }
}).listen(process.env.PORT || 3000, () => console.log('Coach AI dev on http://localhost:' + (process.env.PORT || 3000)));
