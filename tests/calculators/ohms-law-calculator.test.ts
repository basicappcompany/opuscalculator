import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/ohms-law-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('ohms-law-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ voltage: '12 V', current: '2 A', resistance: '6 Ω', power: '24 W' });
    for (const quoted of ['2 amperes', '6 ohm', '12 volts', '24 watts']) expect(config.intro).toContain(quoted);
  });

  it('finds current from voltage and resistance', () => {
    expect(run({ find: 'current', voltage: 12, resistance: 6 })).toEqual({ voltage: '12 V', current: '2 A', resistance: '6 Ω', power: '24 W' });
  });

  it('finds resistance from voltage and current', () => {
    expect(run({ find: 'resistance', voltage: 12, current: 2 })).toEqual({ voltage: '12 V', current: '2 A', resistance: '6 Ω', power: '24 W' });
  });

  it('does not divide by zero', () => {
    expect(run({ find: 'current', resistance: 0 }).current).toMatch(/^Undefined/);
    expect(run({ find: 'resistance', current: 0 })).toMatchObject({ resistance: expect.stringMatching(/^Undefined/), power: '0 W' });
  });

  it('is exact in decimals: 0.1 A through 0.2 ohms is 0.02 V and 0.002 W (floats give 0.020000000000000004)', () => {
    expect(run({ current: '0.1', resistance: '0.2' })).toMatchObject({ voltage: '0.02 V', power: '0.002 W' });
  });
});
