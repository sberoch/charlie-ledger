import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import {
  type CreateRoyaltyPaymentInput,
  type RoyaltyPaymentDto,
  type UpdateRoyaltyPaymentInput,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import {
  brand,
  license,
  payer,
  royaltyPayment,
  track,
} from '../common/database/schema';

// Linked entities are pulled only to render display labels — the links are
// context, never a reporting foundation (ADR-0009).
const RELATIONS = {
  payer: true,
  brand: true,
  track: true,
  license: { with: { track: true, brand: true } },
} as const;

type RoyaltyPaymentRow = NonNullable<
  Awaited<ReturnType<Db['query']['royaltyPayment']['findFirst']>>
> & {
  payer: { name: string };
  brand: { name: string } | null;
  track: { name: string } | null;
  license: { track: { name: string }; brand: { name: string } } | null;
};

@Injectable()
export class RoyaltiesService {
  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  /** All royalty payments, newest first — the web groups them by month. */
  async list(): Promise<RoyaltyPaymentDto[]> {
    const rows = await this.db.query.royaltyPayment.findMany({
      with: RELATIONS,
      orderBy: [
        desc(royaltyPayment.paymentDate),
        desc(royaltyPayment.createdAt),
      ],
    });
    return rows.map((row) => this.toDto(row as RoyaltyPaymentRow));
  }

  async detail(id: string): Promise<RoyaltyPaymentDto> {
    const row = await this.db.query.royaltyPayment.findFirst({
      where: eq(royaltyPayment.id, id),
      with: RELATIONS,
    });
    if (!row) throw new NotFoundException('Royalty payment not found');
    return this.toDto(row);
  }

  async create(
    input: CreateRoyaltyPaymentInput,
    userId: string | null,
  ): Promise<RoyaltyPaymentDto> {
    await this.assertRefsExist(input);
    const [row] = await this.db
      .insert(royaltyPayment)
      .values({
        paymentDate: input.date,
        payerId: input.payerId,
        description: input.description?.trim() || null,
        amount: input.amount,
        brandId: input.brandId ?? null,
        trackId: input.trackId ?? null,
        licenseId: input.licenseId ?? null,
        createdBy: userId,
      })
      .returning({ id: royaltyPayment.id });
    return this.detail(row.id);
  }

  /** Free edit — fully mutable like a Lead, no snapshot (ADR-0009). */
  async update(
    id: string,
    input: UpdateRoyaltyPaymentInput,
  ): Promise<RoyaltyPaymentDto> {
    const existing = await this.db.query.royaltyPayment.findFirst({
      where: eq(royaltyPayment.id, id),
    });
    if (!existing) throw new NotFoundException('Royalty payment not found');
    await this.assertRefsExist(input);
    await this.db
      .update(royaltyPayment)
      .set({
        paymentDate: input.date ?? existing.paymentDate,
        payerId: input.payerId ?? existing.payerId,
        // A provided-but-null value clears it; an omitted one is left as-is.
        description:
          input.description !== undefined
            ? input.description?.trim() || null
            : existing.description,
        amount: input.amount ?? existing.amount,
        brandId:
          input.brandId !== undefined
            ? (input.brandId ?? null)
            : existing.brandId,
        trackId:
          input.trackId !== undefined
            ? (input.trackId ?? null)
            : existing.trackId,
        licenseId:
          input.licenseId !== undefined
            ? (input.licenseId ?? null)
            : existing.licenseId,
      })
      .where(eq(royaltyPayment.id, id));
    return this.detail(id);
  }

  /** Hard delete — no void, no history; a correction supersedes (ADR-0009). */
  async remove(id: string): Promise<{ id: string }> {
    const [row] = await this.db
      .delete(royaltyPayment)
      .where(eq(royaltyPayment.id, id))
      .returning({ id: royaltyPayment.id });
    if (!row) throw new NotFoundException('Royalty payment not found');
    return row;
  }

  /** Stale picks yield a clean 400 rather than an FK 500. */
  private async assertRefsExist(input: {
    payerId?: string;
    brandId?: string | null;
    trackId?: string | null;
    licenseId?: string | null;
  }): Promise<void> {
    if (input.payerId) {
      const row = await this.db.query.payer.findFirst({
        where: eq(payer.id, input.payerId),
      });
      if (!row) throw new BadRequestException('Payer not found');
    }
    if (input.brandId) {
      const row = await this.db.query.brand.findFirst({
        where: eq(brand.id, input.brandId),
      });
      if (!row) throw new BadRequestException('Brand not found');
    }
    if (input.trackId) {
      const row = await this.db.query.track.findFirst({
        where: eq(track.id, input.trackId),
      });
      if (!row) throw new BadRequestException('Track not found');
    }
    if (input.licenseId) {
      const row = await this.db.query.license.findFirst({
        where: eq(license.id, input.licenseId),
      });
      if (!row) throw new BadRequestException('License not found');
    }
  }

  private toDto(row: RoyaltyPaymentRow): RoyaltyPaymentDto {
    return {
      id: row.id,
      date: row.paymentDate,
      payerId: row.payerId,
      payerName: row.payer.name,
      description: row.description,
      amount: row.amount,
      brandId: row.brandId,
      brandName: row.brand?.name ?? null,
      trackId: row.trackId,
      trackName: row.track?.name ?? null,
      licenseId: row.licenseId,
      licenseLabel: row.license
        ? `${row.license.track.name} × ${row.license.brand.name}`
        : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
