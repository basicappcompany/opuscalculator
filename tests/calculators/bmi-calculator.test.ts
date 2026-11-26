import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/bmi-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('bmi-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ bmi: '22.9', category: 'Healthy weight', healthyRange: '56.7 to 76.3 kg' });
    for (const quoted of ['70 kg', '175 cm', '22.9', '18.5 to 24.9']) expect(config.intro).toContain(quoted);
  });

  it.each([
    [50, 170, '17.3', 'Underweight'],
    [90, 180, '27.8', 'Overweight'],
    [100, 170, '34.6', 'Obese'],
    [18.5, 100, '18.5', 'Healthy weight'],
    [25, 100, '25.0', 'Overweight'],
  ])('weight %f kg, height %i cm gives BMI %s (%s)', (weight, height, bmi, category) => {
    expect(run({ weight, height })).toMatchObject({ bmi, category });
  });

  it('converts pounds and inches exactly (154 lb, 68 in is 23.4)', () => {
    const r = run({ weight: 154, weightUnit: 'lb', height: 68, heightUnit: 'in' });
    expect(r.bmi).toBe('23.4');
    expect(r.category).toBe('Healthy weight');
    expect(r.healthyRange.endsWith(' lb')).toBe(true);
  });

  it('is exact in decimals: 24.95 kg at 100 cm is 25.0 and counts as overweight (floats round it down to 24.9)', () => {
    expect(run({ weight: '24.95', height: 100 })).toMatchObject({ bmi: '25.0', category: 'Overweight' });
  });
});
