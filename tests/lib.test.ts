import { describe, expect, it } from 'vitest';
import { dateField, defaultInputs, numberField, parseNumberList, unitOf } from '../src/lib/calc-utils';
import { daysBetween, weekdaysBetween, ymd } from '../src/lib/dates';
import { D } from '../src/lib/decimal';
import { fmtCurrency, fmtFixed, fmtNumber, fmtPercent } from '../src/lib/format';
import { monthlyPayment } from '../src/lib/finance';
import bmi from '../src/calculators/bmi-calculator';

describe('decimal arithmetic', () => {
  it('does not have the float problem', () => {
    expect(new D('0.1').plus('0.2').toString()).toBe('0.3');
    expect(new D('0.1').plus('0.2').equals('0.3')).toBe(true);
    expect(0.1 + 0.2).not.toBe(0.3); // the problem this project exists to avoid
  });
});

describe('formatting', () => {
  it('rounds half up, where floats round 1.005 down', () => {
    expect(fmtFixed('1.005', 2)).toBe('1.01');
    expect((1.005).toFixed(2)).toBe('1.00');
    expect(fmtFixed('2.675', 2)).toBe('2.68');
    expect(fmtFixed('0.125', 2)).toBe('0.13');
  });

  it('groups thousands and keeps the sign', () => {
    expect(fmtFixed('1234567.891', 2)).toBe('1,234,567.89');
    expect(fmtCurrency('-1234.5')).toBe('-$1,234.50');
    expect(fmtCurrency('1000')).toBe('$1,000.00');
  });

  it('never prints a negative zero', () => {
    expect(fmtFixed('-0.001', 2)).toBe('0.00');
    expect(fmtCurrency('-0.004')).toBe('$0.00');
    expect(fmtNumber('-0.0001', 2)).toBe('0');
  });

  it('fmtNumber drops trailing zeros only after the decimal point', () => {
    expect(fmtNumber('30', 2)).toBe('30');
    expect(fmtNumber('100', 2)).toBe('100');
    expect(fmtNumber('10.50', 2)).toBe('10.5');
    expect(fmtNumber('1000', 0)).toBe('1,000');
    expect(fmtNumber('0.0816497', 4)).toBe('0.0816');
  });

  it('fmtPercent takes a percentage, not a ratio', () => {
    expect(fmtPercent('12.5', 1)).toBe('12.5%');
    expect(fmtPercent(5, 2)).toBe('5.00%');
  });
});

describe('inputs', () => {
  const n = numberField({ min: 0, max: 100 });
  it('numberField accepts numbers and number-like text, including thousands separators', () => {
    for (const ok of [5, '5', ' 5.5 ', '1,0', '.5', '-0']) expect(numberField().safeParse(ok).success, String(ok)).toBe(true);
    expect(numberField().safeParse('1,000').success).toBe(true);
  });
  it('numberField rejects empty, text, out-of-range and fractional-when-integer', () => {
    for (const bad of ['', '  ', 'abc', '1e5', '1.2.3', '5%']) expect(numberField().safeParse(bad).success, bad).toBe(false);
    expect(n.safeParse(-1).success).toBe(false);
    expect(n.safeParse(101).success).toBe(false);
    expect(n.safeParse(100).success).toBe(true);
    expect(numberField({ integer: true }).safeParse('2.5').success).toBe(false);
    expect(numberField({ integer: true }).safeParse('2').success).toBe(true);
  });
  it('dateField rejects dates that do not exist', () => {
    expect(dateField().safeParse('2026-02-28').success).toBe(true);
    expect(dateField().safeParse('2024-02-29').success).toBe(true);
    for (const bad of ['2026-02-30', '2025-02-29', '2026-13-01', '26-01-01', '2026/01/01', '']) expect(dateField().safeParse(bad).success, bad).toBe(false);
  });
  it('parseNumberList splits on commas, spaces, semicolons and new lines', () => {
    expect(parseNumberList('1, 2;3\n4  5').map(String)).toEqual(['1', '2', '3', '4', '5']);
    expect(parseNumberList('')).toEqual([]);
    expect(() => parseNumberList('1, x')).toThrow('"x" is not a number');
  });
  it('unitOf falls back to the first option; defaultInputs includes the unit keys', () => {
    expect(unitOf({}, 'weight', 'kg')).toBe('kg');
    expect(unitOf({ weightUnit: 'lb' }, 'weight', 'kg')).toBe('lb');
    expect(defaultInputs(bmi)).toEqual({ weight: 70, weightUnit: 'kg', height: 175, heightUnit: 'cm' });
  });
});

describe('dates', () => {
  it('daysBetween ignores daylight saving and handles leap years', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1);
  });
  it('ymd counts whole months then days, never a negative day', () => {
    expect(ymd('1990-06-15', '2026-11-22')).toEqual({ years: 36, months: 5, days: 7 });
    expect(ymd('2000-01-31', '2000-03-01')).toEqual({ years: 0, months: 1, days: 1 });
    expect(ymd('2023-01-31', '2023-03-01')).toEqual({ years: 0, months: 1, days: 1 });
    expect(ymd('2026-05-31', '2026-06-30')).toEqual({ years: 0, months: 1, days: 0 });
    expect(ymd('2026-05-05', '2026-05-05')).toEqual({ years: 0, months: 0, days: 0 });
    expect(ymd('2000-02-29', '2001-02-28')).toEqual({ years: 0, months: 11, days: 30 });
    expect(ymd('2000-02-29', '2001-03-01')).toEqual({ years: 1, months: 0, days: 0 });
    expect(ymd('2000-02-29', '2004-02-29')).toEqual({ years: 4, months: 0, days: 0 });
  });
  it('weekdaysBetween counts Monday to Friday in [start, end)', () => {
    expect(weekdaysBetween('2026-03-02', '2026-03-09')).toBe(5); // Mon to next Mon
    expect(weekdaysBetween('2026-03-07', '2026-03-09')).toBe(0); // Sat, Sun
    expect(weekdaysBetween('2026-03-06', '2026-03-09')).toBe(1); // Fri, Sat, Sun
    expect(weekdaysBetween('2026-03-09', '2026-03-09')).toBe(0);
    expect(weekdaysBetween('2026-03-10', '2026-03-09')).toBe(0);
  });
});

describe('finance helper', () => {
  it('matches a brute-force amortization schedule to the cent', () => {
    // Independent check: run the schedule month by month with Decimal and confirm the balance reaches ~0.
    const principal = new D(250000);
    const pay = monthlyPayment(principal, new D('6.25'), 360);
    const r = new D('6.25').div(100).div(12);
    let balance = principal;
    for (let i = 0; i < 360; i++) balance = balance.plus(balance.mul(r)).minus(pay);
    expect(balance.abs().lt('0.000001')).toBe(true);
    expect(pay.toFixed(2)).toBe('1539.29');
  });
});
