import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import {
  addDays,
  addMonths,
  todayIso,
  type ExclusivityTier,
  type HoldPeriod,
  type TermLength,
  type UsageType,
} from '@workspace/shared';
import { DemosService } from '../../../demos/demos.service';
import { InvoiceIssuerService } from '../../../invoices/invoice-issuer.service';
import { LicensesService } from '../../../licenses/licenses.service';
import { RoyaltiesService } from '../../../royalties/royalties.service';
import { db } from '../db';
import {
  brand,
  brandCategory,
  demo,
  invoice,
  license,
  payer,
  tag,
  track,
  trackTag,
} from '../schema';
import { seedTracks } from './seed-tracks';

// Tier 2 seed — dev/demo fixtures, NEVER prod. Reproduces the validated
// prototype's dashboard story (3 expiring this week, $77.5K at risk) with
// expirations computed relative to the run date. Licenses and demos are
// created through the real services so gapless numbering, bill-to snapshots,
// and the born-invoiced invariant (ADR-0002) are exercised, not faked.

// Only the terms the demo fixtures actually use — not every TermLength.
const TERM_MONTHS = {
  six_months: 6,
  one_year: 12,
  two_years: 24,
  three_years: 36,
} satisfies Partial<Record<TermLength, number>>;

type LicenseFixture = {
  track: string;
  brand: string;
  category: string;
  usage: UsageType;
  term: keyof typeof TERM_MONTHS;
  excl: ExclusivityTier;
  /** End date offset from today, in days — keeps the timeline story stable. */
  endsIn: number;
  fee: number;
  /** Invoice treatment: paid (default), unpaid (issued 10d ago), overdue. */
  billing?: 'unpaid' | 'overdue';
};

