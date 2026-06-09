import {
  type AnyPgColumn,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { brand } from "./brand";
import { exclusivityTier, termLength, usageType } from "./enums";
import { payer } from "./payer";
import { track } from "./track";

// A grant of a Track's use to a Brand under specific terms. References exactly
// one Track, one Brand, and one Payer (all required). A Track's lifetime sales
// roll up its License fees on a commitment basis. See CONTEXT.md.
export const license = pgTable(
  "license",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // RESTRICT: a referenced track/brand/payer cannot be hard-deleted.
    trackId: uuid("track_id")
      .notNull()
      .references(() => track.id, { onDelete: "restrict" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "restrict" }),
    payerId: uuid("payer_id")
      .notNull()
      .references(() => payer.id, { onDelete: "restrict" }),
    usageType: usageType("usage_type").notNull(),
    exclusivityTier: exclusivityTier("exclusivity_tier").notNull(),
    termLength: termLength("term_length").notNull(),
    fee: numeric("fee", { precision: 12, scale: 2 }).notNull(),
    startDate: date("start_date").notNull(),
    // Source of truth for expiration. Seeded from start + term but editable;
    // null for a perpetual term (never expires).
    endDate: date("end_date"),
    // Forward-only manual succession pointer to the replacing License.
    renewedToId: uuid("renewed_to_id").references(
      (): AnyPgColumn => license.id,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("license_track_idx").on(table.trackId),
    index("license_brand_idx").on(table.brandId),
    index("license_payer_idx").on(table.payerId),
    // Drives the expiration timeline and weekly digest.
    index("license_end_date_idx").on(table.endDate),
  ],
);
