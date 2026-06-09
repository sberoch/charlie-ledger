import { relations } from "drizzle-orm";
import { brand } from "./brand";
import { demo } from "./demo";
import { invoice } from "./invoice";
import { license } from "./license";
import { payer } from "./payer";
import { track } from "./track";

export const brandRelations = relations(brand, ({ many }) => ({
  licenses: many(license),
  demos: many(demo),
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
    relationName: "renewal",
  }),
  // The license(s) this one replaced (reverse of renewedTo).
  renewedFrom: many(license, { relationName: "renewal" }),
  invoice: one(invoice),
}));

export const demoRelations = relations(demo, ({ one }) => ({
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
  invoice: one(invoice),
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
