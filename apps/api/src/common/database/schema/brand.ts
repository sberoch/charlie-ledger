import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { brandCategory } from './brand-category';

// The entity a Track is licensed *for* / used by (A24, Audi). An analytics
// dimension only — carries a name and a required Category, never billing
// details. See CONTEXT.md.
export const brand = pgTable(
  'brand',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    // The single market this brand competes in, for rollups and the
    // exclusivity collision warning. Required by design — an "Uncategorized"
    // bucket would hollow out the per-category analytics.
    categoryId: uuid('category_id')
      .notNull()
      .references(() => brandCategory.id, { onDelete: 'restrict' }),
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
    // Brand is an analytical dimension — duplicate names fragment grouping.
    uniqueIndex('brand_name_uq').on(sql`lower(${table.name})`),
    index('brand_category_idx').on(table.categoryId),
  ],
);
