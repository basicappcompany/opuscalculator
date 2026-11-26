import { describe, expect, it } from 'vitest';
import { molarMass, parseFormula } from '../src/lib/formula';

const counts = (text: string) => {
  const parsed = parseFormula(text);
  if ('error' in parsed) throw new Error(parsed.error);
  return Object.fromEntries(parsed.counts);
};

describe('parseFormula', () => {
  it('reads plain formulas and counts', () => {
    expect(counts('H2O')).toEqual({ H: 2, O: 1 });
    expect(counts('C6H12O6')).toEqual({ C: 6, H: 12, O: 6 });
  });

  it('multiplies bracketed groups and merges repeated elements', () => {
    expect(counts('Ca(OH)2')).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(counts('Al2(SO4)3')).toEqual({ Al: 2, S: 3, O: 12 });
    expect(counts('Mg(OH)2(OH)')).toEqual({ Mg: 1, O: 3, H: 3 });
  });

  it('handles nested brackets', () => {
    expect(counts('Fe((OH)2)3')).toEqual({ Fe: 1, O: 6, H: 6 });
  });

  it('is case sensitive: Co is cobalt, CO is carbon then oxygen', () => {
    expect(counts('Co')).toEqual({ Co: 1 });
    expect(counts('CO')).toEqual({ C: 1, O: 1 });
  });

  it('ignores spaces', () => {
    expect(counts(' H 2 O ')).toEqual({ H: 2, O: 1 });
  });

  it('reports bad input instead of guessing', () => {
    expect(parseFormula('')).toEqual({ error: 'Enter a formula' });
    expect(parseFormula('Xx2')).toEqual({ error: 'Unknown element "Xx"' });
    expect(parseFormula('H2O)')).toEqual({ error: 'A closing bracket has no opening bracket' });
    expect(parseFormula('(H2O')).toEqual({ error: 'An opening bracket has no closing bracket' });
    expect(parseFormula('CuSO4.5H2O')).toEqual({ error: 'Unexpected character "."' });
    expect(parseFormula('h2o')).toEqual({ error: 'Unexpected character "h"' });
  });
});

describe('molarMass', () => {
  const mass = (text: string) => {
    const parsed = parseFormula(text);
    if ('error' in parsed) throw new Error(parsed.error);
    return molarMass(parsed.counts).toString();
  };

  it('sums exact decimal atomic weights with no float drift', () => {
    expect(mass('H2O')).toBe('18.015');
    expect(mass('NaCl')).toBe('58.44');
    expect(mass('Ca(OH)2')).toBe('74.092');
    expect(mass('C6H12O6')).toBe('180.156');
    expect(mass('Al2(SO4)3')).toBe('342.132');
  });
});
