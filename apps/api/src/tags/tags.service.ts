import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { CreateTagInput, TagDto } from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { tag, trackTag } from '../common/database/schema';

// Tag — the curated, platform-owned catalog vocabulary managed from Settings.
// Create is pick-or-create by case-insensitive name (idempotent); rename guards
// the same collision explicitly so the Settings screen gets a clean 409 rather
// than a raw unique-index error. Delete cascades to track_tag. See CONTEXT.md.
@Injectable()
export class TagsService {
  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  /** Full vocabulary with per-tag usage counts, ordered by name. */
  async list(): Promise<TagDto[]> {
    return this.db
      .select({
        id: tag.id,
        name: tag.name,
        usageCount: sql<number>`count(${trackTag.trackId})::int`,
      })
      .from(tag)
      .leftJoin(trackTag, eq(trackTag.tagId, tag.id))
      .groupBy(tag.id)
      .orderBy(tag.name);
  }

  async create(input: CreateTagInput, userId: string): Promise<TagDto> {
    const existing = await this.db.query.tag.findFirst({
      where: sql`lower(${tag.name}) = lower(${input.name})`,
    });
    if (existing)
      return { id: existing.id, name: existing.name, usageCount: 0 };
    const [row] = await this.db
      .insert(tag)
      .values({ name: input.name, createdBy: userId })
      .returning();
    return { id: row.id, name: row.name, usageCount: 0 };
  }

  async rename(id: string, input: CreateTagInput): Promise<TagDto> {
    // Explicit collision guard — a clean 409 beats the raw unique-index throw
    // category leans on, since rename lives front-and-center in Settings.
    const clash = await this.db.query.tag.findFirst({
      where: and(
        sql`lower(${tag.name}) = lower(${input.name})`,
        ne(tag.id, id),
      ),
    });
    if (clash)
      throw new ConflictException(`A tag named "${input.name}" already exists`);

    const [row] = await this.db
      .update(tag)
      .set({ name: input.name })
      .where(eq(tag.id, id))
      .returning();
    if (!row) throw new NotFoundException('Tag not found');
    return { id: row.id, name: row.name, usageCount: 0 };
  }

  /** Hard delete — track_tag rows cascade (the tag vanishes from its tracks). */
  async remove(id: string): Promise<{ id: string }> {
    const [row] = await this.db
      .delete(tag)
      .where(eq(tag.id, id))
      .returning({ id: tag.id });
    if (!row) throw new NotFoundException('Tag not found');
    return row;
  }
}
