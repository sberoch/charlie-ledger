import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resend } from 'resend';
import { db } from '../common/database/db';
import { DigestService, type DigestContent } from '../digest/digest.service';

// One-off digest email tester. Two things it does, neither touching the cron:
//   1. Always writes the rendered HTML to apps/api/digest-preview.html so you
//      can open it in a browser and eyeball the layout — no Resend needed.
//   2. If RESEND_API_KEY is set and a recipient is given, sends exactly one
//      email to THAT address (not every user, unlike POST /digest/send-now).
//
// Usage (from apps/api):
//   pnpm email:test you@example.com            # real DB content, send to you
//   pnpm email:test you@example.com --sample   # forced fixture, send to you
//   pnpm email:test                            # write preview file only, no send
//
// Recipient also reads from TEST_EMAIL_TO if no CLI arg is passed.

// A populated fixture so the email looks real even against an empty DB.
const SAMPLE: DigestContent = {
  lookaheadDays: 7,
  expiringLicenses: [
    {
      title: 'Empire × Subaru',
      meta: 'Broadcast · 1yr · Cat-excl',
      fee: '24500.00',
      inDays: 3,
    },
    {
      title: 'Reset Self × Hims',
      meta: 'Social · 6mo · Non-excl',
      fee: '4800.00',
      inDays: 6,
    },
  ],
  liftingHolds: [
    { workingName: 'Subaru_Winter_v2', brandName: 'Subaru', inDays: 2 },
  ],
  overdueInvoices: [
    {
      number: 'INV-0007',
      billTo: 'Glossier',
      amount: '7500.00',
      daysOverdue: 12,
    },
  ],
  reminders: [
    {
      title: 'Register Empire × Subaru for broadcast royalties',
      description:
        'Broadcast usage. Register this license to pursue broadcast royalties.',
      inDays: 4,
    },
    {
      title: 'Register Reset Self × Hims for broadcast royalties',
      description:
        'Broadcast usage. Register this license to pursue broadcast royalties.',
      inDays: -3,
    },
  ],
};

async function main() {
  const args = process.argv.slice(2);
  const useSample = args.includes('--sample');
  const recipient =
    args.find((a) => a.includes('@')) ?? process.env.TEST_EMAIL_TO;

  const service = new DigestService(db);

  let content: DigestContent;
  if (useSample) {
    content = SAMPLE;
    console.log('Using forced --sample fixture content.');
  } else {
    content = await service.build();
    const empty =
      content.expiringLicenses.length === 0 &&
      content.liftingHolds.length === 0 &&
      content.overdueInvoices.length === 0 &&
      content.reminders.length === 0;
    if (empty) {
      console.log(
        'DB digest window is empty — falling back to sample fixture.',
      );
      console.log('(Run `pnpm db:seed:demo` from apps/api for real data.)');
      content = SAMPLE;
    }
  }

  // toHtml is private; reach past it for this dev-only tool rather than
  // duplicating the template.
  const html = (
    service as unknown as { toHtml(c: DigestContent): string }
  ).toHtml(content);

  const out = join(process.cwd(), 'digest-preview.html');
  writeFileSync(out, html);
  console.log(`\nPreview written: ${out}`);
  console.log('Open it in a browser to see the layout.\n');

  console.log(
    `Content: ${content.expiringLicenses.length} expiring · ` +
      `${content.liftingHolds.length} holds · ` +
      `${content.overdueInvoices.length} overdue · ` +
      `${content.reminders.length} reminders`,
  );

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('\nRESEND_API_KEY unset — preview only, nothing sent.');
    return;
  }
  if (!recipient) {
    console.log(
      '\nNo recipient (pass an email arg or set TEST_EMAIL_TO) — nothing sent.',
    );
    return;
  }

  const from =
    process.env.DIGEST_FROM ?? 'Foltz Ledger <ledger@charliefoltz.com>';
  console.log(`\nSending one test email from "${from}" to ${recipient} ...`);
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: recipient,
    subject: `[TEST] This week on the ledger — ${content.expiringLicenses.length} expiring · ${content.liftingHolds.length} holds lifting · ${content.overdueInvoices.length} overdue`,
    html,
  });
  if (error) {
    console.error('\nResend rejected the send:', error);
    process.exitCode = 1;
    return;
  }
  console.log(`Sent. Resend id: ${data?.id}`);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
