import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { trackStatus } from './enums';

// A piece of music in Charlie's catalog. Tags are platform-owned and assigned
// via `track_tag` (see tag.ts) — no longer a Disco mirror. Names are unique
// (the catalog's natural key); `status` archives a track via a manual catalog
// action (the absent-from-sync rule retired with Disco). See CONTEXT.md.
export const track = pgTable('track', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  status: trackStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
