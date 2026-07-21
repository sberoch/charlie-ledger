# Every License and Demo is born with one live Invoice; corrections are void-and-reissue

## Status

accepted — the immutability of invoice *dates* is superseded by ADR-0014 (issue/due/paid
dates are lifecycle fields; the billing snapshot alone stays immutable)

## Context

The schema originally modelled the Invoice as *optional* (at most one per source, via full
unique indexes on `invoice.license_id` / `invoice.demo_id`). Two pressures broke that:

1. Charlie's workflow is invoice-first — every deal he logs gets billed, in one sitting.
   The validated prototype even conflated the two ("New License" drawer drafting an
   invoice number). An optional invoice step is friction with no real use case.
2. Invoice snapshots (bill-to, amount) are immutable by design, so the only correction
   mechanism is voiding. Under a **full** unique index, a voided invoice permanently
   blocks its License from ever carrying another one — a voided invoice meant a
   permanently unbillable deal, and `onDelete: restrict` blocked deleting the License too.

## Decision

- Creating a License or Demo **creates its Invoice in the same transaction** (number
  allocated per ADR-0001). No draft state, no separate "create invoice" step, no
  uninvoiced sources. The UI reveals the number only after save.
- The unique indexes become **partial**: `WHERE voided_at IS NULL` — at most one **live**
  invoice per source; voided invoices accumulate as history.
- The only correction action is **"Void & reissue"**, atomic: void the old invoice (it
  keeps its number, drops out of receivables and reports) and issue a replacement with a
  fresh snapshot of the source's current Payer block and fee, under the next number.
  A **bare void does not exist** — it would recreate the unbillable-source state.
- A **Paid** invoice cannot be voided; clear its paid date first (manual field, manual fix).

The invariant: *every License/Demo has exactly one live Invoice, plus zero or more voided
ones.*

## Consequences

- Editing a License's fee or payer never mutates the live invoice's snapshot; the edit UI
  warns and offers void & reissue.
- Licenses and Demos can never be hard-deleted (always at least one invoice, RESTRICT).
  A deal that falls through entirely keeps its License and live invoice, and its fee stays
  in lifetime sales (commitment basis). If that ever hurts, a License-level cancellation
  concept is the escape hatch — deliberately deferred.
- Schema delta to apply: convert `invoice_license_idx` / `invoice_demo_idx` to partial
  unique indexes (`WHERE voided_at IS NULL`).

## Considered alternatives

- **Bare void** (no automatic reissue) — rejected: leaves a License with no live invoice,
  which under "always invoiced" is a contradiction, and reopens the deleted-license story.
- **Keep invoice optional** — rejected: no real workflow creates an uninvoiced License;
  optionality just adds a second step and a dangling "not yet invoiced" state to police.
