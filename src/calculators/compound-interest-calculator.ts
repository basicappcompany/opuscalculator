import { numberField, selectField } from '../lib/calc-utils';
import { HUNDRED, ONE, toD } from '../lib/decimal';
import { fmtCurrency, fmtPercent } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const config: CalculatorConfig = {
  slug: 'compound-interest-calculator',
  category: 'finance',
  tier: 1,
  publish: true,
  title: 'Compound Interest Calculator: Future Value and Interest Earned',
  h1: 'Compound Interest Calculator',
  metaDescription:
    'See how an investment or savings balance grows with compound interest. Enter the starting amount, rate, years and compounding frequency to get the future value.',
  intro:
    'Put $10,000 into an account that pays 5% a year, compounded monthly, and after 10 years it grows to $16,470.09, which is $6,470.09 of interest earned without adding another cent. That growth is compounding at work: each period the interest is calculated on the original amount plus all the interest already earned, so the balance climbs faster the longer it stays invested. The calculator takes your starting balance, the annual interest rate, the number of years and how often interest is added, then shows the future value, the total interest and the effective annual rate, which is the true yearly growth after compounding. Try changing the frequency to see that monthly compounding beats annual compounding by a small margin, while changing the years or the rate has a much larger effect. It is useful for savings accounts, certificates of deposit and long-term investing projections, but it assumes a constant rate and no deposits, withdrawals, taxes or fees along the way.',
  inputs: [
    {
      name: 'principal',
      label: 'Starting amount ($)',
      type: 'number',
      min: 0,
      max: 1000000000,
      default: 10000,
      validator: numberField({ min: 0, max: 1000000000 }),
    },
    { name: 'annualRate', label: 'Annual interest rate (%)', type: 'number', min: 0, max: 100, default: 5, validator: numberField({ min: 0, max: 100 }) },
    { name: 'years', label: 'Time (years)', type: 'number', min: 0, max: 100, default: 10, validator: numberField({ min: 0, max: 100 }) },
    {
      name: 'compoundsPerYear',
      label: 'Compounded',
      type: 'select',
      default: '12',
      unitOptions: [
        { value: '1', label: 'Annually' },
        { value: '2', label: 'Semi-annually' },
        { value: '4', label: 'Quarterly' },
        { value: '12', label: 'Monthly' },
        { value: '365', label: 'Daily' },
      ],
      validator: selectField(['1', '2', '4', '12', '365']),
    },
  ],
  outputs: [
    { name: 'futureValue', label: 'Future value', format: 'currency', highlight: true },
    { name: 'totalInterest', label: 'Total interest earned', format: 'currency' },
    { name: 'effectiveRate', label: 'Effective annual rate', format: 'percent' },
  ],
  calculate: (i) => {
    const principal = toD(i.principal);
    const n = toD(i.compoundsPerYear);
    const growth = ONE.plus(toD(i.annualRate).div(HUNDRED).div(n));
    const futureValue = principal.mul(growth.pow(n.mul(toD(i.years))));
    return {
      futureValue: fmtCurrency(futureValue),
      totalInterest: fmtCurrency(futureValue.minus(principal)),
      effectiveRate: fmtPercent(growth.pow(n).minus(ONE).mul(HUNDRED), 2),
    };
  },
  formulaDescription:
    'Future value A = P × (1 + r ÷ n)^(n × t), where P is the starting amount, r is the annual rate as a decimal, n is how many times a year interest compounds and t is the number of years. Interest earned = A − P. The effective annual rate is (1 + r ÷ n)^n − 1.',
  scenarios: [
    { label: 'Default: 5% for 10 years', inputs: {} },
    { label: 'Lower rate: 3%', inputs: { annualRate: 3 } },
    { label: 'Higher rate: 7%', inputs: { annualRate: 7 } },
    { label: 'Longer: 20 years', inputs: { years: 20 } },
    { label: 'Longer still: 30 years', inputs: { years: 30 } },
  ],
  assumptions: [
    'The rate stays the same for the whole term, and interest is added n times a year at regular intervals.',
    'No deposits, withdrawals, fees or taxes are included.',
  ],
  references: [
    {
      title: 'How does compound interest work?',
      publisher: 'Consumer Financial Protection Bureau (CFPB)',
      url: 'https://www.consumerfinance.gov/ask-cfpb/what-is-compound-interest-en-1683/',
      accessed: '2026-11-26',
      supports: 'What compound interest is: interest earned on the money saved and on the interest already earned.',
    },
    {
      title: 'Compound Interest (Contemporary Mathematics, section 6.4)',
      publisher: 'OpenStax, Rice University',
      url: 'https://openstax.org/books/contemporary-mathematics/pages/6-4-compound-interest',
      accessed: '2026-11-26',
      supports: 'Computing future value with compound interest, A = P(1 + r/n)^(nt), and the effective annual yield.',
    },
  ],
  workedExample:
    '$10,000 at 5% for 10 years, compounded annually: A = 10,000 × (1.05)^10 = $16,288.95. Compounded quarterly: 10,000 × (1.0125)^40 = $16,436.19. Compounded monthly: 10,000 × (1.0041667)^120 = $16,470.09. More frequent compounding adds a little each time.',
  faq: [
    {
      question: 'What is the difference between simple and compound interest?',
      answer:
        'Simple interest is paid only on the original amount. Compound interest is paid on the original amount plus the interest already added, so the balance grows faster each period. Over long periods the gap becomes very large.',
    },
    {
      question: 'Does compounding more often make a big difference?',
      answer:
        'Only a small one. Going from annual to monthly compounding at 5% adds about 1% to the ending balance over 10 years. The interest rate and the number of years matter far more than the compounding frequency.',
    },
    {
      question: 'What is the effective annual rate?',
      answer:
        'It is the yearly growth rate after compounding is taken into account. A 5% rate compounded monthly has an effective annual rate of about 5.12%, which is the figure to compare when two accounts compound at different frequencies.',
    },
    {
      question: 'Does this include regular deposits, taxes or inflation?',
      answer:
        'No. It assumes one starting deposit, a constant rate and no withdrawals, fees, taxes or inflation. Treat the result as a best-case projection of nominal growth rather than a guaranteed outcome.',
    },
  ],
  relatedSlugs: ['cagr-calculator', 'mortgage-calculator', 'loan-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
