import { numberField, numberListField, parseNumberList, selectField } from '../lib/calc-utils';
import { D, ONE, ZERO, toD, type Dec } from '../lib/decimal';
import { fmtNumber, fmtPercent } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 20a (statistics): probability of one or two events, percentiles, quartiles, variance, confidence
 * intervals for a mean or a proportion, odds and the p-value of a z-score. Exact decimal arithmetic; the normal
 * distribution uses a series for the error function. Confidence intervals use the normal (z) critical values, which
 * each page says; for small samples a t-based interval is wider. Statistics shows no disclaimer. Tier 2 or 3, so
 * none is live until the cohort gate opens.
 */

const PI = D.acos(-1);
const num = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max }),
});
const pct = (name: string, label: string, def: number) => num(name, `${label} (%)`, def, 0, 100);
const whole = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max, integer: true }),
});
const list = (name: string, label: string, def: string, min: number, max = 2000) => ({
  name,
  label,
  type: 'text' as const,
  default: def,
  validator: numberListField(min, max),
});
const sel = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});
const out = (name: string, label: string, highlight = false) => ({ name, label, format: 'text' as const, ...(highlight ? { highlight: true } : {}) });
const p4 = (x: Dec): string => fmtPercent(x, 4);
const n4 = (x: Dec): string => fmtNumber(x, 4);
const sortedList = (text: unknown): Dec[] => parseNumberList(text).sort((a, b) => a.cmp(b));
/** Linear interpolation between order statistics at a zero-based position. */
const interp = (s: Dec[], pos: Dec): Dec => {
  const lo = Number(pos.floor().toFixed(0));
  if (lo + 1 >= s.length) return s[s.length - 1];
  return s[lo].plus(pos.minus(lo).mul(s[lo + 1].minus(s[lo])));
};
const gcdBig = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
};
const ratio = (a: Dec, b: Dec): string => {
  const k = Math.max(a.decimalPlaces(), b.decimalPlaces());
  const scale = new D(10).pow(k);
  const ia = BigInt(a.mul(scale).toFixed(0));
  const ib = BigInt(b.mul(scale).toFixed(0));
  const g = gcdBig(ia, ib) || 1n;
  return `${ia / g} : ${ib / g}`;
};
/** Error function by its Maclaurin series, accurate to well beyond 6 places for |x| up to about 6. */
const erf = (x: Dec): Dec => {
  let term = x;
  let sum = x;
  const x2 = x.mul(x);
  for (let k = 1; k < 220; k++) {
    term = term.mul(x2).neg().div(k);
    sum = sum.plus(term.div(2 * k + 1));
  }
  return sum.mul(2).div(PI.sqrt());
};
const Z_CRIT: Record<string, string> = { '90': '1.6448536269514722', '95': '1.959963984540054', '99': '2.5758293035489004' };

