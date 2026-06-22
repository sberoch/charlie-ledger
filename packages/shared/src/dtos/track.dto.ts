import { z } from "zod"
import { TrackStatusSchema } from "../domain/enums"
import { IsoDateSchema, MoneySchema, UuidSchema } from "../domain/primitives"

// Track — a catalog read model. Tags are platform-owned (assigned via
// track_tag) and surface here as a flat name array. See CONTEXT.md.

// One license in a Track's history — Brand it was licensed to and the span it
// ran. Deliberately fee-free: license history is a share-safe artifact even
// though the financial columns are not. See CONTEXT.md / Track export.
export const TrackLicenseHistoryItemSchema = z.object({
  brandName: z.string(),
  startDate: IsoDateSchema,
  /** Null = perpetual ("ongoing"). */
  endDate: IsoDateSchema.nullable(),
})
export type TrackLicenseHistoryItemDto = z.infer<
  typeof TrackLicenseHistoryItemSchema
>

export const TrackListItemSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  tags: z.array(z.string()),
  status: TrackStatusSchema,
  licenseCount: z.number().int(),
  /** Lifetime sales — Σ License fees, commitment basis. */
  lifetimeSales: MoneySchema,
  lastLicensedAt: IsoDateSchema.nullable(),
  /** Full license history (chronological, no fees). Present only on exports
   *  that opt into `history`; undefined everywhere else. */
  licenses: z.array(TrackLicenseHistoryItemSchema).optional(),
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
  // Independent of `financials` — opts into the per-track license history
  // (brands + spans, never fees). All four combinations are valid.
  history: z
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
