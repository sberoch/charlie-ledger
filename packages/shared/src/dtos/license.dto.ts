import { z } from "zod"
import {
  ExclusivityTierSchema,
  TermLengthSchema,
  UsageTypeSchema,
} from "../domain/enums"
import { IsoDateSchema, MoneySchema, UuidSchema } from "../domain/primitives"
import { InvoiceStatusSchema } from "./invoice.dto"

// License — the heart of the system. Created born-invoiced (ADR-0002).

/** Live-invoice summary embedded on license/demo reads. Carries the snapshot
 *  fields (amount, billToName) so the UI can flag divergence after source edits. */
export const SourceInvoiceSchema = z.object({
  id: UuidSchema,
  number: z.number().int(),
  status: InvoiceStatusSchema,
  amount: MoneySchema,
  billToName: z.string(),
})

export const LicenseSchema = z.object({
  id: UuidSchema,
  /** Null only for a trackless work_for_hire license (ADR-0013). */
  trackId: UuidSchema.nullable(),
  trackName: z.string().nullable(),
  brandId: UuidSchema,
  brandName: z.string(),
  categoryName: z.string(),
  payerId: UuidSchema,
  payerName: z.string(),
  /** One or more media this License grants (ADR-0004). Canonically ordered. */
  usageTypes: z.array(UsageTypeSchema).min(1),
  exclusivityTier: ExclusivityTierSchema,
  termLength: TermLengthSchema,
  fee: MoneySchema,
  startDate: IsoDateSchema,
  /** Source of truth for expiration; null = perpetual. */
  endDate: IsoDateSchema.nullable(),
  renewedToId: UuidSchema.nullable(),
  notes: z.string().nullable(),
  /** Freeform grant scope; snapshotted onto the invoice. See ADR-0003. */
  terms: z.string().nullable(),
  /** The one live invoice (ADR-0002 invariant). */
  invoice: SourceInvoiceSchema,
  createdAt: z.string(),
})
export type LicenseDto = z.infer<typeof LicenseSchema>

export const LicenseDetailSchema = LicenseSchema.extend({
  /** Succession chain context (Renewed → / ← Renews). */
  renewedTo: z
    .object({ id: UuidSchema, brandName: z.string(), startDate: IsoDateSchema })
    .nullable(),
  renewedFrom: z.array(
    z.object({
      id: UuidSchema,
      brandName: z.string(),
      endDate: IsoDateSchema.nullable(),
    })
  ),
  /** Full invoice history for this license, voided included. */
  invoices: z.array(
    z.object({
      id: UuidSchema,
      number: z.number().int(),
      status: InvoiceStatusSchema,
      issueDate: IsoDateSchema,
    })
  ),
})
export type LicenseDetailDto = z.infer<typeof LicenseDetailSchema>

/** The one conditional invariant on a License write (ADR-0013). */
export const TRACKLESS_REQUIRES_WFH_MESSAGE =
  "Pick a track, or keep exclusivity at Work For Hire to go without one"

const CreateLicenseBaseSchema = z.object({
  /** Omitted/null → trackless; legal only when exclusivityTier is work_for_hire. */
  trackId: UuidSchema.nullish(),
  brandId: UuidSchema,
  payerId: UuidSchema,
  /** At least one medium required; normalised (deduped/sorted) server-side. */
  usageTypes: z.array(UsageTypeSchema).min(1, "Pick at least one usage type"),
  exclusivityTier: ExclusivityTierSchema,
  termLength: TermLengthSchema,
  fee: MoneySchema,
  startDate: IsoDateSchema,
  /** Omitted → seeded from start + term; must be omitted/null for perpetual. */
  endDate: IsoDateSchema.nullish(),
  notes: z.string().trim().max(2000).nullish(),
  /** Optional grant scope printed on the invoice; empty → auto-composed line. */
  terms: z.string().trim().max(2000).nullish(),
})

