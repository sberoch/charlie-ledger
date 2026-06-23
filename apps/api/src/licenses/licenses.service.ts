import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, arrayOverlaps, desc, eq } from 'drizzle-orm';
import {
  EXCLUSIVITY_TIER_LABELS,
  EXCLUSIVITY_TIER_SHORT,
  TERM_LENGTH_SHORT,
  formatUsageTypes,
  normalizeUsageTypes,
  addDays,
  defaultEndDate,
  deriveInvoiceStatus,
  expirationState,
  licenseInvoiceDescription,
  todayIso,
  type CollisionCheckQuery,
  type CollisionCheckResult,
  type CollisionWarningDto,
  type CreateLicenseInput,
  type LicenseDetailDto,
  type LicenseDto,
  type LicenseListQuery,
  type SimilarLicensesQuery,
  type SimilarLicensesResult,
  type UpdateLicenseInput,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import {
  brand,
  license,
  payer,
  reminder,
  track,
} from '../common/database/schema';
import { InvoiceIssuerService } from '../invoices/invoice-issuer.service';

// The broadcast-royalty rule: a License created with `broadcast` usage gets a
// Reminder this many days out, so Charlie remembers to register it to pursue
// broadcast royalties (royalties only matter enough to chase for broadcast).
// Create-time only; hardcoded, not data-driven. See CONTEXT.md and ADR-0007.
const BROADCAST_ROYALTY_REMINDER_DAYS = 30;

const RELATIONS = {
  track: true,
  brand: { with: { category: true } },
  payer: true,
  invoices: true,
} as const;

type LicenseRow = NonNullable<Awaited<ReturnType<LicensesService['loadRow']>>>;

/** "Empire × Subaru" — the canonical short title for a license. */
function licenseTitle(row: {
  track: { name: string };
  brand: { name: string };
}) {
  return `${row.track.name} × ${row.brand.name}`;
}

function licenseMeta(row: {
  usageTypes: Parameters<typeof formatUsageTypes>[0];
  termLength: keyof typeof TERM_LENGTH_SHORT;
  exclusivityTier: keyof typeof EXCLUSIVITY_TIER_SHORT;
}) {
  return `${formatUsageTypes(row.usageTypes)} · ${TERM_LENGTH_SHORT[row.termLength]} · ${EXCLUSIVITY_TIER_SHORT[row.exclusivityTier]}`;
}

@Injectable()
export class LicensesService {
  constructor(
    @Inject(DrizzleProvider) private readonly db: Db,
    private readonly issuer: InvoiceIssuerService,
  ) {}

  async list(query: LicenseListQuery): Promise<LicenseDto[]> {
    const today = todayIso();
    // Soonest upcoming expirations first, perpetual after, expired sink to
    // the bottom (most recently expired first).
    const rows = (
      await this.db.query.license.findMany({ with: RELATIONS })
    ).sort((a, b) => {
      const expiredA = a.endDate !== null && a.endDate < today;
      const expiredB = b.endDate !== null && b.endDate < today;
      if (expiredA !== expiredB) return expiredA ? 1 : -1;
      if (expiredA) return a.endDate! < b.endDate! ? 1 : -1;
      if (a.endDate === null) return b.endDate === null ? 0 : 1;
      if (b.endDate === null) return -1;
      return a.endDate < b.endDate ? -1 : 1;
    });
    return rows
      .filter((row) => {
        if (query.trackId && row.trackId !== query.trackId) return false;
        // Single-value filter, contains-match: surface every license whose set
        // includes the chosen medium (ADR-0004).
        if (query.usageType && !row.usageTypes.includes(query.usageType))
          return false;
        if (query.termLength && row.termLength !== query.termLength)
          return false;
        if (
          query.urgency &&
          expirationState(row.endDate, today).urgency !== query.urgency
        )
          return false;
        if (query.search) {
          const haystack =
            `${row.track.name} ${row.brand.name} ${row.payer.name}`.toLowerCase();
          if (!haystack.includes(query.search.toLowerCase())) return false;
        }
        return true;
      })
      .map((row) => this.toDto(row, today));
  }

  async detail(id: string): Promise<LicenseDetailDto> {
    const today = todayIso();
    const row = await this.db.query.license.findFirst({
      where: eq(license.id, id),
      with: {
        ...RELATIONS,
        renewedTo: { with: { brand: true } },
        renewedFrom: { with: { brand: true } },
      },
    });
    if (!row) throw new NotFoundException('License not found');
    return {
      ...this.toDto(row, today),
      renewedTo: row.renewedTo
        ? {
            id: row.renewedTo.id,
            brandName: row.renewedTo.brand.name,
            startDate: row.renewedTo.startDate,
          }
        : null,
      renewedFrom: row.renewedFrom.map((r) => ({
        id: r.id,
        brandName: r.brand.name,
        endDate: r.endDate,
      })),
      invoices: [...row.invoices]
        .sort((a, b) => b.number - a.number)
        .map((inv) => ({
          id: inv.id,
          number: inv.number,
          status: deriveInvoiceStatus(inv, today),
          issueDate: inv.issueDate,
        })),
    };
  }

  /** Creates the License AND its live Invoice in one transaction (ADR-0002). */
  async create(
    input: CreateLicenseInput,
    userId: string | null,
  ): Promise<LicenseDetailDto> {
    const endDate = this.resolveEndDate(input);
    const payerRow = await this.db.query.payer.findFirst({
      where: eq(payer.id, input.payerId),
    });
    if (!payerRow) throw new BadRequestException('Payer not found');
    const [trackRow, brandRow] = await Promise.all([
      this.db.query.track.findFirst({ where: eq(track.id, input.trackId) }),
      this.db.query.brand.findFirst({ where: eq(brand.id, input.brandId) }),
    ]);
    if (!trackRow) throw new BadRequestException('Track not found');
    if (!brandRow) throw new BadRequestException('Brand not found');

    const usageTypes = normalizeUsageTypes(input.usageTypes);

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(license)
        .values({
          trackId: input.trackId,
          brandId: input.brandId,
          payerId: input.payerId,
          usageTypes,
          exclusivityTier: input.exclusivityTier,
          termLength: input.termLength,
          fee: input.fee,
          startDate: input.startDate,
          endDate,
          notes: input.notes ?? null,
          terms: input.terms ?? null,
          createdBy: userId,
        })
        .returning();
      await this.issuer.issue(tx, {
        source: { kind: 'license', id: row.id },
        billTo: {
          name: payerRow.name,
          email: payerRow.email,
          address: payerRow.address,
        },
        amount: input.fee,
        description: licenseInvoiceDescription({
          trackName: trackRow.name,
          brandName: brandRow.name,
          usageTypes,
          exclusivityTier: input.exclusivityTier,
          terms: input.terms,
        }),
        userId,
      });
      // Broadcast-royalty rule (ADR-0007) — same transaction as the license +
      // invoice, create-time only, never re-run on edit.
      if (usageTypes.includes('broadcast')) {
        await tx.insert(reminder).values({
          title: `Register ${trackRow.name} × ${brandRow.name} for broadcast royalties`,
          description:
            'Broadcast usage. Register this license to pursue broadcast royalties.',
          dueOn: addDays(todayIso(), BROADCAST_ROYALTY_REMINDER_DAYS),
          licenseId: row.id,
          createdBy: userId,
        });
      }
      return row;
    });
    return this.detail(created.id);
  }

  async update(
    id: string,
    input: UpdateLicenseInput,
  ): Promise<LicenseDetailDto> {
    const existing = await this.db.query.license.findFirst({
      where: eq(license.id, id),
    });
    if (!existing) throw new NotFoundException('License not found');

    // Explicit endDate wins; otherwise a term or start change re-seeds it from
    // the merged values — the same rule the form applies client-side.
    const merged = { ...existing, ...input };
    let endDate =
      input.endDate !== undefined ? input.endDate : existing.endDate;
    if (
      input.endDate === undefined &&
      (input.termLength !== undefined || input.startDate !== undefined)
    ) {
      endDate = defaultEndDate(merged.startDate, merged.termLength);
    }
    if (merged.termLength === 'perpetual') {
      if (input.endDate)
        throw new BadRequestException('A perpetual license has no end date');
      endDate = null;
    }
    this.assertDateOrder(merged.startDate, endDate);

    await this.db
      .update(license)
      .set({
        trackId: merged.trackId,
        brandId: merged.brandId,
        payerId: merged.payerId,
        usageTypes: normalizeUsageTypes(merged.usageTypes),
        exclusivityTier: merged.exclusivityTier,
        termLength: merged.termLength,
        fee: merged.fee,
        startDate: merged.startDate,
        endDate,
        notes:
          input.notes !== undefined ? (input.notes ?? null) : existing.notes,
        terms:
          input.terms !== undefined ? (input.terms ?? null) : existing.terms,
      })
      .where(eq(license.id, id));
    return this.detail(id);
  }

  /** Forward-only Renewal pointer — an annotation, never an auto-copy. */
  async setRenewedTo(
    id: string,
    renewedToId: string | null,
  ): Promise<LicenseDetailDto> {
    if (renewedToId === id)
      throw new BadRequestException('A license cannot renew to itself');
    if (renewedToId) {
      const target = await this.db.query.license.findFirst({
        where: eq(license.id, renewedToId),
      });
      if (!target) throw new BadRequestException('Target license not found');
    }
    await this.db
      .update(license)
      .set({ renewedToId })
      .where(eq(license.id, id));
    return this.detail(id);
  }

  /**
   * Exclusivity collision warning — advisory, never blocking (CONTEXT.md).
   * Active grants only; "active" = end date null (perpetual) or >= today.
   */
  async checkCollisions(
    query: CollisionCheckQuery,
  ): Promise<CollisionCheckResult> {
    const today = todayIso();
    const newBrand = await this.db.query.brand.findFirst({
      where: eq(brand.id, query.brandId),
      with: { category: true },
    });
    if (!newBrand) throw new BadRequestException('Brand not found');

    const active = (
      await this.db.query.license.findMany({
        where: eq(license.trackId, query.trackId),
        with: { brand: { with: { category: true } }, track: true },
      })
    ).filter(
      (row) =>
        row.id !== query.excludeLicenseId &&
        (row.endDate === null || row.endDate >= today),
    );

    const collisions: CollisionWarningDto[] = [];
    const absolute = ['full_exclusive', 'work_for_hire'] as const;
    for (const row of active) {
      const sameCategory =
        row.brand.categoryId === newBrand.categoryId &&
        row.brandId !== query.brandId;
      const until = row.endDate
        ? `until ${formatHuman(row.endDate)}`
        : 'in perpetuity';

      if (absolute.includes(row.exclusivityTier as (typeof absolute)[number])) {
        collisions.push(
          this.warning(
            row,
            `${row.brand.name} holds ${EXCLUSIVITY_TIER_LABELS[row.exclusivityTier].toLowerCase()} rights on ${row.track.name} ${until}`,
          ),
        );
      } else if (
        absolute.includes(query.exclusivityTier as (typeof absolute)[number])
      ) {
        collisions.push(
          this.warning(
            row,
            `${EXCLUSIVITY_TIER_LABELS[query.exclusivityTier]} conflicts with the active ${row.brand.name} license on ${row.track.name} (${until})`,
          ),
        );
      } else if (row.exclusivityTier === 'category_exclusive' && sameCategory) {
        collisions.push(
          this.warning(
            row,
            `${row.brand.name} holds category exclusivity on ${row.track.name} in ${row.brand.category.name} ${until}`,
          ),
        );
      } else if (
        query.exclusivityTier === 'category_exclusive' &&
        sameCategory
      ) {
        collisions.push(
          this.warning(
            row,
            `Cannot grant clean category exclusivity: ${row.brand.name} (${row.brand.category.name}) has an active license on ${row.track.name} ${until}`,
          ),
        );
      }
    }
    return { collisions };
  }

  /** "Similar Past Licenses" — overlapping usage (shares ≥1 medium) + same
   *  exclusivity + term, newest first. Overlap, not exact-set equality, keeps
   *  the pricing band populated on a small catalog (ADR-0004). */
  async similar(query: SimilarLicensesQuery): Promise<SimilarLicensesResult> {
    const rows = await this.db.query.license.findMany({
      where: and(
        arrayOverlaps(license.usageTypes, query.usageTypes),
        eq(license.exclusivityTier, query.exclusivityTier),
        eq(license.termLength, query.termLength),
      ),
      with: { brand: true, track: true },
      orderBy: [desc(license.startDate)],
      limit: 25,
    });
    const fees = rows.map((r) => Number(r.fee));
    return {
      rows: rows.slice(0, 5).map((r) => ({
        licenseId: r.id,
        brandName: r.brand.name,
        trackName: r.track.name,
        fee: r.fee,
        startDate: r.startDate,
      })),
      summary:
        rows.length === 0
          ? null
          : {
              count: rows.length,
              avg: (fees.reduce((a, b) => a + b, 0) / fees.length).toFixed(2),
              min: Math.min(...fees).toFixed(2),
              max: Math.max(...fees).toFixed(2),
            },
    };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private loadRow(id: string) {
    return this.db.query.license.findFirst({
      where: eq(license.id, id),
      with: RELATIONS,
    });
  }

  private resolveEndDate(input: CreateLicenseInput): string | null {
    if (input.termLength === 'perpetual') {
      if (input.endDate)
        throw new BadRequestException('A perpetual license has no end date');
      return null;
    }
    const endDate =
      input.endDate ?? defaultEndDate(input.startDate, input.termLength);
    this.assertDateOrder(input.startDate, endDate);
    return endDate;
  }

  private assertDateOrder(startDate: string, endDate: string | null) {
    if (endDate !== null && endDate < startDate)
      throw new BadRequestException(
        'End date must be on or after the start date',
      );
  }

  private warning(
    row: {
      id: string;
      endDate: string | null;
      exclusivityTier: LicenseDto['exclusivityTier'];
      brand: { name: string; category: { name: string } };
    },
    message: string,
  ) {
    return {
      licenseId: row.id,
      brandName: row.brand.name,
      categoryName: row.brand.category.name,
      exclusivityTier: row.exclusivityTier,
      endDate: row.endDate,
      message,
    };
  }

  toDto(row: LicenseRow, today: string): LicenseDto {
    const live = row.invoices.find((inv) => inv.voidedAt === null);
    if (!live)
      throw new Error(
        `License ${row.id} has no live invoice — ADR-0002 violated`,
      );
    return {
      id: row.id,
      trackId: row.trackId,
      trackName: row.track.name,
      brandId: row.brandId,
      brandName: row.brand.name,
      categoryName: row.brand.category.name,
      payerId: row.payerId,
      payerName: row.payer.name,
      usageTypes: row.usageTypes,
      exclusivityTier: row.exclusivityTier,
      termLength: row.termLength,
      fee: row.fee,
      startDate: row.startDate,
      endDate: row.endDate,
      renewedToId: row.renewedToId,
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

function formatHuman(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Re-exported for demos/dashboard so meta lines render identically everywhere.
export { licenseMeta, licenseTitle };
