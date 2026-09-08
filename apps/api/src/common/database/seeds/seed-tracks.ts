import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { tag, track, trackTag } from '../schema';
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
const TRACKS: Array<{ name: string; tags: string[] }> = [
  { name: 'Empire', tags: ['dramatic', 'building', 'epic'] },
  { name: 'Cartography', tags: ['dramatic', 'epic', 'atmospheric'] },
  { name: 'Northern Air', tags: ['dramatic', 'sad', 'minimal'] },
  { name: 'Departure', tags: ['organic', 'reflective', 'warm'] },
  { name: 'Tessellate', tags: ['minimal', 'building', 'intense'] },
  { name: 'Reset Self', tags: ['hopeful', 'building', 'upbeat'] },
  { name: 'Last Frost', tags: ['solemn', 'sad', 'minimal'] },
  { name: 'Glass Pavilion', tags: ['atmospheric', 'reflective', 'relaxed'] },
  { name: 'Static Field', tags: ['tension', 'gritty', 'intense'] },
  { name: 'Colony', tags: ['dark', 'building', 'powerful'] },
  { name: 'Ironwood', tags: ['organic', 'motivating', 'warm'] },
  { name: 'Halflight', tags: ['dreamy', 'romantic', 'warm'] },
  { name: 'Slow Bloom', tags: ['atmospheric', 'organic', 'emotive'] },
  { name: 'Open Water', tags: ['hopeful', 'epic', 'inspiring'] },
  { name: 'Paper Lanterns', tags: ['dreamy', 'hopeful', 'organic'] },
  // Five generated to round out the catalog to 20.
  { name: 'Vermillion', tags: ['dramatic', 'tension', 'epic'] },
  { name: 'Low Tide', tags: ['chill', 'organic', 'relaxed'] },
  { name: 'Night Market', tags: ['colorful', 'bubbly', 'upbeat'] },
  { name: 'Sandstone', tags: ['warm', 'organic', 'retro'] },
  { name: 'Meridian', tags: ['epic', 'inspiring', 'triumphant'] },
];

export async function seedTracks() {
  // The vocabulary must exist before track_tag can reference it.
  await seedTags();

  // Resolve tag names → ids once for the whole catalog.
  const tagRows = await db.select({ id: tag.id, name: tag.name }).from(tag);
  const tagIdByName = new Map(tagRows.map((r) => [r.name, r.id]));

  for (const t of TRACKS) {
    // Upsert by name (the natural key). The unique index is on lower(name), an
    // expression index a conflict target can't be passed to directly (same as
    // tag_name_uq) — so insert with bare DO NOTHING, then resolve + reactivate
    // the existing row on conflict.
    const [inserted] = await db
      .insert(track)
      .values({ name: t.name })
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
        .set({ status: 'active' })
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
