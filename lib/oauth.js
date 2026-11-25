// Sign-in for AI connectors (OAuth 2.1 with PKCE).
// An AI app sends the owner to /oauth/authorize, the owner approves and says which AI it is,
// and the app receives a token. No Coach key ever appears in a chat or in an AI's instructions.
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';

const ACCESS_TTL = 24 * 3600e3, REFRESH_TTL = 180 * 864e5, CODE_TTL = 5 * 60e3;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const b64u = buf => Buffer.from(buf).toString('base64url');
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// A redirect address must be https, a loopback http address, or an app's own scheme.
export function okRedirect(u) {
  let x; try { x = new URL(String(u)); } catch (e) { return false; }
  if (x.hash) return false;
  if (x.protocol === 'https:') return true;
  if (x.protocol === 'http:') return ['localhost', '127.0.0.1', '[::1]'].includes(x.hostname);
  return !['javascript:', 'data:', 'file:', 'vbscript:', 'blob:', 'about:'].includes(x.protocol);
}
const privateIp = ip => {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  const v = ip.toLowerCase(); return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
};
// Which AI is this app, as a first guess for the approval page. The owner confirms or changes it.
export function guessAi(name, redirect) {
  let host = ''; try { host = new URL(redirect).hostname; } catch (e) {}
  const s = `${name || ''} ${host}`.toLowerCase();
  return [['claude', /claude|anthropic/], ['chatgpt', /chatgpt|openai|codex/], ['grok', /grok|x\.ai|xai/], ['gemini', /gemini|google/], ['muse', /muse|meta\b|meta\./], ['perplexity', /perplexity/], ['copilot', /copilot|microsoft/], ['devin', /devin|cognition/]].find(([, re]) => re.test(s))?.[0] || null;
}

