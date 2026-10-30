// Parsers for Google Takeout YouTube exports. No DOM access, so it also runs in Node.
(function (root) {
  'use strict';

  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  function decodeHTML(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return isNaN(n) ? m : String.fromCodePoint(n);
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  }
  const stripTags = s => decodeHTML(s.replace(/<[^>]*>/g, '')).replace(/[  ]/g, ' ').trim();

  function videoIdFromUrl(url) {
    if (!url) return '';
    const m = url.match(/[?&]v=([\w-]{11})/) || url.match(/youtu\.be\/([\w-]{11})/) || url.match(/\/shorts\/([\w-]{11})/);
    return m ? m[1] : '';
  }

  function parseDateLoose(s) {
    s = s.replace(/[  ]/g, ' ').trim();
    let t = Date.parse(s);
    if (isNaN(t)) t = Date.parse(s.replace(/\s+(?:[A-Z]{2,5}|GMT|UTC)?[+-]?\d{0,2}:?\d{0,2}$/, ''));
    return t;
  }

  // Comment text is stored as JSON fragments: {"text":"hi "},{"text":"@name","mention":...}
  function parseCommentText(raw) {
    raw = (raw || '').trim();
    if (!raw.startsWith('{')) return raw;
    try {
      return JSON.parse('[' + raw + ']').map(seg => seg.text || '').join('');
    } catch (e) {
      const parts = [];
      raw.replace(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g, (m, t) => {
        try { parts.push(JSON.parse('"' + t + '"')); } catch (e2) { parts.push(t); }
      });
      return parts.length ? parts.join('') : raw;
    }
  }

  function parseCommentsCSV(text, path) {
    const rows = parseCSV(text.replace(/^﻿/, ''));
    if (rows.length < 1) return null;
    const head = rows[0].map(s => s.trim().toLowerCase());
    const col = re => head.findIndex(h => re.test(h));
    if (col(/video title text/) >= 0) return parseVideoTextsCSV(rows, head);
    const iTime = col(/timestamp|create|date|time/);
    const isMessage = col(/^message id/) >= 0;
    let iText = col(/comment text|live chat text|message text/);
    if (iText < 0) iText = col(/^text$/);
    // Message exports may have no text column (shared videos only)
    if (iTime < 0 || (iText < 0 && !isMessage)) return null;
    const iId = col(/comment id|chat id|message id|^id$/), iVid = col(/video id/), iParent = col(/parent/), iPost = col(/post id/);
    const kind = isMessage ? 'message' : col(/live chat/) >= 0 || /live.?chat/i.test(path) ? 'chat' : 'comment';
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 2) continue;
      const t = Date.parse(row[iTime]);
      if (isNaN(t)) continue;
      out.push({
        k: kind,
        t,
        id: iId >= 0 ? row[iId] : '',
        vid: iVid >= 0 ? row[iVid].trim() : '',
        post: iPost >= 0 ? row[iPost].trim() : '',
        reply: iParent >= 0 && !!row[iParent].trim(),
        text: iText >= 0 && row[iText] ? parseCommentText(row[iText]) : '',
      });
    }
    return out;
  }

  // "video texts.csv": upload titles and descriptions, split across numbered segment columns.
  function parseVideoTextsCSV(rows, head) {
    const iVid = head.findIndex(h => /^video id/.test(h));
    const iTime = head.findIndex(h => /create timestamp/.test(h));
    const titleCols = head.map((h, i) => /video title text/.test(h) ? i : -1).filter(i => i >= 0);
    const descCols = head.map((h, i) => /video description text/.test(h) ? i : -1).filter(i => i >= 0);
    const join = (row, cols) => cols.map(i => row[i] ? parseCommentText(row[i]) : '').join('').trim();
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 2) continue;
      const t = Date.parse(row[iTime]);
      if (isNaN(t)) continue;
      out.push({ k: 'upload', t, id: '', vid: (row[iVid] || '').trim(), post: '', reply: false, title: join(row, titleCols), text: join(row, descCols) });
    }
    return out;
  }

  // Older exports: my-comments.html, one <li> per comment.
  function parseCommentsHTML(text) {
    const out = [];
    const items = text.split(/<li[\s>]/i).slice(1);
    for (const item of items) {
      const body = item.split(/<\/li>/i)[0];
      const href = (body.match(/href="([^"]*watch\?v=[^"]*)"/) || [])[1];
      const vid = videoIdFromUrl(decodeHTML(href || ''));
      const segs = body.split(/<br\s*\/?>/i);
      let t = NaN;
      const iso = body.match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
      if (iso) t = Date.parse(iso[1] + 'T' + iso[2] + 'Z');
      if (isNaN(t)) for (const s of segs) { t = parseDateLoose(stripTags(s).replace(/^Sent at\s*/i, '')); if (!isNaN(t)) break; }
      if (isNaN(t)) continue;
      const links = [...body.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/gi)];
      out.push({
        k: 'comment', t, vid, id: '',
        title: links.length > 1 ? stripTags(links[links.length - 1][1]) : '',
        text: stripTags(segs[segs.length - 1] || ''),
      });
    }
    return out;
  }

  function parseWatchJSON(text) {
    let arr;
    try { arr = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { return null; }
    if (!Array.isArray(arr) || !arr.some(x => x && x.titleUrl && x.time)) return null;
    const out = [];
    for (const x of arr) {
      if (!x || !x.time || !x.titleUrl) continue;
      if (x.details && x.details.some(d => /ads/i.test(d.name || ''))) continue;
      const vid = videoIdFromUrl(x.titleUrl);
      if (!vid) continue;
      const t = Date.parse(x.time);
      if (isNaN(t)) continue;
      const ch = x.subtitles && x.subtitles[0];
      out.push({
        k: 'watch', t, vid,
        title: (x.title || '').replace(/^Watched\s+/, ''),
        channel: ch ? ch.name : '',
        music: x.header === 'YouTube Music',
      });
    }
    return out;
  }

  function parseWatchHTML(text) {
    const out = [];
    for (const cell of text.split(/class="outer-cell/).slice(1)) {
      if (/From Google Ads/i.test(cell)) continue;
      const m = cell.match(/class="content-cell[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (!m) continue;
      const segs = m[1].split(/<br\s*\/?>/i);
      const a = segs[0].match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!a) continue;
      const vid = videoIdFromUrl(decodeHTML(a[1]));
      if (!vid) continue;
      let t = NaN;
      for (let i = segs.length - 1; i >= 1 && isNaN(t); i--) { const s = stripTags(segs[i]); if (s) t = parseDateLoose(s); }
      if (isNaN(t)) continue;
      out.push({
        k: 'watch', t, vid,
        title: stripTags(a[2]),
        channel: segs[1] ? stripTags(segs[1]) : '',
        music: /YouTube Music/.test(cell.slice(0, 400)),
      });
    }
    return out;
  }

  function isCandidate(path) {
    const p = path.toLowerCase();
    if (p.endsWith('.csv') || p.endsWith('.json')) return true;
    return p.endsWith('.html') && /comment|watch|history|verlauf|historial|historique/.test(p);
  }

  // Returns { comments, watches } for a file, or null if it isn't recognised.
  function parseFile(path, text) {
    const p = path.toLowerCase();
    if (p.endsWith('.csv')) {
      const c = parseCommentsCSV(text, path);
      return c ? { comments: c, watches: [] } : null;
    }
    if (p.endsWith('.json')) {
      if (/search/.test(p)) return null;
      const w = parseWatchJSON(text);
      return w ? { comments: [], watches: w } : null;
    }
    if (p.endsWith('.html')) {
      if (/search/.test(p)) return null;
      if (/comment/.test(p)) return { comments: parseCommentsHTML(text), watches: [] };
      if (text.includes('outer-cell')) return { comments: [], watches: parseWatchHTML(text) };
    }
    return null;
  }

  function dedupe(list, keyFn) {
    const seen = new Set();
    return list.filter(x => { const k = keyFn(x); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  root.TakeoutParser = {
    parseCSV, parseCommentText, parseCommentsCSV, parseCommentsHTML,
    parseWatchJSON, parseWatchHTML, videoIdFromUrl, isCandidate, parseFile, dedupe,
  };
})(typeof window !== 'undefined' ? window : globalThis);
