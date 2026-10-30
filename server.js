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

// Exit once no open page has checked in for a while, so nothing lingers after the tab is closed.
const IDLE_LIMIT = 90000;
let lastPing = Date.now();
setInterval(() => { if (Date.now() - lastPing > IDLE_LIMIT) process.exit(0); }, 10000).unref();

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  lastPing = Date.now();
  if (url === '/api/ping') { res.writeHead(204); return res.end(); }
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
});

const link = `http://localhost:${PORT}`;
const openBrowser = () => exec(process.platform === 'win32' ? `start "" "${link}"` : `${process.platform === 'darwin' ? 'open' : 'xdg-open'} "${link}"`);

server.on('error', err => {
  if (err.code === 'EADDRINUSE') { openBrowser(); process.exit(0); }
  console.error(`Could not start: ${err.message}`);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Memory Lane running at ${link}. It stops on its own shortly after you close the page.`);
  openBrowser();
});
