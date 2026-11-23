# Conductor

One team for all your AIs. Conductor keeps a shared list of who owns what (the team matrix) and a live log of tasks, so two AIs never do the same job.

## How it works

- The coach signs up, picks their AIs, and gives each one a **playbook** (a prompt with that AI's own key).
- An AI that can open web links checks in by itself. A chat-only AI replies with a one-line report the coach pastes back.
- AIs read the team state, claim tasks before starting, and report finished items. Conductor refuses claims on missions another AI owns and flags duplicates for the coach.
- Reading is open: every AI can see everything. The matrix only decides who acts.
- There is always an off switch: ON / PAUSE / OFF is included in every team-state read.

## Layout

- `public/index.html` the whole app (no build step)
- `api/index.js` one serverless function: `/api/*` for the coach's browser, `/a/<key>/*` for AI links
- `lib/store.js` storage (Vercel Blob in production, local files in development)
- `lib/logic.js` missions, ownership rules, the text an AI reads

## Run locally

    npm install
    npm run dev      # http://localhost:3000, data in .devdata/

## Deploy (Vercel)

Needs a private Blob store connected to the project (`BLOB_READ_WRITE_TOKEN`) and a `SESSION_SECRET` environment variable.

## AI links

    /a/<key>/checkin?good=email,writing&reach=inbox,docs
    /a/<key>/state
    /a/<key>/claim?mission=email&task=Reply+to+landlord
    /a/<key>/done?mission=email&task=Replied+to+landlord&link=https://...&minutes=10

Pasted reports use the same fields:

    CONDUCTOR-CHECKIN code=AB12CD; good=email, writing; reach=inbox
    CONDUCTOR-CLAIM code=AB12CD; mission=email; task=Reply to landlord
    CONDUCTOR-DONE code=AB12CD; mission=email; task=Replied to landlord; link=https://...; minutes=10
