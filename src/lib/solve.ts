import { D, toD, type Dec } from './decimal';
import { fmtNumber } from './format';
import type { CalculatorConfig } from './types';

export type SolveResult = { ok: true; value: string } | { ok: false; reason: string };

/** First number in a formatted result such as "$1,234.56", "22.9" or "12 V". Null when there is none. */
export function parseResultNumber(text: string): Dec | null {
  // Optional sign, optional currency symbol of any kind ("$", "C$", "₹", "CHF "), then digits: "-$5.00", "-₹5.00", "12 V".
  const m = /(-|−)?\s*[^\d\s.,+\-−]{0,5}\s*(\d[\d,]*\.?\d*|\.\d+)/.exec(text);
  if (!m) return null;
  const d = toD(m[2]);
  return m[1] ? d.neg() : d;
}

/**
 * Find the value of one number input that makes one output equal a target, holding every other
 * input fixed. Works for any calculator whose output moves one way as that input grows (true of
 * almost every calculator: more principal, more interest). It searches the input's min..max with
 * decimal.js bisection and says so plainly when the target cannot be reached.
 *
 * Generic on purpose: it knows nothing about any particular calculator.
 */
export function solveInput(config: CalculatorConfig, inputs: Record<string, unknown>, solveName: string, outputName: string, target: unknown): SolveResult {
  const spec = config.inputs.find((i) => i.name === solveName);
  if (!spec || spec.type !== 'number') return { ok: false, reason: 'That input cannot be solved for.' };
  if (spec.min === undefined || spec.max === undefined) return { ok: false, reason: 'This input has no limits to search within.' };
  if (!config.outputs.some((o) => o.name === outputName)) return { ok: false, reason: 'Unknown result.' };

  let want: Dec;
  try {
    want = toD(target);
  } catch {
    return { ok: false, reason: 'Enter the result you want as a number.' };
  }

  const at = (x: Dec): Dec | null => {
    const out = config.calculate({ ...inputs, [solveName]: x.toString() })[outputName];
    return out === undefined ? null : parseResultNumber(out);
  };

  let lo = new D(spec.min);
  let hi = new D(spec.max);
  const fLo = at(lo);
  const fHi = at(hi);
  if (!fLo || !fHi) return { ok: false, reason: 'That result is not a number, so it cannot be solved for.' };
  const increasing = fHi.gte(fLo);
  const [low, high] = increasing ? [fLo, fHi] : [fHi, fLo];
  if (want.lt(low) || want.gt(high)) {
    return { ok: false, reason: `No value of this input gives that result. Reachable results run from ${fmtNumber(low, 6)} to ${fmtNumber(high, 6)}.` };
  }

  for (let step = 0; step < 80; step++) {
    const mid = lo.plus(hi).div(2);
    const f = at(mid);
    if (!f) return { ok: false, reason: 'The result is not a number for part of the range.' };
    if (f.eq(want)) return { ok: true, value: fmtNumber(mid, 6) };
    if (f.lt(want) === increasing) lo = mid;
    else hi = mid;
  }
  return { ok: true, value: fmtNumber(lo.plus(hi).div(2), 6) };
}
