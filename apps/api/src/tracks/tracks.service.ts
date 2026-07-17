import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  formatLicenseSpan,
  type CreateTrackInput,
  type ImportTracksInput,
  type ImportTracksResultDto,
  type TrackDetailDto,
  type TrackLicenseHistoryItemDto,
  type TrackListItemDto,
  type TrackListQuery,
  type TrackStatus,
  type UpdateTrackInput,
} from '@workspace/shared';
import type { Db, DbTransaction } from '../common/database/db';
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
import { isSellRecommended } from './sell-recommended';

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
        // Internal — the "Sell signal" fallback reference date. Stripped below.
        createdAt: track.createdAt,
      })
      .from(track)
      .leftJoin(license, eq(license.trackId, track.id))
      .where(sql.join(conditions, sql` AND `))
      .groupBy(track.id)
      .orderBy(sql`coalesce(sum(${license.fee}), 0) DESC`, track.name);

    const now = new Date();
    return rows.map(({ createdAt, ...row }) => ({
      ...row,
      createdAt: createdAt.toISOString().slice(0, 10),
      sellRecommended: isSellRecommended(
        { status: row.status, lastLicensedAt: row.lastLicensedAt, createdAt },
        now,
      ),
    }));
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
      // inArray above only matches real track ids, but the column is nullable.
      if (!rec.trackId) continue;
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

  /**
   * Create a catalog Track. Name is case-insensitively unique (a clean 409
   * beats the raw unique-index throw); tags are pick-or-created and synced.
   * A new Track is always `active`. See CONTEXT.md / ADR-0006.
   */
  async create(
    input: CreateTrackInput,
    userId: string,
  ): Promise<TrackDetailDto> {
    await this.assertNameAvailable(input.name);
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(track)
        .values({ name: input.name })
        .returning({ id: track.id });
      await this.syncTags(tx, row.id, input.tags, userId);
      return row.id;
    });
    return this.detail(id);
  }

  /**
   * Bulk import from a Disco CSV export (CONTEXT.md "Track import"). Best-effort,
   * not all-or-nothing: titles are trimmed, blanks dropped, and the set deduped
   * case-insensitively *within the batch* (first occurrence wins) so the single
   * bulk insert never contains an intra-batch collision. A bare
   * `onConflictDoNothing()` (the natural-key index is on `lower(name)`, an
   * expression target can't reference — same constraint as the seed) then skips
   * any title already in the catalog, or one created by a race, without aborting
   * the batch. `imported` is what actually landed; `skipped` is the distinct
   * submitted titles minus those.
   *
   * Tags: each DTO carries the candidate words the browser pulled from the
   * track's COMMENTS column. The import is an **allow-list match, never a
   * pick-or-create** — a candidate becomes a tag only if it already exists in
   * the platform's curated mood vocabulary (seed-tags.ts), so genres /
   * instruments / junk are dropped by simply not being in the vocabulary. Tags
   * are attached only to *newly imported* tracks; an existing (skipped) track is
   * left entirely untouched.
   */
  async importTracks(input: ImportTracksInput): Promise<ImportTracksResultDto> {
    // Trim, drop blanks, dedupe case-insensitively (first spelling wins),
    // carrying each survivor's candidate tag words.
    const byKey = new Map<string, { name: string; tags: string[] }>();
    for (const t of input.tracks) {
      const name = t.name.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, { name, tags: t.tags });
    }
    const survivors = [...byKey.values()];
    if (survivors.length === 0) return { imported: [], skipped: [] };

    // The live vocabulary IS the allow-list: candidate word → tag id, by lower().
    const vocab = await this.db
      .select({ id: tag.id, name: tag.name })
      .from(tag);
    const tagIdByName = new Map(vocab.map((t) => [t.name.toLowerCase(), t.id]));

    const result = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(track)
        .values(survivors.map((s) => ({ name: s.name })))
        .onConflictDoNothing()
        .returning({ id: track.id, name: track.name });

      // Attach matched mood tags to each freshly-inserted track.
      const insertedIdByKey = new Map(
        inserted.map((r) => [r.name.toLowerCase(), r.id]),
      );
      const assignments: Array<{ trackId: string; tagId: string }> = [];
      for (const s of survivors) {
        const trackId = insertedIdByKey.get(s.name.toLowerCase());
        if (!trackId) continue; // skipped (already existed) — leave untouched
        const tagIds = new Set<string>();
        for (const raw of s.tags) {
          const id = tagIdByName.get(raw.trim().toLowerCase());
          if (id) tagIds.add(id);
        }
        for (const tagId of tagIds) assignments.push({ trackId, tagId });
      }
      if (assignments.length > 0) await tx.insert(trackTag).values(assignments);

      return inserted;
    });

    const importedKeys = new Set(result.map((r) => r.name.toLowerCase()));
    const imported = survivors
      .map((s) => s.name)
      .filter((n) => importedKeys.has(n.toLowerCase()));
    const skipped = survivors
      .map((s) => s.name)
      .filter((n) => !importedKeys.has(n.toLowerCase()));
    return { imported, skipped };
  }

  /** Update name and/or tags. Omitted `tags` leaves assignments untouched; an
   *  empty array clears them. `status` is never touched here (see setStatus). */
  async update(
    id: string,
    input: UpdateTrackInput,
    userId: string,
  ): Promise<TrackDetailDto> {
    const existing = await this.db.query.track.findFirst({
      where: eq(track.id, id),
    });
    if (!existing) throw new NotFoundException('Track not found');
    if (input.name !== undefined && input.name !== existing.name)
      await this.assertNameAvailable(input.name, id);

    await this.db.transaction(async (tx) => {
      if (input.name !== undefined)
        await tx
          .update(track)
          .set({ name: input.name })
          .where(eq(track.id, id));
      if (input.tags !== undefined)
        await this.syncTags(tx, id, input.tags, userId);
    });
    return this.detail(id);
  }

  /** Archive / unarchive — the only door to a Track's `status`. */
  async setStatus(id: string, status: TrackStatus): Promise<TrackDetailDto> {
    const [row] = await this.db
      .update(track)
      .set({ status })
      .where(eq(track.id, id))
      .returning({ id: track.id });
    if (!row) throw new NotFoundException('Track not found');
    return this.detail(id);
  }

  /**
   * Hard delete — permitted only when the Track carries no Licenses (its
   * financial history). A licensed Track must be archived instead (409). On a
   * permitted delete, track_tag rows cascade and any demo.converted_track_id
   * pointing here is nulled by the FK. See CONTEXT.md / ADR-0006.
   */
  async remove(id: string): Promise<{ id: string }> {
    const existing = await this.db.query.track.findFirst({
      where: eq(track.id, id),
    });
    if (!existing) throw new NotFoundException('Track not found');

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(license)
      .where(eq(license.trackId, id));
    if (count > 0)
      throw new ConflictException(
        `This track has ${count} license${count === 1 ? '' : 's'} and can't be deleted — archive it instead.`,
      );

    await this.db.delete(track).where(eq(track.id, id));
    return { id };
  }

  /** Case-insensitive name guard, mirroring tags.rename's clean 409. */
  private async assertNameAvailable(name: string, excludeId?: string) {
    const clash = await this.db.query.track.findFirst({
      where: excludeId
        ? and(
            sql`lower(${track.name}) = lower(${name})`,
            ne(track.id, excludeId),
          )
        : sql`lower(${track.name}) = lower(${name})`,
    });
    if (clash)
      throw new ConflictException(`A track named "${name}" already exists`);
  }

  /**
   * Resolve a flat list of tag names to ids (case-insensitive pick-or-create,
   * same rule as tags.create) and replace the Track's assignment set. Runs in
   * the caller's transaction.
   */
  private async syncTags(
    tx: DbTransaction,
    trackId: string,
    names: string[],
    userId: string,
  ): Promise<void> {
    const tagIds: string[] = [];
    for (const raw of names) {
      const name = raw.trim();
      if (!name) continue;
      const existing = await tx.query.tag.findFirst({
        where: sql`lower(${tag.name}) = lower(${name})`,
      });
      if (existing) {
        tagIds.push(existing.id);
        continue;
      }
      const [created] = await tx
        .insert(tag)
        .values({ name, createdBy: userId })
        .returning({ id: tag.id });
      tagIds.push(created.id);
    }

    await tx.delete(trackTag).where(eq(trackTag.trackId, trackId));
    const unique = [...new Set(tagIds)];
    if (unique.length > 0)
      await tx
        .insert(trackTag)
        .values(unique.map((tagId) => ({ trackId, tagId })));
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
      createdAt: row.createdAt.toISOString().slice(0, 10),
      sellRecommended: isSellRecommended(
        {
          status: row.status,
          lastLicensedAt: rollup?.lastLicensedAt ?? null,
          createdAt: row.createdAt,
        },
        new Date(),
      ),
      categoryPerformance,
      quarterlySales,
      convertedDemos,
    };
  }
}
