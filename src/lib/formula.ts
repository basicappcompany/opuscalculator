import { D, type Dec } from './decimal';

/**
 * Conventional atomic weights (IUPAC, rounded as in standard textbook tables) for the elements people type most
 * often. Strings, so decimal.js reads them exactly. An element missing here is reported, never guessed.
 */
export const ATOMIC_MASS: Readonly<Record<string, string>> = {
  H: '1.008',
  He: '4.0026',
  Li: '6.94',
  Be: '9.0122',
  B: '10.81',
  C: '12.011',
  N: '14.007',
  O: '15.999',
  F: '18.998',
  Ne: '20.180',
  Na: '22.990',
  Mg: '24.305',
  Al: '26.982',
  Si: '28.085',
  P: '30.974',
  S: '32.06',
  Cl: '35.45',
  Ar: '39.948',
  K: '39.098',
  Ca: '40.078',
  Ti: '47.867',
  Cr: '51.996',
  Mn: '54.938',
  Fe: '55.845',
  Co: '58.933',
  Ni: '58.693',
  Cu: '63.546',
  Zn: '65.38',
  Br: '79.904',
  Ag: '107.87',
  Sn: '118.71',
  I: '126.90',
  Ba: '137.33',
  Au: '196.97',
  Hg: '200.59',
  Pb: '207.2',
  U: '238.03',
};

export type FormulaResult = { counts: Map<string, number> } | { error: string };

/**
 * Reads a formula such as H2O, Ca(OH)2 or Al2(SO4)3 into element counts, in order of first appearance.
 * Round brackets nest. Hydrate dots and charges are not supported and are reported as unexpected characters.
 */
export function parseFormula(text: string): FormulaResult {
  const src = text.replace(/\s+/g, '');
  if (!src) return { error: 'Enter a formula' };
  const stack: Map<string, number>[] = [new Map()];
  let i = 0;
  const isDigit = (ch: string) => ch >= '0' && ch <= '9';
  const readCount = (): number => {
    let digits = '';
    while (i < src.length && isDigit(src[i])) digits += src[i++];
    return digits ? Math.min(parseInt(digits, 10), 100000) : 1;
  };
  const add = (map: Map<string, number>, el: string, n: number) => map.set(el, (map.get(el) ?? 0) + n);

  while (i < src.length) {
    const ch = src[i];
    if (ch === '(') {
      stack.push(new Map());
      i++;
    } else if (ch === ')') {
      if (stack.length < 2) return { error: 'A closing bracket has no opening bracket' };
      i++;
      const times = readCount();
      const inner = stack.pop()!;
      const top = stack[stack.length - 1];
      for (const [el, n] of inner) add(top, el, n * times);
    } else if (ch >= 'A' && ch <= 'Z') {
      let el = ch;
      i++;
      while (i < src.length && src[i] >= 'a' && src[i] <= 'z') el += src[i++];
      if (!(el in ATOMIC_MASS)) return { error: `Unknown element "${el}"` };
      add(stack[stack.length - 1], el, readCount());
    } else {
      return { error: `Unexpected character "${ch}"` };
    }
  }
  if (stack.length !== 1) return { error: 'An opening bracket has no closing bracket' };
  return { counts: stack[0] };
}

/** Mass of one element's share of a formula, in g/mol. */
export const elementMass = (el: string, count: number): Dec => new D(ATOMIC_MASS[el]).mul(count);

/** Molar mass of the whole formula, in g/mol. */
export function molarMass(counts: Map<string, number>): Dec {
  let total = new D(0);
  for (const [el, n] of counts) total = total.plus(elementMass(el, n));
  return total;
}

/**
 * Multiplies a list of mole ratios by 1, 2, 3 ... up to `maxMultiple` until every one is within `tolerance` of a whole
 * number, and returns those whole numbers. Null when no small multiple works.
 */
export function wholeNumberRatio(ratios: Dec[], maxMultiple = 8, tolerance = '0.1'): Dec[] | null {
  for (let mult = 1; mult <= maxMultiple; mult++) {
    const scaled = ratios.map((r) => r.mul(mult));
    if (scaled.every((v) => v.minus(v.toDecimalPlaces(0)).abs().lt(tolerance))) return scaled.map((v) => v.toDecimalPlaces(0));
  }
  return null;
}

/** A formula written in Hill order: C first, then H, then the rest alphabetically; with no carbon, everything alphabetical. */
export function hillFormula(symbols: string[], counts: Dec[]): string {
  const order = symbols.includes('C') ? ['C', 'H', ...symbols.filter((s) => s !== 'C' && s !== 'H').sort()] : [...symbols].sort();
  return order
    .filter((el) => symbols.includes(el))
    .map((el) => {
      const n = counts[symbols.indexOf(el)];
      return n.eq(1) ? el : `${el}${n.toFixed(0)}`;
    })
    .join('');
}
