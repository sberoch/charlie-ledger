import { z } from "zod"

// Wire-format primitives. Drizzle returns `date` columns as "YYYY-MM-DD"
// strings and `numeric` as decimal strings — the contracts keep both as-is so
// no float ever touches a fee.

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
export type IsoDate = z.infer<typeof IsoDateSchema>

export const MoneySchema = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Expected a decimal amount like 24500 or 24500.50"
  )
export type Money = z.infer<typeof MoneySchema>

export const UuidSchema = z.string().uuid()

/** "24500.00" → "$24,500" (whole dollars; cents only when present). */
export function formatMoney(amount: string): string {
  const n = Number(amount)
  const hasCents = n % 1 !== 0
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })
}

/** Today's date in YYYY-MM-DD, in the given IANA zone (default America/New_York — Charlie's). */
export function todayIso(
  timeZone = "America/New_York",
  now = new Date()
): IsoDate {
  return now.toLocaleDateString("en-CA", { timeZone })
}

/** Whole-day difference `to - from` between two YYYY-MM-DD dates. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const MS_PER_DAY = 86_400_000
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY)
}

/** Add calendar months to a YYYY-MM-DD date (UTC-safe, clamps month overflow). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number]
  const base = new Date(Date.UTC(y, m - 1 + months, 1))
  const daysInTarget = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)
  ).getUTCDate()
  base.setUTCDate(Math.min(d, daysInTarget))
  return base.toISOString().slice(0, 10)
}

/** Add whole days to a YYYY-MM-DD date. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const t = new Date(Date.parse(date) + days * 86_400_000)
  return t.toISOString().slice(0, 10)
}
