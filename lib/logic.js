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
  return { v: 2, uid, name, email, team: null, otherName: null, scope: 'both', sel: [], keys: {}, codes: {}, joined: {}, skipped: {}, benched: {}, reach: {}, seen: {},
    own: {}, mode: { personal: 'on', work: 'on' }, quiet: false, onboarded: false, play: 0,
    log: [], tasks: [], needs: [], nudges: {}, blocked: 0, n: 0, created: Date.now() };
}
// A team saved by the first version (missions instead of boards and sources) is brought forward in place. Nothing is deleted.
export function upgrade(t) {
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
  L.push('Reminder: read anything, act only on your sources or a shared source, claim before you start, report when done.');
  return L.join('\n');
}
