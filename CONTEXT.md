# Foltz Ledger

A single ledger for Charlie Foltz's one-person music licensing business: it holds the
licenses, demos, invoices, and payments around a catalog of ~300 owned tracks, the canonical
source of which now lives in the platform itself. Replaces a patchwork of QuickBooks, Disco,
and mental tracking.

## Language

### Counterparties

**Brand**:
The entity a track is licensed *for* / used by (A24, Audi, Glossier). An analytical
dimension only — it carries a name and a required **Category**, and is what sales are
grouped and trended by. A Brand does not necessarily pay; it never carries billing details.
_Avoid_: Client, customer, account.

**Category**:
The market a Brand competes in *for Charlie's purposes* (Automotive, Fashion,
Streaming · TV). Every Brand has exactly one — even conglomerates get the single market
that matters here. A curated, evolving list: created on the fly, renameable, never a fixed
enum. Powers per-category performance rollups and the **exclusivity collision warning** —
an advisory (never blocking) alert when a new License would clash with an active
`category_exclusive` grant in the same Category on that Track, or with any active
`full_exclusive` / `work_for_hire` grant.
_Avoid_: Industry, vertical, market segment.

**Payer**:
Whoever actually pays Charlie — the billing counterparty an Invoice is addressed to, or
the source of a [[royalty payment]]. Carries the bill-to block (name, address, email;
royalty-only Payers like BMI simply leave it empty). May be the Brand itself or an agency
acting for it — **direct payment by the Brand is the common case**, modelled as a separate,
same-named Payer record (the Brand entity itself never carries billing details).
A **Demo**'s commissioning "music house" is a Payer in that role — Music House is not a
separate entity. PROs/unions (BMI, AFM, SAG) are Payers in the royalty role.
_Avoid_: Music House (as a distinct entity), royalty source (as a distinct entity),
bill-to, customer.

### Catalog & licensing

**Track**:
A piece of music in Charlie's catalog. Created, edited, and removed directly in the platform
(the Disco mirror was retired before launch); seeding only handles the initial catalog load.
Its **name** is the natural key — **case-insensitively unique**. Tags are platform-owned
**Tags** assigned on the Track (pick-or-create), not an attribute baked into the Track.
`status` (active / archived) is a manual catalog state, changed only via the **Archive /
Unarchive** action — never an edit field. A Track can be **archived** (reversible; retires it
from the default catalog view) at any time, but **hard-deleted only when it carries no
Licenses** — its financial history blocks deletion, so archive is the path for tracks with
history. Deleting a Track clears its tag assignments and nulls any Demo conversion link that
points at it; Licenses block the delete before it is ever reached. See ADR-0006.
_Avoid_: Song, asset.

**Track import**:
A recurring bulk-add of catalog [[track]]s from a Disco CSV metadata export. The track name
is read off the `TRACKTITLE` column; **mood [[tag]]s** are mined from the free-text `COMMENTS`
column. The CSV is parsed **in the browser**; titles are trimmed, blanks dropped, and the set
**deduped case-insensitively both within the file and against the existing catalog**, so
re-importing the same export is a safe no-op. **Best-effort**, not all-or-nothing: a collision
(or a race) silently skips that row rather than aborting the batch. Explicitly **not** a
resurrection of the retired Disco mirror — it is a one-way manual insert that mints ordinary
platform-owned Tracks; Disco neither owns nor syncs them afterward. The catalog's `name`
natural key still governs, but the import path **relaxes the 120-char create cap** (trusting
the source export).
Tag mining is an **allow-list match, never pick-or-create**: every word in `COMMENTS` is a
candidate, but only those already present in the platform's curated **mood vocabulary** (the
seeded Tag list) are attached — genres, instruments, tempo, and licensing junk are dropped by
simply never being in the vocabulary. The vocabulary is deliberately **lean** (it omits
near-universal positives like *cool / fun / happy* that would blanket the catalog and
discriminate nothing) and is Settings-managed like any Tag, so it grows or shrinks there.
Tags attach only to **newly imported** tracks; a skipped (already-existing) track is left
untouched.
_Avoid_: Sync, mirror, Disco import (it does not couple to Disco), backfill.

