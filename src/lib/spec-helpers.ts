import { numberField } from './calc-utils';
import { mixed } from './spec';
import type { Dec } from './decimal';
import type { Scenario } from './types';

/** Min and max with the matching zod validator, for a number input. */
export const num = (min: number, max: number) => ({ min, max, validator: numberField({ min, max }) });

/** A number input with its default and range. */
export const field = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  ...num(min, max),
});

/** An integer input with its default and range. */
export const intField = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max, integer: true }),
});

/** Scenarios from rows of numbers, one value per input name. */
export const rows = (names: string[], data: number[][], label: (v: number[]) => string): Scenario[] =>
  data.map((v) => ({ label: label(v), inputs: Object.fromEntries(names.map((n, k) => [n, v[k]])) }));

/** 6.022 × 10^23 style text, because a float written as 6.022e+23 reads badly in a result card. */
export const sci = (value: Dec, dp = 3): string => {
  if (value.isZero()) return '0';
  const [mantissa, exponent] = value.toExponential(dp).split('e');
  return `${mantissa} × 10^${Number(exponent)}`;
};

/** Base scenarios followed by extra ones. */
export const plus = (base: Scenario[], extra: Scenario[]): Scenario[] => [...base, ...extra];

/**
 * Extra scenarios with values specific to one page (seeded by its slug), so the numbers in the intro differ from
 * every sibling page and the similarity gate has no near-duplicates to find. Numbers are rounded to `step`
 * (default 1); `picks` choose one of a list of option values.
 */
export function varied(
  slug: string,
  count: number,
  nums: { name: string; lo: number; hi: number; step?: number }[],
  picks: { name: string; options: string[] }[],
  label: (v: Record<string, string | number>) => string,
): Scenario[] {
  return mixed(
    slug,
    count,
    (r) => {
      const v: Record<string, number> = {};
      for (const n of nums) v[n.name] = Math.round(r(n.lo, n.hi) / (n.step ?? 1)) * (n.step ?? 1);
      for (const p of picks) v[p.name] = r(0, p.options.length - 0.01);
      return v;
    },
    () => '',
  ).map((s) => {
    const v: Record<string, string | number> = {};
    for (const n of nums) v[n.name] = Number(Number(s.inputs[n.name]).toFixed(2));
    for (const p of picks) v[p.name] = p.options[Math.floor(Number(s.inputs[p.name]))];
    return { label: label(v), inputs: v };
  });
}
