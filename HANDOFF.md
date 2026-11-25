# Coach AI: handoff

Live: https://conductor-xi.vercel.app (Vercel, auto-deploys from `main`). Formerly "Conductor".
Flow whiteboard (every step per AI, with sample screens): https://claude.ai/artifact/CZJzA97GtpymY1hNFQFHQX

## What the product is
Coach AI coordinates one person's AI assistants (ChatGPT, Claude, Grok, Gemini, Muse and others).
Each AI checks in with what it can act on, claims a task before acting, reports it done, shares notes on
one whiteboard and proposes "plays". The owner sees one board. Coach runs no model itself: it stores and ranks.

## Layout
- `api/index.js` one Vercel serverless function: owner API (`/api/*`, session cookie), agent links (`/a/<key>/*`,
  `/api/agent/*` with Bearer key), MCP connector (`/mcp`, `/mcp/<key>`), and routing to OAuth.
- `lib/oauth.js` OAuth 2.1 + PKCE for the connector: discovery metadata, dynamic client registration, client ID
  metadata documents, approval page (`/oauth/authorize`), `/oauth/approve`, `/oauth/token` with rotating refresh tokens.
- `lib/logic.js` rules: boards (personal/work), sources (`board:source`), ownership, conflicts, accounts, `PLAYBOOK` version (7).
- `lib/store.js` JSON docs in Vercel Blob (private) with ETag optimistic concurrency; local files in dev.
- `app.src.js` the whole client (vanilla JS). `build.py` assembles `public/index.html` from `ui/base.html` (CSS + helpers) and `app.src.js`.
  Never edit `public/index.html` by hand. Run `python3 build.py` after any client change.
- `vercel.json` rewrites `/api`, `/a`, `/mcp`, `/oauth`, `/.well-known` to the function.
- `tests/coach.test.js` unit tests (`npm test`, 9 passing).

## Run locally
`CONDUCTOR_DEV_DIR=/tmp/coach PORT=3100 node dev.js` then open http://localhost:3100. No env vars needed in dev.
Production uses `BLOB_READ_WRITE_TOKEN` and `SESSION_SECRET` (set in Vercel).

## State today
Built and tested locally only (simulated AI app, never a real one):
- Sign-in connector: one address for every AI, `https://conductor-xi.vercel.app/mcp`. Unauthenticated calls get
  401 + `WWW-Authenticate` pointing at `/.well-known/oauth-protected-resource/mcp`. Tokens (`cat_…`) map to that AI's key.
  Old key auth (`cdr_…` as Bearer or in the path) still works.
- Approval page asks the signed-in owner which AI is connecting, then issues a code.
- On first `coach_state` through the connector, the reply carries a SETUP block (check in, ping, schedule check-ins, first notes).
- A connection that only ever reads is flagged `readonly` in `verdict()`.
- Whiteboard, plays, scheduled check-ins (`sync`, `board?new=1`, cadence light/standard/live), diagnostics, archive-on-delete.
- Onboarding is connector-first for claude, grok, gemini, muse, chatgpt (`CONN` in `app.src.js`); others paste a playbook.

Not verified with any real AI app. This is the main risk.

## The task
The owner finds the current connect screen (three written instructions + "Listening") too clumsy.
Build and prove the pre-approval flow on the whiteboard, one AI at a time, in this order:

1. **Prove the sign-in with real apps before polishing UI.** Claude first, then Grok.
   - Claude one-tap link (pattern taken from another product, untested for us):
     `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Coach%20AI&connectorUrl=<url-encoded /mcp address>`
   - Grok: grok.com/connectors > New Connector > Custom > paste the address.
   - Expected: the app sends the owner to Coach's approve page. If it fails, fix `lib/oauth.js` first.
2. **One button per AI** replacing the instruction list: "Connect Claude" opens the link above; Grok/Gemini open their
   connector page with the address already copied; Muse copies a sentence to paste in a Muse chat.
   Show one step at a time and advance automatically: the server sets `t.conn[id]` at approval and `view()` returns `conn`.
3. Then Gemini, Muse, ChatGPT. Their menu names come from third-party guides and are untested.
   ChatGPT personal plans may allow read-only custom connectors; do not hard-code plans, rely on the `readonly` detection.
4. Later, not now: directory submissions (Claude, ChatGPT, Gemini preview). Needs own domain, privacy policy page,
   docs page, support email, safety annotations on every MCP tool, and a demo team for reviewers.

## Rules the owner has set
- Never ask for, print, log or commit a real agent key. Test with a newly created test agent.
- Do not reset or wipe team data. If stored data must change shape, show the change first.
- Error bodies and logs never contain a full key.
- Onboarding must be one clear step at a time, with as few steps and as little reading as possible.
- Do not add rules or behavior the owner did not ask for; propose first.
- He prefers short, plain answers and a visual when a flow is involved.

## Known gaps
- Raw agent keys are stored in the team doc. Rate limits are per server instance.
- Expired OAuth token/code docs are never cleaned up.
- A play's command text loses apostrophes.
- Coach cannot wake an AI; the scheduled check-in on the AI's side is the only "back" channel.