**License import** (historical backfill):
The one-off load of Charlie's 2020–2026 QuickBooks license history. Each source row mints
exactly one [[license]] plus its auto-issued [[invoice]]; original QuickBooks invoice numbers
are not preserved (they survive only as a private note — the gapless sequence governs, and
historical multi-line invoices arrive as separate single-line ones). The matcher links rows
to existing catalog [[track]]s and **only acts when unambiguous**: a row matching no track —
or more than one (some rows license several tracks at once) — is exported to a
**needs-review CSV** that Charlie completes with the one canonical track name and hands back
for a re-run. The import **never creates Tracks** — a genuinely missing track is created in
the app first. Blank cells are interpreted, not rejected: blank term ⇒ 1 year, blank
exclusivity ⇒ non-exclusive, the lone "6 months, Perpetual" ⇒ perpetual (raw strings kept in
the private note). Every imported invoice is born **Paid on its transaction date**; Charlie
un-marks the few still-open ones in the app. Deliberately fires **no reminder rules** and
links **no [[renewal]]s** — renewal chains, brand categories, and open invoices are Charlie's
post-import follow-ups. Idempotent: re-running skips already-imported rows, never duplicates.
_Avoid_: sync, migration, track import (a different, recurring flow).

**WFH import** (historical backfill):
The one-off load of Charlie's 2020–2026 QuickBooks work-for-hire ("Final") sales export — a
sibling of the [[license import]] with a weaker source: no Brand / Track / Usage / Term /
Exclusivity columns, only a date, a payer, a freeform description, and an amount. Every row
still mints exactly one [[license]] plus its auto-issued Paid [[invoice]] — **kill fees,
edit/cutdown fees, extensions, and partial payments included**: they are money earned against
a work, so they import verbatim (Σ imported fees equals the QuickBooks export total).
Terms default to **all media / perpetual / work-for-hire**, but a description that states its
own term or exclusivity **wins over the default** (raw string kept in the private note, as
ever). The Brand is curated per row by the import itself (the source names only the paying
music house); a row whose brand can't be named confidently round-trips through the
needs-review CSV, which for this import also carries a **brand_name** column. Track matching,
the never-creates-Tracks rule, the needs-review round trip, batch-of-cues rows resolving to
**one canonical (umbrella) track**, no reminder rules, no renewal links, gapless renumbering,
born-Paid invoices, and idempotency all inherit from the [[license import]]. Bespoke
works Charlie no longer owns are created (and typically archived) by him in the app before
completion — never by the import.
_Avoid_: buyout import, demo import (a kill fee here is a license, not a demo), sync.

**Demo import** (historical backfill):
The one-off load of Charlie's 2020–2026 QuickBooks demo sales export — the fourth
backfill, and the one that reversed the [[demo]]'s original forward-only scoping
(see ADR-0011). Every source row mints exactly one Demo plus its auto-issued,
born-Paid [[invoice]] — multi-round rows and adjacent fees (edits, vocalist,
conform, unitemized lumps) included, one row = one umbrella Demo, so Σ imported
fees reconciles to the QuickBooks total. Imported Demos are born **open with hold
none** — their holds lifted years ago, and [[conversion]] stays Charlie's decision,
never the import's, at the accepted cost of flooding the Ready-to-reuse panel with
history. The working name is the raw description verbatim (payment scribbles
included); the **Brand is curated per row by the import** (the source names only
the paying music house), with unresolvable rows round-tripping through a
needs-review CSV carrying only a **brand_name** column — Demos reference no
[[track]], so the license/WFH track-matching machinery has no counterpart here.
Payers match case-insensitively and are created with empty bill-to blocks; the two
QuickBooks spellings of one music house merge into a single [[payer]] at import
time (payers cannot be merged later). No reminder rules, gapless renumbering,
born-Paid invoices, and `[import:key]` idempotency inherit from the
[[license import]] family.
_Avoid_: sync, migration, WFH import (a sibling with a Track dimension this one
lacks).

