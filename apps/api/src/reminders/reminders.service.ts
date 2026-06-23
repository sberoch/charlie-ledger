import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { todayIso } from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { license, reminder } from '../common/database/schema';
import { buildLicenseRenewalReminders } from './license-renewal-rule';

// Reminders (ADR-0007) surface through the dashboard timeline and the weekly
// digest; the only user mutation is marking one done. Creation is by rule only:
// the broadcast-royalty rule (create-time, in LicensesService) and the
// license-renewal rule (the daily cron below).
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  /** Mark a reminder done — it drops off the timeline and the digest entirely.
   *  Idempotent: re-marking a done reminder is harmless. */
  async markDone(id: string): Promise<{ id: string }> {
    const [row] = await this.db
      .update(reminder)
      .set({ completedAt: new Date() })
      .where(eq(reminder.id, id))
      .returning({ id: reminder.id });
    if (!row) throw new NotFoundException('Reminder not found');
    return row;
  }

  /**
   * License-renewal rule (ADR-0007) — daily at 6:00am ET, an hour before the
   * Monday digest so a reminder created that morning still makes the week's send.
   *
   * For every expired, not-yet-renewed license that doesn't already have one, it
   * creates a `license_renewal` reminder due 7 days after expiry, nudging Charlie
   * to contact the brand. Idempotent via the (license, kind) dedupe key, so it is
   * safe to re-run; renewed licenses are skipped (and a license that gets renewed
   * later has its open reminder auto-completed in LicensesService.setRenewedTo).
   */
  @Cron('0 6 * * *', { timeZone: 'America/New_York' })
  async createLicenseRenewalReminders(): Promise<{ created: number }> {
    const today = todayIso();

    // Expired (end date in the past), still-open (not renewed) licenses.
    const expired = await this.db.query.license.findMany({
      where: and(
        isNotNull(license.endDate),
        lt(license.endDate, today),
        isNull(license.renewedToId),
      ),
      with: { track: true, brand: true },
    });
    if (expired.length === 0) return { created: 0 };

    // Which of them already carry a renewal reminder — the dedupe set.
    const existing = await this.db.query.reminder.findMany({
      where: eq(reminder.reminderKind, 'license_renewal'),
      columns: { licenseId: true },
    });
    const alreadyReminded = new Set(
      existing
        .map((r) => r.licenseId)
        .filter((id): id is string => id !== null),
    );

    // endDate is non-null here (filtered in the query above).
    const values = buildLicenseRenewalReminders(
      expired.map((l) => ({
        id: l.id,
        endDate: l.endDate as string,
        track: { name: l.track.name },
        brand: { name: l.brand.name },
      })),
      alreadyReminded,
    );

    if (values.length === 0) return { created: 0 };

    await this.db.insert(reminder).values(values);
    this.logger.log(`License-renewal reminders: created ${values.length}`);
    return { created: values.length };
  }
}
