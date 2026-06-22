import { sql } from 'drizzle-orm';
import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { track } from './track';

// A curated, platform-owned catalog tag. Created/renamed/deleted from Settings;
// deliberately not an enum. The governing vocabulary for what a Track is tagged
// with — assignment lives in `track_tag`. Mirrors brand_category's lookup shape.
// See CONTEXT.md ("Tag").
export const tag = pgTable(
  'tag',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Canonical spelling — case-insensitive uniqueness keeps "Cinematic" and
    // "cinematic" from fragmenting the vocabulary (same rule as brand_category).
    uniqueIndex('tag_name_uq').on(sql`lower(${table.name})`),
  ],
);

// Track ↔ Tag assignment. Composite PK doubles as the no-duplicate guard;
// deleting either side clears the assignment (a deleted tag vanishes from its
// tracks — the confirm-then-cascade delete in Settings). See CONTEXT.md.
export const trackTag = pgTable(
  'track_tag',
  {
    trackId: uuid('track_id')
      .notNull()
      .references(() => track.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.trackId, table.tagId] })],
);