**Tag**:
A curated label in Charlie's catalog vocabulary (cinematic, electronic, warm). Platform-owned
and deliberately not an enum. Case-insensitively unique. **Created** either from Settings or
inline while editing a Track (pick-or-create — typing an unknown name mints it); **renamed and
deleted** only from Settings.
A Track carries zero or more; the same Tag is shared across Tracks
(a many-to-many). Deleting a Tag removes it from every Track that carried it (confirm-then-
cascade). Powers the tag-chip filter and the **Tag trend**. Was previously owned by Disco;
ownership moved to the platform when the Disco mirror was retired.
_Avoid_: Genre, keyword, label.

**License**:
A grant of a Track's use to a Brand under specific terms (one or more **Usage Types**, term
length, exclusivity, fee, dates) plus optional freeform **Grant terms**. References exactly
**one Track** (required), one **Brand**, and one **Payer**.
A Track has many Licenses — its history. Lifetime sales roll up a Track's License fees.
Its **end date** is the source of truth for expiration (seeded from start + term length,
but editable); a `perpetual` term has no end date and never expires.
_Avoid_: Deal, contract, sale.

**Usage Type**:
A medium a License grants the Track for. Closed set: `broadcast`, `digital_media`,
`social_media`, `internet`, `internal`. A License carries **one or more** — the atomic unit
stays a single medium; it is the License's relationship to it that is many.

**Exclusivity Tier**:
How exclusive a License's grant is. Closed set: `non_exclusive`, `category_exclusive`,
`full_exclusive`, `work_for_hire`. Note `work_for_hire` is conceptually an ownership axis,
not an exclusivity one, but is modelled as a tier for MVP (matches the mockup).

**Demo**:
A cue Charlie writes on commission for a music house, pitched for a Brand. Always
commissioned — has a Brand, a **Payer** (the music house), a fee, and a working name (e.g.
"Walmart_SpringSale_v1a"), all required. Carries a **hold** (none / 3mo / 6mo) counting
from when it was written; the dashboard surfaces it once the hold lifts so the idea can be
reused. Originally forward-only (pre-platform demos untracked); reversed 2026-07-14 — the
2020–2026 QuickBooks demo history backfills as first-class Demos (see [[demo import]]).
_Avoid_: Pitch, cue, spec track.

**Conversion**:
Charlie's decision that a Demo's idea will become a library Track. Flips the Demo's status
`open → converted` — a standalone decision that requires **no** Track to exist yet. He may
**afterwards** create the Track directly in the platform and **optionally** link it for his
own reference; the link is never required to convert, and conversion never auto-creates a Track.
_Avoid_: Promote, publish.

**Renewal**:
A manual, forward-only pointer from an expiring License to the new License that replaces it
(`renewed_to_id`). It is an annotation only — renewals are created as ordinary new Licenses;
nothing is auto-copied or auto-created.
_Avoid_: Extension, succession.

**Expiration urgency**:
Display bands derived from a License's end date, never stored: **urgent** (fewer than 14
days left), **expiring soon** (14–60 days), **active** (more than 60 days), **expired**
(past). A perpetual License is always active.

**Sell signal** ("SELL THIS"):
A derived inventory flag on a [[track]], never stored: it fires when the Track is **active**
and its **reference date** is more than **three years** past. The reference date is the
Track's **last licensed date** (its most recent [[license]] start date), falling back to the
Track's **creation date** when it has never been licensed. It marks dead catalog inventory —
a track that hasn't moved in years — nudging Charlie to sell it. Surfaced as a red ("rust")
badge appended **after** the tag chips wherever a Track's tags show, but it is **not a [[tag]]**
and has no relationship to the catalog tag vocabulary — it merely shares their visual slot.
An archived Track never shows it.
_Avoid_: Stale tag, sell tag (it is not a Tag), dead-stock flag.

**Hold**:
The wait on a Demo (none / 3mo / 6mo) before Charlie may reuse its idea as a library Track,
counted from when the demo was written. When the hold **lifts** the Demo becomes eligible to
convert and surfaces on the dashboard — lifting is **not** a status change; only Conversion
moves a Demo off `open`.
_Avoid_: Lockout, embargo.

### Billing

