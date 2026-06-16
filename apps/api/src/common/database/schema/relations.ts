import { relations } from 'drizzle-orm';
import { brand } from './brand';
import { brandCategory } from './brand-category';
import { demo } from './demo';
import { invoice } from './invoice';
import { lead } from './lead';
import { license } from './license';
import { payer } from './payer';
import { track } from './track';

export const brandCategoryRelations = relations(brandCategory, ({ many }) => ({
  brands: many(brand),
}));

export const brandRelations = relations(brand, ({ one, many }) => ({
  category: one(brandCategory, {
    fields: [brand.categoryId],
    references: [brandCategory.id],
  }),
  licenses: many(license),
  demos: many(demo),
  // Personal-ledger lines optionally attributed to this brand (ADR-0005).
  leads: many(lead),
}));

export const payerRelations = relations(payer, ({ many }) => ({
  licenses: many(license),
  demos: many(demo),
}));

export const trackRelations = relations(track, ({ many }) => ({
  licenses: many(license),
  // Demos whose idea was converted into this track (lineage).
  convertedDemos: many(demo),
}));

export const licenseRelations = relations(license, ({ one, many }) => ({
  track: one(track, {
    fields: [license.trackId],
    references: [track.id],
  }),
  brand: one(brand, {
    fields: [license.brandId],
    references: [brand.id],
  }),
  payer: one(payer, {
    fields: [license.payerId],
    references: [payer.id],
  }),
  // The replacing license (forward succession pointer).
  renewedTo: one(license, {
    fields: [license.renewedToId],
    references: [license.id],
    relationName: 'renewal',
  }),
  // The license(s) this one replaced (reverse of renewedTo).
  renewedFrom: many(license, { relationName: 'renewal' }),
  // One LIVE invoice plus voided history (ADR-0002).
  invoices: many(invoice),
  // Personal-ledger lines optionally attributed to this license (ADR-0005).
  leads: many(lead),
}));

export const demoRelations = relations(demo, ({ one, many }) => ({
  brand: one(brand, {
    fields: [demo.brandId],
    references: [brand.id],
  }),
  payer: one(payer, {
    fields: [demo.payerId],
    references: [payer.id],
  }),
  convertedTrack: one(track, {
    fields: [demo.convertedTrackId],
    references: [track.id],
  }),
  // One LIVE invoice plus voided history (ADR-0002).
  invoices: many(invoice),
  // Personal-ledger lines optionally attributed to this demo (ADR-0005).
  leads: many(lead),
}));

export const leadRelations = relations(lead, ({ one }) => ({
  brand: one(brand, {
    fields: [lead.brandId],
    references: [brand.id],
  }),
  license: one(license, {
    fields: [lead.licenseId],
    references: [license.id],
  }),
  demo: one(demo, {
    fields: [lead.demoId],
    references: [demo.id],
  }),
}));

export const invoiceRelations = relations(invoice, ({ one }) => ({
  license: one(license, {
    fields: [invoice.licenseId],
    references: [license.id],
  }),
  demo: one(demo, {
    fields: [invoice.demoId],
    references: [demo.id],
  }),
}));
