import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/cagr-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('cagr-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ cagr: '13.99%', totalGrowth: '150.00%', multiple: '2.5×' });
    for (const quoted of ['$10,000', '$25,000', '7 years', '13.99%']) expect(config.intro).toContain(quoted);
  });

  it.each([
    [100, 200, 1, '100.00%', '100.00%', '2×'],
    [1000, 2000, 2, '41.42%', '100.00%', '2×'],
    [1000, 1000, 5, '0.00%', '0.00%', '1×'],
    [100, 50, 1, '-50.00%', '-50.00%', '0.5×'],
  ])('%i to %i over %f years', (begin, end, years, cagr, growth, multiple) => {
    expect(run({ beginningValue: begin, endingValue: end, years })).toEqual({ cagr, totalGrowth: growth, multiple });
  });

  it('supports fractional years: 100 to 121 over 2 years is exactly 10%', () => {
    expect(run({ beginningValue: 100, endingValue: 121, years: 2 }).cagr).toBe('10.00%');
  });

  it('is exact in decimals: 1.1 to 1.21 in a year is 10.00%, 0.1 to 0.3 is +200%', () => {
    expect(run({ beginningValue: '1.1', endingValue: '1.21', years: 1 }).cagr).toBe('10.00%');
    expect(run({ beginningValue: '0.1', endingValue: '0.3', years: 1 }).totalGrowth).toBe('200.00%');
  });
});
