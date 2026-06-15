import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { defaultDueDate, todayIso, type IsoDate } from '@workspace/shared';
import type { DbTransaction } from '../common/database/db';
import { appSetting, invoice } from '../common/database/schema';

export interface IssueInvoiceParams {
  source: { kind: 'license'; id: string } | { kind: 'demo'; id: string };
  /** Snapshotted verbatim — later Payer edits never touch this invoice. */
  billTo: { name: string; email: string | null; address: string | null };
  /** Frozen from the source's fee at issue time. */
  amount: string;
  description: string;
  issueDate?: IsoDate;
  dueDate?: IsoDate;
  userId: string | null;
}

/**
 * The ONLY path to an invoice number (ADR-0001) and the only constructor of
 * invoices (ADR-0002: every License/Demo is born with one). Always runs inside
 * the caller's transaction: the counter row is locked FOR UPDATE, so an aborted
 * create returns its number and the sequence stays gapless.
 */
@Injectable()
export class InvoiceIssuerService {
  async issue(tx: DbTransaction, params: IssueInvoiceParams) {
    const [counter] = await tx
      .select({ next: appSetting.nextInvoiceNumber })
      .from(appSetting)
      .where(eq(appSetting.id, 1))
      .for('update');
    if (!counter) throw new Error('app_setting counter row missing');

    const issueDate = params.issueDate ?? todayIso();
    const [row] = await tx
      .insert(invoice)
      .values({
        number: counter.next,
        licenseId: params.source.kind === 'license' ? params.source.id : null,
        demoId: params.source.kind === 'demo' ? params.source.id : null,
        billToName: params.billTo.name,
        billToEmail: params.billTo.email,
        billToAddress: params.billTo.address,
        amount: params.amount,
        description: params.description,
        issueDate,
        dueDate: params.dueDate ?? defaultDueDate(issueDate),
        createdBy: params.userId,
      })
      .returning();

    await tx
      .update(appSetting)
      .set({ nextInvoiceNumber: sql`${appSetting.nextInvoiceNumber} + 1` })
      .where(eq(appSetting.id, 1));

    return row;
  }
}
