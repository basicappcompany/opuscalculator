import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/paint-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('paint-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ area: '366', gallons: '2.09', liters: '7.9', buy: '3 gallons' });
    for (const quoted of ['12 ft by 14 ft', '366 square feet', '2.1 gallons', '3 gallons']) expect(config.intro).toContain(quoted);
  });

  it('adds the ceiling when asked', () => {
    expect(run({ ceiling: 'yes' })).toEqual({ area: '534', gallons: '3.05', liters: '11.6', buy: '4 gallons' });
  });

  it('buys exactly one gallon when it is exactly enough', () => {
    expect(run({ coats: 1, coverage: 366 })).toMatchObject({ gallons: '1', buy: '1 gallon' });
  });

  it('never goes below zero when openings exceed the walls', () => {
    expect(run({ doors: 100 })).toMatchObject({ area: '0', gallons: '0', buy: '0 gallons' });
  });

  it('works in meters: the same room in metric gives the same answer', () => {
    const r = run({ length: 3.6576, lengthUnit: 'm', width: 4.2672, widthUnit: 'm', height: 2.4384, heightUnit: 'm' });
    expect(r).toMatchObject({ area: '366', gallons: '2.09', buy: '3 gallons' });
  });

  it('is exact in decimals: 732 sq ft of coverage at 350 per gallon is 2.09 gallons, 7.9 liters', () => {
    expect(run().gallons).toBe('2.09');
    expect(run().liters).toBe('7.9');
  });
});