**Invoice**:
A request for payment Charlie issues, rendered to a locked-layout PDF, with a gapless
sequential number. Each invoice bills **exactly one source — either one License or one
Demo** (never both, never neither). Issued **automatically when its source is created** —
there is no separate "create invoice" step, no draft state, and no uninvoiced License or
Demo. The number is assigned at creation and revealed after save, never before. It snapshots the bill-to block from that source's
**Payer** — and the source's **Grant terms** — at creation time, so later edits never alter
historical invoices. Its
display status (Paid / Unpaid / Overdue / Voided) is **derived**, not stored — from
`paid_date`, `due_date`, and `voided_at`. An invoice is never hard-deleted or edited; the
only correction is **void & reissue** — one atomic action that voids it (number retained,
excluded from receivables and reports) and issues a replacement with a fresh snapshot and
the next number. A source therefore always has exactly one **live** invoice plus zero or
more voided ones; a Paid invoice cannot be voided. See ADR-0001 / ADR-0002.
_Avoid_: Bill, receipt.

**Grant terms**:
Optional freeform scope language on a License or Demo (e.g. cut counts, use/territory
wording, airdate-anchored term) that the platform does not model as structured fields.
Snapshotted into the Invoice's description at issue; when empty, the description falls back
to an auto-composed line (License: track × brand · usage · exclusivity; Demo: brand, with
the working name in parens). Re-snapshotted on void & reissue.
_Avoid_: Notes, scope, contract text.

**Fee**:
The agreed amount on a License or a Demo. Income rollups derive from fees, **not** from
invoices: lifetime sales = Σ License fees; demo income = Σ Demo fees (tracked separately).
_Avoid_: Price (UI label), amount, cost.

### Royalties

**Royalty payment**:
A record of royalty income Charlie *received* — royalties are pursued mainly for
`broadcast` work and paid out by PROs/unions (BMI, AFM, SAG) or occasionally a music house
or individual passing them through — the counterparty is a **[[payer]]** (reused, not a new
entity). Always a **flat single line**: (date, payer, freeform description, amount) —
description **optional** (a bare BMI row is self-explanatory), amount may be zero (a
royalty event that paid nothing is still faithful history). A
BMI payout that arrives split Writers/Publishing is simply two rows; there are no line
items, no structured writers-vs-publishing kind (the description carries it), and no
quantity (only the final amount). **Fully mutable, like a [[lead]]**: edited and
hard-deleted freely — no void, no snapshot; reports are live pulls, so a correction
simply supersedes. Deliberately **not an [[invoice]]**: nothing is issued,
numbered, or rendered to PDF, and there is no Unpaid/Overdue lifecycle — the money has
already landed when the record is born. Carries optional independent links to a Brand,
Track, and/or License (`set null` on delete, the same trio pattern as a [[lead]]) — BMI
lumps stay bare; an AFM "Kia – Believer" payment can point at its license. The links are
context, **not** a reporting foundation: attribution is only as complete as Charlie's
linking, and BMI lumps are never attributable. A third income stream alongside License
fees and Demo fees — see [[royalty income]] and the Report's royalties section.
_Avoid_: Royalty invoice, invoice (for royalties), earnings (as an entity name).

**Royalty import** (historical backfill):
The one-off load of Charlie's 2020–2026 QuickBooks royalties export. Each source line
mints exactly one [[royalty payment]], verbatim: $0 rows are imported, blank descriptions
stay blank (never invented), payer names are kept as written ("Gareth Smith (Personal)"),
and the original QuickBooks invoice numbers are **dropped entirely** — unlike the
[[license import]], nothing here earns a private note. Payers are matched
case-insensitively by name and created with empty bill-to blocks when missing. **No
review round-trip** (there is no matching to get wrong) and **no links minted** — linking
AFM rows to their licenses is Charlie's optional post-import garnish. Idempotent by the
composite key (date, payer, description, amount): re-running skips existing rows, never
duplicates.
_Avoid_: Sync, migration, license import (a different, harder flow).

### Personal ledger

