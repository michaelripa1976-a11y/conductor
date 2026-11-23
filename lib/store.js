// Storage: Vercel Blob (private store) in production, local JSON files in development.
// Every document is one JSON file. Writes use the ETag so two writers never silently overwrite each other.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const useBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const DEV_DIR = process.env.CONDUCTOR_DEV_DIR || path.join(process.cwd(), '.devdata');

export class Conflict extends Error {}
export class Exists extends Error {}

export class Busy extends Error { constructor() { super('Busy, try again'); this.name = 'Busy'; } }
export const strongEtag = e => String(e || '').replace(/^W\//, '').replace(/-(gzip|br)("?)$/, '$2');

let blobMod = null;
async function blob() { return blobMod || (blobMod = await import('@vercel/blob')); }

export async function getDoc(name) {
  if (useBlob) {
    const { get } = await blob();
    // Ask for the uncompressed file. Once a document passes about 1 KB the CDN compresses it and
    // hands back a weak ETag (W/"..."), which a conditional write never matches.
    const r = await get(name, { access: 'private', useCache: false, headers: { 'accept-encoding': 'identity' } });
    if (!r || r.statusCode !== 200) return null;
    const text = await new Response(r.stream).text();
    return { data: JSON.parse(text), etag: strongEtag(r.blob.etag) };
  }
  try {
    const text = await fs.readFile(path.join(DEV_DIR, name), 'utf8');
    return { data: JSON.parse(text), etag: crypto.createHash('sha1').update(text).digest('hex') };
  } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

// opts.etag: only write if the document still has this etag. opts.create: only write if it does not exist.
export async function putDoc(name, data, opts = {}) {
  const text = JSON.stringify(data);
  if (useBlob) {
    const { put, BlobPreconditionFailedError } = await blob();
    try {
      await put(name, text, {
        access: 'private', contentType: 'application/json', addRandomSuffix: false,
        allowOverwrite: !opts.create, ...(opts.etag ? { ifMatch: opts.etag } : {}),
      });
    } catch (e) {
      if (BlobPreconditionFailedError && e instanceof BlobPreconditionFailedError) throw new Conflict();
      if (opts.create && /already exists|allowOverwrite/i.test(String(e && e.message))) throw new Exists();
      throw e;
    }
    return;
  }
  const file = path.join(DEV_DIR, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (opts.create) {
    try { await fs.writeFile(file, text, { flag: 'wx' }); } catch (e) { if (e.code === 'EEXIST') throw new Exists(); throw e; }
    return;
  }
  if (opts.etag) {
    const cur = await getDoc(name);
    if (!cur || cur.etag !== opts.etag) throw new Conflict();
  }
  await fs.writeFile(file, text);
}

export async function delDoc(name) {
  if (useBlob) { const { del } = await blob(); try { await del(name); } catch (e) {} return; }
  try { await fs.unlink(path.join(DEV_DIR, name)); } catch (e) {}
}

// Read, change, write; retry if someone else wrote in between.
export async function updateDoc(name, fn) {
  for (let i = 0; i < 8; i++) {
    const cur = await getDoc(name);
    if (!cur) return null;
    const out = await fn(cur.data);
    if (out === false) return cur.data;
    try { await putDoc(name, cur.data, { etag: cur.etag }); return cur.data; }
    catch (e) { if (!(e instanceof Conflict)) throw e; await new Promise(r => setTimeout(r, 40 + Math.random() * 120)); }
  }
  throw new Busy();
}

export const storageKind = () => (useBlob ? 'blob' : 'dev-files');
