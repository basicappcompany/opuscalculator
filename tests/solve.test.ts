import { describe, expect, it } from 'vitest';
import { numberField } from '../src/lib/calc-utils';
import { toD } from '../src/lib/decimal';
import { fmtNumber } from '../src/lib/format';
import { parseResultNumber, solveInput } from '../src/lib/solve';
import type { CalculatorConfig } from '../src/lib/types';
import compound from '../src/calculators/compound-interest-calculator';
import { LENGTH_UNITS, WEIGHT_UNITS, convertValue } from '../src/lib/units';

describe('parseResultNumber', () => {
  it.each([
    ['$1,234.56', '1234.56'],
    ['-$5.00', '-5'],
    ['22.9', '22.9'],
    ['12 V', '12'],
    ['-0.5%', '-0.5'],
    ['.25', '0.25'],
  ])('reads %s', (text, expected) => {
    expect(parseResultNumber(text)!.toString()).toBe(expected);
  });

  it('is null when there is no number', () => {
    expect(parseResultNumber('Underweight')).toBeNull();
  });
});

// A made-up calculator: the solver must work on any config, not just the seeds.
const triple = {
  inputs: [{ name: 'x', label: 'X', type: 'number', min: 0, max: 1000, default: 1, validator: numberField() }],
  outputs: [{ name: 'out', label: 'Out', format: 'number' }],
  calculate: (i: Record<string, unknown>) => ({ out: fmtNumber(toD(i.x).mul(3), 6) }),
} as unknown as CalculatorConfig;

describe('solveInput', () => {
  it('finds the input that gives a target, exactly, with decimal.js', () => {
    const r = solveInput(triple, { x: '1' }, 'x', 'out', '0.3');
    expect(r).toEqual({ ok: true, value: '0.1' }); // 0.1 * 3 = 0.3, not 0.30000000000000004
  });

  it('works when the output falls as the input grows', () => {
    const falling = { ...triple, calculate: (i: Record<string, unknown>) => ({ out: fmtNumber(toD(1000).minus(toD(i.x)), 6) }) } as CalculatorConfig;
    expect(solveInput(falling, {}, 'x', 'out', '250')).toEqual({ ok: true, value: '750' });
  });

  it('says plainly when the target cannot be reached', () => {
    const r = solveInput(triple, { x: '1' }, 'x', 'out', '999999');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Reachable results run from 0 to 3,000/);
  });

  it('rejects a non-numeric target and an input that cannot be solved for', () => {
    expect(solveInput(triple, {}, 'x', 'out', 'abc').ok).toBe(false);
    expect(solveInput(triple, {}, 'nope', 'out', '1').ok).toBe(false);
  });

  it('solves a real calculator: how many years for 10,000 at 5% to double', () => {
    const r = solveInput(compound, { principal: '10000', annualRate: '5', years: '10', compoundsPerYear: '12' }, 'years', 'futureValue', '20000');
    expect(r.ok).toBe(true);
    if (r.ok) {
      const years = Number(r.value);
      expect(years).toBeGreaterThan(13.8);
      expect(years).toBeLessThan(13.95); // 12 * ln 2 / ln(1 + 0.05/12) / 12 = 13.89
    }
  });
});

describe('convertValue (unit switching converts the number, it does not just relabel it)', () => {
  const [kg, lb] = WEIGHT_UNITS;
  const [cm, inch] = LENGTH_UNITS;

  it('converts with the exact factors', () => {
    expect(convertValue('70', kg, lb)).toBe('154.3236');
    expect(convertValue('175', cm, inch)).toBe('68.8976');
    expect(convertValue('154.3236', lb, kg)).toBe('70');
  });

  it('is decimal-exact: 100 in is exactly 254 cm', () => {
    expect(convertValue('100', inch, cm)).toBe('254');
  });

  it('leaves junk, empty input and unit pairs without factors untouched', () => {
    expect(convertValue('abc', kg, lb)).toBe('abc');
    expect(convertValue('', kg, lb)).toBe('');
    expect(convertValue('5', { value: 'a', label: 'a' }, lb)).toBe('5');
    expect(convertValue('5', kg, kg)).toBe('5');
  });

  it('every shared unit list has a factor on every option, so every toggle converts', () => {
    for (const o of [...WEIGHT_UNITS, ...LENGTH_UNITS]) expect(o.factor).toBeTruthy();
  });
});
