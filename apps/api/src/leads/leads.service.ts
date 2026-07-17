import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import {
  licenseTitle,
  type CreateLeadInput,
  type LeadDto,
  type UpdateLeadInput,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { brand, demo, lead, license, track } from '../common/database/schema';

// Linked entities are pulled only to render display labels — a Lead never reads
// a fee or invoice off them (ADR-0005: walled off, no reconciliation).
const RELATIONS = {
  brand: true,
  license: { with: { track: true, brand: true } },
  demo: true,
  track: true,
} as const;

type LeadRow = NonNullable<
  Awaited<ReturnType<Db['query']['lead']['findFirst']>>
> & {
  brand: { name: string } | null;
  license: { track: { name: string } | null; brand: { name: string } } | null;
  demo: { workingName: string } | null;
  track: { name: string } | null;
};

@Injectable()
export class LeadsService {
  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  /** Whole personal ledger, newest first — the web groups it by month. */
  async list(): Promise<LeadDto[]> {
    const rows = await this.db.query.lead.findMany({
      with: RELATIONS,
      orderBy: [desc(lead.entryDate), desc(lead.createdAt)],
    });
    return rows.map((row) => this.toDto(row as LeadRow));
  }

  async detail(id: string): Promise<LeadDto> {
    const row = await this.db.query.lead.findFirst({
      where: eq(lead.id, id),
      with: RELATIONS,
    });
    if (!row) throw new NotFoundException('Lead not found');
    return this.toDto(row);
  }

  async create(
    input: CreateLeadInput,
    userId: string | null,
  ): Promise<LeadDto> {
    await this.assertLinksExist(input);
    const [row] = await this.db
      .insert(lead)
      .values({
        entryDate: input.date,
        description: input.description,
        amount: input.amount,
        brandId: input.brandId ?? null,
        licenseId: input.licenseId ?? null,
        demoId: input.demoId ?? null,
        trackId: input.trackId ?? null,
        createdBy: userId,
      })
      .returning({ id: lead.id });
    return this.detail(row.id);
  }

  /** Free edit — any field, any time, no snapshot, no history (ADR-0005). */
  async update(id: string, input: UpdateLeadInput): Promise<LeadDto> {
    const existing = await this.db.query.lead.findFirst({
      where: eq(lead.id, id),
    });
    if (!existing) throw new NotFoundException('Lead not found');
    await this.assertLinksExist(input);
    await this.db
      .update(lead)
      .set({
        entryDate: input.date ?? existing.entryDate,
        description: input.description ?? existing.description,
        amount: input.amount ?? existing.amount,
        // A provided-but-null link clears it; an omitted link is left as-is.
        brandId:
          input.brandId !== undefined
            ? (input.brandId ?? null)
            : existing.brandId,
        licenseId:
          input.licenseId !== undefined
            ? (input.licenseId ?? null)
            : existing.licenseId,
        demoId:
          input.demoId !== undefined ? (input.demoId ?? null) : existing.demoId,
        trackId:
          input.trackId !== undefined
            ? (input.trackId ?? null)
            : existing.trackId,
      })
      .where(eq(lead.id, id));
    return this.detail(id);
  }

  /** Hard delete — a Lead is private scratch, not a document (ADR-0005). */
  async remove(id: string): Promise<{ id: string }> {
    const [row] = await this.db
      .delete(lead)
      .where(eq(lead.id, id))
      .returning({ id: lead.id });
    if (!row) throw new NotFoundException('Lead not found');
    return row;
  }

  /** The links are loosely validated — we only check that what he picked still
   *  exists, so a stale id yields a clean 400 rather than an FK 500. */
  private async assertLinksExist(input: {
    brandId?: string | null;
    licenseId?: string | null;
    demoId?: string | null;
    trackId?: string | null;
  }): Promise<void> {
    if (input.brandId) {
      const row = await this.db.query.brand.findFirst({
        where: eq(brand.id, input.brandId),
      });
      if (!row) throw new BadRequestException('Brand not found');
    }
    if (input.licenseId) {
      const row = await this.db.query.license.findFirst({
        where: eq(license.id, input.licenseId),
      });
      if (!row) throw new BadRequestException('License not found');
    }
    if (input.demoId) {
      const row = await this.db.query.demo.findFirst({
        where: eq(demo.id, input.demoId),
      });
      if (!row) throw new BadRequestException('Demo not found');
    }
    if (input.trackId) {
      const row = await this.db.query.track.findFirst({
        where: eq(track.id, input.trackId),
      });
      if (!row) throw new BadRequestException('Track not found');
    }
  }

  private toDto(row: LeadRow): LeadDto {
    return {
      id: row.id,
      date: row.entryDate,
      description: row.description,
      amount: row.amount,
      brandId: row.brandId,
      brandName: row.brand?.name ?? null,
      licenseId: row.licenseId,
      licenseLabel: row.license
        ? licenseTitle(row.license.track?.name, row.license.brand.name)
        : null,
      demoId: row.demoId,
      demoLabel: row.demo?.workingName ?? null,
      trackId: row.trackId,
      trackName: row.track?.name ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
