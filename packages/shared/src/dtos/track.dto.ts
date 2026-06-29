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
  /** When the track was added to the catalog (date only). */
  createdAt: IsoDateSchema,
  /** "SELL THIS" — derived dead-inventory signal. True for an active track whose
   *  last licensed date (or creation date, if never licensed) is over three years
   *  past. Never stored; computed server-side. See CONTEXT.md "Sell signal". */
  sellRecommended: z.boolean(),
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

// Create — name + tags. Tags are submitted as a flat name array and resolved
// server-side via case-insensitive pick-or-create (an unknown name mints a new
// Tag), then synced into track_tag. `status` is never set here — a new Track is
// always active; archive/unarchive is a separate action. See CONTEXT.md / ADR-0006.
export const CreateTrackSchema = z.object({
  name: z.string().trim().min(1).max(120),
  // Always present (the form sends `[]` for an untagged track); kept required —
  // not defaulted — so the RHF input/output types stay identical.
  tags: z.array(z.string().trim().min(1).max(80)),
})
export type CreateTrackInput = z.infer<typeof CreateTrackSchema>

// Update — same shape, all optional. An omitted `tags` leaves assignments
// untouched; an empty array clears them.
export const UpdateTrackSchema = CreateTrackSchema.partial()
export type UpdateTrackInput = z.infer<typeof UpdateTrackSchema>

// Archive / unarchive — the only door to `status` (PATCH /tracks/:id/status).
export const UpdateTrackStatusSchema = z.object({
  status: TrackStatusSchema,
})
export type UpdateTrackStatusInput = z.infer<typeof UpdateTrackStatusSchema>

// Track import — bulk-add from a Disco CSV export, parsed in the browser and
// POSTed as track DTOs (CONTEXT.md "Track import"). Deliberately a RELAXED clone
// of CreateTrackSchema: `name` keeps the trim + min(1) guard but drops the
// 120-char cap, trusting the source export (the `name` column is unbounded
// `text`). `tags` carries the candidate words the browser pulled from the
// track's COMMENTS column — the server keeps only those matching the curated
// mood vocabulary (allow-list match, never pick-or-create). Dedupe + best-effort
// skipping happen server-side against the case-insensitive natural key.
export const ImportTrackSchema = z.object({
  name: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)),
})
export type ImportTrackInput = z.infer<typeof ImportTrackSchema>

export const ImportTracksSchema = z.object({
  tracks: z.array(ImportTrackSchema),
})
export type ImportTracksInput = z.infer<typeof ImportTracksSchema>

// One row per submitted (distinct) title: `imported` are the names that landed,
// `skipped` the ones already in the catalog (or duplicated within the file).
// Counts drive the toast; the full lists are kept for richer feedback later.
export const ImportTracksResultSchema = z.object({
  imported: z.array(z.string()),
  skipped: z.array(z.string()),
})
export type ImportTracksResultDto = z.infer<typeof ImportTracksResultSchema>

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
