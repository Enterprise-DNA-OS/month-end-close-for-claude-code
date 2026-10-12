# Month-End Close for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What is holding up the close | `/attention` |
| Where each open month stands | `/close-status` |
| Who has what | `/owner-load` |
| Start a new month | `/open-period` |
| Checklist tasks | `/tasks-due`, then `/complete` and `/sign-off` |
| Reconciliations to do | `/recs-due`, then `/reconcile`, `/add-item`, `/clear-item` |
| Review a reconciliation | `/review` or `/reject` |
| Differences and old reconciling items | `/differences` |
| Balance movements to explain | `/flux`, then `/explain` |
| Manual journals | `/journals`, `/journal`, `/approve-journal`, `/post-journal`, `/cancel-journal` |
| Accruals to reverse | `/reversals-due`, then `/reverse` |
| Close the month | `/close-period` |
| How fast we close | `/close-trend` |
| The auditor's requests | `/pbc`, `/pbc-provide`, `/pbc-accept`, `/draft-auditor-update` |
| Rule checks | `/compliance` |
| How long to keep records | `/retention` |
| The weekly review | `/weekly-review` |
| The close report | `/draft-close-report` |
| Variance commentary | `/draft-flux-commentary` |
| Look something up | `/account`, `/period`, `/trial-balance`, `/search`, `/history` |
| Add a record | `/add`, `/log` |
| Bring BlackLine or ledger data across | `/import` |
| Back up | `/export` |
| Change how it works | `/customise` |
| A new report | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run close -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Close rules

- Amounts are in the entity's currency (NZD for NZ, AUD for AU) and are debit minus credit. Never add NZD to AUD.
- A reconciliation is reviewed, a task signed off and a journal approved by a different person from whoever prepared it. Never act for the operator under someone else's name.
- Never change a balance by hand to make a reconciliation agree. Balances come from the ledger; a difference is explained with a reconciling item or fixed with a journal in the ledger.
- Never write a variance explanation the account owner has not given. Ask.
- Never close a period by marking work done that is not done.
- Read docs/compliance.md before reporting rule checks. They are prompts, not legal or tax advice.
- The demo data is fictional. Never present it as real.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off BlackLine.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/blackline
