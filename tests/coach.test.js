// End-to-end checks of what an AI and the owner can do, against the real handler with file storage in a temp folder.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.CONDUCTOR_DEV_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-'));
const { default: handler } = await import('../api/index.js');
const L = await import('../lib/logic.js');
const server = http.createServer(handler).listen(0);
const base = `http://localhost:${server.address().port}`;
test.after(() => server.close());

let n = 0;
async function team(sel) {
  const r = await fetch(base + '/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Mike', email: `t${++n}@example.com`, password: 'password1' }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const postRaw = (p, b) => fetch(base + '/api/' + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(b) });
  const post = async (p, b) => (await postRaw(p, b)).json();
  const st = await post('save', { sel });
  const ai = id => async (action, q = {}) => { const r = await fetch(`${base}/a/${st.keys[id]}/${action}?${new URLSearchParams(q)}`); return { code: r.status, text: await r.text() }; };
  return { post, postRaw, state: async () => (await fetch(base + '/api/state', { headers: { cookie } })).json(), ai, codes: st.codes };
}
const ESE = 'boss@company.com(email, calendar, chat, files)';

test('accounts are parsed from what an AI sends', () => {
  assert.deepEqual(L.parseAccounts('Boss@Company.com(email, calendar) | Gmail(email files) | Hotmail'), [
    { addr: 'boss@company.com', label: '', has: ['email', 'calendar'] }, { addr: '', label: 'Gmail', has: ['email', 'files'] }, { addr: '', label: 'Hotmail', has: ['email'] }]);
});

test('template text is not a report', async () => {
  const t = await team(['claude', 'chatgpt']), gpt = t.ai('chatgpt');
  const r = await gpt('checkin', { accounts: 'ACCOUNTS', reach: 'LIST' });
  assert.equal(r.code, 200); assert.match(r.text, /^NOT RECORDED/); assert.match(r.text, new RegExp('COACH-CHECKIN code=' + t.codes.chatgpt));
  const s = await t.state();
  assert.ok(s.joined.chatgpt); assert.deepEqual(s.said.chatgpt, []); assert.equal(s.accts.length, 0);
});

test('a pasted line fixes an empty report', async () => {
  const t = await team(['claude', 'chatgpt']);
  await t.ai('chatgpt')('checkin', { reach: 'LIST' });
  const r = await t.post('paste', { text: `Saved. COACH-CHECKIN code=${t.codes.chatgpt}; v=3; accounts=${ESE} | Gmail(email); reach=work:code`, id: 'claude' });
  assert.equal(r.results[0].ok, true); assert.equal(r.results[0].id, 'chatgpt');
  assert.equal(r.state.accts.length, 2); assert.equal(r.state.ver.chatgpt, 3); assert.deepEqual(r.state.said.chatgpt, ['work:code']);
});

test('guided paste only applies the selected agent’s check-in', async () => {
  const t = await team(['claude', 'grok']);
  const checkin = code => `**COACH-CHECKIN** **code**=\`${code}\`; v=7; reach=work:code`;
  const note = `COACH-NOTES code=${t.codes.claude}; notes=seen: This line should be ignored`;
  const paste = text => t.postRaw('paste', { id: 'claude', text, checkinOnly: true });

  for (const text of [checkin(t.codes.grok), 'COACH-CHECKIN reach=work:code', note]) {
    const rejected = await paste(text);
    assert.equal(rejected.status, 400);
    assert.ok((await rejected.json()).error);
  }
  const before = await t.state();
  assert.deepEqual(before.joined, {});
  assert.deepEqual(before.trace, []);
  assert.deepEqual(before.notes, []);

  const accepted = await paste([note, checkin(t.codes.claude), note].join('\n'));
  assert.equal(accepted.status, 200);
  const { results, state } = await accepted.json();
  assert.deepEqual(results.map(({ id, kind, ok }) => ({ id, kind, ok })), [{ id: 'claude', kind: 'CHECKIN', ok: true }]);
  assert.deepEqual(state.said.claude, ['work:code']);
  assert.deepEqual(state.notes, []);
  assert.equal(state.trace.length, 1);
  assert.equal(state.trace[0].via, 'paste');
});

