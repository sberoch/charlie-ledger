import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

// Album — the library release a Track was ingested under in Charlie's
// production library ("Heads Down Thumbs Up"). Platform-owned lookup, same
// shape as tag: case-insensitively unique name, pick-or-create from the Track
// form, renamed/deleted from Settings. A Track carries at most one via
// `track.album_id` (nullable = "No album"); deleting an Album returns its
// tracks to "No album" (SET NULL). See CONTEXT.md ("Album").
export const album = pgTable(
  'album',
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
  (table) => [uniqueIndex('album_name_uq').on(sql`lower(${table.name})`)],
);