**Lead**:
Charlie's house word for a freeform line in his personal ledger: a single
(date, description, amount) row he adds by hand, with an optional link to a Brand,
License, and/or Demo. **Not a sales prospect** — despite the universal meaning of the
word, here a Lead records money, real or imagined. It may capture a **real milestone
payment** he received, or a **fictional split** he invents to spread one fee across months
for an even-looking view. Deliberately walled off from the rest of the ledger: a Lead never
feeds lifetime sales, demo income, invoices, or the Report — it is his private record only.
_Avoid_: Prospect, payment, receipt, installment.

### Reminders

**Reminder**:
A dated nudge for Charlie to act on something later, surfaced on the dashboard **timeline**
(alongside license expirations and demo hold-lifts) and in the weekly **digest**. Always
**actionable** (a "do this" by a date), never a passive informational ping. Carries a
**stored, snapshotted** title and description, a **date**, and optional independent links to
a License, Track, Brand, and/or Demo (`set null` on delete, the way a [[lead]] does) — the
links are for click-through, never for rendering the title. Unlike every other timeline item
(which is *derived live* from another record), a Reminder is a **stored, stateful row**: it
is **open → done** via one nullable `completed_at`. An open Reminder shows on the timeline
**from creation until done**, and an open Reminder **past its date does not vanish** the way
an expiration does — it persists as **urgent/overdue** (floated to the top) and resurfaces in
the digest, since the whole point is that Charlie not forget it. Marking it **done** removes
it entirely (it does not move to the activity feed). Born **by a rule** (the broadcast-royalty
rule below) — no manual create/edit in this cut; the only user action is **done**. See ADR-0007.
_Avoid_: Notification, alert, toast, push, to-do.

**Broadcast-royalty reminder** (the first, and so far only, Reminder rule):
When a [[license]] is created with `broadcast` among its usage types, one Reminder is created
in the same transaction, dated the license's **creation date + 30 days**, linked to that
License — so Charlie remembers to register the broadcast license to pursue royalties (royalties
only matter enough to chase for broadcast). Title: `Register {Track} × {Brand} for broadcast
royalties`; description: `Broadcast usage. Register this license to pursue broadcast royalties.`
**Create-time only** — it does not react to later license edits (adding broadcast via an edit
creates nothing; removing it leaves the reminder, which Charlie can mark done). The rule is
**hardcoded** (the table and surfacing are generic; the triggers are not data-driven).

### Sales & reporting

**Lifetime sales**:
Per track, Σ of all its License fees on a **commitment basis** — a fee counts as soon as
the License exists, regardless of whether its Invoice is paid. Invoice-independent.

**Demo income**:
Σ of all Demo fees, also commitment-basis. A separate top-level figure, never mixed into
lifetime sales.

**Royalty income**:
Σ of all [[royalty payment]] amounts — the third top-level income figure on the dashboard,
alongside Lifetime sales and Demo income, and never mixed into either. Inherently cash
basis (a royalty payment records money already received, anchored on its date); the
commitment-vs-cash distinction that splits Lifetime sales from the Report does not exist
for royalties.
_Avoid_: Royalty sales, royalty revenue.

