import { describe, expect, it } from 'vitest';
import type { ReportResultDto } from '@workspace/shared';
import type { Db } from '../common/database/db';
import { ReportsService } from './reports.service';

// toCsv never touches the db handle — safe to instantiate without one.
const service = new ReportsService(null as unknown as Db);

const base: ReportResultDto = {
  from: '2026-01-01',
  to: '2026-12-31',
  groupBy: 'brand',
  basis: 'commitment',
  rows: [{ label: 'A24', invoiceCount: 2, total: '5000.00' }],
  grandTotal: '5000.00',
  invoiceCount: 2,
  includeLeads: false,
  leadTotal: '0.00',
  royaltyRows: [],
  royaltyTotal: '0.00',
  royaltyPaymentCount: 0,
  totalIncome: '5000.00',
};

describe('ReportsService.groupLabels — invoice partition', () => {
  it('labels a license invoice by number + source title', () => {
    const labels = service['groupLabels'](
      {
        number: 142,
        license: {
          brand: { name: 'Subaru' },
          payer: { name: 'Empire Agency' },
          track: { name: 'Empire', album: null },
          usageTypes: ['broadcast'],
        },
        demo: null,
      },
      'invoice',
    );
    expect(labels).toEqual(['INV-0142 · Empire × Subaru']);
  });

  it('labels a demo invoice by number + working name', () => {
    const labels = service['groupLabels'](
      {
        number: 7,
        license: null,
        demo: {
          brand: { name: 'Walmart' },
          payer: { name: 'Squeak E. Clean' },
          workingName: 'Walmart_SpringSale_v1a',
        },
      },
      'invoice',
    );
    expect(labels).toEqual(['INV-0007 · Walmart_SpringSale_v1a']);
  });
});

describe('ReportsService.toCsv', () => {
  it('heads the count column "Invoices" and states the basis under commitment', () => {
    const csv = service.toCsv(base);
    expect(csv).toContain('Group,Invoices,Total (USD)');
    expect(csv).toContain('Basis: commitment');
    expect(csv).not.toContain('Paid invoices');
  });

  it('keeps "Paid invoices" and states the basis under cash', () => {
    const csv = service.toCsv({ ...base, basis: 'cash' });
    expect(csv).toContain('Group,Paid invoices,Total (USD)');
    expect(csv).toContain('Basis: cash');
  });
});

describe('ReportsService.groupLabels — album partition', () => {
  const license = {
    brand: { name: 'Subaru' },
    payer: { name: 'Empire Agency' },
    usageTypes: ['broadcast' as const],
  };

  it('labels a license invoice by its track album', () => {
    const labels = service['groupLabels'](
      {
        number: 1,
        license: {
          ...license,
          track: { name: 'Empire', album: { name: 'Colors' } },
        },
        demo: null,
      },
      'album',
    );
    expect(labels).toEqual(['Colors']);
  });

  it('pools album-less tracks, trackless WFH and demos into "— No album"', () => {
    const albumless = service['groupLabels'](
      {
        number: 2,
        license: { ...license, track: { name: 'LOOT', album: null } },
        demo: null,
      },
      'album',
    );
    const trackless = service['groupLabels'](
      { number: 3, license: { ...license, track: null }, demo: null },
      'album',
    );
    const demo = service['groupLabels'](
      {
        number: 4,
        license: null,
        demo: {
          brand: { name: 'Walmart' },
          payer: { name: 'SEC' },
          workingName: 'x',
        },
      },
      'album',
    );
    expect([albumless, trackless, demo]).toEqual([
      ['— No album'],
      ['— No album'],
      ['— No album'],
    ]);
  });
});

describe('ReportsService.toCsv — album grouping', () => {
  it('adds Sales / Royalties / Total columns and keeps the sales-only section total', () => {
    const csv = service.toCsv({
      ...base,
      groupBy: 'album',
      rows: [
        {
          label: 'Colors',
          invoiceCount: 2,
          total: '5000.00',
          royaltyTotal: '120.50',
          incomeTotal: '5120.50',
        },
      ],
    });
    expect(csv).toContain(
      'Group,Invoices,Sales (USD),Royalties (USD),Total (USD)',
    );
    expect(csv).toContain('"Colors",2,5000.00,120.50,5120.50');
    expect(csv).toContain('SALES TOTAL,2,5000.00,,');
  });
});
