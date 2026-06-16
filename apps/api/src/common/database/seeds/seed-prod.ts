import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { auth } from '../../../auth/auth';
import { db } from '../db';
import { appSetting, user } from '../schema';
import { seedTracks } from './seed-tracks';

// Tier 0 seed — production bootstrap. Idempotent, safe to re-run. Brings a
// fresh prod database to a usable state: the app_setting singleton, the first
// admin user (no self-signup exists — someone has to be created out-of-band),
// and the tier-1 mock catalog via seedTracks().
//
// Credentials default to the launch admin but are env-overridable so prod can
// set its own without a code change:
//   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '12345678';
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Admin';

async function seedAppSetting() {
  // Mirrors migration 0002; kept here so the seed is self-sufficient on a DB
  // where the migration hasn't run. The singleton row backs invoice-number
  // allocation (ADR-0001) and the digest window.
  await db.insert(appSetting).values({ id: 1 }).onConflictDoNothing();
  console.log('✓ app_setting singleton ensured');
}

async function seedAdminUser() {
  const existing = await db.query.user.findFirst({
    where: eq(user.email, ADMIN_EMAIL),
  });
  if (existing) {
    console.log(`✓ admin user already exists (${ADMIN_EMAIL}) — skipped`);
    return;
  }
  // Server-side signUpEmail (no ctx.request) bypasses the no-self-signup hook
  // and lets better-auth own password hashing + the account row.
  await auth.api.signUpEmail({
    body: { name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  console.log(`✓ admin user created (${ADMIN_EMAIL})`);
}

export async function seedProd() {
  await seedAppSetting();
  await seedAdminUser();
  await seedTracks();
  console.log('✓ production seed complete');
}

if (require.main === module) {
  seedProd()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
