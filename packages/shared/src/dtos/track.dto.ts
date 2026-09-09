import { z } from "zod"
import {
  ExclusivityTierSchema,
  TermLengthSchema,
  TrackStatusSchema,
  UsageTypeSchema,
} from "../domain/enums"
import { IsoDateSchema, MoneySchema, UuidSchema } from "../domain/primitives"

// Track — a catalog read model. Tags are platform-owned (assigned via
// track_tag) and surface here as a flat name array. See CONTEXT.md.

// One license in a Track's history — the Brand, the span it ran, and what was
// granted (media, exclusivity, term), mirroring the track page's timeline.
// The fee rides along ONLY when the export also opts into financials: history
// on its own stays a share-safe artifact. See CONTEXT.md / Track export.
export const TrackLicenseHistoryItemSchema = z.object({
  brandName: z.string(),
  startDate: IsoDateSchema,
  /** Null = perpetual ("ongoing"). */
  endDate: IsoDateSchema.nullable(),
  usageTypes: z.array(UsageTypeSchema),
  exclusivityTier: ExclusivityTierSchema,
  termLength: TermLengthSchema,
  /** Present only on exports with financials. */
  fee: MoneySchema.optional(),
})
export type TrackLicenseHistoryItemDto = z.infer<
  typeof TrackLicenseHistoryItemSchema
>

export const TrackListItemSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  tags: z.array(z.string()),
  /** The library release this track belongs to; null = "No album". */
  album: z.string().nullable(),
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
  /** Full license history, newest first (fees only with financials). Present
   *  only on exports that opt into `history`; undefined everywhere else. */
  licenses: z.array(TrackLicenseHistoryItemSchema).optional(),
})
export type TrackListItemDto = z.infer<typeof TrackListItemSchema>

export const TrackListQuerySchema = z.object({
  /** Comma-separated terms, any of which matches the name (splitSearchTerms). */
  search: z.string().trim().min(1).optional(),
  tag: z.string().optional(),
  /** An album name, or NO_ALBUM_FILTER for the tracks that have none. */
  album: z.string().optional(),
  status: TrackStatusSchema.optional(),
  /** "Sell this" lens — active Tracks whose Sell signal fires. A filter over
   *  the derived flag, never a fourth status (CONTEXT.md "Sell signal"). */
  sell: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
})
export type TrackListQuery = z.infer<typeof TrackListQuerySchema>
/** The wire shape (pre-transform) — what the web sends; `sell` rides as "true". */
export type TrackListQueryInput = z.input<typeof TrackListQuerySchema>

// Create — name + tags. Tags are submitted as a flat name array and resolved
// server-side via case-insensitive pick-or-create (an unknown name mints a new
// Tag), then synced into track_tag. `status` is never set here — a new Track is
// always active; archive/unarchive is a separate action. See CONTEXT.md / ADR-0006.
export const CreateTrackSchema = z.object({
  name: z.string().trim().min(1).max(120),
  // Always present (the form sends `[]` for an untagged track); kept required —
  // not defaulted — so the RHF input/output types stay identical.
  tags: z.array(z.string().trim().min(1).max(80)),
  // Album by NAME, resolved server-side via case-insensitive pick-or-create
  // (an unknown name mints a new Album). Null = "No album".
  album: z.string().trim().min(1).max(120).nullable(),
})
export type CreateTrackInput = z.infer<typeof CreateTrackSchema>

// Update — same shape, all optional. An omitted `tags` leaves assignments
// untouched; an empty array clears them. An omitted `album` leaves it alone;
// null clears it to "No album".
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
