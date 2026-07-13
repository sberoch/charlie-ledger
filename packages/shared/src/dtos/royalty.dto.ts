import { z } from "zod"
import { IsoDateSchema, MoneySchema, UuidSchema } from "../domain/primitives"

// Royalty payment — royalty income Charlie RECEIVED (ADR-0009). Not an
// invoice: nothing issued, no lifecycle — a flat (date, payer, description?,
// amount) row. The counterparty is a Payer (reused). Optional independent
// links to Brand / Track / License, the Lead trio pattern. Fully mutable.
// Feeds the Report's Royalties section and the dashboard's Royalty income.

export const RoyaltyPaymentSchema = z.object({
  id: UuidSchema,
  date: IsoDateSchema,
  payerId: UuidSchema,
  payerName: z.string(),
  /** Optional — a bare BMI row is self-explanatory. */
  description: z.string().nullable(),
  /** Non-negative; zero allowed (a royalty event that paid nothing). */
  amount: MoneySchema,
  brandId: UuidSchema.nullable(),
  brandName: z.string().nullable(),
  trackId: UuidSchema.nullable(),
  /** Name of the linked Track, for display. */
  trackName: z.string().nullable(),
  licenseId: UuidSchema.nullable(),
  /** "Track × Brand" of the linked License, for display. */
  licenseLabel: z.string().nullable(),
  createdAt: z.string(),
})
export type RoyaltyPaymentDto = z.infer<typeof RoyaltyPaymentSchema>

export const CreateRoyaltyPaymentSchema = z.object({
  date: IsoDateSchema,
  payerId: UuidSchema,
  description: z.string().trim().max(500).nullish(),
  amount: MoneySchema,
  /** Optional, independent links — any combination, including none. */
  brandId: UuidSchema.nullish(),
  trackId: UuidSchema.nullish(),
  licenseId: UuidSchema.nullish(),
})
export type CreateRoyaltyPaymentInput = z.infer<
  typeof CreateRoyaltyPaymentSchema
>

export const UpdateRoyaltyPaymentSchema = CreateRoyaltyPaymentSchema.partial()
export type UpdateRoyaltyPaymentInput = z.infer<
  typeof UpdateRoyaltyPaymentSchema
>
