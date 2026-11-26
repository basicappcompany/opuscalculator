import { numberListField, parseNumberList } from '../lib/calc-utils';
import { ZERO } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const NA = 'n/a (needs at least two values)';

const config: CalculatorConfig = {
  slug: 'standard-deviation-calculator',
  category: 'statistics',
  tier: 2,
  publish: false,
  title: 'Standard Deviation Calculator: Population and Sample, with Variance',
  h1: 'Standard Deviation Calculator',
  metaDescription: 'Paste a list of numbers to get the mean, variance and both the population and sample standard deviation. Shows the count and sum too.',
  intro:
    'The data set 2, 4, 4, 4, 5, 5, 7, 9 has a mean of 5, a population standard deviation of 2 and a sample standard deviation of 2.14. Standard deviation measures how spread out a set of numbers is around its average: a small value means the numbers cluster tightly, and a large value means they range widely. Paste or type your numbers, separated by commas, spaces or new lines, and the calculator returns the count, sum, mean, variance and both versions of the standard deviation at once. Use the population version when your list is every value you care about, such as all the scores in one class, and the sample version when your list is only a sample drawn from something larger, such as a survey of 200 customers out of thousands. The sample version divides by one less than the count, which corrects the tendency of a small sample to understate the real spread. Calculations use exact decimal arithmetic, so a list like 0.1, 0.2, 0.3 gives a clean sample deviation of exactly 0.1.',
  inputs: [
    {
      name: 'data',
      label: 'Numbers (separated by commas, spaces or new lines)',
      type: 'text',
      default: '2, 4, 4, 4, 5, 5, 7, 9',
      validator: numberListField(2),
    },
  ],
  outputs: [
    { name: 'count', label: 'Count (n)', format: 'number' },
    { name: 'sum', label: 'Sum', format: 'number' },
    { name: 'mean', label: 'Mean', format: 'number' },
    { name: 'populationSD', label: 'Population standard deviation (σ)', format: 'number', highlight: true },
    { name: 'sampleSD', label: 'Sample standard deviation (s)', format: 'number', highlight: true },
    { name: 'populationVariance', label: 'Population variance (σ²)', format: 'number' },
    { name: 'sampleVariance', label: 'Sample variance (s²)', format: 'number' },
  ],
  calculate: (i) => {
    const xs = parseNumberList(i.data);
    const n = xs.length;
    const sum = xs.reduce((a, b) => a.plus(b), ZERO);
    const mean = n ? sum.div(n) : ZERO;
    const ss = xs.reduce((a, x) => a.plus(x.minus(mean).pow(2)), ZERO);
    const popVar = n ? ss.div(n) : ZERO;
    const sampleVar = n > 1 ? ss.div(n - 1) : null;
    return {
      count: String(n),
      sum: fmtNumber(sum, 6),
      mean: fmtNumber(mean, 6),
      populationSD: fmtNumber(popVar.sqrt(), 4),
      sampleSD: sampleVar ? fmtNumber(sampleVar.sqrt(), 4) : NA,
      populationVariance: fmtNumber(popVar, 6),
      sampleVariance: sampleVar ? fmtNumber(sampleVar, 6) : NA,
    };
  },
  formulaDescription:
    'Mean x̄ = Σx ÷ n. Sum of squares SS = Σ(x − x̄)². Population variance σ² = SS ÷ n and population standard deviation σ = √(SS ÷ n). Sample variance s² = SS ÷ (n − 1) and sample standard deviation s = √(SS ÷ (n − 1)). The sample version needs at least two values.',
  workedExample:
    'Data 2, 4, 4, 4, 5, 5, 7, 9: n = 8, sum = 40, mean = 5. The squared deviations are 9, 1, 1, 1, 0, 0, 4, 16, which add up to SS = 32. Population variance = 32 ÷ 8 = 4, so σ = 2. Sample variance = 32 ÷ 7 = 4.5714, so s = 2.1381.',
  faq: [
    {
      question: 'What is the difference between population and sample standard deviation?',
      answer:
        'Population standard deviation divides the sum of squared deviations by n and is used when you have every value. Sample standard deviation divides by n − 1 and is used when your numbers are a sample of a larger group, which corrects for the sample understating the true spread.',
    },
    {
      question: 'What does a high or low standard deviation mean?',
      answer:
        'A low standard deviation means the values are close to the mean. A high one means they are spread over a wide range. Compare it with the mean: a deviation of 10 is large for values near 20 but tiny for values near 10,000.',
    },
    {
      question: 'How is standard deviation related to variance?',
      answer:
        'Standard deviation is the square root of variance. Variance is in squared units, such as dollars squared, which is awkward to interpret, so the standard deviation brings it back to the original units.',
    },
    {
      question: 'How many numbers do I need?',
      answer:
        'At least two for the sample version. More data gives a more reliable estimate of the spread, and with very few values the result can be misleading.',
    },
  ],
  relatedSlugs: ['sample-size-calculator', 'percentage-calculator', 'cagr-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
