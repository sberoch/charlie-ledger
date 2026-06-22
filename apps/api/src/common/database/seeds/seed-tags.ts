import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { tag } from '../schema';

// Tier 1 seed — the platform-owned tag vocabulary. Runs everywhere (incl. prod
// at launch) before the catalog seed, since track_tag references these by id.
//
// The first 21 are exactly the distinct tags the seeded tracks carry, so every
// track FK resolves and the trend/chips light up. The last two are deliberately
// UNUSED — they exercise the Settings screen's zero-usage row and its
// delete-with-no-confirm path without any track-editing UI existing yet.
export const TAGS = [
  // ── In use by the seeded catalog (seed-tracks.ts) ──
  'cinematic',
  'driving',
  'expansive',
  'atmospheric',
  'melancholic',
  'sparse',
  'indie',
  'warm',
  'electronic',
  'geometric',
  'pulsing',
  'uplifting',
  'ambient',
  'slow',
  'tense',
  'glitched',
  'dark',
  'intimate',
  'organic',
  'orchestral',
  'playful',
  // ── Unused — zero-usage demo rows ──
  'acoustic',
  'experimental',
];

export async function seedTags() {
  for (const name of TAGS) {
    // Idempotent — bare DO NOTHING catches the case-insensitive name index
    // (tag_name_uq), which an expression target can't be passed to directly.
    await db.insert(tag).values({ name }).onConflictDoNothing();
  }
  const [{ count }] = (
    await db.execute<{ count: string }>(sql`SELECT count(*) FROM ${tag}`)
  ).rows;
  console.log(`✓ seeded ${TAGS.length} tags (vocabulary now ${count})`);
}

if (require.main === module) {
  seedTags()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
