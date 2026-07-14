# ADR-0010: Every WFH sales row imports as a License — kill fees and add-on fees included

Date: 2026-07-14
Status: Accepted

## Context

Charlie's 2020–2026 QuickBooks export of the "Final" product group (work-for-
hire sales, 48 rows, $266,337.50) is the third historical backfill, after
licenses (ADR-0008) and royalties (ADR-0009). Unlike the license export, the
source carries no Brand/Track/Usage/Term/Exclusivity columns — only a payer, a
date, a freeform description, and an amount — and several rows are not grants
at all in the strict sense:

- **Kill fees** ("Zyrtec - Kill Fee", "Amazon - Click Click (Kill Fee)") —
  payment for work that was rejected; no use was ever granted.
- **Add-on fees** ("Beautyrest Edits", "Additional Edits", radio edits,
  cutdowns, "Papa Johns Extension") — money attached to an existing deal.
- **Partial payments** ("Chevy (First Payment)") — an installment, with no
  sibling row for the rest.

The alternatives were: (a) import every row as a License; (b) skip the
non-grant rows (~$11k of history); (c) invent a lighter "fee adjustment"
entity for them.

## Decision

Every row mints exactly one License plus its auto-issued, born-Paid Invoice —
verbatim amounts, kill fees and add-ons included. Terms default to
**all media / perpetual / work_for_hire**; a description that explicitly
states its own term or exclusivity wins (curated per row in the script; the
raw description survives as the License's grant terms and in its private
note). The Brand, absent from the source, is curated per row; unclear rows
round-trip through a needs-review CSV extended with a **brand_name** column.
All other ADR-0008 mechanics (unambiguous-only track matching, never creating
tracks, `[import:<key>]` idempotency, one transaction, no reminder rules, no
renewal links) carry over unchanged in a sibling script, `import-wfh.ts`.

## Consequences

- Σ imported fees equals the QuickBooks export total to the penny — the
  backfill is auditable against the source, and lifetime sales (commitment
  basis) reflect everything Charlie actually earned against each work.
- A future reader will find oddities like a perpetual work-for-hire License
  named "Zyrtec - Kill Fee": that is deliberate. The License is the ledger's
  only income-bearing grant record; faithfulness to the money beat conceptual
  purity for a one-off backfill (Charlie: "all financial info should be
  there", grilled 2026-07-14).
- An add-on fee attributed to the same track as its parent deal slightly
  inflates that track's per-license history (several small "licenses"), but
  keeps its lifetime-sales total honest.
- Batch-of-cues rows ("Batch of 40", "Cues 1-26") resolve to **one umbrella
  track** via needs-review rather than splitting — row↔invoice traceability
  with QuickBooks is preserved; the catalog is not flooded with $25 records.
- Rows Charlie never completes stay unimported, and the ledger total then
  undershoots QuickBooks — visible in the final reconciliation, not silent.
