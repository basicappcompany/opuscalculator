import Decimal from 'decimal.js';

/**
 * The only Decimal constructor calculators should use. Fixed precision and half-up rounding
 * (the convention for money and for how people round by hand), independent of any global config.
 */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -40, toExpPos: 40 });
export type Dec = InstanceType<typeof D>;

/** Parse a user value. Strings are read exactly (never through a float); throws on junk. */
export function toD(value: unknown): Dec {
  if (value instanceof D) return value;
  if (typeof value === 'number') return new D(String(value));
  const text = String(value ?? '')
    .trim()
    .replace(/,/g, '');
  return new D(text);
}

export const ZERO = new D(0);
export const ONE = new D(1);
export const HUNDRED = new D(100);