export const SPECS: Spec[] = [
  {
    slug: 'probability-calculator',
    category: 'statistics',
    tier: 2,
    subCluster: 'Probability',
    title: 'Probability Calculator: A and B, A or B, Neither and At Least One',
    h1: 'Probability Calculator',
    metaDescription:
      'Calculate the probability that two independent events both happen, either happens, exactly one happens or neither does, and the chance of at least one success in repeated trials.',
    about:
      'Probability tells you how likely an event is, from 0 percent (impossible) to 100 percent (certain). When two events do not influence each other, their combined chances follow simple rules: multiply to get both, add and subtract the overlap to get either. Enter the probability of event A and of event B as percentages and, if you wish, a number of repeated trials. The page returns the chance of both, either, exactly one and neither, the chance if the events are mutually exclusive and the chance of at least one success in the trials.',
    inputs: [pct('a', 'Probability of A', 30), pct('b', 'Probability of B', 40), whole('n', 'Number of trials for "at least one"', 5, 1, 1000)],
    outputs: [
      out('and', 'Both A and B (independent)', true),
      out('or', 'A or B (or both)'),
      out('xor', 'Exactly one of A and B'),
      out('neither', 'Neither A nor B'),
      out('mutex', 'A or B if mutually exclusive'),
      out('atleast', 'At least one A in the trials'),
    ],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      const both = a.mul(b).div(100);
      const either = a.plus(b).minus(both);
      return {
        and: p4(both),
        or: p4(either),
        xor: p4(a.plus(b).minus(both.mul(2))),
        neither: p4(new D(100).minus(either)),
        mutex: a.plus(b).lte(100) ? p4(a.plus(b)) : 'Not possible (the probabilities add to more than 100%)',
        atleast: p4(ONE.minus(ONE.minus(a.div(100)).pow(Number(i.n))).mul(100)),
      };
    },
    formulaDescription:
      'Independent events: P(A and B) = P(A) × P(B); P(A or B) = P(A) + P(B) − P(A and B); P(exactly one) = P(A) + P(B) − 2 P(A and B); P(neither) = 1 − P(A or B). Mutually exclusive: P(A or B) = P(A) + P(B). At least one A in n trials: 1 − (1 − P(A))ⁿ.',
    formulaLatex: 'P(A \\cup B) = P(A) + P(B) - P(A)P(B)',
    workedExample:
      'P(A) = 30% and P(B) = 40%, independent: both 12%, either 58%, exactly one 46%, neither 42%. If they were mutually exclusive the chance of either would be 70%. At least one A in 5 trials: 1 − 0.7⁵ = 83.193%.',
    faq: [
      { question: 'What does independent mean?', answer: 'That knowing one event happened tells you nothing about the other, like two separate coin flips.' },
      {
        question: 'What does mutually exclusive mean?',
        answer: 'The events cannot both happen, like rolling a 2 and a 5 on one die; their probabilities simply add.',
      },
      {
        question: 'Why is "at least one" so high after many trials?',
        answer: 'Each trial gives another chance, and it is easier to compute the chance of none and subtract it from one.',
      },
    ],
    scenarios: varied(
      'probability-calculator',
      12,
      [
        { name: 'a', lo: 2, hi: 88, step: 0.5 },
        { name: 'b', lo: 2, hi: 88, step: 0.5 },
        { name: 'n', lo: 2, hi: 60, step: 1 },
      ],
      [],
      (v) => `A ${v.a}% and B ${v.b}% over ${v.n} trials`,
    ),
    introOutputs: ['and', 'or'],
    relatedSlugs: ['odds-calculator', 'p-value-calculator', 'z-score-calculator'],
    checks: [
      { inputs: {}, expect: { and: '12.0000%', or: '58.0000%', xor: '46.0000%', neither: '42.0000%', mutex: '70.0000%', atleast: '83.1930%' } },
      {
        inputs: { a: 50, b: 50, n: 1 },
        expect: { and: '25.0000%', or: '75.0000%', xor: '50.0000%', neither: '25.0000%', mutex: '100.0000%', atleast: '50.0000%' },
      },
      {
        inputs: { a: 80, b: 35, n: 10 },
        expect: {
          and: '28.0000%',
          or: '87.0000%',
          xor: '59.0000%',
          neither: '13.0000%',
          mutex: 'Not possible (the probabilities add to more than 100%)',
          atleast: '100.0000%',
        },
      },
      { inputs: { a: 2, b: 1, n: 100 }, expect: { and: '0.0200%', atleast: '86.7380%' } },
    ],
  },
  {
    slug: 'percentile-calculator',
    category: 'statistics',
    tier: 2,
    subCluster: 'Descriptive statistics',
    title: 'Percentile Calculator: Percentile Rank and Value at a Percentile',
    h1: 'Percentile Calculator',
    metaDescription:
      'Find the percentile rank of a value in a data set, and the value at any percentile using linear interpolation, with the size and range of the data.',
    about:
      'A percentile places a value in a group: being at the 90th percentile means you score higher than about 90 percent of the others. This page answers both directions. Paste your data, then give a value to find its percentile rank, counting ties as half, and a percentile to find the value that sits at that point using linear interpolation between neighbouring data points, the same method as the inclusive percentile function in spreadsheets. It also reports how many numbers you entered and their range.',
    inputs: [
      list('data', 'Data (separate numbers with commas or spaces)', '12, 15, 17, 20, 22, 25, 28, 30, 33, 41', 2),
      num('x', 'Value to rank', 25, -1e12, 1e12),
      num('p', 'Percentile to find (0 to 100)', 90, 0, 100),
    ],
    outputs: [
      out('rank', 'Percentile rank of the value', true),
      out('val', 'Value at that percentile'),
      out('n', 'Number of values'),
      out('range', 'Smallest to largest'),
    ],
    calculate: (i) => {
      const s = sortedList(i.data);
      const x = toD(i.x);
      const n = s.length;
      const below = s.filter((v) => v.lt(x)).length;
      const eq = s.filter((v) => v.eq(x)).length;
      const rank = new D(below).plus(new D(eq).div(2)).div(n).mul(100);
      return {
        rank: fmtPercent(rank, 2),
        val: n4(
          interp(
            s,
            toD(i.p)
              .div(100)
              .mul(n - 1),
          ),
        ),
        n: String(n),
        range: `${n4(s[0])} to ${n4(s[n - 1])}`,
      };
    },
    formulaDescription:
      'Percentile rank = (values below + ½ × values equal) ÷ n × 100. Value at percentile p: sort the data, take position p ÷ 100 × (n − 1) counting from 0 and interpolate linearly between the two surrounding values (the inclusive method).',
    formulaLatex: 'PR = \\dfrac{c_{below} + 0.5\\,c_{equal}}{n} \\times 100',
    workedExample:
      'For 12, 15, 17, 20, 22, 25, 28, 30, 33, 41, the value 25 has 5 below and 1 equal, so its rank is 5.5 ÷ 10 = 55%. The 90th percentile sits at position 8.1, between 33 and 41, which is 33.8.',
    faq: [
      {
        question: 'Is percentile the same as percent?',
        answer: 'No. A score of 80 percent is a mark; the 80th percentile means you did better than about 80 percent of people.',
      },
      {
        question: 'Why do spreadsheets give slightly different answers?',
        answer: 'There are several interpolation conventions; this page uses the inclusive one (PERCENTILE.INC).',
      },
      { question: 'What about ties?', answer: 'Values equal to the one you rank count as half below and half above.' },
    ],
    scenarios: varied(
      'percentile-calculator',
      12,
      [
        { name: 'x', lo: 5, hi: 95, step: 0.5 },
        { name: 'p', lo: 5, hi: 98, step: 1 },
      ],
      [],
      (v) => `rank ${v.x} and find the ${v.p}th percentile`,
    ),
    introOutputs: ['rank', 'val'],
    relatedSlugs: ['quartile-calculator', 'z-score-calculator', 'mean-median-mode-calculator'],
    checks: [
      { inputs: {}, expect: { rank: '55.00%', val: '33.8', n: '10', range: '12 to 41' } },
      { inputs: { data: '5 5 5 8 9', x: 5, p: 50 }, expect: { rank: '30.00%', val: '5', n: '5', range: '5 to 9' } },
      { inputs: { data: '1.5, 2.5, 4, 8', x: 3, p: 25 }, expect: { rank: '50.00%', val: '2.25', n: '4', range: '1.5 to 8' } },
    ],
  },
  {
    slug: 'quartile-calculator',
    category: 'statistics',
    tier: 2,
    subCluster: 'Descriptive statistics',
    title: 'Quartile Calculator: Q1, Median, Q3, IQR and Outliers',
    h1: 'Quartile Calculator',
    metaDescription:
      'Calculate the quartiles Q1, Q2 and Q3 of a data set, the interquartile range, the 1.5 IQR outlier fences and any outliers, with inclusive or exclusive quartile methods.',
    about:
      'Sort a list from smallest to largest and three cut points split it into four equal-sized groups. Those cut points are the quartiles, and the middle one is the median. The distance from the first to the third shows how widely the central half of the numbers is spread, and a common rule flags anything more than one and a half of those distances outside them as an outlier. Paste your values, choose the inclusive spreadsheet-style positions or the exclusive ones, and read all three cut points, the spread, the fences and any stray values.',
    inputs: [
      list('data', 'Data (separate numbers with commas or spaces)', '7, 15, 36, 39, 40, 41, 42, 43, 47, 49', 3),
      sel('method', 'Quartile method', 'inc', [
        ['inc', 'Inclusive (n − 1 positions)'],
        ['exc', 'Exclusive (n + 1 positions)'],
      ]),
    ],
    outputs: [
      out('q1', 'First quartile Q1', true),
      out('q2', 'Median Q2'),
      out('q3', 'Third quartile Q3'),
      out('iqr', 'Interquartile range'),
      out('fence', 'Outlier fences (1.5 × IQR)'),
      out('out', 'Outliers'),
    ],
    calculate: (i) => {
      const s = sortedList(i.data);
      const n = s.length;
      const exc = String(i.method) === 'exc';
      const q = (k: number): Dec | null => {
        if (!exc) return interp(s, new D(k).mul(n - 1).div(4));
        const pos = new D(k).mul(n + 1).div(4);
        if (pos.lt(1) || pos.gt(n)) return null;
        const lo = Number(pos.floor().toFixed(0));
        if (lo >= n) return s[n - 1];
        return s[lo - 1].plus(pos.minus(lo).mul(s[lo].minus(s[lo - 1])));
      };
      const q1 = q(1);
      const q2 = q(2);
      const q3 = q(3);
      if (!q1 || !q2 || !q3) return { q1: 'Needs more data for this method', q2: '', q3: '', iqr: '', fence: '', out: '' };
      const iqr = q3.minus(q1);
      const lo = q1.minus(iqr.mul('1.5'));
      const hi = q3.plus(iqr.mul('1.5'));
      const outs = s.filter((v) => v.lt(lo) || v.gt(hi));
      return { q1: n4(q1), q2: n4(q2), q3: n4(q3), iqr: n4(iqr), fence: `${n4(lo)} to ${n4(hi)}`, out: outs.length ? outs.map(n4).join(', ') : 'None' };
    },
    formulaDescription:
      'Inclusive: the k-th quartile is at zero-based position k ÷ 4 × (n − 1), interpolated. Exclusive: at one-based position k × (n + 1) ÷ 4, which needs enough data. IQR = Q3 − Q1; fences are Q1 − 1.5 IQR and Q3 + 1.5 IQR; values outside are flagged as outliers.',
    formulaLatex: '\\mathrm{IQR} = Q_{3} - Q_{1}',
    workedExample:
      'For 7, 15, 36, 39, 40, 41, 42, 43, 47, 49 (inclusive): Q1 = 36.75, median 40.5, Q3 = 42.75, IQR 6. The fences are 27.75 and 51.75, so 7 and 15 are outliers. The exclusive method gives Q1 = 30.75 and Q3 = 44.',
    faq: [
      {
        question: 'Why do two methods exist?',
        answer: 'There is no single agreed definition of quartiles for finite data, so tools differ; the inclusive method matches most spreadsheets.',
      },
      { question: 'What is an outlier?', answer: 'By the common rule, a value more than 1.5 IQR below Q1 or above Q3.' },
      {
        question: 'What does the IQR show?',
        answer: 'The spread of the middle 50 percent of the data, which, unlike the range, is not distorted by extreme values.',
      },
    ],
    scenarios: [
      ['137, 152, 168, 171, 183, 195, 209, 214, 236, 590', 'inc'],
      ['2.37, 4.12, 4.46, 5.91, 7.03, 9.58, 12.24, 31.65', 'inc'],
      ['618, 621, 634, 659, 677, 681, 702, 716, 852', 'exc'],
      ['1013, 1087, 1154, 1192, 1238, 1403', 'inc'],
      ['3.27, 3.94, 4.18, 4.43, 5.06, 5.29, 9.83', 'exc'],
      ['845, 947, 952, 958, 961, 964, 966, 970, 971, 1195', 'inc'],
      ['0.83, 1.14, 1.32, 1.97, 2.26, 2.41', 'inc'],
      ['2105, 2307, 2451, 2508, 2603, 2751, 2806, 5208', 'exc'],
      ['16, 27, 38, 410, 511, 612, 713, 815, 916, 4140', 'inc'],
      ['722, 751, 793, 817, 846, 881, 904', 'exc'],
      ['143, 179, 192, 228, 231, 267, 301, 313, 339, 354, 389', 'inc'],
      ['5.58, 6.13, 6.47, 7.09, 7.22, 7.96, 8.34, 14.17', 'inc'],
    ].map(([data, method]) => ({ label: `${method} ${data}`, inputs: { data, method } })),
    introOutputs: ['q1', 'iqr'],
    relatedSlugs: ['percentile-calculator', 'variance-calculator', 'mean-median-mode-calculator'],
    checks: [
      { inputs: {}, expect: { q1: '36.75', q2: '40.5', q3: '42.75', iqr: '6', fence: '27.75 to 51.75', out: '7, 15' } },
      { inputs: { method: 'exc' }, expect: { q1: '30.75', q2: '40.5', q3: '44', iqr: '13.25', fence: '10.875 to 63.875', out: '7' } },
      { inputs: { data: '1, 2, 3, 4, 5, 6, 7, 8, 9, 100' }, expect: { q1: '3.25', q2: '5.5', q3: '7.75', iqr: '4.5', fence: '-3.5 to 14.5', out: '100' } },
      { inputs: { data: '3, 6, 9', method: 'exc' }, expect: { q1: '3' } },
    ],
  },
  {
    slug: 'variance-calculator',
    category: 'statistics',
    tier: 2,
    subCluster: 'Descriptive statistics',
    title: 'Variance Calculator: Population and Sample Variance',
    h1: 'Variance Calculator',
    metaDescription:
      'Calculate the population variance and sample variance of a data set, with the mean, both standard deviations and the sum of squared deviations.',
    about:
      'Variance condenses how scattered a set of numbers is into one figure: subtract the mean from every value, square each gap so that negatives cannot cancel positives, then average. Divide by the count when the list is the entire population; divide by one less when it is only a sample drawn from a larger one. Paste your numbers to see the mean, the total of squared gaps, both variances and the matching standard deviations, so you can pick the flavour your homework or analysis calls for.',
    inputs: [list('data', 'Data (separate numbers with commas or spaces)', '4, 8, 6, 5, 3, 7, 9, 5', 1)],
    outputs: [
      out('mean', 'Mean', true),
      out('pvar', 'Population variance (÷ n)'),
      out('svar', 'Sample variance (÷ n − 1)'),
      out('psd', 'Population standard deviation'),
      out('ssd', 'Sample standard deviation'),
      out('ss', 'Sum of squared deviations'),
    ],
    calculate: (i) => {
      const s = parseNumberList(i.data);
      const n = s.length;
      const mean = s.reduce((a, v) => a.plus(v), ZERO).div(n);
      const ss = s.reduce((a, v) => a.plus(v.minus(mean).pow(2)), ZERO);
      const pv = ss.div(n);
      const sv = n > 1 ? ss.div(n - 1) : null;
      return { mean: n4(mean), pvar: n4(pv), svar: sv ? n4(sv) : 'Needs at least 2 values', psd: n4(pv.sqrt()), ssd: sv ? n4(sv.sqrt()) : '', ss: n4(ss) };
    },
    formulaDescription:
      'Population variance σ² = Σ(x − μ)² ÷ n. Sample variance s² = Σ(x − x̄)² ÷ (n − 1). Standard deviation is the square root of the variance. All arithmetic is exact decimal.',
    formulaLatex: 's^{2} = \\dfrac{\\sum (x_{i} - \\bar{x})^{2}}{n - 1}',
    workedExample:
      'For 4, 8, 6, 5, 3, 7, 9, 5: the mean is 5.875 and the sum of squared deviations 28.875. Population variance 3.6094 (σ = 1.8998); sample variance 4.125 (s = 2.031).',
    faq: [
      {
        question: 'Why divide by n − 1 for a sample?',
        answer: 'The sample mean is closer to the sample values than the true mean is, so dividing by n would underestimate the spread; n − 1 corrects that.',
      },
      { question: 'Which should I use?', answer: 'Population if you have every member of the group, sample if the data is only part of a larger group.' },
      {
        question: 'Why squared units?',
        answer: "Variance is in the square of the data's unit; the standard deviation takes the root to return to the original unit.",
      },
    ],
    scenarios: [
      ['4, 8, 6, 5, 3, 7, 9, 5'],
      ['12.53, 14.17, 13.86, 15.29, 12.94'],
      ['10.2, 9.8, 11.04, 9.51, 10.5, 10.1'],
      ['0.421, 0.553, 0.472, 0.618, 0.384'],
      ['7.7, 7.9, 8.3, 9.6, 20.4'],
      ['33.1, 41.7, 29.4, 38.2, 36.8, 40.3'],
      ['1.27, 2.43, 3.61, 4.88, 6.05'],
      ['250.4, 262.9, 241.1, 255.6, 270.3'],
      ['9.35, 12.1, 14.7, 15.2, 18.9, 22.4'],
      ['3.141, 2.718, 1.414, 1.732'],
      ['56.2, 61.5, 58.9, 64.1, 52.7, 60.3'],
      ['18.4, 18.9, 19.6, 21.2, 25.8, 31.5'],
    ].map(([data]) => ({ label: `sample ${data}`, inputs: { data } })),
    introOutputs: ['mean', 'svar'],
    relatedSlugs: ['standard-deviation-calculator', 'quartile-calculator', 'confidence-interval-calculator'],
    checks: [
      { inputs: {}, expect: { mean: '5.875', pvar: '3.6094', svar: '4.125', psd: '1.8998', ssd: '2.031', ss: '28.875' } },
      { inputs: { data: '10, 10, 10' }, expect: { mean: '10', pvar: '0', svar: '0', psd: '0', ssd: '0', ss: '0' } },
      { inputs: { data: '2.5, 3.5, 8, 1' }, expect: { mean: '3.75', pvar: '6.8125', svar: '9.0833', psd: '2.6101', ssd: '3.0139', ss: '27.25' } },
      { inputs: { data: '42' }, expect: { mean: '42', pvar: '0', svar: 'Needs at least 2 values', psd: '0', ssd: '', ss: '0' } },
    ],
  },
  {
    slug: 'confidence-interval-calculator',
    category: 'statistics',
    tier: 2,
    subCluster: 'Inference',
    title: 'Confidence Interval Calculator: Mean or Proportion at 90, 95 or 99%',
    h1: 'Confidence Interval Calculator',
    metaDescription:
      'Calculate the margin of error and the confidence interval for a mean or a proportion at 90%, 95% or 99% confidence using normal (z) critical values.',
    about:
      'A confidence interval gives a range of plausible values for a population figure, based on a sample. Choose whether you are estimating a mean, entering the sample mean, standard deviation and size, or a proportion, entering the sample percentage and size. Pick 90, 95 or 99 percent confidence. The page multiplies the standard error by the critical value to get the margin of error and returns the interval. It uses normal critical values, which suit large samples; for a small sample, a t interval is somewhat wider.',
    inputs: [
      sel('mode', 'Estimating', 'mean', [
        ['mean', 'A mean'],
        ['prop', 'A proportion'],
      ]),
      num('m', 'Sample mean, or sample proportion in %', 52, -1e12, 1e12),
      num('s', 'Sample standard deviation (mean only)', 8, 0, 1e12),
      whole('n', 'Sample size', 36, 2, 1000000000),
      sel('level', 'Confidence level', '95', [
        ['90', '90%'],
        ['95', '95%'],
        ['99', '99%'],
      ]),
    ],
    outputs: [out('range', 'Confidence interval', true), out('marg', 'Margin of error'), out('z', 'Critical value z')],
    calculate: (i) => {
      const z = new D(Z_CRIT[String(i.level)] ?? Z_CRIT['95']);
      const m = toD(i.m);
      const n = toD(i.n);
      if (String(i.mode) === 'prop') {
        const p = m.div(100);
        const marg = z.mul(p.mul(ONE.minus(p)).div(n).sqrt()).mul(100);
        return { marg: fmtPercent(marg, 3), range: `${fmtNumber(m.minus(marg), 3)}% to ${fmtNumber(m.plus(marg), 3)}%`, z: fmtNumber(z, 4) };
      }
      const marg = z.mul(toD(i.s)).div(n.sqrt());
      return { marg: n4(marg), range: `${n4(m.minus(marg))} to ${n4(m.plus(marg))}`, z: fmtNumber(z, 4) };
    },
    formulaDescription:
      'Mean: x̄ ± z × s ÷ √n. Proportion: p̂ ± z × √(p̂(1 − p̂) ÷ n). Critical values z: 1.6449 (90%), 1.9600 (95%), 2.5758 (99%). The normal approximation needs a reasonably large sample and, for a proportion, enough successes and failures.',
    formulaLatex: '\\bar{x} \\pm z\\,\\dfrac{s}{\\sqrt{n}}',
    workedExample:
      'A sample of 36 with mean 52 and standard deviation 8 at 95%: margin = 1.96 × 8 ÷ 6 = 2.6133, so the interval is 49.3867 to 54.6133. A poll of 400 with 45% at 95% has a margin of 4.875 points.',
    faq: [
      {
        question: 'What does 95% confidence mean?',
        answer: 'If you repeated the sampling many times, about 95 percent of the intervals built this way would contain the true value.',
      },
      { question: 'Why is the interval wider at 99%?', answer: 'To be more confident of catching the true value you need a wider net.' },
      { question: 'How do I narrow it?', answer: 'Increase the sample size: the margin shrinks with the square root of n.' },
    ],
    scenarios: varied(
      'confidence-interval-calculator',
      12,
      [
        { name: 'm', lo: 8, hi: 92, step: 0.5 },
        { name: 's', lo: 2, hi: 30, step: 0.5 },
        { name: 'n', lo: 30, hi: 1200, step: 10 },
      ],
      [
        { name: 'mode', options: ['mean', 'prop'] },
        { name: 'level', options: ['90', '95', '99'] },
      ],
      (v) => `${v.mode} ${v.m} (sd ${v.s}) from ${v.n} at ${v.level}%`,
    ),
    introOutputs: ['range'],
    relatedSlugs: ['sample-size-calculator', 'z-score-calculator', 'standard-deviation-calculator'],
    checks: [
      { inputs: {}, expect: { marg: '2.6133', range: '49.3867 to 54.6133', z: '1.96' } },
      { inputs: { m: 72, s: 12, n: 100, level: '99' }, expect: { marg: '3.091', range: '68.909 to 75.091', z: '2.5758' } },
      { inputs: { mode: 'prop', m: 45, n: 400 }, expect: { marg: '4.875%', range: '40.125% to 49.875%', z: '1.96' } },
      { inputs: { mode: 'prop', m: 8, n: 1500, level: '90' }, expect: { marg: '1.152%', range: '6.848% to 9.152%', z: '1.6449' } },
    ],
  },
  {
    slug: 'odds-calculator',
    category: 'statistics',
    tier: 2,
    subCluster: 'Probability',
    title: 'Odds Calculator: Probability to Odds and Back, Decimal and American',
    h1: 'Odds Calculator',
    metaDescription:
      'Convert a probability to odds in favour and against, decimal odds and American odds, or convert odds such as 2 : 3 back to a probability.',
    about:
      'Odds and probability describe the same chance in different ways. A probability of 25 percent is odds of 1 to 3 in favour: one way it happens for every three ways it does not. Betting markets use decimal odds, the payout per unit staked, and American odds with a plus or minus sign. Choose a direction: enter a probability to see all the odds formats, or enter odds in favour as two numbers to find the probability. Ratios are reduced to lowest terms, including decimals.',
    inputs: [
      sel('mode', 'Start from', 'p2o', [
        ['p2o', 'A probability'],
        ['o2p', 'Odds in favour'],
      ]),
      pct('p', 'Probability', 25),
      num('a', 'Odds in favour: for', 2, 0.0001, 1e9),
      num('b', 'Odds in favour: against', 3, 0.0001, 1e9),
    ],
    outputs: [
      out('prob', 'Probability', true),
      out('fav', 'Odds in favour'),
      out('ag', 'Odds against'),
      out('dec', 'Decimal odds'),
      out('us', 'American odds'),
    ],
    calculate: (i) => {
      let p = toD(i.p);
      let fav: string;
      let ag: string;
      if (String(i.mode) === 'o2p') {
        const a = toD(i.a);
        const b = toD(i.b);
        p = a.div(a.plus(b)).mul(100);
        fav = ratio(a, b);
        ag = ratio(b, a);
      } else {
        if (p.lte(0) || p.gte(100)) return { prob: 'Enter a probability above 0% and below 100%', fav: '', ag: '', dec: '', us: '' };
        fav = ratio(p, new D(100).minus(p));
        ag = ratio(new D(100).minus(p), p);
      }
      const us = p.lt(50)
        ? `+${fmtNumber(new D(100).mul(new D(100).minus(p)).div(p), 0)}`
        : p.gt(50)
          ? `-${fmtNumber(new D(100).mul(p).div(new D(100).minus(p)), 0)}`
          : '+100';
      return { prob: p4(p), fav, ag, dec: n4(new D(100).div(p)), us };
    },
    formulaDescription:
      'Odds in favour a : b means probability a ÷ (a + b). Odds against are b : a. Decimal odds = 1 ÷ probability. American odds: +100 × (1 − p) ÷ p for p below 50%, −100 × p ÷ (1 − p) above. Fair odds, with no bookmaker margin.',
    formulaLatex: 'p = \\dfrac{a}{a + b}',
    workedExample:
      'A 25% chance is odds of 1 : 3 in favour, 3 : 1 against, decimal odds of 4 and American +300. Odds of 5 : 1 in favour are a probability of 83.3333%, decimal 1.2, American −500.',
    faq: [
      {
        question: 'What is the difference between odds and probability?',
        answer: 'Probability compares successes with all outcomes; odds compare successes with failures. 1 in 4 is a 25% probability but 1 : 3 odds.',
      },
      {
        question: 'Do bookmaker odds equal true probability?',
        answer: 'No. They build in a margin, so the implied probabilities add to more than 100 percent.',
      },
      { question: 'What does +300 mean?', answer: 'A 100 stake wins 300 profit, which implies a 25% chance; a minus sign shows the stake needed to win 100.' },
    ],
    scenarios: varied(
      'odds-calculator',
      12,
      [
        { name: 'p', lo: 3, hi: 94, step: 0.5 },
        { name: 'a', lo: 1, hi: 14, step: 1 },
        { name: 'b', lo: 1, hi: 14, step: 1 },
      ],
      [{ name: 'mode', options: ['p2o', 'o2p'] }],
      (v) => `${v.mode} ${v.p}% or ${v.a} to ${v.b}`,
    ),
    introOutputs: ['prob', 'fav'],
    relatedSlugs: ['probability-calculator', 'percentage-calculator', 'p-value-calculator'],
    checks: [
      { inputs: {}, expect: { prob: '25.0000%', fav: '1 : 3', ag: '3 : 1', dec: '4', us: '+300' } },
      { inputs: { p: 80 }, expect: { prob: '80.0000%', fav: '4 : 1', ag: '1 : 4', dec: '1.25', us: '-400' } },
      { inputs: { p: 50 }, expect: { prob: '50.0000%', fav: '1 : 1', ag: '1 : 1', dec: '2', us: '+100' } },
      { inputs: { mode: 'o2p', a: 5, b: 1 }, expect: { prob: '83.3333%', fav: '5 : 1', ag: '1 : 5', dec: '1.2', us: '-500' } },
      { inputs: { p: 12.5 }, expect: { prob: '12.5000%', fav: '1 : 7', ag: '7 : 1', dec: '8', us: '+700' } },
    ],
  },
  {
    slug: 'p-value-calculator',
    category: 'statistics',
    tier: 2,
    subCluster: 'Inference',
    title: 'P-Value Calculator: From a Z-Score, One- or Two-Tailed',
    h1: 'P-Value Calculator',
    metaDescription: 'Find the p-value of a z-score for a left-tailed, right-tailed or two-tailed test, and whether it is significant at the 5% and 1% levels.',
    about:
      'A p-value says how surprising your result would be if the null hypothesis were true: the smaller it is, the stronger the evidence against it. For a test statistic that follows the standard normal distribution, the p-value is the area in the tail or tails beyond your z-score. Enter the z-score and choose a two-tailed test, or a left or right tail for a one-sided hypothesis. The page returns the p-value to six places and says whether it falls below the usual significance levels of 5 and 1 percent.',
    inputs: [
      num('z', 'Z-score', 1.96, -8, 8),
      sel('tail', 'Test', 'two', [
        ['two', 'Two-tailed'],
        ['left', 'Left-tailed'],
        ['right', 'Right-tailed'],
      ]),
    ],
    outputs: [out('p', 'P-value', true), out('s5', 'At the 5% level'), out('s1', 'At the 1% level')],
    calculate: (i) => {
      const z = toD(i.z);
      const x = z.div(new D(2).sqrt());
      const tail = String(i.tail);
      const p = tail === 'two' ? ONE.minus(erf(x.abs())) : tail === 'left' ? ONE.plus(erf(x)).div(2) : ONE.minus(erf(x)).div(2);
      return {
        p: fmtNumber(p, 6),
        s5: p.lt('0.05') ? 'Significant at the 5% level (p < 0.05)' : 'Not significant at the 5% level (p ≥ 0.05)',
        s1: p.lt('0.01') ? 'Significant at the 1% level (p < 0.01)' : 'Not significant at the 1% level (p ≥ 0.01)',
      };
    },
    formulaDescription:
      'With Φ the standard normal distribution function: left-tailed p = Φ(z), right-tailed p = 1 − Φ(z), two-tailed p = 2 (1 − Φ(|z|)). Φ(z) = ½ (1 + erf(z ÷ √2)), computed from the error-function series. Assumes the test statistic is standard normal; a t-test needs its own distribution.',
    formulaLatex: 'p_{two} = 2\\,(1 - \\Phi(|z|))',
    workedExample:
      'z = 1.96, two-tailed: p = 0.049996, just under 0.05. z = 1.645 right-tailed gives 0.049985. z = −2.576 left-tailed gives 0.004998, significant at both 5% and 1%.',
    faq: [
      { question: 'What is a one-tailed test?', answer: 'One that looks for a difference in a single direction, so only one tail of the distribution counts.' },
      {
        question: 'Does a small p-value prove the effect is real?',
        answer: 'It shows the data are unlikely under the null hypothesis, not that the effect is large or important.',
      },
      {
        question: 'What about a t-test?',
        answer: 'For small samples the test statistic follows a t distribution, which has heavier tails; this page covers the normal case.',
      },
    ],
    scenarios: varied(
      'p-value-calculator',
      12,
      [{ name: 'z', lo: -4.9, hi: 4.9, step: 0.01 }],
      [{ name: 'tail', options: ['two', 'left', 'right'] }],
      (v) => `z ${v.z}, ${v.tail}`,
    ),
    introOutputs: ['p'],
    relatedSlugs: ['z-score-calculator', 'confidence-interval-calculator', 'probability-calculator'],
    checks: [
      { inputs: {}, expect: { p: '0.049996', s5: 'Significant at the 5% level (p < 0.05)', s1: 'Not significant at the 1% level (p ≥ 0.01)' } },
      {
        inputs: { z: 1.645, tail: 'right' },
        expect: { p: '0.049985', s5: 'Significant at the 5% level (p < 0.05)', s1: 'Not significant at the 1% level (p ≥ 0.01)' },
      },
      {
        inputs: { z: -2.576, tail: 'left' },
        expect: { p: '0.004998', s5: 'Significant at the 5% level (p < 0.05)', s1: 'Significant at the 1% level (p < 0.01)' },
      },
      { inputs: { z: 0.5 }, expect: { p: '0.617075', s5: 'Not significant at the 5% level (p ≥ 0.05)', s1: 'Not significant at the 1% level (p ≥ 0.01)' } },
      { inputs: { z: 3.2 }, expect: { p: '0.001374', s5: 'Significant at the 5% level (p < 0.05)', s1: 'Significant at the 1% level (p < 0.01)' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
