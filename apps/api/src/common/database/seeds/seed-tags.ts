import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { tag } from '../schema';

// Tier 1 seed — the platform-owned tag vocabulary. Runs everywhere (incl. prod
// at launch) before the catalog seed, since track_tag references these by id.
//
// This is the canonical **mood / feel** vocabulary, and it doubles as the
// allow-list for the Disco CSV import (CONTEXT.md "Track import"): the importer
// attaches a COMMENTS word only when it matches a Tag that already exists here,
// so genres, instruments, tempo, and licensing junk are dropped by never being
// in the vocabulary in the first place. Curated lean — deliberately excludes
// near-universal positives (cool/fun/happy…) that would tag the whole catalog
// and discriminate nothing. Renameable / deletable from Settings like any Tag.
export const TAGS = [
  'dark',
  'mysterious',
  'moody',
  'dreamy',
  'reflective',
  'atmospheric',
  'minimal',
  'gritty',
  'intense',
  'tension',
  'dramatic',
  'emotive',
  'romantic',
  'epic',
  'light',
  'retro',
  'vintage',
  'sad',
  'haunting',
  'badass',
  'triumphant',
  'inspiring',
  'celebratory',
  'motivating',
  'chill',
  'colorful',
  'proud',
  'organic',
  'funky',
  'relaxed',
  'tropical',
  'sassy',
  'sweet',
  'bubbly',
  'serious',
  'solemn',
  'athletic',
  'swagger',
  'sexy',
  'anthemic',
  'hopeful',
  'warm',
  'upbeat',
  'powerful',
  'building',
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
