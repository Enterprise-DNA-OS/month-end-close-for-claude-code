---
description: "Add a reconciling item to a reconciliation"
---

Read CLAUDE.md. Run `npm run close -- add-item --account=... [--period=...] --description=... --amount=... --dated=YYYY-MM-DD [--kind=timing|adjustment] --actor=...`. Ask for any value you do not have; never guess one.

Timing items clear next month (unpresented cheques, deposits in transit). Adjustments need a journal. Use the ledger sign.

Every write needs --actor: the name of the person doing it, for the history.

Never send anything. Drafts go to drafts/ for a person to send. Never invent a balance, an explanation or an approval.
