import { z } from 'zod';
import { selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { field, intField, varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 17 (math): the second half of the math consensus gaps: fraction helpers (equivalent fractions, least
 * common denominator), whole-number arithmetic (long division, modulo, unit rate), the law of sines with the
 * ambiguous case, dot products, and solid geometry (area, volume and surface-area pages). Exact decimal arithmetic,
 * BigInt for whole numbers. Math shows no disclaimer. Tier 2 or 3, so none is live until the cohort gate opens.
 */

const PI = D.acos(-1);
const RAD = PI.div(180);
const n4 = (x: Dec): string => fmtNumber(x, 4);

const pos = (name: string, label: string, def: number, max = 1e12) => field(name, label, def, 0.000001, max);
const real = (name: string, label: string, def: number) => field(name, label, def, -1e12, 1e12);
const sel = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});
const out = (name: string, label: string, highlight = false) => ({ name, label, format: 'text' as const, ...(highlight ? { highlight: true } : {}) });

const gcdBig = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
};
const big = (x: unknown): bigint => BigInt(toD(x).toFixed(0));
const fracText = (n: bigint, d: bigint): string => (d === 1n ? n.toString() : `${n}/${d}`);
const mixedText = (n: bigint, d: bigint): string => {
  const g = gcdBig(n, d) || 1n;
  const a = (n < 0n ? -n : n) / g;
  const den = d / g;
  const sign = n < 0n ? '-' : '';
  const whole = a / den;
  const rem = a % den;
  if (rem === 0n) return sign + whole.toString();
  if (whole === 0n) return `${sign}${rem}/${den}`;
  return `${sign}${whole} ${rem}/${den}`;
};
const FRACTION_LIST = /^\s*-?\d+\s*\/\s*[1-9]\d*\s*([,;\n]\s*-?\d+\s*\/\s*[1-9]\d*\s*)*$/;
const parseFractions = (text: string): [bigint, bigint][] =>
  text
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const [n, d] = t.split('/');
      const nn = BigInt(n.trim());
      const dd = BigInt(d.trim());
      const g = gcdBig(nn, dd) || 1n;
      return [nn / g, dd / g] as [bigint, bigint];
    });
const fractionList = (name: string, label: string, def: string) => ({
  name,
  label,
  type: 'text' as const,
  default: def,
  validator: z
    .string()
    .refine((v) => FRACTION_LIST.test(v) && v.split(/[,;\n]+/).filter((t) => t.trim()).length <= 12, 'Enter up to 12 fractions such as 1/2, 3/4, 5/6'),
});

