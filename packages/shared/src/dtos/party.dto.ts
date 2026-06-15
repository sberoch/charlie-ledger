import { z } from "zod"
import { UuidSchema } from "../domain/primitives"

// Brand, Category, Payer — the three pick-or-create lookups. Pick-or-create is
// resolved client-side: the combobox POSTs the new row first, then uses its id.

export const BrandCategorySchema = z.object({
  id: UuidSchema,
  name: z.string(),
  brandCount: z.number().int().optional(),
})
export type BrandCategoryDto = z.infer<typeof BrandCategorySchema>

export const CreateBrandCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
})
export type CreateBrandCategoryInput = z.infer<typeof CreateBrandCategorySchema>

export const RenameBrandCategorySchema = CreateBrandCategorySchema

export const BrandSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  categoryId: UuidSchema,
  categoryName: z.string(),
})
export type BrandDto = z.infer<typeof BrandSchema>

export const CreateBrandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: UuidSchema,
})
export type CreateBrandInput = z.infer<typeof CreateBrandSchema>

export const UpdateBrandSchema = CreateBrandSchema.partial()
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>

export const PayerSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  email: z.string().nullable(),
  address: z.string().nullable(),
})
export type PayerDto = z.infer<typeof PayerSchema>

export const CreatePayerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().nullish(),
  // Single free-form block — US + international formats are inconsistent.
  address: z.string().trim().max(600).nullish(),
})
export type CreatePayerInput = z.infer<typeof CreatePayerSchema>

export const UpdatePayerSchema = CreatePayerSchema.partial()
export type UpdatePayerInput = z.infer<typeof UpdatePayerSchema>
