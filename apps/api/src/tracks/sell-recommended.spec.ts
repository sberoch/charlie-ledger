import { describe, expect, it } from 'vitest';
import { isSellRecommended } from './sell-recommended';

// Fixed "today" so the three-year boundary is deterministic.
const NOW = new Date('2026-06-23T12:00:00Z');

describe('isSellRecommended', () => {
  it('fires when the last licensed date is over three years past', () => {
    expect(
      isSellRecommended(
        { status: 'active', lastLicensedAt: '2023-06-22', createdAt: NOW },
        NOW,
      ),
    ).toBe(true);
  });

  it('does not fire at exactly three years (strictly over)', () => {
    expect(
      isSellRecommended(
        { status: 'active', lastLicensedAt: '2023-06-23', createdAt: NOW },
        NOW,
      ),
    ).toBe(false);
  });

  it('does not fire when last licensed within three years', () => {
    expect(
      isSellRecommended(
        { status: 'active', lastLicensedAt: '2024-01-01', createdAt: NOW },
        NOW,
      ),
    ).toBe(false);
  });

  it('falls back to createdAt when never licensed — fires if creation is over three years past', () => {
    expect(
      isSellRecommended(
        {
          status: 'active',
          lastLicensedAt: null,
          createdAt: new Date('2020-01-01T00:00:00Z'),
        },
        NOW,
      ),
    ).toBe(true);
  });

  it('does not fire for a recently created, never-licensed track', () => {
    expect(
      isSellRecommended(
        {
          status: 'active',
          lastLicensedAt: null,
          createdAt: new Date('2025-01-01T00:00:00Z'),
        },
        NOW,
      ),
    ).toBe(false);
  });

  it('never fires for an archived track, however stale', () => {
    expect(
      isSellRecommended(
        {
          status: 'archived',
          lastLicensedAt: '2010-01-01',
          createdAt: new Date('2010-01-01T00:00:00Z'),
        },
        NOW,
      ),
    ).toBe(false);
  });
});
