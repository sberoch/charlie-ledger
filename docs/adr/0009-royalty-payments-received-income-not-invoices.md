---
status: accepted
---

# Royalty payments are received income, not invoices

Charlie pursues royalties for broadcast work; PROs and unions (BMI, AFM, SAG) — and
occasionally a music house or individual passing money through — pay them out on their
own schedule. His QuickBooks history records every such payout as an **Invoice** (the
2020–2026 export literally labels each row "Invoice"), so the obvious move was to ride
the platform's Invoice rails. We deliberately did not: royalties are a new top-level
**Royalty payment** entity — a flat `(date, payer, description?, amount)` row of money
*already received* — and the word "invoice" stays reserved for documents Charlie issues.

## Why not the Invoice rails

An Invoice here is a *request for payment*: born from exactly one License or Demo
(enforced by a DB check), gapless-numbered under a row lock (ADR-0001), rendered to a
locked PDF, snapshotted, immutable with void-&-reissue as the only correction
(ADR-0002), and carrying a derived Unpaid/Overdue/Paid lifecycle. Royalty payouts have
none of these properties — nobody receives a document, there is no source License for a
quarterly BMI lump, and the money has already landed when the record is born. Forcing
them in would have consumed gapless numbers on documents never issued, faked a
receivables lifecycle, and broken the exactly-one-source invariant.

## Consequences

- The **Payer** entity is reused as the royalty counterparty ("whoever actually pays");
  royalty-only Payers simply leave their bill-to block empty.
- Royalty payments are **fully mutable** (edit/hard-delete, like Leads) — but unlike
  Leads they *do* feed reporting: a separate Royalties section in the Report and a
  third dashboard figure (Royalty income), never mixed into the Sales groupings, whose
  partition math (ADR-0004) stays intact. The Report summary becomes Sales / Royalties
  / Total income.
- Royalties are inherently **cash basis**; the commitment-vs-cash split that divides
  Lifetime sales from the Report does not exist for them.
- The QuickBooks invoice numbers in the historical export are dropped on import — they
  are QB bookkeeping artifacts, not domain data.
