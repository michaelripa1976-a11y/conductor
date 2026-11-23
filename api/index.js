// Conductor API. One function handles everything:
//   /api/*        the coach's browser (session cookie)
//   /a/<key>/*    an AI's own links (the key is the AI's identity)
import crypto from 'node:crypto';
import { getDoc, putDoc, delDoc, updateDoc, Exists, Conflict, storageKind } from '../lib/store.js';
import { MISSIONS, MISSION_NAME, AI_NAME, AI_ORDER, toMission, toMissions, clean, cleanLink, aiName, live, owners, norm, newTeam, stateText } from '../lib/logic.js';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const hmac = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const rid = (n = 18) => crypto.randomBytes(n).toString('base64url');
const teamDoc = uid => `teams/${uid}.json`;
const userDoc = email => `users/${sha(email.toLowerCase())}.json`;
const keyDoc = key => `keys/${sha(key)}.json`;

function send(res, code, body, type) {
  res.statusCode = code;
  res.setHeader('Cache-Control', 'no-store');
  if (typeof body === 'string') { res.setHeader('Content-Type', type || 'text/plain; charset=utf-8'); res.end(body); }
  else { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); }
}
async function readBody(req) {
  if (req.body !== undefined) { if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } } return req.body || {}; }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 200000) break; chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}
function sessionCookie(uid) { const exp = Date.now() + 30 * 864e5, v = `${uid}.${exp}`; return `cs=${v}.${hmac(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${process.env.VERCEL ? '; Secure' : ''}`; }
function sessionUid(req) {
  const m = /(?:^|;\s*)cs=([^;]+)/.exec(req.headers.cookie || ''); if (!m) return null;
  const [uid, exp, sig] = m[1].split('.'); if (!uid || !exp || !sig) return null;
  const good = hmac(`${uid}.${exp}`);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  return +exp > Date.now() ? uid : null;
}
const scrypt = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 32, (e, k) => (e ? no(e) : ok(k.toString('hex')))));

// What the browser gets. Keys are included: the coach needs them to copy playbooks.
function view(t) {
  return { name: t.name, email: t.email, team: t.team, otherName: t.otherName, sel: t.sel, keys: t.keys, codes: t.codes, joined: t.joined, skipped: t.skipped, benched: t.benched,
    rep: t.rep, seen: t.seen, decided: t.decided, presets: t.presets, over: t.over, extra: t.extra, chief: t.chief, mode: t.mode, focus: t.focus, quiet: t.quiet,
    onboarded: t.onboarded, log: t.log.slice(-600), tasks: t.tasks.filter(x => x.status === 'open').slice(-100), needs: t.needs, blocked: t.blocked, now: Date.now() };
}
const addNeed = (t, n) => { if (t.needs.length < 30 && !t.needs.some(x => x.sig === n.sig)) t.needs.push({ k: 'n' + (++t.n), at: Date.now(), ...n }); };
function sweep(t) { // tasks claimed more than 48h ago with no report
  let changed = false;
  for (const x of t.tasks) if (x.status === 'open' && Date.now() - x.at > 48 * 36e5 && !x.flag) { x.flag = 1; addNeed(t, { t: 'stall', a: x.id, title: x.title, task: x.k, sig: 'stall:' + x.k }); changed = true; }
  return changed;
}

