import { Inject, Injectable } from '@nestjs/common';
import { desc, isNotNull, isNull } from 'drizzle-orm';
import {
  EXCLUSIVITY_TIER_SHORT,
  TERM_LENGTH_SHORT,
  formatUsageTypes,
  daysBetween,
  expirationState,
  todayIso,
  type ActivityItemDto,
  type DashboardDto,
  type TagTrendRowDto,
  type TimelineItemDto,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { demo, invoice, license, reminder } from '../common/database/schema';

@Injectable()
export class DashboardService {
  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  async snapshot(): Promise<DashboardDto> {
    const today = todayIso();

    const [licenses, demos, tracks, openReminders, royalties] =
      await Promise.all([
        this.db.query.license.findMany({
          // Tags now live in the track_tag join — pull the names through for the
          // top-tracks chips and the tag-combination trend below.
          with: {
            track: { with: { trackTags: { with: { tag: true } } } },
            brand: true,
          },
        }),
        this.db.query.demo.findMany({ with: { brand: true, payer: true } }),
        this.db.query.track.findMany(),
        // Open reminders (ADR-0007) — completed ones drop off entirely. Overdue
        // ones (due_on < today) are NOT filtered: unlike a derived expiration, a
        // reminder persists past its date until done.
        this.db.query.reminder.findMany({
          where: isNull(reminder.completedAt),
        }),
        this.db.query.royaltyPayment.findMany(),
      ]);

    const active = licenses.filter(
      (l) => l.endDate === null || l.endDate >= today,
    );
    const expiring = (withinDays: number) =>
      active.filter(
        (l) =>
          l.endDate !== null && daysBetween(today, l.endDate) <= withinDays,
      );

    // ── Timeline: future expirations + future hold lifts, merged ──
    const timeline: TimelineItemDto[] = [
      ...active
        .filter((l) => l.endDate !== null)
        .map((l) => ({
          kind: 'license_expiration' as const,
          sourceId: l.id,
          date: l.endDate!,
          daysOut: daysBetween(today, l.endDate!),
          title: `${l.track.name} × ${l.brand.name}`,
          meta: `${formatUsageTypes(l.usageTypes)} · ${TERM_LENGTH_SHORT[l.termLength]} · ${EXCLUSIVITY_TIER_SHORT[l.exclusivityTier]}`,
          fee: l.fee,
          urgency: expirationState(l.endDate, today).urgency,
        })),
      ...demos
        .filter((d) => d.status === 'open' && d.holdEndsAt > today)
        .map((d) => ({
          kind: 'demo_hold_lift' as const,
          sourceId: d.id,
          date: d.holdEndsAt,
          daysOut: daysBetween(today, d.holdEndsAt),
          title: d.workingName,
          meta: `Hold lifts · ${d.payer.name} · for ${d.brand.name}`,
          fee: d.fee,
          urgency: expirationState(d.holdEndsAt, today).urgency,
        })),
      // Reminders: sourceId is the reminder's OWN id (the "done" action targets
      // it). Overdue (daysOut < 0) renders urgent and floats to the top; no fee.
      ...openReminders.map((r) => {
        const daysOut = daysBetween(today, r.dueOn);
        return {
          kind: 'reminder' as const,
          sourceId: r.id,
          date: r.dueOn,
          daysOut,
          title: r.title,
          meta: r.description,
          fee: null,
          urgency:
            daysOut < 0
              ? ('urgent' as const)
              : expirationState(r.dueOn, today).urgency,
        };
      }),
    ]
      .sort((a, b) => a.daysOut - b.daysOut)
      .slice(0, 24);

    // ── Revenue at risk + renewal rate ──
    const atRiskLicenses = expiring(60);
    const expired = licenses.filter(
      (l) => l.endDate !== null && l.endDate < today,
    );
    const renewed = expired.filter((l) => l.renewedToId !== null);

    // ── Ready to reuse ──
    const readyDemos = demos
      .filter((d) => d.status === 'open' && d.holdEndsAt <= today)
      .sort((a, b) => (a.holdEndsAt < b.holdEndsAt ? -1 : 1))
      .map((d) => ({
        id: d.id,
        workingName: d.workingName,
        brandName: d.brand.name,
        payerName: d.payer.name,
        holdEndsAt: d.holdEndsAt,
        fee: d.fee,
      }));

    // ── Demo income (separate, top-level — never mixed into lifetime sales) ──
    const demoIncome = {
      total: sum(demos.map((d) => d.fee)),
      openCount: demos.filter((d) => d.status === 'open').length,
      convertedCount: demos.filter((d) => d.status === 'converted').length,
    };

    // ── Royalty income — the third stream, inherently cash basis (ADR-0009) ──
    const royaltyIncome = {
      total: sum(royalties.map((r) => r.amount)),
      paymentCount: royalties.length,
    };

    // ── Top earning tracks ──
    const byTrack = new Map<
      string,
      { name: string; tags: string[]; fees: string[] }
    >();
    for (const l of licenses) {
      const entry = byTrack.get(l.trackId) ?? {
        name: l.track.name,
        tags: l.track.trackTags.map((tt) => tt.tag.name),
        fees: [],
      };
      entry.fees.push(l.fee);
      byTrack.set(l.trackId, entry);
    }
    const topTracks = [...byTrack.entries()]
      .map(([trackId, t]) => ({
        trackId,
        name: t.name,
        lifetimeSales: sum(t.fees),
        licenseCount: t.fees.length,
        tags: t.tags.slice(0, 2),
      }))
      .sort((a, b) => Number(b.lifetimeSales) - Number(a.lifetimeSales))
      .slice(0, 5);

    // ── License mix by usage (fee-weighted) ──
    // A license can grant several media; its full fee counts toward EACH (so the
    // amounts overlap and can't be summed against revenue — ADR-0004). For the
    // donut we want a true partition, so `share` is normalised against the
    // usage-weighted total (Σ of all media weights), NOT total revenue — the
    // slices sum to exactly 100% and read as "share of the usage mix". `amount`
    // stays the absolute fee weight touching that medium.
    const byUsage = new Map<
      (typeof licenses)[number]['usageTypes'][number],
      number
    >();
    for (const l of licenses)
      for (const u of l.usageTypes)
        byUsage.set(u, (byUsage.get(u) ?? 0) + Number(l.fee));
    const usageWeightTotal = [...byUsage.values()].reduce((a, b) => a + b, 0);
    const licenseMix: DashboardDto['licenseMix'] = [...byUsage.entries()]
      .map(([usageType, amount]) => ({
        usageType,
        amount: amount.toFixed(2),
        share: usageWeightTotal > 0 ? amount / usageWeightTotal : 0,
      }))
      .sort((a, b) => b.share - a.share);

    // ── Tag trend: per individual tag → Σ fees, ranked. A license fee counts
    // toward EACH of its track's tags, so the rows overlap and over-sum the
    // grand total BY DESIGN — same as the Report's Usage Type rows. With tracks
    // carrying many tags, the individual tag (not the combination) is the
    // meaningful unit of "what styles sell". See CONTEXT.md "Tag trend".
    type TagRollup = {
      tag: string;
      fees: number[];
      brands: Map<string, number>;
    };
    const byTag = new Map<string, TagRollup>();
    for (const l of licenses) {
      const fee = Number(l.fee);
      // De-dupe within a track so one license can't double-count the same tag.
      const tagNames = [...new Set(l.track.trackTags.map((tt) => tt.tag.name))];
      for (const tagName of tagNames) {
        const entry: TagRollup = byTag.get(tagName) ?? {
          tag: tagName,
          fees: [],
          brands: new Map(),
        };
        entry.fees.push(fee);
        entry.brands.set(
          l.brand.name,
          (entry.brands.get(l.brand.name) ?? 0) + fee,
        );
        byTag.set(tagName, entry);
      }
    }
    const tagTrend: TagTrendRowDto[] = [...byTag.values()]
      .map((c) => ({
        tag: c.tag,
        total: c.fees.reduce((a, b) => a + b, 0).toFixed(2),
        licenseCount: c.fees.length,
        brands: [...c.brands.entries()]
          .map(([brandName, amount]) => ({
            brandName,
            amount: amount.toFixed(2),
          }))
          .sort((a, b) => Number(b.amount) - Number(a.amount)),
      }))
      .sort((a, b) => Number(b.total) - Number(a.total))
      .slice(0, 8);

    return {
      summary: {
        trackCount: tracks.filter((t) => t.status === 'active').length,
        activeLicenseCount: active.length,
        expiringThisWeekCount: expiring(7).length,
      },
      timeline,
      atRisk: {
        amount: sum(atRiskLicenses.map((l) => l.fee)),
        licenseCount: atRiskLicenses.length,
        renewalRate:
          expired.length > 0 ? renewed.length / expired.length : null,
      },
      readyDemos,
      demoIncome,
      royaltyIncome,
      topTracks,
      licenseMix,
      tagTrend,
      activity: await this.activity(),
    };
  }

  /** Unified feed: new licenses, new demos, conversions, payments landing. */
  private async activity(): Promise<ActivityItemDto[]> {
    const [licenses, demos, paid] = await Promise.all([
      this.db.query.license.findMany({
        with: { track: true, brand: true },
        orderBy: [desc(license.createdAt)],
        limit: 10,
      }),
      this.db.query.demo.findMany({
        with: { brand: true },
        orderBy: [desc(demo.createdAt)],
        limit: 10,
      }),
      this.db.query.invoice.findMany({
        where: isNotNull(invoice.paidDate),
        with: {
          license: { with: { track: true, brand: true } },
          demo: true,
        },
        orderBy: [desc(invoice.paidDate)],
        limit: 10,
      }),
    ]);

    const items: ActivityItemDto[] = [
      ...licenses.map((l) => ({
        kind: 'license_created' as const,
        at: l.createdAt.toISOString(),
        sourceId: l.id,
        title: `${l.track.name} × ${l.brand.name}`,
        meta: `Licensed · ${formatUsageTypes(l.usageTypes)} · ${TERM_LENGTH_SHORT[l.termLength]} · ${EXCLUSIVITY_TIER_SHORT[l.exclusivityTier]}`,
        amount: l.fee,
      })),
      ...demos.map((d) => ({
        kind:
          d.status === 'converted'
            ? ('demo_converted' as const)
            : ('demo_created' as const),
        at: d.createdAt.toISOString(),
        sourceId: d.id,
        title: d.workingName,
        meta:
          d.status === 'converted'
            ? `Demo converted · for ${d.brand.name}`
            : `New demo · for ${d.brand.name}`,
        amount: d.fee,
      })),
      ...paid.map((inv) => ({
        kind: 'invoice_paid' as const,
        at: new Date(`${inv.paidDate}T12:00:00Z`).toISOString(),
        sourceId: inv.id,
        title: inv.license
          ? `${inv.license.track.name} × ${inv.license.brand.name}`
          : (inv.demo?.workingName ?? '—'),
        meta: `Invoice paid`,
        amount: inv.amount,
      })),
    ];
    return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12);
  }
}

function sum(amounts: string[]): string {
  return amounts.reduce((acc, a) => acc + Number(a), 0).toFixed(2);
}
