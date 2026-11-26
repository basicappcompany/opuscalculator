import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { findImpurities, jaccard, validateForIndexing } from './quality-gate';
import type { CalculatorConfig } from './types';

/** n distinct words from a seeded vocabulary, so two intros built from different seeds share nothing. */
const prose = (seed: string, n: number) => Array.from({ length: n }, (_, i) => `${seed}word${i}`).join(' ');

const faq = (seed: string) => [1, 2, 3].map((i) => ({ question: `${seed} question ${i}?`, answer: `${seed} answer ${i}.` }));

function make(slug: string, overrides: Partial<CalculatorConfig> = {}): CalculatorConfig {
  return {
    slug,
    category: 'math',
    tier: 1,
    publish: true,
    title: slug,
    h1: slug,
    metaDescription: slug,
    intro: prose(slug.replace(/-/g, ''), 160),
    inputs: [{ name: 'x', label: 'X', type: 'number', default: 1, validator: z.number() }],
    outputs: [{ name: 'y', label: 'Y', format: 'number' }],
    calculate: (i) => ({ y: String(i.x) }),
    formulaDescription: 'y = x',
    workedExample: 'x = 1 gives y = 1',
    faq: faq(slug),
    relatedSlugs: [],
    lastUpdated: '2026-11-22',
    ...overrides,
  };
}

describe('validateForIndexing', () => {
  it('passes a good calculator', () => {
    const r = validateForIndexing(make('alpha'), [make('beta')]);
    expect(r).toEqual({ pass: true, reasons: [] });
  });

  it('rejects an intro under 150 words, and accepts exactly 150', () => {
    expect(validateForIndexing(make('a', { intro: prose('a', 149) })).reasons[0]).toMatch(/149 words/);
    expect(validateForIndexing(make('a', { intro: prose('a', 150) })).pass).toBe(true);
  });

  it('rejects an intro with Jaccard >= 0.3 against another calculator', () => {
    const base = prose('shared', 160);
    const near = `${base} ${prose('extra', 20)}`; // ~0.89 similar
    const r = validateForIndexing(make('one', { intro: near }), [make('two', { intro: base })]);
    expect(r.pass).toBe(false);
    expect(r.reasons.join()).toMatch(/too similar to "two"/);
  });

  it('accepts intros that overlap a little (below 0.3)', () => {
    const a = `${prose('aa', 140)} ${prose('common', 20)}`;
    const b = `${prose('bb', 140)} ${prose('common', 20)}`; // 20 / 300 = 0.067
    expect(validateForIndexing(make('a', { intro: a }), [make('b', { intro: b })]).pass).toBe(true);
  });

  it('requires 3 FAQ entries', () => {
    const r = validateForIndexing(make('a', { faq: faq('a').slice(0, 2) }));
    expect(r.reasons).toContain('has 2 FAQ entries, needs at least 3');
  });

  it("rejects a FAQ entry identical to another calculator's, ignoring case and spacing", () => {
    const other = make('b');
    const mine = make('a', { faq: [...faq('a').slice(0, 2), { ...other.faq[0], question: `  ${other.faq[0].question.toUpperCase()} ` }] });
    mine.faq[2].answer = other.faq[0].answer;
    expect(validateForIndexing(mine, [other]).reasons.join()).toMatch(/identical to one on "b"/);
  });

  it('allows the same question with a different answer', () => {
    const other = make('b');
    const mine = make('a', { faq: [...faq('a').slice(0, 2), { question: other.faq[0].question, answer: 'something else entirely' }] });
    expect(validateForIndexing(mine, [other]).pass).toBe(true);
  });

  it('rejects a slug collision', () => {
    const r = validateForIndexing(make('same'), [make('same', { intro: prose('other', 160), faq: faq('other') })]);
    expect(r.reasons).toContain('slug "same" collides with another calculator');
  });

  it('does not compare a calculator with itself', () => {
    const a = make('a');
    expect(validateForIndexing(a, [a]).pass).toBe(true);
  });
});

describe('calculate() purity scan', () => {
  const bad = (fn: (...args: never[]) => unknown) => findImpurities(fn);

  it('flags the forbidden APIs', () => {
    expect(bad(() => fetch('/x'))).toContain('fetch');
    expect(bad(() => window.innerWidth)).toContain('window');
    expect(bad(() => Date.now())).toContain('Date.now');
    expect(bad(() => new Date())).toContain('new Date() with no argument');
    expect(bad(() => Math.random())).toContain('Math.random');
    expect(bad(() => localStorage.getItem('k'))).toContain('localStorage/sessionStorage');
  });

  it('allows a date that is passed in', () => {
    expect(bad(() => new Date('2026-01-01'))).toEqual([]);
    expect(bad((s: string) => new Date(s))).toEqual([]);
  });

  it('ignores forbidden words inside strings and comments', () => {
    expect(bad(() => 'call fetch( on window with Date.now')).toEqual([]);
    // uses fetch( here and window too
    expect(bad(() => /* window */ 1)).toEqual([]);
  });

  it('makes the gate fail with a reason', () => {
    const r = validateForIndexing(make('a', { calculate: () => ({ y: String(Date.now()) }) }));
    expect(r.reasons).toContain('calculate() is not pure, it uses: Date.now');
  });
});

describe('jaccard', () => {
  it('computes the ratio of intersection to union', () => {
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBe(0.5);
    expect(jaccard(new Set(), new Set())).toBe(1);
  });
});
