# Gapless sequential invoice numbering via an atomic counter row

## Status

accepted

## Context

Invoices must carry sequential numbers with **no gaps** — an accounting/legal-style
requirement, not cosmetic. The obvious tool, a Postgres `SEQUENCE`, does **not** satisfy
this: sequences advance even when the surrounding transaction rolls back, leaving permanent
holes.

## Decision

A dedicated single-row **`counter`** table holds `next_invoice_number`. Allocating a number
is done **inside the same transaction as the invoice insert**: `SELECT ... FOR UPDATE` the
counter row, write its value onto the new invoice, then increment the counter. Because
allocation and insert commit (or roll back) atomically, an aborted create returns its number
and no gap appears. The row lock serialises the rare concurrent creates — negligible for a
one-person shop.

The canonical number is stored as an integer `invoice.number` (unique). Any prefix/padding
(e.g. `INV-0001`) is a **PDF-rendering** concern, never stored. The starting value lives in
the counter row, so numbering can begin wherever Charlie's existing sequence left off.

## Consequences

- **Invoices are never hard-deleted.** Deleting a numbered invoice would reintroduce a gap,
  defeating the whole mechanism. Cancellation is modelled as a **`voided`** status that
  retains the number. See [[invoice]] in CONTEXT.md.
- Invoice creation must always run through the transactional allocation path; no code may
  insert an invoice with an ad-hoc or `MAX(number)+1` value.

## Considered alternatives

- **Postgres `SEQUENCE` / `bigserial`** — rejected: gaps on rollback violate the no-gaps
  requirement.
- **`MAX(number) + 1` at insert** — rejected: races under concurrency and still needs
  explicit locking to be safe; the counter row makes the lock target explicit and cheap.
