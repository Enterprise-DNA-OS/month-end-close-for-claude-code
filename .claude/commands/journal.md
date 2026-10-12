---
description: "Enter a manual journal for approval"
---

Read CLAUDE.md. Run `npm run close -- journal --period=... --reference=... --description=... --kind=accrual|prepayment|reclass|correction --lines="code:amount;code:amount" [--reverses-next] [--evidence=...] --actor=...`. Ask for any value you do not have; never guess one.

Lines are code:amount, debits positive and credits negative, separated by semicolons. Show the lines back before running it.

Every write needs --actor: the name of the person doing it, for the history.

Never send anything. Drafts go to drafts/ for a person to send. Never invent a balance, an explanation or an approval.
