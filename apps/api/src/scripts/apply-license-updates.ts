import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { and, eq, inArray, isNull, like } from 'drizzle-orm';
import { db } from '../common/database/db';
import {
  brand,
  brandCategory,
  invoice,
  license,
} from '../common/database/schema';

/**
 * Apply Charlie's updated-licenses.csv (June 2026 re-export + his two added
 * columns) on top of the historical license import:
 *
 *   pnpm apply:license-updates -- <updated-licenses.csv>
 *
 *   - Status: rows he marked Unpaid get their invoice's paidDate cleared
 *     (the import births every invoice Paid). Clear-only: a prod-unpaid
 *     invoice the CSV calls Paid is reported, never re-marked.
 *   - Category: brands still in "Uncategorized" move to his per-row Category.
 *     Brands he already categorized in-app are reported on divergence, never
 *     overwritten; brands not yet in prod are skipped.
 *
 * Idempotent — re-run after every needs-review round trip so late-importing
 * rows (and their brands) pick up their status/category.
 */

// ── CSV (RFC 4180: quoted fields, embedded newlines/commas, "" escapes) ─────

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

// ── Source row shape (Charlie's layout: Status + Category inserted, Num
//    renamed "Invoice Number" — NOT the original QuickBooks layout) ──────────

const COL = {
  date: 1,
  type: 2,
  num: 3,
  status: 4,
  brand: 6,
  category: 7,
  track: 8,
  amount: 14,
} as const;

