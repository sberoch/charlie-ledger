# ADR-0011: Pre-platform demos import as first-class Demos — open, hold none

Date: 2026-07-14
Status: Accepted

## Context

The Demo entity was scoped **forward-only** at launch: "pre-platform demos are
not tracked" (CONTEXT.md, `demo.dto.ts`). That was a scoping call made when no
historical export existed. Charlie's 2020–2026 QuickBooks export of the "Demo"
product group (364 rows, $118,141.37) is the fourth historical backfill, after
licenses (ADR-0008), royalties (ADR-0009), and WFH (ADR-0010). Like the WFH
export it carries only a payer, a date, a freeform description, and an amount.

Two decisions were contested:

1. **What entity?** Importing as Licenses (the ADR-0010 move) would inflate
   lifetime sales with money that isn't licensing and zero out six years of
   demo income — the three-stream separation (License fees / Demo fees /
   royalties) exists precisely to keep these honest. The rows *are* demos and
   the model has a first-class entity for them.
2. **What status?** Every historical hold lifted years ago. `converted` keeps
   the dashboard clean but fabricates Charlie's judgment (Conversion is *his*
   decision that an idea became a library Track — true for an unknown subset).
   `open` is the only status the import can assert honestly, but the
   dashboard's **Ready-to-reuse panel is uncapped** and sorts oldest-first, so
   ~364 pre-platform demos will dominate it.

## Decision

Reverse the forward-only rule. Every source row mints exactly one **Demo** —
`status: open`, `hold: none` (holdEndsAt = writtenAt = transaction date) —
plus its auto-issued Invoice, born Paid on the transaction date. Fees import
verbatim, multi-round rows and adjacent fees (edits, vocalist, conform, the
"Yessian Demos" lump) included, one row = one umbrella Demo — the ADR-0010
ethos replayed. The working name is the raw description (BOM-stripped); the
Brand is curated per row in `import-demos.ts`; unresolvable rows round-trip
through a needs-review CSV (brand_name column only — Demos reference no
Track, so the entire track-matching machinery drops out). "Interval Media
LLC" is merged into the "Interval" payer at import time (same music house
renamed in QuickBooks; payers have no merge feature, so a wrong split would
be permanent).

## Consequences

- Σ imported fees equals the QuickBooks export total ($118,141.37) to the
  penny; Demo income on the dashboard now reflects all six years.
- **The Ready-to-reuse panel floods with ~364 pre-platform demos, oldest
  first.** Accepted deliberately: falsifying `converted` on 364 records to
  keep a panel tidy inverts the ledger's faithfulness ethos. If the flood
  bothers Charlie in practice, the fix is a dashboard product decision
  (recency window / exclude imported), made later with real usage behind it.
- `openCount` jumps by ~364 and `convertedCount` stays honest at whatever
  Charlie actually converts, at his leisure, in the app.
- Charlie's private working names now include payment scribbles ("HGTV Demo
  (Paid 12/17)") — deliberate; the curated Brand carries the clean name.
- The glossary's "forward-only" clause is amended rather than deleted: demos
  are still created forward-only *in the app*; the import is the one
  sanctioned exception.
