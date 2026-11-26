import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/date-difference-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('date-difference-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({
      breakdown: '0 years, 11 months, 24 days',
      totalDays: '358',
      weeks: '51 weeks, 1 day',
      weekdays: '256',
      weekendDays: '102',
    });
    for (const quoted of ['358 days', '11 months and 24 days', '51 weeks and 1 day', '256 weekdays']) expect(config.intro).toContain(quoted);
  });

  it('a full year is 365 days, a leap year 366', () => {
    expect(run({ startDate: '2025-01-01', endDate: '2026-01-01' })).toMatchObject({ totalDays: '365', breakdown: '1 year, 0 months, 0 days' });
    expect(run({ startDate: '2024-01-01', endDate: '2025-01-01' }).totalDays).toBe('366');
  });

  it('includes the end date when asked', () => {
    expect(run({ startDate: '2026-03-02', endDate: '2026-03-06' }).totalDays).toBe('4');
    expect(run({ startDate: '2026-03-02', endDate: '2026-03-06', includeEnd: 'yes' })).toMatchObject({ totalDays: '5', weekdays: '5' });
  });

  it('counts weekdays across a weekend (Mon 2 Mar to Mon 9 Mar 2026 is 5)', () => {
    expect(run({ startDate: '2026-03-02', endDate: '2026-03-09' })).toMatchObject({ weekdays: '5', weekendDays: '2' });
  });

  it('swaps dates entered in the wrong order and handles the same day', () => {
    expect(run({ startDate: '2026-12-25', endDate: '2026-01-01' }).totalDays).toBe('358');
    expect(run({ startDate: '2026-05-05', endDate: '2026-05-05' })).toMatchObject({ totalDays: '0', weekdays: '0' });
  });

  it('is exact in whole numbers: 100 weeks is exactly 700 days and 500 weekdays', () => {
    expect(run({ startDate: '2026-01-05', endDate: '2027-12-06' })).toMatchObject({ totalDays: '700', weeks: '100 weeks, 0 days', weekdays: '500' });
  });
});
