import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { AlbumDto, CreateAlbumInput } from '@workspace/shared';
import type { Db, DbTransaction } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import {
  album,
  license,
  royaltyPayment,
  track,
} from '../common/database/schema';

// Album — the library release lookup, managed from Settings and picked-or-
// created from the Track form. Mirrors TagsService (clean 409 on rename
// clash, pick-or-create by case-insensitive name). Delete SET NULLs the
// album's tracks back to "No album". See CONTEXT.md ("Album").
@Injectable()
export class AlbumsService {
  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  /** Every album with its track count and lifetime money (archived tracks
   *  included — history does not move), ordered by name. One query feeds
   *  both the Settings panel and the Tracks list's album summary strip. */
  async list(): Promise<AlbumDto[]> {
    const rows = await this.db.execute<{
      id: string;
      name: string;
      track_count: number;
      lifetime_sales: string;
      lifetime_royalties: string;
    }>(sql`
      SELECT a.id, a.name,
        (SELECT count(*)::int FROM ${track} t WHERE t.album_id = a.id) AS track_count,
        (SELECT coalesce(sum(l.fee), 0)::text FROM ${license} l
           JOIN ${track} t ON t.id = l.track_id WHERE t.album_id = a.id) AS lifetime_sales,
        (SELECT coalesce(sum(r.amount), 0)::text FROM ${royaltyPayment} r
           JOIN ${track} t ON t.id = r.track_id WHERE t.album_id = a.id) AS lifetime_royalties
      FROM ${album} a
      ORDER BY a.name
    `);
    return rows.rows.map((r) => ({
      id: r.id,
      name: r.name,
      trackCount: r.track_count,
      lifetimeSales: r.lifetime_sales,
      lifetimeRoyalties: r.lifetime_royalties,
    }));
  }

  async create(input: CreateAlbumInput, userId: string): Promise<AlbumDto> {
    const id = await this.resolve(this.db, input.name, userId);
    const row = (await this.list()).find((a) => a.id === id);
    if (!row) throw new NotFoundException('Album not found');
    return row;
  }

  /** Case-insensitive pick-or-create by name → id. Runs in the caller's
   *  transaction when given one (the Track form's inline create). */
  async resolve(
    tx: Db | DbTransaction,
    name: string,
    userId: string,
  ): Promise<string> {
    const trimmed = name.trim();
    const existing = await tx.query.album.findFirst({
      where: sql`lower(${album.name}) = lower(${trimmed})`,
    });
    if (existing) return existing.id;
    const [created] = await tx
      .insert(album)
      .values({ name: trimmed, createdBy: userId })
      .returning({ id: album.id });
    return created.id;
  }

  async rename(id: string, input: CreateAlbumInput): Promise<AlbumDto> {
    const clash = await this.db.query.album.findFirst({
      where: and(
        sql`lower(${album.name}) = lower(${input.name})`,
        ne(album.id, id),
      ),
    });
    if (clash)
      throw new ConflictException(
        `An album named "${input.name}" already exists`,
      );
    const [row] = await this.db
      .update(album)
      .set({ name: input.name })
      .where(eq(album.id, id))
      .returning({ id: album.id });
    if (!row) throw new NotFoundException('Album not found');
    const dto = (await this.list()).find((a) => a.id === id);
    if (!dto) throw new NotFoundException('Album not found');
    return dto;
  }

  /** Hard delete — the FK SET NULLs its tracks back to "No album". */
  async remove(id: string): Promise<{ id: string }> {
    const [row] = await this.db
      .delete(album)
      .where(eq(album.id, id))
      .returning({ id: album.id });
    if (!row) throw new NotFoundException('Album not found');
    return row;
  }
}
