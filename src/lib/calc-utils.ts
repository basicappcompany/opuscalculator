import { z } from 'zod';
import { D, toD, type Dec } from './decimal';
import type { CalculatorConfig } from './types';

const clean = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .replace(/,/g, '');
const isNumeric = (v: unknown): boolean => /^[+-]?(\d+\.?\d*|\.\d+)$/.test(clean(v));

/** A number typed by a person (string or number). Checked as text so "" and "abc" are rejected. */
export function numberField(opts: { min?: number; max?: number; integer?: boolean } = {}) {
  const { min, max, integer } = opts;
  return z
    .union([z.string(), z.number()])
    .refine(isNumeric, 'Enter a number')
    .refine((v) => !isNumeric(v) || !integer || Number.isInteger(Number(clean(v))), 'Enter a whole number')
    .refine((v) => !isNumeric(v) || min === undefined || Number(clean(v)) >= min, `Must be at least ${min}`)
    .refine((v) => !isNumeric(v) || max === undefined || Number(clean(v)) <= max, `Must be at most ${max}`);
}

export function selectField(values: readonly [string, ...string[]]) {
  return z.enum(values, { message: 'Choose one of the options' });
}

/** ISO calendar date, YYYY-MM-DD, that really exists (rejects 2026-02-30). */
export function dateField() {
  return z.string().refine((v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return false;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
  }, 'Enter a valid date');
}

/** A list of numbers separated by commas, spaces, semicolons or new lines. */
export function parseNumberList(text: unknown): Dec[] {
  return String(text ?? '')
    .split(/[\s,;]+/)
    .filter((t) => t !== '')
    .map((t) => {
      if (!isNumeric(t)) throw new Error(`"${t}" is not a number`);
      return toD(t);
    });
}

export function numberListField(minCount: number, maxCount = 10000) {
  return z.string().refine((v) => {
    try {
      const n = parseNumberList(v).length;
      return n >= minCount && n <= maxCount;
    } catch {
      return false;
    }
  }, `Enter between ${minCount} and ${maxCount} numbers separated by commas or spaces`);
}

/** The unit a person picked for a `unit` input; falls back to the first option. */
export function unitOf(inputs: Record<string, unknown>, name: string, fallback: string): string {
  const v = inputs[`${name}Unit`];
  return typeof v === 'string' && v !== '' ? v : fallback;
}

/** Whole-number ceiling of a Decimal. */
export const ceilInt = (d: Dec): number => d.ceil().toNumber();

/** The default value of every input, as the widget and the tests start from. */
export function defaultInputs(config: CalculatorConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const input of config.inputs) {
    out[input.name] = input.default;
    if (input.type === 'unit' && input.unitOptions?.length) out[`${input.name}Unit`] = input.unitOptions[0].value;
  }
  return out;
}

/** Calculate with the defaults, optionally overriding some inputs. */
export function runWith(config: CalculatorConfig, overrides: Record<string, unknown> = {}): Record<string, string> {
  return config.calculate({ ...defaultInputs(config), ...overrides });
}

/** Days between two ISO dates (end minus start), using UTC so daylight saving never shifts a day. */
export function daysBetween(startIso: string, endIso: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(endIso) - ms(startIso)) / 86400000);
}

export { D };
