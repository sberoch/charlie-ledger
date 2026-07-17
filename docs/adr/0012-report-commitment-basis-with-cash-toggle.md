---
status: accepted
---

# The Report defaults to commitment basis, with cash preserved as a toggle

The Report was the last cash-basis income surface: paid invoices anchored on
`paid_date`, so an unpaid invoice was invisible there. Everything else — lifetime
sales, demo income, tag trend, and (since 2026-07) the dashboard Earnings box —
already counted income on a commitment basis, and CONTEXT.md had long flagged the
Report's migration as planned-but-deferred. Charlie asked for it directly ("count the
unpaid invoices towards the stats"), which triggered this change.

The Report now takes a **basis** parameter, defaulting to **commitment**: live
invoices anchored on **issue date**, paid or not, voided excluded — the same anchor
the Earnings box uses (`invoice.issue_date`, not license existence or
`license.start_date`, both of which also travel under the "commitment" banner
elsewhere). The dashboard and the Report therefore agree per window by default.
**Cash** stays available as a toggle with the old semantics untouched: paid invoices
anchored on paid date.

## Why a toggle instead of an outright flip

Cash basis is not dead weight. Charlie defined the Report as "the cash side" when the
domain language was set, and a sole-proprietor tax return is normally filed on cash
basis — the Report is his natural year-end pull. An outright flip would have left no
surface in the app able to answer "what money actually landed this year." The toggle
follows the existing `includeLeads` precedent: one query flag, default chosen for the
common case, the other view one click away.

Splitting into two separate reports was rejected: the groupings, royalties section,
exports, and layout are identical — only the invoice filter differs — so two surfaces
would be a maintenance fork over a single `where` clause.

## Consequences

- **Bad debt no longer self-corrects — and currently has no removal path.** Under
  cash basis an invoice that never got paid simply never counted. Under commitment
  basis it counts from its issue date forever: there is no written-off status, and
  no bare void exists (ADR-0002 — void & reissue always mints a replacement live
  invoice). ADR-0002 already accepted this exposure for lifetime sales and deferred
  a License-level **cancellation** concept as the escape hatch; this migration
  extends the exposure to the Report and raises that concept's priority if a deal
  ever genuinely dies unpaid. Until then, the dashboard's unpaid/overdue
  receivables figure is the early-warning surface, and the cash toggle is the view
  that excludes the dead money.
- The result DTO's `paidInvoiceCount` was renamed `invoiceCount` — under commitment
  basis the counted invoices are not necessarily paid. Labels on the web page, CSV,
  and PDF say "invoices" under commitment and "paid invoices" under cash.
- Every export (CSV and PDF) now states the basis it was pulled on — an export
  travels without its UI, and the same window can legitimately produce two different
  totals.
- The royalties section is untouched by the basis: a royalty payment records money
  already received on its own date (ADR-0009); the distinction does not exist for it.
- The leads overlay (ADR-0005) blends into either basis; under commitment its
  double-count caveat is now symmetrical (a lead splitting an invoiced fee
  double-counts against the same window the invoice itself lands in).
- The usage-type fan-out and its over-sum note (ADR-0004) apply unchanged under both
  bases.
