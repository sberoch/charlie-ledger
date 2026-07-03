import { pgEnum } from 'drizzle-orm/pg-core';

// Medium a License grants the Track for. Closed controlled vocabulary.
// `all_media` is a single grant value (never exploded into the other media);
// `internet` is kept even though the historical sheet never used it — dropping
// an enum value is a destructive migration with no benefit.
export const usageType = pgEnum('usage_type', [
  'broadcast',
  'digital_media',
  'social_media',
  'internet',
  'internal',
  'all_media',
  'film_tv',
  'radio',
]);

// How exclusive a License's grant is. `work_for_hire` is modelled as a tier
// for MVP even though it is conceptually an ownership axis (see CONTEXT.md).
export const exclusivityTier = pgEnum('exclusivity_tier', [
  'non_exclusive',
  'category_exclusive',
  'full_exclusive',
  'work_for_hire',
]);

// License term. Drives the default end date; `perpetual` means no end date.
// Ascending duration order; the sub-six-month values come from Charlie's
// historical licenses. Must stay in sync with TermLengthSchema in shared.
export const termLength = pgEnum('term_length', [
  'one_day',
  'one_month',
  'six_weeks',
  'two_months',
  'three_months',
  'thirteen_weeks',
  'six_months',
  'one_year',
  'two_years',
  'three_years',
  'five_years',
  'perpetual',
]);

// Lifecycle of a Track mirror relative to Disco.
export const trackStatus = pgEnum('track_status', ['active', 'archived']);

// A Demo is `open` until Charlie decides to convert its idea into a Track.
export const demoStatus = pgEnum('demo_status', ['open', 'converted']);

// Reuse hold a Demo carries before its idea can become a library Track.
export const holdPeriod = pgEnum('hold_period', [
  'none',
  'three_months',
  'six_months',
]);

// Which hardcoded rule created a Reminder (ADR-0007). Named `reminderKind`, not
// `kind`, to avoid colliding with the dashboard timeline's own `kind`
// discriminator. The only robust dedupe key for a reminder rule, since a single
// license can carry reminders from more than one rule.
export const reminderKind = pgEnum('reminder_kind', [
  'broadcast_royalty',
  'license_renewal',
]);
