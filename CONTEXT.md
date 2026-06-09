# Foltz Ledger

A single ledger for Charlie Foltz's one-person music licensing business: it holds the
licenses, demos, invoices, and payments around a catalog of ~300 owned tracks, and mirrors
the Disco catalog as the canonical source of tracks. Replaces a patchwork of QuickBooks,
Disco, and mental tracking.

## Language

### Counterparties

**Brand**:
The entity a track is licensed *for* / used by (A24, Audi, Glossier). An analytical
dimension only — it carries a name and is what sales are grouped and trended by. A Brand
does not necessarily pay; it never carries billing details.
_Avoid_: Client, customer, account.

**Payer**:
The billing counterparty an Invoice is addressed to — whoever actually pays. Carries the
bill-to block (name, address, email). May be the Brand itself or an agency acting for it.
A **Demo**'s commissioning "music house" is a Payer in that role — Music House is not a
separate entity.
_Avoid_: Music House (as a distinct entity), bill-to, customer.

### Catalog & licensing

**Track**:
A piece of music in Charlie's catalog. A **read-only mirror of Disco** — its identity,
name, and tags are owned by Disco and propagate one-way on sync; the platform never edits
or deletes a Track. Identified by its Disco id.
_Avoid_: Song, asset.

**License**:
A grant of a Track's use to a Brand under specific terms (usage, term length, exclusivity,
fee, dates). References exactly **one Track** (required), one **Brand**, and one **Payer**.
A Track has many Licenses — its history. Lifetime sales roll up a Track's License fees.
Its **end date** is the source of truth for expiration (seeded from start + term length,
but editable); a `perpetual` term has no end date and never expires.
_Avoid_: Deal, contract, sale.

**Usage Type**:
The medium a License grants the Track for. Closed set: `broadcast`, `digital_media`,
`social_media`, `internet`, `internal`.

**Exclusivity Tier**:
How exclusive a License's grant is. Closed set: `non_exclusive`, `category_exclusive`,
`full_exclusive`, `work_for_hire`. Note `work_for_hire` is conceptually an ownership axis,
not an exclusivity one, but is modelled as a tier for MVP (matches the mockup).

**Demo**:
A cue Charlie writes on commission for a music house, pitched for a Brand. Always
commissioned — has a Brand, a **Payer** (the music house), a fee, and a working name (e.g.
"Walmart_SpringSale_v1a"), all required. Carries a **hold** (none / 3mo / 6mo) counting
from when it was written; the dashboard surfaces it once the hold lifts so the idea can be
reused. Forward-only — pre-platform demos are not tracked.
_Avoid_: Pitch, cue, spec track.

**Conversion**:
Charlie's decision that a Demo's idea will become a library Track. Flips the Demo's status
`open → converted` — a standalone decision that requires **no** Track to exist yet (he
builds the Track in Disco afterwards). He may **optionally** link the resulting Track later
for his own reference; the link is never required to convert.
_Avoid_: Promote, publish.

**Renewal**:
A manual, forward-only pointer from an expiring License to the new License that replaces it
(`renewed_to_id`). It is an annotation only — renewals are created as ordinary new Licenses;
nothing is auto-copied or auto-created.
_Avoid_: Extension, succession.

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
Demo** (never both, never neither). It snapshots the bill-to block from that source's
**Payer** at creation time, so later Payer edits never alter historical invoices. Its
display status (Paid / Unpaid / Overdue / Voided) is **derived**, not stored — from
`paid_date`, `due_date`, and `voided_at`. An invoice is never hard-deleted; cancelling
**voids** it (keeps its number) to preserve gapless numbering — see ADR-0001.
_Avoid_: Bill, receipt.

**Fee**:
The agreed amount on a License or a Demo. Income rollups derive from fees, **not** from
invoices: lifetime sales = Σ License fees; demo income = Σ Demo fees (tracked separately).
_Avoid_: Price (UI label), amount, cost.

### Sales & reporting

**Lifetime sales**:
Per track, Σ of all its License fees on a **commitment basis** — a fee counts as soon as
the License exists, regardless of whether its Invoice is paid. Invoice-independent.

**Demo income**:
Σ of all Demo fees, also commitment-basis. A separate top-level figure, never mixed into
lifetime sales.

**Report (sales report)**:
A date-range sales pull grouped by Brand / Payer / Track / Usage Type, on a **cash basis**
— a sale only appears once its Invoice is Paid, anchored on the invoice's **paid date**.
Deliberately diverges from Lifetime sales (commitment basis); the two totals will differ.

## Flagged ambiguities

- The desktop mockup only ever shows **Brand**. **Payer** and **Music House** were
  introduced later in the proposal. Resolved: two tables — `brand` (analytics dimension)
  and `payer` (billing entity) — with Music House folded into Payer.

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
> **Charlie:** No. I just mark it Converted — the decision. I build the actual track in Disco
> afterward; it shows up here on the next sync and I can link it then if I want.
