import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { reminder } from '../common/database/schema';

// Reminders (ADR-0007) expose a single mutation in this cut: marking one done.
// Creation is by rule only (the broadcast-royalty rule in LicensesService); there
// is no manual create/edit/list — reminders surface through the dashboard timeline
// and the weekly digest.
@Injectable()
export class RemindersService {
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
}
