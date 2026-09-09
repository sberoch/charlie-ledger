import { describe, expect, it } from 'vitest';
import type { TrackListItemDto } from '@workspace/shared';
import type { Db } from '../common/database/db';
import { AlbumsService } from '../albums/albums.service';
import { TracksService } from './tracks.service';

// toCsv never touches the db handle — safe to instantiate without one.
const service = new TracksService(
  null as unknown as Db,
  null as unknown as AlbumsService,
);

const row: TrackListItemDto = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Empire',
  tags: ['epic', 'trailer'],
  album: 'Vol. 1',
  status: 'active',
  licenseCount: 2,
  lifetimeSales: '3500.00',
  lastLicensedAt: '2025-03-01',
  createdAt: '2020-01-01',
  sellRecommended: false,
  licenses: [
    {
      brandName: 'Subaru',
      startDate: '2025-03-01',
      endDate: null,
      usageTypes: ['broadcast', 'digital_media'],
      exclusivityTier: 'category_exclusive',
      termLength: 'perpetual',
    },
    {
      brandName: 'Zyrtec',
      startDate: '2024-01-15',
      endDate: '2025-01-14',
      usageTypes: ['social_media'],
      exclusivityTier: 'non_exclusive',
      termLength: 'one_year',
    },
  ],
};

describe('TracksService.toCsv — license history', () => {
  it('puts each license with its media, term and exclusivity in one cell', () => {
    const csv = service.toCsv([row], false, true);
    const [header, line] = csv.split('\n');
    expect(header).toBe('Track,Album,Tags,Status,License History');
    expect(line).toContain(
      '"Subaru (Mar 2025 – ongoing): Broadcast, Digital Media · Perp. · Cat. Excl.; ' +
        'Zyrtec (Jan 2024 – Jan 2025): Social Media · 1yr · Non-Excl."',
    );
    expect(line).not.toContain('$');
  });

  it('appends the fee per license when the rows carry one', () => {
    const withFees = {
      ...row,
      licenses: row.licenses!.map((l, i) => ({
        ...l,
        fee: i === 0 ? '2000.00' : '1500.00',
      })),
    };
    const csv = service.toCsv([withFees], true, true);
    expect(csv).toContain('Cat. Excl. · $2,000; ');
    expect(csv).toContain('Non-Excl. · $1,500"');
  });

  it('omits the column when history is off', () => {
    const csv = service.toCsv([row], false, false);
    expect(csv.split('\n')[0]).toBe('Track,Album,Tags,Status');
    expect(csv).not.toContain('Subaru');
  });
});
