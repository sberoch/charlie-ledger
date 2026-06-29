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

const TRACKS: Array<{ name: string; tags: string[] }> = [
  { name: 'Empire', tags: ['cinematic', 'driving', 'expansive'] },
  { name: 'Cartography', tags: ['cinematic', 'expansive', 'atmospheric'] },
  { name: 'Northern Air', tags: ['cinematic', 'melancholic', 'sparse'] },
  { name: 'Departure', tags: ['indie', 'melancholic', 'warm'] },
  { name: 'Tessellate', tags: ['electronic', 'geometric', 'pulsing'] },
  { name: 'Reset Self', tags: ['electronic', 'uplifting', 'pulsing'] },
  { name: 'Last Frost', tags: ['cinematic', 'melancholic', 'sparse'] },
  { name: 'Glass Pavilion', tags: ['ambient', 'melancholic', 'slow'] },
  { name: 'Static Field', tags: ['electronic', 'tense', 'glitched'] },
  { name: 'Colony', tags: ['electronic', 'driving', 'dark'] },
  { name: 'Ironwood', tags: ['indie', 'driving', 'warm'] },
  { name: 'Halflight', tags: ['ambient', 'intimate', 'warm'] },
  { name: 'Slow Bloom', tags: ['ambient', 'organic', 'intimate'] },
  { name: 'Open Water', tags: ['indie', 'uplifting', 'expansive'] },
  { name: 'Paper Lanterns', tags: ['ambient', 'uplifting', 'organic'] },
  // Five generated to round out the catalog to 20.
  { name: 'Vermillion', tags: ['cinematic', 'tense', 'orchestral'] },
  { name: 'Low Tide', tags: ['ambient', 'organic', 'slow'] },
  { name: 'Night Market', tags: ['electronic', 'playful', 'pulsing'] },
  { name: 'Sandstone', tags: ['indie', 'warm', 'organic'] },
  { name: 'Meridian', tags: ['cinematic', 'uplifting', 'expansive'] },
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
