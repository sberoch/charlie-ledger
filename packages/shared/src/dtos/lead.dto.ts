import { z } from "zod"
import {
  IsoDateSchema,
  SignedMoneySchema,
  UuidSchema,
} from "../domain/primitives"

// Lead — a freeform line in Charlie's personal ledger (ADR-0005). A
// (date, description, amount) row with optional, independent links to a Brand,
// License, Demo, and/or Track. Walled off: never reconciled, never feeds rollups.
// Amount is signed. Not a sales prospect — see CONTEXT.md.

export const LeadSchema = z.object({
  id: UuidSchema,
  date: IsoDateSchema,
  description: z.string(),
  amount: SignedMoneySchema,
  brandId: UuidSchema.nullable(),
  brandName: z.string().nullable(),
  licenseId: UuidSchema.nullable(),
  /** "Track × Brand" of the linked License, for display. */
  licenseLabel: z.string().nullable(),
  demoId: UuidSchema.nullable(),
  /** Working name of the linked Demo, for display. */
  demoLabel: z.string().nullable(),
  trackId: UuidSchema.nullable(),
  /** Name of the linked Track, for display. */
  trackName: z.string().nullable(),
  createdAt: z.string(),
})
export type LeadDto = z.infer<typeof LeadSchema>

export const CreateLeadSchema = z.object({
  date: IsoDateSchema,
  description: z.string().trim().min(1).max(500),
  amount: SignedMoneySchema,
  /** Optional, independent links — any combination, including none. */
  brandId: UuidSchema.nullish(),
  licenseId: UuidSchema.nullish(),
  demoId: UuidSchema.nullish(),
  trackId: UuidSchema.nullish(),
})
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>

export const UpdateLeadSchema = CreateLeadSchema.partial()
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>