**Earnings**:
The dashboard's combined, window-scoped income figure across all three streams, on a
**commitment basis**: Σ live [[invoice]] amounts anchored on **issue date** (License and
Demo invoices alike, paid or not — voided excluded) + Σ [[royalty payment]] amounts on
their own date (royalties have no invoice; the basis distinction doesn't exist for them).
Shown for a window and its year-ago comparator: a month compares against the **full**
same month last year; year-to-date compares against last year **cut off at the same
date**. Rides on the paired **unpaid invoices** figure — the receivables subset of
earnings already booked: Σ amount of all live invoices with no paid date (Overdue
included), all-time. Deliberately distinct from the Report's cash-basis **Total income**:
until the planned commitment-basis migration reaches the Report, the same window can
legitimately show two different numbers. First surfaced 2026-07 in the dashboard
overview box under the timeline.
_Avoid_: revenue, income (for this rollup), earnings (for a royalty payment — see
[[royalty payment]]).

**Renewal rate**:
Of all Licenses that have **expired** (non-perpetual, end date in the past), the share
whose `renewed_to_id` points at a replacing License. A measure of how often expiring deals
come back; surfaced alongside Revenue at Risk on the dashboard.

**Tag trend**:
A ranked rollup answering "what styles sell, and to whom": License fees summed **per
individual Tag**, expandable per Brand. Commitment basis, like lifetime sales. Because a
Track carries many Tags, a License's fee counts toward **each** of its Track's Tags — so the
rows **overlap and over-sum the grand total by design**, exactly like the Report's Usage Type
rows. (It was originally summed by the Track's whole *tag combination*, but once tracks carry
many mood tags every combination is unique and ranks nothing — the individual Tag is the
meaningful unit.) Tags are the platform-owned catalog vocabulary (managed from Settings).

**Report (sales report)**:
A date-range income pull, on a **cash basis**. Its **Sales** side is unchanged: paid
invoices anchored on **paid date**, grouped by Brand / Payer / Track / Usage Type, where
Brand / Payer / Track are clean partitions of the Sales total (Σ rows = grand total) and
the **Usage Type** rows overlap and over-sum by design (see ADR-0004). Royalties join as
a **separate section**, never mixed into those groupings: [[royalty payment]]s in range,
anchored on their own **date**, grouped by Payer within the section. The summary shows
three figures: **Sales** (Σ paid invoices — semantics untouched), **Royalties** (Σ royalty
payments in range), and **Total income** (their sum).

**Track export**:
The Tracks list rendered to a file (CSV or PDF), scoped to the **active tag, status, and
search filter** so the export always equals the on-screen view — one row per Track, never a
per-License breakdown. Carries a **with / without financials** choice (default *without*):
*without* is a share-safe catalog (`Track · Tags · Status`); *with* adds the
license-derived columns (`Licenses · Lifetime sales · Last licensed`) and a footer total of
Σ Lifetime sales. Follows the same ledger voice as the Invoice and Report PDFs.
_Avoid_: Download, dump, backup.

## Flagged ambiguities

- The desktop mockup only ever shows **Brand**. **Payer** and **Music House** were
  introduced later in the proposal. Resolved: two tables — `brand` (analytics dimension)
  and `payer` (billing entity) — with Music House folded into Payer.
- The mockup's drawer conflated License and Invoice ("New License" drafting
  "INV-2026-046", with Draft/Send actions). Resolved: the drawer creates a **License**
  (or Demo); its Invoice is issued automatically — no drafts, no send, number revealed
  after save. See ADR-0002.
- The mockup's "Performance by Category" widget assumed a brand taxonomy that didn't
  exist. Resolved: **Category** is now a required, curated lookup on Brand.
- The mockup's year-based invoice display ("INV-2026-046") implied per-year numbering.
  Resolved: one continuous gapless sequence rendered as `INV-0046`; no year component
  (ADR-0001 unchanged).
- The mockup's "Price" label and the drawer's missing Payer field were resolved in the
  domain's favor: **Fee**, Payer required with pick-or-create. The mockup's "Edit Metadata"
  button was initially dropped (Track was read-only at launch); Tracks are now fully
  catalog-mutable — created, edited, archived, and (when license-free) deleted in the
  platform. See ADR-0006.

## Example dialogue

> **Dev:** A24 licenses "Midnight Drive" for a TV spot. That's one License?
> **Charlie:** Right — one Track, one Brand (A24), the Payer is their agency. Usage is
> Broadcast, 1-year term.
> **Dev:** So lifetime sales on "Midnight Drive" goes up by that fee now, before A24 pays?
> **Charlie:** Yes. Lifetime sales is what I've committed, not what's landed. The Reports
> tab is the cash side — that fee only shows there once I mark the invoice paid.
> **Dev:** And if A24 renews next year?
> **Charlie:** New License. I point the old one's "Renewed →" at it so I can follow the
> chain, but it's a fresh record.
> **Dev:** Separately — a music house pays you to write a demo for Walmart. Where's that?
> **Charlie:** That's a Demo, not a License. Brand is Walmart, the Payer is the music house.
> It's got a 3-month hold; once that lifts I can turn the idea into a real track.
> **Dev:** "Turn into a track" — you pick the track when you convert?
> **Charlie:** No. I just mark it Converted — the decision. I build the actual track here
> afterward and link it if I want — but converting doesn't require one.
