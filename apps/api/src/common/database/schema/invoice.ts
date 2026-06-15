import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { demo } from './demo';
import { license } from './license';

// A request for payment, rendered to a fixed-layout PDF. Bills exactly one
// source — either one License or one Demo (never both, never neither) — and is
// issued automatically when that source is created. Bill-to, amount, and
// description are snapshotted at issue so it is a self-contained historical
// document. Status (Paid/Unpaid/Overdue/Voided) is derived, not stored. Never
// hard-deleted or edited — the only correction is atomic void & reissue.
// See ADR-0001 / ADR-0002.
export const invoice = pgTable(
  'invoice',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Gapless sequential number allocated from app_setting under a row lock,
    // in the same transaction as this insert. See ADR-0001.
    number: integer('number').notNull().unique(),
    // Polymorphic source — exactly one is set (enforced by the check below).
    licenseId: uuid('license_id').references(() => license.id, {
      onDelete: 'restrict',
    }),
    demoId: uuid('demo_id').references(() => demo.id, {
      onDelete: 'restrict',
    }),
    // Bill-to block frozen from the source's Payer at issue time.
    billToName: text('bill_to_name').notNull(),
    billToEmail: text('bill_to_email'),
    billToAddress: text('bill_to_address'),
    // Frozen from the source License/Demo fee at issue time.
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    description: text('description').notNull(),
    issueDate: date('issue_date').notNull(),
    // Overdue is computed against this. Defaults to issue + 30 (Net 30), editable.
    dueDate: date('due_date').notNull(),
    // Manual entry; present => Paid. Anchors cash-basis sales reports.
    paidDate: date('paid_date'),
    // Present => Voided (keeps the number, excluded from receivables).
    voidedAt: timestamp('voided_at'),
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
    // Partial uniques enforce ADR-0002's invariant: at most one LIVE invoice
    // per License/Demo, while voided invoices accumulate as history.
    uniqueIndex('invoice_license_live_uq')
      .on(table.licenseId)
      .where(sql`${table.voidedAt} IS NULL`),
    uniqueIndex('invoice_demo_live_uq')
      .on(table.demoId)
      .where(sql`${table.voidedAt} IS NULL`),
    // Plain indexes keep full-history lookups (incl. voided) off seq scans.
    index('invoice_license_idx').on(table.licenseId),
    index('invoice_demo_idx').on(table.demoId),
    index('invoice_due_date_idx').on(table.dueDate),
    index('invoice_paid_date_idx').on(table.paidDate),
    // Exactly one source: a license invoice XOR a demo invoice.
    check(
      'invoice_exactly_one_source',
      sql`num_nonnulls(${table.licenseId}, ${table.demoId}) = 1`,
    ),
  ],
);
