import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/dog-age-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('dog-age-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ humanAge: '56.8', sevenRule: '35' });
    for (const quoted of ['5-year-old', '56.8', '35 years', '105 Labrador']) expect(config.intro).toContain(quoted);
  });

  it.each([
    [1, '31', '7'],
    [2, '42.1', '14'],
    [10, '67.8', '70'],
    [0.5, '19.9', '3.5'],
  ])('a %f-year-old dog', (dogAge, humanAge, sevenRule) => {
    expect(run({ dogAge })).toEqual({ humanAge, sevenRule });
  });

  it('is exact in decimals: ln(1) is exactly 0 so one year is exactly 31, and 0.1 + 0.2 years is 0.3', () => {
    expect(run({ dogAge: '1' }).humanAge).toBe('31');
    expect(run({ dogAge: '0.3' }).sevenRule).toBe('2.1');
  });
});
