import { Inject, Injectable } from '@nestjs/common';
import { and, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import {
  USAGE_TYPE_LABELS,
  type ReportQuery,
  type ReportResultDto,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { invoice } from '../common/database/schema';

/**
 * Sales report — CASH basis (CONTEXT.md): only PAID invoices, anchored on
 * paid_date. Deliberately diverges from lifetime sales (commitment basis);
 * the two totals will differ and that is correct.
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

    const rows = [...groups.entries()]
      .map(([label, { count, total }]) => ({
        label,
        invoiceCount: count,
        total: total.toFixed(2),
      }))
      .sort((a, b) => Number(b.total) - Number(a.total));

    return {
      from: query.from,
      to: query.to,
      groupBy: query.groupBy,
      rows,
      grandTotal: paid
        .reduce((acc, inv) => acc + Number(inv.amount), 0)
        .toFixed(2),
      paidInvoiceCount: paid.length,
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

  toCsv(result: ReportResultDto): string {
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const lines = [
      ['Group', 'Paid invoices', 'Total (USD)'].join(','),
      ...result.rows.map((r) =>
        [esc(r.label), String(r.invoiceCount), r.total].join(','),
      ),
      ['TOTAL', String(result.paidInvoiceCount), result.grandTotal].join(','),
    ];
    // A license can grant several media, so each fee counts toward every usage
    // row — they overlap and over-sum the grand total by design (ADR-0004).
    if (result.groupBy === 'usage_type')
      lines.push(
        '',
        esc(
          'Note: licenses can grant multiple usage types, so usage rows overlap and sum to more than the grand total.',
        ),
      );
    return lines.join('\n') + '\n';
  }
}
