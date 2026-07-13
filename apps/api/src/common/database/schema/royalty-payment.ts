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
import { license } from './license';
import { payer } from './payer';
import { track } from './track';

// A Royalty payment — royalty income Charlie RECEIVED (BMI/AFM/SAG payouts,
// or a music house / individual passing royalties through). Deliberately NOT
// an invoice: nothing is issued or numbered, no Unpaid/Overdue lifecycle — the
// money has already landed when the row is born. Flat single line; a BMI
// Writers/Publishing payout is simply two rows. Fully mutable like a Lead,
// but unlike a Lead it DOES feed reporting: the Report's Royalties section
// and the dashboard's Royalty income figure. See CONTEXT.md and ADR-0009.
export const royaltyPayment = pgTable(
  'royalty_payment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentDate: date('payment_date').notNull(),
    // The royalty source — whoever paid (CONTEXT.md: Payer, reused).
    // RESTRICT like license/demo: a payer with royalty history can't vanish.
    payerId: uuid('payer_id')
      .notNull()
      .references(() => payer.id, { onDelete: 'restrict' }),
    // Optional — a bare BMI row is self-explanatory (grilled 2026-07-13).
    description: text('description'),
    // Non-negative; zero allowed (a royalty event that paid nothing is still
    // faithful history — the two SAG/Kyndryl rows).
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    // Optional, independent links — the Lead trio pattern. SET NULL: deleting
    // a referenced entity just unlinks; a royalty payment never blocks.
    brandId: uuid('brand_id').references(() => brand.id, {
      onDelete: 'set null',
    }),
    trackId: uuid('track_id').references(() => track.id, {
      onDelete: 'set null',
    }),
    licenseId: uuid('license_id').references(() => license.id, {
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
    // Drives the month-grouped list view and the Report's date-range pull.
    index('royalty_payment_date_idx').on(table.paymentDate),
    index('royalty_payment_payer_idx').on(table.payerId),
    index('royalty_payment_brand_idx').on(table.brandId),
    index('royalty_payment_track_idx').on(table.trackId),
    index('royalty_payment_license_idx').on(table.licenseId),
  ],
);
