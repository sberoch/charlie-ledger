import { sql } from 'drizzle-orm';
import { check, integer, pgTable, timestamp } from 'drizzle-orm/pg-core';

// Singleton table (one enforced row) for app-level state: the gapless invoice
// counter and the weekly-digest look-ahead window. See ADR-0001.
export const appSetting = pgTable(
  'app_setting',
  {
    id: integer('id').primaryKey().default(1),
    // Next number to assign; locked FOR UPDATE during invoice creation.
    nextInvoiceNumber: integer('next_invoice_number').notNull().default(1),
    // Weekly digest look-ahead window, in days.
    digestLookaheadDays: integer('digest_lookahead_days').notNull().default(7),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [check('app_setting_singleton', sql`${table.id} = 1`)],
);
