import { D, toD, type Dec } from './decimal';

/** Stable 32-bit hash of a string, so generated copy varies per page but never between builds. */
export function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic generator (numerical recipes LCG). Same seed, same sequence, in every build. */
export function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x;
  };
}

/** Pick one item by hash, so two pages in a family rotate through the variants instead of repeating one. */
export const pick = <T>(items: readonly T[], seed: string): T => items[hash32(seed) % items.length];

/**
 * An exact factor written as text: "0.3048", "1609.344/3600", "4.4482216152605/0.00064516" or "25.4*133.322387415".
 * Evaluated left to right with decimal.js, so no float ever touches a conversion factor.
 */
export function parseFactor(expr: string): Dec {
  const parts = expr.split(/([*/])/);
  let acc = new D(parts[0].trim());
  for (let i = 1; i < parts.length; i += 2) {
    const next = new D(parts[i + 1].trim());
    acc = parts[i] === '*' ? acc.mul(next) : acc.div(next);
  }
  return acc;
}

const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * `sig` significant digits written out in full (never 1e-7), trailing zeros dropped, thousands separators
 * in the whole part. 12345.678 with 5 gives 12,346; 0.000123456 with 4 gives 0.0001235.
 */
export function fmtSig(value: Dec | string | number, sig = 6, grouped = true): string {
  const d = toD(value);
  if (d.isZero()) return '0';
  const plain = d.toSignificantDigits(sig, D.ROUND_HALF_UP).toFixed();
  const negative = plain.startsWith('-');
  const [int, frac] = (negative ? plain.slice(1) : plain).split('.');
  const body = (grouped ? group(int) : int) + (frac ? `.${frac.replace(/0+$/, '')}` : '');
  return `${negative ? '-' : ''}${body.replace(/\.$/, '')}`;
}

/** True when `value` has no more than `sig` significant digits, so describing it as "exactly" is honest. */
export const isShort = (value: Dec, sig = 12): boolean => value.toSignificantDigits(sig).eq(value);

export const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
