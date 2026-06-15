import { z } from "zod"

// Closed vocabularies mirroring the pg enums in apps/api. Labels live here so
// web, API, and the invoice PDF all speak the same dialect. See CONTEXT.md.

export const UsageTypeSchema = z.enum([
  "broadcast",
  "digital_media",
  "social_media",
  "internet",
  "internal",
])
export type UsageType = z.infer<typeof UsageTypeSchema>

export const USAGE_TYPE_LABELS: Record<UsageType, string> = {
  broadcast: "Broadcast",
  digital_media: "Digital Media",
  social_media: "Social Media",
  internet: "Internet",
  internal: "Internal",
}

export const ExclusivityTierSchema = z.enum([
  "non_exclusive",
  "category_exclusive",
  "full_exclusive",
  "work_for_hire",
])
export type ExclusivityTier = z.infer<typeof ExclusivityTierSchema>

export const EXCLUSIVITY_TIER_LABELS: Record<ExclusivityTier, string> = {
  non_exclusive: "Non-Exclusive",
  category_exclusive: "Category Exclusive",
  full_exclusive: "Full Exclusive",
  work_for_hire: "Work For Hire",
}

// Short forms for dense meta lines ("Broadcast · 1yr · Cat. Excl.").
export const EXCLUSIVITY_TIER_SHORT: Record<ExclusivityTier, string> = {
  non_exclusive: "Non-Excl.",
  category_exclusive: "Cat. Excl.",
  full_exclusive: "Full Excl.",
  work_for_hire: "WFH",
}

export const TermLengthSchema = z.enum([
  "six_months",
  "one_year",
  "two_years",
  "three_years",
  "perpetual",
])
export type TermLength = z.infer<typeof TermLengthSchema>

export const TERM_LENGTH_LABELS: Record<TermLength, string> = {
  six_months: "6 Months",
  one_year: "1 Year",
  two_years: "2 Years",
  three_years: "3 Years",
  perpetual: "Perpetual",
}

export const TERM_LENGTH_SHORT: Record<TermLength, string> = {
  six_months: "6mo",
  one_year: "1yr",
  two_years: "2yr",
  three_years: "3yr",
  perpetual: "Perp.",
}

export const TrackStatusSchema = z.enum(["active", "archived"])
export type TrackStatus = z.infer<typeof TrackStatusSchema>

export const DemoStatusSchema = z.enum(["open", "converted"])
export type DemoStatus = z.infer<typeof DemoStatusSchema>

export const HoldPeriodSchema = z.enum(["none", "three_months", "six_months"])
export type HoldPeriod = z.infer<typeof HoldPeriodSchema>

export const HOLD_PERIOD_LABELS: Record<HoldPeriod, string> = {
  none: "No Hold",
  three_months: "3 Months",
  six_months: "6 Months",
}
