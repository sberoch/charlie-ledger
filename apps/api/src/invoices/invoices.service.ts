import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import {
  deriveInvoiceStatus,
  demoInvoiceDescription,
  licenseInvoiceDescription,
  todayIso,
  type InvoiceDto,
  type InvoiceListQuery,
  type VoidAndReissueInput,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { invoice } from '../common/database/schema';
import { InvoiceIssuerService } from './invoice-issuer.service';

const RELATIONS = {
  license: { with: { track: true, brand: true, payer: true } },
  demo: { with: { brand: true, payer: true } },
} as const;

type InvoiceRow = NonNullable<
  Awaited<ReturnType<typeof InvoicesService.prototype.loadRow>>
>;

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(DrizzleProvider) private readonly db: Db,
    private readonly issuer: InvoiceIssuerService,
  ) {}

  async list(query: InvoiceListQuery): Promise<InvoiceDto[]> {
    const today = todayIso();
    const rows = await this.db.query.invoice.findMany({
      with: RELATIONS,
      orderBy: [desc(invoice.number)],
    });
    return rows
      .map((row) => this.toDto(row, today))
      .filter((dto) => {
        if (query.status && dto.status !== query.status) return false;
        if (query.search) {
          const haystack =
            `${dto.source.title} ${dto.billToName} ${String(dto.number)}`.toLowerCase();
          if (!haystack.includes(query.search.toLowerCase())) return false;
        }
        return true;
      });
  }

  async detail(id: string): Promise<InvoiceDto> {
    const row = await this.loadRow(id);
    if (!row) throw new NotFoundException('Invoice not found');
    return this.toDto(row, todayIso());
  }

  /** Manual entry — anchors cash-basis reports. */
  async markPaid(id: string, paidDate: string): Promise<InvoiceDto> {
    const row = await this.loadRow(id);
    if (!row) throw new NotFoundException('Invoice not found');
    if (row.voidedAt)
      throw new BadRequestException('A voided invoice cannot be paid');
    await this.db.update(invoice).set({ paidDate }).where(eq(invoice.id, id));
    return this.detail(id);
  }

  /** Undo for a fat-fingered paid date. */
  async clearPaid(id: string): Promise<InvoiceDto> {
    const row = await this.loadRow(id);
    if (!row) throw new NotFoundException('Invoice not found');
    await this.db
      .update(invoice)
      .set({ paidDate: null })
      .where(eq(invoice.id, id));
    return this.detail(id);
  }

  /**
   * Atomic void & reissue (ADR-0002). There is no bare void: the replacement
   * re-snapshots the source's CURRENT payer block and fee under the next
   * number, inside one transaction. Paid invoices cannot be voided.
   */
  async voidAndReissue(
    id: string,
    input: VoidAndReissueInput,
    userId: string,
  ): Promise<InvoiceDto> {
    const row = await this.loadRow(id);
    if (!row) throw new NotFoundException('Invoice not found');
    if (row.voidedAt)
      throw new BadRequestException('Invoice is already voided');
    if (row.paidDate)
      throw new BadRequestException(
        'A paid invoice cannot be voided — clear its paid date first',
      );

    const source = row.license
      ? {
          kind: 'license' as const,
          id: row.license.id,
          payer: row.license.payer,
          fee: row.license.fee,
          description: licenseInvoiceDescription({
            trackName: row.license.track.name,
            brandName: row.license.brand.name,
            usageTypes: row.license.usageTypes,
            exclusivityTier: row.license.exclusivityTier,
            terms: row.license.terms,
          }),
        }
      : {
          kind: 'demo' as const,
          id: row.demo!.id,
          payer: row.demo!.payer,
          fee: row.demo!.fee,
          description: demoInvoiceDescription({
            brandName: row.demo!.brand.name,
            workingName: row.demo!.workingName,
            terms: row.demo!.terms,
          }),
        };

    const reissued = await this.db.transaction(async (tx) => {
      await tx
        .update(invoice)
        .set({ voidedAt: new Date() })
        .where(eq(invoice.id, id));
      return this.issuer.issue(tx, {
        source: { kind: source.kind, id: source.id },
        billTo: {
          name: source.payer.name,
          email: source.payer.email,
          address: source.payer.address,
        },
        amount: source.fee,
        description: input.description ?? source.description,
        dueDate: input.dueDate,
        userId,
      });
    });
    return this.detail(reissued.id);
  }

  loadRow(id: string) {
    return this.db.query.invoice.findFirst({
      where: eq(invoice.id, id),
      with: RELATIONS,
    });
  }

  toDto(row: InvoiceRow, today: string): InvoiceDto {
    const source = row.license
      ? {
          kind: 'license' as const,
          id: row.license.id,
          title: `${row.license.track.name} × ${row.license.brand.name}`,
        }
      : {
          kind: 'demo' as const,
          id: row.demo!.id,
          title: row.demo!.workingName,
        };
    return {
      id: row.id,
      number: row.number,
      source,
      billToName: row.billToName,
      billToEmail: row.billToEmail,
      billToAddress: row.billToAddress,
      amount: row.amount,
      description: row.description,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      paidDate: row.paidDate,
      voidedAt: row.voidedAt ? row.voidedAt.toISOString() : null,
      status: deriveInvoiceStatus(row, today),
    };
  }
}
