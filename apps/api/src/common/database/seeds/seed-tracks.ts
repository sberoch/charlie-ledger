import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { track } from '../schema';

// Tier 1 seed — mock Disco catalog, runs everywhere including prod at launch.
// Tracks carry mock-* disco_ids: when the real Disco sync lands it upserts by
// disco_id, finds none of these in Disco's response, and soft-archives them via
// the absent-track rule. The replacement path is the sync's own semantics.
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
  for (const [i, t] of TRACKS.entries()) {
    const discoId = `mock-${String(i + 1).padStart(3, '0')}`;
    await db
      .insert(track)
      .values({ discoId, name: t.name, tags: t.tags })
      .onConflictDoUpdate({
        target: track.discoId,
        set: { name: t.name, tags: t.tags },
      });
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
