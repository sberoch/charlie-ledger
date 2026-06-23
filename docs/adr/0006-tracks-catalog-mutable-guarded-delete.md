# Tracks are catalog-mutable, with archive and guarded hard-delete

Tracks were read-only at launch (the catalog was meant to sync from Disco, then seeded
directly once Disco was retired). We now manage the catalog in the platform itself: Tracks
are created, edited (name + Tags), archived, and deleted directly. The mockup's dropped
"Edit Metadata" button is effectively reinstated.

Removal is **two distinct actions**, not one, because a Track can carry financial history:

- **Archive** — flips `status` to `archived`. Always available, reversible, non-destructive;
  retires the Track from the default catalog view. This is the everyday "retire it" action
  and the path for any Track with Licenses. `status` is changed *only* through this action,
  never as an edit-form field.
- **Hard delete** — permitted **only when the Track has zero Licenses**. The `license.track_id`
  FK is `onDelete: 'restrict'`, so the database blocks deletion of a Track with history; the
  API surfaces that as a 409 directing the user to archive instead. A permitted delete cascades
  `track_tag` rows away and nulls any `demo.converted_track_id` pointing at the Track (FK
  `set null`) — demo conversion links are optional, forward-only annotations, so they are
  warned about in the confirm dialog but never block the delete.

## Why

Licenses are financial records and the basis for lifetime-sales and Tag-trend rollups, so a
Track that has ever been licensed must not vanish. Archive preserves that history while still
letting Charlie clean up the working catalog; hard delete stays available for genuine mistakes
(a Track created in error, never licensed). A reader seeing the DB refuse to delete a licensed
Track, or wondering why there are both "Archive" and "Delete", will find the rule here.

Track names are also made **case-insensitively unique** (a `lower(name)` index, matching Tags),
since the name is the natural key for a ~300-Track owned catalog and near-duplicate casing would
corrupt the picker, exports, and rollups.
