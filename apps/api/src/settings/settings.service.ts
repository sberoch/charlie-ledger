import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import type {
  AddUserInput,
  AppSettingsDto,
  UpdateAppSettingsInput,
  UserDto,
} from '@workspace/shared';
import { auth } from '../auth/auth';
import type { Db } from '../common/database/db';
import { DrizzleProvider } from '../common/database/drizzle.module';
import { appSetting, invoice, user } from '../common/database/schema';

@Injectable()
export class SettingsService {
  constructor(@Inject(DrizzleProvider) private readonly db: Db) {}

  async get(): Promise<AppSettingsDto> {
    const row = await this.db.query.appSetting.findFirst({
      where: eq(appSetting.id, 1),
    });
    if (!row) throw new Error('app_setting singleton row missing');
    return {
      digestLookaheadDays: row.digestLookaheadDays,
      nextInvoiceNumber: row.nextInvoiceNumber,
    };
  }

  async update(input: UpdateAppSettingsInput): Promise<AppSettingsDto> {
    if (input.nextInvoiceNumber !== undefined) {
      // The counter may only move to a value that cannot collide with an
      // already-issued number — this is how Charlie's QuickBooks sequence is
      // continued at go-live, never a way to rewind (ADR-0001).
      const [{ max }] = (
        await this.db.execute<{ max: number | null }>(
          sql`SELECT max(number) AS max FROM ${invoice}`,
        )
      ).rows;
      if (max !== null && input.nextInvoiceNumber <= max)
        throw new BadRequestException(
          `Next invoice number must be greater than ${max} (highest issued)`,
        );
    }
    await this.db
      .update(appSetting)
      .set({
        ...(input.digestLookaheadDays !== undefined && {
          digestLookaheadDays: input.digestLookaheadDays,
        }),
        ...(input.nextInvoiceNumber !== undefined && {
          nextInvoiceNumber: input.nextInvoiceNumber,
        }),
      })
      .where(eq(appSetting.id, 1));
    return this.get();
  }

  async listUsers(): Promise<UserDto[]> {
    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(user)
      .orderBy(desc(user.createdAt));
    return rows.map((u) => ({ ...u, image: u.image ?? null }));
  }

  /** No self-signup: users are added here, by an existing user. */
  async addUser(input: AddUserInput): Promise<UserDto> {
    const result = await auth.api.signUpEmail({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
      },
    });
    return {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      image: result.user.image ?? null,
    };
  }
}
