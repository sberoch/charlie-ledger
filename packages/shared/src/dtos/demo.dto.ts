import { z } from "zod"
import { DemoStatusSchema, HoldPeriodSchema } from "../domain/enums"
import { IsoDateSchema, MoneySchema, UuidSchema } from "../domain/primitives"
import { SourceInvoiceSchema } from "./license.dto"

// Demo — commissioned cue, forward-only, born-invoiced (ADR-0002).
// Hold lifting is NOT a status change; only Conversion moves it off `open`.

export const DemoSchema = z.object({
  id: UuidSchema,
  brandId: UuidSchema,
  brandName: z.string(),
  /** The commissioning music house. */
  payerId: UuidSchema,
  payerName: z.string(),
  fee: MoneySchema,
  workingName: z.string(),
  holdPeriod: HoldPeriodSchema,
  writtenAt: IsoDateSchema,
  holdEndsAt: IsoDateSchema,
  status: DemoStatusSchema,
  /** True once holdEndsAt has passed while still `open` — eligible to convert. */
  holdLifted: z.boolean(),
  convertedTrackId: UuidSchema.nullable(),
  convertedTrackName: z.string().nullable(),
  notes: z.string().nullable(),
  /** Freeform grant scope; snapshotted onto the invoice. See ADR-0003. */
  terms: z.string().nullable(),
  invoice: SourceInvoiceSchema,
  createdAt: z.string(),
})
export type DemoDto = z.infer<typeof DemoSchema>

export const CreateDemoSchema = z.object({
  brandId: UuidSchema,
  payerId: UuidSchema,
  fee: MoneySchema,
  workingName: z.string().trim().min(1).max(200),
  holdPeriod: HoldPeriodSchema,
  writtenAt: IsoDateSchema,
  /** Omitted → seeded from writtenAt + holdPeriod. */
  holdEndsAt: IsoDateSchema.optional(),
  notes: z.string().trim().max(2000).nullish(),
  /** Optional grant scope printed on the invoice; empty → auto-composed line. */
  terms: z.string().trim().max(2000).nullish(),
})
export type CreateDemoInput = z.infer<typeof CreateDemoSchema>

export const UpdateDemoSchema = CreateDemoSchema.partial()
export type UpdateDemoInput = z.infer<typeof UpdateDemoSchema>

/** Conversion is a standalone decision — no Track required (it usually doesn't
 *  exist yet; Charlie builds it in Disco afterwards and may link it later). */
export const ConvertDemoSchema = z.object({
  convertedTrackId: UuidSchema.nullish(),
})
export type ConvertDemoInput = z.infer<typeof ConvertDemoSchema>

/** Optional after-the-fact lineage link, independent of status. */
export const LinkConvertedTrackSchema = z.object({
  convertedTrackId: UuidSchema.nullable(),
})
export type LinkConvertedTrackInput = z.infer<typeof LinkConvertedTrackSchema>

export const DemoListQuerySchema = z.object({
  status: DemoStatusSchema.optional(),
  /** `true` → only open demos whose hold has lifted (ready to reuse). */
  readyToConvert: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).optional(),
})
export type DemoListQuery = z.infer<typeof DemoListQuerySchema>
