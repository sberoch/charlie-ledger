import { Inject, Injectable } from '@nestjs/common';
import { and, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import {
  USAGE_TYPE_LABELS,
  type ReportQuery,
  type ReportResultDto,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { invoice, lead, royaltyPayment } from '../common/database/schema';

/**
 * Sales report — CASH basis (CONTEXT.md): only PAID invoices, anchored on
 * paid_date. Deliberately diverges from lifetime sales (commitment basis);
 * the two totals will differ and that is correct.
 *
 * Royalties (ADR-0009) join as a SEPARATE section: royalty payments in range,
 * anchored on their own date, grouped by Payer — never mixed into the sales
 * groupings, so the partition math above stays intact. The summary reads
 * Sales / Royalties / Total income.
 */
@Injectable()
export class ReportsService {
  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  async sales(query: ReportQuery): Promise<ReportResultDto> {
    const paid = await this.db.query.invoice.findMany({
      where: and(
        isNotNull(invoice.paidDate),
        isNull(invoice.voidedAt),
        gte(invoice.paidDate, query.from),
        lte(invoice.paidDate, query.to),
      ),
      with: {
        license: { with: { brand: true, payer: true, track: true } },
        demo: { with: { brand: true, payer: true } },
      },
    });

    const groups = new Map<string, { count: number; total: number }>();
    for (const inv of paid) {
      // Usually one label per invoice. The exception is a multi-usage license
      // under the `usage_type` grouping: its full fee fans out to EACH medium,
      // so the usage rows overlap and over-sum the grand total (ADR-0004).
      for (const label of this.groupLabels(inv, query.groupBy)) {
        const entry = groups.get(label) ?? { count: 0, total: 0 };
        entry.count += 1;
        entry.total += Number(inv.amount);
        groups.set(label, entry);
      }
    }

    // Optional overlay: blend personal-ledger leads into the same rows + total
    // (CONTEXT.md / ADR-0005). Leads are filtered by their only date, entryDate,
    // and inherit the dimensions they lack (payer, usage_type, sometimes brand /
    // track) from a linked license or demo. They add money but NOT to the paid-
    // invoice count, and the same usage-type fan-out applies (so usage rows
    // over-sum). Leads are signed, so a net-negative lead can pull a row down.
    let leadTotal = 0;
    if (query.includeLeads) {
      const leads = await this.db.query.lead.findMany({
        where: and(
          gte(lead.entryDate, query.from),
          lte(lead.entryDate, query.to),
        ),
        with: {
          brand: true,
          track: true,
          license: { with: { brand: true, payer: true, track: true } },
          demo: { with: { brand: true, payer: true } },
        },
      });
      for (const l of leads) {
        for (const label of this.leadGroupLabels(l, query.groupBy)) {
          const entry = groups.get(label) ?? { count: 0, total: 0 };
          // count is invoice-only; a lead contributes money but is not invoiced.
          entry.total += Number(l.amount);
          groups.set(label, entry);
        }
        // Counted once per lead, even when fan-out spreads it across usage rows.
        leadTotal += Number(l.amount);
      }
    }

    const rows = [...groups.entries()]
      .map(([label, { count, total }]) => ({
        label,
        invoiceCount: count,
        total: total.toFixed(2),
      }))
      .sort((a, b) => Number(b.total) - Number(a.total));

    // ── Royalties section (ADR-0009): in-range payments, by Payer ──
    const royalties = await this.db.query.royaltyPayment.findMany({
      where: and(
        gte(royaltyPayment.paymentDate, query.from),
        lte(royaltyPayment.paymentDate, query.to),
      ),
      with: { payer: true },
    });
    const royaltyGroups = new Map<string, { count: number; total: number }>();
    for (const r of royalties) {
      const entry = royaltyGroups.get(r.payer.name) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += Number(r.amount);
      royaltyGroups.set(r.payer.name, entry);
    }
    const royaltyRows = [...royaltyGroups.entries()]
      .map(([label, { count, total }]) => ({
        label,
        paymentCount: count,
        total: total.toFixed(2),
      }))
      .sort((a, b) => Number(b.total) - Number(a.total));
    const royaltyTotal = royalties.reduce((s, r) => s + Number(r.amount), 0);

    const invoiceTotal = paid.reduce((acc, inv) => acc + Number(inv.amount), 0);
    const grandTotal = invoiceTotal + leadTotal;
    return {
      from: query.from,
      to: query.to,
      groupBy: query.groupBy,
      rows,
      grandTotal: grandTotal.toFixed(2),
      paidInvoiceCount: paid.length,
      includeLeads: query.includeLeads,
      leadTotal: leadTotal.toFixed(2),
      royaltyRows,
      royaltyTotal: royaltyTotal.toFixed(2),
      royaltyPaymentCount: royalties.length,
      totalIncome: (grandTotal + royaltyTotal).toFixed(2),
    };
  }

  private groupLabels(
    inv: {
      license: {
        brand: { name: string };
        payer: { name: string };
        track: { name: string };
        usageTypes: (keyof typeof USAGE_TYPE_LABELS)[];
      } | null;
      demo: { brand: { name: string }; payer: { name: string } } | null;
    },
    groupBy: ReportQuery['groupBy'],
  ): string[] {
    if (inv.license) {
      switch (groupBy) {
        case 'brand':
          return [inv.license.brand.name];
        case 'payer':
          return [inv.license.payer.name];
        case 'track':
          return [inv.license.track.name];
        case 'usage_type':
          // Fan-out: one label per medium the license grants.
          return inv.license.usageTypes.map((u) => USAGE_TYPE_LABELS[u]);
      }
    }
    // Demo invoices: brand/payer group naturally; track/usage get one bucket.
    switch (groupBy) {
      case 'brand':
        return [inv.demo!.brand.name];
      case 'payer':
        return [inv.demo!.payer.name];
      default:
        return ['— Demos'];
    }
  }

  /**
   * Where a blended lead lands. A direct link wins; otherwise the lead inherits
   * the dimension from its linked license (then demo). Anything that still can't
   * be placed in the active grouping falls to a single "— Leads" catch-all — the
   * same convention as "— Demos" above. Under `usage_type` a license-linked lead
   * fans out across every medium, matching the license's own over-sum (ADR-0004).
   */
  private leadGroupLabels(
    l: {
      brand: { name: string } | null;
      track: { name: string } | null;
      license: {
        brand: { name: string };
        payer: { name: string };
        track: { name: string };
        usageTypes: (keyof typeof USAGE_TYPE_LABELS)[];
      } | null;
      demo: { brand: { name: string }; payer: { name: string } } | null;
    },
    groupBy: ReportQuery['groupBy'],
  ): string[] {
    const FALLBACK = '— Leads';
    switch (groupBy) {
      case 'brand':
        return [
          l.brand?.name ??
            l.license?.brand.name ??
            l.demo?.brand.name ??
            FALLBACK,
        ];
      case 'payer':
        // Leads carry no payer of their own — only a license/demo provides one.
        return [l.license?.payer.name ?? l.demo?.payer.name ?? FALLBACK];
      case 'track':
        // Demos have no track, so only a direct or license track resolves.
        return [l.track?.name ?? l.license?.track.name ?? FALLBACK];
      case 'usage_type':
        if (l.license)
          return l.license.usageTypes.map((u) => USAGE_TYPE_LABELS[u]);
        return [FALLBACK];
    }
  }

  toCsv(result: ReportResultDto): string {
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const lines = [
      ['Group', 'Paid invoices', 'Total (USD)'].join(','),
      ...result.rows.map((r) =>
        [esc(r.label), String(r.invoiceCount), r.total].join(','),
      ),
      ['SALES TOTAL', String(result.paidInvoiceCount), result.grandTotal].join(
        ',',
      ),
    ];
    // Royalties: a separate section, never blended into the sales rows above
    // (ADR-0009). Grouped by payer; column 2 counts payments, not invoices.
    if (result.royaltyRows.length > 0) {
      lines.push(
        '',
        ['Royalties by payer', 'Payments', 'Total (USD)'].join(','),
        ...result.royaltyRows.map((r) =>
          [esc(r.label), String(r.paymentCount), r.total].join(','),
        ),
        [
          'ROYALTIES TOTAL',
          String(result.royaltyPaymentCount),
          result.royaltyTotal,
        ].join(','),
      );
    }
    lines.push('', ['TOTAL INCOME', '', result.totalIncome].join(','));
    // A license can grant several media, so each fee counts toward every usage
    // row — they overlap and over-sum the grand total by design (ADR-0004).
    if (result.groupBy === 'usage_type')
      lines.push(
        '',
        esc(
          'Note: licenses can grant multiple usage types, so usage rows overlap and sum to more than the grand total.',
        ),
      );
    if (result.includeLeads)
      lines.push(
        '',
        esc(
          `Note: totals include ${result.leadTotal} from personal-ledger leads (commitment basis, may double-count invoiced fees).`,
        ),
      );
    return lines.join('\n') + '\n';
  }
}
