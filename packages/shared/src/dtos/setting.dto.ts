import { z } from "zod"

// App settings (singleton row) + user administration. No self-signup; users
// are added here. Flat shared permissions — no roles.

export const AppSettingsSchema = z.object({
  digestLookaheadDays: z.number().int(),
  /** Exposed so numbering can continue Charlie's existing sequence. */
  nextInvoiceNumber: z.number().int(),
})
export type AppSettingsDto = z.infer<typeof AppSettingsSchema>

export const UpdateAppSettingsSchema = z.object({
  digestLookaheadDays: z.number().int().min(1).max(90).optional(),
  /** Only allowed to move forward, and only while it is still unused. */
  nextInvoiceNumber: z.number().int().min(1).optional(),
})
export type UpdateAppSettingsInput = z.infer<typeof UpdateAppSettingsSchema>

export const AddUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
})
export type AddUserInput = z.infer<typeof AddUserSchema>
