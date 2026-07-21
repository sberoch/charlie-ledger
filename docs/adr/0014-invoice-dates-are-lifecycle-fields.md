---
status: accepted
---

# Invoice dates are lifecycle fields; only the billing snapshot is immutable

ADR-0002 froze the whole invoice at birth: the issue date was stamped "today" by the
issuer, no mutation endpoint existed, and the sole correction — void & reissue — itself
re-stamped today. A mis-dated invoice was therefore *permanently* uncorrectable, and
since ADR-0012 made `issue_date` the anchor of every commitment-basis window, an invoice
stamped on the day Charlie got around to logging a deal books its income in the wrong
month. Charlie asked for the ability to change the issued date (or to tie it to the
license date).

## Decision

Invoice fields split into two classes:

- **Billing snapshot** — number, bill-to block, amount, description. Immutable, exactly
  as before; void & reissue (ADR-0002) remains the only correction. These are the fields
  that identify the document sent to a payer.
- **Lifecycle dates** — issue date, due date, paid date. Mutable on a **live** invoice.
  The issue date is chosen at birth in the License/Demo create drawer (defaulting to
  today, freely backdatable) and editable afterwards. Issue and due dates are edited
  together in one dialog: changing the issue date **re-suggests** due = issue + 30 in
  the form but never applies it silently, so a custom due date is visible before it is
  overwritten. The paid date already worked this way (`POST`/`DELETE :id/paid`), so the
  class existed — issue and due dates join it. Voided invoices stay untouchable.

Tying the issue date to `license.start_date` (Charlie's alternative) was rejected:
start date is the grant's commercial start, not the billing date; it is editable, so a
tie either mutates the invoice on license edits or silently drifts; demos have no start
date at all; and ADR-0012 already weighed `start_date` as the commitment anchor and
chose `issue_date`.

Void & reissue keeps stamping today — with dates freely editable on the replacement,
an issue-date override parameter there is redundant.

## Consequences

- **Backdating re-dates income across commitment windows** (ADR-0012): a re-pulled
  month can differ from a previously exported one. That is the point of the feature,
  not a defect — exports already state their basis and pull date.
- The gapless number sequence (ADR-0001) is no longer chronological once backdating
  exists. Its guarantee is completeness, never order.
- The PDF renders issue and due dates, so editing after sending makes the ledger differ
  from the document the payer holds. Accepted for a one-person shop: the snapshot
  fields, which identify the bill, still cannot drift.
- The overdue derivation is untouched (`due_date < today`, unpaid) — but a date edit
  can flip an invoice's Overdue status. The paired-edit dialog makes that visible at
  the moment of the change.
- A dates-only PATCH surface is added to the invoices API; snapshot fields remain
  constitutionally absent from it.
