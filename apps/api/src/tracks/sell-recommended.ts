import type { TrackStatus } from '@workspace/shared';

export interface SellSignalInput {
  status: TrackStatus;
  /** Most recent License start date (ISO `YYYY-MM-DD`), or null if never licensed. */
  lastLicensedAt: string | null;
  /** Track creation timestamp — the fallback reference date when never licensed. */
  createdAt: Date;
}

// "SELL THIS" — the dead-inventory signal (CONTEXT.md: "Sell signal"). Fires for
// an ACTIVE track whose reference date is strictly more than three calendar years
// before `now`. The reference date is the last licensed date, falling back to the
// track's creation date when it has never been licensed. Never stored; the single
// source of truth for both the list and detail reads. `now` is injected so the
// three-year boundary is unit-testable. Compared at day granularity (UTC), so a
// track exactly three years stale does not fire — only three years and a day does.
export function isSellRecommended(
  { status, lastLicensedAt, createdAt }: SellSignalInput,
  now: Date,
): boolean {
  if (status !== 'active') return false;

  const [refYear, refMonth, refDay] = lastLicensedAt
    ? lastLicensedAt.split('-').map(Number)
    : [];
  const reference = lastLicensedAt
    ? dateOnlyUtc(refYear, refMonth, refDay)
    : dateOnlyUtc(
        createdAt.getUTCFullYear(),
        createdAt.getUTCMonth() + 1,
        createdAt.getUTCDate(),
      );
  const cutoff = dateOnlyUtc(
    now.getUTCFullYear() - 3,
    now.getUTCMonth() + 1,
    now.getUTCDate(),
  );
  return reference < cutoff;
}

/** Epoch millis for a UTC midnight from 1-based month parts. */
function dateOnlyUtc(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}
