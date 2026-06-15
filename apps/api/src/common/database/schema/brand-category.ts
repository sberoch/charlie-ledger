import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

// The market a Brand competes in for Charlie's purposes (Automotive, Fashion,
// Streaming · TV). Every Brand carries exactly one. A curated, evolving lookup —
// created on the fly and renameable, deliberately not an enum. Powers per-category
// performance rollups and the exclusivity collision warning. See CONTEXT.md.
export const brandCategory = pgTable(
  'brand_category',
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
    // Canonical spelling — "Auto" vs "Automotive" fragmentation breaks rollups.
    uniqueIndex('brand_category_name_uq').on(sql`lower(${table.name})`),
  ],
);
