import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/age-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('age-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({
      age: '36 years, 5 months, 7 days',
      totalMonths: '437',
      totalWeeks: '1,901.29',
      totalDays: '13,309',
      nextBirthday: 'Tuesday, 15 Jun 2027, in 205 days',
    });
    for (const quoted of ['15 June 1990', '36 years, 5 months and 7 days', '22 November 2026', '13,309']) expect(config.intro).toContain(quoted);
  });

  it('counts whole years exactly (26 years is 9,497 days with 7 leap days)', () => {
    expect(run({ birthDate: '2000-01-01', asOfDate: '2026-01-01' })).toMatchObject({ age: '26 years, 0 months, 0 days', totalDays: '9,497' });
  });

  it('borrows days from the previous month', () => {
    // 31 Jan + 1 month is 29 Feb (the last day of that month), then one more day reaches 1 March.
    expect(run({ birthDate: '2000-01-31', asOfDate: '2000-03-01' }).age).toBe('0 years, 1 month, 1 day');
  });

  it('treats a 29 February birthday as 1 March in other years', () => {
    const r = run({ birthDate: '2000-02-29', asOfDate: '2001-02-28' });
    expect(r.age).toBe('0 years, 11 months, 30 days');
    expect(r.nextBirthday).toBe('Thursday, 1 Mar 2001, in 1 day');
  });

  it('recognises a birthday that is today', () => {
    expect(run({ birthDate: '2020-05-05', asOfDate: '2026-05-05' })).toMatchObject({
      age: '6 years, 0 months, 0 days',
      nextBirthday: 'Today! (Tuesday, 5 May 2026)',
    });
  });

  it('rejects a date of birth in the future', () => {
    expect(run({ birthDate: '2030-01-01' }).age).toMatch(/after the age-at date/);
  });

  it('is exact in decimals: 10 days is 1.43 weeks and 7 days is exactly 1 week', () => {
    expect(run({ birthDate: '2026-01-01', asOfDate: '2026-01-11' }).totalWeeks).toBe('1.43');
    expect(run({ birthDate: '2026-01-01', asOfDate: '2026-01-08' }).totalWeeks).toBe('1');
  });
});
