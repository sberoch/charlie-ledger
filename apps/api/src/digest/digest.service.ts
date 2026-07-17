import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, isNull, lte } from 'drizzle-orm';
import { Resend } from 'resend';
import {
  EXCLUSIVITY_TIER_SHORT,
  TERM_LENGTH_SHORT,
  formatUsageTypes,
  addDays,
  daysBetween,
  deriveInvoiceStatus,
  formatInvoiceNumber,
  formatMoney,
  licenseTitle,
  todayIso,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { appSetting, reminder, user } from '../common/database/schema';

export interface DigestContent {
  lookaheadDays: number;
  expiringLicenses: Array<{
    title: string;
    meta: string;
    fee: string;
    inDays: number;
  }>;
  liftingHolds: Array<{
    workingName: string;
    brandName: string;
    inDays: number;
  }>;
  overdueInvoices: Array<{
    number: string;
    billTo: string;
    amount: string;
    daysOverdue: number;
  }>;
  reminders: Array<{
    title: string;
    description: string;
    /** Days until due; negative when already overdue (ADR-0007). */
    inDays: number;
  }>;
}

/**
 * Weekly digest — Mondays 7:00am EST (proposal). Env-gated on RESEND_API_KEY:
 * without it the cron builds the digest, logs a summary, and skips sending,
 * so the feature ships before the email account exists.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  @Cron('0 7 * * 1', { timeZone: 'America/New_York' })
  async weekly() {
    const content = await this.build();
    const isEmpty =
      content.expiringLicenses.length === 0 &&
      content.liftingHolds.length === 0 &&
      content.overdueInvoices.length === 0 &&
      content.reminders.length === 0;
    if (isEmpty) {
      this.logger.log('Digest: nothing in the window — not sending');
      return;
    }
    await this.send(content);
  }

  async build(): Promise<DigestContent> {
    const today = todayIso();
    const settings = await this.db.query.appSetting.findFirst({
      where: eq(appSetting.id, 1),
    });
    const lookaheadDays = settings?.digestLookaheadDays ?? 7;
    const horizon = addDays(today, lookaheadDays);

    const [licenses, demos, invoices, dueReminders] = await Promise.all([
      this.db.query.license.findMany({ with: { track: true, brand: true } }),
      this.db.query.demo.findMany({ with: { brand: true } }),
      this.db.query.invoice.findMany({
        with: {
          license: { with: { track: true, brand: true } },
          demo: true,
        },
      }),
      // Open reminders due within the window — and crucially the OVERDUE ones
      // (due_on < today), the one spot reminders diverge from the forward-only
      // sections: an overdue nudge is exactly what the digest must resurface.
      this.db.query.reminder.findMany({
        where: and(isNull(reminder.completedAt), lte(reminder.dueOn, horizon)),
      }),
    ]);

    return {
      lookaheadDays,
      expiringLicenses: licenses
        .filter(
          (l) =>
            l.endDate !== null && l.endDate >= today && l.endDate <= horizon,
        )
        .sort((a, b) => (a.endDate! < b.endDate! ? -1 : 1))
        .map((l) => ({
          title: licenseTitle(l.track?.name, l.brand.name),
          meta: `${formatUsageTypes(l.usageTypes)} · ${TERM_LENGTH_SHORT[l.termLength]} · ${EXCLUSIVITY_TIER_SHORT[l.exclusivityTier]}`,
          fee: l.fee,
          inDays: daysBetween(today, l.endDate!),
        })),
      liftingHolds: demos
        .filter(
          (d) =>
            d.status === 'open' &&
            d.holdEndsAt >= today &&
            d.holdEndsAt <= horizon,
        )
        .map((d) => ({
          workingName: d.workingName,
          brandName: d.brand.name,
          inDays: daysBetween(today, d.holdEndsAt),
        })),
      overdueInvoices: invoices
        .filter((inv) => deriveInvoiceStatus(inv, today) === 'overdue')
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
        .map((inv) => ({
          number: formatInvoiceNumber(inv.number),
          billTo: inv.billToName,
          amount: inv.amount,
          daysOverdue: -daysBetween(today, inv.dueDate),
        })),
      reminders: dueReminders
        // Ascending inDays = most-overdue first (most negative), then soonest.
        .map((r) => ({
          title: r.title,
          description: r.description,
          inDays: daysBetween(today, r.dueOn),
        }))
        .sort((a, b) => a.inDays - b.inDays),
    };
  }

  async send(
    content: DigestContent,
  ): Promise<{ sent: boolean; reason?: string }> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        `Digest built (${content.expiringLicenses.length} expiring, ${content.liftingHolds.length} holds, ${content.overdueInvoices.length} overdue, ${content.reminders.length} reminders) but RESEND_API_KEY is unset — skipping send`,
      );
      return { sent: false, reason: 'RESEND_API_KEY unset' };
    }
    const recipients = (
      await this.db.select({ email: user.email }).from(user)
    ).map((u) => u.email);
    if (recipients.length === 0) return { sent: false, reason: 'no users' };

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.DIGEST_FROM ?? 'Foltz Ledger <ledger@charliefoltz.com>',
      to: recipients,
      subject: `This week on the ledger — ${content.expiringLicenses.length} expiring · ${content.liftingHolds.length} holds lifting · ${content.overdueInvoices.length} overdue · ${content.reminders.length} reminders`,
      html: this.toHtml(content),
    });
    this.logger.log(`Digest sent to ${recipients.length} recipient(s)`);
    return { sent: true };
  }

  private toHtml(c: DigestContent): string {
    const section = (title: string, rows: string[]) =>
      rows.length === 0
        ? ''
        : `<h3 style="font-family:monospace;letter-spacing:2px;font-size:12px;color:#8d8a82;text-transform:uppercase;margin:24px 0 8px">${title}</h3>
           <table style="font-family:monospace;font-size:14px;color:#1a1a1a;border-collapse:collapse;width:100%">${rows.join('')}</table>`;
    const row = (left: string, mid: string, right: string) =>
      `<tr style="border-bottom:1px solid #ebe7df">
         <td style="padding:8px 0"><strong>${left}</strong><br/><span style="font-size:11px;color:#8d8a82">${mid}</span></td>
         <td style="padding:8px 0;text-align:right;white-space:nowrap">${right}</td>
       </tr>`;

    const webUrl = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    const button = `<table style="margin:32px 0 8px" cellpadding="0" cellspacing="0"><tr><td>
        <a href="${webUrl}" style="display:inline-block;font-family:monospace;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#ffffff;background:#1a1a1a;padding:12px 24px;text-decoration:none">Open the ledger →</a>
      </td></tr></table>`;

    return `<div style="max-width:560px;margin:0 auto;padding:24px;background:#ffffff">
      <div style="font-family:Arial Black,Arial,sans-serif;font-size:20px;color:#1a1a1a">CHARLIE FOLTZ LICENSE MANAGER</div>
      <div style="font-family:monospace;font-size:11px;letter-spacing:2px;color:#8d8a82;margin-top:4px">WEEKLY DIGEST · NEXT ${c.lookaheadDays} DAYS</div>
      ${section(
        'Licenses expiring',
        c.expiringLicenses.map((l) =>
          row(l.title, l.meta, `${formatMoney(l.fee)} · ${l.inDays}d`),
        ),
      )}
      ${section(
        'Holds lifting',
        c.liftingHolds.map((h) =>
          row(h.workingName, `for ${h.brandName}`, `${h.inDays}d`),
        ),
      )}
      ${section(
        'Overdue invoices',
        c.overdueInvoices.map((o) =>
          row(
            o.number,
            o.billTo,
            `${formatMoney(o.amount)} · ${o.daysOverdue}d late`,
          ),
        ),
      )}
      ${section(
        'Reminders',
        c.reminders.map((r) =>
          row(
            r.title,
            r.description,
            r.inDays < 0 ? `${-r.inDays}d overdue` : `${r.inDays}d`,
          ),
        ),
      )}
      ${button}
    </div>`;
  }
}
