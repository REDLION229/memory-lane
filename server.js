// Local server: serves the app and lists the export files in my-data/ for auto-loading.
// Usage: node server.js (or start.bat), then open http://localhost:5178
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'my-data');
const PORT = 5178;
const SKIP = new Set(['node_modules', '.git']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function listData(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listData(full, out);
    else if (/\.(csv|json|html)$/i.test(e.name)) out.push(path.relative(ROOT, full).split(path.sep).join('/'));
  }
  return out;
}

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/api/files') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(fs.existsSync(DATA) ? listData(DATA) : []));
  }
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => {
  const link = `http://localhost:${PORT}`;
  console.log(`Memory Lane running at ${link}  (close this window to stop)`);
  exec(`start "" "${link}"`);
});
