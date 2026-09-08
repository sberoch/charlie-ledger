import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { album } from './album';
import { trackStatus } from './enums';

// A piece of music in Charlie's catalog. Tags are platform-owned and assigned
// via `track_tag` (see tag.ts) — no longer a Disco mirror. Created/edited/deleted
// directly in the platform; `name` is the catalog's natural key and is
// case-insensitively unique (same rule as tag — "Empire" and "empire" can't both
// exist). `status` archives a track via a manual catalog action. See CONTEXT.md /
// ADR-0006.
export const track = pgTable(
  'track',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    status: trackStatus('status').notNull().default('active'),
    // The library release this track belongs to; null = "No album" (custom /
    // stub tracks). SET NULL: deleting an Album never deletes history.
    albumId: uuid('album_id').references(() => album.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('track_name_uq').on(sql`lower(${table.name})`),
    index('track_album_idx').on(table.albumId),
  ],
);
