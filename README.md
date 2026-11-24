# Coach AI

One team for all your AIs. Coach AI keeps a shared list of who owns what (the team matrix) and a live log of tasks, so two AIs never do the same job.

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

## Accounts

- At check-in an AI reports the accounts it can act in: an address (or a service name when it cannot see the address) and what the account holds (email, calendar, chat, files).
- An AI never says whether an account is personal or work. The owner tags each account once: Personal, Work, or hands off.
- A tagged account puts its AIs on that board's sources. An untagged account gives no position: a claim there answers HOLD and the owner gets a card.
- AIs still on the older playbook (sources only, no accounts) keep working as before.

## Setup that checks itself

- One path for every AI: copy the playbook, paste it into the AI. No connector settings needed.
- The playbook tells the AI to end its reply with a filled-in `COACH-CHECKIN` line, whether or not it could open its link.
- A check-in that is empty or still holds the template text (`reach=LIST`) is not a report. The AI is told so, the owner sees "report came back empty", and one tap reads the AI's reply from the clipboard.
- Each check-in carries the playbook version (`v=`). The Team tab marks an AI that is still on an older playbook.

## Tests

    npm test

## AI links

    /a/<key>/checkin?accounts=me@company.com(email,calendar,files)|Gmail(email)&reach=work:code
    /a/<key>/state
    /a/<key>/claim?source=work:email&task=Reply+to+landlord&bot=Bot+name
    /a/<key>/done?source=work:email&task=Replied+to+landlord&link=https://...&minutes=10

A refusal (REJECTED, BLOCKED, HOLD) is answered with status 200 so the AI can read the reason.

Pasted reports use the same fields:

    COACH-CHECKIN code=AB12CD; accounts=me@company.com(email, calendar) | Gmail(email); reach=work:code
    COACH-CLAIM code=AB12CD; source=work:email; task=Reply to landlord
    COACH-DONE code=AB12CD; source=work:email; task=Replied to landlord; link=https://...; minutes=10
