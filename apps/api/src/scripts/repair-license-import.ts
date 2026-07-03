import 'dotenv/config';
import { eq, like } from 'drizzle-orm';
import {
  defaultEndDate,
  normalizeUsageTypes,
  UsageTypeSchema,
  type UsageType,
} from '@workspace/shared';
import { db } from '../common/database/db';
import { license } from '../common/database/schema';

/**
 * One-off repair for the first license-import run, which executed against a
 * stale @workspace/shared dist: normalizeUsageTypes() stripped the then-new
 * enum values (all_media / film_tv / radio → empty or partial usage arrays)
 * and defaultEndDate() returned undefined for the new term lengths (→ null
 * end dates that read as perpetual). Re-derives both fields for every
 * imported license from the `original usage "…"` raw preserved in its notes.
 * Idempotent; safe to re-run. Touches ONLY rows carrying the [import:] tag.
 *
 *   pnpm tsx src/scripts/repair-license-import.ts [--dry-run]
 */

if (!(UsageTypeSchema.options as readonly string[]).includes('all_media'))
  throw new Error(
    'stale @workspace/shared build — run `pnpm --filter @workspace/shared build` first',
  );

// Same normalization as import-licenses.ts (kept in sync by hand — one-off).
const USAGE_MAP: Record<string, UsageType> = {
  broadcast: 'broadcast',
  'digital media': 'digital_media',
  'digial media': 'digital_media',
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

const USAGE_IN_NOTES = /original usage "([^"]*)" · \[import:/;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const rows = await db
    .select()
    .from(license)
    .where(like(license.notes, '%[import:%'));
  console.log(`${rows.length} imported licenses found`);

  let usageFixed = 0;
  let endDateFixed = 0;
  await db.transaction(async (tx) => {
    for (const row of rows) {
      const m = USAGE_IN_NOTES.exec(row.notes ?? '');
      if (!m)
        throw new Error(`license ${row.id}: no usage raw in notes — aborting`);
      const usageTypes = mapUsage(m[1]);
      const endDate = defaultEndDate(row.startDate, row.termLength);
      const usageChanged =
        JSON.stringify(usageTypes) !== JSON.stringify(row.usageTypes);
      const endDateChanged = endDate !== row.endDate;
      if (!usageChanged && !endDateChanged) continue;
      if (usageChanged) usageFixed++;
      if (endDateChanged) {
        endDateFixed++;
        console.log(
          `  end date ${row.startDate} ${row.termLength}: ${row.endDate} → ${endDate}`,
        );
      }
      if (!dryRun)
        await tx
          .update(license)
          .set({ usageTypes, ...(endDateChanged && { endDate }) })
          .where(eq(license.id, row.id));
    }
  });
  console.log(
    `${dryRun ? '[dry-run] would fix' : 'fixed'}: ${usageFixed} usage arrays, ${endDateFixed} end dates`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error('REPAIR FAILED — transaction rolled back:', e);
  process.exit(1);
});
