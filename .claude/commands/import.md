---
description: "Bring a trial balance, or BlackLine accounts and tasks, across from an export"
---

Read CLAUDE.md. Run `npm run close -- import trial-balance --entity=... --month=YYYY-MM --file=tb.csv --actor=... --dry-run` for a ledger trial balance, or `npm run close -- import blackline --object=accounts|tasks --entity=... --file=export.csv --actor=... --dry-run` for a BlackLine export. Add `--mapping=file.json` when headings differ. Ask for any value you do not have; never guess one.

Always run with --dry-run first and show the counts. Read docs/replace-blackline.md. If headings differ, write a mapping file rather than editing the export.

Every write needs --actor: the name of the person doing it, for the history.

Never send anything. Drafts go to drafts/ for a person to send. Never invent a balance, an explanation or an approval.
