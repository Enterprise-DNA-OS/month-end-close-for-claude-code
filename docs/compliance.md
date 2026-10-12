# Rules the compliance command checks

`npm run close -- compliance` runs the `compliance_gaps` view, and `npm run close -- retention` runs the `retention` view. Each rule below says where it comes from, what a gap looks like in the records, and what a person does about it. These are prompts for someone to check, not legal or tax advice. When a rule changes, update this file and the view together, through `/customise`.

Sources checked 12 October 2026.

## RECORDS-EXPLAIN: a closed month should be explained by its records

- **New Zealand.** Companies Act 1993, section 194: the board must ensure accounting records are kept that correctly record the company's transactions and will enable its financial position to be determined with reasonable accuracy at any time. https://www.legislation.govt.nz/act/public/1993/0105/latest/whole.html
- **Australia.** Corporations Act 2001, section 286: a company must keep written financial records that correctly record and explain its transactions and financial position and performance, and would enable true and fair financial statements to be prepared and audited. https://www.legislation.gov.au/C2004A00818/latest/text
- **In the data:** a closed period with a balance sheet account that needed reconciling and was never reviewed, or a reviewed reconciliation whose unexplained amount is above the entity's materiality.
- **Fix:** reconcile the account for that month (open the record with `/customise` if the period must stay closed), or record why the balance is right.

## RECORDS-EVIDENCE: a reviewed reconciliation needs its support

- **New Zealand.** Inland Revenue, Record keeping: keep all business records, including electronic ones, for at least 7 tax years; books of account are kept with the invoices, receipts and statements that support their entries. https://www.ird.govt.nz/managing-my-tax/record-keeping
- **Australia.** ATO, Record keeping for business: records must explain the transactions and generally be kept for five years. https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/record-keeping-for-business
- **In the data:** a reviewed reconciliation with no `evidence` recorded. The review command refuses this; the check catches records imported or changed by hand.
- **Fix:** record where the statement, aged ledger or count sheet is kept.

## GST-RETURN: reconcile the GST control account before the return is due

- **New Zealand.** Inland Revenue, Filing GST: a GST return and payment are due on the 28th of the month after the end of the taxable period, except that a period ending 31 March is due 7 May and a period ending 30 November is due 15 January. https://www.ird.govt.nz/gst/filing-and-paying-gst-and-refunds/filing-gst
- **Australia.** ATO, Due dates for lodging and paying your BAS: a monthly BAS is due on the 21st of the following month; quarterly BAS are due 28 October, 28 February, 28 April and 28 July. https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/business-activity-statements-bas/due-dates-for-lodging-and-paying-your-bas
- **In the data:** a month that ends a GST period for the entity (set by `gst_frequency` and `gst_anchor_month`) where the account marked `gst_control` is not reviewed, or moved after review. It shows the due date and the days left.
- **Assumptions to check:** due dates are not moved for weekends or public holidays, and the extra time for lodging online or through a tax or BAS agent is not added. If yours differ, change `gst_due` with `/customise`.

## Retention: how long each month's records are kept

- **New Zealand.** Tax Administration Act 1994, section 22, as explained by Inland Revenue: at least 7 years after the end of the income year. The view counts seven years from the end of the income year, assuming a 31 March balance date. https://www.ird.govt.nz/managing-my-tax/record-keeping
- **Australia.** Corporations Act 2001, section 286(2): financial records are retained for seven years after the transactions covered. The ATO's general rule is five years. The view uses seven. https://www.legislation.gov.au/C2004A00818/latest/text
- Nothing is deleted automatically. The view only says when a month's records may go.

## Controls the database enforces itself

These are not law. They are what an auditor asks about at a close, built into the schema so they cannot be skipped:

- A reconciliation is reviewed by a different person from whoever prepared it, and not while the unexplained amount is above materiality or no evidence is recorded.
- A task with a reviewer is signed off by a different person from whoever completed it.
- A journal must balance, is approved by a different person from the preparer, and needs the ledger reference to be marked posted. A cancelled journal needs a reason.
- A period cannot close while tasks, reconciliations, journals or variance explanations are open. A closed period's balances do not change on import.
