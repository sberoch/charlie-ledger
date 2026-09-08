import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { album, tag, track, trackTag } from '../schema';
import { seedTags } from './seed-tags';

// Tier 1 seed — the mock catalog, runs everywhere including prod at launch.
// Tracks are loaded directly (Disco is retired); `name` is the natural key, so
// re-running upserts by name and is non-destructive. Tags are platform-owned —
// seedTags() guarantees the vocabulary first, then each track's tags are wired
// through the track_tag join (reconciled on every run).
//
// The first 15 are the prototype's validated tracks, exact names and tags, so
// every screen Charlie approved shows him data he has already seen.

// Tags are drawn from the curated mood vocabulary in seed-tags.ts. The
// prototype's original genre/texture words (cinematic, ambient, indie,
// electronic…) are deliberately NOT in that vocabulary, so they are mapped to
// the nearest mood equivalent here — otherwise the reconcile below skips them
// silently and the catalog seeds untagged, which empties the dashboard's tag
// donut (ADR-0014).
// Albums mirror the real catalog's shape (CONTEXT.md "Album"): a few library
// releases, plus some tracks left album-less — the custom / stub case.
const TRACKS: Array<{ name: string; tags: string[]; album?: string }> = [
  { name: 'Empire', tags: ['dramatic', 'building', 'epic'], album: 'Colony' },
  {
    name: 'Cartography',
    tags: ['dramatic', 'epic', 'atmospheric'],
    album: 'Prologue :: Cartography',
  },
  {
    name: 'Northern Air',
    tags: ['dramatic', 'sad', 'minimal'],
    album: 'Prologue :: Cartography',
  },
  {
    name: 'Departure',
    tags: ['organic', 'reflective', 'warm'],
    album: 'Departure EP',
  },
  {
    name: 'Tessellate',
    tags: ['minimal', 'building', 'intense'],
    album: 'Colony',
  },
  {
    name: 'Reset Self',
    tags: ['hopeful', 'building', 'upbeat'],
    album: 'Optimistic',
  },
  {
    name: 'Last Frost',
    tags: ['solemn', 'sad', 'minimal'],
    album: 'Prologue :: Cartography',
  },
  {
    name: 'Glass Pavilion',
    tags: ['atmospheric', 'reflective', 'relaxed'],
    album: 'Reflections',
  },
  { name: 'Static Field', tags: ['tension', 'gritty', 'intense'] },
  { name: 'Colony', tags: ['dark', 'building', 'powerful'], album: 'Colony' },
  {
    name: 'Ironwood',
    tags: ['organic', 'motivating', 'warm'],
    album: 'Departure EP',
  },
  {
    name: 'Halflight',
    tags: ['dreamy', 'romantic', 'warm'],
    album: 'Reflections',
  },
  {
    name: 'Slow Bloom',
    tags: ['atmospheric', 'organic', 'emotive'],
    album: 'Reflections',
  },
  {
    name: 'Open Water',
    tags: ['hopeful', 'epic', 'inspiring'],
    album: 'Optimistic',
  },
  {
    name: 'Paper Lanterns',
    tags: ['dreamy', 'hopeful', 'organic'],
    album: 'Optimistic',
  },
  // Five generated to round out the catalog to 20.
  {
    name: 'Vermillion',
    tags: ['dramatic', 'tension', 'epic'],
    album: 'Colony',
  },
  { name: 'Low Tide', tags: ['chill', 'organic', 'relaxed'] },
  {
    name: 'Night Market',
    tags: ['colorful', 'bubbly', 'upbeat'],
    album: 'Optimistic',
  },
  { name: 'Sandstone', tags: ['warm', 'organic', 'retro'] },
  { name: 'Meridian', tags: ['epic', 'inspiring', 'triumphant'] },
];

export async function seedTracks() {
  // The vocabulary must exist before track_tag can reference it.
  await seedTags();

  // Resolve tag names → ids once for the whole catalog.
  const tagRows = await db.select({ id: tag.id, name: tag.name }).from(tag);
  const tagIdByName = new Map(tagRows.map((r) => [r.name, r.id]));

  // Albums: pick-or-create by name (same lower(name) natural key as track).
  const albumIdByName = new Map<string, string>();
  for (const name of new Set(
    TRACKS.map((t) => t.album).filter((a): a is string => a !== undefined),
  )) {
    await db.insert(album).values({ name }).onConflictDoNothing();
    const row = await db.query.album.findFirst({
      where: sql`lower(${album.name}) = lower(${name})`,
    });
    if (!row) throw new Error(`Seed album upsert failed: ${name}`);
    albumIdByName.set(name, row.id);
  }

  for (const t of TRACKS) {
    // Upsert by name (the natural key). The unique index is on lower(name), an
    // expression index a conflict target can't be passed to directly (same as
    // tag_name_uq) — so insert with bare DO NOTHING, then resolve + reactivate
    // the existing row on conflict.
    const albumId = t.album ? (albumIdByName.get(t.album) ?? null) : null;
    const [inserted] = await db
      .insert(track)
      .values({ name: t.name, albumId })
      .onConflictDoNothing()
      .returning({ id: track.id });
    let row = inserted;
    if (!row) {
      const existing = await db.query.track.findFirst({
        where: sql`lower(${track.name}) = lower(${t.name})`,
      });
      if (!existing) throw new Error(`Seed track upsert failed: ${t.name}`);
      await db
        .update(track)
        .set({ status: 'active', albumId })
        .where(eq(track.id, existing.id));
      row = { id: existing.id };
    }

    // Reconcile assignments: clear then re-insert this track's tags. The
    // vocabulary is now the curated mood list (seed-tags.ts), so a demo track's
    // legacy genre/texture tags may no longer exist — skip those silently rather
    // than fail the seed (the mock catalog's exact tags are not load-bearing).
    await db.delete(trackTag).where(eq(trackTag.trackId, row.id));
    const tagIds = t.tags
      .map((name) => tagIdByName.get(name))
      .filter((id): id is string => id !== undefined);
    if (tagIds.length > 0)
      await db
        .insert(trackTag)
        .values(tagIds.map((tagId) => ({ trackId: row.id, tagId })));
  }

  const [{ count }] = (
    await db.execute<{ count: string }>(sql`SELECT count(*) FROM ${track}`)
  ).rows;
  console.log(`✓ seeded ${TRACKS.length} mock tracks (catalog now ${count})`);
}

if (require.main === module) {
  seedTracks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
