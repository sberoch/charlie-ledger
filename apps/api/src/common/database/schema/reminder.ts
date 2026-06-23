import {
  date,
  index,
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

// A Reminder — a dated, actionable nudge for Charlie, surfaced on the dashboard
// timeline and in the weekly digest. See CONTEXT.md and ADR-0007.
//
// Unlike every other timeline item (license expirations, demo hold-lifts), which
// are DERIVED LIVE from another record and drop off once their date passes, a
// Reminder is a STORED, STATEFUL row: it is open → done via `completed_at`. An
// open Reminder shows from creation until done; one past its `due_on` does NOT
// vanish — it persists as overdue (the whole point: that Charlie not forget it).
//
// `title`/`description` are SNAPSHOTTED at creation (like the Invoice description),
// never derived from the links. The links to License/Track/Brand/Demo are optional,
// independent, and `set null` on delete (the Lead pattern) — for click-through only.
//
// Born by a rule (the broadcast-royalty rule in LicensesService.create) — no manual
// create/edit in this cut; the only mutation is marking it done.
export const reminder = pgTable(
  'reminder',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Snapshotted display text — composed by the rule that creates the reminder.
    title: text('title').notNull(),
    description: text('description').notNull(),
    // The date Charlie should act on it. Drives timeline ordering and the digest
    // window; an open reminder past this date is overdue, not gone.
    dueOn: date('due_on').notNull(),
    // null = open; set once = done (and the reminder disappears from the timeline).
    completedAt: timestamp('completed_at'),
    // Optional, independent links. SET NULL (not RESTRICT): deleting a referenced
    // entity just unlinks this nudge — a Reminder never blocks anything.
    licenseId: uuid('license_id').references(() => license.id, {
      onDelete: 'set null',
    }),
    trackId: uuid('track_id').references(() => track.id, {
      onDelete: 'set null',
    }),
    brandId: uuid('brand_id').references(() => brand.id, {
      onDelete: 'set null',
    }),
    demoId: uuid('demo_id').references(() => demo.id, {
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
    // Open-reminders-by-date is the hot query (timeline + digest).
    index('reminder_due_on_idx').on(table.dueOn),
    index('reminder_completed_at_idx').on(table.completedAt),
    index('reminder_license_idx').on(table.licenseId),
    index('reminder_track_idx').on(table.trackId),
    index('reminder_brand_idx').on(table.brandId),
    index('reminder_demo_idx').on(table.demoId),
  ],
);
