import { z } from "zod"

// Closed vocabularies mirroring the pg enums in apps/api. Labels live here so
// web, API, and the invoice PDF all speak the same dialect. See CONTEXT.md.

export const UsageTypeSchema = z.enum([
  "broadcast",
  "digital_media",
  "social_media",
  "internet",
  "internal",
  "all_media",
  "film_tv",
  "radio",
])
export type UsageType = z.infer<typeof UsageTypeSchema>

export const USAGE_TYPE_LABELS: Record<UsageType, string> = {
  broadcast: "Broadcast",
  digital_media: "Digital Media",
  social_media: "Social Media",
  internet: "Internet",
  internal: "Internal",
  // "All Media" is a single grant value, deliberately NOT exploded into the
  // other media — it is what Charlie's historical sheet says was sold.
  all_media: "All Media",
  film_tv: "Film / TV",
  radio: "Radio",
}

// A License grants one or more Usage Types (see CONTEXT.md / ADR-0004). The set
// is normalised on write to a deduped, canonically-ordered (enum declaration
// order), non-empty array — the non-empty guard lives in the License DTO.
export function normalizeUsageTypes(values: UsageType[]): UsageType[] {
  const set = new Set(values)
  return UsageTypeSchema.options.filter((u) => set.has(u))
}

/** Human label for a usage set: comma-joined in canonical order. */
export function formatUsageTypes(values: UsageType[]): string {
  return normalizeUsageTypes(values)
    .map((u) => USAGE_TYPE_LABELS[u])
    .join(", ")
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

// Ascending duration order (drives dropdown order). The sub-six-month values
// exist because Charlie's historical licenses actually used them.
export const TermLengthSchema = z.enum([
  "one_day",
  "one_month",
  "six_weeks",
  "two_months",
  "three_months",
  "thirteen_weeks",
  "six_months",
  "one_year",
  "two_years",
  "three_years",
  "five_years",
  "perpetual",
])
export type TermLength = z.infer<typeof TermLengthSchema>

export const TERM_LENGTH_LABELS: Record<TermLength, string> = {
  one_day: "1 Day",
  one_month: "1 Month",
  six_weeks: "6 Weeks",
  two_months: "2 Months",
  three_months: "3 Months",
  thirteen_weeks: "13 Weeks",
  six_months: "6 Months",
  one_year: "1 Year",
  two_years: "2 Years",
  three_years: "3 Years",
  five_years: "5 Years",
  perpetual: "Perpetual",
}

export const TERM_LENGTH_SHORT: Record<TermLength, string> = {
  one_day: "1d",
  one_month: "1mo",
  six_weeks: "6wk",
  two_months: "2mo",
  three_months: "3mo",
  thirteen_weeks: "13wk",
  six_months: "6mo",
  one_year: "1yr",
  two_years: "2yr",
  three_years: "3yr",
  five_years: "5yr",
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
