import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { asc, like, sql } from 'drizzle-orm';
import {
  defaultEndDate,
  licenseInvoiceDescription,
  normalizeUsageTypes,
  type ExclusivityTier,
  type IsoDate,
  type TermLength,
  type UsageType,
} from '@workspace/shared';
import { InvoiceIssuerService } from '../invoices/invoice-issuer.service';
import { db } from '../common/database/db';
import {
  brand,
  brandCategory,
  invoice,
  license,
  payer,
  track,
  user,
} from '../common/database/schema';

/**
 * Historical license import — the one-off 2020–2026 QuickBooks backfill.
 * See docs/license-import-implementation-spec.md and ADR-0008.
 *
 *   pnpm import:licenses -- <source.csv> [--completions <needs-review.csv>] [--out <dir>]
 *
 * Each source row becomes one License + one Invoice (born Paid on its
 * transaction date). The matcher links rows to EXISTING catalog tracks and
 * only acts when unambiguous; everything else lands in <out>/needs-review.csv,
 * which Charlie fills in (track_name column) and hands back via --completions.
 * Tracks are never created here. Idempotent: every imported license carries an
 * `[import:<key>]` token in its private notes; re-runs skip those rows.
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

function csvLine(fields: string[]): string {
  return fields.map((f) => `"${f.replaceAll('"', '""')}"`).join(',');
}

// ── Source row shape ─────────────────────────────────────────────────────────

const COL = {
  date: 1,
  type: 2,
  num: 3,
  customer: 4,
  brand: 5,
  track: 6,
  usage: 7,
  term: 8,
  exclusivity: 9,
  amount: 12,
} as const;

interface SourceRow {
  key: string;
  index: number;
  isoDate: IsoDate;
  num: string;
  payerName: string;
  brandName: string;
  trackText: string;
  usageRaw: string;
  termRaw: string;
  exclusivityRaw: string;
  amount: string; // normalized "1234.56"
  usageTypes: UsageType[];
  termLength: TermLength;
  exclusivityTier: ExclusivityTier;
  categoryExclusiveLabel: string | null;
}

// ── Field mappings (see spec — grilled 2026-07-03) ───────────────────────────

const USAGE_MAP: Record<string, UsageType> = {
  broadcast: 'broadcast',
  'digital media': 'digital_media',
  'digial media': 'digital_media', // sheet typo
  'all media': 'all_media',
  'social media': 'social_media',
  internal: 'internal',
  internet: 'internet',
  radio: 'radio',
  'film/ tv show': 'film_tv',
  'film/tv show': 'film_tv',
  'film / tv show': 'film_tv',
  'film/ tv': 'film_tv',
  'film/tv': 'film_tv',
};

const TERM_MAP: Record<string, TermLength> = {
  '': 'one_year', // Charlie's Q1 answer: blank term defaults to 1 year
  '1 day': 'one_day',
  '1 month': 'one_month',
  '6 weeks': 'six_weeks',
  '2 months': 'two_months',
  '3 months': 'three_months',
  '13 weeks': 'thirteen_weeks',
  '6 months': 'six_months',
  '6 month': 'six_months', // sheet variant
  '1 year': 'one_year',
  '2 years': 'two_years',
  '2 year': 'two_years', // sheet variant
  '3 years': 'three_years',
  '5 years': 'five_years',
  perpetual: 'perpetual',
  // The one combo row: the perpetual component means it never fully lapses.
  '6 months, perpetual': 'perpetual',
};

function mapExclusivity(raw: string): {
  tier: ExclusivityTier;
  label: string | null;
} {
  const clean = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (clean === '') return { tier: 'non_exclusive', label: null };
  if (clean === 'nonexclusive' || clean === 'non-exclusive')
    return { tier: 'non_exclusive', label: null };
  if (clean === 'full exclusive' || clean === 'exclusive')
    return { tier: 'full_exclusive', label: null };
  if (clean === 'wfh buyout') return { tier: 'work_for_hire', label: null };
  // Covers both "Category Exclusive: X" and the sheet's "Category Exclusivity: X"
  if (clean.startsWith('category exclusiv'))
    return {
      tier: 'category_exclusive',
      label: raw.split(':').slice(1).join(':').trim() || null,
    };
  throw new Error(`unmapped exclusivity "${raw}"`);
}

function mapUsage(raw: string): UsageType[] {
  const types = raw
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter((t) => t !== '')
    .map((t) => {
      const mapped = USAGE_MAP[t];
      if (!mapped) throw new Error(`unmapped usage token "${t}" in "${raw}"`);
      return mapped;
    });
  if (types.length === 0) throw new Error(`empty usage "${raw}"`);
  return normalizeUsageTypes(types);
}

function mapTerm(raw: string): TermLength {
  const clean = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const mapped = TERM_MAP[clean];
  if (!mapped) throw new Error(`unmapped term "${raw}"`);
  return mapped;
}

function parseAmount(raw: string): string {
  const clean = raw.replaceAll(',', '').replaceAll('$', '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(clean))
    throw new Error(`unparseable amount "${raw}"`);
  return Number(clean).toFixed(2);
}

function parseDate(raw: string): IsoDate {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) throw new Error(`unparseable date "${raw}"`);
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

// Stable per-row identity: raw values, not normalized ones, so the key never
// shifts under mapping changes. Verified collision-free across all 253 rows.
function rowKey(cells: string[]): string {
  const raw = [COL.date, COL.num, COL.brand, COL.track, COL.amount]
    .map((i) => (cells[i] ?? '').trim())
    .join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

const IMPORT_TAG = /\[import:([0-9a-f]{16})\]/;

// ── Matcher: word-boundary, unambiguous-only, span subsumption ──────────────
// A catalog name hits when it appears as a whole word (alphanumeric-bounded).
// An occurrence contained inside a longer name's occurrence is subsumed
// ("Wrecking Ball" inside "Disco Wrecking Ball" is one mention, not two).
// Exactly one surviving track → match; zero or several → needs-review.

interface CatalogEntry {
  name: string;
  regex: RegExp;
}

function buildCatalog(names: string[]): CatalogEntry[] {
  return names.map((name) => ({
    name,
    regex: new RegExp(
      `(?<![a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`,
      'gi',
    ),
  }));
}

function matchTracks(text: string, catalog: CatalogEntry[]): string[] {
  const occ: { name: string; start: number; end: number }[] = [];
  for (const entry of catalog) {
    for (const m of text.matchAll(entry.regex)) {
      occ.push({
        name: entry.name,
        start: m.index,
        end: m.index + m[0].length,
      });
    }
  }
  const survivors = occ.filter(
    (o) =>
      !occ.some(
        (other) =>
          other.name !== o.name &&
          other.end - other.start > o.end - o.start &&
          other.start <= o.start &&
          other.end >= o.end,
      ),
  );
  return [...new Set(survivors.map((o) => o.name))];
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const sourcePath = args.find((a) => !a.startsWith('--'));
  const completionsPath = args.includes('--completions')
    ? args[args.indexOf('--completions') + 1]
    : null;
  const outDir = resolve(
    args.includes('--out')
      ? args[args.indexOf('--out') + 1]
      : 'license-import-out',
  );
  if (!sourcePath) {
    console.error(
      'Usage: pnpm import:licenses -- <source.csv> [--completions <needs-review.csv>] [--out <dir>]',
    );
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
    ['Brand', COL.brand],
    ['Track', COL.track],
    ['Usage', COL.usage],
    ['Term', COL.term],
    ['Exclusivity', COL.exclusivity],
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
        r.length >= 13 &&
        r[COL.date].trim() !== '' &&
        r[COL.type].trim() === 'License',
    );

  const errors: string[] = [];
  const source: SourceRow[] = [];
  dataCells.forEach((cells, index) => {
    try {
      const excl = mapExclusivity(cells[COL.exclusivity]);
      source.push({
        key: rowKey(cells),
        index,
        isoDate: parseDate(cells[COL.date]),
        num: cells[COL.num].trim(),
        payerName: cells[COL.customer].trim(),
        brandName: cells[COL.brand].trim(),
        trackText: cells[COL.track].trim(),
        usageRaw: cells[COL.usage].trim(),
        termRaw: cells[COL.term].trim(),
        exclusivityRaw: cells[COL.exclusivity].trim(),
        amount: parseAmount(cells[COL.amount]),
        usageTypes: mapUsage(cells[COL.usage]),
        termLength: mapTerm(cells[COL.term]),
        exclusivityTier: excl.tier,
        categoryExclusiveLabel: excl.label,
      });
    } catch (e) {
      errors.push(
        `row ${headerIdx + 2 + index} (${cells[COL.date]}): ${(e as Error).message}`,
      );
    }
  });
  if (errors.length > 0) {
    console.error(
      `ABORT — ${errors.length} unmappable row(s), nothing imported:`,
    );
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
  const keys = new Set(source.map((r) => r.key));
  if (keys.size !== source.length)
    throw new Error('row-key collision in source — aborting');

  // ── Completions (Charlie's filled needs-review CSV) ────────────────────────
  const completions = new Map<string, string>();
  if (completionsPath) {
    const crows = parseCsv(readFileSync(resolve(completionsPath), 'utf8'));
    const chead = crows[0].map((h) => h.trim().toLowerCase());
    const kIdx = chead.indexOf('row_key');
    const tIdx = chead.indexOf('track_name');
    if (kIdx < 0 || tIdx < 0)
      throw new Error('completions CSV needs row_key and track_name columns');
    for (const r of crows.slice(1)) {
      const k = r[kIdx]?.trim();
      const name = r[tIdx]?.trim();
      if (k && name) completions.set(k, name);
    }
  }

  // ── Prerequisites: real catalog, prior-import keys, creator ───────────────
  const trackRows = await db
    .select({ id: track.id, name: track.name })
    .from(track);
  if (trackRows.length < 100) {
    console.error(
      `ABORT — track catalog has only ${trackRows.length} tracks; the real ` +
        'catalog (~244) must be imported first. Nothing imported.',
    );
    process.exit(1);
  }
  const trackByLowerName = new Map(
    trackRows.map((t) => [t.name.toLowerCase(), t]),
  );
  const catalog = buildCatalog(trackRows.map((t) => t.name));

  const importedKeys = new Set<string>();
  const noteRows = await db
    .select({ notes: license.notes })
    .from(license)
    .where(like(license.notes, '%[import:%'));
  for (const r of noteRows) {
    const m = IMPORT_TAG.exec(r.notes ?? '');
    if (m) importedKeys.add(m[1]);
  }

  const firstUser = await db.query.user.findFirst({
    orderBy: asc(user.createdAt),
  });
  const createdBy = firstUser?.id ?? null;

  // ── Match ──────────────────────────────────────────────────────────────────
  type Review = { row: SourceRow; reason: string; candidates: string[] };
  type Match = {
    row: SourceRow;
    trackId: string;
    trackName: string;
    via: string;
  };
  const toImport: Match[] = [];
  const review: Review[] = [];
  let skippedAlready = 0;

  for (const row of source) {
    if (importedKeys.has(row.key)) {
      skippedAlready++;
      continue;
    }
    const completion = completions.get(row.key);
    if (completion) {
      const t = trackByLowerName.get(completion.toLowerCase());
      if (t)
        toImport.push({
          row,
          trackId: t.id,
          trackName: t.name,
          via: 'completion',
        });
      else
        review.push({
          row,
          reason: `completion "${completion}" not in catalog — create the track in the app, then re-run`,
          candidates: [],
        });
      continue;
    }
    const hits = matchTracks(row.trackText, catalog);
    if (hits.length === 1) {
      const t = trackByLowerName.get(hits[0].toLowerCase())!;
      toImport.push({ row, trackId: t.id, trackName: t.name, via: 'auto' });
    } else {
      review.push({
        row,
        reason:
          hits.length === 0
            ? 'no catalog track matched'
            : 'several tracks matched — pick one',
        candidates: hits.sort(),
      });
    }
  }

  // ── Import (one transaction; chronological so invoice numbers follow) ─────
  toImport.sort(
    (a, b) =>
      a.row.isoDate.localeCompare(b.row.isoDate) || a.row.index - b.row.index,
  );
  const issuer = new InvoiceIssuerService();
  let createdPayers = 0;
  let createdBrands = 0;

  await db.transaction(async (tx) => {
    const lower = (s: string) => s.toLowerCase();
    const payersByName = new Map(
      (await tx.select().from(payer)).map((p) => [lower(p.name), p.id]),
    );
    const brandsByName = new Map(
      (await tx.select().from(brand)).map((b) => [lower(b.name), b.id]),
    );

    let uncategorizedId: string | null =
      (await tx.select().from(brandCategory)).find(
        (c) => lower(c.name) === 'uncategorized',
      )?.id ?? null;

    for (const m of toImport) {
      const { row } = m;

      let payerId = payersByName.get(lower(row.payerName));
      if (!payerId) {
        // Q7: no billing details fabricated — Charlie fills email/address in-app.
        const [p] = await tx
          .insert(payer)
          .values({ name: row.payerName })
          .returning();
        payerId = p.id;
        payersByName.set(lower(row.payerName), payerId);
        createdPayers++;
      }

      let brandId = brandsByName.get(lower(row.brandName));
      if (!brandId) {
        if (!uncategorizedId) {
          const [c] = await tx
            .insert(brandCategory)
            .values({ name: 'Uncategorized' })
            .returning();
          uncategorizedId = c.id;
        }
        const [b] = await tx
          .insert(brand)
          .values({ name: row.brandName, categoryId: uncategorizedId })
          .returning();
        brandId = b.id;
        brandsByName.set(lower(row.brandName), brandId);
        createdBrands++;
      }

      // Grant terms = the sheet's full Track text (ADR-0003: becomes the
      // invoice description), plus the category-exclusive label if present.
      const terms =
        row.trackText +
        (row.categoryExclusiveLabel
          ? `\nCategory exclusive: ${row.categoryExclusiveLabel}`
          : '');
      const notes =
        `Imported from License Data CSV · original invoice #${row.num || '—'}` +
        ` · original term "${row.termRaw}" · original usage "${row.usageRaw}"` +
        ` · [import:${row.key}]`;

      const [lic] = await tx
        .insert(license)
        .values({
          trackId: m.trackId,
          brandId,
          payerId,
          usageTypes: row.usageTypes,
          exclusivityTier: row.exclusivityTier,
          termLength: row.termLength,
          fee: row.amount,
          startDate: row.isoDate,
          endDate: defaultEndDate(row.isoDate, row.termLength),
          notes,
          terms,
          createdBy,
        })
        .returning();

      // Same gapless allocator as the app (ADR-0001/0002). Deliberately NOT
      // the license service: the broadcast-royalty reminder rule must not fire
      // for historical rows (ADR-0008).
      const inv = await issuer.issue(tx, {
        source: { kind: 'license', id: lic.id },
        billTo: { name: row.payerName, email: null, address: null },
        amount: row.amount,
        description: licenseInvoiceDescription({
          trackName: m.trackName,
          brandName: row.brandName,
          usageTypes: row.usageTypes,
          exclusivityTier: row.exclusivityTier,
          terms,
        }),
        issueDate: row.isoDate,
        userId: createdBy,
      });
      // Historical invoices are born Paid on their transaction date (Q2);
      // Charlie un-marks the few still-open ones in the app.
      await tx
        .update(invoice)
        .set({ paidDate: row.isoDate })
        .where(sql`${invoice.id} = ${inv.id}`);
    }
  });

  // ── Reports ────────────────────────────────────────────────────────────────
  mkdirSync(outDir, { recursive: true });
  const reviewCsv = [
    csvLine([
      'row_key',
      'date',
      'qb_num',
      'payer',
      'brand',
      'amount',
      'reason',
      'candidates',
      'track_text',
      'track_name',
    ]),
    ...review.map((r) =>
      csvLine([
        r.row.key,
        r.row.isoDate,
        r.row.num,
        r.row.payerName,
        r.row.brandName,
        r.row.amount,
        r.reason,
        r.candidates.join('; '),
        r.row.trackText,
        '', // ← Charlie fills this with the exact catalog track name
      ]),
    ),
  ].join('\n');
  writeFileSync(resolve(outDir, 'needs-review.csv'), reviewCsv + '\n');

  const auditCsv = [
    csvLine(['row_key', 'date', 'brand', 'matched_track', 'via', 'track_text']),
    ...toImport.map((m) =>
      csvLine([
        m.row.key,
        m.row.isoDate,
        m.row.brandName,
        m.trackName,
        m.via,
        m.row.trackText,
      ]),
    ),
  ].join('\n');
  writeFileSync(resolve(outDir, 'match-audit.csv'), auditCsv + '\n');

  const total = toImport
    .reduce((s, m) => s + Number(m.row.amount), 0)
    .toFixed(2);
  console.log(`Source rows:        ${source.length}`);
  console.log(
    `Imported:           ${toImport.length} licenses + invoices ($${total})`,
  );
  console.log(
    `  via completion:   ${toImport.filter((m) => m.via === 'completion').length}`,
  );
  console.log(`Skipped (already):  ${skippedAlready}`);
  console.log(
    `Needs review:       ${review.length} → ${resolve(outDir, 'needs-review.csv')}`,
  );
  console.log(
    `New payers:         ${createdPayers} · new brands: ${createdBrands}`,
  );
  console.log(`Match audit:        ${resolve(outDir, 'match-audit.csv')}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('IMPORT FAILED — transaction rolled back, nothing partial:', e);
  process.exit(1);
});
