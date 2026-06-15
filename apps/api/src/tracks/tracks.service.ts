import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type {
  TrackDetailDto,
  TrackListItemDto,
  TrackListQuery,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import {
  brand,
  brandCategory,
  demo,
  license,
  track,
} from '../common/database/schema';

// Track — read-only Disco mirror. List/detail read models only; no mutations
// exist on purpose (CONTEXT.md: the platform never edits or deletes a Track).
@Injectable()
export class TracksService {
  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  async list(query: TrackListQuery): Promise<TrackListItemDto[]> {
    const conditions = [sql`true`];
    if (query.status) conditions.push(sql`${track.status} = ${query.status}`);
    if (query.tag)
      conditions.push(sql`${track.tags} @> ARRAY[${query.tag}]::text[]`);
    if (query.search)
      conditions.push(sql`${track.name} ILIKE ${`%${query.search}%`}`);

    const rows = await this.db
      .select({
        id: track.id,
        discoId: track.discoId,
        name: track.name,
        tags: track.tags,
        status: track.status,
        licenseCount: sql<number>`count(${license.id})::int`,
        lifetimeSales: sql<string>`coalesce(sum(${license.fee}), 0)::text`,
        lastLicensedAt: sql<string | null>`max(${license.startDate})`,
      })
      .from(track)
      .leftJoin(license, eq(license.trackId, track.id))
      .where(sql.join(conditions, sql` AND `))
      .groupBy(track.id)
      .orderBy(sql`coalesce(sum(${license.fee}), 0) DESC`, track.name);
    return rows;
  }

  /**
   * Track export → CSV. Mirrors the list (one row per Track); `financials`
   * adds the license-derived columns + a footer total (CONTEXT.md). Tags carry
   * the FULL list joined with ';' so they never collide with the comma delimiter.
   */
  toCsv(rows: TrackListItemDto[], financials: boolean): string {
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const status = (s: TrackListItemDto['status']) =>
      s === 'archived' ? 'Archived' : 'Active';
    const base = (r: TrackListItemDto) => [
      esc(r.name),
      esc(r.tags.join('; ')),
      status(r.status),
    ];

    if (!financials) {
      const lines = [
        ['Track', 'Tags', 'Status'].join(','),
        ...rows.map((r) => base(r).join(',')),
        [esc(`TOTAL (${rows.length} tracks)`), '', ''].join(','),
      ];
      return lines.join('\n') + '\n';
    }

    const totalLicenses = rows.reduce((acc, r) => acc + r.licenseCount, 0);
    const totalSales = rows
      .reduce((acc, r) => acc + Number(r.lifetimeSales), 0)
      .toFixed(2);
    const lines = [
      [
        'Track',
        'Tags',
        'Status',
        'Licenses',
        'Lifetime Sales (USD)',
        'Last Licensed',
      ].join(','),
      ...rows.map((r) =>
        [
          ...base(r),
          String(r.licenseCount),
          r.lifetimeSales,
          r.lastLicensedAt ?? '',
        ].join(','),
      ),
      [
        esc(`TOTAL (${rows.length} tracks)`),
        '',
        '',
        String(totalLicenses),
        totalSales,
        '',
      ].join(','),
    ];
    return lines.join('\n') + '\n';
  }

  /** Distinct tags across the catalog, for the filter chips. */
  async tags(): Promise<string[]> {
    const rows = await this.db.execute<{ tag: string }>(
      sql`SELECT DISTINCT unnest(${track.tags}) AS tag FROM ${track} ORDER BY tag`,
    );
    return rows.rows.map((r) => r.tag);
  }

  async detail(id: string): Promise<TrackDetailDto> {
    const row = await this.db.query.track.findFirst({
      where: eq(track.id, id),
    });
    if (!row) throw new NotFoundException('Track not found');

    const [rollup] = await this.db
      .select({
        licenseCount: sql<number>`count(${license.id})::int`,
        lifetimeSales: sql<string>`coalesce(sum(${license.fee}), 0)::text`,
        lastLicensedAt: sql<string | null>`max(${license.startDate})`,
      })
      .from(license)
      .where(eq(license.trackId, id));

    const categoryPerformance = await this.db
      .select({
        categoryId: brandCategory.id,
        categoryName: brandCategory.name,
        amount: sql<string>`sum(${license.fee})::text`,
      })
      .from(license)
      .innerJoin(brand, eq(license.brandId, brand.id))
      .innerJoin(brandCategory, eq(brand.categoryId, brandCategory.id))
      .where(eq(license.trackId, id))
      .groupBy(brandCategory.id, brandCategory.name)
      .orderBy(sql`sum(${license.fee}) DESC`);

    // Trailing 24 months of commitment-basis sales, bucketed by quarter.
    const quarterlySales = (
      await this.db.execute<{ quarter: string; amount: string }>(sql`
        SELECT to_char(date_trunc('quarter', ${license.startDate}::date), '"Q"Q ''YY') AS quarter,
               sum(${license.fee})::text AS amount
        FROM ${license}
        WHERE ${license.trackId} = ${id}
          AND ${license.startDate} >= (current_date - interval '24 months')
        GROUP BY date_trunc('quarter', ${license.startDate}::date)
        ORDER BY date_trunc('quarter', ${license.startDate}::date)
      `)
    ).rows;

    const convertedDemos = await this.db
      .select({ id: demo.id, workingName: demo.workingName })
      .from(demo)
      .where(eq(demo.convertedTrackId, id));

    return {
      id: row.id,
      discoId: row.discoId,
      name: row.name,
      tags: row.tags,
      status: row.status,
      lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
      licenseCount: rollup?.licenseCount ?? 0,
      lifetimeSales: rollup?.lifetimeSales ?? '0',
      lastLicensedAt: rollup?.lastLicensedAt ?? null,
      categoryPerformance,
      quarterlySales,
      convertedDemos,
    };
  }
}