test('an untagged account gives no position, a tagged one does', async () => {
  const t = await team(['claude', 'chatgpt']), c = t.ai('claude');
  assert.match((await c('checkin', { v: 3, accounts: ESE + ' | Gmail(email)' })).text, /Not tagged yet/);
  assert.match((await c('claim', { source: 'work:email', task: 'Reply to the GC' })).text, /^HOLD/);
  let s = await t.state();
  assert.deepEqual(s.reach.claude, []); assert.equal(s.accts.find(a => a.addr).guess, 'work'); assert.equal(s.accts.find(a => !a.addr).guess, 'personal');
  s = await t.post('acct', { k: s.accts.find(a => a.addr).k, tag: 'work' });
  assert.deepEqual(s.reach.claude.sort(), ['work:calendar', 'work:chat', 'work:email', 'work:files']);
  assert.match((await c('claim', { source: 'work:email', task: 'Reply to the GC' })).text, /^CLAIMED/);
  assert.match((await c('claim', { source: 'personal:calendar', task: 'Book the dentist' })).text, /^BLOCKED/);
  s = await t.post('acct', { k: s.accts.find(a => !a.addr).k, tag: 'personal', addr: 'me@gmail.com' });
  assert.ok(s.reach.claude.includes('personal:email'));
  await c('checkin', { v: 3, accounts: ESE + ' | Gmail(email)' }); // "Gmail" again must land on the account the owner named
  s = await t.state(); assert.equal(s.accts.length, 2); assert.equal(s.accts.find(a => a.addr === 'me@gmail.com').tag, 'personal');
});

test('hands off removes the position', async () => {
  const t = await team(['claude', 'chatgpt']), c = t.ai('claude');
  await c('checkin', { accounts: ESE });
  let s = await t.state(); s = await t.post('acct', { k: s.accts[0].k, tag: 'off' });
  assert.deepEqual(s.reach.claude, []);
  assert.match((await c('claim', { source: 'work:email', task: 'Reply to the GC' })).text, /^BLOCKED/);
});

test('two AIs on one account make a conflict the owner settles', async () => {
  const t = await team(['claude', 'chatgpt']);
  await t.ai('claude')('checkin', { accounts: ESE }); await t.ai('chatgpt')('checkin', { accounts: 'boss@company.com(email)' });
  let s = await t.state(); assert.equal(s.accts.length, 1); assert.deepEqual(s.accts[0].by, ['chatgpt', 'claude']);
  s = await t.post('acct', { k: s.accts[0].k, tag: 'work' });
  assert.deepEqual(s.conflicts, ['work:email']);
  assert.match((await t.ai('claude')('claim', { source: 'work:email', task: 'Reply to the GC' })).text, /^HOLD/);
  s = await t.post('save', { pick: { 'work:email': 'claude' } });
  assert.match((await t.ai('claude')('claim', { source: 'work:email', task: 'Reply to the GC' })).text, /^CLAIMED/);
  assert.match((await t.ai('chatgpt')('claim', { source: 'work:email', task: 'Reply to the GC too' })).text, /^BLOCKED/);
});

test('an AI on the older playbook keeps working', async () => {
  const t = await team(['claude', 'grok']), g = t.ai('grok');
  assert.match((await g('checkin', { reach: 'personal:social, work:email' })).text, /^Checked in/);
  assert.match((await g('claim', { source: 'work:email', task: 'Reply to the GC' })).text, /^CLAIMED/);
  const s = await t.state(); assert.equal(s.ver.grok, undefined); assert.equal(s.pv, L.PLAYBOOK);
});

test('refusals are readable and links survive double encoding', async () => {
  const t = await team(['claude', 'chatgpt']), c = t.ai('claude');
  await c('checkin', { reach: 'work:code' });
  for (const task of ['x', 'REAL SHORT TITLE']) { const r = await c('claim', { source: 'work:code', task }); assert.equal(r.code, 200); assert.match(r.text, /^REJECTED/); }
  assert.match((await c('claim', { source: 'work%3Acode', task: 'Build account tagging' })).text, /^CLAIMED.*Work Code/);
  assert.match((await c('done', { source: 'work%3Acode', task: 'Build account tagging', minutes: 5 })).text, /under Work Code/);
});

test('a new account after setup asks the owner once', async () => {
  const t = await team(['claude', 'chatgpt']);
  await t.post('save', { onboarded: true });
  await t.ai('claude')('checkin', { accounts: ESE });
  let s = await t.state(); const need = s.needs.find(x => x.t === 'tag'); assert.ok(need);
  s = await t.post('need', { k: need.k, v: 'work' });
  assert.equal(s.needs.length, 0); assert.equal(s.accts[0].tag, 'work');
});