// The prototype's 25 licenses, verbatim fees and spread.
const LICENSES: LicenseFixture[] = [
  {
    track: 'Empire',
    brand: 'Subaru',
    category: 'Automotive',
    usage: 'broadcast',
    term: 'one_year',
    excl: 'category_exclusive',
    endsIn: 7,
    fee: 24500,
    billing: 'unpaid',
  },
  {
    track: 'Reset Self',
    brand: 'Hims',
    category: 'Health & Wellness',
    usage: 'social_media',
    term: 'six_months',
    excl: 'non_exclusive',
    endsIn: 9,
    fee: 4800,
  },
  {
    track: 'Glass Pavilion',
    brand: 'Aritzia',
    category: 'Fashion',
    usage: 'digital_media',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: 12,
    fee: 8200,
  },
  {
    track: 'Departure',
    brand: 'Polestar',
    category: 'Automotive',
    usage: 'broadcast',
    term: 'one_year',
    excl: 'category_exclusive',
    endsIn: 23,
    fee: 22000,
    billing: 'overdue',
  },
  {
    track: 'Cartography',
    brand: 'A24',
    category: 'Streaming · TV',
    usage: 'digital_media',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: 31,
    fee: 11500,
  },
  {
    track: 'Colony',
    brand: 'Peloton',
    category: 'Health & Wellness',
    usage: 'internal',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: 41,
    fee: 6500,
  },
  {
    track: 'Ironwood',
    brand: 'Reformation',
    category: 'Fashion',
    usage: 'social_media',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: 50,
    fee: 5200,
  },
  {
    track: 'Static Field',
    brand: 'Linear',
    category: 'Tech · SaaS',
    usage: 'digital_media',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: 58,
    fee: 7800,
  },
  {
    track: 'Colony',
    brand: 'Hulu',
    category: 'Streaming · TV',
    usage: 'digital_media',
    term: 'six_months',
    excl: 'non_exclusive',
    endsIn: 84,
    fee: 4500,
  },
  {
    track: 'Departure',
    brand: 'Everlane',
    category: 'Fashion',
    usage: 'social_media',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: 105,
    fee: 4800,
  },
  {
    track: 'Reset Self',
    brand: 'Stripe',
    category: 'Tech · SaaS',
    usage: 'internal',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: 123,
    fee: 5500,
  },
  {
    track: 'Ironwood',
    brand: 'La Croix',
    category: 'Food & Beverage',
    usage: 'social_media',
    term: 'six_months',
    excl: 'non_exclusive',
    endsIn: 129,
    fee: 3400,
  },
  {
    track: 'Slow Bloom',
    brand: 'Glossier',
    category: 'Beauty',
    usage: 'digital_media',
    term: 'six_months',
    excl: 'non_exclusive',
    endsIn: 141,
    fee: 3800,
  },
  {
    track: 'Open Water',
    brand: 'Olipop',
    category: 'Food & Beverage',
    usage: 'social_media',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: 152,
    fee: 3200,
  },
  {
    track: 'Cartography',
    brand: 'Audi',
    category: 'Automotive',
    usage: 'broadcast',
    term: 'one_year',
    excl: 'category_exclusive',
    endsIn: 176,
    fee: 28500,
  },
  {
    track: 'Halflight',
    brand: 'Mejuri',
    category: 'Fashion',
    usage: 'social_media',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: 194,
    fee: 4200,
  },
  {
    track: 'Northern Air',
    brand: 'Apple TV+',
    category: 'Streaming · TV',
    usage: 'broadcast',
    term: 'one_year',
    excl: 'full_exclusive',
    endsIn: 206,
    fee: 38000,
  },
  {
    track: 'Paper Lanterns',
    brand: 'Athletic Greens',
    category: 'Health & Wellness',
    usage: 'internet',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: 232,
    fee: 2800,
  },
  {
    track: 'Last Frost',
    brand: 'Hulu',
    category: 'Streaming · TV',
    usage: 'digital_media',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: 252,
    fee: 9500,
  },
  {
    track: 'Tessellate',
    brand: 'Notion',
    category: 'Tech · SaaS',
    usage: 'digital_media',
    term: 'one_year',
    excl: 'category_exclusive',
    endsIn: 282,
    fee: 14500,
  },
  {
    track: 'Empire',
    brand: 'Rivian',
    category: 'Automotive',
    usage: 'digital_media',
    term: 'one_year',
    excl: 'category_exclusive',
    endsIn: 314,
    fee: 18500,
  },
  {
    track: 'Empire',
    brand: 'HBO',
    category: 'Streaming · TV',
    usage: 'broadcast',
    term: 'two_years',
    excl: 'category_exclusive',
    endsIn: 491,
    fee: 52000,
  },
  {
    track: 'Glass Pavilion',
    brand: 'Glossier',
    category: 'Beauty',
    usage: 'digital_media',
    term: 'one_year',
    excl: 'non_exclusive',
    endsIn: -87,
    fee: 7500,
    billing: 'overdue',
  },
  {
    track: 'Slow Bloom',
    brand: 'Notion',
    category: 'Tech · SaaS',
    usage: 'internet',
    term: 'six_months',
    excl: 'non_exclusive',
    endsIn: -53,
    fee: 2200,
  },
  {
    track: 'Empire',
    brand: 'Audi',
    category: 'Automotive',
    usage: 'broadcast',
    term: 'one_year',
    excl: 'category_exclusive',
    endsIn: -185,
    fee: 26000,
  },
];

type DemoFixture = {
  workingName: string;
  brand: string;
  category: string;
  musicHouse: string;
  fee: number;
  hold: HoldPeriod;
  /** writtenAt offset from today, in days (negative = past). */
  writtenAgo: number;
  converted?: { linkTrack?: string };
  paid?: boolean;
};

const DEMOS: DemoFixture[] = [
  {
    workingName: 'Walmart_SpringSale_v1a',
    brand: 'Walmart',
    category: 'Retail',
    musicHouse: 'Mophonics',
    fee: 3500,
    hold: 'three_months',
    writtenAgo: 100,
    paid: true,
  },
  {
    workingName: 'Subaru_Winter_v2',
    brand: 'Subaru',
    category: 'Automotive',
    musicHouse: 'Butter Music + Sound',
    fee: 4000,
    hold: 'six_months',
    writtenAgo: 30,
  },
  {
    workingName: 'A24_TitleSequence_v1',
    brand: 'A24',
    category: 'Streaming · TV',
    musicHouse: 'Walker Music Group',
    fee: 5000,
    hold: 'none',
    writtenAgo: 5,
  },
  {
    workingName: 'Glossier_Holiday_v3',
    brand: 'Glossier',
    category: 'Beauty',
    musicHouse: 'Mophonics',
    fee: 2800,
    hold: 'three_months',
    writtenAgo: 200,
    converted: { linkTrack: 'Night Market' },
    paid: true,
  },
  {
    workingName: 'Hims_Spot_v1',
    brand: 'Hims',
    category: 'Health & Wellness',
    musicHouse: 'Butter Music + Sound',
    fee: 3200,
    hold: 'six_months',
    writtenAgo: 60,
  },
];

