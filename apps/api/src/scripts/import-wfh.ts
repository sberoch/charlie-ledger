import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { asc, like, sql } from 'drizzle-orm';
import {
  defaultEndDate,
  licenseInvoiceDescription,
  normalizeUsageTypes,
  UsageTypeSchema,
  type ExclusivityTier,
  type IsoDate,
  type TermLength,
  type UsageType,
} from '@workspace/shared';

// @workspace/shared resolves to its BUILT dist at runtime while types come from
// src — a stale dist typechecks green but silently strips enum values (this
// corrupted the first prod license import; see repair-license-import.ts).
if (!(UsageTypeSchema.options as readonly string[]).includes('all_media'))
  throw new Error(
    'stale @workspace/shared build — run `pnpm --filter @workspace/shared build` first',
  );
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
 * WFH import — the one-off 2020–2026 QuickBooks work-for-hire ("Final" product
 * group) backfill. Sibling of import-licenses.ts (ADR-0008/ADR-0010, CONTEXT.md
 * "WFH import"); that script stays untouched.
 *
 *   pnpm import:wfh -- <source.csv> [--completions <needs-review.csv>] [--out <dir>]
 *
 * The source has no Brand/Track/Usage/Term/Exclusivity columns — only a payer,
 * a date, a freeform description, and an amount. Every row (kill fees and
 * add-on fees included — ADR-0010) mints one License + one Invoice born Paid.
 * Terms default to all media / perpetual / work_for_hire; a description that
 * states its own term or exclusivity wins via the per-row CURATED table below,
 * which also carries the Brand (grilled 2026-07-14). Idempotency
 * (`[import:<key>]` notes token) follows import-licenses.ts.
 *
 * Track linking is OPTIONAL (ADR-0013, grilled 2026-07-17): WFH work is mostly
 * bespoke and never entered the catalog, so an unambiguous matcher hit (or a
 * track_name completion) links the track, and everything else imports with
 * trackId null — rendered as "WFH × Brand". Only an unresolved brand (or a
 * completion naming a nonexistent track) still round-trips through
 * needs-review; Charlie links stray tracks in the app afterwards.
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
  description: 5,
  amount: 8,
} as const;

interface SourceRow {
  key: string;
  index: number;
  isoDate: IsoDate;
  num: string;
  payerName: string;
  description: string;
  amount: string; // normalized "1234.56"
  brandName: string | null; // curated; null → Charlie supplies via brand_name
  usageTypes: UsageType[];
  termLength: TermLength;
  exclusivityTier: ExclusivityTier;
  overridden: string[]; // which fields the description overrode, for the note
}

// ── Per-row curation (grilled 2026-07-14) ────────────────────────────────────
// The source names only the paying music house; the Brand — and the handful of
// rows whose description states its own term/exclusivity/media — are curated
// here, keyed by `<QB num>|<description>` (verbatim). Defaults for everything
// else: all media / perpetual / work_for_hire. brand: null → the row round-
// trips through needs-review and Charlie fills the brand_name column.

interface Curation {
  brand: string | null;
  term?: TermLength;
  exclusivity?: ExclusivityTier;
  usage?: UsageType[];
}

