import { addDays } from '@workspace/shared';

// How many days after a license expires Charlie should chase the brand for a
// renewal. The reminder is created the day the license expires and is due this
// many days later — a visible countdown week on the timeline. See ADR-0007.
export const LICENSE_RENEWAL_REMINDER_DAYS = 7;

/** An expired, not-yet-renewed license — the input the rule turns into a nudge.
 *  `endDate` is non-null (perpetual/active licenses are filtered out upstream). */
export interface ExpiredLicenseForRenewal {
  id: string;
  endDate: string;
  track: { name: string };
  brand: { name: string };
}

/** A row ready to `insert(reminder).values(...)`. */
export interface RenewalReminderValues {
  reminderKind: 'license_renewal';
  title: string;
  description: string;
  dueOn: string;
  licenseId: string;
}

/**
 * The license-renewal rule, as a pure function (ADR-0007): given expired,
 * unrenewed licenses and the set of license ids that already carry a renewal
 * reminder, produce the reminder rows to create. Idempotent — a license already
 * in `alreadyReminded` yields nothing, so re-running creates no duplicates.
 */
export function buildLicenseRenewalReminders(
  licenses: ExpiredLicenseForRenewal[],
  alreadyReminded: ReadonlySet<string>,
  days: number = LICENSE_RENEWAL_REMINDER_DAYS,
): RenewalReminderValues[] {
  return licenses
    .filter((l) => !alreadyReminded.has(l.id))
    .map((l) => ({
      reminderKind: 'license_renewal' as const,
      title: `Contact ${l.brand.name} to renew ${l.track.name}`,
      description: `This license expired on ${l.endDate}. Reach out to the brand about a renewal.`,
      dueOn: addDays(l.endDate, days),
      licenseId: l.id,
    }));
}
