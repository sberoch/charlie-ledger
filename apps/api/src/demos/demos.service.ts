import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import {
  defaultHoldEndsAt,
  demoInvoiceDescription,
  deriveInvoiceStatus,
  todayIso,
  type ConvertDemoInput,
  type CreateDemoInput,
  type DemoDto,
  type DemoListQuery,
  type UpdateDemoInput,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { brand, demo, payer, track } from '../common/database/schema';
import { InvoiceIssuerService } from '../invoices/invoice-issuer.service';

const RELATIONS = {
  brand: true,
  payer: true,
  convertedTrack: true,
  invoices: true,
} as const;

type DemoRow = NonNullable<
  Awaited<ReturnType<Db['query']['demo']['findFirst']>>
> & {
  brand: { name: string };
  payer: { name: string };
  convertedTrack: { name: string } | null;
  invoices: Array<{
    id: string;
    number: number;
    amount: string;
    billToName: string;
    paidDate: string | null;
    dueDate: string;
    voidedAt: Date | null;
  }>;
};

@Injectable()
export class DemosService {
  constructor(
    @Inject(DrizzleProvider) private readonly db: Db,
    private readonly issuer: InvoiceIssuerService,
  ) {}

  async list(query: DemoListQuery): Promise<DemoDto[]> {
    const today = todayIso();
    const rows = await this.db.query.demo.findMany({
      with: RELATIONS,
      orderBy: [desc(demo.writtenAt)],
    });
    return rows
      .map((row) => this.toDto(row as DemoRow, today))
      .filter((dto) => {
        if (query.status && dto.status !== query.status) return false;
        if (query.readyToConvert && !(dto.status === 'open' && dto.holdLifted))
          return false;
        if (query.search) {
          const haystack =
            `${dto.workingName} ${dto.brandName} ${dto.payerName}`.toLowerCase();
          if (!haystack.includes(query.search.toLowerCase())) return false;
        }
        return true;
      });
  }

  async detail(id: string): Promise<DemoDto> {
    const row = await this.db.query.demo.findFirst({
      where: eq(demo.id, id),
      with: RELATIONS,
    });
    if (!row) throw new NotFoundException('Demo not found');
    return this.toDto(row, todayIso());
  }

  /** Creates the Demo AND its live Invoice in one transaction (ADR-0002). */
  async create(
    input: CreateDemoInput,
    userId: string | null,
  ): Promise<DemoDto> {
    const [payerRow, brandRow] = await Promise.all([
      this.db.query.payer.findFirst({ where: eq(payer.id, input.payerId) }),
      this.db.query.brand.findFirst({ where: eq(brand.id, input.brandId) }),
    ]);
    if (!payerRow) throw new BadRequestException('Payer not found');
    if (!brandRow) throw new BadRequestException('Brand not found');

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(demo)
        .values({
          brandId: input.brandId,
          payerId: input.payerId,
          fee: input.fee,
          workingName: input.workingName,
          holdPeriod: input.holdPeriod,
          writtenAt: input.writtenAt,
          holdEndsAt:
            input.holdEndsAt ??
            defaultHoldEndsAt(input.writtenAt, input.holdPeriod),
          notes: input.notes ?? null,
          terms: input.terms ?? null,
          createdBy: userId,
        })
        .returning();
      await this.issuer.issue(tx, {
        source: { kind: 'demo', id: row.id },
        billTo: {
          name: payerRow.name,
          email: payerRow.email,
          address: payerRow.address,
        },
        amount: input.fee,
        description: demoInvoiceDescription({
          brandName: brandRow.name,
          workingName: input.workingName,
          terms: input.terms,
        }),
        userId,
      });
      return row;
    });
    return this.detail(created.id);
  }

  async update(id: string, input: UpdateDemoInput): Promise<DemoDto> {
    const existing = await this.db.query.demo.findFirst({
      where: eq(demo.id, id),
    });
    if (!existing) throw new NotFoundException('Demo not found');

    // Re-seed hold end only when the hold inputs change without an explicit end.
    const merged = { ...existing, ...input };
    let holdEndsAt = input.holdEndsAt ?? existing.holdEndsAt;
    if (
      (input.holdPeriod || input.writtenAt) &&
      input.holdEndsAt === undefined
    ) {
      holdEndsAt = defaultHoldEndsAt(merged.writtenAt, merged.holdPeriod);
    }

    await this.db
      .update(demo)
      .set({
        brandId: merged.brandId,
        payerId: merged.payerId,
        fee: merged.fee,
        workingName: merged.workingName,
        holdPeriod: merged.holdPeriod,
        writtenAt: merged.writtenAt,
        holdEndsAt,
        notes:
          input.notes !== undefined ? (input.notes ?? null) : existing.notes,
        terms:
          input.terms !== undefined ? (input.terms ?? null) : existing.terms,
      })
      .where(eq(demo.id, id));
    return this.detail(id);
  }

  /**
   * Conversion — Charlie's decision that the idea becomes a library Track.
   * Requires NO track (it usually doesn't exist yet); the link is optional and
   * can be set or changed any time afterwards. See CONTEXT.md.
   */
  async convert(id: string, input: ConvertDemoInput): Promise<DemoDto> {
    const existing = await this.db.query.demo.findFirst({
      where: eq(demo.id, id),
    });
    if (!existing) throw new NotFoundException('Demo not found');
    if (existing.status === 'converted')
      throw new BadRequestException('Demo is already converted');
    await this.assertTrackExists(input.convertedTrackId);
    await this.db
      .update(demo)
      .set({
        status: 'converted',
        convertedTrackId: input.convertedTrackId ?? null,
      })
      .where(eq(demo.id, id));
    return this.detail(id);
  }

  /** After-the-fact lineage link, independent of status. */
  async linkConvertedTrack(
    id: string,
    convertedTrackId: string | null,
  ): Promise<DemoDto> {
    await this.assertTrackExists(convertedTrackId);
    const [row] = await this.db
      .update(demo)
      .set({ convertedTrackId })
      .where(eq(demo.id, id))
      .returning();
    if (!row) throw new NotFoundException('Demo not found');
    return this.detail(id);
  }

  private async assertTrackExists(trackId: string | null | undefined) {
    if (!trackId) return;
    const row = await this.db.query.track.findFirst({
      where: eq(track.id, trackId),
    });
    if (!row) throw new BadRequestException('Track not found');
  }

  toDto(row: DemoRow, today: string): DemoDto {
    const live = row.invoices.find((inv) => inv.voidedAt === null);
    if (!live)
      throw new Error(`Demo ${row.id} has no live invoice — ADR-0002 violated`);
    return {
      id: row.id,
      brandId: row.brandId,
      brandName: row.brand.name,
      payerId: row.payerId,
      payerName: row.payer.name,
      fee: row.fee,
      workingName: row.workingName,
      holdPeriod: row.holdPeriod,
      writtenAt: row.writtenAt,
      holdEndsAt: row.holdEndsAt,
      status: row.status,
      holdLifted: row.holdEndsAt <= today,
      convertedTrackId: row.convertedTrackId,
      convertedTrackName: row.convertedTrack?.name ?? null,
      notes: row.notes,
      terms: row.terms,
      invoice: {
        id: live.id,
        number: live.number,
        status: deriveInvoiceStatus(live, today),
        amount: live.amount,
        billToName: live.billToName,
      },
      createdAt: row.createdAt.toISOString(),
    };
  }
}
