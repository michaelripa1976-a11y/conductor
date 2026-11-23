// Shared rules: missions, who owns what, and the text an AI reads.
export const MISSIONS = ['money', 'email', 'calendar', 'code', 'home', 'writing', 'social', 'research'];
export const MISSION_NAME = { money: 'Money', email: 'Email', calendar: 'Calendar', code: 'Code', home: 'Household', writing: 'Writing', social: 'Social', research: 'Research' };
export const AI_NAME = { chatgpt: 'ChatGPT', claude: 'Claude', grok: 'Grok', gemini: 'Gemini', muse: 'Muse', perplexity: 'Perplexity', devin: 'Devin', victor: 'Victor AI', copilot: 'Copilot', hermes: 'Hermes', openclaw: 'OpenClaw', other: 'Other' };
export const AI_ORDER = Object.keys(AI_NAME);

const WORDS = {
  money: /money|financ|budget|bill|invoice|pay|tax|bank|expens|account/i,
  email: /e-?mail|inbox|mail\b|outlook|gmail/i,
  calendar: /calend|schedul|meeting|appointment|booking|\bbook\b/i,
  code: /cod(e|ing)|program|software|develop|\bdev\b|bug|repo|script|engineer/i,
  home: /home|household|house|errand|grocer|chore|shopping|family/i,
  writing: /writ|draft|blog|copy|document|edit|proofread|content/i,
  social: /social|post|twitter|\bx\b|linkedin|instagram|facebook|tiktok/i,
  research: /research|search|compar|analy|investigat|web\b|brows|news/i,
};
export function toMission(text) {
  const t = String(text || '').trim().toLowerCase();
  if (MISSIONS.includes(t)) return t;
  if (t === 'household') return 'home';
  for (const m of MISSIONS) if (WORDS[m].test(t)) return m;
  return null;
}
export function toMissions(text) {
  const out = [];
  for (const part of String(text || '').split(/[,;/|]| and /i)) { const m = toMission(part); if (m && !out.includes(m)) out.push(m); }
  return out.slice(0, 3);
}
export const clean = (s, n = 120) => String(s == null ? '' : s).replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
export const cleanLink = s => { const t = String(s || '').trim(); return /^https?:\/\/[^\s<>"'`]+$/i.test(t) ? t.slice(0, 500) : ''; };
export const aiName = (t, id) => (id === 'other' && t.otherName) || AI_NAME[id] || id;

export const live = t => AI_ORDER.filter(id => t.sel.includes(id) && t.joined[id] && !t.skipped[id] && !t.benched[id]);
const repD = (t, id) => (t.rep[id] && t.rep[id].d) || [];
export function owners(t, d) {
  const lv = live(t);
  if (t.over[d]) return t.over[d].filter(id => lv.includes(id));
  const h = lv.filter(id => repD(t, id).includes(d)).slice(0, 2);
  let o = [];
  if (h.length === 1) o = h; else if (h.length >= 2) { const c = t.decided[d]; o = !c ? [] : c === 'share' ? h : [c]; }
  for (const id of lv) if (t.presets[id] === d && !o.includes(id)) o = o.concat(id);
  if (t.extra[d] && lv.includes(t.extra[d]) && !o.includes(t.extra[d])) o = o.concat(t.extra[d]);
  return o;
}
export const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\b(the|a|an|to|for|of|my|our)\b/g, '').replace(/\s+/g, ' ').trim();

export function newTeam(uid, name, email) {
  return { uid, name, email, team: null, otherName: null, sel: [], keys: {}, codes: {}, joined: {}, skipped: {}, benched: {}, rep: {}, seen: {},
    decided: {}, presets: {}, over: {}, extra: {}, chief: null, mode: 'on', focus: null, quiet: false, onboarded: false,
    log: [], tasks: [], needs: [], nudges: {}, blocked: 0, n: 0, created: Date.now() };
}

// Plain-text view of the team for one AI. This is what it reads before acting.
export function stateText(t, id) {
  const me = aiName(t, id), L = [];
  L.push(`CONDUCTOR TEAM STATE for ${me} (team of ${t.name})`);
  L.push(`Switch: ${t.mode === 'on' ? 'ON. Follow the playbook.' : t.mode === 'pause' ? 'PAUSED. You may read. Do NOT act on team tasks.' : 'OFF. Do not follow Conductor right now. Tell the coach if asked to act.'}`);
  const mine = MISSIONS.filter(d => owners(t, d).includes(id));
  L.push(`Your missions (you may ACT on these): ${mine.length ? mine.map(d => MISSION_NAME[d]).join(', ') : 'none yet'}`);
  L.push('Who owns what:');
  for (const d of MISSIONS) { const o = owners(t, d); L.push(`- ${MISSION_NAME[d]}: ${o.length ? o.map(x => aiName(t, x)).join(' and ') : 'nobody yet'}`); }
  const open = t.tasks.filter(x => x.status === 'open');
  L.push(`Open tasks (${open.length}):`);
  for (const x of open.slice(-15)) L.push(`- "${x.title}" claimed by ${aiName(t, x.id)}${x.d ? ' [' + MISSION_NAME[x.d] + ']' : ''}`);
  L.push('Recently done:');
  for (const w of t.log.slice(-10).reverse()) L.push(`- "${w.text}" by ${aiName(t, w.id)}${w.d ? ' [' + MISSION_NAME[w.d] + ']' : ''}`);
  const nd = (t.nudges && t.nudges[id]) || [];
  if (nd.length) { L.push('Messages from the coach:'); for (const m of nd) L.push(`- ${m}`); }
  L.push('Reminder: read anything, act only on your missions, claim before you start, report when done.');
  return L.join('\n');
}
