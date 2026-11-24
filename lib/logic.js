// Shared rules for Coach AI: boards, sources, who acts where, and the text an AI reads.
// A board is "personal" or "work". A source is a place an AI can act (an inbox, a calendar, a repo).
// One AI acts on a source. Shared sources have no single owner: any AI may work there when asked.
export const SPACES = ['personal', 'work'];
export const SPACE_NAME = { personal: 'Personal', work: 'Work' };
export const SOURCES = {
  personal: ['email', 'calendar', 'messages', 'files', 'payments', 'social', 'shopping', 'home'],
  work: ['email', 'calendar', 'chat', 'files', 'accounting', 'social', 'code', 'clients'],
};
export const SRC_NAME = { email: 'Email', calendar: 'Calendar', messages: 'Messages', chat: 'Chat', files: 'Files', payments: 'Payments', accounting: 'Accounting', social: 'Social', shopping: 'Shopping', home: 'Home', code: 'Code', clients: 'Clients' };
export const SHARED = ['personal:files', 'work:files', 'work:code'];
export const ALL = SPACES.flatMap(s => SOURCES[s].map(k => `${s}:${k}`));
export const AI_NAME = { chatgpt: 'ChatGPT', claude: 'Claude', grok: 'Grok', gemini: 'Gemini', muse: 'Muse', perplexity: 'Perplexity', devin: 'Devin', victor: 'Victor AI', copilot: 'Copilot', hermes: 'Hermes', openclaw: 'OpenClaw', other: 'Other' };
export const AI_ORDER = Object.keys(AI_NAME);

const O = v => (v && typeof v === 'object' ? v : {});
export const spaceOf = src => String(src).split(':')[0];
export const keyOf = src => String(src).split(':')[1];
export const srcName = src => (ALL.includes(src) ? `${SPACE_NAME[spaceOf(src)]} ${SRC_NAME[keyOf(src)]}` : 'General');
export const isShared = src => SHARED.includes(src);
export const scopeSpaces = t => (t.scope === 'personal' || t.scope === 'work' ? [t.scope] : SPACES);
export const inScope = t => scopeSpaces(t).flatMap(s => SOURCES[s].map(k => `${s}:${k}`));

const WORDS = {
  email: /e-?mail|inbox|\bmail\b|outlook|gmail/i, calendar: /calend|schedul|meeting/i, messages: /messag|\btexts?\b|\bsms\b|whatsapp|imessage/i,
  chat: /\bchat\b|slack|teams/i, files: /files?|\bdocs?\b|documents?|drive|notes|sharepoint|onedrive/i, payments: /payment|bank|\bcards?\b|money|wallet|bills?/i,
  accounting: /account(ing|s)|quickbooks|invoic|billing|finance|bookkeep/i, social: /social|instagram|facebook|linkedin|tiktok|twitter|\bx\b/i,
  shopping: /shop|orders?|booking|amazon|travel/i, home: /\bhome\b|devices?|thermostat|lights?|smart/i, code: /\bcode\b|repos?\b|github|gitlab|program/i, clients: /clients?|\bcrm\b|customers?/i,
};
// "work email", "personal:calendar", "inbox" -> source ids. With no board named, every in-scope board that has the source.
export function toSources(text, t) {
  const out = [], spaces = t ? scopeSpaces(t) : SPACES;
  for (const part of String(text || '').split(/[,;|\n]|\band\b/i)) {
    const p = part.trim().toLowerCase(); if (!p) continue;
    const sp = /\bwork\b|\bjob\b|office/.test(p) ? ['work'] : /personal|\bhome board\b|private|\bmy own\b/.test(p) ? ['personal'] : null;
    const exact = p.match(/^(personal|work)\s*[:\-/ ]\s*([a-z]+)$/);
    let keys = exact && SRC_NAME[exact[2]] ? [exact[2]] : Object.keys(WORDS).filter(k => WORDS[k].test(p.replace(/^(personal|work)\b/, '')));
    if (sp && sp[0] === 'personal' && /\bhome\b/.test(p) && keys.length > 1) keys = keys.filter(k => k !== 'home');
    for (const s of (exact ? [exact[1]] : sp || spaces)) for (const k of keys) { const id = `${s}:${k}`; if (ALL.includes(id) && spaces.includes(s) && !out.includes(id)) out.push(id); }
  }
  return out;
}
export const toSource = (text, t) => toSources(text, t)[0] || null;

