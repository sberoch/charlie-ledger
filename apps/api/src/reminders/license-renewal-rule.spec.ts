import { describe, expect, it } from 'vitest';
import {
  buildLicenseRenewalReminders,
  type ExpiredLicenseForRenewal,
} from './license-renewal-rule';

const license = (
  over: Partial<ExpiredLicenseForRenewal> = {},
): ExpiredLicenseForRenewal => ({
  id: 'lic-1',
  endDate: '2026-06-01',
  track: { name: 'Empire' },
  brand: { name: 'Subaru' },
  ...over,
});

describe('buildLicenseRenewalReminders', () => {
  it('creates a renewal reminder due 7 days after the expiry date', () => {
    const [r] = buildLicenseRenewalReminders([license()], new Set());
    expect(r.reminderKind).toBe('license_renewal');
    expect(r.licenseId).toBe('lic-1');
    expect(r.dueOn).toBe('2026-06-08'); // 2026-06-01 + 7 days
  });

  it('snapshots the brand and track names into the copy', () => {
    const [r] = buildLicenseRenewalReminders([license()], new Set());
    expect(r.title).toBe('Contact Subaru to renew Empire');
    expect(r.description).toBe(
      'This license expired on 2026-06-01. Reach out to the brand about a renewal.',
    );
  });

  it('skips licenses that already have a renewal reminder (idempotent)', () => {
    const result = buildLicenseRenewalReminders(
      [license({ id: 'lic-1' })],
      new Set(['lic-1']),
    );
    expect(result).toEqual([]);
  });

  it('only creates reminders for the not-yet-reminded licenses in a batch', () => {
    const result = buildLicenseRenewalReminders(
      [license({ id: 'a' }), license({ id: 'b' }), license({ id: 'c' })],
      new Set(['b']),
    );
    expect(result.map((r) => r.licenseId)).toEqual(['a', 'c']);
  });

  it('honours a custom day offset', () => {
    const [r] = buildLicenseRenewalReminders(
      [license({ endDate: '2026-06-01' })],
      new Set(),
      14,
    );
    expect(r.dueOn).toBe('2026-06-15');
  });

  it('returns nothing for an empty candidate list', () => {
    expect(buildLicenseRenewalReminders([], new Set())).toEqual([]);
  });
});