const CURATED: Record<string, Curation> = {
  '1006|FFing Vote': { brand: null },
  '1008|Visionworks Final': { brand: 'Visionworks' },
  '1049|Serta (Relicense)': { brand: 'Serta' },
  "1042|Ben's Final": { brand: null },
  '1046|Galderma': { brand: 'Galderma' },
  '1060|Xifaxan': { brand: 'Xifaxan' },
  '1066|Papa Johns Extension': { brand: 'Papa Johns' },
  '1066|CFv2a // Papa Johns': { brand: 'Papa Johns' },
  '1074|Xiidra Rework': { brand: 'Xiidra' },
  '1088|Chevy (First Payment)': { brand: 'Chevy' },
  '1111|Sprite Round 3': { brand: 'Sprite' },
  '1125|JBL Giannis': { brand: 'JBL' },
  '1147|Vuity': { brand: 'Vuity' },
  '1154|GM Powered Solutions // Industrial x Online': { brand: 'GM' },
  '1155|Twirla': { brand: 'Twirla' },
  '1162|Beautyrest': { brand: 'Beautyrest' },
  '1167|BeautyRest Edits': { brand: 'Beautyrest' },
  '1190|A&E // History Channel Cues (Batch of 40)': { brand: null },
  '1231|Cadillac - When We Were Kings - Full WFH Buyout': {
    brand: 'Cadillac',
  },
  '1240|Chevy - Owners Content Series Round 2': { brand: 'Chevy' },
  '1244|Beautyrest - Relicense 1 yr': {
    brand: 'Beautyrest',
    term: 'one_year',
  },
  '1276|Ambient Podcast Cues 1-26, Scott vs Wild Bill': { brand: null },
  '1282|New Chevy OCS - May 2023': { brand: 'Chevy' },
  // Spelled "On Star" to match the brand the license import already created —
  // 'OnStar' would mint a case-insensitively distinct duplicate.
  '1280|On Star': { brand: 'On Star' },
  '1295|Ross': { brand: 'Ross' },
  '1308|On Star NEW NEW': { brand: 'On Star' },
  '1331|On Star - In Your Driveway': { brand: 'On Star' },
  '1336|Chevy - OCS Phase 3.2 (15videos)': { brand: 'Chevy' },
  '1341|Speed Dial - Capital One (1 yr exclusive License)': {
    brand: 'Capital One',
    term: 'one_year',
    exclusivity: 'full_exclusive',
  },
  '1350|Cadillac OCS (Phase 2)': { brand: 'Cadillac' },
  '1368|Cadillac OCS 2024 - 15 videos': { brand: 'Cadillac' },
  '1351|Buick OCS': { brand: 'Buick' },
  '1370|Zyrtec - Kill Fee': { brand: 'Zyrtec' },
  '1370|Zyrtec - Final': { brand: 'Zyrtec' },
  // "License Term: 1 Year Exclusivity: WFH … Media: Broadcast, Digital,
  // Streaming and Industrial" — Streaming ⇒ internet, Industrial ⇒ internal;
  // the raw wording survives in the grant terms and the private note.
  '1416|UPS - The Guarantee Store (Places to Be) -License Term: 1 Year Exclusivity: WFHMarket/Territory: US only for Broadcast, Worldwide with respect to the internetNumber of Spots: 2Deliverables: 30s Mail and Shred, 25/10s Mail and Shred (cutdown) 20/05s Mail and Shred (cutdown)Deliverables: 30s The Guarantee Store, 25/10s The Guarantee Store (cutdown) 25/05 The Guarantee Store (cutdown)Media: Broadcast, Digital, Streaming and Industrial':
    {
      brand: 'UPS',
      term: 'one_year',
      exclusivity: 'work_for_hire',
      usage: ['broadcast', 'digital_media', 'internet', 'internal'],
    },
  '1425|Places To Be - UPS Campaign Refresh Additional Usage (RADIO: General Services :45, :30, :15, Pack & Ship :30, :15, Mailboxes :30, :15, Shredding Radio :30, :15, & Printing :30, :15SOCIAL/DIGITAL: :30, & :15, OLV for Social/Digital) Non-exclusive 1yr':
    {
      brand: 'UPS',
      term: 'one_year',
      exclusivity: 'non_exclusive',
      usage: ['radio', 'social_media', 'digital_media'],
    },
  '1460|AT&T Fiber Soccer 2024': { brand: 'AT&T' },
  '1467|UPS - Places to Be (Additional :15 cutdown)': { brand: 'UPS' },
  '1482|Disney - All Kinds of Happieness': { brand: 'Disney' },
  '1485|Amazon - Click Click (Kill Fee)': { brand: 'Amazon' },
  '1493|Disney - All Kinds of Happiness (Radio edit)': { brand: 'Disney' },
  '1501|UPS - Places to Be (Social Media Package': { brand: 'UPS' },
  '1502|UPS - Places To Be (Extension 1yr non-exclusive)': {
    brand: 'UPS',
    term: 'one_year',
    exclusivity: 'non_exclusive',
  },
  '1524|Apple Final Cut Pro - CRACKPOT': { brand: 'Apple' },
  '1565|Coinbase - One Card': { brand: 'Coinbase' },
  // Same QB invoice (1565), payer, and date as "Coinbase - One Card".
  '1565|Additional Edits': { brand: 'Coinbase' },
  '1589|UPS - Places to Be (all media 1 year non exclusive)': {
    brand: 'UPS',
    term: 'one_year',
    exclusivity: 'non_exclusive',
  },
  '1594|Speed Dial - Capital One (Renewal - 1yr Non-exclusive)': {
    brand: 'Capital One',
    term: 'one_year',
    exclusivity: 'non_exclusive',
  },
};

