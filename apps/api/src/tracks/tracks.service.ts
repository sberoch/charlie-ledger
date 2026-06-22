import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import {
  formatLicenseSpan,
  type TrackDetailDto,
  type TrackLicenseHistoryItemDto,
  type TrackListItemDto,
  type TrackListQuery,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import {
  brand,
  brandCategory,
  demo,
  license,
  tag,
  track,
  trackTag,
} from '../common/database/schema';

// Track — catalog read models (list/detail) plus the in-use tag chips. Tags
// are sourced from the track_tag join; the `tags: string[]` DTO contract is
// preserved so export/PDF/dashboard consumers are unaffected. See CONTEXT.md.
@Injectable()
export class TracksService {
  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  async list(query: TrackListQuery): Promise<TrackListItemDto[]> {
    const conditions = [sql`true`];
    if (query.status) conditions.push(sql`${track.status} = ${query.status}`);
    if (query.tag)
      conditions.push(sql`exists (
        select 1 from ${trackTag}
        join ${tag} on ${tag.id} = ${trackTag.tagId}
        where ${trackTag.trackId} = ${track.id} and ${tag.name} = ${query.tag}
      )`);
    if (query.search)
      conditions.push(sql`${track.name} ILIKE ${`%${query.search}%`}`);

    const rows = await this.db
      .select({
        id: track.id,
        name: track.name,
        // Flat name array from the join — preserves the `tags: string[]` DTO.
        tags: sql<string[]>`coalesce((
          select array_agg(${tag.name} order by ${tag.name})
          from ${trackTag}
          join ${tag} on ${tag.id} = ${trackTag.tagId}
          where ${trackTag.trackId} = ${track.id}
        ), '{}'::text[])`,
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
   * Attaches the full license history (Brand + span, no fees) to each row,
   * chronological by start date. One extra query for the whole page — the
   * groupBy aggregate in `list()` is left untouched. Only called when the
   * export opts into `history`.
   */
  async withLicenseHistory(
    rows: TrackListItemDto[],
  ): Promise<TrackListItemDto[]> {
    if (rows.length === 0) return rows;

    const records = await this.db
      .select({
        trackId: license.trackId,
        brandName: brand.name,
        startDate: license.startDate,
        endDate: license.endDate,
      })
      .from(license)
      .innerJoin(brand, eq(license.brandId, brand.id))
      .where(
        inArray(
          license.trackId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(license.startDate));

    const byTrack = new Map<string, TrackLicenseHistoryItemDto[]>();
    for (const rec of records) {
      const list = byTrack.get(rec.trackId) ?? [];
      list.push({
        brandName: rec.brandName,
        startDate: rec.startDate,
        endDate: rec.endDate,
      });
      byTrack.set(rec.trackId, list);
    }

    return rows.map((r) => ({ ...r, licenses: byTrack.get(r.id) ?? [] }));
  }

  /**
   * Track export → CSV. Mirrors the list (one row per Track); `financials`
   * adds the license-derived columns + a footer total (CONTEXT.md). `history`
   * appends one share-safe "License History" column (Brands + spans, no fees),
   * the full list ';'-joined like Tags so it never collides with the comma
   * delimiter. Tags carry the FULL list joined with ';' for the same reason.
   */
  toCsv(
    rows: TrackListItemDto[],
    financials: boolean,
    history: boolean,
  ): string {
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const status = (s: TrackListItemDto['status']) =>
      s === 'archived' ? 'Archived' : 'Active';
    const base = (r: TrackListItemDto) => [
      esc(r.name),
      esc(r.tags.join('; ')),
      status(r.status),
    ];
    // Full history ';'-joined into one cell — no cap, no fees.
    const historyCell = (r: TrackListItemDto) =>
      esc((r.licenses ?? []).map(formatLicenseSpan).join('; '));

    if (!financials) {
      const header = ['Track', 'Tags', 'Status'];
      if (history) header.push('License History');
      const lines = [
        header.join(','),
        ...rows.map((r) => {
          const cells = base(r);
          if (history) cells.push(historyCell(r));
          return cells.join(',');
        }),
        [
          esc(`TOTAL (${rows.length} tracks)`),
          '',
          '',
          ...(history ? [''] : []),
        ].join(','),
      ];
      return lines.join('\n') + '\n';
    }

    const totalLicenses = rows.reduce((acc, r) => acc + r.licenseCount, 0);
    const totalSales = rows
      .reduce((acc, r) => acc + Number(r.lifetimeSales), 0)
      .toFixed(2);
    const header = [
      'Track',
      'Tags',
      'Status',
      'Licenses',
      'Lifetime Sales (USD)',
      'Last Licensed',
    ];
    if (history) header.push('License History');
    const lines = [
      header.join(','),
      ...rows.map((r) => {
        const cells = [
          ...base(r),
          String(r.licenseCount),
          r.lifetimeSales,
          r.lastLicensedAt ?? '',
        ];
        if (history) cells.push(historyCell(r));
        return cells.join(',');
      }),
      [
        esc(`TOTAL (${rows.length} tracks)`),
        '',
        '',
        String(totalLicenses),
        totalSales,
        '',
        ...(history ? [''] : []),
      ].join(','),
    ];
    return lines.join('\n') + '\n';
  }

  /** Distinct tags actually present on tracks, for the filter chips. Stays
   *  in-use-only (a zero-usage tag would be a guaranteed-empty filter); the
   *  full managed vocabulary lives behind GET /tags. */
  async tags(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ name: tag.name })
      .from(tag)
      .innerJoin(trackTag, eq(trackTag.tagId, tag.id))
      .orderBy(tag.name);
    return rows.map((r) => r.name);
  }

  async detail(id: string): Promise<TrackDetailDto> {
    const row = await this.db.query.track.findFirst({
      where: eq(track.id, id),
    });
    if (!row) throw new NotFoundException('Track not found');

    const tagRows = await this.db
      .select({ name: tag.name })
      .from(trackTag)
      .innerJoin(tag, eq(tag.id, trackTag.tagId))
      .where(eq(trackTag.trackId, id))
      .orderBy(tag.name);
    const tags = tagRows.map((r) => r.name);

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
      name: row.name,
      tags,
      status: row.status,
      licenseCount: rollup?.licenseCount ?? 0,
      lifetimeSales: rollup?.lifetimeSales ?? '0',
      lastLicensedAt: rollup?.lastLicensedAt ?? null,
      categoryPerformance,
      quarterlySales,
      convertedDemos,
    };
  }
}
