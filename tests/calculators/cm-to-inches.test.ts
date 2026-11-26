import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/cm-to-inches';
import { runner } from '../helpers';

const run = runner(config);

describe('cm-to-inches', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ inches: '66.93', feetInches: '5 ft 6.93 in', fraction: '66 15/16 in' });
    for (const quoted of ['170 cm', '66.93 inches', '5 feet 6.93 inches', '66 15/16']) expect(config.intro).toContain(quoted);
  });

  it.each([
    [2.54, '1', '0 ft 1 in', '1 in'],
    [100, '39.37', '3 ft 3.37 in', '39 3/8 in'],
    [30.48, '12', '1 ft 0 in', '12 in'],
    [0, '0', '0 ft 0 in', '0 in'],
    [0.5, '0.2', '0 ft 0.2 in', '3/16 in'],
  ])('%f cm', (cm, inches, feetInches, fraction) => {
    expect(run({ centimeters: cm })).toEqual({ inches, feetInches, fraction });
  });

  it('rounds a fraction that reaches 16/16 up to the next whole inch', () => {
    expect(run({ centimeters: '2.5' }).fraction).toBe('1 in');
  });

  it('is exact in decimals: 33.02 cm is exactly 13 inches (floats give 13.000000000000002)', () => {
    expect(run({ centimeters: '33.02' })).toMatchObject({ inches: '13', feetInches: '1 ft 1 in', fraction: '13 in' });
    expect(run({ centimeters: '7.62' })).toMatchObject({ inches: '3', fraction: '3 in' });
  });
});
