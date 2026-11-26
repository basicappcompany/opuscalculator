import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/sample-size-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('sample-size-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ sampleSize: '385', unadjusted: '385', zScore: '1.96' });
    for (const quoted of ['95 percent', '385', '10,000', '370']) expect(config.intro).toContain(quoted);
  });

  it('applies the finite-population correction (published value 370 for N = 10,000)', () => {
    expect(run({ population: 10000 })).toMatchObject({ sampleSize: '370', unadjusted: '385' });
    expect(run({ population: 100 }).sampleSize).toBe('80');
  });

  it.each([
    ['90', 5, 50, '271'],
    ['99', 5, 50, '664'],
    ['95', 3, 50, '1,068'],
    ['95', 5, 10, '139'],
  ])('confidence %s percent, margin %i percent, proportion %i percent', (confidence, margin, proportion, n) => {
    expect(run({ confidence, margin, proportion }).sampleSize).toBe(n);
  });

  it('rounds up, never down: 384.16 becomes 385', () => {
    expect(run().sampleSize).toBe('385');
  });

  it('is exact in decimals: 1.96^2 * 0.25 / 0.0025 is 384.16 with no float drift, so 385', () => {
    expect(run({ population: 0 }).unadjusted).toBe('385');
  });
});
