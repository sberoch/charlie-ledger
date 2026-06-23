---
status: accepted
---

# Reminders are stored, stateful timeline items born from rules

Every other item on the dashboard timeline (license expirations, demo hold-lifts) is
**derived live** from another record and silently drops off once its date passes. A
**Reminder** is the deliberate exception: a **stored row** with a nullable `completed_at`,
created by a rule (first rule: a `broadcast` license → a Reminder dated creation date + 30
days, so Charlie remembers to register it to pursue broadcast royalties). It is stored, not
derived, **because it is stateful** — Charlie marks it *done*, and an open Reminder past its
date must **persist as overdue** (on the timeline and in the digest) rather than vanish, since
the entire point is that he not forget it. Title and description are **snapshotted** at
creation like an Invoice's description; optional `set null` links to License/Track/Brand/Demo
are for click-through only (the [[lead]] pattern). The table and surfacing are generic so
future reminder types drop in cheaply; triggers stay **hardcoded** (not data-driven).

## Considered alternative

Derive the broadcast reminder live from the License, exactly like expirations — no table.
The data is there (`broadcast` in `usageTypes` + `createdAt + 30d`). Rejected: a derived item
has nowhere to record "done" and would either nag forever or follow the expiration rule and
vanish at its date — both defeat "so he remembers." A stored, dismissable row is required the
moment the item is actionable, and it is what generalizes to non-derivable reminders later.

## Consequences

- `TimelineItemDto` gains a `"reminder"` kind and its `fee` becomes nullable; `sourceId` for a
  reminder is the **reminder's own id** (the `done` action targets it, not the linked license).
- Reminders use the existing urgency bands; a due/overdue open reminder renders **`urgent`**
  (no new enum value) and floats to the top via a negative `daysOut`.
- The reminder rule fires **create-time only**, in the License-create transaction; it does not
  react to later license edits (consistent with invoice issue-on-create, ADR-0002).
- The digest's reminder section includes **overdue** open reminders (`date <= horizon`,
  including `date < today`), the one spot reminders diverge from the forward-only sections.
- No manual create/edit in this cut — the only user action is **done**.
</content>
</invoke>
