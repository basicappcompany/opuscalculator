import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/body-fat-calculator';
import { runner } from '../helpers';

const run = runner(config);

/** Independent float reference for the Navy formulas (inches), used only as a tolerance check. */
const navy = (male: boolean, height: number, neck: number, waist: number, hip: number) =>
  male
    ? 86.01 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76
    : 163.205 * Math.log10(waist + hip - neck) - 97.684 * Math.log10(height) - 78.387;
const IN = 2.54;

describe('body-fat-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ bodyFat: '20.3%', category: 'Average', fatMass: '16.2 kg', leanMass: '63.8 kg' });
    for (const quoted of ['178 cm', '38 cm', '90 cm', '80 kg', '20.3 percent', '16.2 kg', '63.8 kg']) expect(config.intro).toContain(quoted);
  });

  it('men match an independent calculation of the Navy formula', () => {
    const r = run({ height: 175, neck: 40, waist: 85 });
    const expected = navy(true, 175 / IN, 40 / IN, 85 / IN, 0);
    expect(Math.abs(parseFloat(r.bodyFat) - expected)).toBeLessThan(0.06);
  });

  it('women use the hip measurement and match an independent calculation', () => {
    const r = run({ sex: 'female', weight: 62, height: 165, neck: 32, waist: 75, hip: 98 });
    const expected = navy(false, 165 / IN, 32 / IN, 75 / IN, 98 / IN);
    expect(Math.abs(parseFloat(r.bodyFat) - expected)).toBeLessThan(0.06);
  });

  it('ignores the hip value for men', () => {
    expect(run({ hip: 60 }).bodyFat).toBe(run({ hip: 150 }).bodyFat);
  });

  it('accepts inches and pounds and returns mass in pounds', () => {
    const r = run({ weight: 180, weightUnit: 'lb', height: 70, heightUnit: 'in', neck: 15, neckUnit: 'in', waist: 34, waistUnit: 'in' });
    expect(Math.abs(parseFloat(r.bodyFat) - navy(true, 70, 15, 34, 0))).toBeLessThan(0.06);
    expect(r.fatMass.endsWith(' lb')).toBe(true);
    expect(r.leanMass.endsWith(' lb')).toBe(true);
  });

  it('asks for a re-measure when the numbers cannot work', () => {
    expect(run({ waist: 38, neck: 40 }).bodyFat).toBe('Check your measurements');
  });

  it('is exact in decimals: the displayed percentage is rounded half up to one decimal', () => {
    const r = run();
    expect(r.bodyFat).toBe('20.3%');
    expect(Number(r.fatMass.replace(' kg', '')) + Number(r.leanMass.replace(' kg', ''))).toBeCloseTo(80, 5);
  });
});
