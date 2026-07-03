---
status: accepted
---

# Historical license import: unambiguous-only matching with a completion round trip

The 2020–2026 QuickBooks backfill (`apps/api/src/scripts/import-licenses.ts`) links each
sheet row to an **existing** catalog Track and imports one License + one born-Paid Invoice
per row. The matcher (word-boundary, case-insensitive, with containment subsumption) **only
acts when exactly one track matches**. Everything else — no match, several matches (some
rows genuinely license up to five tracks under one amount), or an unresolvable completion —
is written to a **needs-review CSV** that Charlie fills in (`track_name` column) and hands
back via `--completions`; a re-run imports those rows and re-emits what still isn't
resolvable. The import **never creates a Track**: a completion must name an existing catalog
track exactly (case-insensitive), and a genuinely missing track is created in the app first.
Idempotency rides an `[import:<sha256-16>]` token in each license's private notes, keyed on
the row's raw `date|num|brand|track|amount` (verified collision-free); re-runs skip imported
rows, so the whole flow is safely re-runnable as completions trickle in.

## Considered alternatives

- **Longest-match-wins** (the original plan): silently assigns a multi-track row's entire
  fee to whichever track has the longest *name* — invisible misattribution of lifetime
  sales. Rejected once a dry run surfaced 14 such rows.
- **Splitting a multi-track row into N licenses at fee ÷ N**: truthful per-track attribution
  but fabricates invoices and amounts that never existed; the Invoice domain (ADR-0001/0002)
  exists to prevent exactly that.
- **Letting a completion mint the missing Track**: rejected to keep one invariant with no
  asterisks — the catalog is only ever grown deliberately in the app, and a typo in the CSV
  can't silently create a near-duplicate track.

## Consequences

- The import writes licenses/invoices directly (not through `LicensesService.create`), but
  invoice numbers still come from the one gapless allocator (`InvoiceIssuerService.issue`)
  inside the same transaction.
- The broadcast-royalty rule (ADR-0007) deliberately does **not** fire: all 8 historical
  broadcast rows would be born overdue and flood the timeline with noise.
- Imported licenses have `renewedToId = null`, so the dashboard renewal rate reads
  near-zero until Charlie links chains in-app. Honest: unlinked history is unknown, and
  Renewal is a manual annotation (CONTEXT.md).
- Blank cells are interpreted per Charlie's answers: term → 1 year, exclusivity →
  non-exclusive, the one "6 months, Perpetual" combo → perpetual; raw strings are preserved
  in the notes provenance line, and the sheet's full Track text becomes the grant terms (and
  therefore the invoice description, ADR-0003).
- Every invoice is born Paid on its transaction date; the few still-open 2026 ones are
  un-marked in the app (clear-paid), not by re-reading a corrected sheet.
- `usage_type` gained `all_media` / `film_tv` / `radio` and `term_length` gained the
  sub-six-month and five-year values the history actually used; `internet` stays (dropping
  an enum value is a destructive migration with no benefit).