/* ---------- things an AI can do (by link or by pasted line) ---------- */
function doCheckin(t, id, good, reach) {
  const first = !t.joined[id];
  t.joined[id] = t.joined[id] || Date.now(); delete t.skipped[id]; t.seen[id] = Date.now();
  const d = toMissions(good), r = String(reach || '').split(/[,;|]/).map(x => clean(x, 24)).filter(Boolean).slice(0, 4);
  if (first || d.length || r.length) t.rep[id] = { d: d.length ? d : ((t.rep[id] && t.rep[id].d) || []), reach: r.length ? r : ((t.rep[id] && t.rep[id].reach) || []) };
  return `Checked in. Welcome to the team, ${aiName(t, id)}.\n` + (d.length ? `Recorded what you are good at: ${d.map(x => MISSION_NAME[x]).join(', ')}.\n` : 'You did not name any missions yet, so the coach will pick a starting role.\n') + 'The coach decides who owns each mission. Read the team state before every task.\n\n' + stateText(t, id);
}
function doClaim(t, id, mission, task) {
  t.seen[id] = Date.now();
  const title = clean(task, 90), d = toMission(mission) || toMission(task);
  if (!title) return 'Missing task. Use task=SHORT+TITLE.';
  if (!t.joined[id]) return 'Check in first.';
  if (t.benched[id]) return 'You are on the bench. Do not act. You may still read the team state.';
  if (t.mode !== 'on') return `Conductor is ${t.mode === 'pause' ? 'PAUSED' : 'OFF'}. Do not start this task. Tell the coach.`;
  if (d) { const o = owners(t, d); if (o.length && !o.includes(id)) { addNeed(t, { t: 'wrong', a: id, o: o[0], u: d, title, sig: `wrong:${id}:${d}` }); return `BLOCKED. ${MISSION_NAME[d]} belongs to ${o.map(x => aiName(t, x)).join(' and ')}. Do not do this task. The coach has been told.`; } }
  const dup = t.tasks.find(x => x.status === 'open' && x.id !== id && norm(x.title) === norm(title));
  if (dup) { t.tasks.push({ k: 't' + (++t.n), id, title, d, at: Date.now(), status: 'open', hold: 1 }); addNeed(t, { t: 'dup', a: dup.id, b: id, title, sig: 'dup:' + norm(title) }); return `HOLD. ${aiName(t, dup.id)} already claimed "${dup.title}". Do not start. The coach will decide who keeps it.`; }
  const mineOpen = t.tasks.find(x => x.status === 'open' && x.id === id && norm(x.title) === norm(title));
  if (!mineOpen) t.tasks.push({ k: 't' + (++t.n), id, title, d, at: Date.now(), status: 'open' });
  if (t.tasks.length > 400) t.tasks = t.tasks.slice(-400);
  return `CLAIMED. "${title}" is yours${d ? ' under ' + MISSION_NAME[d] : ''}. Report it when done.`;
}
function doDone(t, id, mission, task, link, minutes) {
  t.seen[id] = Date.now();
  const title = clean(task, 90); let d = toMission(mission) || toMission(task);
  if (!title) return 'Missing task. Use task=SHORT+TITLE.';
  if (!t.joined[id]) return 'Check in first.';
  const open = t.tasks.find(x => x.status === 'open' && x.id === id && norm(x.title) === norm(title));
  if (open) { open.status = 'done'; d = d || open.d; }
  if (!d) d = MISSIONS.find(m => owners(t, m).includes(id)) || 'research';
  const min = Math.max(0, Math.min(600, Math.round(+minutes || 0)));
  t.log.push({ k: 'w' + (++t.n), id, d, text: title, link: cleanLink(link), min, at: Date.now() });
  if (t.log.length > 3000) t.log = t.log.slice(-3000);
  const o = owners(t, d);
  if (o.length && !o.includes(id)) addNeed(t, { t: 'wrong', a: id, o: o[0], u: d, title, sig: `wrong:${id}:${d}` });
  if (!o.length && t.log.filter(w => w.id === id && w.d === d).length >= 2) addNeed(t, { t: 'hand', a: id, u: d, sig: `hand:${id}:${d}` });
  return `LOGGED. "${title}" is on the team log${d ? ' under ' + MISSION_NAME[d] : ''}. Thank you.`;
}
function parsePairs(s) { const o = {}; for (const part of s.split(';')) { const i = part.indexOf('='); if (i > 0) o[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim(); } return o; }

/* ---------- AI links: /a/<key>/<action> ---------- */
async function agent(req, res, parts, q) {
  const key = parts[1], action = (parts[2] || 'state').toLowerCase();
  if (!key) return send(res, 404, 'Unknown link.');
  const map = await getDoc(keyDoc(key));
  if (!map) return send(res, 404, 'This Conductor key is not valid any more. Ask the coach for a new playbook.');
  const { uid, id } = map.data; let out = '';
  const body = req.method === 'POST' ? await readBody(req) : {};
  const p = k => (q.get(k) != null ? q.get(k) : body[k]);
  const t = await updateDoc(teamDoc(uid), t => {
    if (!t.sel.includes(id) || t.keys[id] !== key) { out = 'This Conductor key is not valid any more.'; return false; }
    if (action === 'checkin') out = doCheckin(t, id, p('good'), p('reach'));
    else if (action === 'claim') out = doClaim(t, id, p('mission'), p('task'));
    else if (action === 'done') out = doDone(t, id, p('mission'), p('task'), p('link'), p('minutes'));
    else { t.seen[id] = Date.now(); out = stateText(t, id); if (t.nudges && t.nudges[id]) delete t.nudges[id]; }
  });
  if (!t) return send(res, 404, 'Team not found.');
  return send(res, 200, out);
}

/* ---------- coach's browser: /api/<action> ---------- */
async function coach(req, res, parts, q) {
  const action = parts[0] || '';
  if (action === 'health') {
    if (q.get('deep')) { // storage self-test: no user data involved
      const n = `health/deep-${rid(6)}.json`, steps = [];
      const step = async (name, fn) => { const t0 = Date.now(); try { steps.push({ name, ok: true, info: await fn(), ms: Date.now() - t0 }); } catch (e) { steps.push({ name, ok: false, error: `${e && e.name}: ${String(e && e.message).slice(0, 240)}`, ms: Date.now() - t0 }); } };
      let e1 = null, e2 = null;
      await step('create', async () => { await putDoc(n, { v: 1 }, { create: true }); });
      await step('read1', async () => { const g = await getDoc(n); e1 = g && g.etag; return { v: g && g.data.v, etag: String(e1).slice(0, 12), etagType: typeof e1 }; });
      await step('write-with-etag', async () => { await putDoc(n, { v: 2 }, { etag: e1 }); });
      await step('read2', async () => { const g = await getDoc(n); e2 = g && g.etag; return { v: g && g.data.v, etagChanged: e2 !== e1 }; });
      await step('write-with-etag-2', async () => { await putDoc(n, { v: 3 }, { etag: e2 }); });
      await step('read3', async () => { const g = await getDoc(n); return { v: g && g.data.v }; });
      await step('updateDoc', async () => { const d = await updateDoc(n, d => { d.v = 4; }); return { v: d && d.v }; });
      await step('create-again-should-fail', async () => { try { await putDoc(n, { v: 9 }, { create: true }); return 'NOT REJECTED'; } catch (e) { return e instanceof Exists ? 'rejected as expected' : `other error ${e && e.name}: ${String(e && e.message).slice(0, 160)}`; } });
      await step('delete', async () => { await delDoc(n); });
      if (q.get('sizes') && storageKind() === 'blob') { // does a conditional write still work as a document grows?
        const B = await import('@vercel/blob');
        for (const kb of [0.3, 1, 2, 4, 8, 20]) {
          const m = `health/size-${rid(6)}.json`;
          await step(`size-${kb}kb`, async () => {
            await putDoc(m, { pad: 'x'.repeat(Math.round(kb * 1024)), v: 1 }, { create: true });
            const r = await B.get(m, { access: 'private', useCache: false });
            await new Response(r.stream).text();
            const h = await B.head(m);
            const info = { getEtag: r.blob.etag, headEtag: h.etag, same: r.blob.etag === h.etag, enc: r.headers.get('content-encoding') || 'none' };
            try { await putDoc(m, { v: 2 }, { etag: r.blob.etag }); info.writeWithGetEtag = 'ok'; } catch (e) { info.writeWithGetEtag = e instanceof Conflict ? 'CONFLICT' : `${e && e.name}: ${String(e && e.message).slice(0, 120)}`; }
            await delDoc(m);
            return info;
          });
        }
      }
      return send(res, 200, { storage: storageKind(), node: process.version, steps });
    }
    try { const n = 'health/ping.json'; await putDoc(n, { at: Date.now() }); const g = await getDoc(n); return send(res, 200, { ok: !!g, storage: storageKind() }); }
    catch (e) { return send(res, 500, { ok: false, storage: storageKind(), error: String(e && e.message).slice(0, 200) }); }
  }
  if (action === 'signup' && req.method === 'POST') {
    const b = await readBody(req), email = String(b.email || '').trim().toLowerCase(), name = clean(b.name, 18), pw = String(b.password || '');
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) return send(res, 400, { error: 'Enter your name and a real email.' });
    if (pw.length < 8 || pw.length > 200) return send(res, 400, { error: 'Use a password of at least 8 characters.' });
    const uid = rid(12), salt = rid(12), hash = await scrypt(pw, salt);
    try { await putDoc(userDoc(email), { uid, email, salt, hash, at: Date.now() }, { create: true }); }
    catch (e) { if (e instanceof Exists) return send(res, 409, { error: 'That email already has a team. Log in instead.' }); throw e; }
    const t = newTeam(uid, name, email); await putDoc(teamDoc(uid), t);
    res.setHeader('Set-Cookie', sessionCookie(uid)); return send(res, 200, view(t));
  }
  if (action === 'login' && req.method === 'POST') {
    const b = await readBody(req), email = String(b.email || '').trim().toLowerCase(), u = email && await getDoc(userDoc(email));
    const hash = await scrypt(String(b.password || ''), u ? u.data.salt : 'x');
    if (!u || hash.length !== u.data.hash.length || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(u.data.hash))) return send(res, 401, { error: 'Wrong email or password.' });
    const t = await getDoc(teamDoc(u.data.uid)); if (!t) return send(res, 401, { error: 'Team not found.' });
    res.setHeader('Set-Cookie', sessionCookie(u.data.uid)); return send(res, 200, view(t.data));
  }
  if (action === 'logout') { res.setHeader('Set-Cookie', 'cs=; Path=/; HttpOnly; Max-Age=0'); return send(res, 200, { ok: true }); }

  const uid = sessionUid(req); if (!uid) return send(res, 401, { error: 'Not signed in.' });
  const file = teamDoc(uid);

  if (action === 'state') {
    let cur = await getDoc(file); if (!cur) return send(res, 401, { error: 'Not signed in.' });
    if (cur.data.tasks.some(x => x.status === 'open' && !x.flag && Date.now() - x.at > 48 * 36e5)) cur = { data: await updateDoc(file, t => sweep(t)) };
    return send(res, 200, view(cur.data));
  }
  if (action === 'update') { // the text an AI would read, for pasting into a chat AI
    const cur = await getDoc(file), id = q.get('id'); if (!cur || !cur.data.sel.includes(id)) return send(res, 404, { error: 'Unknown AI.' });
    return send(res, 200, { text: stateText(cur.data, id) });
  }
  if (req.method !== 'POST') return send(res, 404, { error: 'Unknown action.' });
  const b = await readBody(req);

  if (action === 'save') { // fields the coach controls
    const made = [], gone = [];
    const t = await updateDoc(file, t => {
      if (Array.isArray(b.sel)) {
        const sel = AI_ORDER.filter(id => b.sel.includes(id));
        for (const id of t.sel) if (!sel.includes(id)) { gone.push(t.keys[id]); for (const m of ['keys', 'codes', 'joined', 'skipped', 'benched', 'rep', 'seen', 'presets']) delete t[m][id]; }
        for (const id of sel) if (!t.keys[id]) { t.keys[id] = 'cdr_' + rid(21); t.codes[id] = rid(4).replace(/[-_]/g, 'x').toUpperCase().slice(0, 6); made.push([id, t.keys[id]]); }
        t.sel = sel;
      }
      const ids = v => v && typeof v === 'object' && !Array.isArray(v);
      if (ids(b.skipped)) { t.skipped = {}; for (const id of t.sel) if (b.skipped[id] && !t.joined[id]) t.skipped[id] = true; }
      if (ids(b.benched)) { t.benched = {}; for (const id of t.sel) if (b.benched[id]) t.benched[id] = true; }
      if (ids(b.decided)) { t.decided = {}; for (const d of MISSIONS) { const v = b.decided[d]; if (v === 'share' || t.sel.includes(v)) t.decided[d] = v; } }
      if (ids(b.presets)) { t.presets = {}; for (const id of t.sel) if (MISSIONS.includes(b.presets[id])) t.presets[id] = b.presets[id]; }
      if (ids(b.over)) { t.over = {}; for (const d of MISSIONS) if (Array.isArray(b.over[d])) t.over[d] = b.over[d].filter(id => t.sel.includes(id)).slice(0, 2); }
      if (ids(b.extra)) { t.extra = {}; for (const d of MISSIONS) if (t.sel.includes(b.extra[d])) t.extra[d] = b.extra[d]; }
      if ('chief' in b) t.chief = t.sel.includes(b.chief) ? b.chief : null;
      if (['on', 'pause', 'off'].includes(b.mode)) t.mode = b.mode;
      if ('focus' in b) t.focus = MISSIONS.includes(b.focus) ? b.focus : null;
      if ('team' in b) t.team = clean(b.team, 16) || null;
      if ('otherName' in b) t.otherName = clean(b.otherName, 14) || null;
      if ('quiet' in b) t.quiet = !!b.quiet;
      if (b.onboarded === true) t.onboarded = true;
    });
    if (!t) return send(res, 401, { error: 'Not signed in.' });
    for (const [id, key] of made) await putDoc(keyDoc(key), { uid, id });
    for (const key of gone) if (key) await delDoc(keyDoc(key));
    return send(res, 200, view(t));
  }
  if (action === 'need') { // the coach answers a decision card
    const t = await updateDoc(file, t => {
      const i = t.needs.findIndex(n => n.k === b.k); if (i < 0) return false;
      const n = t.needs[i], v = String(b.v || ''); t.needs.splice(i, 1);
      const nudge = (id, m) => { t.nudges = t.nudges || {}; (t.nudges[id] = t.nudges[id] || []).push(m); t.nudges[id] = t.nudges[id].slice(-5); };
      if (n.t === 'dup') {
        const mine = t.tasks.filter(x => x.status === 'open' && norm(x.title) === norm(n.title));
        if (v === n.a || v === n.b) { const loser = v === n.a ? n.b : n.a; for (const x of mine) { if (x.id === loser) x.status = 'blocked'; else delete x.hold; } t.blocked++; nudge(loser, `Stop work on "${n.title}". ${aiName(t, v)} keeps it.`); nudge(v, `"${n.title}" is yours. Go ahead.`); }
        else for (const x of mine) { delete x.hold; nudge(x.id, `Split "${n.title}" with the other AI. Coordinate through the coach.`); }
      } else if (n.t === 'stall') {
        const x = t.tasks.find(x => x.k === n.task);
        if (v === 'nudge') nudge(n.a, `The coach wants an update on "${n.title}".`);
        else if (x && t.sel.includes(b.b)) { x.id = b.b; x.at = Date.now(); delete x.flag; nudge(b.b, `You now own the task "${n.title}".`); nudge(n.a, `"${n.title}" was handed to ${aiName(t, b.b)}.`); }
        else if (v === 'drop' && x) x.status = 'blocked';
      } else if (n.t === 'wrong') {
        if (v === 'share') { t.over[n.u] = [n.o, n.a].filter(id => t.sel.includes(id)); nudge(n.a, `You now share ${MISSION_NAME[n.u]}.`); }
        else nudge(n.a, `${MISSION_NAME[n.u]} belongs to ${aiName(t, n.o)}. Do not act on it.`);
      } else if (n.t === 'hand') { if (v === 'yes') { t.extra[n.u] = n.a; nudge(n.a, `${MISSION_NAME[n.u]} is officially yours.`); } }
    });
    return t ? send(res, 200, view(t)) : send(res, 401, { error: 'Not signed in.' });
  }
  if (action === 'paste') { // a chat AI's reply, pasted in by the coach
    const text = String(b.text || '').slice(0, 20000), results = [];
    const lines = [...text.matchAll(/CONDUCTOR[-_ ](CHECKIN|CLAIM|DONE)\b[:\s]*([^\n\r]*)/gi)];
    if (!lines.length) return send(res, 400, { error: 'No Conductor report found in that text. It should contain a line starting with CONDUCTOR-.' });
    const t = await updateDoc(file, t => {
      for (const m of lines.slice(0, 20)) {
        const kind = m[1].toUpperCase(), p = parsePairs(m[2].replace(/[*`]/g, ''));
        let id = t.sel.find(x => t.codes[x] && t.codes[x] === String(p.code || '').toUpperCase().trim());
        if (!id && t.sel.includes(b.id)) id = b.id;
        if (!id) { results.push({ ok: false, msg: 'Could not tell which AI this is from. The code is missing or wrong.' }); continue; }
        const msg = kind === 'CHECKIN' ? doCheckin(t, id, p.good || p['good at'], p.reach || p['can reach']) : kind === 'CLAIM' ? doClaim(t, id, p.mission, p.task) : doDone(t, id, p.mission, p.task, p.link, p.minutes);
        results.push({ ok: true, kind, id, msg: msg.split('\n')[0] });
      }
    });
    return t ? send(res, 200, { results, state: view(t) }) : send(res, 401, { error: 'Not signed in.' });
  }
  return send(res, 404, { error: 'Unknown action.' });
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x'), q = url.searchParams;
    let p = q.get('__p'); if (p == null) p = url.pathname.replace(/^\/(api\/)?/, m => (m === '/api/' ? '' : ''));
    if (url.pathname.startsWith('/a/') && q.get('__p') == null) p = url.pathname.slice(1);
    const parts = p.split('/').filter(Boolean);
    if (parts[0] === 'a') return await agent(req, res, parts, q);
    return await coach(req, res, parts, q);
  } catch (e) {
    const ref = rid(4);
    console.error(`[conductor ${ref}] ${req.method} ${String(req.url).replace(/cdr_[A-Za-z0-9_-]+/g, 'cdr_***')}`, e && e.stack ? e.stack : e);
    return send(res, 500, { error: 'Something went wrong on the server.', ref, kind: (e && e.name) || 'Error' });
  }
}
