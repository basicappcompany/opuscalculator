import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/standard-deviation-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('standard-deviation-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({
      count: '8',
      sum: '40',
      mean: '5',
      populationSD: '2',
      sampleSD: '2.1381',
      populationVariance: '4',
      sampleVariance: '4.571429',
    });
    for (const quoted of ['2, 4, 4, 4, 5, 5, 7, 9', 'mean of 5', 'standard deviation of 2', '2.14']) expect(config.intro).toContain(quoted);
  });

  it('accepts commas, spaces, semicolons and new lines', () => {
    const r = run({ data: '1;2\n3 4,5' });
    expect(r).toMatchObject({ count: '5', mean: '3', sampleVariance: '2.5' });
  });

  it('handles negative and decimal values', () => {
    expect(run({ data: '-1, 1' })).toMatchObject({ mean: '0', populationSD: '1', sampleSD: '1.4142' });
  });

  it('a single value has no sample deviation', () => {
    const r = run({ data: '7' });
    expect(r.populationSD).toBe('0');
    expect(r.sampleSD).toMatch(/^n\/a/);
  });

  it('rejects text that is not a number', () => {
    expect(() => run({ data: '1, two, 3' })).toThrow(/two/);
  });

  it('is exact in decimals: the sample deviation of 0.1, 0.2, 0.3 is exactly 0.1', () => {
    expect(run({ data: '0.1, 0.2, 0.3' })).toMatchObject({ mean: '0.2', sampleSD: '0.1', sampleVariance: '0.01' });
  });
});