export function makeOAuth(d) {
  const { getDoc, putDoc, delDoc, updateDoc, send, sessionUid, hmac, sha, rid, teamDoc, keyDoc, upgrade, AI_ORDER, AI_NAME } = d;
  const clientDoc = id => `oauth/clients/${sha(id)}.json`, codeDoc = c => `oauth/codes/${sha(c)}.json`, tokDoc = t => `oauth/tokens/${sha(t)}.json`;
  const origin = req => { const h = req.headers || {}; return `${String(h['x-forwarded-proto'] || (process.env.VERCEL ? 'https' : 'http')).split(',')[0]}://${String(h['x-forwarded-host'] || h.host || 'localhost').split(',')[0]}`; };
  const cors = res => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, mcp-protocol-version'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); };

  async function readForm(req) {
    let raw = req.body;
    if (raw === undefined) { const chunks = []; let size = 0; for await (const c of req) { size += c.length; if (size > 50000) break; chunks.push(c); } raw = Buffer.concat(chunks).toString('utf8'); }
    if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
    raw = String(raw || '');
    if (/json/i.test(String(req.headers['content-type'] || ''))) { try { return JSON.parse(raw || '{}'); } catch (e) { return {}; } }
    try { const j = JSON.parse(raw); if (j && typeof j === 'object') return j; } catch (e) {}
    return Object.fromEntries(new URLSearchParams(raw));
  }

  // Best-effort brake on unauthenticated writes, per server instance.
  const HITS = new Map();
  const tooMany = (req, max) => { const ip = String((req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '?')).split(',')[0].trim(), now = Date.now(), f = HITS.get(ip); if (!f || now - f.t > 3600e3) { HITS.set(ip, { n: 1, t: now }); return false; } return ++f.n > max; };

  // The app's identity: either registered here, or an https address that serves its own description.
  async function findClient(clientId) {
    const id = String(clientId || '');
    if (!id || id.length > 600) return null;
    if (/^https:\/\//i.test(id)) {
      let u; try { u = new URL(id); } catch (e) { return null; }
      if (u.pathname === '/' || u.hash || u.username || u.password) return null;
      try { const a = await dns.lookup(u.hostname, { all: true }); if (!a.length || a.some(x => privateIp(x.address))) return null; } catch (e) { return null; }
      try {
        const r = await fetch(id, { redirect: 'error', signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' } });
        if (!r.ok) return null;
        const text = await r.text(); if (text.length > 30000) return null;
        const j = JSON.parse(text);
        if (j.client_id !== id || !Array.isArray(j.redirect_uris)) return null;
        return { client_id: id, client_name: String(j.client_name || u.hostname).slice(0, 80), redirect_uris: j.redirect_uris.map(String).filter(okRedirect).slice(0, 20) };
      } catch (e) { return null; }
    }
    const c = await getDoc(clientDoc(id)); return c ? c.data : null;
  }

  const meta = req => { const o = origin(req); return { issuer: o, authorization_endpoint: `${o}/oauth/authorize`, token_endpoint: `${o}/oauth/token`, registration_endpoint: `${o}/oauth/register`, response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none', 'client_secret_post'], scopes_supported: ['coach', 'offline_access'], client_id_metadata_document_supported: true, authorization_response_iss_parameter_supported: true, service_documentation: o }; };
  const resourceMeta = req => { const o = origin(req); return { resource: `${o}/mcp`, authorization_servers: [o], bearer_methods_supported: ['header'], scopes_supported: ['coach'], resource_name: 'Coach AI' }; };
  const challenge = (req, err) => `Bearer resource_metadata="${origin(req)}/.well-known/oauth-protected-resource/mcp"${err ? `, error="${err}"` : ''}`;

  const page = (res, title, body, script, nonce) => {
    res.statusCode = 200; res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
    res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1b1637;font-family:Nunito,system-ui,-apple-system,Segoe UI,sans-serif;color:#241b4d;padding:16px}
main{width:100%;max-width:440px;background:#fff6e5;border-radius:28px;padding:26px 22px}h1{font-size:24px;margin:10px 0 6px;line-height:1.15}p{margin:6px 0 14px;font-weight:600;color:#5b5480;line-height:1.4}
img.c{width:64px;height:64px;display:block}label{display:block;font-weight:800;font-size:13px;margin:10px 0 4px}input{width:100%;padding:13px 14px;border:2px solid #eadfc8;border-radius:14px;font:inherit;font-weight:700;background:#fff}
button{font:inherit;font-weight:800;border:0;border-radius:16px;padding:14px 16px;width:100%;cursor:pointer;margin-top:10px;background:#fff;color:#241b4d;box-shadow:0 4px 0 #eadfc8}
button.p{background:#5b4bff;color:#fff;box-shadow:0 4px 0 #3d2fd1}button:disabled{opacity:.5}.ais{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.ais button{margin:0;padding:12px 8px;display:flex;align-items:center;gap:8px;justify-content:center}
.ais button[aria-pressed=true]{outline:3px solid #5b4bff}.ais img{width:26px;height:26px;object-fit:contain}.err{color:#c62b3d;font-weight:800;min-height:20px}.s{font-size:13px}a{color:#3d2fd1;font-weight:800}
</style></head><body><main>${body}</main>${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`);
  };
  const problem = (res, msg) => page(res, 'Coach AI', `<h1>This connection cannot start.</h1><p>${esc(msg)}</p><p class="s">Close this window and try again from your AI app.</p>`, '', rid(12));

  async function authorize(req, res, q) {
    const P = k => String(q.get(k) || ''), cid = P('client_id'), ru = P('redirect_uri');
    const client = await findClient(cid);
    if (!client) return problem(res, 'Coach does not recognize the app that sent you here.');
    if (!ru || !client.redirect_uris.includes(ru) || !okRedirect(ru)) return problem(res, 'The app sent a return address that it did not register.');
    const back = (extra) => { const u = new URL(ru); for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v); if (P('state')) u.searchParams.set('state', P('state')); u.searchParams.set('iss', origin(req)); return u.toString(); };
    if (P('response_type') !== 'code') { res.statusCode = 302; res.setHeader('Location', back({ error: 'unsupported_response_type' })); return res.end(); }
    if (!P('code_challenge') || (P('code_challenge_method') || 'plain') !== 'S256') { res.statusCode = 302; res.setHeader('Location', back({ error: 'invalid_request', error_description: 'PKCE with S256 is required.' })); return res.end(); }
    const uid = sessionUid(req), nonce = rid(12);
    if (!uid) return page(res, 'Sign in to Coach AI', `<h1>Sign in to Coach AI</h1><p><b>${esc(client.client_name)}</b> wants to join your AI team. Sign in to approve it.</p><label for="e">Email</label><input id="e" type="email" autocomplete="email"><label for="p">Password</label><input id="p" type="password" autocomplete="current-password"><p class="err" id="er" role="alert"></p><button class="p" id="go">Sign in</button><p class="s" style="margin-top:16px">No team yet? <a href="/" target="_blank" rel="noopener">Create one in Coach AI</a>, then come back to this window.</p>`,
      `const $=s=>document.querySelector(s);$('#go').onclick=async()=>{$('#go').disabled=true;$('#er').textContent='';try{const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:$('#e').value,password:$('#p').value})});if(r.ok)location.reload();else{const j=await r.json().catch(()=>({}));$('#er').textContent=j.error||'That did not work.';$('#go').disabled=false}}catch(e){$('#er').textContent='Could not reach Coach.';$('#go').disabled=false}};$('#p').onkeydown=e=>{if(e.key==='Enter')$('#go').click()};`, nonce);
    const cur = await getDoc(teamDoc(uid));
    if (!cur) return problem(res, 'You are signed in, but there is no team on this account yet. Create one in Coach AI first.');
    const t = upgrade(cur.data), guess = guessAi(client.client_name, ru), team = t.sel, rest = AI_ORDER.filter(id => !team.includes(id));
    const pre = guess && AI_ORDER.includes(guess) ? guess : (team.length === 1 ? team[0] : '');
    const csrf = hmac(`oauth.${uid}.${cid}.${ru}.${P('code_challenge')}`);
    const btn = id => `<button data-ai="${id}" aria-pressed="${id === pre}"><img src="/logos/${id}.png" alt="">${esc(id === 'other' && t.otherName ? t.otherName : AI_NAME[id])}</button>`;
    const data = { client_id: cid, redirect_uri: ru, state: P('state'), code_challenge: P('code_challenge'), resource: P('resource'), scope: P('scope'), csrf, ai: pre, deny: back({ error: 'access_denied' }) };
    return page(res, 'Connect to Coach AI', `<h1>Add this AI to ${esc(t.team || 'Team ' + t.name)}?</h1><p><b>${esc(client.client_name)}</b> is asking to join. It will be able to read your team board and report its own tasks, notes and plays. It cannot reach your email, files or any other account through Coach.</p><label>Which AI is this?</label><div class="ais" id="ais">${team.map(btn).join('')}</div>${rest.length ? `<details><summary class="s" style="font-weight:800;cursor:pointer;margin:6px 0">It is a different AI</summary><div class="ais" id="more">${rest.map(btn).join('')}</div></details>` : ''}<p class="err" id="er" role="alert"></p><button class="p" id="ok" ${pre ? '' : 'disabled'}>Approve</button><button id="no">Cancel</button><p class="s" style="margin-top:14px">Signed in as ${esc(t.email || t.name)}. You can remove this AI from the Team tab at any time.</p>`,
      `const D=${JSON.stringify(data).replace(/</g, '\\u003c')},$=s=>document.querySelector(s);document.querySelectorAll('[data-ai]').forEach(b=>b.onclick=()=>{D.ai=b.dataset.ai;document.querySelectorAll('[data-ai]').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#ok').disabled=false});$('#no').onclick=()=>{location.href=D.deny};$('#ok').onclick=async()=>{$('#ok').disabled=true;$('#er').textContent='';try{const r=await fetch('/oauth/approve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(D)});const j=await r.json().catch(()=>({}));if(r.ok&&j.redirect){document.querySelector('main').innerHTML='<h1>Connected.</h1><p>Sending you back to your AI app.</p>';location.href=j.redirect}else{$('#er').textContent=j.error||'That did not work.';$('#ok').disabled=false}}catch(e){$('#er').textContent='Could not reach Coach.';$('#ok').disabled=false}};`, nonce);
  }

  async function approve(req, res) {
    const o = origin(req), from = String(req.headers.origin || '');
    if (from !== o) return send(res, 403, { error: 'This request did not come from Coach.' });
    const uid = sessionUid(req); if (!uid) return send(res, 401, { error: 'Sign in again.' });
    const b = await readForm(req), cid = String(b.client_id || ''), ru = String(b.redirect_uri || ''), ch = String(b.code_challenge || ''), ai = String(b.ai || '');
    if (!safeEq(String(b.csrf || ''), hmac(`oauth.${uid}.${cid}.${ru}.${ch}`))) return send(res, 403, { error: 'This page is out of date. Start again from your AI app.' });
    const client = await findClient(cid);
    if (!client || !client.redirect_uris.includes(ru) || !okRedirect(ru) || !ch) return send(res, 400, { error: 'The app that sent you here is no longer recognized.' });
    if (!AI_ORDER.includes(ai)) return send(res, 400, { error: 'Pick which AI this is.' });
    let key = null, made = null;
    const t = await updateDoc(teamDoc(uid), t => {
      upgrade(t);
      if (!t.sel.includes(ai)) { t.sel = AI_ORDER.filter(id => t.sel.includes(id) || id === ai); if (!t.keys[ai]) { t.keys[ai] = 'cdr_' + rid(21); t.codes[ai] = rid(4).replace(/[-_]/g, 'x').toUpperCase().slice(0, 6); made = t.keys[ai]; } }
      else if (!t.keys[ai]) return false;
      key = t.keys[ai]; t.conn = t.conn && typeof t.conn === 'object' ? t.conn : {}; t.conn[ai] = { at: Date.now(), app: client.client_name };
    });
    if (!t || !key) return send(res, 400, { error: 'That AI could not be added. Open Coach and try from the Team tab.' });
    if (made) await putDoc(keyDoc(made), { uid, id: ai });
    const code = rid(32);
    await putDoc(codeDoc(code), { uid, id: ai, key, client_id: cid, redirect_uri: ru, challenge: ch, resource: String(b.resource || ''), exp: Date.now() + CODE_TTL }, { create: true });
    const u = new URL(ru); u.searchParams.set('code', code); if (b.state) u.searchParams.set('state', String(b.state)); u.searchParams.set('iss', o);
    return send(res, 200, { redirect: u.toString() });
  }

  async function issue(res, base) {
    const access = 'cat_' + rid(32), refresh = 'crt_' + rid(32), now = Date.now();
    await putDoc(tokDoc(access), { ...base, kind: 'access', exp: now + ACCESS_TTL }, { create: true });
    await putDoc(tokDoc(refresh), { ...base, kind: 'refresh', exp: now + REFRESH_TTL, a: sha(access) }, { create: true });
    res.setHeader('Pragma', 'no-cache');
    return send(res, 200, { access_token: access, token_type: 'Bearer', expires_in: Math.floor(ACCESS_TTL / 1000), refresh_token: refresh, scope: 'coach offline_access' });
  }
  async function token(req, res) {
    cors(res); const b = await readForm(req), bad = (e, m, c = 400) => send(res, c, { error: e, error_description: m });
    const cid = String(b.client_id || '');
    if (b.grant_type === 'authorization_code') {
      const code = String(b.code || ''), cur = code ? await getDoc(codeDoc(code)) : null;
      if (!cur) return bad('invalid_grant', 'Unknown or used code.');
      await delDoc(codeDoc(code)); // single use, whatever happens next
      const c = cur.data, ver = String(b.code_verifier || '');
      if (c.exp < Date.now()) return bad('invalid_grant', 'The code expired.');
      if (cid && cid !== c.client_id) return bad('invalid_grant', 'Wrong client.');
      if (String(b.redirect_uri || c.redirect_uri) !== c.redirect_uri) return bad('invalid_grant', 'Wrong redirect address.');
      if (ver.length < 43 || !safeEq(b64u(crypto.createHash('sha256').update(ver).digest()), c.challenge)) return bad('invalid_grant', 'PKCE check failed.');
      return issue(res, { key: c.key, uid: c.uid, id: c.id, client_id: c.client_id });
    }
    if (b.grant_type === 'refresh_token') {
      const rt = String(b.refresh_token || ''), cur = rt ? await getDoc(tokDoc(rt)) : null;
      if (!cur || cur.data.kind !== 'refresh' || cur.data.exp < Date.now()) return bad('invalid_grant', 'Unknown or expired refresh token.');
      if (cid && cid !== cur.data.client_id) return bad('invalid_grant', 'Wrong client.');
      await delDoc(tokDoc(rt)); if (cur.data.a) await delDoc(`oauth/tokens/${cur.data.a}.json`).catch(() => {});
      const { key, uid, id, client_id } = cur.data;
      return issue(res, { key, uid, id, client_id });
    }
    return bad('unsupported_grant_type', 'Use authorization_code or refresh_token.');
  }
  async function register(req, res) {
    cors(res); if (tooMany(req, 30)) return send(res, 429, { error: 'too_many_requests' });
    const b = await readForm(req), uris = Array.isArray(b.redirect_uris) ? b.redirect_uris.map(String).filter(okRedirect).slice(0, 20) : [];
    if (!uris.length) return send(res, 400, { error: 'invalid_redirect_uri', error_description: 'Send at least one https redirect address.' });
    const id = 'cc_' + rid(18), rec = { client_id: id, client_name: String(b.client_name || 'An AI app').replace(/[<>]/g, '').slice(0, 80), redirect_uris: uris, at: Date.now() };
    await putDoc(clientDoc(id), rec, { create: true });
    return send(res, 201, { client_id: id, client_id_issued_at: Math.floor(rec.at / 1000), client_name: rec.client_name, redirect_uris: uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] });
  }

  // A connector token stands for one AI's Coach key. Returns the key, or null when the token is unknown or expired.
  async function keyFor(tok) { const cur = await getDoc(tokDoc(tok)); return cur && cur.data.kind === 'access' && cur.data.exp > Date.now() ? cur.data.key : null; }

  async function route(req, res, parts, q) {
    if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; return res.end(); }
    if (parts[0] === '.well-known') {
      cors(res);
      if (parts[1] === 'oauth-protected-resource') return send(res, 200, resourceMeta(req));
      if (parts[1] === 'oauth-authorization-server' || parts[1] === 'openid-configuration') return send(res, 200, meta(req));
      return send(res, 404, { error: 'Not found.' });
    }
    if (parts[1] === 'authorize' && req.method === 'GET') return authorize(req, res, q);
    if (parts[1] === 'approve' && req.method === 'POST') return approve(req, res);
    if (parts[1] === 'token' && req.method === 'POST') return token(req, res);
    if (parts[1] === 'register' && req.method === 'POST') return register(req, res);
    return send(res, 404, { error: 'Not found.' });
  }
  return { route, keyFor, challenge };
}
