import { numberField } from '../lib/calc-utils';
import { HUNDRED, ONE, toD } from '../lib/decimal';
import { fmtNumber, fmtPercent } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const config: CalculatorConfig = {
  slug: 'cagr-calculator',
  category: 'finance',
  tier: 3,
  publish: false,
  title: 'CAGR Calculator: Compound Annual Growth Rate of an Investment',
  h1: 'CAGR Calculator',
  metaDescription:
    'Find the compound annual growth rate (CAGR) from a beginning value, an ending value and the number of years. Smooths uneven returns into one yearly figure.',
  intro:
    'An investment that grows from $10,000 to $25,000 over 7 years has a compound annual growth rate of 13.99%, meaning it would have to earn that same percentage every single year to end up at the same place. CAGR is the standard way to describe growth over several years with one tidy number, because it ignores the bumps along the way and only looks at where you started, where you finished and how long it took. Enter the beginning value, the ending value and the number of years, and the calculator returns the annualized rate, the total growth as a percentage and the multiple of the original amount. It works for portfolios, company revenue, website traffic, population or anything else that grows over time. Be careful when comparing it with year-by-year returns: CAGR does not show volatility, it does not account for deposits or withdrawals during the period, and a single great or terrible year can hide inside an otherwise ordinary average.',
  inputs: [
    {
      name: 'beginningValue',
      label: 'Beginning value',
      type: 'number',
      min: 0.000001,
      max: 1000000000000,
      default: 10000,
      validator: numberField({ min: 0.000001, max: 1000000000000 }),
    },
    {
      name: 'endingValue',
      label: 'Ending value',
      type: 'number',
      min: 0,
      max: 1000000000000,
      default: 25000,
      validator: numberField({ min: 0, max: 1000000000000 }),
    },
    { name: 'years', label: 'Number of years', type: 'number', min: 0.01, max: 200, default: 7, validator: numberField({ min: 0.01, max: 200 }) },
  ],
  outputs: [
    { name: 'cagr', label: 'Compound annual growth rate', format: 'percent', highlight: true },
    { name: 'totalGrowth', label: 'Total growth', format: 'percent' },
    { name: 'multiple', label: 'Growth multiple', format: 'text' },
  ],
  calculate: (i) => {
    const begin = toD(i.beginningValue);
    const end = toD(i.endingValue);
    const ratio = end.div(begin);
    const cagr = ratio
      .pow(ONE.div(toD(i.years)))
      .minus(ONE)
      .mul(HUNDRED);
    return {
      cagr: fmtPercent(cagr, 2),
      totalGrowth: fmtPercent(ratio.minus(ONE).mul(HUNDRED), 2),
      multiple: `${fmtNumber(ratio, 4)}×`,
    };
  },
  formulaDescription:
    'CAGR = (Ending value ÷ Beginning value)^(1 ÷ years) − 1, shown as a percentage. Total growth = (Ending ÷ Beginning − 1) × 100, and the multiple is Ending ÷ Beginning. Years can be fractional, for example 2.5.',
  workedExample:
    'Growing $1,000 to $2,000 in 2 years: ratio = 2, CAGR = 2^(1 ÷ 2) − 1 = 0.4142, or 41.42% a year. Check: $1,000 × 1.4142 × 1.4142 = $2,000. Total growth is 100% and the multiple is 2×.',
  faq: [
    {
      question: 'What is a good CAGR?',
      answer:
        'It depends on the asset and the period. Broad stock-market indexes have historically returned somewhere in the high single digits to low double digits per year over long periods, but past results do not predict the future. Compare a CAGR with similar investments over the same years.',
    },
    {
      question: 'Why use CAGR instead of the average annual return?',
      answer:
        'An arithmetic average of yearly returns overstates growth when returns swing up and down. CAGR is the single constant rate that links the starting and ending values, so it reflects what actually happened to the money.',
    },
    {
      question: 'Can CAGR be negative?',
      answer:
        'Yes. If the ending value is lower than the beginning value, the ratio is below 1 and the CAGR is negative, showing the average yearly rate of decline.',
    },
    {
      question: 'Does CAGR include money I added or took out?',
      answer:
        'No. It assumes nothing was added or withdrawn between the start and the end. If you made deposits or withdrawals, a money-weighted return such as the internal rate of return is the better measure.',
    },
  ],
  relatedSlugs: ['compound-interest-calculator', 'mortgage-calculator', 'percentage-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
