# ADR-0013: A work_for_hire License may reference no Track

Date: 2026-07-17
Status: Accepted (amends ADR-0010)

## Context

The WFH import's first prod run (2026-07-14) proved what the source already
suggested: work-for-hire is mostly bespoke. Charlie writes the song and sends
it to the brand; it almost never enters his catalog. Only 1 of 48 rows
auto-matched a catalog track — the other 47 sat in needs-review, waiting on
the ADR-0010 path: Charlie hand-creating (and immediately archiving) a
placeholder Track per bespoke work before each row could import.

That path fabricates ~47 catalog records for works Charlie doesn't even own —
exactly the catalog-flooding ADR-0010 avoided for batch rows — and it isn't
just a backfill problem: he still does WFH work, so every future WFH deal
would demand another placeholder. The License schema required exactly one
Track; the alternatives were (a) keep the archive-a-placeholder path, (b)
make the Track reference nullable for the work-for-hire case, or (c) attach
all bespoke rows to one shared umbrella "WFH works" track.

## Decision

`license.track_id` becomes nullable, governed by a single invariant enforced
on **every write** (create and update alike): **trackless ⇒ exclusivity
`work_for_hire`**. The reverse does not hold — a WFH grant may still carry a
track ("Click Click"). All transitions fall out of the one rule: a trackless
license may gain a track later (the reduced set of works that do enter the
catalog), a work_for_hire license may clear its track, and a tier change away
from work_for_hire is rejected until a track is picked. The DB carries only
the nullability; the conditional lives in the DTO + service.

Display identity is one fallback everywhere: the title renders **"WFH ×
{Brand}"** (safe — the invariant means the marker can never lie), track
columns show "WFH", and the Report's Track grouping gets a "— WFH" bucket
(like "— Demos") so Σ rows still equals the grand total. Inherently per-track
surfaces — lifetime sales, top tracks, tag trend, sell signal, the collision
warning — simply skip trackless licenses; renewal candidates fall back to
same-Brand.

The import gate relaxes accordingly: a row imports once its **brand** is
resolved. An unambiguous matcher hit (or a track_name completion) links the
track; no-match and ambiguous rows import trackless instead of round-tripping.
Needs-review shrinks to brand-only, and ADR-0010's batch-of-cues umbrella
tracks are no longer minted — those rows just import trackless.

## Consequences

- The 47 blocked rows land without Charlie's track homework: 43 import
  immediately, 4 round-trip for brand only. The $266,337.50 reconciliation
  target is unchanged, and track links become optional post-import garnish
  done in the app (a completion CSV returned after import no longer applies —
  idempotency skips imported rows).
- Trackless fees appear in earnings, the Report, and brand rollups but in
  **no** per-track total — deliberate: they are not catalog income. Linking a
  track later absorbs the fee into that track's lifetime sales from then on.
- Every surface that rendered `track × brand` needed a defined null path
  (~20 dereference sites); the canonical helpers `licenseTitle` /
  `licenseTrackLabel` in @workspace/shared are now the single composition
  point.
- Invoices are untouched: imported WFH rows carry the raw description as
  grant terms, so no historical invoice ever renders the "WFH" fallback line;
  snapshots stay immutable when a track is linked later.
- A future reader will find Licenses with no Track and a "WFH" title: that is
  the domain truth of work-for-hire, not missing data (grilled 2026-07-17).
