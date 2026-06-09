import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

// The billing counterparty an Invoice is addressed to. A Demo's commissioning
// "music house" is a Payer in that role. The bill-to block (name/email/address)
// is snapshotted onto invoices at issue time. See CONTEXT.md.
export const payer = pgTable("payer", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  // Single free-form block — the invoice PDF is a fixed custom layout and
  // addresses are US + international with inconsistent formats.
  address: text("address"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
