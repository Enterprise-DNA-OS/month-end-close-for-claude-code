<h1 align="center">Month-End Close for Claude Code</h1>

<p align="center">
  <strong>The open-source month-end close that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your BlackLine data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=blackline">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/blackline?utm_source=github&utm_medium=readme&utm_campaign=blackline">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-blackline">Instead of BlackLine</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Month-End Close for Claude Code does the job you pay BlackLine for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the BlackLine dashboard cannot.

BlackLine publishes no price list. Buyer contract data gathered by ERP Research puts the average around US$77,000 a year, with a range from roughly US$17,500 to US$340,000, and implementation adds another US$5,000 to US$50,000 or more ([ERP Research, BlackLine pricing](https://erpresearch.com/erp-add-ons/financial-close/blackline/pricing), checked 12 October 2026).

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=blackline).

It is for finance teams in New Zealand and Australia, and the accounting firms and outsourced CFOs who close the books for clients. It holds the close checklist, the balance sheet reconciliations with their reconciling items, manual journals and their approvals, the variance commentary and the auditor's request list. It does not replace your ledger: Xero, MYOB, Business Central or NetSuite stay where they are, and you bring the trial balance in each month.

```
$ npm run close -- attention
  kind        period                       item                                 detail
  ----------  ---------------------------  -----------------------------------  ---------------------------------------------------------------------------------------------
  task        Kauri Foods Ltd 2026-09      Stocktake variance posted            Sione, 5 business days late
  reconcile   Kauri Foods Ltd 2026-09      1100 Trade debtors                   Mere, prepared, 5 business days late
  reconcile   Kauri Foods Ltd 2026-09      2000 Trade creditors                 Sione, prepared, balance moved, 5 business days late
  reconcile   Kauri Foods Ltd 2026-09      2200 GST control                     Mere, prepared, 5 business days late
  reconcile   Kauri Foods Pty Ltd 2026-09  1100 Trade debtors                   Priya, prepared, 5 business days late
  reconcile   Kauri Foods Pty Ltd 2026-09  2000 Trade creditors                 Priya, not started, 4 business days late
  difference  Kauri Foods Ltd 2026-09      1100 Trade debtors                   Unexplained difference (250.00)
  difference  Kauri Foods Ltd 2026-09      2000 Trade creditors                 Reconciling item open 107 days: Disputed freight invoice 88213, Coastline Carriers (-1200.00)
  variance    Kauri Foods Ltd 2026-09      1100 Trade debtors                   Moved 55240.40 with no explanation
  variance    Kauri Foods Ltd 2026-09      2000 Trade creditors                 Moved -43364.55 with no explanation
  variance    Kauri Foods Ltd 2026-09      2200 GST control                     Moved -5395.45 with no explanation
  variance    Kauri Foods Ltd 2026-09      6200 Freight                         Moved 22400.00 with no explanation
  journal     Kauri Foods Ltd 2026-09      PRE-INS                              draft, out of balance by 1000.00
  reversal    Kauri Foods Ltd 2026-09      ACC-PWR                              Posted in Kauri Foods Ltd 2026-08 to reverse; no reversal entered
  auditor     Kauri Foods Ltd              PBC-02                               Fixed asset register and depreciation schedule, 6 days overdue
  rule        Kauri Foods Ltd 2026-08      2500 Westpac term loan               Period closed with this balance never reconciled
  rule        Kauri Foods Ltd 2026-09      2200 GST control                     Return due 2026-10-28 (16 days); GST control account not reconciled
```

(Fictional demo data. Trimmed.)

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/month-end-close-for-claude-code.git
cd month-end-close-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`, or ask "what is holding up the close?"

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything that needs doing now: late tasks and reconciliations, differences, variances, journals, reversals, auditor requests, rule checks |
| `/close-status` | How far through the close each open period is, against the target close date |
| `/owner-load` | What each person still has to do in this close |
| `/open-period` | Open a new month and copy in the close checklist |
| `/tasks-due`, `/complete`, `/sign-off` | The close checklist: what is late, mark it done, sign it off as a second person |
| `/recs-due` | Reconciliations not yet reviewed, or whose balance moved after review |
| `/reconcile`, `/add-item`, `/clear-item` | Prepare a reconciliation against the bank statement, aged ledger or stocktake, with reconciling items |
| `/review`, `/reject` | Review a reconciliation as a second person, or send it back with a reason |
| `/differences` | Unexplained differences, balances that moved, reconciling items older than 60 days |
| `/flux`, `/explain` | Movements over the threshold against last month, and the explanation for each |
| `/journals`, `/journal`, `/approve-journal`, `/post-journal`, `/cancel-journal` | Manual journals: enter, approve as a second person, record the ledger reference |
| `/reversals-due`, `/reverse` | Last month's accruals still to reverse, and the reversal drafted |
| `/close-period` | Close a month, refused while anything is open |
| `/close-trend` | Business days each month took to close, against the target |
| `/pbc`, `/pbc-provide`, `/pbc-accept` | The auditor's request list |
| `/compliance` | The close records against the cited rules |
| `/retention` | How long each month's records must be kept |
| `/weekly-review` | The close review, drafted from four commands |
| `/draft-close-report` | The close report for the finance lead or board, to drafts/ |
| `/draft-flux-commentary` | Variance commentary for the management accounts, to drafts/ |
| `/draft-auditor-update` | Where the auditor's request list stands, to drafts/ |
| `/entities`, `/accounts`, `/periods`, `/templates`, `/account`, `/period`, `/trial-balance`, `/search`, `/history` | Read the records |
| `/add`, `/log` | Add entities, accounts, checklist templates, balances and auditor requests; note on an account |
| `/import` | Bring a trial balance from your ledger, and accounts and tasks from a BlackLine export |
| `/export` | Back up every record to one JSON file |
| `/customise` | Change a field, a rule or a document in plain language |
| `/new-view` | Add a read-only HTML view |
| `/help` | Every command |

Every command runs `npm run close -- <command>` underneath, with `--json` for machines. Names match without case; a partial id works; an ambiguous name lists the candidates and exits 1. Every write needs `--actor` (a name for the history, not a login). Nothing here sends anything.

## How the close works here

- **Balances** come from your ledger's trial balance each month. Balance sheet accounts hold the closing balance; income and expense accounts hold the month's movement. Amounts are debit minus credit, so liabilities and income are negative.
- **Reconciliations** are needed for every active balance sheet account with a balance (or marked high risk): monthly ones every month, quarterly ones at quarter end. Unexplained = ledger balance less the supporting balance less open reconciling items. Review is refused while the unexplained amount is above the entity's materiality, while no evidence is recorded, or by the person who prepared it. If the ledger balance changes after review, the reconciliation shows as moved and is done again.
- **Due dates** are business days after month end (Monday to Friday; add public holidays with `/customise`).
- **Variances** need an explanation when a balance moves by at least the entity's amount and percentage threshold against last month.
- **A period closes** only when every checklist task is finished, every required reconciliation is reviewed, every journal is posted or cancelled and every variance is explained.

## Ten questions your close records answer

Each one runs today on the demo data. BlackLine has its own reports; these are answered from records you own, in plain language, without building one.

1. What is holding up this month's close, and whose desk is it on? `attention`, `owner-load`
2. How many business days did each month take to close, against our target? `close-trend`
3. Which reconciliations were reviewed and then the balance moved? `recs-due`
4. Which reconciling items have been carried for more than 60 days? `differences`
5. Which balances moved more than our threshold with nobody explaining why? `flux`
6. Which accruals from last month have not been reversed? `reversals-due`
7. Which journals are out of balance or waiting on approval? `journals`
8. Which months were closed with an account never reconciled? `compliance`
9. Is the GST control account reconciled before the return is due? `compliance`
10. What is the auditor still waiting on, and who owns it? `pbc`

## Your first hour: ten things to ask for

1. Put our name and logo on the close report and reconciliation sheets (`brand.json`).
2. Add our entity with its GST cycle, materiality and target close day.
3. Import last month's and this month's trial balance from our ledger, as a test run first.
4. Import our account owners and reviewers and our close checklist from the BlackLine export.
5. Open this month and show me the close status.
6. Reconcile the bank account against this statement balance.
7. Show me every balance that moved more than ten percent.
8. Draft the variance commentary for the board pack.
9. Add the auditor's request list from this email.
10. Change the materiality to $50 for bank accounts only (`/customise`).

## Instead of BlackLine

Moving takes a day for most teams. Export the account list (with preparers, reviewers, risk and frequency) and the close task list from BlackLine as Excel, save each as CSV, and export the trial balance from your ledger. Then:

```bash
npm run close -- import blackline --object=accounts --entity="Your Co Ltd" --file=accounts.csv --actor=You --dry-run
npm run close -- import blackline --object=tasks --entity="Your Co Ltd" --file=tasks.csv --actor=You --dry-run
npm run close -- import trial-balance --entity="Your Co Ltd" --month=2026-09 --file=tb.csv --actor=You --dry-run
```

Drop `--dry-run` when the counts look right. Column headings vary with how BlackLine was set up: a small mapping file handles that (see `examples/column-mapping.json`). Reconciliation history and attachments stay in BlackLine's archive; keep the export for your retention period. The full guide: [docs/replace-blackline.md](docs/replace-blackline.md).

## Architecture

```
month-end-close-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  views.json, documents.json the read-only views and the close report and reconciliation sheets
  examples/                 a sample trial balance, BlackLine exports and a column mapping
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Month-End Close for Claude Code for your business, migrates your BlackLine data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=blackline)
- Read more: [enterprisedna.co/omni/instead-of/blackline](https://enterprisedna.co/omni/instead-of/blackline?utm_source=github&utm_medium=readme&utm_campaign=blackline)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