/* ---------- accounts ----------
   An AI reports the accounts it can act in (an address or a service name, and what the account holds).
   It never says whether an account is personal or work: the owner tags each one. A tagged account puts
   its AI on that board's sources. An untagged account gives no position at all. */
export const KINDS = ['email', 'calendar', 'chat', 'files'];
export const KIND_NAME = { email: 'Email', calendar: 'Calendar', chat: 'Messages', files: 'Files' };
export const TAGS = ['personal', 'work', 'off'];
export const acctSrc = (tag, kind) => (kind === 'chat' ? (tag === 'personal' ? 'personal:messages' : 'work:chat') : `${tag}:${kind}`);
export const ACCT_SRC = SPACES.flatMap(s => KINDS.map(k => acctSrc(s, k)));
export const kindOf = src => (ACCT_SRC.includes(src) ? (/:(messages|chat)$/.test(src) ? 'chat' : keyOf(src)) : null);
const KIND_WORDS = { email: WORDS.email, calendar: WORDS.calendar, chat: /messag|\btexts?\b|\bsms\b|\bchat\b|slack|teams|whatsapp/i, files: WORDS.files };
const ADDR = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/i;
const FREE = /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|mac|aol|proton|protonmail|pm|gmx|mail|comcast|verizon|att)\.[a-z.]+$/i;
// A hint for the owner only. It never decides anything.
export const guessTag = a => (a.addr ? (FREE.test(a.addr) ? 'personal' : 'work') : /gmail|hotmail|icloud|yahoo|personal|private/i.test(a.label || '') ? 'personal' : /\bwork\b|office|company|business/i.test(a.label || '') ? 'work' : null);
export const acctName = a => a.addr || a.label || 'an account';
// "me@co.com(email, calendar) | Gmail(email)" -> [{ addr, label, has }]
export function parseAccounts(text) {
  const out = [];
  for (const part of String(text || '').split(/[|\n]/)) {
    const raw = part.trim(); if (!raw) continue;
    const m = raw.match(/^(.*?)[\s:=-]*[(\[{]([^)\]}]*)[)\]}]?\s*$/), name = (m ? m[1] : raw).trim(), kt = m ? m[2] : '';
    const am = name.match(ADDR), addr = am ? am[0].toLowerCase().slice(0, 120) : '';
    const label = clean(name.replace(ADDR, ' ').replace(/[<>()\[\]{},;:=]+/g, ' '), 30);
    if (!addr && !label) continue;
    let has = KINDS.filter(k => KIND_WORDS[k].test(kt));
    if (!has.length) has = KINDS.filter(k => KIND_WORDS[k].test(label)); // "Gmail", "Google Calendar"
    if (!has.length) has = ['email'];
    if (!out.some(x => (addr ? x.addr === addr : !x.addr && norm(x.label) === norm(label)))) out.push({ addr, label, has });
    if (out.length >= 12) break;
  }
  return out;
}
const acctKey = (a, id) => (a.addr ? 'e:' + a.addr : `n:${id}:${norm(a.label)}`);
export const acctList = t => Object.values(O(t.accts));
export const acctByK = (t, k) => acctList(t).find(a => a.k === k) || null;
export const acctHas = a => KINDS.filter(k => Object.values(O(a.by)).some(v => v.includes(k)));
export const acctsOf = (t, id) => acctList(t).filter(a => O(a.by)[id]);
// Replace what one AI reports. Returns the accounts that are new and not tagged yet.
export function setAccounts(t, id, list) {
  t.accts = O(t.accts); const fresh = [];
  for (const a of acctList(t)) delete a.by[id];
  for (const x of list) {
    const key = acctKey(x, id); let a = t.accts[key] || acctList(t).find(y => (y.was || []).includes(key)); // "Gmail" again, after the owner filled in its address
    if (!a) { a = t.accts[key] = { k: 'c' + (++t.n), addr: x.addr, label: x.label, by: {}, tag: null, at: Date.now() }; fresh.push(a); }
    if (x.label && !a.label) a.label = x.label;
    a.by[id] = x.has;
  }
  dropEmpty(t);
  return fresh.filter(a => acctList(t).includes(a) && !a.tag);
}
// An account nobody reports any more is forgotten, unless the owner tagged it (the tag is kept for when an AI reports it again).
export function dropEmpty(t) { for (const [key, a] of Object.entries(O(t.accts))) if (!Object.keys(O(a.by)).length && !a.tag) delete t.accts[key]; }
// The owner fills in an address an AI could not see. Same address as another account: the two become one.
export function setAddr(t, a, addr) {
  const m = String(addr || '').trim().toLowerCase().match(ADDR); if (!m || a.addr) return a;
  const old = Object.keys(t.accts).find(key => t.accts[key] === a), into = t.accts['e:' + m[0]];
  if (into && into !== a) { for (const [id, has] of Object.entries(a.by)) into.by[id] = [...new Set([...(into.by[id] || []), ...has])]; if (!into.tag) into.tag = a.tag; into.was = [...(into.was || []), ...(a.was || []), old]; delete t.accts[old]; return into; }
  a.addr = m[0].slice(0, 120); a.was = [...(a.was || []), old]; delete t.accts[old]; t.accts['e:' + a.addr] = a; return a;
}
// What an AI can act on. With accounts: the account sources come only from tagged accounts, everything else from what it said.
// Without accounts (an AI still on the older playbook): exactly what it said.
export function recompute(t, id) {
  t.said = O(t.said); t.reach = O(t.reach);
  const said = Array.isArray(t.said[id]) ? t.said[id] : [], mine = acctsOf(t, id);
  if (!mine.length) { t.reach[id] = said.slice(); return; }
  const sp = scopeSpaces(t), out = said.filter(src => !ACCT_SRC.includes(src));
  for (const a of mine) if (sp.includes(a.tag)) for (const k of a.by[id]) { const src = acctSrc(a.tag, k); if (!out.includes(src)) out.push(src); }
  t.reach[id] = out;
}
export const recomputeAll = t => { for (const id of Object.keys(O(t.joined))) recompute(t, id); };
// An untagged account of this AI that could be the one a claim is about.
export const untaggedFor = (t, id, src) => { const k = kindOf(src); return k ? acctsOf(t, id).find(a => !a.tag && a.by[id].includes(k)) || null : null; };

