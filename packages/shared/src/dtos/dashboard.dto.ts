import { z } from "zod"
import { UsageTypeSchema } from "../domain/enums"
import { IsoDateSchema, MoneySchema, UuidSchema } from "../domain/primitives"

// Dashboard read models, in the locked mobile scroll order.

export const DashboardSummarySchema = z.object({
  trackCount: z.number().int(),
  activeLicenseCount: z.number().int(),
  expiringThisWeekCount: z.number().int(),
})

/** One dot on the upcoming timeline — a license expiring (risk, rust/ochre),
 *  a demo hold lifting (opportunity, distinct marker), or a Reminder (a stored,
 *  actionable nudge; ADR-0007). Expirations/hold-lifts are derived live and drop
 *  off at their date; a reminder persists past its date as overdue until done. */
export const TimelineItemSchema = z.object({
  kind: z.enum(["license_expiration", "demo_hold_lift", "reminder"]),
  /** Source entity id — the license/demo for derived items, and the reminder's
   *  OWN id for a reminder (the "done" action targets the reminder itself). */
  sourceId: UuidSchema,
  date: IsoDateSchema,
  /** Days until `date`; negative when overdue (reminders only — derived items
   *  never go negative, they leave the timeline at their date). */
  daysOut: z.number().int(),
  /** "Empire × Subaru" / "Walmart_SpringSale_v1a" / a reminder's title. */
  title: z.string(),
  /** "Broadcast · 1yr · Cat. Exclusive" / "Hold lifts · Music house name" / a
   *  reminder's description. */
  meta: z.string(),
  /** Null for reminders, which carry no fee. */
  fee: MoneySchema.nullable(),
  urgency: z.enum(["urgent", "expiring_soon", "active", "expired"]),
})
export type TimelineItemDto = z.infer<typeof TimelineItemSchema>

export const AtRiskSchema = z.object({
  /** Σ fees of licenses expiring within 60 days. */
  amount: MoneySchema,
  licenseCount: z.number().int(),
  /** Share of expired licenses with renewed_to_id set; null when none expired yet. */
  renewalRate: z.number().min(0).max(1).nullable(),
})

export const ReadyDemoSchema = z.object({
  id: UuidSchema,
  workingName: z.string(),
  brandName: z.string(),
  payerName: z.string(),
  holdEndsAt: IsoDateSchema,
  fee: MoneySchema,
})

export const DemoIncomeSchema = z.object({
  /** Σ Demo fees, commitment basis — never mixed into lifetime sales. */
  total: MoneySchema,
  openCount: z.number().int(),
  convertedCount: z.number().int(),
})

export const TopTrackSchema = z.object({
  trackId: UuidSchema,
  name: z.string(),
  lifetimeSales: MoneySchema,
  licenseCount: z.number().int(),
  tags: z.array(z.string()),
})

export const MixSliceSchema = z.object({
  usageType: UsageTypeSchema,
  /** Absolute fee weight touching this medium (overlapping; see ADR-0004). */
  amount: MoneySchema,
  /** Share of the usage-weighted total, 0–1 — slices partition to 100%. */
  share: z.number(),
})

export const TagTrendRowSchema = z.object({
  /** A single tag (mood). Rows are per individual tag, so a multi-tag track's
   *  fee counts toward each of its tags — totals over-sum by design (like the
   *  Report's Usage Type rows). See CONTEXT.md "Tag trend". */
  tag: z.string(),
  total: MoneySchema,
  /** Licenses on tracks carrying this tag. */
  licenseCount: z.number().int(),
  /** Per-brand breakdown, expanded on tap. */
  brands: z.array(z.object({ brandName: z.string(), amount: MoneySchema })),
})
export type TagTrendRowDto = z.infer<typeof TagTrendRowSchema>

export const ActivityItemSchema = z.object({
  kind: z.enum([
    "license_created",
    "demo_created",
    "demo_converted",
    "invoice_paid",
  ]),
  at: z.string(),
  sourceId: UuidSchema,
  title: z.string(),
  meta: z.string(),
  amount: MoneySchema.nullable(),
})
export type ActivityItemDto = z.infer<typeof ActivityItemSchema>

export const DashboardSchema = z.object({
  summary: DashboardSummarySchema,
  timeline: z.array(TimelineItemSchema),
  atRisk: AtRiskSchema,
  readyDemos: z.array(ReadyDemoSchema),
  demoIncome: DemoIncomeSchema,
  topTracks: z.array(TopTrackSchema),
  licenseMix: z.array(MixSliceSchema),
  tagTrend: z.array(TagTrendRowSchema),
  activity: z.array(ActivityItemSchema),
})
export type DashboardDto = z.infer<typeof DashboardSchema>
