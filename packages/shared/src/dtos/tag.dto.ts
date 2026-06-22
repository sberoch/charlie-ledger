import { z } from "zod"
import { UuidSchema } from "../domain/primitives"

// Tag — the curated, platform-owned catalog vocabulary, managed from Settings.
// `usageCount` is the number of tracks carrying the tag (drives the row label
// and the delete-confirm). Create is pick-or-create by case-insensitive name;
// rename reuses the create shape. See CONTEXT.md ("Tag").

export const TagSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  usageCount: z.number().int(),
})
export type TagDto = z.infer<typeof TagSchema>

export const CreateTagSchema = z.object({
  name: z.string().trim().min(1).max(80),
})
export type CreateTagInput = z.infer<typeof CreateTagSchema>

export const RenameTagSchema = CreateTagSchema