export const clean = (s, n = 120) => String(s == null ? '' : s).replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
export const cleanLink = s => { const t = String(s || '').trim(); return /^https?:\/\/[^\s<>"'`]+$/i.test(t) ? t.slice(0, 500) : ''; };
export const aiName = (t, id) => (id === 'other' && t.otherName) || AI_NAME[id] || String(id || 'someone');
export const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\b(the|a|an|to|for|of|my|our)\b/g, '').replace(/\s+/g, ' ').trim();

// On the team and reporting in: picked, connected, not benched.
export const live = t => AI_ORDER.filter(id => (t.sel || []).includes(id) && O(t.joined)[id] && !O(t.benched)[id]);
export const reachers = (t, src) => live(t).filter(id => (O(t.reach)[id] || []).includes(src));
// Who may act on a source. Shared: everyone who reaches it. Otherwise the owner's pick, or the only AI that reaches it.
export function owners(t, src) {
  if (!ALL.includes(src)) return [];
  const r = reachers(t, src);
  if (isShared(src)) return r;
  const pick = O(t.own)[src];
  if (pick && live(t).includes(pick)) return [pick];
  return r.length === 1 ? r : [];
}
// Sources where two or more AIs can act and the owner has not picked one.
export const conflicts = t => inScope(t).filter(src => !isShared(src) && owners(t, src).length === 0 && reachers(t, src).length > 1);

export function newTeam(uid, name, email) {
  return { v: 2, uid, name, email, team: null, otherName: null, scope: 'both', sel: [], keys: {}, codes: {}, joined: {}, skipped: {}, benched: {}, reach: {}, said: {}, accts: {}, seen: {},
    own: {}, mode: { personal: 'on', work: 'on' }, quiet: false, onboarded: false, play: 0,
    log: [], tasks: [], needs: [], nudges: {}, blocked: 0, n: 0, created: Date.now() };
}
// A team saved by the first version (missions instead of boards and sources) is brought forward in place. Nothing is deleted.
export function upgrade(t) {
  if (t && !t.said) { t.said = {}; for (const [id, r] of Object.entries(O(t.reach))) t.said[id] = Array.isArray(r) ? r.slice() : []; } // teams from before accounts
  if (t && !t.accts) t.accts = {};
  if (!t || t.v === 2) return t;
  t.v = 2; t.scope = t.scope || 'both'; t.reach = O(t.reach); t.own = {};
  t.mode = typeof t.mode === 'string' ? { personal: t.mode, work: t.mode } : { personal: 'on', work: 'on', ...O(t.mode) };
  for (const m of ['keys', 'codes', 'joined', 'skipped', 'benched', 'seen', 'nudges']) t[m] = O(t[m]);
  for (const m of ['log', 'tasks', 'needs', 'sel']) t[m] = Array.isArray(t[m]) ? t[m] : [];
  for (const x of [...t.log, ...t.tasks]) if (x && !('src' in x)) x.src = null;
  t.needs = []; t.play = t.play || 0;
  return t;
}

// Plain-text view of the team for one AI. This is what it reads before acting.
export function stateText(t, id) {
  const L = [], sw = m => (m === 'on' ? 'ON' : m === 'pause' ? 'PAUSED (read only, do not act)' : 'OFF (do not act)');
  L.push(`COACH AI TEAM STATE for ${aiName(t, id)} (team of ${t.name})`);
  for (const s of scopeSpaces(t)) L.push(`${SPACE_NAME[s]} board: ${sw(O(t.mode)[s] || 'on')}`);
  const mine = inScope(t).filter(src => !isShared(src) && owners(t, src).includes(id));
  const shared = inScope(t).filter(src => isShared(src));
  L.push(`Sources you act on: ${mine.length ? mine.map(srcName).join(', ') : 'none yet'}`);
  L.push(`Shared sources (any AI may work here when the owner asks; claim first): ${shared.map(srcName).join(', ')}`);
  const acc = acctsOf(t, id);
  if (acc.length) {
    L.push('Your accounts (the owner tags each one; you never choose the board):');
    for (const a of acc) L.push(`- ${acctName(a)} (${a.by[id].map(k => KIND_NAME[k]).join(', ')}): ${a.tag === 'off' ? 'HANDS OFF, do not act in it' : a.tag ? SPACE_NAME[a.tag] + ' board' : 'NOT TAGGED YET, do not act in it until the owner tags it'}`);
  }
  L.push('Who acts where:');
  for (const src of inScope(t)) {
    const o = owners(t, src), r = reachers(t, src);
    L.push(`- ${src} (${srcName(src)}): ${isShared(src) ? 'shared' + (o.length ? ', used by ' + o.map(x => aiName(t, x)).join(', ') : '') : o.length ? aiName(t, o[0]) : r.length > 1 ? 'not decided yet, wait for the owner' : 'nobody yet'}`);
  }
  const open = (t.tasks || []).filter(x => x && x.status === 'open');
  L.push(`Open tasks (${open.length}):`);
  for (const x of open.slice(-15)) L.push(`- "${x.title}" claimed by ${aiName(t, x.id)}${x.by ? ' · ' + x.by : ''} [${srcName(x.src)}]`);
  L.push('Recently done:');
  for (const w of (t.log || []).filter(Boolean).slice(-10).reverse()) L.push(`- "${w.text}" by ${aiName(t, w.id)}${w.by ? ' · ' + w.by : ''} [${srcName(w.src)}]`);
  const nd = (t.nudges && t.nudges[id]) || [];
  if (nd.length) { L.push('Messages from the owner:'); for (const m of nd) L.push(`- ${m}`); }
  L.push('Reminder: read anything, act only on your sources or a shared source, never in an account the owner has not tagged, claim before you start, report when done.');
  return L.join('\n');
}
