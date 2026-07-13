import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { asc } from 'drizzle-orm';
import { db } from '../common/database/db';
import { payer, royaltyPayment, user } from '../common/database/schema';

/**
 * Historical royalty import — the one-off 2020–2026 QuickBooks backfill
 * (CONTEXT.md "Royalty import", ADR-0009).
 *
 *   pnpm import:royalties -- <source.csv> [--dry-run]
 *
 * Each source line mints exactly one royalty payment, verbatim: $0 rows are
 * imported, blank descriptions stay blank, payer names are kept as written,
 * and the original QuickBooks invoice numbers are dropped entirely. Payers
 * are matched case-insensitively by name and created (empty bill-to) when
 * missing. No review round-trip (there is no matching to get wrong) and no
 * links minted. Idempotent by the composite key
 * (date, payer, description, amount): re-runs skip existing rows.
 */

// ── CSV (RFC 4180: quoted fields, embedded commas, "" escapes) ──────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ── Source row shape (QuickBooks "Sales by Product/Service Detail") ─────────

const COL = {
  date: 1,
  type: 2,
  num: 3, // QB invoice number — read for validation, then dropped
  customer: 4,
  description: 5,
  amount: 8, // final line amount (quantity already multiplied in)
} as const;

interface SourceRow {
  key: string;
  isoDate: string;
  payerName: string;
  description: string | null;
  amount: string; // normalized "1234.56"
}

function parseAmount(raw: string): string {
  const clean = raw.replaceAll(',', '').replaceAll('$', '').trim();
  if (clean === '') return '0.00'; // the $0 SAG rows leave Amount blank-or-zero
  if (!/^-?\d+(\.\d+)?$/.test(clean))
    throw new Error(`unparseable amount "${raw}"`);
  const n = Number(clean);
  if (n < 0) throw new Error(`negative amount "${raw}" — not expected`);
  return n.toFixed(2);
}

function parseDate(raw: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) throw new Error(`unparseable date "${raw}"`);
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/** The idempotency key — matches what a DB row round-trips back as. */
function rowKey(r: {
  isoDate: string;
  payerName: string;
  description: string | null;
  amount: string;
}): string {
  return [
    r.isoDate,
    r.payerName.toLowerCase(),
    r.description ?? '',
    r.amount,
  ].join('|');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const sourcePath = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  if (!sourcePath) {
    console.error('Usage: pnpm import:royalties -- <source.csv> [--dry-run]');
    process.exit(1);
  }

  // ── Parse + validate the source (fail fast, before any DB write) ──────────
  const rows = parseCsv(readFileSync(resolve(sourcePath), 'utf8'));
  const headerIdx = rows.findIndex((r) => r.includes('Transaction date'));
  if (headerIdx < 0) throw new Error('header row not found (Transaction date)');
  const header = rows[headerIdx];
  for (const [name, idx] of [
    ['Transaction date', COL.date],
    ['Transaction type', COL.type],
    ['Num', COL.num],
    ['Customer full name', COL.customer],
    ['Description', COL.description],
    ['Amount', COL.amount],
  ] as const) {
    if (header[idx]?.trim() !== name)
      throw new Error(
        `column ${idx} is "${header[idx]}", expected "${name}" — sheet layout changed, aborting`,
      );
  }

  const dataCells = rows
    .slice(headerIdx + 1)
    .filter(
      (r) =>
        r.length >= 9 &&
        r[COL.date].trim() !== '' &&
        r[COL.type].trim() === 'Invoice',
    );

  const errors: string[] = [];
  const source: SourceRow[] = [];
  dataCells.forEach((cells, index) => {
    try {
      const partial = {
        isoDate: parseDate(cells[COL.date]),
        payerName: cells[COL.customer].trim(),
        description: cells[COL.description].trim() || null,
        amount: parseAmount(cells[COL.amount]),
      };
      if (partial.payerName === '') throw new Error('blank payer');
      source.push({ key: rowKey(partial), ...partial });
    } catch (e) {
      errors.push(
        `row ${headerIdx + 2 + index} (${cells[COL.date]}): ${(e as Error).message}`,
      );
    }
  });
  if (errors.length > 0) {
    console.error(
      `ABORT — ${errors.length} unparseable row(s), nothing imported:`,
    );
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
  const keys = new Set(source.map((r) => r.key));
  if (keys.size !== source.length)
    throw new Error(
      'idempotency-key collision within the source (two identical rows) — aborting',
    );

  // ── Prior imports: rebuild keys from what's already in the table ──────────
  const existing = await db.query.royaltyPayment.findMany({
    with: { payer: true },
  });
  const existingKeys = new Set(
    existing.map((r) =>
      rowKey({
        isoDate: r.paymentDate,
        payerName: r.payer.name,
        description: r.description,
        amount: r.amount,
      }),
    ),
  );
  const toImport = source.filter((r) => !existingKeys.has(r.key));
  const skipped = source.length - toImport.length;

  const payerNames = [...new Set(toImport.map((r) => r.payerName))];
  const total = toImport.reduce((s, r) => s + Number(r.amount), 0).toFixed(2);

  if (dryRun) {
    console.log('DRY RUN — nothing written.');
    console.log(`Source rows:        ${source.length}`);
    console.log(`Would import:       ${toImport.length} ($${total})`);
    console.log(`Skipped (already):  ${skipped}`);
    console.log(`Payers referenced:  ${payerNames.join(' · ')}`);
    process.exit(0);
  }

  const firstUser = await db.query.user.findFirst({
    orderBy: asc(user.createdAt),
  });
  const createdBy = firstUser?.id ?? null;

  // ── Import (one transaction; chronological for tidy created_at order) ─────
  toImport.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  let createdPayers = 0;

  await db.transaction(async (tx) => {
    const payersByName = new Map(
      (await tx.select().from(payer)).map((p) => [p.name.toLowerCase(), p.id]),
    );

    for (const row of toImport) {
      let payerId = payersByName.get(row.payerName.toLowerCase());
      if (!payerId) {
        // Kept as written (e.g. "Gareth Smith (Personal)"); empty bill-to —
        // royalty-only payers never appear on an invoice.
        const [p] = await tx
          .insert(payer)
          .values({ name: row.payerName, createdBy })
          .returning();
        payerId = p.id;
        payersByName.set(row.payerName.toLowerCase(), payerId);
        createdPayers++;
      }

      await tx.insert(royaltyPayment).values({
        paymentDate: row.isoDate,
        payerId,
        description: row.description,
        amount: row.amount,
        createdBy,
      });
    }
  });

  console.log(`Source rows:        ${source.length}`);
  console.log(
    `Imported:           ${toImport.length} royalty payments ($${total})`,
  );
  console.log(`Skipped (already):  ${skipped}`);
  console.log(`New payers:         ${createdPayers}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('IMPORT FAILED — transaction rolled back, nothing partial:', e);
  process.exit(1);
});
