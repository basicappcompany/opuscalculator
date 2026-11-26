import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/compound-interest-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('compound-interest-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ futureValue: '$16,470.09', totalInterest: '$6,470.09', effectiveRate: '5.12%' });
    for (const quoted of ['$10,000', '5%', '10 years', '$16,470.09', '$6,470.09']) expect(config.intro).toContain(quoted);
  });

  it.each([
    ['1', '$16,288.95', '5.00%'],
    ['4', '$16,436.19', '5.09%'],
    ['365', '$16,486.65', '5.13%'],
  ])('compounding %s times a year', (n, fv, effective) => {
    const r = run({ compoundsPerYear: n });
    expect(r.futureValue).toBe(fv);
    expect(r.effectiveRate).toBe(effective);
  });

  it('zero years returns the starting amount, zero rate earns nothing', () => {
    expect(run({ years: 0 })).toMatchObject({ futureValue: '$10,000.00', totalInterest: '$0.00' });
    expect(run({ annualRate: 0 })).toMatchObject({ futureValue: '$10,000.00', totalInterest: '$0.00' });
  });

  it('is exact in decimals: $1,000.10 at 10% for a year is $1,100.11 (floats give 1100.1100000000001)', () => {
    expect(run({ principal: '1000.10', annualRate: 10, years: 1, compoundsPerYear: '1' }).futureValue).toBe('$1,100.11');
  });
});
