import type { HoldPeriod, TermLength } from "./enums"
import { addDays, addMonths, daysBetween, type IsoDate } from "./primitives"

// ── Expiration urgency ──────────────────────────────────────────────────────
// CONTEXT.md: urgent <14d, expiring soon 14–60d, active >60d, expired past.
// A perpetual License (endDate null) is always active. Derived, never stored.

export const URGENT_WITHIN_DAYS = 14
export const EXPIRING_SOON_WITHIN_DAYS = 60

export type ExpirationUrgency =
  | "urgent"
  | "expiring_soon"
  | "active"
  | "expired"

export const EXPIRATION_URGENCY_LABELS: Record<ExpirationUrgency, string> = {
  urgent: "Urgent",
  expiring_soon: "Expiring Soon",
  active: "Active",
  expired: "Expired",
}

export interface ExpirationState {
  urgency: ExpirationUrgency
  /** Days until expiration; negative when expired; null for perpetual. */
  daysLeft: number | null
}

export function expirationState(
  endDate: IsoDate | null,
  today: IsoDate
): ExpirationState {
  if (endDate === null) return { urgency: "active", daysLeft: null }
  const daysLeft = daysBetween(today, endDate)
  if (daysLeft < 0) return { urgency: "expired", daysLeft }
  if (daysLeft < URGENT_WITHIN_DAYS) return { urgency: "urgent", daysLeft }
  if (daysLeft <= EXPIRING_SOON_WITHIN_DAYS)
    return { urgency: "expiring_soon", daysLeft }
  return { urgency: "active", daysLeft }
}

// ── Trackless (work-for-hire) licenses ──────────────────────────────────────
// A work_for_hire License may reference no Track (ADR-0013): the bespoke work
// never entered the catalog. "WFH" stands in wherever a track name would
// render — safe because trackless ⇒ work_for_hire is a write-time invariant.

export const TRACKLESS_LABEL = "WFH"

/** The track slot of a license's display identity: the track name, or "WFH". */
export function licenseTrackLabel(trackName: string | null | undefined): string {
  return trackName ?? TRACKLESS_LABEL
}

/** Canonical license title — `Track × Brand`, or `WFH × Brand` when trackless. */
export function licenseTitle(
  trackName: string | null | undefined,
  brandName: string
): string {
  return `${licenseTrackLabel(trackName)} × ${brandName}`
}

// ── Invoice status ──────────────────────────────────────────────────────────
// CONTEXT.md: derived from paid_date / due_date / voided_at, never stored.

export type InvoiceStatus = "paid" | "unpaid" | "overdue" | "voided"

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  overdue: "Overdue",
  voided: "Voided",
}

export function deriveInvoiceStatus(
  invoice: {
    paidDate: IsoDate | null
    dueDate: IsoDate
    voidedAt: string | Date | null
  },
  today: IsoDate
): InvoiceStatus {
  if (invoice.voidedAt !== null) return "voided"
  if (invoice.paidDate !== null) return "paid"
  if (daysBetween(today, invoice.dueDate) < 0) return "overdue"
  return "unpaid"
}

/** Canonical display form: one continuous gapless sequence, no year. ADR-0001. */
export function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(4, "0")}`
}

// ── Seeded dates ────────────────────────────────────────────────────────────

/** Default License end date: start + term. Editable afterwards; perpetual → null. */
export function defaultEndDate(
  startDate: IsoDate,
  term: TermLength
): IsoDate | null {
  switch (term) {
    case "one_day":
      return addDays(startDate, 1)
    case "one_month":
      return addMonths(startDate, 1)
    case "six_weeks":
      return addDays(startDate, 42)
    case "two_months":
      return addMonths(startDate, 2)
    case "three_months":
      return addMonths(startDate, 3)
    case "thirteen_weeks":
      return addDays(startDate, 91)
    case "six_months":
      return addMonths(startDate, 6)
    case "one_year":
      return addMonths(startDate, 12)
    case "two_years":
      return addMonths(startDate, 24)
    case "three_years":
      return addMonths(startDate, 36)
    case "five_years":
      return addMonths(startDate, 60)
    case "perpetual":
      return null
  }
}

/** Default Demo hold end: written + hold. Editable afterwards; none → same day (already lifted). */
export function defaultHoldEndsAt(
  writtenAt: IsoDate,
  hold: HoldPeriod
): IsoDate {
  switch (hold) {
    case "none":
      return writtenAt
    case "three_months":
      return addMonths(writtenAt, 3)
    case "six_months":
      return addMonths(writtenAt, 6)
  }
}

/** Default Invoice due date: Net 30. */
export function defaultDueDate(issueDate: IsoDate): IsoDate {
  return addDays(issueDate, 30)
}