// Trackless ⇒ work_for_hire, enforced here for create. Update is a partial
// (trackId omitted ≠ cleared), so the service re-checks the merged row —
// the same invariant, applied to every write either way.
export const CreateLicenseSchema = CreateLicenseBaseSchema.extend({
  /** The born invoice's issue date — omitted → today (ADR-0014). Create-only:
   *  after birth, dates change on the invoice itself, never via the license. */
  issueDate: IsoDateSchema.optional(),
}).superRefine(
  (val, ctx) => {
    if (!val.trackId && val.exclusivityTier !== "work_for_hire") {
      ctx.addIssue({
        code: "custom",
        path: ["trackId"],
        message: TRACKLESS_REQUIRES_WFH_MESSAGE,
      })
    }
  }
)
export type CreateLicenseInput = z.infer<typeof CreateLicenseSchema>

export const UpdateLicenseSchema = CreateLicenseBaseSchema.partial()
export type UpdateLicenseInput = z.infer<typeof UpdateLicenseSchema>

export const LicenseListQuerySchema = z.object({
  urgency: z.enum(["urgent", "expiring_soon", "active", "expired"]).optional(),
  usageType: UsageTypeSchema.optional(),
  termLength: TermLengthSchema.optional(),
  trackId: UuidSchema.optional(),
  search: z.string().trim().min(1).optional(),
})
export type LicenseListQuery = z.infer<typeof LicenseListQuerySchema>

/** Forward-only succession pointer (Renewal). */
export const SetRenewedToSchema = z.object({
  renewedToId: UuidSchema.nullable(),
})
export type SetRenewedToInput = z.infer<typeof SetRenewedToSchema>

// ── Exclusivity collision warning (advisory, never blocking) ────────────────

export const CollisionCheckQuerySchema = z.object({
  trackId: UuidSchema,
  brandId: UuidSchema,
  exclusivityTier: ExclusivityTierSchema,
  /** Exclude when re-checking an existing license being edited. */
  excludeLicenseId: UuidSchema.optional(),
})
export type CollisionCheckQuery = z.infer<typeof CollisionCheckQuerySchema>

export const CollisionWarningSchema = z.object({
  licenseId: UuidSchema,
  brandName: z.string(),
  categoryName: z.string(),
  exclusivityTier: ExclusivityTierSchema,
  endDate: IsoDateSchema.nullable(),
  /** Human sentence, e.g. "Subaru holds category exclusivity on Empire in Automotive until May 19, 2026". */
  message: z.string(),
})
export type CollisionWarningDto = z.infer<typeof CollisionWarningSchema>

export const CollisionCheckResultSchema = z.object({
  collisions: z.array(CollisionWarningSchema),
})
export type CollisionCheckResult = z.infer<typeof CollisionCheckResultSchema>

// ── "Similar Past Licenses" pricing reference ───────────────────────────────

export const SimilarLicensesQuerySchema = z.object({
  // Arrives as a CSV query param (e.g. "broadcast,social_media"); matched by
  // overlap against past licenses' usage sets (ADR-0004).
  usageTypes: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(UsageTypeSchema).min(1)),
  exclusivityTier: ExclusivityTierSchema,
  termLength: TermLengthSchema,
  trackId: UuidSchema.optional(),
})
export type SimilarLicensesQuery = z.infer<typeof SimilarLicensesQuerySchema>

export const SimilarLicensesResultSchema = z.object({
  rows: z.array(
    z.object({
      licenseId: UuidSchema,
      brandName: z.string(),
      trackName: z.string().nullable(),
      fee: MoneySchema,
      startDate: IsoDateSchema,
    })
  ),
  summary: z
    .object({
      count: z.number().int(),
      avg: MoneySchema,
      min: MoneySchema,
      max: MoneySchema,
    })
    .nullable(),
})
export type SimilarLicensesResult = z.infer<typeof SimilarLicensesResultSchema>