export const SPECS: Spec[] = [
  {
    slug: 'equivalent-fractions-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Fractions',
    title: 'Equivalent Fractions Calculator: Simplest Form and Matches',
    h1: 'Equivalent Fractions Calculator',
    metaDescription: 'Find the simplest form of a fraction, a list of equivalent fractions and the equivalent fraction with a denominator you choose.',
    about:
      'Equivalent fractions name the same amount in different ways: 1/2, 2/4 and 5/10 are all one half. Multiplying the numerator and denominator by the same whole number gives a new match, and dividing both by their greatest common divisor gives the simplest one. Enter a fraction and, if you want one with a particular denominator, a target denominator. The page returns the lowest terms, the next five equivalents and the match for your target, or says when none exists with whole numbers.',
    inputs: [
      intField('n', 'Numerator', 3, -1000000, 1000000),
      intField('d', 'Denominator', 4, 1, 1000000),
      intField('t', 'Target denominator (optional match)', 20, 1, 1000000),
    ],
    outputs: [out('simple', 'Simplest form', true), out('list', 'Equivalent fractions'), out('target', 'Equivalent with the target denominator')],
    calculate: (i) => {
      const n = big(i.n);
      const d = big(i.d);
      const t = big(i.t);
      const g = gcdBig(n, d) || 1n;
      const sn = n / g;
      const sd = d / g;
      const list = [2n, 3n, 4n, 5n, 6n].map((k) => `${sn * k}/${sd * k}`).join(', ');
      return { simple: fracText(sn, sd), list, target: t % sd === 0n ? `${sn * (t / sd)}/${t}` : 'No whole-number equivalent with that denominator' };
    },
    formulaDescription:
      'a/b = (a·k)/(b·k) for any non-zero whole number k. The simplest form divides both parts by gcd(a, b). A fraction with denominator t exists in whole numbers only if t is a multiple of the simplest denominator.',
    formulaLatex: '\\dfrac{a}{b} = \\dfrac{a\\cdot k}{b\\cdot k}',
    workedExample:
      '3/4 is already simplest. Its next equivalents are 6/8, 9/12, 12/16, 15/20 and 18/24, so with a target denominator of 20 the match is 15/20. 6/8 reduces to 3/4, and 5/7 has no equivalent with denominator 20.',
    faq: [
      {
        question: 'Do equivalent fractions have the same value?',
        answer: 'Yes. They are different names for the same number, so 15/20 and 3/4 both equal 0.75.',
      },
      { question: 'How do I know two fractions are equivalent?', answer: 'Cross-multiply: a/b = c/d exactly when a × d = b × c.' },
      { question: 'Why match denominators?', answer: 'To add or compare fractions you need a common denominator, which is built from equivalent fractions.' },
    ],
    scenarios: varied(
      'equivalent-fractions-calculator',
      12,
      [
        { name: 'n', lo: 1, hi: 96, step: 1 },
        { name: 'd', lo: 2, hi: 99, step: 1 },
        { name: 't', lo: 12, hi: 480, step: 1 },
      ],
      [],
      (v) => `${v.n} over ${v.d} aiming at ${v.t}`,
    ),
    introOutputs: ['simple'],
    relatedSlugs: ['lcd-calculator', 'fraction-calculator', 'decimal-to-fraction-calculator'],
    checks: [
      { inputs: {}, expect: { simple: '3/4', list: '6/8, 9/12, 12/16, 15/20, 18/24', target: '15/20' } },
      { inputs: { n: 6, d: 8, t: 12 }, expect: { simple: '3/4', list: '6/8, 9/12, 12/16, 15/20, 18/24', target: '9/12' } },
      {
        inputs: { n: 5, d: 7, t: 20 },
        expect: { simple: '5/7', list: '10/14, 15/21, 20/28, 25/35, 30/42', target: 'No whole-number equivalent with that denominator' },
      },
      { inputs: { n: 10, d: 15, t: 9 }, expect: { simple: '2/3', target: '6/9' } },
    ],
  },
  {
    slug: 'lcd-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Fractions',
    title: 'Least Common Denominator Calculator for a List of Fractions',
    h1: 'Least Common Denominator Calculator',
    metaDescription: 'Find the least common denominator of up to 12 fractions, rewrite each over it and see their sum.',
    about:
      'Pour several recipes together, or line up gear teeth of different pitch, and you need one shared unit to compare the pieces. For fractions that shared unit is the smallest denominator every one of them divides into evenly: the least common multiple of the denominators once each piece is simplified. List up to a dozen fractions separated by commas. The page returns that shared denominator, restates each piece over it and tallies the total, shown as a mixed number when it passes one.',
    inputs: [fractionList('x', 'Fractions, separated by commas (e.g. 1/2, 3/4, 5/6)', '1/2, 3/4, 5/6')],
    outputs: [out('lcd', 'Least common denominator', true), out('conv', 'Fractions over the LCD'), out('sum', 'Sum of the fractions')],
    calculate: (i) => {
      const frs = parseFractions(String(i.x));
      let l = 1n;
      for (const [, d] of frs) l = (l * d) / gcdBig(l, d);
      let tn = 0n;
      for (const [n, d] of frs) tn += n * (l / d);
      const g = gcdBig(tn, l) || 1n;
      const rn = tn / g;
      const rd = l / g;
      const isBig = (rn < 0n ? -rn : rn) >= rd && rd !== 1n;
      return {
        lcd: l.toString(),
        conv: frs.map(([n, d]) => `${n * (l / d)}/${l}`).join(', '),
        sum: isBig ? `${fracText(rn, rd)} = ${mixedText(rn, rd)}` : fracText(rn, rd),
      };
    },
    formulaDescription:
      'LCD = lcm of the denominators after reducing each fraction. Each numerator is multiplied by LCD ÷ its own denominator. Up to 12 fractions; denominators must be positive.',
    formulaLatex: '\\mathrm{LCD} = \\operatorname{lcm}(d_{1}, d_{2}, \\ldots, d_{k})',
    workedExample: 'For 1/2, 3/4 and 5/6 the LCD is lcm(2, 4, 6) = 12, giving 6/12, 9/12 and 10/12, which add to 25/12 = 2 1/12.',
    faq: [
      { question: 'Is the LCD the same as the LCM?', answer: 'It is the least common multiple of the denominators, taken after each fraction is simplified.' },
      {
        question: 'Why not just multiply the denominators?',
        answer: 'That also works, but the result is often larger than needed; the least common denominator keeps the numbers small.',
      },
      { question: 'How do I enter a whole number?', answer: 'Write it over 1, as in 3/1.' },
    ],
    scenarios: [
      ['7/12, 11/18'],
      ['5/14, 9/35, 4/21'],
      ['13/45, 7/30'],
      ['3/22, 5/33'],
      ['17/60, 11/40, 1/36'],
      ['19/84, 5/56'],
      ['9/70, 13/105'],
      ['23/90, 7/75'],
      ['11/132, 5/88'],
      ['29/96, 13/64'],
      ['31/110, 3/55'],
      ['41/150, 17/100'],
    ].map(([x]) => ({ label: `mix ${x}`, inputs: { x } })),
    introOutputs: ['lcd'],
    relatedSlugs: ['equivalent-fractions-calculator', 'fraction-calculator', 'gcd-lcm-calculator'],
    checks: [
      { inputs: {}, expect: { lcd: '12', conv: '6/12, 9/12, 10/12', sum: '25/12 = 2 1/12' } },
      { inputs: { x: '2/3, 5/8' }, expect: { lcd: '24', conv: '16/24, 15/24', sum: '31/24 = 1 7/24' } },
      { inputs: { x: '1/4; 1/6; 1/10; 3/15' }, expect: { lcd: '60', conv: '15/60, 10/60, 6/60, 12/60', sum: '43/60' } },
      { inputs: { x: '-1/2, 1/2' }, expect: { lcd: '2', conv: '-1/2, 1/2', sum: '0' } },
    ],
  },
  {
    slug: 'long-division-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Arithmetic',
    title: 'Long Division Calculator: Quotient, Remainder and Decimal',
    h1: 'Long Division Calculator',
    metaDescription:
      'Divide one whole number by another and get the quotient with remainder, the decimal result and a check that quotient × divisor + remainder returns the dividend.',
    about:
      'Long division splits a dividend by a divisor one digit at a time, leaving a quotient and a remainder smaller than the divisor. Enter the two whole numbers to see the answer as a quotient with its remainder, written like 123 R 4, the same quotient as a decimal to ten places and a check line showing that quotient times divisor plus remainder rebuilds the dividend. It is handy for homework answers, for sharing items into equal groups and for spotting arithmetic slips.',
    inputs: [intField('a', 'Dividend', 865, 0, 1000000000000), intField('b', 'Divisor', 7, 1, 1000000000)],
    outputs: [out('quot', 'Quotient and remainder', true), out('dec', 'As a decimal (10 places)'), out('check', 'Check')],
    calculate: (i) => {
      const a = big(i.a);
      const b = big(i.b);
      const q = a / b;
      const r = a % b;
      return {
        quot: r === 0n ? q.toString() : `${q} R ${r}`,
        dec: fmtNumber(new D(a.toString()).div(new D(b.toString())), 10),
        check: `${q} × ${b} + ${r} = ${a}`,
      };
    },
    formulaDescription:
      'dividend = quotient × divisor + remainder, with 0 ≤ remainder < divisor. The decimal result is dividend ÷ divisor, shown to 10 places.',
    formulaLatex: 'a = q\\,b + r, \\quad 0 \\le r < b',
    workedExample: '865 ÷ 7 = 123 remainder 4, because 123 × 7 + 4 = 865; as a decimal that is 123.5714285714. And 1,000 ÷ 8 divides exactly: 125.',
    faq: [
      {
        question: 'What is the remainder?',
        answer: 'What is left over after taking out as many whole groups of the divisor as possible; it is always smaller than the divisor.',
      },
      { question: 'How do I get a decimal answer?', answer: 'Keep dividing after the point, adding zeros, as the decimal line shows.' },
      { question: 'Can I use a negative number?', answer: 'This page handles whole numbers from zero up; for signs use the modulo calculator.' },
    ],
    scenarios: varied(
      'long-division-calculator',
      12,
      [
        { name: 'a', lo: 300, hi: 99000, step: 1 },
        { name: 'b', lo: 3, hi: 97, step: 1 },
      ],
      [],
      (v) => `${v.a} shared by ${v.b}`,
    ),
    introOutputs: ['quot'],
    relatedSlugs: ['modulo-calculator', 'fraction-to-decimal-calculator', 'gcd-lcm-calculator'],
    checks: [
      { inputs: {}, expect: { quot: '123 R 4', dec: '123.5714285714', check: '123 × 7 + 4 = 865' } },
      { inputs: { a: 1000, b: 8 }, expect: { quot: '125', dec: '125', check: '125 × 8 + 0 = 1000' } },
      { inputs: { a: 22, b: 7 }, expect: { quot: '3 R 1', dec: '3.1428571429', check: '3 × 7 + 1 = 22' } },
      { inputs: { a: 5, b: 9 }, expect: { quot: '0 R 5', dec: '0.5555555556', check: '0 × 9 + 5 = 5' } },
    ],
  },
  {
    slug: 'modulo-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Arithmetic',
    title: 'Modulo Calculator: Remainder, Floor Quotient and Congruence',
    h1: 'Modulo Calculator',
    metaDescription:
      'Calculate a mod b for whole numbers, including negative values, with the truncated remainder, the floor quotient and the congruence statement.',
    about:
      'The modulo operation gives the remainder after dividing one whole number by another, and it is the arithmetic of clocks, calendars and repeating cycles: 17 mod 5 is 2 because 17 is three full fives plus two. Programming languages disagree about negative numbers, so this page shows both conventions: the mathematical modulus, which is never negative for a positive divisor, and the truncated remainder that takes the sign of the dividend. It also gives the floor quotient and writes the result as a congruence.',
    inputs: [intField('a', 'Dividend a', 17, -1000000000000, 1000000000000), intField('b', 'Modulus b (positive)', 5, 1, 1000000000000)],
    outputs: [out('mod', 'a mod b (mathematical)', true), out('rem', 'Truncated remainder'), out('floor', 'Floor quotient'), out('cong', 'Congruence')],
    calculate: (i) => {
      const a = big(i.a);
      const b = big(i.b);
      let m = a % b;
      if (m < 0n) m += b;
      const floor = (a - m) / b;
      return { mod: m.toString(), rem: (a % b).toString(), floor: floor.toString(), cong: `${a} ≡ ${m} (mod ${b})` };
    },
    formulaDescription:
      'a mod b = a − b × floor(a ÷ b), which lies from 0 to b − 1. The truncated remainder is a − b × trunc(a ÷ b) and has the sign of a. a ≡ r (mod b) means b divides a − r.',
    formulaLatex: 'a \\bmod b = a - b\\left\\lfloor \\dfrac{a}{b} \\right\\rfloor',
    workedExample:
      '17 mod 5 = 2 (floor quotient 3). For −17 the mathematical modulus is 3, since −17 = (−4) × 5 + 3, while the truncated remainder is −2. 100 mod 7 = 2.',
    faq: [
      {
        question: 'Why do languages differ for negative numbers?',
        answer: 'Some truncate the quotient toward zero (the % operator in C and JavaScript) and some floor it (Python), which changes the sign of the result.',
      },
      { question: 'What is it used for?', answer: 'Clock arithmetic, checking if a number is even or divisible, hashing, calendars and cyclic indexes.' },
      { question: 'What does ≡ mean?', answer: 'Congruent: two numbers are congruent modulo b if they leave the same remainder when divided by b.' },
    ],
    scenarios: varied(
      'modulo-calculator',
      12,
      [
        { name: 'a', lo: -900, hi: 9000, step: 1 },
        { name: 'b', lo: 2, hi: 97, step: 1 },
      ],
      [],
      (v) => `${v.a} wrapped at ${v.b}`,
    ),
    introOutputs: ['mod'],
    relatedSlugs: ['long-division-calculator', 'gcd-lcm-calculator', 'prime-factorization-calculator'],
    checks: [
      { inputs: {}, expect: { mod: '2', rem: '2', floor: '3', cong: '17 ≡ 2 (mod 5)' } },
      { inputs: { a: -17, b: 5 }, expect: { mod: '3', rem: '-2', floor: '-4', cong: '-17 ≡ 3 (mod 5)' } },
      { inputs: { a: 100, b: 7 }, expect: { mod: '2', rem: '2', floor: '14', cong: '100 ≡ 2 (mod 7)' } },
      { inputs: { a: 20, b: 5 }, expect: { mod: '0', rem: '0', floor: '4', cong: '20 ≡ 0 (mod 5)' } },
    ],
  },
  {
    slug: 'unit-rate-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Ratios and proportions',
    title: 'Unit Rate Calculator: Amount Per One Unit',
    h1: 'Unit Rate Calculator',
    metaDescription:
      'Find a unit rate by dividing one quantity by another, such as miles per gallon or words per minute, with the reverse rate and the rate per 10 and per 100.',
    about:
      'A unit rate states how much of one thing goes with exactly one of another: 150 miles on 4 gallons is 37.5 miles per gallon, and 240 words in 15 minutes is 16 words per minute. Enter the two quantities, the first being what you are measuring and the second what it is measured against. You get the rate per one unit, the reverse rate, which tells you how many of the second unit go with one of the first, and the scaled rates per 10 and per 100.',
    inputs: [pos('a', 'First quantity (e.g. miles)', 150), pos('b', 'Second quantity (e.g. gallons)', 4)],
    outputs: [
      out('rate', 'Rate per 1 of the second unit', true),
      out('inv', 'Reverse rate (second per 1 of the first)'),
      out('per10', 'Per 10'),
      out('per100', 'Per 100'),
    ],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      return { rate: n4(a.div(b)), inv: n4(b.div(a)), per10: n4(a.div(b).mul(10)), per100: n4(a.div(b).mul(100)) };
    },
    formulaDescription:
      'Unit rate = first quantity ÷ second quantity. The reverse rate is second ÷ first. The rate per 10 or per 100 is the unit rate times 10 or 100.',
    formulaLatex: '\\text{rate} = \\dfrac{a}{b}',
    workedExample:
      '150 miles on 4 gallons: 37.5 miles per gallon, or 0.0267 gallons per mile, which is 375 miles per 10 gallons. Typing 240 words in 15 minutes gives 16 words per minute.',
    faq: [
      {
        question: 'How is it different from a unit price?',
        answer: 'A unit price is a rate of cost per item or weight; a unit rate works for any two quantities, such as speed or fuel use.',
      },
      { question: 'Which quantity goes first?', answer: 'The one that comes before "per": miles per gallon puts miles first.' },
      { question: 'Why use a unit rate?', answer: 'It lets you compare offers or speeds fairly when the totals are different sizes.' },
    ],
    scenarios: varied(
      'unit-rate-calculator',
      12,
      [
        { name: 'a', lo: 7, hi: 960, step: 0.25 },
        { name: 'b', lo: 0.5, hi: 48, step: 0.25 },
      ],
      [],
      (v) => `${v.a} over ${v.b}`,
    ),
    introOutputs: ['rate'],
    relatedSlugs: ['unit-price-calculator', 'ratio-calculator', 'speed-distance-time-calculator'],
    checks: [
      { inputs: {}, expect: { rate: '37.5', inv: '0.0267', per10: '375', per100: '3,750' } },
      { inputs: { a: 240, b: 15 }, expect: { rate: '16', inv: '0.0625', per10: '160', per100: '1,600' } },
      { inputs: { a: 7.5, b: 2 }, expect: { rate: '3.75', inv: '0.2667', per10: '37.5', per100: '375' } },
    ],
  },
  {
    slug: 'law-of-sines-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Triangles',
    title: 'Law of Sines Calculator: SSA Triangles and the Ambiguous Case',
    h1: 'Law of Sines Calculator',
    metaDescription:
      'Solve a triangle from an angle, the side opposite it and a second side with the law of sines, including the ambiguous case with no, one or two solutions.',
    about:
      "The law of sines relates each side of a triangle to the sine of the angle opposite it. When you know an angle A, the side a opposite it and another side b, the angle B opposite b follows, but there can be no triangle, one or two, which is called the ambiguous case. Enter A in degrees and the sides a and b. The page says how many triangles fit and gives each one's remaining angles and third side.",
    inputs: [pos('A', 'Angle A (degrees)', 30, 179.9), pos('a', 'Side a, opposite angle A', 7), pos('b', 'Side b', 10)],
    outputs: [out('count', 'Number of triangles', true), out('t1', 'Triangle 1'), out('t2', 'Triangle 2')],
    calculate: (i) => {
      const A = toD(i.A);
      const a = toD(i.a);
      const b = toD(i.b);
      const sA = A.mul(RAD).sin();
      let sB = b.mul(sA).div(a);
      if (sB.gt(new D(1).plus('1e-12'))) return { count: 'No triangle', t1: '', t2: '' };
      if (sB.gt(1)) sB = new D(1);
      const B1 = D.asin(sB).div(RAD);
      const tri = (B: Dec): string => {
        const C = new D(180).minus(A).minus(B);
        const c = a.mul(C.mul(RAD).sin()).div(sA);
        return `B = ${fmtNumber(B, 2)}°, C = ${fmtNumber(C, 2)}°, c = ${n4(c)}`;
      };
      const B2 = new D(180).minus(B1);
      if (A.plus(B2).lt(new D(180).minus('1e-9')) && B2.minus(B1).abs().gt('1e-9')) return { count: 'Two triangles', t1: tri(B1), t2: tri(B2) };
      return { count: 'One triangle', t1: tri(B1), t2: 'None' };
    },
    formulaDescription:
      'a ÷ sin A = b ÷ sin B = c ÷ sin C. In the SSA case sin B = b sin A ÷ a: above 1 there is no triangle; B may be acute or its supplement 180° − B, and the second solution exists when A + (180° − B) < 180°.',
    formulaLatex: '\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B} = \\dfrac{c}{\\sin C}',
    workedExample:
      'A = 30°, a = 7, b = 10: sin B = 0.714, so B = 45.58° or 134.42°. Both fit, giving C = 104.42° with c = 13.5592, or C = 15.58° with c = 3.7613. With a = 4 instead, sin B exceeds 1 and no triangle exists.',
    faq: [
      {
        question: 'Why can there be two triangles?',
        answer: 'The sine of an angle and of its supplement are equal, so side a can swing to two positions when it is shorter than b.',
      },
      { question: 'When is there exactly one?', answer: 'When a is at least as long as b, or when sin B equals exactly 1 (a right angle at B).' },
      { question: 'What if I know two angles?', answer: 'Then the third is 180° minus the two, and any side gives the rest; the ASA triangle solver does it.' },
    ],
    scenarios: varied(
      'law-of-sines-calculator',
      12,
      [
        { name: 'A', lo: 20, hi: 120, step: 1 },
        { name: 'a', lo: 3, hi: 80, step: 0.5 },
        { name: 'b', lo: 3, hi: 80, step: 0.5 },
      ],
      [],
      (v) => `A ${v.A} degrees, sides ${v.a} and ${v.b}`,
    ),
    introOutputs: ['count'],
    relatedSlugs: ['triangle-asa-calculator', 'triangle-sas-calculator', 'right-triangle-calculator'],
    checks: [
      { inputs: {}, expect: { count: 'Two triangles', t1: 'B = 45.58°, C = 104.42°, c = 13.5592', t2: 'B = 134.42°, C = 15.58°, c = 3.7613' } },
      { inputs: { A: 40, a: 12, b: 8 }, expect: { count: 'One triangle', t1: 'B = 25.37°, C = 114.63°, c = 16.9707', t2: 'None' } },
      { inputs: { A: 30, a: 4, b: 10 }, expect: { count: 'No triangle', t1: '', t2: '' } },
      { inputs: { A: 50, a: 9, b: 9 }, expect: { count: 'One triangle', t1: 'B = 50°, C = 80°, c = 11.5702', t2: 'None' } },
    ],
  },
  {
    slug: 'dot-product-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Vectors',
    title: 'Dot Product Calculator: Vectors, Magnitudes and Angle',
    h1: 'Dot Product Calculator',
    metaDescription: 'Calculate the dot product of two 3D (or 2D) vectors, their magnitudes and the angle between them.',
    about:
      "The dot product multiplies two vectors component by component and adds the results into a single number. It is zero for perpendicular vectors, positive when they point roughly the same way and negative when they point apart, which is why it appears in physics for work and in graphics for lighting. Enter the components of both vectors; leave the third at zero for a flat 2D case. You also get each vector's length and the angle between them from the cosine formula.",
    inputs: [
      real('a1', 'Vector a: x', 1),
      real('a2', 'Vector a: y', 2),
      real('a3', 'Vector a: z', 3),
      real('b1', 'Vector b: x', 4),
      real('b2', 'Vector b: y', -5),
      real('b3', 'Vector b: z', 6),
    ],
    outputs: [
      out('dot', 'Dot product a · b', true),
      out('ma', 'Magnitude of a'),
      out('mb', 'Magnitude of b'),
      out('ang', 'Angle between them'),
      out('cos', 'Cosine of the angle'),
    ],
    calculate: (i) => {
      const a = [toD(i.a1), toD(i.a2), toD(i.a3)];
      const b = [toD(i.b1), toD(i.b2), toD(i.b3)];
      const dp = a.reduce((s, x, k) => s.plus(x.mul(b[k])), new D(0));
      const ma = a.reduce((s, x) => s.plus(x.pow(2)), new D(0)).sqrt();
      const mb = b.reduce((s, x) => s.plus(x.pow(2)), new D(0)).sqrt();
      if (ma.isZero() || mb.isZero()) return { dot: n4(dp), ma: n4(ma), mb: n4(mb), ang: 'Undefined (a zero vector)', cos: '' };
      const c = D.max(new D(-1), D.min(new D(1), dp.div(ma.mul(mb))));
      return { dot: n4(dp), ma: n4(ma), mb: n4(mb), ang: `${fmtNumber(D.acos(c).div(RAD), 2)}°`, cos: n4(c) };
    },
    formulaDescription: 'a · b = a₁b₁ + a₂b₂ + a₃b₃ = |a||b| cos θ, so θ = acos(a · b ÷ (|a||b|)). The magnitude is |a| = √(a₁² + a₂² + a₃²).',
    formulaLatex: '\\mathbf{a}\\cdot\\mathbf{b} = |\\mathbf{a}||\\mathbf{b}|\\cos\\theta',
    workedExample: 'a = (1, 2, 3) and b = (4, −5, 6): a · b = 4 − 10 + 18 = 12, |a| = 3.7417, |b| = 8.775, cos θ = 0.3655 and θ = 68.56°.',
    faq: [
      { question: 'What does a zero dot product mean?', answer: 'The vectors are perpendicular (orthogonal), provided neither is the zero vector.' },
      { question: 'Is the result a vector?', answer: 'No, it is a scalar. The cross product is the one that gives a vector.' },
      { question: 'Where is it used?', answer: 'Work in physics (force dotted with displacement), projection, and shading in computer graphics.' },
    ],
    scenarios: varied(
      'dot-product-calculator',
      12,
      [
        { name: 'a1', lo: -9, hi: 9, step: 0.5 },
        { name: 'a2', lo: -9, hi: 9, step: 0.5 },
        { name: 'a3', lo: -9, hi: 9, step: 0.5 },
        { name: 'b1', lo: -9, hi: 9, step: 0.5 },
        { name: 'b2', lo: -9, hi: 9, step: 0.5 },
        { name: 'b3', lo: -9, hi: 9, step: 0.5 },
      ],
      [],
      (v) => `[${v.a1} ${v.a2} ${v.a3}] and [${v.b1} ${v.b2} ${v.b3}]`,
    ),
    introOutputs: ['dot', 'ang'],
    relatedSlugs: ['distance-between-two-points-calculator', 'work-calculator', 'slope-calculator'],
    checks: [
      { inputs: {}, expect: { dot: '12', ma: '3.7417', mb: '8.775', ang: '68.56°', cos: '0.3655' } },
      { inputs: { a1: 1, a2: 0, a3: 0, b1: 0, b2: 1, b3: 0 }, expect: { dot: '0', ma: '1', mb: '1', ang: '90°', cos: '0' } },
      { inputs: { a1: 2, a2: 3, a3: 0, b1: 4, b2: 6, b3: 0 }, expect: { dot: '26', ma: '3.6056', mb: '7.2111', ang: '0°', cos: '1' } },
      { inputs: { a1: 0, a2: 0, a3: 0 }, expect: { dot: '0', ang: 'Undefined (a zero vector)' } },
    ],
  },
  {
    slug: 'area-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Geometry',
    title: 'Area Calculator: Square, Rectangle, Triangle, Circle and More',
    h1: 'Area Calculator',
    metaDescription:
      'Calculate the area of a square, rectangle, triangle, circle, ellipse, trapezoid or parallelogram from its dimensions, with the side of an equal-area square.',
    about:
      'Area measures the flat space inside a shape, in square units. Choose a shape and fill in the dimensions it needs: the first field is the side, base, radius or first base, the second is the second side, height, second semi-axis or second base, and the third is used only by the trapezoid, as its height. The calculator returns the area and the side of a square with the same area, a quick way to picture the size.',
    inputs: [
      sel('shape', 'Shape', 'rectangle', [
        ['square', 'Square (a = side)'],
        ['rectangle', 'Rectangle (a × b)'],
        ['triangle', 'Triangle (a = base, b = height)'],
        ['circle', 'Circle (a = radius)'],
        ['ellipse', 'Ellipse (a, b = semi-axes)'],
        ['trapezoid', 'Trapezoid (a, b = bases, c = height)'],
        ['parallelogram', 'Parallelogram (a = base, b = height)'],
      ]),
      pos('a', 'Dimension a', 8),
      pos('b', 'Dimension b', 5),
      pos('c', 'Dimension c (trapezoid height)', 3),
    ],
    outputs: [out('area', 'Area', true), out('side', 'Side of a square with the same area')],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      const c = toD(i.c);
      const shape = String(i.shape);
      const area =
        shape === 'square'
          ? a.pow(2)
          : shape === 'triangle'
            ? a.mul(b).div(2)
            : shape === 'circle'
              ? PI.mul(a.pow(2))
              : shape === 'ellipse'
                ? PI.mul(a).mul(b)
                : shape === 'trapezoid'
                  ? a.plus(b).mul(c).div(2)
                  : a.mul(b);
      return { area: n4(area), side: n4(area.sqrt()) };
    },
    formulaDescription:
      'Square a². Rectangle and parallelogram a × b. Triangle ½ a b. Circle π a². Ellipse π a b. Trapezoid ½ (a + b) c. Results are in square units of whatever unit you enter.',
    formulaLatex: 'A_{rect} = ab, \\quad A_{circle} = \\pi r^{2}',
    workedExample:
      'A rectangle 8 by 5 has area 40, equal to a square of side 6.3246. A circle of radius 5 has area 78.5398, a trapezoid with bases 6 and 10 and height 4 has area 32.',
    faq: [
      { question: 'Which units does it use?', answer: 'Any: the area comes out in the square of the unit you enter, so metres give square metres.' },
      {
        question: 'What is the difference between area and perimeter?',
        answer: 'Area is the space inside, in square units; perimeter is the distance around the edge, in plain length units.',
      },
      {
        question: 'Where are the single-shape pages?',
        answer: 'The square, rectangle, triangle, circle, trapezoid and other pages also give perimeters and diagonals.',
      },
    ],
    scenarios: varied(
      'area-calculator',
      12,
      [
        { name: 'a', lo: 1.5, hi: 90, step: 0.5 },
        { name: 'b', lo: 1.5, hi: 90, step: 0.5 },
        { name: 'c', lo: 1.5, hi: 40, step: 0.5 },
      ],
      [{ name: 'shape', options: ['square', 'rectangle', 'triangle', 'circle', 'ellipse', 'trapezoid', 'parallelogram'] }],
      (v) => `${v.shape} ${v.a} ${v.b} ${v.c}`,
    ),
    introOutputs: ['area'],
    relatedSlugs: ['rectangle-area-perimeter-calculator', 'circle-area-circumference-calculator', 'triangle-area-calculator'],
    checks: [
      { inputs: {}, expect: { area: '40', side: '6.3246' } },
      { inputs: { shape: 'circle', a: 5 }, expect: { area: '78.5398', side: '8.8623' } },
      { inputs: { shape: 'triangle', a: 9, b: 4 }, expect: { area: '18', side: '4.2426' } },
      { inputs: { shape: 'trapezoid', a: 6, b: 10, c: 4 }, expect: { area: '32', side: '5.6569' } },
      { inputs: { shape: 'ellipse', a: 5, b: 3 }, expect: { area: '47.1239', side: '6.8647' } },
      { inputs: { shape: 'square', a: 7 }, expect: { area: '49', side: '7' } },
    ],
  },
  {
    slug: 'volume-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Geometry',
    title: 'Volume Calculator: Cube, Cuboid, Cylinder, Cone, Sphere and Pyramid',
    h1: 'Volume Calculator',
    metaDescription: 'Calculate the volume and surface area of a cube, cuboid, cylinder, cone, sphere or square pyramid from its dimensions.',
    about:
      'Volume is the space a solid takes up, in cubic units, and its surface area is the total area of its outside. Pick a solid and fill in the dimensions it uses: a is the side, radius or base, b is the width or height and c is the third edge of a cuboid. Fields a shape does not need are ignored. The page gives the volume and the surface area, useful for tanks, packaging, paint and anything you need to fill or cover.',
    inputs: [
      sel('shape', 'Solid', 'cuboid', [
        ['cube', 'Cube (a = edge)'],
        ['cuboid', 'Cuboid (a × b × c)'],
        ['cylinder', 'Cylinder (a = radius, b = height)'],
        ['cone', 'Cone (a = radius, b = height)'],
        ['sphere', 'Sphere (a = radius)'],
        ['pyramid', 'Square pyramid (a = base edge, b = height)'],
      ]),
      pos('a', 'Dimension a', 4),
      pos('b', 'Dimension b', 3),
      pos('c', 'Dimension c (cuboid)', 5),
    ],
    outputs: [out('vol', 'Volume', true), out('surf', 'Surface area')],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      const c = toD(i.c);
      const shape = String(i.shape);
      let v: Dec;
      let s: Dec;
      if (shape === 'cube') {
        v = a.pow(3);
        s = a.pow(2).mul(6);
      } else if (shape === 'cylinder') {
        v = PI.mul(a.pow(2)).mul(b);
        s = PI.mul(2).mul(a).mul(a.plus(b));
      } else if (shape === 'cone') {
        v = PI.mul(a.pow(2)).mul(b).div(3);
        s = PI.mul(a).mul(a.plus(a.pow(2).plus(b.pow(2)).sqrt()));
      } else if (shape === 'sphere') {
        v = PI.mul(4).mul(a.pow(3)).div(3);
        s = PI.mul(4).mul(a.pow(2));
      } else if (shape === 'pyramid') {
        v = a.pow(2).mul(b).div(3);
        s = a.pow(2).plus(a.mul(2).mul(a.pow(2).div(4).plus(b.pow(2)).sqrt()));
      } else {
        v = a.mul(b).mul(c);
        s = a.mul(b).plus(b.mul(c)).plus(a.mul(c)).mul(2);
      }
      return { vol: n4(v), surf: n4(s) };
    },
    formulaDescription:
      'Cube a³; cuboid a b c; cylinder π r² h; cone ⅓ π r² h; sphere ⁴⁄₃ π r³; square pyramid ⅓ a² h. Surface areas: 6a²; 2(ab + bc + ac); 2πr(r + h); πr(r + √(r² + h²)); 4πr²; a² + 2a√(a²/4 + h²).',
    formulaLatex: 'V_{sphere} = \\tfrac{4}{3}\\pi r^{3}',
    workedExample:
      'A cuboid 4 × 3 × 5 has volume 60 and surface area 94. A sphere of radius 6 holds 904.7787 cubic units and has a surface of 452.3893; a cone of radius 3 and height 4 has volume 37.6991.',
    faq: [
      { question: 'How do I convert to litres?', answer: 'If the dimensions are in decimetres the volume is in litres; one cubic metre is 1,000 litres.' },
      {
        question: 'Why is a cone a third of a cylinder?',
        answer: 'A cone of the same base and height holds exactly one third of the volume, as does a pyramid compared with a prism.',
      },
      { question: 'What is the surface area for?', answer: 'The material needed to cover the solid, such as paint, wrapping or sheet metal.' },
    ],
    scenarios: varied(
      'volume-calculator',
      12,
      [
        { name: 'a', lo: 1.5, hi: 40, step: 0.5 },
        { name: 'b', lo: 1.5, hi: 40, step: 0.5 },
        { name: 'c', lo: 1.5, hi: 40, step: 0.5 },
      ],
      [{ name: 'shape', options: ['cube', 'cuboid', 'cylinder', 'cone', 'sphere', 'pyramid'] }],
      (v) => `${v.shape} ${v.a} ${v.b} ${v.c}`,
    ),
    introOutputs: ['vol'],
    relatedSlugs: ['cylinder-surface-area-calculator', 'cone-surface-area-calculator', 'cubic-yards-calculator'],
    checks: [
      { inputs: {}, expect: { vol: '60', surf: '94' } },
      { inputs: { shape: 'cube', a: 3 }, expect: { vol: '27', surf: '54' } },
      { inputs: { shape: 'cylinder', a: 2, b: 10 }, expect: { vol: '125.6637', surf: '150.7964' } },
      { inputs: { shape: 'cone', a: 3, b: 4 }, expect: { vol: '37.6991', surf: '75.3982' } },
      { inputs: { shape: 'sphere', a: 6 }, expect: { vol: '904.7787', surf: '452.3893' } },
      { inputs: { shape: 'pyramid', a: 6, b: 4 }, expect: { vol: '48', surf: '96' } },
    ],
  },
  {
    slug: 'cube-surface-area-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Surface area',
    title: 'Cube Surface Area Calculator: Area, Volume and Diagonal',
    h1: 'Cube Surface Area Calculator',
    metaDescription: 'Find the total surface area of a cube from its edge length, with the area of one face, the volume and the space diagonal.',
    about:
      'A cube has six identical square faces, so its surface area is six times the area of one face. One measurement is enough: the length of an edge. Enter it to get the total surface area, the area of a single face, the volume and the space diagonal that runs corner to corner through the middle. Use it to work out how much paint, paper or tape covers a box shaped like a cube, such as a gift box or a storage cube.',
    inputs: [pos('a', 'Edge length', 5)],
    outputs: [out('sa', 'Total surface area', true), out('face', 'Area of one face'), out('vol', 'Volume'), out('diag', 'Space diagonal')],
    calculate: (i) => {
      const a = toD(i.a);
      return { sa: n4(a.pow(2).mul(6)), face: n4(a.pow(2)), vol: n4(a.pow(3)), diag: n4(a.mul(new D(3).sqrt())) };
    },
    formulaDescription: 'Surface area = 6a². Face area = a². Volume = a³. Space diagonal = a√3, with a the edge length.',
    formulaLatex: 'S = 6a^{2}',
    workedExample: 'A cube with 5-unit edges: each face is 25, so the surface area is 150, the volume 125 and the space diagonal 8.6603.',
    faq: [
      { question: 'Why six faces?', answer: 'A cube is bounded by three pairs of opposite square faces, top and bottom, front and back, left and right.' },
      { question: 'What happens if the edge doubles?', answer: 'The surface area quadruples and the volume grows eightfold.' },
      { question: 'Is the diagonal the face diagonal?', answer: 'No. The face diagonal is a√2; the space diagonal through the cube is a√3.' },
    ],
    scenarios: varied('cube-surface-area-calculator', 12, [{ name: 'a', lo: 0.7, hi: 120, step: 0.1 }], [], (v) => `edge ${v.a}`),
    introOutputs: ['sa'],
    relatedSlugs: ['cuboid-surface-area-calculator', 'volume-calculator', 'square-area-perimeter-calculator'],
    checks: [
      { inputs: {}, expect: { sa: '150', vol: '125', diag: '8.6603', face: '25' } },
      { inputs: { a: 2.5 }, expect: { sa: '37.5', vol: '15.625', diag: '4.3301', face: '6.25' } },
      { inputs: { a: 12 }, expect: { sa: '864', vol: '1,728' } },
    ],
  },
  {
    slug: 'cuboid-surface-area-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Surface area',
    title: 'Cuboid Surface Area Calculator: Rectangular Prism',
    h1: 'Cuboid Surface Area Calculator',
    metaDescription: 'Calculate the surface area, lateral area, volume and space diagonal of a cuboid (rectangular prism) from its length, width and height.',
    about:
      "A cuboid, or rectangular prism, is a box with three pairs of rectangular faces. Its total surface area adds the six face areas, and the lateral area counts only the four sides, leaving out the top and bottom. Enter the length, width and height to read both areas, the volume and the longest diagonal through the box. It answers practical questions about how much material wraps a parcel, how much paint covers a room's walls and whether a rod fits inside a crate.",
    inputs: [pos('l', 'Length', 6), pos('w', 'Width', 4), pos('h', 'Height', 3)],
    outputs: [out('sa', 'Total surface area', true), out('lat', 'Lateral area (four sides)'), out('vol', 'Volume'), out('diag', 'Space diagonal')],
    calculate: (i) => {
      const l = toD(i.l);
      const w = toD(i.w);
      const h = toD(i.h);
      return {
        sa: n4(l.mul(w).plus(w.mul(h)).plus(l.mul(h)).mul(2)),
        lat: n4(h.mul(l.plus(w)).mul(2)),
        vol: n4(l.mul(w).mul(h)),
        diag: n4(l.pow(2).plus(w.pow(2)).plus(h.pow(2)).sqrt()),
      };
    },
    formulaDescription: 'Surface area = 2(lw + wh + lh). Lateral area = 2h(l + w). Volume = lwh. Space diagonal = √(l² + w² + h²).',
    formulaLatex: 'S = 2(lw + wh + lh)',
    workedExample: 'A 6 × 4 × 3 box: surface area 2(24 + 12 + 18) = 108, lateral area 60, volume 72 and space diagonal 7.8102.',
    faq: [
      { question: 'What is the lateral area?', answer: 'The area of the sides only, excluding the top and bottom faces.' },
      { question: 'Is a cube a cuboid?', answer: 'Yes, a cuboid whose three dimensions are equal.' },
      { question: 'How do I find how much paint a room needs?', answer: 'Use the lateral area for the walls and subtract doors and windows.' },
    ],
    scenarios: varied(
      'cuboid-surface-area-calculator',
      12,
      [
        { name: 'l', lo: 0.6, hi: 60, step: 0.1 },
        { name: 'w', lo: 0.6, hi: 60, step: 0.1 },
        { name: 'h', lo: 0.6, hi: 60, step: 0.1 },
      ],
      [],
      (v) => `box ${v.l} by ${v.w} by ${v.h}`,
    ),
    introOutputs: ['sa'],
    relatedSlugs: ['cube-surface-area-calculator', 'volume-calculator', 'rectangle-area-perimeter-calculator'],
    checks: [
      { inputs: {}, expect: { sa: '108', lat: '60', vol: '72', diag: '7.8102' } },
      { inputs: { l: 10, w: 10, h: 10 }, expect: { sa: '600', lat: '400', vol: '1,000', diag: '17.3205' } },
      { inputs: { l: 2.5, w: 1.5, h: 0.5 }, expect: { sa: '11.5', diag: '2.958' } },
    ],
  },
  {
    slug: 'cylinder-surface-area-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Surface area',
    title: 'Cylinder Surface Area Calculator: Lateral, Base and Total',
    h1: 'Cylinder Surface Area Calculator',
    metaDescription: 'Calculate the total, lateral and base surface area and the volume of a cylinder from its radius and height.',
    about:
      'A cylinder has a curved side that unrolls into a rectangle and two circular ends. The lateral area is the circumference times the height, each end is a circle, and the total surface area adds all three. Enter the radius and the height, in the same unit, to get the lateral area, the area of one base, the total surface area and the volume. It suits pipes, tins, tanks and columns, whenever you need to know how much material covers a round container.',
    inputs: [pos('r', 'Radius', 3), pos('h', 'Height', 10)],
    outputs: [out('sa', 'Total surface area', true), out('lat', 'Lateral area'), out('base', 'Area of one base'), out('vol', 'Volume')],
    calculate: (i) => {
      const r = toD(i.r);
      const h = toD(i.h);
      return { sa: n4(PI.mul(2).mul(r).mul(r.plus(h))), lat: n4(PI.mul(2).mul(r).mul(h)), base: n4(PI.mul(r.pow(2))), vol: n4(PI.mul(r.pow(2)).mul(h)) };
    },
    formulaDescription: 'Lateral area = 2πrh. Base area = πr². Total surface area = 2πr(r + h) = 2πrh + 2πr². Volume = πr²h.',
    formulaLatex: 'S = 2\\pi r(r + h)',
    workedExample: 'A cylinder of radius 3 and height 10: lateral area 188.4956, each base 28.2743, total surface 245.0442 and volume 282.7433.',
    faq: [
      { question: 'What if the cylinder is open at one end?', answer: 'Subtract one base: the surface is the lateral area plus a single πr².' },
      { question: 'How do I use the diameter?', answer: 'Halve it to get the radius before entering it.' },
      {
        question: 'Why does the curved side become a rectangle?',
        answer: 'Cut it lengthways and flatten it: its width is the circumference 2πr and its height is h.',
      },
    ],
    scenarios: varied(
      'cylinder-surface-area-calculator',
      12,
      [
        { name: 'r', lo: 0.4, hi: 40, step: 0.1 },
        { name: 'h', lo: 0.4, hi: 90, step: 0.1 },
      ],
      [],
      (v) => `radius ${v.r} height ${v.h}`,
    ),
    introOutputs: ['sa'],
    relatedSlugs: ['volume-calculator', 'circle-area-circumference-calculator', 'cone-surface-area-calculator'],
    checks: [
      { inputs: {}, expect: { sa: '245.0442', lat: '188.4956', base: '28.2743', vol: '282.7433' } },
      { inputs: { r: 1, h: 1 }, expect: { sa: '12.5664', lat: '6.2832', base: '3.1416', vol: '3.1416' } },
      { inputs: { r: 7.5, h: 20 }, expect: { sa: '1,295.907', vol: '3,534.2917' } },
    ],
  },
  {
    slug: 'cone-surface-area-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Surface area',
    title: 'Cone Surface Area Calculator: Slant Height, Lateral and Total',
    h1: 'Cone Surface Area Calculator',
    metaDescription: 'Calculate the slant height, lateral area, total surface area and volume of a right circular cone from its radius and height.',
    about:
      "A cone's outside is a circular base plus a curved surface that, unrolled, forms a sector of a circle. Its slant height, the distance from the rim to the apex along the surface, comes from the Pythagorean theorem. Enter the radius of the base and the vertical height to get the slant height, the lateral area, the total surface area and the volume. It is the answer for party hats, funnels, traffic cones and the roofs of round towers.",
    inputs: [pos('r', 'Base radius', 3), pos('h', 'Vertical height', 4)],
    outputs: [out('sa', 'Total surface area', true), out('slant', 'Slant height'), out('lat', 'Lateral area'), out('vol', 'Volume')],
    calculate: (i) => {
      const r = toD(i.r);
      const h = toD(i.h);
      const sl = r.pow(2).plus(h.pow(2)).sqrt();
      return { sa: n4(PI.mul(r).mul(r.plus(sl))), slant: n4(sl), lat: n4(PI.mul(r).mul(sl)), vol: n4(PI.mul(r.pow(2)).mul(h).div(3)) };
    },
    formulaDescription: 'Slant height l = √(r² + h²). Lateral area = πrl. Total surface area = πr(r + l). Volume = ⅓πr²h. Right circular cone.',
    formulaLatex: 'S = \\pi r\\left(r + \\sqrt{r^{2} + h^{2}}\\right)',
    workedExample:
      'Radius 3 and height 4 form a 3, 4, 5 triangle, so the slant height is 5. Lateral area 47.1239, total surface 75.3982, volume 37.6991. Radius 5 and height 12 give slant 13.',
    faq: [
      {
        question: 'What is the difference between height and slant height?',
        answer: 'The height is measured straight up from the base centre; the slant height runs along the surface to the rim.',
      },
      { question: 'What if I know the slant height instead?', answer: 'Then the height is √(l² − r²); the Pythagorean theorem calculator will find it.' },
      { question: 'Is a cone a third of a cylinder?', answer: 'In volume yes: a cone has one third the volume of a cylinder with the same base and height.' },
    ],
    scenarios: varied(
      'cone-surface-area-calculator',
      12,
      [
        { name: 'r', lo: 0.4, hi: 30, step: 0.1 },
        { name: 'h', lo: 0.4, hi: 60, step: 0.1 },
      ],
      [],
      (v) => `base radius ${v.r} rising ${v.h}`,
    ),
    introOutputs: ['sa'],
    relatedSlugs: ['cylinder-surface-area-calculator', 'volume-calculator', 'pythagorean-theorem-calculator'],
    checks: [
      { inputs: {}, expect: { sa: '75.3982', slant: '5', lat: '47.1239', vol: '37.6991' } },
      { inputs: { r: 5, h: 12 }, expect: { sa: '282.7433', slant: '13', lat: '204.2035', vol: '314.1593' } },
      { inputs: { r: 1.5, h: 8 }, expect: { sa: '45.4247', slant: '8.1394' } },
    ],
  },
  {
    slug: 'torus-surface-area-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Surface area',
    title: 'Torus Surface Area Calculator: Doughnut and Ring Volume',
    h1: 'Torus Surface Area Calculator',
    metaDescription: 'Calculate the surface area and volume of a torus from the radius of the ring and the radius of the tube.',
    about:
      'A torus is the shape of a doughnut, a lifebuoy or an inner tube: a circle of radius r swept around a larger circle of radius R. The two radii are all you need. Enter the major radius R, from the centre of the whole ring to the middle of the tube, and the minor radius r of the tube itself, which must be smaller than R. You receive the surface area and the volume, which both follow from the lengths of the paths the tube sweeps out.',
    inputs: [pos('R', 'Major radius R (centre to middle of the tube)', 6), pos('r', 'Minor radius r (radius of the tube)', 1.5)],
    outputs: [out('sa', 'Surface area', true), out('vol', 'Volume')],
    calculate: (i) => {
      const R = toD(i.R);
      const r = toD(i.r);
      if (r.gte(R)) return { sa: 'The tube radius must be smaller than the ring radius', vol: '' };
      return { sa: n4(PI.pow(2).mul(4).mul(R).mul(r)), vol: n4(PI.pow(2).mul(2).mul(R).mul(r.pow(2))) };
    },
    formulaDescription:
      "Surface area = 4π² R r. Volume = 2π² R r². Both come from Pappus's theorems: the tube's circumference (or area) times the length of the path its centre travels, 2πR.",
    formulaLatex: 'S = 4\\pi^{2}Rr, \\quad V = 2\\pi^{2}Rr^{2}',
    workedExample: 'A ring with R = 6 and a tube of r = 1.5: S = 4π² × 6 × 1.5 = 355.3058 and V = 2π² × 6 × 2.25 = 266.4793.',
    faq: [
      { question: 'Why must r be less than R?', answer: 'If the tube were as wide as the ring the hole would vanish and the surface would cross itself.' },
      {
        question: "What is Pappus's theorem?",
        answer:
          'The area of a surface of revolution is the length of the curve times the distance its centroid travels; the volume uses the area of the shape.',
      },
      { question: 'Is it the same as a doughnut?', answer: 'Mathematically yes: a torus is the ideal surface of a ring doughnut.' },
    ],
    scenarios: varied(
      'torus-surface-area-calculator',
      12,
      [
        { name: 'R', lo: 2, hi: 80, step: 0.5 },
        { name: 'r', lo: 0.3, hi: 1.9, step: 0.1 },
      ],
      [],
      (v) => `ring ${v.R} tube ${v.r}`,
    ),
    introOutputs: ['sa'],
    relatedSlugs: ['cylinder-surface-area-calculator', 'volume-calculator', 'circle-area-circumference-calculator'],
    checks: [
      { inputs: {}, expect: { sa: '355.3058', vol: '266.4793' } },
      { inputs: { R: 10, r: 1 }, expect: { sa: '394.7842', vol: '197.3921' } },
      { inputs: { R: 3, r: 3 }, expect: { sa: 'The tube radius must be smaller than the ring radius' } },
      { inputs: { R: 3, r: 3.5 }, expect: { sa: 'The tube radius must be smaller than the ring radius' } },
    ],
  },
  {
    slug: 'cubic-yards-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Volume',
    title: 'Cubic Yards Calculator: Slabs, Beds and Columns With Waste',
    h1: 'Cubic Yards Calculator',
    metaDescription:
      'Calculate cubic yards of concrete, soil, gravel or mulch for a rectangular area or a round column, with a waste allowance and the volume in cubic feet and cubic metres.',
    about:
      'Bulk materials such as concrete, topsoil, gravel and mulch are sold by the cubic yard, but you measure a job in feet and inches. Choose a rectangular slab or bed, or a round column or footing, and enter the length and width in feet (the diameter in the first field for a round one) and the depth in inches. Add a percentage for waste and spillage. You get the volume in cubic yards, with and without the allowance, and in cubic feet and cubic metres.',
    inputs: [
      sel('shape', 'Shape', 'box', [
        ['box', 'Rectangle (length × width × depth)'],
        ['cyl', 'Round (diameter in the first field)'],
      ]),
      pos('L', 'Length, or diameter for round (feet)', 20),
      pos('W', 'Width (feet, ignored for round)', 10),
      pos('D', 'Depth (inches)', 4),
      field('waste', 'Waste allowance (%)', 10, 0, 100),
    ],
    outputs: [out('cy', 'Volume', true), out('with', 'Volume with waste allowance'), out('cuft', 'In cubic feet'), out('m3', 'In cubic metres')],
    calculate: (i) => {
      const L = toD(i.L);
      const depth = toD(i.D).div(12);
      const cuft = String(i.shape) === 'cyl' ? PI.mul(L.div(2).pow(2)).mul(depth) : L.mul(toD(i.W)).mul(depth);
      const cy = cuft.div(27);
      return {
        cy: `${fmtNumber(cy, 3)} cubic yards`,
        with: `${fmtNumber(cy.mul(new D(1).plus(toD(i.waste).div(100))), 3)} cubic yards`,
        cuft: `${fmtNumber(cuft, 2)} cubic feet`,
        m3: `${fmtNumber(cuft.mul('0.028316846592'), 3)} cubic metres`,
      };
    },
    formulaDescription:
      'Cubic feet = length × width × depth ÷ 12 (depth in inches), or π (d ÷ 2)² × depth ÷ 12 for a round shape. Cubic yards = cubic feet ÷ 27. One cubic foot is exactly 0.028316846592 m³. Add the waste percentage on top.',
    formulaLatex: 'V_{yd^{3}} = \\dfrac{L \\cdot W \\cdot D/12}{27}',
    workedExample: 'A 20 ft by 10 ft slab, 4 inches deep: 66.67 cubic feet, which is 2.469 cubic yards (2.716 with 10% waste) or 1.888 cubic metres.',
    faq: [
      { question: 'How many cubic feet in a cubic yard?', answer: '27, since a yard is 3 feet and 3 × 3 × 3 = 27.' },
      {
        question: 'How much waste should I allow?',
        answer: 'Commonly 5 to 10 percent for concrete and a little more for loose materials, but it depends on the job.',
      },
      { question: 'Can I turn this into tons?', answer: "Multiply by the material's density, which varies widely; the page gives volume only." },
    ],
    scenarios: varied(
      'cubic-yards-calculator',
      12,
      [
        { name: 'L', lo: 2, hi: 90, step: 0.5 },
        { name: 'W', lo: 2, hi: 60, step: 0.5 },
        { name: 'D', lo: 1, hi: 24, step: 0.5 },
        { name: 'waste', lo: 0, hi: 25, step: 1 },
      ],
      [{ name: 'shape', options: ['box', 'cyl'] }],
      (v) => `${v.shape} ${v.L} ${v.W} ft, ${v.D} in deep, ${v.waste}% extra`,
    ),
    introOutputs: ['cy'],
    relatedSlugs: ['volume-calculator', 'concrete-calculator', 'cylinder-surface-area-calculator'],
    checks: [
      { inputs: {}, expect: { cy: '2.469 cubic yards', with: '2.716 cubic yards', cuft: '66.67 cubic feet', m3: '1.888 cubic metres' } },
      {
        inputs: { L: 12, W: 12, D: 6, waste: 0 },
        expect: { cy: '2.667 cubic yards', with: '2.667 cubic yards', cuft: '72 cubic feet', m3: '2.039 cubic metres' },
      },
      {
        inputs: { shape: 'cyl', L: 3, D: 48, waste: 5 },
        expect: { cy: '1.047 cubic yards', with: '1.1 cubic yards', cuft: '28.27 cubic feet', m3: '0.801 cubic metres' },
      },
      {
        inputs: { L: 100, W: 3, D: 2, waste: 15 },
        expect: { cy: '1.852 cubic yards', with: '2.13 cubic yards', cuft: '50 cubic feet', m3: '1.416 cubic metres' },
      },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
