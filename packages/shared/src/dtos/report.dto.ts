import { z } from "zod"
import { IsoDateSchema, MoneySchema, SignedMoneySchema } from "../domain/primitives"

// Sales report — dual basis, COMMITMENT by default: live invoices anchored on
// issue_date, paid or not (voided excluded) — the same anchor as the dashboard
// Earnings, so the two agree per window. Flipping to CASH restores the
// money-landed pull (paid invoices anchored on paid_date) — kept for tax time.
// See ADR-0012. Royalties are unaffected: money received, on its own date,
// under either basis.
//
// The `includeLeads` flag punches a deliberate hole in either wall: when on,
// the atomic unit becomes "money event = in-range invoice OR personal-ledger
// lead". Leads (signed, often fictional splits) blend into the rows and grand
// total by Charlie's choice — accepting the double-count — so the money-bearing
// fields below become SIGNED. Default off keeps the pure invoice report. See
// ADR-0005.

export const ReportGroupBySchema = z.enum([
  "brand",
  "payer",
  "track",
  "usage_type",
  // One row per live invoice — the finest partition (Σ rows = grand total,
  // like brand/payer/track). Feeds the dashboard's month-income dialog, which
  // renders this same pull so the box and its breakdown can never drift.
  "invoice",
])
export type ReportGroupBy = z.infer<typeof ReportGroupBySchema>

export const REPORT_GROUP_BY_LABELS: Record<ReportGroupBy, string> = {
  brand: "Brand",
  payer: "Payer",
  track: "Track",
  usage_type: "Usage Type",
  invoice: "Invoice",
}

export const ReportBasisSchema = z.enum(["commitment", "cash"])
export type ReportBasis = z.infer<typeof ReportBasisSchema>

export const REPORT_BASIS_LABELS: Record<ReportBasis, string> = {
  commitment: "Commitment",
  cash: "Cash",
}

/** One-line meaning of each basis, shown under the picker and on exports. */
export const REPORT_BASIS_NOTES: Record<ReportBasis, string> = {
  commitment:
    "Invoices count from their issue date, paid or not (voided excluded).",
  cash: "Paid invoices only, counted on the date they were paid.",
}

export const ReportQuerySchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
  groupBy: ReportGroupBySchema,
  /** Which invoices count, and on which date (see header). Default commitment. */
  basis: ReportBasisSchema.default("commitment"),
  /** Blend personal-ledger leads into the rows + grand total. Arrives as a
   *  query-string "true"/"false"; default off (pure invoice report). */
  includeLeads: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .default(false),
})
export type ReportQuery = z.infer<typeof ReportQuerySchema>

export const ReportRowSchema = z.object({
  /** Group label ("A24", "Broadcast", …). Demo invoices group under track/usage
   *  as "— Demos"; blended leads that don't fit the grouping fall to "— Leads". */
  label: z.string(),
  /** Invoices on the chosen basis (all live under commitment, paid-only under
   *  cash) — leads add money to a row but never to this count. */
  invoiceCount: z.number().int(),
  /** Signed: a net-negative lead can pull a row below zero. */
  total: SignedMoneySchema,
})
export type ReportRowDto = z.infer<typeof ReportRowSchema>

/** One payer's royalties within the Royalties section (ADR-0009). */
export const RoyaltyReportRowSchema = z.object({
  /** Payer name ("BMI", "American Federation of Musicians"). */
  label: z.string(),
  paymentCount: z.number().int(),
  total: MoneySchema,
})
export type RoyaltyReportRowDto = z.infer<typeof RoyaltyReportRowSchema>

export const ReportResultSchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
  groupBy: ReportGroupBySchema,
  basis: ReportBasisSchema,
  rows: z.array(ReportRowSchema),
  /** The SALES total — Σ in-range invoices on the chosen basis (plus leads
   *  when blended). Royalties never enter this figure or the rows above
   *  (ADR-0009). */
  grandTotal: SignedMoneySchema,
  /** Invoices behind the sales rows: every live invoice in range under
   *  commitment, paid-only under cash. */
  invoiceCount: z.number().int(),
  /** Whether personal-ledger leads were blended into the figures above. */
  includeLeads: z.boolean(),
  /** Signed sum of the leads folded in (0 when includeLeads is off). Counted
   *  once per lead even where usage-type fan-out makes the rows over-sum. */
  leadTotal: SignedMoneySchema,
  /** Royalties section — a SEPARATE partition, never mixed into the groupings
   *  above: royalty payments in range, anchored on their own date, grouped by
   *  Payer (ADR-0009). */
  royaltyRows: z.array(RoyaltyReportRowSchema),
  royaltyTotal: MoneySchema,
  royaltyPaymentCount: z.number().int(),
  /** grandTotal + royaltyTotal — total income on the chosen basis. */
  totalIncome: SignedMoneySchema,
})
export type ReportResultDto = z.infer<typeof ReportResultSchema>
