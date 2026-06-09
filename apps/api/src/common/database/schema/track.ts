import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { trackStatus } from "./enums";

// A read-only mirror of a Disco track. Identity, name, and tags are owned by
// Disco and propagate one-way on sync; never edited or deleted by the platform.
// Absent from a sync => soft-archived (status flips), never removed. See CONTEXT.md.
export const track = pgTable(
  "track",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Mirror key — sync upserts match on this.
    discoId: text("disco_id").notNull().unique(),
    name: text("name").notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: trackStatus("status").notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Supports tag-chip filtering and the tag-combination trend analytics.
    index("track_tags_gin_idx").using("gin", table.tags),
  ],
);
