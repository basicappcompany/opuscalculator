import { D, toD, type Dec } from './decimal';
import type { UnitOption } from './types';

/** Exact definitions: 1 lb = 0.45359237 kg and 1 in = 2.54 cm. */
export const KG_PER_LB = new D('0.45359237');
export const CM_PER_IN = new D('2.54');

export const toKg = (value: unknown, unit: string): Dec => (unit === 'lb' ? toD(value).mul(KG_PER_LB) : toD(value));
export const toCm = (value: unknown, unit: string): Dec => (unit === 'in' ? toD(value).mul(CM_PER_IN) : toD(value));
export const kgToUnit = (kg: Dec, unit: string): Dec => (unit === 'lb' ? kg.div(KG_PER_LB) : kg);

export const WEIGHT_UNITS = [
  { value: 'kg', label: 'kg', factor: '1' },
  { value: 'lb', label: 'lb', factor: KG_PER_LB.toString() },
];
export const LENGTH_UNITS = [
  { value: 'cm', label: 'cm', factor: '1' },
  { value: 'in', label: 'in', factor: CM_PER_IN.toString() },
];

/**
 * Re-express a typed number in another unit using the exact factors from the config. Anything that
 * is not a plain number, or an option without a factor, is left untouched.
 */
export function convertValue(raw: string, from: UnitOption | undefined, to: UnitOption | undefined): string {
  if (!from?.factor || !to?.factor || from.value === to.value) return raw;
  try {
    const text = raw.trim().replace(/,/g, '');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(text)) return raw;
    const converted = new D(text).mul(from.factor).div(to.factor).toDecimalPlaces(4, D.ROUND_HALF_UP);
    return converted.toString();
  } catch {
    return raw;
  }
}
