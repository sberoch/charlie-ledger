export { formatMoney } from "@workspace/shared"

/** "2026-06-19" → "Jun 19, 2026" (parsed as a plain date, no TZ drift). */
export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** ISO timestamp → "Jun 19" / "Jun 19, 2025" when not current year. */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}
