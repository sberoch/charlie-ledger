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

/** Earnings (CONTEXT.md): the combined, window-scoped income figure across all
 *  three streams on a COMMITMENT basis — Σ live invoice amounts anchored on
 *  issue date (paid or not, voided excluded) + Σ royalty payments on their own
 *  date. Deliberately distinct from the Report's cash-basis Total income. */
export const EarningsSchema = z.object({
  /** Current month, 1st → today. */
  monthToDate: MoneySchema,
  /** The FULL same month last year — a fixed reference figure, not a pace cut. */
  lastYearMonth: MoneySchema,
  /** Jan 1 → today. */
  yearToDate: MoneySchema,
  /** Jan 1 → same date LAST year (same-date cutoff, unlike the month figure). */
  lastYearToDate: MoneySchema,
  /** Receivables: live invoices with no paid date, all-time. A subset of
   *  earnings already booked — "of what's committed, this much hasn't landed". */
  unpaid: z.object({
    amount: MoneySchema,
    count: z.number().int(),
    /** The Overdue slice of the above (due date past, still unpaid). */
    overdueAmount: MoneySchema,
    overdueCount: z.number().int(),
  }),
})

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

/** The demo box reads as Charlie's output pace, anchored on the Demo's OWN
 *  writtenAt (not invoice issue date): demos written + their fees, this year
 *  against last year cut off at the same date — the dashboard's uniform paced
 *  comparator. Never mixed into lifetime sales. */
export const DemoIncomeSchema = z.object({
  /** Demos written Jan 1 → today. */
  ytdCount: z.number().int(),
  /** Σ their fees — YTD demo income, commitment basis. */
  ytdIncome: MoneySchema,
  /** Jan 1 → same date LAST year (paced, like the Earnings YTD pair). */
  lastYearToDateCount: z.number().int(),
  lastYearToDateIncome: MoneySchema,
  openCount: z.number().int(),
  convertedCount: z.number().int(),
})

/** Royalty income — the third stream, inherently cash basis: a royalty payment
 *  records money already received on its own date (ADR-0009). YTD against the
 *  same paced comparator as the demo box; a mid-quarter dip vs last year is
 *  usually PRO distribution timing, not lost income. */
export const RoyaltyIncomeSchema = z.object({
  ytdTotal: MoneySchema,
  ytdPaymentCount: z.number().int(),
  lastYearToDateTotal: MoneySchema,
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

/** One donut slice of the Tag trend. Per individual tag, so a multi-tag
 *  track's fee counts toward each of its tags — the amounts over-sum by design
 *  (like the Report's Usage Type rows); `share` is therefore normalized
 *  against the window's tag-weighted sum, the same move as the usage donut
 *  (ADR-0004), so slices partition to 100%. See CONTEXT.md "Tag trend". */
export const TagShareSchema = z.object({
  tag: z.string(),
  /** Absolute fee weight touching this tag in-window (overlapping). */
  amount: MoneySchema,
  /** Share of the tag-weighted sum, 0–1. */
  share: z.number(),
  /** Licenses on tracks carrying this tag, in-window. */
  licenseCount: z.number().int(),
  /** Per-brand breakdown, expanded on slice/legend tap. Empty for "Other". */
  brands: z.array(z.object({ brandName: z.string(), amount: MoneySchema })),
  /** The aggregated tail beyond the top slices. */
  isOther: z.boolean(),
})
export type TagShareDto = z.infer<typeof TagShareSchema>

/** Side-by-side windows, anchored on the live invoice's issue date like every
 *  commitment figure: YTD beside last year cut off at the same date. */
export const TagTrendSchema = z.object({
  ytd: z.array(TagShareSchema),
  lastYearToDate: z.array(TagShareSchema),
})
export type TagTrendDto = z.infer<typeof TagTrendSchema>

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
  earnings: EarningsSchema,
  atRisk: AtRiskSchema,
  readyDemos: z.array(ReadyDemoSchema),
  demoIncome: DemoIncomeSchema,
  royaltyIncome: RoyaltyIncomeSchema,
  topTracks: z.array(TopTrackSchema),
  licenseMix: z.array(MixSliceSchema),
  tagTrend: TagTrendSchema,
  activity: z.array(ActivityItemSchema),
})
export type DashboardDto = z.infer<typeof DashboardSchema>
