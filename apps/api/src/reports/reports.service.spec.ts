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