async function findOrCreateCategory(name: string): Promise<string> {
  const existing = await db.query.brandCategory.findFirst({
    where: sql`lower(${brandCategory.name}) = lower(${name})`,
  });
  if (existing) return existing.id;
  const [row] = await db.insert(brandCategory).values({ name }).returning();
  return row.id;
}

async function findOrCreateBrand(
  name: string,
  categoryName: string,
): Promise<string> {
  const existing = await db.query.brand.findFirst({
    where: sql`lower(${brand.name}) = lower(${name})`,
  });
  if (existing) return existing.id;
  const categoryId = await findOrCreateCategory(categoryName);
  const [row] = await db.insert(brand).values({ name, categoryId }).returning();
  return row.id;
}

async function findOrCreatePayer(
  name: string,
  email?: string,
): Promise<string> {
  const existing = await db.query.payer.findFirst({
    where: sql`lower(${payer.name}) = lower(${name})`,
  });
  if (existing) return existing.id;
  const [row] = await db
    .insert(payer)
    .values({
      name,
      email:
        email ?? `billing@${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
      address: `${name}\n100 Example Ave\nNew York, NY 10001`,
    })
    .returning();
  return row.id;
}

async function trackIdByName(name: string): Promise<string> {
  const row = await db.query.track.findFirst({ where: eq(track.name, name) });
  if (!row) throw new Error(`Seed track missing: ${name}`);
  return row.id;
}

/** Resolve a brand the license fixtures above already created — never creates. */
async function brandIdByName(name: string): Promise<string> {
  const row = await db.query.brand.findFirst({
    where: sql`lower(${brand.name}) = lower(${name})`,
  });
  if (!row) throw new Error(`Seed brand missing: ${name}`);
  return row.id;
}

async function seedDemoData() {
  const existing = await db.execute<{ count: string }>(
    sql`SELECT count(*) FROM ${license}`,
  );
  if (Number(existing.rows[0].count) > 0) {
    console.log(
      '✗ licenses already exist — demo seed skipped (it is not idempotent by design)',
    );
    return;
  }

  await seedTracks();
  const today = todayIso();
  const issuer = new InvoiceIssuerService();
  const licenses = new LicensesService(db, issuer);
  const demos = new DemosService(db, issuer);

  const createdLicenses: string[] = [];
  for (const fx of LICENSES) {
    const endDate = addDays(today, fx.endsIn);
    const startDate = addMonths(endDate, -TERM_MONTHS[fx.term]);
    const detail = await licenses.create(
      {
        trackId: await trackIdByName(fx.track),
        brandId: await findOrCreateBrand(fx.brand, fx.category),
        payerId: await findOrCreatePayer(fx.brand), // direct pays dominate
        // Most grant a single medium; broadcast deals also carry social so the
        // demo exercises multi-usage rollups (ADR-0004).
        usageTypes:
          fx.usage === 'broadcast' ? ['broadcast', 'social_media'] : [fx.usage],
        exclusivityTier: fx.excl,
        termLength: fx.term,
        fee: fx.fee.toFixed(2),
        startDate,
        endDate,
      },
      null,
    );
    createdLicenses.push(detail.id);

    // Backdate creation so the activity feed reads like real history.
    await db
      .update(license)
      .set({ createdAt: new Date(`${startDate}T12:00:00Z`) })
      .where(eq(license.id, detail.id));

    // Backdate the auto-issued invoice to the license start; settle most.
    const issueDate = fx.billing === 'unpaid' ? addDays(today, -10) : startDate;
    await db
      .update(invoice)
      .set({
        issueDate,
        dueDate: addDays(issueDate, 30),
        paidDate:
          fx.billing === undefined && fx.endsIn !== 9
            ? addDays(issueDate, 18)
            : null,
      })
      .where(eq(invoice.id, detail.invoice.id));
  }

  // One realistic renewal chain: the expired Notion deal was replaced.
  const expiredNotion = createdLicenses[23];
  const activeNotion = createdLicenses[19];
  await licenses.setRenewedTo(expiredNotion, activeNotion);

  for (const fx of DEMOS) {
    const writtenAt = addDays(today, -fx.writtenAgo);
    const dto = await demos.create(
      {
        brandId: await findOrCreateBrand(fx.brand, fx.category),
        payerId: await findOrCreatePayer(fx.musicHouse),
        fee: fx.fee.toFixed(2),
        workingName: fx.workingName,
        holdPeriod: fx.hold,
        writtenAt,
      },
      null,
    );
    await db
      .update(demo)
      .set({ createdAt: new Date(`${writtenAt}T12:00:00Z`) })
      .where(eq(demo.id, dto.id));
    await db
      .update(invoice)
      .set({
        issueDate: writtenAt,
        dueDate: addDays(writtenAt, 30),
        paidDate: fx.paid ? addDays(writtenAt, 15) : null,
      })
      .where(eq(invoice.id, dto.invoice.id));
    if (fx.converted) {
      await demos.convert(dto.id, {
        convertedTrackId: fx.converted.linkTrack
          ? await trackIdByName(fx.converted.linkTrack)
          : null,
      });
    }
  }

  console.log(
    `✓ seeded ${LICENSES.length} licenses + ${DEMOS.length} demos, all born-invoiced`,
  );

  // ── "SELL THIS" sell-signal fixtures ───────────────────────────────────
  // Dead-inventory cases the signal must flag (CONTEXT.md: "Sell signal"),
  // kept out of the curated prototype story above. Both paths into the signal
  // plus a negative control, so the catalog shows the badge firing and silent.
  const tagIdByName = new Map(
    (await db.select({ id: tag.id, name: tag.name }).from(tag)).map((r) => [
      r.name,
      r.id,
    ]),
  );
  const insertSellTrack = async (
    name: string,
    tags: string[],
    createdAgoDays: number,
  ): Promise<string> => {
    const [row] = await db
      .insert(track)
      .values({
        name,
        createdAt: new Date(`${addDays(today, -createdAgoDays)}T12:00:00Z`),
      })
      .returning({ id: track.id });
    if (tags.length > 0)
      await db.insert(trackTag).values(
        tags.map((n) => {
          const tagId = tagIdByName.get(n);
          if (!tagId) throw new Error(`Seed tag missing from vocabulary: ${n}`);
          return { trackId: row.id, tagId };
        }),
      );
    return row.id;
  };

  // 1) Stale by last-licensed date — its one license started ~4 years ago, so
  //    max(start) is over three years past → SELL THIS via lastLicensedAt.
  const dustlineId = await insertSellTrack(
    'Dustline',
    ['atmospheric', 'relaxed'],
    365 * 5,
  );
  const dustStart = addDays(today, -365 * 4);
  const dustline = await licenses.create(
    {
      trackId: dustlineId,
      brandId: await findOrCreateBrand('Chevrolet', 'Automotive'),
      payerId: await findOrCreatePayer('Chevrolet'),
      usageTypes: ['broadcast', 'social_media'],
      exclusivityTier: 'category_exclusive',
      termLength: 'one_year',
      fee: (12000).toFixed(2),
      startDate: dustStart,
      endDate: addMonths(dustStart, TERM_MONTHS.one_year),
    },
    null,
  );
  await db
    .update(license)
    .set({ createdAt: new Date(`${dustStart}T12:00:00Z`) })
    .where(eq(license.id, dustline.id));
  await db
    .update(invoice)
    .set({
      issueDate: dustStart,
      dueDate: addDays(dustStart, 30),
      paidDate: addDays(dustStart, 18),
    })
    .where(eq(invoice.id, dustline.invoice.id));

  // 2) Never licensed but old — createdAt is the fallback reference date and
  //    it is over three years past → SELL THIS via the createdAt fallback.
  await insertSellTrack('Forgotten Embers', ['dramatic', 'sad'], 365 * 4);

  // 3) Negative control — never licensed AND recently created → no badge.
  await insertSellTrack('Fresh Pressing', ['organic', 'warm'], 30);

  console.log(
    '✓ seeded 3 sell-signal fixtures (Dustline, Forgotten Embers — flagged; Fresh Pressing — control)',
  );

  // ── Royalty income (ADR-0009) ──────────────────────────────────────────────
  // The third income stream, and the only inherently cash-basis one. Modeled on
  // the real 2020–2026 import: lumpy quarterly PRO distributions (BMI settles
  // Writers and Publishing as two separate rows), AFM/SAG new-use payouts, and
  // music-house / individual pass-throughs.
  //
  // Emitted for LAST year in full and THIS year only up to today, because the
  // dashboard compares YTD against the same window last year — seeding one
  // window without the other leaves the comparator with nothing to say.
  const royalties = new RoyaltiesService(db);
  const thisYear = Number(today.slice(0, 4));
  // Prior year is the baseline; this year is scaled so the demo shows growth
  // rather than a flat YoY line.
  const YOY_GROWTH = 1.18;

  const ROYALTY_SCHEDULE: Array<{
    monthDay: string;
    payer: string;
    description: string;
    amount: number;
    brand?: string;
    track?: string;
  }> = [
    {
      monthDay: '01-15',
      payer: 'BMI',
      description: 'Q4 distribution — Writers',
      amount: 4200,
    },
    {
      monthDay: '01-15',
      payer: 'BMI',
      description: 'Q4 distribution — Publishing',
      amount: 4200,
    },
    {
      monthDay: '02-20',
      payer: 'American Federation of Musicians',
      description: 'New use — broadcast spot',
      amount: 1850,
      brand: 'Chevrolet',
      track: 'Empire',
    },
    {
      monthDay: '03-28',
      payer: 'Yessian Music',
      description: 'Pass-through — campaign royalties',
      amount: 2400,
      brand: 'Subaru',
    },
    {
      monthDay: '04-15',
      payer: 'BMI',
      description: 'Q1 distribution — Writers',
      amount: 5100,
    },
    {
      monthDay: '04-15',
      payer: 'BMI',
      description: 'Q1 distribution — Publishing',
      amount: 5100,
    },
    // Zero is legal and faithful — a royalty event that paid nothing still
    // belongs in the history (ADR-0009).
    {
      monthDay: '05-22',
      payer: 'Screen Actors Guild',
      description: 'Residual statement — no payable balance',
      amount: 0,
    },
    {
      monthDay: '06-30',
      payer: 'Gareth Smith (Personal)',
      description: 'Shared cue royalties',
      amount: 950,
      track: 'Northern Air',
    },
    {
      monthDay: '07-15',
      payer: 'BMI',
      description: 'Q2 distribution — Writers',
      amount: 3800,
    },
    {
      monthDay: '07-15',
      payer: 'BMI',
      description: 'Q2 distribution — Publishing',
      amount: 3800,
    },
    {
      monthDay: '08-25',
      payer: 'American Federation of Musicians',
      description: 'New use — streaming',
      amount: 1200,
      track: 'Cartography',
    },
    {
      monthDay: '10-15',
      payer: 'BMI',
      description: 'Q3 distribution — Writers',
      amount: 4600,
    },
    {
      monthDay: '10-15',
      payer: 'BMI',
      description: 'Q3 distribution — Publishing',
      amount: 4600,
    },
    {
      monthDay: '11-12',
      payer: 'Screen Actors Guild',
      description: 'Residual — broadcast',
      amount: 2750,
      brand: 'HBO',
    },
    {
      monthDay: '12-05',
      payer: 'Yessian Music',
      description: 'Pass-through — year-end true-up',
      amount: 3100,
    },
  ];

  let royaltyCount = 0;
  for (const year of [thisYear - 1, thisYear]) {
    const scale = year === thisYear ? YOY_GROWTH : 1;
    for (const fx of ROYALTY_SCHEDULE) {
      const paymentDate = `${year}-${fx.monthDay}`;
      // ISO dates compare lexicographically — skip the not-yet-arrived tail of
      // the current year.
      if (paymentDate > today) continue;
      await royalties.create(
        {
          date: paymentDate,
          payerId: await findOrCreatePayer(fx.payer),
          description: fx.description,
          amount: (fx.amount * scale).toFixed(2),
          brandId: fx.brand ? await brandIdByName(fx.brand) : null,
          trackId: fx.track ? await trackIdByName(fx.track) : null,
        },
        null,
      );
      royaltyCount++;
    }
  }

  console.log(`✓ seeded ${royaltyCount} royalty payments across two years`);
}

if (require.main === module) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
