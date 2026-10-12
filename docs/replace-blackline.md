# Moving off BlackLine

Most teams move in a day: one afternoon to bring the accounts, checklist and balances across, then the first close run in parallel with BlackLine.

## 1. Export from BlackLine

- **Accounts.** From the account reconciliation list, export to Excel with the account number, account name, account type, risk rating, frequency, preparer, reviewer and due day. Save it as CSV.
- **Tasks.** From the task list (close checklist), export to Excel with the task name, assignee, approver and due day. Save it as CSV.
- Column names depend on how your BlackLine was set up. The importer knows the common ones (see the list in `scripts/close.mjs`, `importers`). For anything else, write a small mapping file like `examples/column-mapping.json`: `{ "<our field>": "<your heading>" }`.

## 2. Export the trial balance from your ledger

Export the trial balance as at each month end as CSV from Xero, MYOB, Business Central, NetSuite or any ledger. The importer reads `Account Code`, `Account`, `Account Type`, `Debit`, `Credit` and, where present, `YTD Debit` and `YTD Credit` (or a single `Balance` column). Balance sheet accounts take the year-to-date figure when it is there; income and expense accounts take the month's movement. Rows starting with "Total" are skipped. Bring in last month too, so the variance check has something to compare against.

## 3. Run the import

```bash
npm run close -- add --type=entity --name="Your Co Ltd" --country=NZ --gst-frequency=two-monthly --gst-anchor-month=2 --materiality=100 --actor=You
npm run close -- import trial-balance --entity="Your Co Ltd" --month=2026-08 --file=tb-aug.csv --actor=You --dry-run
npm run close -- import trial-balance --entity="Your Co Ltd" --month=2026-09 --file=tb-sep.csv --actor=You
npm run close -- import blackline --object=accounts --entity="Your Co Ltd" --file=accounts.csv --actor=You
npm run close -- import blackline --object=tasks --entity="Your Co Ltd" --file=tasks.csv --actor=You
npm run close -- open-period --entity="Your Co Ltd" --month=2026-09 --actor=You
```

Every import runs inside one transaction: a bad row stops it and nothing is written. `--dry-run` shows the counts and writes nothing. Running a trial balance again skips balances that have not changed and updates those that have, so a re-export after late journals is safe; any reconciliation already done on a changed balance shows as moved.

## What maps

| BlackLine | Here |
|---|---|
| Account number, name, type | `accounts.code`, `name`, `kind` (from the type, or from the first digit of the code: 1 asset, 2 liability, 3 equity, 4 income, 5 to 9 expense) |
| Risk rating High / Medium / Low | `risk` high / normal / low |
| Frequency Monthly / Quarterly | `frequency`. Annual comes in as quarterly; change it with `/customise` |
| Preparer, reviewer | `owner`, `reviewer` |
| Task, assignee, approver, due day | `close_templates`, copied into each month by `open-period` |

## What does not carry over

- **Past reconciliations, their attachments and sign-offs.** Keep BlackLine's export or archive for your retention period (seven years: see `docs/compliance.md`). The first month here starts the new history.
- **Transaction matching, intercompany and journal posting to the ledger.** Matching and intercompany are customisations; journals are approved here and posted in your ledger, with the ledger reference recorded.
- **Users and permissions.** Names here are for the history, not logins. Access is whoever can reach the database.