const DEFAULTS = {
  usage: ['all_media'] as UsageType[],
  term: 'perpetual' as TermLength,
  exclusivity: 'work_for_hire' as ExclusivityTier,
};

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

// Stable per-row identity: raw values, not curated ones, so the key never
// shifts under curation changes. Verified collision-free across all 48 rows.
function rowKey(cells: string[]): string {
  const raw = [COL.date, COL.num, COL.customer, COL.description, COL.amount]
    .map((i) => (cells[i] ?? '').trim())
    .join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

const IMPORT_TAG = /\[import:([0-9a-f]{16})\]/;

// ── Matcher: word-boundary, unambiguous-only, span subsumption ──────────────
// Identical to import-licenses.ts: a catalog name hits when it appears as a
// whole word; an occurrence contained inside a longer name's occurrence is
// subsumed. Exactly one surviving track → match; zero or several → review.

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
    args.includes('--out') ? args[args.indexOf('--out') + 1] : 'wfh-import-out',
  );
  if (!sourcePath) {
    console.error(
      'Usage: pnpm import:wfh -- <source.csv> [--completions <needs-review.csv>] [--out <dir>]',
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
        r.length >= 10 &&
        r[COL.date].trim() !== '' &&
        r[COL.type].trim() === 'Invoice',
    );

  const errors: string[] = [];
  const source: SourceRow[] = [];
  dataCells.forEach((cells, index) => {
    try {
      const description = cells[COL.description].trim();
      const curationKey = `${cells[COL.num].trim()}|${description}`;
      const curated = CURATED[curationKey];
      if (!curated)
        console.warn(
          `WARN row ${headerIdx + 2 + index}: no curation entry for "${curationKey}" — brand goes to needs-review, blanket terms apply`,
        );
      const overridden: string[] = [];
      if (curated?.term) overridden.push(`term=${curated.term}`);
      if (curated?.exclusivity)
        overridden.push(`exclusivity=${curated.exclusivity}`);
      if (curated?.usage) overridden.push(`usage=${curated.usage.join('+')}`);
      source.push({
        key: rowKey(cells),
        index,
        isoDate: parseDate(cells[COL.date]),
        num: cells[COL.num].trim(),
        payerName: cells[COL.customer].trim(),
        description,
        amount: parseAmount(cells[COL.amount]),
        brandName: curated?.brand ?? null,
        usageTypes: normalizeUsageTypes(curated?.usage ?? DEFAULTS.usage),
        termLength: curated?.term ?? DEFAULTS.term,
        exclusivityTier: curated?.exclusivity ?? DEFAULTS.exclusivity,
        overridden,
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

  // Curation typo guard: every curated key must exist in the source.
  const sourceKeys = new Set(source.map((r) => `${r.num}|${r.description}`));
  const stale = Object.keys(CURATED).filter((k) => !sourceKeys.has(k));
  if (stale.length > 0)
    throw new Error(
      `curated key(s) not found in source (typo or file changed): ${stale
        .map((k) => `"${k.slice(0, 60)}…"`)
        .join(', ')}`,
    );

  // ── Completions (Charlie's filled needs-review CSV) ────────────────────────
  const trackCompletions = new Map<string, string>();
  const brandCompletions = new Map<string, string>();
  if (completionsPath) {
    const crows = parseCsv(readFileSync(resolve(completionsPath), 'utf8'));
    const chead = crows[0].map((h) => h.trim().toLowerCase());
    const kIdx = chead.indexOf('row_key');
    const tIdx = chead.indexOf('track_name');
    const bIdx = chead.indexOf('brand_name');
    if (kIdx < 0 || tIdx < 0)
      throw new Error('completions CSV needs row_key and track_name columns');
    for (const r of crows.slice(1)) {
      const k = r[kIdx]?.trim();
      if (!k) continue;
      const name = r[tIdx]?.trim();
      if (name) trackCompletions.set(k, name);
      const bname = bIdx >= 0 ? r[bIdx]?.trim() : '';
      if (bname) brandCompletions.set(k, bname);
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

  // ── Match: a row imports once its BRAND is resolved (ADR-0013). The track
  // is optional garnish — an unambiguous match links it, otherwise trackless.
  type Review = {
    row: SourceRow;
    reasons: string[];
    candidates: string[];
    brandName: string | null;
  };
  type Match = {
    row: SourceRow;
    trackId: string | null;
    trackName: string | null;
    brandName: string;
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

    // Brand: Charlie's completion beats the curated guess.
    const brandName = brandCompletions.get(row.key) ?? row.brandName;

    // Track: completion beats the matcher; no/ambiguous match ⇒ trackless.
    // An explicit completion naming a track we can't find is the one track
    // problem that still blocks the row — Charlie asked for a link we can't
    // honor, so importing trackless would silently drop his instruction.
    const reasons: string[] = [];
    const candidates: string[] = [];
    let matched: { id: string; name: string; via: string } | null = null;
    const completion = trackCompletions.get(row.key);
    if (completion) {
      const t = trackByLowerName.get(completion.toLowerCase());
      if (t) matched = { id: t.id, name: t.name, via: 'completion' };
      else
        reasons.push(
          `completion "${completion}" not in catalog — create the track in the app, then re-run`,
        );
    } else {
      const hits = matchTracks(row.description, catalog);
      if (hits.length === 1) {
        const t = trackByLowerName.get(hits[0].toLowerCase())!;
        matched = { id: t.id, name: t.name, via: 'auto' };
      }
      // 0 or several hits: import trackless (via below); link in-app later.
    }
    if (!brandName) reasons.push('brand unknown — fill brand_name');

    if (brandName && reasons.length === 0)
      toImport.push({
        row,
        trackId: matched?.id ?? null,
        trackName: matched?.name ?? null,
        brandName,
        via: matched?.via ?? 'trackless',
      });
    else review.push({ row, reasons, candidates, brandName });
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
        // No billing details fabricated — Charlie fills email/address in-app.
        const [p] = await tx
          .insert(payer)
          .values({ name: row.payerName })
          .returning();
        payerId = p.id;
        payersByName.set(lower(row.payerName), payerId);
        createdPayers++;
      }

      let brandId = brandsByName.get(lower(m.brandName));
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
          .values({ name: m.brandName, categoryId: uncategorizedId })
          .returning();
        brandId = b.id;
        brandsByName.set(lower(m.brandName), brandId);
        createdBrands++;
      }

      // Grant terms = the raw QuickBooks description (ADR-0003: becomes the
      // invoice description).
      const terms = row.description;
      const notes =
        `Imported from WFH Sales CSV · original invoice #${row.num || '—'}` +
        (row.overridden.length > 0
          ? ` · terms read from description (${row.overridden.join(', ')})`
          : ' · WFH blanket terms (all media / perpetual / work for hire)') +
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
          brandName: m.brandName,
          usageTypes: row.usageTypes,
          exclusivityTier: row.exclusivityTier,
          terms,
        }),
        issueDate: row.isoDate,
        userId: createdBy,
      });
      // Historical invoices are born Paid on their transaction date; Charlie
      // un-marks the few still-open ones in the app.
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
      'amount',
      'reason',
      'candidates',
      'description',
      'brand_name',
      'track_name',
    ]),
    ...review.map((r) =>
      csvLine([
        r.row.key,
        r.row.isoDate,
        r.row.num,
        r.row.payerName,
        r.row.amount,
        r.reasons.join('; '),
        r.candidates.join('; '),
        r.row.description,
        r.brandName ?? '', // prefilled when curated; Charlie fills the blanks
        '', // ← Charlie fills this with the exact catalog track name
      ]),
    ),
  ].join('\n');
  writeFileSync(resolve(outDir, 'needs-review.csv'), reviewCsv + '\n');

  const auditCsv = [
    csvLine([
      'row_key',
      'date',
      'brand',
      'matched_track',
      'via',
      'terms',
      'description',
    ]),
    ...toImport.map((m) =>
      csvLine([
        m.row.key,
        m.row.isoDate,
        m.brandName,
        m.trackName ?? '', // blank = imported trackless ("WFH × Brand")
        m.via,
        m.row.overridden.length > 0
          ? m.row.overridden.join(', ')
          : 'WFH defaults',
        m.row.description,
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
  console.log(
    `  trackless (WFH):  ${toImport.filter((m) => m.trackId === null).length}`,
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
