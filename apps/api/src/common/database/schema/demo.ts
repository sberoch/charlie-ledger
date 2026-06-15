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
import { demoStatus, holdPeriod } from './enums';
import { payer } from './payer';
import { track } from './track';

// A cue Charlie writes on commission for a music house (the Payer), pitched for
// a Brand. Always commissioned — brand, payer, fee, and working name are all
// required. Carries a reuse hold; surfaced on the dashboard once it lifts.
// Forward-only. See CONTEXT.md.
export const demo = pgTable(
  'demo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brand.id, { onDelete: 'restrict' }),
    // The commissioning music house.
    payerId: uuid('payer_id')
      .notNull()
      .references(() => payer.id, { onDelete: 'restrict' }),
    fee: numeric('fee', { precision: 12, scale: 2 }).notNull(),
    workingName: text('working_name').notNull(),
    holdPeriod: holdPeriod('hold_period').notNull(),
    // Date the demo was written/commissioned; anchors the hold.
    writtenAt: date('written_at').notNull(),
    // Seeded from writtenAt + holdPeriod but editable; the timeline indexes it.
    holdEndsAt: date('hold_ends_at').notNull(),
    status: demoStatus('status').notNull().default('open'),
    // Optional, set any time after conversion — independent of status. The
    // mirrored Track only exists once Charlie builds it in Disco afterwards.
    convertedTrackId: uuid('converted_track_id').references(() => track.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    // Optional freeform grant scope snapshotted onto the invoice description at
    // issue. Distinct from private `notes`; empty => an auto-composed line.
    // See ADR-0003.
    terms: text('terms'),
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
    index('demo_brand_idx').on(table.brandId),
    index('demo_payer_idx').on(table.payerId),
    index('demo_converted_track_idx').on(table.convertedTrackId),
    // "Ready to convert" dashboard query: status = open AND hold_ends_at <= today.
    index('demo_hold_ends_at_idx').on(table.holdEndsAt),
  ],
);
