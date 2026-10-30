// Minimal zip reader that lists entries from the central directory and extracts only the ones
// requested, so multi-gigabyte Takeout archives never have to be loaded into memory.
(function (root) {
  'use strict';

  const SIG_EOCD = 0x06054b50, SIG_Z64_LOC = 0x07064b50, SIG_Z64_EOCD = 0x06064b50;
  const SIG_CEN = 0x02014b50, SIG_LOC = 0x04034b50;

  async function bytes(blob, start, end) {
    return new DataView(await blob.slice(start, end).arrayBuffer());
  }
  const u64 = (dv, o) => Number(dv.getBigUint64(o, true));

  async function list(blob) {
    const tailLen = Math.min(blob.size, 65557);
    const tail = await bytes(blob, blob.size - tailLen, blob.size);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip file');

    let count = tail.getUint16(eocd + 10, true);
    let cdSize = tail.getUint32(eocd + 12, true);
    let cdOffset = tail.getUint32(eocd + 16, true);
    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      const locAt = eocd - 20;
      if (locAt < 0 || tail.getUint32(locAt, true) !== SIG_Z64_LOC) throw new Error('broken zip64 archive');
      const z64At = u64(tail, locAt + 8);
      const z = await bytes(blob, z64At, z64At + 56);
      if (z.getUint32(0, true) !== SIG_Z64_EOCD) throw new Error('broken zip64 archive');
      count = u64(z, 32); cdSize = u64(z, 40); cdOffset = u64(z, 48);
    }

    const cd = await bytes(blob, cdOffset, cdOffset + cdSize);
    const utf8 = new TextDecoder('utf-8'), latin = new TextDecoder('latin1');
    const entries = [];
    let p = 0;
    for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
      if (cd.getUint32(p, true) !== SIG_CEN) break;
      const flags = cd.getUint16(p + 8, true), method = cd.getUint16(p + 10, true);
      let comp = cd.getUint32(p + 20, true), size = cd.getUint32(p + 24, true);
      const nameLen = cd.getUint16(p + 28, true), extraLen = cd.getUint16(p + 30, true), commentLen = cd.getUint16(p + 32, true);
      let offset = cd.getUint32(p + 42, true);
      const nameBytes = new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen);
      const name = (flags & 0x800 ? utf8 : latin).decode(nameBytes);

      let e = p + 46 + nameLen;
      const extraEnd = e + extraLen;
      while (e + 4 <= extraEnd) {
        const id = cd.getUint16(e, true), len = cd.getUint16(e + 2, true);
        if (id === 0x0001) {
          let q = e + 4;
          if (size === 0xffffffff) { size = u64(cd, q); q += 8; }
          if (comp === 0xffffffff) { comp = u64(cd, q); q += 8; }
          if (offset === 0xffffffff) { offset = u64(cd, q); }
        }
        e += 4 + len;
      }
      if (!name.endsWith('/')) entries.push({ name, method, comp, size, offset });
      p = extraEnd + commentLen;
    }
    return entries;
  }

  async function text(blob, entry) {
    const loc = await bytes(blob, entry.offset, entry.offset + 30);
    if (loc.getUint32(0, true) !== SIG_LOC) throw new Error('corrupt zip entry');
    const start = entry.offset + 30 + loc.getUint16(26, true) + loc.getUint16(28, true);
    const data = blob.slice(start, start + entry.comp);
    if (entry.method === 0) return data.text();
    if (entry.method !== 8) throw new Error('unsupported compression');
    return new Response(data.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  }

  root.ZipReader = { list, text };
})(typeof window !== 'undefined' ? window : globalThis);
