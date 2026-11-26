import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/percentage-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('percentage-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ result: '30', summary: '15% of 200 is 30' });
    expect(config.intro.startsWith('15% of 200 is 30.')).toBe(true);
  });

  it('A is what percent of B', () => {
    expect(run({ mode: 'whatPercent', valueA: 30, valueB: 200 })).toEqual({ result: '15%', summary: '30 is 15% of 200' });
    expect(run({ mode: 'whatPercent', valueA: 1, valueB: 3 }).result).toBe('33.333333%');
  });

  it('percentage change, up and down', () => {
    expect(run({ mode: 'change', valueA: 80, valueB: 100 }).result).toBe('+25%');
    expect(run({ mode: 'change', valueA: 100, valueB: 80 }).result).toBe('-20%');
    expect(run({ mode: 'change', valueA: 50, valueB: 50 }).result).toBe('0%');
  });

  it('percentage change from a negative start uses its magnitude', () => {
    expect(run({ mode: 'change', valueA: -10, valueB: 10 }).result).toBe('+200%');
  });

  it('does not divide by zero', () => {
    expect(run({ mode: 'whatPercent', valueA: 5, valueB: 0 }).result).toMatch(/^Undefined/);
    expect(run({ mode: 'change', valueA: 0, valueB: 5 }).result).toMatch(/^Undefined/);
  });

  it('is exact in decimals: 110% of 1.1 is 1.21 (floats give 1.2100000000000002), 0.1 to 0.3 is +200%', () => {
    expect(run({ valueA: 110, valueB: '1.1' }).result).toBe('1.21');
    expect(run({ mode: 'change', valueA: '0.1', valueB: '0.3' }).result).toBe('+200%');
  });
});
