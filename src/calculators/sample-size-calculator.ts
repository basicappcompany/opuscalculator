import { numberField, selectField } from '../lib/calc-utils';
import { D, toD } from '../lib/decimal';
import { fmtFixed } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const Z: Record<string, string> = { '90': '1.645', '95': '1.96', '99': '2.576' };

const config: CalculatorConfig = {
  slug: 'sample-size-calculator',
  category: 'statistics',
  tier: 3,
  publish: false,
  title: 'Sample Size Calculator: Survey Respondents Needed for a Margin of Error',
  h1: 'Sample Size Calculator',
  metaDescription:
    "Find how many survey responses you need for a chosen confidence level and margin of error, with an optional finite-population correction. Uses Cochran's formula.",
  intro:
    "To measure a proportion with 95 percent confidence and a margin of error of plus or minus 5 percentage points, you need a sample of 385 people when the population is very large. If your whole population is only 10,000 people, the same precision needs just 370. The calculator uses Cochran's formula, the standard method for surveys that estimate a percentage, and applies the finite-population correction whenever you enter a population size. Choose the confidence level, which is how sure you want to be that the true value lies within your margin; choose the margin of error you can tolerate; and leave the expected proportion at 50 percent unless you already know roughly what answer to expect, because 50 percent is the most cautious choice and gives the largest sample. Remember that the result is the number of completed, usable responses, not the number of invitations, so divide by your expected response rate to decide how many people to contact. The formula assumes a random sample, and it cannot fix bias from who chooses to respond.",
  inputs: [
    {
      name: 'confidence',
      label: 'Confidence level',
      type: 'select',
      default: '95',
      unitOptions: [
        { value: '90', label: '90%' },
        { value: '95', label: '95%' },
        { value: '99', label: '99%' },
      ],
      validator: selectField(['90', '95', '99']),
    },
    { name: 'margin', label: 'Margin of error (± %)', type: 'number', min: 0.1, max: 50, default: 5, validator: numberField({ min: 0.1, max: 50 }) },
    { name: 'proportion', label: 'Expected proportion (%)', type: 'number', min: 1, max: 99, default: 50, validator: numberField({ min: 1, max: 99 }) },
    {
      name: 'population',
      label: 'Population size (0 = very large or unknown)',
      type: 'number',
      min: 0,
      max: 1e10,
      default: 0,
      validator: numberField({ min: 0, max: 1e10, integer: true }),
    },
  ],
  outputs: [
    { name: 'sampleSize', label: 'Sample size needed', format: 'number', highlight: true },
    { name: 'unadjusted', label: 'Sample size for a very large population', format: 'number' },
    { name: 'zScore', label: 'Z-score used', format: 'text' },
  ],
  calculate: (i) => {
    const z = new D(Z[String(i.confidence)] ?? Z['95']);
    const p = toD(i.proportion).div(100);
    const e = toD(i.margin).div(100);
    const n0 = z.pow(2).mul(p).mul(new D(1).minus(p)).div(e.pow(2));
    const population = toD(i.population);
    const n = population.gt(0) ? n0.div(new D(1).plus(n0.minus(1).div(population))) : n0;
    return {
      sampleSize: fmtFixed(n.ceil(), 0),
      unadjusted: fmtFixed(n0.ceil(), 0),
      zScore: z.toString(),
    };
  },
  formulaDescription:
    "Cochran's formula: n₀ = Z² × p × (1 − p) ÷ e², where Z is the z-score for the confidence level (1.645, 1.96 or 2.576 for 90%, 95% or 99%), p is the expected proportion and e is the margin of error, both as decimals. With a known population N the finite-population correction gives n = n₀ ÷ (1 + (n₀ − 1) ÷ N). Results are rounded up to a whole person.",
  workedExample:
    '95% confidence, ±5%, p = 50%: n₀ = 1.96² × 0.5 × 0.5 ÷ 0.05² = 3.8416 × 0.25 ÷ 0.0025 = 384.16, rounded up to 385. For a population of 10,000: n = 384.16 ÷ (1 + 383.16 ÷ 10,000) = 369.98, rounded up to 370.',
  faq: [
    {
      question: 'Why is 50% the default expected proportion?',
      answer:
        'The variance p × (1 − p) is largest when p is 50%, so it produces the biggest, safest sample size. If you know the true share is probably nearer 10% or 90%, a smaller sample will do.',
    },
    {
      question: 'What do confidence level and margin of error mean?',
      answer:
        'The margin of error is how far the survey result may differ from the real value, such as ±5 points. The confidence level is how often a survey designed this way would capture the real value within that margin, such as 95 times in 100.',
    },
    {
      question: 'Does the population size matter?',
      answer:
        'Only when the sample is a large fraction of the population. For populations in the hundreds of thousands, the answer barely changes. For small populations of a few thousand or fewer, the correction reduces the sample you need.',
    },
    {
      question: 'Is the sample size the number of people I should invite?',
      answer:
        'No, it is the number of completed responses you need. Divide it by your expected response rate: if only 20 percent answer, you must invite five times as many people.',
    },
  ],
  relatedSlugs: ['standard-deviation-calculator', 'percentage-calculator', 'cagr-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
