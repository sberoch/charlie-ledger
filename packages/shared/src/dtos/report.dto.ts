import { z } from "zod"
import { IsoDateSchema, MoneySchema, SignedMoneySchema } from "../domain/primitives"

// Sales report — CASH basis: a sale appears once its invoice is Paid, anchored
// on paid_date. Deliberately diverges from lifetime sales (commitment basis).
//
// The `includeLeads` flag punches a deliberate hole in that wall: when on, the
// atomic unit becomes "money event = paid invoice OR personal-ledger lead".
// Leads (signed, often fictional splits) blend into the rows and grand total by
// Charlie's choice — accepting the double-count — so the money-bearing fields
// below become SIGNED. Default off keeps the pure cash-basis report. See ADR-0005.

export const ReportGroupBySchema = z.enum([
  "brand",
  "payer",
  "track",
  "usage_type",
])
export type ReportGroupBy = z.infer<typeof ReportGroupBySchema>

export const REPORT_GROUP_BY_LABELS: Record<ReportGroupBy, string> = {
  brand: "Brand",
  payer: "Payer",
  track: "Track",
  usage_type: "Usage Type",
}

export const ReportQuerySchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
  groupBy: ReportGroupBySchema,
  /** Blend personal-ledger leads into the rows + grand total. Arrives as a
   *  query-string "true"/"false"; default off (pure cash-basis report). */
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
  /** PAID INVOICES only — leads add money to a row but never to this count. */
  invoiceCount: z.number().int(),
  /** Signed: a net-negative lead can pull a row below zero. */
  total: SignedMoneySchema,
})
export type ReportRowDto = z.infer<typeof ReportRowSchema>

export const ReportResultSchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
  groupBy: ReportGroupBySchema,
  rows: z.array(ReportRowSchema),
  /** Signed when leads are blended in. */
  grandTotal: SignedMoneySchema,
  paidInvoiceCount: z.number().int(),
  /** Whether personal-ledger leads were blended into the figures above. */
  includeLeads: z.boolean(),
  /** Signed sum of the leads folded in (0 when includeLeads is off). Counted
   *  once per lead even where usage-type fan-out makes the rows over-sum. */
  leadTotal: SignedMoneySchema,
})
export type ReportResultDto = z.infer<typeof ReportResultSchema>
