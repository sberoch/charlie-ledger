import { z } from "zod"
import { TrackStatusSchema } from "../domain/enums"
import { IsoDateSchema, MoneySchema, UuidSchema } from "../domain/primitives"

// Track — read-only Disco mirror. The platform never creates or edits one;
// these DTOs are read models only. See CONTEXT.md.

export const TrackListItemSchema = z.object({
  id: UuidSchema,
  discoId: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  status: TrackStatusSchema,
  licenseCount: z.number().int(),
  /** Lifetime sales — Σ License fees, commitment basis. */
  lifetimeSales: MoneySchema,
  lastLicensedAt: IsoDateSchema.nullable(),
})
export type TrackListItemDto = z.infer<typeof TrackListItemSchema>

export const TrackListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  tag: z.string().optional(),
  status: TrackStatusSchema.optional(),
})
export type TrackListQuery = z.infer<typeof TrackListQuerySchema>

// Track export — the Tracks list rendered to CSV/PDF, scoped to the active
// tag/search filter (CONTEXT.md: "Track export"). `financials` opts into the
// license-derived columns; default off keeps the export a share-safe catalog.
export const TrackExportQuerySchema = TrackListQuerySchema.extend({
  financials: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
})
export type TrackExportQuery = z.infer<typeof TrackExportQuerySchema>

export const TrackCategoryPerformanceSchema = z.object({
  categoryId: UuidSchema,
  categoryName: z.string(),
  amount: MoneySchema,
})
export type TrackCategoryPerformanceDto = z.infer<
  typeof TrackCategoryPerformanceSchema
>

export const TrackQuarterSalesSchema = z.object({
  /** e.g. "2026-Q2" */
  quarter: z.string(),
  amount: MoneySchema,
})

export const TrackDetailSchema = TrackListItemSchema.extend({
  lastSyncedAt: z.string().nullable(),
  /** Lifetime revenue per Brand Category, for the performance bars. */
  categoryPerformance: z.array(TrackCategoryPerformanceSchema),
  /** Trailing-24-months sales history by quarter, commitment basis. */
  quarterlySales: z.array(TrackQuarterSalesSchema),
  /** Demos whose idea became this track (lineage). */
  convertedDemos: z.array(
    z.object({ id: UuidSchema, workingName: z.string() })
  ),
})
export type TrackDetailDto = z.infer<typeof TrackDetailSchema>
