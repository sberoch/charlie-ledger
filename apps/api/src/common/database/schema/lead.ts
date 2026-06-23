import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { brand } from './brand';
import { demo } from './demo';
import { license } from './license';
import { track } from './track';

// A Lead — Charlie's house word for a freeform line in his personal ledger: a
// (date, description, amount) row he adds by hand, optionally linked to a Brand,
// License, and/or Demo (each independent, any combination, no cross-checks).
// Deliberately walled off from the rest of the ledger — never reconciled against
// fees or invoices, never feeds lifetime sales / demo income / the Report. Freely
// edited and hard-deleted; amount is SIGNED (refunds/adjustments allowed).
// Not a sales prospect. See CONTEXT.md and ADR-0005.
export const lead = pgTable(
  'lead',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryDate: date('entry_date').notNull(),
    description: text('description').notNull(),
    // Signed money — negatives allowed (refund / adjustment / downward split).
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    // Optional, independent links. SET NULL (not RESTRICT): deleting a referenced
    // entity just unlinks this private note — a Lead never blocks anything.
    brandId: uuid('brand_id').references(() => brand.id, {
      onDelete: 'set null',
    }),
    licenseId: uuid('license_id').references(() => license.id, {
      onDelete: 'set null',
    }),
    demoId: uuid('demo_id').references(() => demo.id, {
      onDelete: 'set null',
    }),
    trackId: uuid('track_id').references(() => track.id, {
      onDelete: 'set null',
    }),
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
    // Drives the month-grouped ledger view (most recent first).
    index('lead_entry_date_idx').on(table.entryDate),
    index('lead_brand_idx').on(table.brandId),
    index('lead_license_idx').on(table.licenseId),
    index('lead_demo_idx').on(table.demoId),
    index('lead_track_idx').on(table.trackId),
  ],
);
