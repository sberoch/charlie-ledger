---
status: accepted
---

# Leads are a deliberately unreconciled personal ledger

Charlie needs to record money against a Brand, License, or Demo in his own
milestones — or in self-invented monthly splits — so his cashflow *looks* even,
independent of the system's commitment-basis sales and its single-`paid_date`
cash Report. We model this as a **Lead**: a freeform `(date, description, amount)`
row with optional, independent links to a Brand, License, and/or Demo (his house
word — not a sales prospect; see CONTEXT.md). We deliberately wall it off from the
rest of the ledger.

## What "walled off" means

- A Lead is **never reconciled** against a License fee or an Invoice amount. Three
  $9k Leads under a $30k License draw no warning.
- A Lead **never feeds** lifetime sales, demo income, the dashboard, or the Report.
  It is a private record only.
- Loosely validated: only date/description/amount are required, amounts may be
  negative, the three links are independent with no cross-checks.
- **Freely edited and hard-deleted** — no snapshot, no history, no void. The inverse
  of an Invoice.

## Why this is worth recording

This breaks the integrity rigor the rest of the ledger follows on purpose — gapless
invoice numbering (ADR-0001), invoice immutability via void-&-reissue (ADR-0002),
and the careful commitment-vs-cash split (ADR-0004). A future reader finding a money
table with no constraints and no reconciliation will assume it's a mistake and try
to wire it in. It is not a mistake; it is a fast-capture scratch record, not a
source of financial truth.

In particular: the word "payments" in CONTEXT.md's opening line is **not** this.
Leads are explicitly **not** a reconciled payments/installments model. If a real
need for invoice-reconciled payments arises later, it should be a new concept, not
an extension of Leads.

## Considered alternative

Model real payments as installments reconciled against each Invoice and folded into
the cash-basis Report. Rejected for MVP: it couples a private smoothing habit to the
financial source of truth, and many Leads are fictional splits that correspond to no
real receipt — they would corrupt cash reporting if mixed in.
