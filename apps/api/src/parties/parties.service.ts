import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { count, eq, ilike, sql } from 'drizzle-orm';
import type {
  BrandCategoryDto,
  BrandDto,
  CreateBrandCategoryInput,
  CreateBrandInput,
  CreatePayerInput,
  PayerDto,
  UpdateBrandInput,
  UpdatePayerInput,
} from '@workspace/shared';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { brand, brandCategory, payer } from '../common/database/schema';

// Brand, Category, Payer — the three pick-or-create lookups. All creates are
// find-or-create by case-insensitive name so the combobox "Create X" action
// and the "Use {Brand} as payer" shortcut are idempotent.
@Injectable()
export class PartiesService {
  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  // ── Brand categories ──────────────────────────────────────────────────────

  async listCategories(search?: string): Promise<BrandCategoryDto[]> {
    const rows = await this.db
      .select({
        id: brandCategory.id,
        name: brandCategory.name,
        brandCount: count(brand.id),
      })
      .from(brandCategory)
      .leftJoin(brand, eq(brand.categoryId, brandCategory.id))
      .where(search ? ilike(brandCategory.name, `%${search}%`) : undefined)
      .groupBy(brandCategory.id)
      .orderBy(brandCategory.name);
    return rows;
  }

  async createCategory(
    input: CreateBrandCategoryInput,
    userId: string,
  ): Promise<BrandCategoryDto> {
    const existing = await this.db.query.brandCategory.findFirst({
      where: sql`lower(${brandCategory.name}) = lower(${input.name})`,
    });
    if (existing) return { id: existing.id, name: existing.name };
    const [row] = await this.db
      .insert(brandCategory)
      .values({ name: input.name, createdBy: userId })
      .returning();
    return { id: row.id, name: row.name };
  }

  async renameCategory(
    id: string,
    input: CreateBrandCategoryInput,
  ): Promise<BrandCategoryDto> {
    const [row] = await this.db
      .update(brandCategory)
      .set({ name: input.name })
      .where(eq(brandCategory.id, id))
      .returning();
    if (!row) throw new NotFoundException('Category not found');
    return { id: row.id, name: row.name };
  }

  // ── Brands ────────────────────────────────────────────────────────────────

  async listBrands(search?: string): Promise<BrandDto[]> {
    const rows = await this.db
      .select({
        id: brand.id,
        name: brand.name,
        categoryId: brand.categoryId,
        categoryName: brandCategory.name,
      })
      .from(brand)
      .innerJoin(brandCategory, eq(brand.categoryId, brandCategory.id))
      .where(search ? ilike(brand.name, `%${search}%`) : undefined)
      .orderBy(brand.name);
    return rows;
  }

  async createBrand(
    input: CreateBrandInput,
    userId: string,
  ): Promise<BrandDto> {
    const existing = await this.db.query.brand.findFirst({
      where: sql`lower(${brand.name}) = lower(${input.name})`,
      with: { category: true },
    });
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        categoryId: existing.categoryId,
        categoryName: existing.category.name,
      };
    }
    const [row] = await this.db
      .insert(brand)
      .values({ ...input, createdBy: userId })
      .returning();
    return this.brandById(row.id);
  }

  async updateBrand(id: string, input: UpdateBrandInput): Promise<BrandDto> {
    const [row] = await this.db
      .update(brand)
      .set(input)
      .where(eq(brand.id, id))
      .returning();
    if (!row) throw new NotFoundException('Brand not found');
    return this.brandById(id);
  }

  private async brandById(id: string): Promise<BrandDto> {
    const row = await this.db.query.brand.findFirst({
      where: eq(brand.id, id),
      with: { category: true },
    });
    if (!row) throw new NotFoundException('Brand not found');
    return {
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      categoryName: row.category.name,
    };
  }

  // ── Payers ────────────────────────────────────────────────────────────────

  async listPayers(search?: string): Promise<PayerDto[]> {
    const rows = await this.db
      .select({
        id: payer.id,
        name: payer.name,
        email: payer.email,
        address: payer.address,
      })
      .from(payer)
      .where(search ? ilike(payer.name, `%${search}%`) : undefined)
      .orderBy(payer.name);
    return rows;
  }

  async createPayer(
    input: CreatePayerInput,
    userId: string,
  ): Promise<PayerDto> {
    const existing = await this.db.query.payer.findFirst({
      where: sql`lower(${payer.name}) = lower(${input.name})`,
    });
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        address: existing.address,
      };
    }
    const [row] = await this.db
      .insert(payer)
      .values({
        name: input.name,
        email: input.email ?? null,
        address: input.address ?? null,
        createdBy: userId,
      })
      .returning();
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      address: row.address,
    };
  }

  async updatePayer(id: string, input: UpdatePayerInput): Promise<PayerDto> {
    const [row] = await this.db
      .update(payer)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.address !== undefined && { address: input.address }),
      })
      .where(eq(payer.id, id))
      .returning();
    if (!row) throw new NotFoundException('Payer not found');
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      address: row.address,
    };
  }
}