// Same identity as import-licenses.ts rowKey: raw (date, num, brand, track,
// amount) — verified all 253 keys reproduce against the first prod run.
function rowKey(cells: string[]): string {
  const raw = [COL.date, COL.num, COL.brand, COL.track, COL.amount]
    .map((i) => (cells[i] ?? '').trim())
    .join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

const IMPORT_TAG = /\[import:([0-9a-f]{16})\]/;

// ── Grilled rulings (2026-07-17) ─────────────────────────────────────────────

// Category misspellings folded into the canonical name.
const CATEGORY_TYPOS: Record<string, string> = {
  finace: 'Finance',
};

// A Brand carries exactly one Category; where Charlie's rows disagree, these
// arbitrate. Any conflict NOT listed here aborts the run.
const CONFLICT_RULINGS: Record<string, string> = {
  unknown: 'Sizzle Reel',
  intermix: 'Fashion',
  'apple tv': 'Film',
};

const UNCATEGORIZED = 'uncategorized';

interface SourceRow {
  key: string;
  isoDate: string;
  num: string;
  brandName: string;
  category: string; // typo-fixed, '' = no opinion
  unpaid: boolean;
  amount: string;
}

function parseDate(raw: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) throw new Error(`unparseable date "${raw}"`);
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const sourcePath = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!sourcePath) {
    console.error('Usage: pnpm apply:license-updates -- <updated-licenses.csv>');
    process.exit(1);
  }

  // ── Parse + validate (fail fast, before any DB write) ─────────────────────
  const rows = parseCsv(readFileSync(resolve(sourcePath), 'utf8'));
  const headerIdx = rows.findIndex((r) => r.includes('Transaction date'));
  if (headerIdx < 0) throw new Error('header row not found (Transaction date)');
  const header = rows[headerIdx];
  for (const [name, idx] of [
    ['Transaction date', COL.date],
    ['Transaction type', COL.type],
    ['Invoice Number', COL.num],
    ['Status', COL.status],
    ['Brand', COL.brand],
    ['Category', COL.category],
    ['Track', COL.track],
    ['Amount', COL.amount],
  ] as const) {
    if (header[idx]?.trim() !== name)
      throw new Error(
        `column ${idx} is "${header[idx]}", expected "${name}" — this is not ` +
          `Charlie's updated-licenses layout, aborting`,
      );
  }

  const errors: string[] = [];
  const source: SourceRow[] = [];
  rows
    .slice(headerIdx + 1)
    .filter(
      (r) =>
        r.length >= 15 &&
        r[COL.date].trim() !== '' &&
        r[COL.type].trim() === 'License',
    )
    .forEach((cells, index) => {
      try {
        const status = cells[COL.status].trim();
        if (status !== 'Paid' && status !== 'Unpaid')
          throw new Error(`unknown Status "${status}"`);
        const rawCat = cells[COL.category].trim();
        source.push({
          key: rowKey(cells),
          isoDate: parseDate(cells[COL.date]),
          num: cells[COL.num].trim(),
          brandName: cells[COL.brand].trim(),
          category: CATEGORY_TYPOS[rawCat.toLowerCase()] ?? rawCat,
          unpaid: status === 'Unpaid',
          amount: cells[COL.amount].trim(),
        });
      } catch (e) {
        errors.push(`data row ${index + 1}: ${(e as Error).message}`);
      }
    });
  if (errors.length > 0) {
    console.error(`ABORT — ${errors.length} bad row(s), nothing applied:`);
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
  if (new Set(source.map((r) => r.key)).size !== source.length)
    throw new Error('row-key collision in source — aborting');

  // ── Resolve each Brand to its single Category ─────────────────────────────
  const brandVotes = new Map<string, { name: string; cats: Set<string> }>();
  for (const r of source) {
    if (r.category === '') continue; // empty = abstain
    const k = r.brandName.toLowerCase();
    const v = brandVotes.get(k) ?? { name: r.brandName, cats: new Set() };
    v.cats.add(r.category);
    brandVotes.set(k, v);
  }
  const targetCategory = new Map<string, string>(); // lower brand → category
  const unruled: string[] = [];
  for (const [k, v] of brandVotes) {
    const cats = [...v.cats];
    if (cats.length === 1) targetCategory.set(k, cats[0]);
    else if (CONFLICT_RULINGS[k]) targetCategory.set(k, CONFLICT_RULINGS[k]);
    else unruled.push(`${v.name} → ${cats.sort().join(' | ')}`);
  }
  if (unruled.length > 0) {
    console.error(
      `ABORT — ${unruled.length} brand(s) with conflicting categories and no ` +
        'ruling in CONFLICT_RULINGS, nothing applied:',
    );
    for (const u of unruled) console.error('  ' + u);
    process.exit(1);
  }

  // ── Load prod state ───────────────────────────────────────────────────────
  const tagged = await db
    .select({ id: license.id, notes: license.notes })
    .from(license)
    .where(like(license.notes, '%[import:%'));
  const licenseByKey = new Map<string, string>();
  for (const l of tagged) {
    const m = IMPORT_TAG.exec(l.notes ?? '');
    if (m) licenseByKey.set(m[1], l.id);
  }

  const licenseIds = source
    .map((r) => licenseByKey.get(r.key))
    .filter((id): id is string => id !== undefined);
  const liveInvoices = licenseIds.length
    ? await db
        .select({
          id: invoice.id,
          licenseId: invoice.licenseId,
          number: invoice.number,
          paidDate: invoice.paidDate,
        })
        .from(invoice)
        .where(
          and(inArray(invoice.licenseId, licenseIds), isNull(invoice.voidedAt)),
        )
    : [];
  const invoiceByLicense = new Map(liveInvoices.map((i) => [i.licenseId, i]));

  const brandRows = await db
    .select({ id: brand.id, name: brand.name, categoryId: brand.categoryId })
    .from(brand);
  const brandByLower = new Map(brandRows.map((b) => [b.name.toLowerCase(), b]));
  const categoryRows = await db.select().from(brandCategory);
  const categoryByLower = new Map(
    categoryRows.map((c) => [c.name.toLowerCase(), c]),
  );
  const uncategorizedId = categoryByLower.get(UNCATEGORIZED)?.id ?? null;

  // ── Plan ──────────────────────────────────────────────────────────────────
  const toUnpay: { row: SourceRow; invoiceId: string; number: number }[] = [];
  const alreadyUnpaid: string[] = [];
  const notImported: string[] = [];
  const paidAnomalies: string[] = [];

  for (const r of source) {
    const licId = licenseByKey.get(r.key);
    const inv = licId ? invoiceByLicense.get(licId) : undefined;
    if (r.unpaid) {
      if (!inv)
        notImported.push(
          `${r.isoDate} #${r.num} ${r.brandName} $${r.amount} — not imported yet (re-run after its round trip)`,
        );
      else if (inv.paidDate === null)
        alreadyUnpaid.push(`invoice ${inv.number} (${r.isoDate} ${r.brandName})`);
      else toUnpay.push({ row: r, invoiceId: inv.id, number: inv.number });
    } else if (inv && inv.paidDate === null) {
      paidAnomalies.push(
        `invoice ${inv.number} (${r.isoDate} ${r.brandName}) — unpaid in prod but Paid in CSV, left alone`,
      );
    }
  }

  const toRecategorize: { brandId: string; name: string; category: string }[] =
    [];
  const categoriesToCreate = new Map<string, string>(); // lower → spelling
  const alreadyCorrect: string[] = [];
  const divergent: string[] = [];
  const missingBrands: string[] = [];

  for (const [k, cat] of targetCategory) {
    const b = brandByLower.get(k);
    if (!b) {
      missingBrands.push(`${brandVotes.get(k)!.name} → ${cat}`);
      continue;
    }
    const existing = categoryRows.find((c) => c.id === b.categoryId);
    if (b.categoryId === uncategorizedId || !existing) {
      toRecategorize.push({ brandId: b.id, name: b.name, category: cat });
      if (!categoryByLower.has(cat.toLowerCase()))
        categoriesToCreate.set(cat.toLowerCase(), cat);
    } else if (existing.name.toLowerCase() === cat.toLowerCase()) {
      alreadyCorrect.push(b.name);
    } else {
      divergent.push(
        `${b.name}: prod "${existing.name}" ≠ CSV "${cat}" — left alone`,
      );
    }
  }

  // ── Apply (one transaction) ───────────────────────────────────────────────
  await db.transaction(async (tx) => {
    for (const u of toUnpay)
      await tx
        .update(invoice)
        .set({ paidDate: null })
        .where(eq(invoice.id, u.invoiceId));

    const catId = new Map(
      [...categoryByLower].map(([lower, c]) => [lower, c.id]),
    );
    for (const [lower, spelling] of categoriesToCreate) {
      const [c] = await tx
        .insert(brandCategory)
        .values({ name: spelling })
        .returning();
      catId.set(lower, c.id);
    }
    for (const r of toRecategorize)
      await tx
        .update(brand)
        .set({ categoryId: catId.get(r.category.toLowerCase())! })
        .where(eq(brand.id, r.brandId));
  });

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`Source rows:            ${source.length}`);
  console.log(`\nPaid-status — cleared:  ${toUnpay.length}`);
  for (const u of toUnpay)
    console.log(
      `  invoice ${u.number} (${u.row.isoDate} ${u.row.brandName} $${u.row.amount})`,
    );
  console.log(`  already unpaid:       ${alreadyUnpaid.length}`);
  for (const s of alreadyUnpaid) console.log(`    ${s}`);
  console.log(`  not imported yet:     ${notImported.length}`);
  for (const s of notImported) console.log(`    ${s}`);
  console.log(`  anomalies:            ${paidAnomalies.length}`);
  for (const s of paidAnomalies) console.log(`    ${s}`);

  console.log(`\nCategories — brands recategorized: ${toRecategorize.length}`);
  for (const r of toRecategorize) console.log(`  ${r.name} → ${r.category}`);
  console.log(`  categories created:   ${categoriesToCreate.size}`);
  for (const [, s] of categoriesToCreate) console.log(`    ${s}`);
  console.log(`  already correct:      ${alreadyCorrect.length}`);
  console.log(`  divergent (kept):     ${divergent.length}`);
  for (const s of divergent) console.log(`    ${s}`);
  console.log(`  brand not in prod:    ${missingBrands.length}`);
  for (const s of missingBrands) console.log(`    ${s}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('UPDATE FAILED — nothing applied:', e);
  process.exit(1);
});
