import { activeCurrency } from './currency';
import { D, toD, type Dec } from './decimal';

const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Fixed decimals with thousands separators. Never returns "-0.00". */
export function fmtFixed(value: Dec | string | number, dp: number): string {
  const d = toD(value);
  const fixed = d.toFixed(dp, D.ROUND_HALF_UP);
  const negative = fixed.startsWith('-');
  const [int, frac] = (negative ? fixed.slice(1) : fixed).split('.');
  const body = group(int) + (frac ? `.${frac}` : '');
  const isZero = /^[0.,]*$/.test(body);
  return negative && !isZero ? `-${body}` : body;
}

/** Up to `maxDp` decimals, trailing zeros dropped: 30, 1.21, 0.0816. */
export function fmtNumber(value: Dec | string | number, maxDp = 2): string {
  const s = fmtFixed(value, maxDp);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** The symbol money is shown with right now: the visitor's chosen currency (see withCurrency), else `fallback`. */
export const currencySymbol = (fallback = '$'): string => activeCurrency()?.symbol ?? fallback;

/**
 * Currency with two decimals: $1,234.56, -$5.00. A visitor's chosen currency (withCurrency) overrides
 * `symbol` and sets the decimals (0 for yen and won); with none set, `symbol` and two decimals apply.
 */
export function fmtCurrency(value: Dec | string | number, symbol = '$'): string {
  const chosen = activeCurrency();
  const sym = chosen?.symbol ?? symbol;
  const s = fmtFixed(value, chosen?.dp ?? 2);
  return s.startsWith('-') ? `-${sym}${s.slice(1)}` : `${sym}${s}`;
}

/** `value` is already a percentage (12.5 means 12.5%). */
export function fmtPercent(value: Dec | string | number, dp = 2): string {
  return `${fmtFixed(value, dp)}%`;
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
