import { z } from "zod"
import { IsoDateSchema, MoneySchema } from "../domain/primitives"

// Sales report — CASH basis: a sale appears once its invoice is Paid, anchored
// on paid_date. Deliberately diverges from lifetime sales (commitment basis).

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
})
export type ReportQuery = z.infer<typeof ReportQuerySchema>

export const ReportRowSchema = z.object({
  /** Group label ("A24", "Broadcast", …). Demo invoices group under track as "— Demos". */
  label: z.string(),
  invoiceCount: z.number().int(),
  total: MoneySchema,
})
export type ReportRowDto = z.infer<typeof ReportRowSchema>

export const ReportResultSchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
  groupBy: ReportGroupBySchema,
  rows: z.array(ReportRowSchema),
  grandTotal: MoneySchema,
  paidInvoiceCount: z.number().int(),
})
export type ReportResultDto = z.infer<typeof ReportResultSchema>
