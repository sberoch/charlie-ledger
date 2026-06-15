import { z } from "zod"
import {
  EXCLUSIVITY_TIER_LABELS,
  formatUsageTypes,
  type ExclusivityTier,
  type UsageType,
} from "../domain/enums"
import { IsoDateSchema, MoneySchema, UuidSchema } from "../domain/primitives"

// Invoice — born with its source, snapshot-immutable, corrected only by
// atomic void & reissue. Status is derived server-side at read time.

export const InvoiceStatusSchema = z.enum([
  "paid",
  "unpaid",
  "overdue",
  "voided",
])

export const InvoiceSourceKindSchema = z.enum(["license", "demo"])
export type InvoiceSourceKind = z.infer<typeof InvoiceSourceKindSchema>

export const InvoiceSchema = z.object({
  id: UuidSchema,
  number: z.number().int(),
  source: z.object({
    kind: InvoiceSourceKindSchema,
    id: UuidSchema,
    /** "Empire × Subaru" / working name — for lists and the activity feed. */
    title: z.string(),
  }),
  billToName: z.string(),
  billToEmail: z.string().nullable(),
  billToAddress: z.string().nullable(),
  amount: MoneySchema,
  description: z.string(),
  issueDate: IsoDateSchema,
  dueDate: IsoDateSchema,
  paidDate: IsoDateSchema.nullable(),
  voidedAt: z.string().nullable(),
  status: InvoiceStatusSchema,
})
export type InvoiceDto = z.infer<typeof InvoiceSchema>

export const InvoiceListQuerySchema = z.object({
  status: InvoiceStatusSchema.optional(),
  search: z.string().trim().min(1).optional(),
})
export type InvoiceListQuery = z.infer<typeof InvoiceListQuerySchema>

export const MarkPaidSchema = z.object({
  /** Manual entry — anchors cash-basis reports. */
  paidDate: IsoDateSchema,
})
export type MarkPaidInput = z.infer<typeof MarkPaidSchema>

/** Void & reissue is atomic and takes no body: the new invoice re-snapshots
 *  the source's current Payer block and fee. Editable bits may be overridden. */
export const VoidAndReissueSchema = z.object({
  dueDate: IsoDateSchema.optional(),
  description: z.string().trim().max(2000).optional(),
})
export type VoidAndReissueInput = z.infer<typeof VoidAndReissueSchema>

// The description snapshotted onto an invoice at issue (and re-snapshotted on
// void & reissue). A source's freeform Grant terms win when present; otherwise
// an auto-composed line stands in. The single source of truth for both the
// create path and the void-and-reissue path, so they never drift. See ADR-0003.
export function licenseInvoiceDescription(input: {
  trackName: string
  brandName: string
  usageTypes: UsageType[]
  exclusivityTier: ExclusivityTier
  terms?: string | null
}): string {
  const terms = input.terms?.trim()
  if (terms) return terms
  return `Music license — "${input.trackName}" × ${input.brandName} · ${formatUsageTypes(input.usageTypes)} · ${EXCLUSIVITY_TIER_LABELS[input.exclusivityTier]}`
}

export function demoInvoiceDescription(input: {
  brandName: string
  workingName: string
  terms?: string | null
}): string {
  const terms = input.terms?.trim()
  if (terms) return terms
  return `Demo — ${input.brandName} ("${input.workingName}")`
}
