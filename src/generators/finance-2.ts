import { numberField, selectField } from '../lib/calc-utils';
import { D, ONE, ZERO, toD, type Dec } from '../lib/decimal';
import { fmtCurrency, fmtNumber, fmtPercent, plural } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 18 (finance): the core money maths that Omni and at least two other calculator sites carry and we
 * lacked: future value, annuities, APR, effective and real interest rates, the interest-rate solver, CDs,
 * amortization with extra payments, auto, student and EMI loans, credit cards, depreciation, payback period and
 * covered interest parity. Money is shown with fmtCurrency and labelled `($)`, so the visitor's currency applies.
 * All figures are illustrations at a fixed rate; none is advice, and every page carries the finance disclaimer.
 * Tier 2 or 3, so none is live until the cohort gate opens.
 */

const num = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max }),
});
const dollars = (name: string, label: string, def: number, max = 1e12) => num(name, `${label} ($)`, def, 0, max);
const percent = (name: string, label: string, def: number, max = 100) => num(name, `${label} (%)`, def, 0, max);
const whole = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max, integer: true }),
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

const cents = (x: Dec): Dec => x.toDecimalPlaces(2, D.ROUND_HALF_UP);
/** Level payment on an amortizing loan with periodic rate r over n periods (a 0% loan is P / n). */
const level = (P: Dec, r: Dec, n: number): Dec => (r.isZero() ? P.div(n) : P.mul(r).div(ONE.minus(ONE.plus(r).pow(-n))));
const periods = (years: unknown, m: number): number => Number(toD(years).mul(m).toFixed(0, D.ROUND_HALF_UP));
const yrsMo = (months: number): string => `${plural(Math.floor(months / 12), 'year')} ${plural(months % 12, 'month')}`;
const solve = (f: (x: Dec) => Dec, lo: Dec, hi: Dec): Dec => {
  let a = lo;
  let b = hi;
  for (let k = 0; k < 200; k++) {
    const mid = a.plus(b).div(2);
    if (f(mid).gt(0)) a = mid;
    else b = mid;
  }
  return a.plus(b).div(2);
};
/** Month by month with the payment and each month's interest rounded to the cent, as a lender bills (src/lib/finance.ts). */
const amort = (P: Dec, r: Dec, n: number, extra: Dec) => {
  const payment = cents(level(P, r, n));
  let bal = P;
  let paid = ZERO;
  let months = 0;
  while (bal.gt(0) && months < 2000) {
    months += 1;
    const owed = bal.plus(cents(bal.mul(r)));
    const full = payment.plus(extra);
    const pay = (months === n && extra.isZero()) || full.gt(owed) ? owed : full;
    bal = owed.minus(pay);
    paid = paid.plus(pay);
  }
  return { payment, months, interest: paid.minus(P), paid };
};
/** Present value of n level payments at periodic rate r for the monthly-payment solver: pay × (1 − (1+r)^−n) ÷ r. */
const pvAnnuity = (pay: Dec, r: Dec, n: number): Dec => pay.mul(ONE.minus(ONE.plus(r).pow(-n))).div(r);
const FREQ_OPTIONS: [string, string][] = [
  ['12', 'Monthly'],
  ['4', 'Quarterly'],
  ['2', 'Semi-annually'],
  ['1', 'Annually'],
  ['52', 'Weekly'],
  ['365', 'Daily'],
];
const WHEN_OPTIONS: [string, string][] = [
  ['end', 'End of each period (ordinary)'],
  ['begin', 'Start of each period (annuity due)'],
];

export const SPECS: Spec[] = [
  {
    slug: 'future-value-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Savings and investing',
    title: 'Future Value Calculator: Lump Sum Plus Regular Contributions',
    h1: 'Future Value Calculator',
    metaDescription:
      'Find the future value of a starting amount and regular contributions at a fixed yearly rate, compounded monthly, quarterly, annually or daily.',
    about:
      'Future value tells you what money put away today is worth later if it earns a steady return. This calculator takes a starting amount and a contribution made every compounding period, so you can model monthly saving into a monthly-compounded account, or a single lump sum with no contributions at all. Choose how often interest compounds and whether contributions come at the start or end of each period. You see the future value, the total you put in and the growth.',
    inputs: [
      dollars('pv', 'Starting amount', 10000),
      dollars('p', 'Contribution each period', 200),
      percent('rate', 'Yearly interest rate', 5, 100),
      num('years', 'Number of years', 10, 0, 100),
      sel('m', 'Compounding and contributions', '12', FREQ_OPTIONS),
      sel('when', 'Contributions are made', 'end', WHEN_OPTIONS),
    ],
    outputs: [out('fv', 'Future value', true), out('put', 'Total you put in'), out('int', 'Growth from interest')],
    calculate: (i) => {
      const m = Number(i.m);
      const r = toD(i.rate).div(100).div(m);
      const n = periods(i.years, m);
      const g = ONE.plus(r).pow(n);
      const p = toD(i.p);
      const pv = toD(i.pv);
      const stream = r.isZero()
        ? p.mul(n)
        : p
            .mul(g.minus(1))
            .div(r)
            .mul(String(i.when) === 'begin' ? ONE.plus(r) : ONE);
      const fv = pv.mul(g).plus(stream);
      const put = pv.plus(p.mul(n));
      return { fv: fmtCurrency(fv), put: fmtCurrency(put), int: fmtCurrency(fv.minus(put)) };
    },
    formulaDescription:
      'FV = PV (1 + r)ⁿ + P ((1 + r)ⁿ − 1) ÷ r, with r the yearly rate ÷ periods per year and n the number of periods. For contributions at the start of each period multiply the second term by (1 + r). A 0% rate just adds the amounts. Fixed rate, before tax and fees.',
    formulaLatex: 'FV = PV(1+r)^{n} + P\\dfrac{(1+r)^{n} - 1}{r}',
    workedExample:
      '$10,000 plus $200 a month at 5% for 10 years, compounded monthly: r = 0.004167, n = 120, so FV = 10,000 × 1.6470 + 200 × 155.28 = $47,526.55, of which $34,000 was put in and $13,526.55 is growth.',
    faq: [
      {
        question: 'Does a higher compounding frequency matter much?',
        answer: 'Only slightly: moving from annual to monthly at 5% adds roughly a tenth of a percentage point of yearly growth.',
      },
      { question: 'Is the return guaranteed?', answer: 'No. A fixed rate is an assumption; real investments rise and fall, so try several rates.' },
      { question: 'Why do start-of-period contributions grow more?', answer: 'Each one earns an extra period of interest before the next one is added.' },
    ],
    scenarios: varied(
      'future-value-calculator',
      12,
      [
        { name: 'pv', lo: 500, hi: 94000, step: 50 },
        { name: 'p', lo: 25, hi: 1900, step: 5 },
        { name: 'rate', lo: 1.5, hi: 11.5, step: 0.1 },
        { name: 'years', lo: 2, hi: 38, step: 1 },
      ],
      [{ name: 'm', options: ['12', '4', '2', '1', '52', '365'] }],
      (v) => `${v.pv} plus ${v.p} each period at ${v.rate}% for ${v.years} years, ${v.m} a year`,
    ),
    introOutputs: ['fv'],
    relatedSlugs: ['compound-interest-calculator', 'savings-goal-calculator', 'present-value-calculator'],
    checks: [
      { inputs: {}, expect: { fv: '$47,526.55', put: '$34,000.00', int: '$13,526.55' } },
      { inputs: { pv: 0, p: 100, rate: 0, years: 5, m: '12' }, expect: { fv: '$6,000.00', put: '$6,000.00', int: '$0.00' } },
      { inputs: { pv: 5000, p: 0, rate: 7, years: 20, m: '1' }, expect: { fv: '$19,348.42', put: '$5,000.00', int: '$14,348.42' } },
      { inputs: { pv: 1000, p: 150, rate: 4, years: 3, m: '4', when: 'begin' }, expect: { fv: '$3,048.22', put: '$2,800.00', int: '$248.22' } },
    ],
  },
  {
    slug: 'annuity-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Savings and investing',
    title: 'Annuity Calculator: Present and Future Value of Level Payments',
    h1: 'Annuity Calculator',
    metaDescription:
      'Calculate the present value and future value of a stream of equal payments, as an ordinary annuity or an annuity due, at a fixed yearly rate.',
    about:
      'An annuity is a series of equal payments at regular intervals, such as rent, a pension, a lease or monthly saving. Its present value is the lump sum that would be equivalent to the whole stream today, and its future value is what the payments would grow to by the last one. Enter the payment, the yearly rate, the number of years and how often payments are made, and choose whether they fall at the end of each period or at the start.',
    inputs: [
      dollars('p', 'Payment each period', 1000),
      percent('rate', 'Yearly interest (discount) rate', 6, 100),
      num('years', 'Number of years', 10, 0, 100),
      sel('m', 'Payments per year', '12', FREQ_OPTIONS),
      sel('when', 'Payments are made', 'end', WHEN_OPTIONS),
    ],
    outputs: [out('pv', 'Present value', true), out('fv', 'Future value'), out('tot', 'Sum of the payments')],
    calculate: (i) => {
      const m = Number(i.m);
      const r = toD(i.rate).div(100).div(m);
      const n = periods(i.years, m);
      const p = toD(i.p);
      if (r.isZero()) return { pv: fmtCurrency(p.mul(n)), fv: fmtCurrency(p.mul(n)), tot: fmtCurrency(p.mul(n)) };
      const k = String(i.when) === 'begin' ? ONE.plus(r) : ONE;
      return { pv: fmtCurrency(pvAnnuity(p, r, n).mul(k)), fv: fmtCurrency(p.mul(ONE.plus(r).pow(n).minus(1)).div(r).mul(k)), tot: fmtCurrency(p.mul(n)) };
    },
    formulaDescription:
      'PV = P (1 − (1 + r)⁻ⁿ) ÷ r and FV = P ((1 + r)ⁿ − 1) ÷ r for payments at the end of each period; multiply both by (1 + r) for an annuity due. r is the yearly rate ÷ payments per year, n the number of payments.',
    formulaLatex: 'PV = P\\dfrac{1 - (1+r)^{-n}}{r}',
    workedExample:
      '$1,000 a month for 10 years at 6%: r = 0.5%, n = 120. The present value is $90,073.45 and the future value $163,879.35, against $120,000 of payments.',
    faq: [
      {
        question: 'What is the difference between ordinary and due?',
        answer: 'An ordinary annuity pays at the end of each period; an annuity due pays at the start, so each payment earns one extra period of interest.',
      },
      {
        question: 'What is the present value used for?',
        answer: 'To compare a stream of payments with a lump-sum offer, for example a pension against a cash buyout.',
      },
      {
        question: 'Why is the present value less than the sum of payments?',
        answer: 'Later payments are discounted, because money received sooner can be invested.',
      },
    ],
    scenarios: varied(
      'annuity-calculator',
      12,
      [
        { name: 'p', lo: 75, hi: 4800, step: 5 },
        { name: 'rate', lo: 1.5, hi: 10.5, step: 0.1 },
        { name: 'years', lo: 2, hi: 38, step: 1 },
      ],
      [
        { name: 'm', options: ['12', '4', '2', '1', '52'] },
        { name: 'when', options: ['end', 'begin'] },
      ],
      (v) => `${v.p} ${v.m} a year at ${v.rate}% over ${v.years} years, ${v.when}`,
    ),
    introOutputs: ['pv', 'fv'],
    relatedSlugs: ['present-value-calculator', 'future-value-calculator', 'annuity-payout-calculator'],
    checks: [
      { inputs: {}, expect: { pv: '$90,073.45', fv: '$163,879.35', tot: '$120,000.00' } },
      { inputs: { p: 500, rate: 4, years: 5, m: '12', when: 'begin' }, expect: { pv: '$27,240.03', fv: '$33,259.99', tot: '$30,000.00' } },
      { inputs: { p: 2000, rate: 0, years: 3, m: '1' }, expect: { pv: '$6,000.00', fv: '$6,000.00', tot: '$6,000.00' } },
    ],
  },
  {
    slug: 'annuity-payout-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Retirement',
    title: 'Annuity Payout Calculator: Monthly Income From a Lump Sum',
    h1: 'Annuity Payout Calculator',
    metaDescription:
      'Find the level monthly payment a lump sum can fund over a chosen number of years at a fixed rate, with the total paid out and the interest part.',
    about:
      'If you turn a lump sum into a stream of equal monthly payments that runs out exactly at the end of a set period, the payment depends on the balance, the rate it keeps earning and the number of years. Enter the balance you are drawing from, the yearly rate and the payout period. The calculator returns the monthly income, the total of all the payments and how much of it is interest the balance earned along the way. It is the reverse of saving up.',
    inputs: [dollars('bal', 'Starting balance', 500000), percent('rate', 'Yearly interest rate', 5, 100), num('years', 'Payout period (years)', 25, 1, 80)],
    outputs: [out('pay', 'Monthly payout', true), out('tot', 'Total paid out'), out('int', 'Of which interest')],
    calculate: (i) => {
      const n = periods(i.years, 12);
      const bal = toD(i.bal);
      const pay = level(bal, toD(i.rate).div(1200), n);
      return { pay: fmtCurrency(pay), tot: fmtCurrency(pay.mul(n)), int: fmtCurrency(pay.mul(n).minus(bal)) };
    },
    formulaDescription:
      'Payment = B r ÷ (1 − (1 + r)⁻ⁿ), with B the balance, r the yearly rate ÷ 12 and n the number of months. The balance reaches zero after the last payment. Payments are at the end of each month and the rate is fixed.',
    formulaLatex: 'P = \\dfrac{B\\,r}{1 - (1+r)^{-n}}',
    workedExample:
      '$500,000 at 5% paid out over 25 years: r = 0.4167%, n = 300 and the payment is $2,922.95 a month, $876,885.06 in total, of which $376,885.06 is interest.',
    faq: [
      {
        question: 'What happens at the end of the period?',
        answer: 'The balance is exactly zero, so the payments stop; this is a fixed-term payout, not a lifetime income.',
      },
      { question: 'Does it allow for inflation?', answer: 'No. The payment is level in nominal terms, so its buying power falls over time.' },
      {
        question: 'How is it different from a mortgage payment?',
        answer: 'It is the same arithmetic in reverse: a loan repaid to the lender versus a balance paid out to you.',
      },
    ],
    scenarios: varied(
      'annuity-payout-calculator',
      12,
      [
        { name: 'bal', lo: 20000, hi: 1900000, step: 500 },
        { name: 'rate', lo: 0.5, hi: 8.5, step: 0.1 },
        { name: 'years', lo: 3, hi: 42, step: 1 },
      ],
      [],
      (v) => `${v.bal} at ${v.rate}% for ${v.years} years`,
    ),
    introOutputs: ['pay'],
    relatedSlugs: ['annuity-calculator', 'present-value-calculator', 'loan-calculator'],
    checks: [
      { inputs: {}, expect: { pay: '$2,922.95', tot: '$876,885.06', int: '$376,885.06' } },
      { inputs: { bal: 250000, rate: 0, years: 20 }, expect: { pay: '$1,041.67', tot: '$250,000.00', int: '$0.00' } },
      { inputs: { bal: 1000000, rate: 4.2, years: 30 }, expect: { pay: '$4,890.17', tot: '$1,760,461.83', int: '$760,461.83' } },
    ],
  },
  {
    slug: 'apr-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Loans',
    title: 'APR Calculator: True Cost of a Loan Including Fees',
    h1: 'APR Calculator',
    metaDescription:
      'Calculate the annual percentage rate (APR) of a loan from the amount, the nominal rate, the term and the upfront fees, with the payment and total finance charge.',
    about:
      'The nominal interest rate on a loan leaves out fees, so two loans with the same rate can cost different amounts. The annual percentage rate folds the upfront fees into one yearly figure by finding the rate at which the payments, discounted, equal the money you actually receive. Enter the loan amount, the quoted rate, the number of monthly payments and the fees taken from the loan. You see the APR, the monthly payment and the total finance charge of interest plus fees.',
    inputs: [
      dollars('amt', 'Loan amount', 20000),
      dollars('fees', 'Upfront fees', 600),
      percent('rate', 'Nominal interest rate', 7, 100),
      whole('n', 'Number of monthly payments', 60, 1, 480),
    ],
    outputs: [out('apr', 'APR', true), out('pay', 'Monthly payment'), out('int', 'Total interest'), out('charge', 'Total finance charge (interest + fees)')],
    calculate: (i) => {
      const amt = toD(i.amt);
      const n = Number(i.n);
      const pay = level(amt, toD(i.rate).div(1200), n);
      const net = amt.minus(toD(i.fees));
      if (net.lte(0)) return { apr: 'The fees must be smaller than the loan', pay: '', int: '', charge: '' };
      const monthly = solve((x) => pvAnnuity(pay, x, n).minus(net), new D('1e-12'), ONE);
      return {
        apr: fmtPercent(monthly.mul(1200), 3),
        pay: fmtCurrency(cents(pay)),
        int: fmtCurrency(pay.mul(n).minus(amt)),
        charge: fmtCurrency(pay.mul(n).minus(amt).plus(toD(i.fees))),
      };
    },
    formulaDescription:
      'The monthly payment comes from the nominal rate on the full amount. The APR is the monthly rate x that makes the present value of those payments equal to amount − fees, found by repeated halving, then multiplied by 12. Fixed-rate instalment loan, fees paid upfront from the proceeds.',
    formulaLatex: '\\text{amount} - \\text{fees} = P\\dfrac{1 - (1+x)^{-n}}{x}',
    workedExample:
      '$20,000 at a nominal 7% for 60 months with $600 of fees: the payment is $396.02, interest $3,761.44 and finance charge $4,361.44, which makes the APR 8.286%.',
    faq: [
      {
        question: 'Why is the APR higher than the interest rate?',
        answer: 'Because fees are paid upfront, you borrow less than the loan amount but repay on the full amount, which raises the effective yearly cost.',
      },
      {
        question: 'Is the APR the same as the effective annual rate?',
        answer: 'No. By convention it is a nominal figure (monthly rate × 12); the effective rate also includes compounding.',
      },
      {
        question: 'Which fees count?',
        answer: 'Lenders must include some, such as origination fees, and may exclude others; check the loan disclosure for the exact list.',
      },
    ],
    scenarios: varied(
      'apr-calculator',
      12,
      [
        { name: 'amt', lo: 2500, hi: 94000, step: 100 },
        { name: 'fees', lo: 0, hi: 4500, step: 25 },
        { name: 'rate', lo: 2.5, hi: 17.5, step: 0.1 },
        { name: 'n', lo: 12, hi: 120, step: 6 },
      ],
      [],
      (v) => `${v.amt} with ${v.fees} fees at ${v.rate}% over ${v.n} payments`,
    ),
    introOutputs: ['apr'],
    relatedSlugs: ['loan-calculator', 'effective-interest-rate-calculator', 'interest-rate-calculator'],
    checks: [
      { inputs: {}, expect: { apr: '8.286%', pay: '$396.02', int: '$3,761.44', charge: '$4,361.44' } },
      { inputs: { amt: 10000, fees: 0, rate: 9, n: 36 }, expect: { apr: '9.000%', pay: '$318.00', int: '$1,447.90', charge: '$1,447.90' } },
      { inputs: { amt: 8000, fees: 400, rate: 5, n: 24 }, expect: { apr: '10.077%', pay: '$350.97', int: '$423.31', charge: '$823.31' } },
    ],
  },
  {
    slug: 'effective-interest-rate-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Interest',
    title: 'Effective Interest Rate Calculator: APY From a Nominal Rate',
    h1: 'Effective Interest Rate Calculator',
    metaDescription:
      'Convert a nominal interest rate and compounding frequency into the effective annual rate (APY), with the extra yield and the time to double.',
    about:
      'A nominal rate of 6 percent does not mean you earn exactly 6 percent a year if interest is added more often than once a year. Each credit earns interest itself, so the effective annual rate, also called the annual percentage yield, comes out higher. Enter the quoted rate and how often it compounds, from yearly through daily to continuous. You get the effective rate, how far above the nominal figure it sits and the years money takes to double at that rate.',
    inputs: [
      percent('nom', 'Nominal yearly rate', 6, 100),
      sel('m', 'Compounded', '12', [
        ['1', 'Annually'],
        ['2', 'Semi-annually'],
        ['4', 'Quarterly'],
        ['12', 'Monthly'],
        ['52', 'Weekly'],
        ['365', 'Daily'],
        ['c', 'Continuously'],
      ]),
    ],
    outputs: [out('ear', 'Effective annual rate (APY)', true), out('diff', 'Extra over the nominal rate'), out('dbl', 'Time to double the money')],
    calculate: (i) => {
      const r = toD(i.nom).div(100);
      const ear =
        String(i.m) === 'c'
          ? D.exp(r).minus(1)
          : ONE.plus(r.div(Number(i.m)))
              .pow(Number(i.m))
              .minus(1);
      return { ear: fmtPercent(ear.mul(100), 4), diff: fmtPercent(ear.minus(r).mul(100), 4), dbl: `${fmtNumber(D.ln(2).div(D.ln(ONE.plus(ear))), 2)} years` };
    },
    formulaDescription:
      'Effective rate = (1 + r ÷ m)ᵐ − 1 for m compounding periods a year, or eʳ − 1 for continuous compounding, with r the nominal rate as a decimal. Time to double = ln 2 ÷ ln(1 + effective rate).',
    formulaLatex: 'r_{eff} = \\left(1 + \\dfrac{r}{m}\\right)^{m} - 1',
    workedExample:
      '6% compounded monthly: (1 + 0.06 ÷ 12)¹² − 1 = 6.1678%, which is 0.1678 points above the nominal rate, and money doubles in 11.58 years. 12% compounded daily is 12.7475%.',
    faq: [
      {
        question: 'What is APY?',
        answer: 'The annual percentage yield is the effective annual rate on a deposit; banks must quote it so accounts can be compared.',
      },
      {
        question: 'Why does more frequent compounding help?',
        answer: 'Interest is added sooner and then earns interest itself, but the gain shrinks quickly: continuous compounding is only slightly above daily.',
      },
      { question: 'Is APR the same?', answer: 'No. APR is a nominal rate that ignores compounding; APY includes it.' },
    ],
    scenarios: varied(
      'effective-interest-rate-calculator',
      12,
      [{ name: 'nom', lo: 0.6, hi: 28.4, step: 0.1 }],
      [{ name: 'm', options: ['1', '2', '4', '12', '52', '365', 'c'] }],
      (v) => `${v.nom}% nominal, ${v.m} a year`,
    ),
    introOutputs: ['ear'],
    relatedSlugs: ['compound-interest-calculator', 'real-interest-rate-calculator', 'rule-of-72-calculator'],
    checks: [
      { inputs: {}, expect: { ear: '6.1678%', diff: '0.1678%', dbl: '11.58 years' } },
      { inputs: { nom: 12, m: '365' }, expect: { ear: '12.7475%', diff: '0.7475%', dbl: '5.78 years' } },
      { inputs: { nom: 5, m: 'c' }, expect: { ear: '5.1271%', diff: '0.1271%', dbl: '13.86 years' } },
      { inputs: { nom: 8, m: '1' }, expect: { ear: '8.0000%', diff: '0.0000%', dbl: '9.01 years' } },
    ],
  },
  {
    slug: 'real-interest-rate-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Interest',
    title: 'Real Interest Rate Calculator: Return After Inflation',
    h1: 'Real Interest Rate Calculator',
    metaDescription:
      'Calculate the real interest rate from a nominal rate and the inflation rate with the exact Fisher equation, and compare it with the simple subtraction.',
    about:
      'A nominal return says how fast your balance grows in money terms, but prices rise too, so what matters for buying power is the real rate. The exact relationship, named for the economist Irving Fisher, divides one plus the nominal rate by one plus inflation. A quick shortcut simply subtracts inflation from the nominal rate, which is close when rates are low. Enter the nominal rate and the inflation rate to see the exact real rate, the shortcut and the small gap between them.',
    inputs: [percent('nom', 'Nominal interest rate', 6, 100), num('inf', 'Inflation rate (%)', 3.5, -50, 100)],
    outputs: [
      out('real', 'Real interest rate (exact)', true),
      out('approx', 'Simple estimate (nominal − inflation)'),
      out('gap', 'Difference between the two'),
    ],
    calculate: (i) => {
      const nom = toD(i.nom);
      const inf = toD(i.inf);
      const exact = ONE.plus(nom.div(100))
        .div(ONE.plus(inf.div(100)))
        .minus(1)
        .mul(100);
      return { real: fmtPercent(exact, 3), approx: fmtPercent(nom.minus(inf), 3), gap: fmtPercent(nom.minus(inf).minus(exact), 3) };
    },
    formulaDescription:
      'Real rate = (1 + nominal) ÷ (1 + inflation) − 1 (the Fisher equation). The estimate is nominal − inflation. Both rates are yearly and the result is the yearly change in buying power.',
    formulaLatex: '1 + r_{real} = \\dfrac{1 + r_{nominal}}{1 + \\pi}',
    workedExample:
      'A 6% nominal rate with 3.5% inflation: 1.06 ÷ 1.035 − 1 = 2.415%, against the quick estimate of 2.5%. If inflation is 5% and the rate 3%, the real rate is −1.905%: buying power falls.',
    faq: [
      { question: 'Can the real rate be negative?', answer: 'Yes, whenever inflation exceeds the nominal rate; your balance grows but buys less each year.' },
      {
        question: 'Which inflation should I use?',
        answer: 'A forecast or a recent average of consumer price inflation; the answer is only as good as that assumption.',
      },
      {
        question: 'When does the simple subtraction fail?',
        answer: 'At high rates or high inflation, where the exact formula and the shortcut diverge noticeably.',
      },
    ],
    scenarios: varied(
      'real-interest-rate-calculator',
      12,
      [
        { name: 'nom', lo: 0.4, hi: 18.6, step: 0.1 },
        { name: 'inf', lo: 0.3, hi: 14.7, step: 0.1 },
      ],
      [],
      (v) => `nominal ${v.nom}% with ${v.inf}% inflation`,
    ),
    introOutputs: ['real'],
    relatedSlugs: ['inflation-calculator', 'effective-interest-rate-calculator', 'compound-interest-calculator'],
    checks: [
      { inputs: {}, expect: { real: '2.415%', approx: '2.500%', gap: '0.085%' } },
      { inputs: { nom: 3, inf: 5 }, expect: { real: '-1.905%', approx: '-2.000%', gap: '-0.095%' } },
      { inputs: { nom: 10, inf: 2 }, expect: { real: '7.843%', approx: '8.000%', gap: '0.157%' } },
    ],
  },
  {
    slug: 'interest-rate-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Loans',
    title: 'Interest Rate Calculator: Find the Rate of a Loan From Its Payment',
    h1: 'Interest Rate Calculator',
    metaDescription: 'Work out the interest rate of an instalment loan from the amount borrowed, the monthly payment and the number of payments.',
    about:
      'Sometimes you know what you borrowed, what you pay each month and for how long, but not the rate the lender is charging. The rate hides inside the payment formula and cannot be written down directly, so this page finds it by repeated halving until the payments, discounted at that rate, match the loan. Enter the amount, the monthly payment and the number of payments to get the monthly rate, the yearly rate and the total interest you will pay.',
    inputs: [dollars('amt', 'Amount borrowed', 20000), dollars('pay', 'Monthly payment', 400), whole('n', 'Number of monthly payments', 60, 1, 600)],
    outputs: [out('rate', 'Monthly interest rate', true), out('apr', 'Yearly rate (monthly × 12)'), out('int', 'Total interest')],
    calculate: (i) => {
      const amt = toD(i.amt);
      const pay = toD(i.pay);
      const n = Number(i.n);
      if (pay.mul(n).lte(amt)) return { rate: 'The payments must total more than the loan', apr: '', int: '' };
      const x = solve((r) => pvAnnuity(pay, r, n).minus(amt), new D('1e-12'), ONE);
      return { rate: `${fmtPercent(x.mul(100), 4)} a month`, apr: fmtPercent(x.mul(1200), 3), int: fmtCurrency(pay.mul(n).minus(amt)) };
    },
    formulaDescription:
      'The rate r solves amount = payment × (1 − (1 + r)⁻ⁿ) ÷ r. There is no closed form, so the page narrows r by repeated halving to many digits. The yearly rate is the monthly rate × 12. Level monthly payments, no fees.',
    formulaLatex: 'L = P\\dfrac{1 - (1+r)^{-n}}{r}',
    workedExample:
      '$20,000 repaid with 60 payments of $400: the monthly rate is 0.6183%, a yearly rate of 7.420%, and the interest totals $4,000. $10,000 repaid with 36 payments of $322.67 is exactly 10.000%.',
    faq: [
      {
        question: 'What if the payments do not exceed the loan?',
        answer: 'Then the rate would be zero or negative, and the page asks you to check the numbers.',
      },
      { question: 'Does it include fees?', answer: 'No. If there were upfront fees, use the APR calculator, which finds the all-in rate.' },
      {
        question: 'Why is it not simply interest ÷ loan?',
        answer: 'Because you repay the principal gradually, the average balance is much smaller than the original loan.',
      },
    ],
    scenarios: varied(
      'interest-rate-calculator',
      12,
      [
        { name: 'amt', lo: 3000, hi: 96000, step: 100 },
        { name: 'pay', lo: 120, hi: 2900, step: 5 },
        { name: 'n', lo: 12, hi: 120, step: 6 },
      ],
      [],
      (v) => `${v.amt} repaid by ${v.pay} over ${v.n} payments`,
    ),
    introOutputs: ['rate', 'apr'],
    relatedSlugs: ['loan-calculator', 'apr-calculator', 'auto-loan-calculator'],
    checks: [
      { inputs: {}, expect: { rate: '0.6183% a month', apr: '7.420%', int: '$4,000.00' } },
      { inputs: { amt: 10000, pay: 322.67, n: 36 }, expect: { rate: '0.8333% a month', apr: '10.000%', int: '$1,616.12' } },
      { inputs: { amt: 5000, pay: 100, n: 40 }, expect: { rate: 'The payments must total more than the loan' } },
    ],
  },
  {
    slug: 'cd-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Savings and investing',
    title: 'CD Calculator: Certificate of Deposit Maturity Value',
    h1: 'CD Calculator',
    metaDescription:
      'Calculate the maturity value, interest earned and APY of a certificate of deposit from the deposit, the rate, the compounding and the term in months.',
    about:
      'A certificate of deposit locks money for a fixed term at a fixed rate, and the interest is added at set intervals. Enter your deposit, the quoted rate, how often the bank compounds it and the term in months. The calculator returns the balance at maturity, the interest earned and the annual percentage yield, which makes CDs with different compounding comparable. Banks may charge a penalty for withdrawing early; that is not included here.',
    inputs: [
      dollars('dep', 'Deposit', 10000),
      percent('rate', 'Interest rate', 4.5, 100),
      sel('m', 'Interest is compounded', '365', [
        ['365', 'Daily'],
        ['12', 'Monthly'],
        ['4', 'Quarterly'],
        ['1', 'Annually'],
      ]),
      num('months', 'Term (months)', 12, 1, 600),
    ],
    outputs: [out('mat', 'Balance at maturity', true), out('int', 'Interest earned'), out('apy', 'APY')],
    calculate: (i) => {
      const m = Number(i.m);
      const r = toD(i.rate).div(100);
      const per = ONE.plus(r.div(m));
      const mat = toD(i.dep).mul(per.pow(toD(i.months).div(12).mul(m)));
      return { mat: fmtCurrency(mat), int: fmtCurrency(mat.minus(toD(i.dep))), apy: fmtPercent(per.pow(m).minus(1).mul(100), 3) };
    },
    formulaDescription:
      'Maturity = deposit × (1 + r ÷ m)^(m × years), with m the compounding periods per year and years = months ÷ 12. APY = (1 + r ÷ m)ᵐ − 1. Interest is left in the account; no early-withdrawal penalty or tax is modelled.',
    formulaLatex: 'A = P\\left(1 + \\dfrac{r}{m}\\right)^{mt}',
    workedExample:
      '$10,000 at 4.5% compounded daily for 12 months: A = 10,000 × (1 + 0.045 ÷ 365)³⁶⁵ = $10,460.25, so $460.25 of interest and an APY of 4.602%.',
    faq: [
      {
        question: 'What is the difference between rate and APY?',
        answer: 'The rate is the quoted figure; APY includes the effect of compounding, so it is higher when interest is added more than once a year.',
      },
      { question: 'Is the interest taxed?', answer: 'In many countries yes, so the after-tax return is lower than shown.' },
      { question: 'What if I withdraw early?', answer: 'Most CDs charge a penalty, often several months of interest, which this page does not model.' },
    ],
    scenarios: varied(
      'cd-calculator',
      12,
      [
        { name: 'dep', lo: 500, hi: 96000, step: 50 },
        { name: 'rate', lo: 0.6, hi: 6.4, step: 0.05 },
        { name: 'months', lo: 3, hi: 60, step: 1 },
      ],
      [{ name: 'm', options: ['365', '12', '4', '1'] }],
      (v) => `${v.dep} at ${v.rate}% for ${v.months} months, ${v.m} a year`,
    ),
    introOutputs: ['mat'],
    relatedSlugs: ['compound-interest-calculator', 'effective-interest-rate-calculator', 'savings-goal-calculator'],
    checks: [
      { inputs: {}, expect: { mat: '$10,460.25', int: '$460.25', apy: '4.602%' } },
      { inputs: { dep: 25000, rate: 5, m: '12', months: 24 }, expect: { mat: '$27,623.53', int: '$2,623.53', apy: '5.116%' } },
      { inputs: { dep: 5000, rate: 3.2, m: '1', months: 6 }, expect: { mat: '$5,079.37', int: '$79.37', apy: '3.200%' } },
    ],
  },
  {
    slug: 'amortization-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Loans',
    title: 'Amortization Calculator With Extra Payments: Payoff Time and Interest Saved',
    h1: 'Amortization Calculator',
    metaDescription:
      'See how an extra monthly payment shortens a loan: the payment, the new payoff time, the total interest and the interest saved compared with paying only the minimum.',
    about:
      'An amortizing loan is repaid in equal instalments, and in the early years most of each instalment is interest. Adding a little extra every month goes straight to principal, so the balance falls faster, interest shrinks and the loan ends years sooner. Enter the loan, the rate, the term and any extra monthly payment. The page builds the schedule month by month, rounding to the cent as a lender does, and reports the payment, the time to pay off, the interest paid and what the extra saved.',
    inputs: [
      dollars('P', 'Loan amount', 250000),
      percent('rate', 'Interest rate', 6.5, 100),
      whole('years', 'Loan term (years)', 30, 1, 50),
      dollars('extra', 'Extra payment each month', 200),
    ],
    outputs: [
      out('pay', 'Required monthly payment', true),
      out('time', 'Time to pay off'),
      out('int', 'Total interest paid'),
      out('saved', 'Interest saved by the extra payments'),
      out('total', 'Total paid'),
    ],
    calculate: (i) => {
      const P = toD(i.P);
      const n = Number(i.years) * 12;
      const r = toD(i.rate).div(1200);
      const withExtra = amort(P, r, n, toD(i.extra));
      const base = amort(P, r, n, ZERO);
      return {
        pay: fmtCurrency(withExtra.payment),
        time: yrsMo(withExtra.months),
        int: fmtCurrency(withExtra.interest),
        saved: fmtCurrency(base.interest.minus(withExtra.interest)),
        total: fmtCurrency(withExtra.paid),
      };
    },
    formulaDescription:
      'The payment is P r ÷ (1 − (1 + r)⁻ⁿ), rounded to the cent. Each month the interest (balance × r, rounded to the cent) is added, the payment plus the extra is taken off, and the last payment is trimmed to clear the balance. Fixed rate, level payments, no fees or insurance.',
    formulaLatex: 'M = \\dfrac{P\\,r}{1 - (1+r)^{-n}}',
    workedExample:
      '$250,000 at 6.5% over 30 years has a payment of $1,580.17. Paying $200 extra every month clears the loan in 22 years 1 month, with $221,243.14 of interest, which saves $97,618.44.',
    faq: [
      {
        question: 'Why do extra payments save so much?',
        answer: 'Each extra dollar removes principal at once, so every later month charges interest on a smaller balance.',
      },
      {
        question: 'Do I pay a penalty for paying extra?',
        answer: 'Some loans charge one; check the terms. Many mortgages allow extra payments without a fee.',
      },
      { question: 'Does it include taxes or insurance?', answer: 'No, only principal and interest. Taxes, insurance and fees raise the real monthly cost.' },
    ],
    scenarios: varied(
      'amortization-calculator',
      12,
      [
        { name: 'P', lo: 8000, hi: 880000, step: 500 },
        { name: 'rate', lo: 2.5, hi: 9.5, step: 0.1 },
        { name: 'years', lo: 5, hi: 40, step: 1 },
        { name: 'extra', lo: 0, hi: 900, step: 10 },
      ],
      [],
      (v) => `${v.P} at ${v.rate}% for ${v.years} years plus ${v.extra} extra`,
    ),
    introOutputs: ['pay', 'time'],
    relatedSlugs: ['mortgage-calculator', 'loan-calculator', 'interest-rate-calculator'],
    checks: [
      { inputs: {}, expect: { pay: '$1,580.17', time: '22 years 1 month', int: '$221,243.14', saved: '$97,618.44', total: '$471,243.14' } },
      {
        inputs: { P: 200000, rate: 5, years: 15, extra: 0 },
        expect: { pay: '$1,581.59', time: '15 years 0 months', int: '$84,685.48', saved: '$0.00', total: '$284,685.48' },
      },
      {
        inputs: { P: 150000, rate: 4, years: 30, extra: 500 },
        expect: { pay: '$716.12', time: '13 years 4 months', int: '$43,529.39', saved: '$64,275.88', total: '$193,529.39' },
      },
    ],
  },
  {
    slug: 'auto-loan-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Loans',
    title: 'Auto Loan Calculator: Car Payment With Tax, Fees and Trade-In',
    h1: 'Auto Loan Calculator',
    metaDescription:
      'Estimate a monthly car payment from the price, down payment, trade-in, sales tax, fees, interest rate and term, with the total interest and the total cost.',
    about:
      'The price on the sticker is not the amount you borrow. Sales tax and fees are added, then your down payment and trade-in come off. Enter the vehicle price, what you put down, the value of any trade-in, the sales tax rate, the fees and the loan rate and length. The calculator works out the amount financed, the monthly payment, the interest over the life of the loan and the total you will have spent, so you can compare a longer, cheaper-looking term with a shorter one.',
    inputs: [
      dollars('price', 'Vehicle price', 30000),
      dollars('down', 'Down payment', 3000),
      dollars('trade', 'Trade-in value', 0),
      percent('tax', 'Sales tax rate', 6, 30),
      dollars('fees', 'Fees and add-ons', 500),
      percent('rate', 'Loan interest rate', 6.5, 100),
      whole('n', 'Loan term (months)', 60, 6, 120),
    ],
    outputs: [
      out('loan', 'Amount financed', true),
      out('pay', 'Monthly payment'),
      out('int', 'Total interest'),
      out('total', 'Total cost (down + trade-in + payments)'),
    ],
    calculate: (i) => {
      const price = toD(i.price);
      const trade = toD(i.trade);
      const loan = price
        .plus(price.minus(trade).mul(toD(i.tax)).div(100))
        .plus(toD(i.fees))
        .minus(toD(i.down))
        .minus(trade);
      if (loan.lte(0)) return { loan: fmtCurrency(ZERO), pay: fmtCurrency(ZERO), int: fmtCurrency(ZERO), total: fmtCurrency(price) };
      const a = amort(loan, toD(i.rate).div(1200), Number(i.n), ZERO);
      return { loan: fmtCurrency(loan), pay: fmtCurrency(a.payment), int: fmtCurrency(a.interest), total: fmtCurrency(toD(i.down).plus(trade).plus(a.paid)) };
    },
    formulaDescription:
      'Amount financed = price + sales tax on (price − trade-in) + fees − down payment − trade-in. The payment is the standard amortizing payment on that amount. Many jurisdictions tax only the price net of the trade-in; others tax the full price, so check yours.',
    formulaLatex: 'L = P + t(P - T) + F - D - T',
    workedExample:
      '$30,000 car, $3,000 down, no trade-in, 6% tax, $500 fees: tax $1,800, so the loan is $29,300. At 6.5% over 60 months the payment is $573.29, interest $5,097.27 and the total cost $37,397.27.',
    faq: [
      { question: 'Is a longer term cheaper?', answer: 'The payment is lower, but you pay more interest and may owe more than the car is worth for longer.' },
      {
        question: 'Is the trade-in taxed?',
        answer: 'In many places only the price minus the trade-in is taxed; the calculator uses that rule. Some places tax the full price.',
      },
      { question: 'What are fees?', answer: 'Documentation, registration and any add-ons rolled into the loan.' },
    ],
    scenarios: varied(
      'auto-loan-calculator',
      12,
      [
        { name: 'price', lo: 9000, hi: 78000, step: 100 },
        { name: 'down', lo: 0, hi: 9500, step: 100 },
        { name: 'trade', lo: 0, hi: 8500, step: 100 },
        { name: 'tax', lo: 0, hi: 10, step: 0.25 },
        { name: 'fees', lo: 0, hi: 1900, step: 25 },
        { name: 'rate', lo: 0, hi: 14, step: 0.1 },
        { name: 'n', lo: 24, hi: 84, step: 12 },
      ],
      [],
      (v) => `${v.price} car, ${v.down} down, ${v.trade} trade, ${v.tax}% tax, ${v.rate}% over ${v.n} months`,
    ),
    introOutputs: ['pay', 'total'],
    relatedSlugs: ['loan-calculator', 'amortization-calculator', 'apr-calculator'],
    checks: [
      { inputs: {}, expect: { loan: '$29,300.00', pay: '$573.29', int: '$5,097.27', total: '$37,397.27' } },
      {
        inputs: { price: 42000, down: 8000, trade: 6000, tax: 7.25, fees: 800, rate: 4.9, n: 72 },
        expect: { loan: '$31,410.00', pay: '$504.40', int: '$4,906.86', total: '$50,316.86' },
      },
      { inputs: { price: 18000, down: 0, tax: 0, fees: 0, rate: 0, n: 48 }, expect: { loan: '$18,000.00', pay: '$375.00', int: '$0.00', total: '$18,000.00' } },
    ],
  },
  {
    slug: 'student-loan-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Loans',
    title: 'Student Loan Calculator: Interest While in School and Repayment',
    h1: 'Student Loan Calculator',
    metaDescription:
      'Estimate a student loan payment when interest builds up while you study: the balance at the start of repayment, the monthly payment and the total interest.',
    about:
      'Many student loans keep charging interest while you are still studying, and that interest is added to the balance when repayment begins. Enter the amount borrowed, the interest rate, the months you will be in school before repayment starts and the length of the repayment plan. The calculator adds simple interest for the study period, shows the balance you will start repaying, and then works out the monthly payment, the interest during repayment and the total repaid.',
    inputs: [
      dollars('bal', 'Amount borrowed', 30000),
      percent('rate', 'Interest rate', 5.5, 100),
      whole('school', 'Months before repayment starts', 24, 0, 120),
      whole('years', 'Repayment term (years)', 10, 1, 40),
    ],
    outputs: [
      out('start', 'Balance when repayment starts', true),
      out('accr', 'Interest added while in school'),
      out('pay', 'Monthly payment'),
      out('int', 'Interest during repayment'),
      out('tot', 'Total repaid'),
    ],
    calculate: (i) => {
      const bal = toD(i.bal);
      const accrued = bal.mul(toD(i.rate)).div(100).mul(toD(i.school)).div(12);
      const start = bal.plus(accrued);
      const a = amort(start, toD(i.rate).div(1200), Number(i.years) * 12, ZERO);
      return { start: fmtCurrency(start), accr: fmtCurrency(accrued), pay: fmtCurrency(a.payment), int: fmtCurrency(a.interest), tot: fmtCurrency(a.paid) };
    },
    formulaDescription:
      'Interest while in school = amount × rate × months ÷ 12 (simple interest, added to the balance when repayment starts). The payment is then the standard amortizing payment on the new balance. Policies differ by country and loan type: some interest is subsidised or not charged at all.',
    formulaLatex: 'B_{0} = B\\left(1 + r\\,\\dfrac{m}{12}\\right)',
    workedExample:
      '$30,000 at 5.5% with 24 months in school: $3,300 of interest is added, so repayment starts at $33,300. Over 10 years the payment is $361.39, with $10,067.23 of repayment interest and $43,367.23 repaid in all.',
    faq: [
      {
        question: 'Is all student loan interest charged while studying?',
        answer: 'Not always. Some loans are subsidised or interest-free during study; check your own loan terms.',
      },
      { question: 'Can I pay interest while in school?', answer: 'Often yes, which stops it being added to the balance and lowers the total cost.' },
      {
        question: 'Does it cover forgiveness or income-based plans?',
        answer: 'No. It is a standard fixed-payment illustration; income-driven plans work differently.',
      },
    ],
    scenarios: varied(
      'student-loan-calculator',
      12,
      [
        { name: 'bal', lo: 3000, hi: 190000, step: 100 },
        { name: 'rate', lo: 1.5, hi: 9.5, step: 0.1 },
        { name: 'school', lo: 0, hi: 72, step: 3 },
        { name: 'years', lo: 5, hi: 30, step: 1 },
      ],
      [],
      (v) => `${v.bal} at ${v.rate}%, ${v.school} months of study then ${v.years} years`,
    ),
    introOutputs: ['start', 'pay'],
    relatedSlugs: ['loan-calculator', 'amortization-calculator', 'interest-rate-calculator'],
    checks: [
      { inputs: {}, expect: { start: '$33,300.00', accr: '$3,300.00', pay: '$361.39', int: '$10,067.23', tot: '$43,367.23' } },
      {
        inputs: { bal: 50000, rate: 6.8, school: 48, years: 20 },
        expect: { start: '$63,600.00', accr: '$13,600.00', pay: '$485.48', int: '$52,917.16', tot: '$116,517.16' },
      },
      { inputs: { bal: 12000, rate: 0, school: 0, years: 5 }, expect: { start: '$12,000.00', accr: '$0.00', pay: '$200.00', int: '$0.00', tot: '$12,000.00' } },
    ],
  },
  {
    slug: 'emi-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Loans',
    title: 'EMI Calculator: Equated Monthly Instalment, Reducing or Flat Rate',
    h1: 'EMI Calculator',
    metaDescription:
      'Calculate the EMI of a home, car or personal loan on a reducing balance or a flat rate, with the total interest, the total payment and the equivalent rate in the other convention.',
    about:
      'An EMI, or equated monthly instalment, is the fixed amount you pay each month on a loan, and in several countries lenders quote it two ways. On a reducing balance the rate applies to what you still owe. On a flat rate it applies to the original amount for the whole term, which looks cheaper but is not. Enter the loan, the rate, the tenure in years or months and the method. You see the EMI, the interest and the equivalent rate in the other convention.',
    inputs: [
      dollars('P', 'Loan amount', 500000),
      percent('rate', 'Interest rate per year', 8.5, 100),
      num('ten', 'Tenure', 20, 1, 600),
      sel('unit', 'Tenure is in', 'years', [
        ['years', 'Years'],
        ['months', 'Months'],
      ]),
      sel('mode', 'Rate is quoted as', 'reducing', [
        ['reducing', 'Reducing balance'],
        ['flat', 'Flat rate'],
      ]),
    ],
    outputs: [
      out('emi', 'EMI (monthly instalment)', true),
      out('int', 'Total interest'),
      out('tot', 'Total payment'),
      out('other', 'Equivalent rate in the other convention'),
    ],
    calculate: (i) => {
      const P = toD(i.P);
      const n = periods(String(i.unit) === 'years' ? toD(i.ten) : toD(i.ten).div(12), 12);
      const yrs = new D(n).div(12);
      if (String(i.mode) === 'flat') {
        const e = P.plus(P.mul(toD(i.rate)).div(100).mul(yrs)).div(n);
        const red = solve((x) => pvAnnuity(e, x, n).minus(P), new D('1e-12'), ONE);
        return {
          emi: fmtCurrency(e),
          int: fmtCurrency(e.mul(n).minus(P)),
          tot: fmtCurrency(e.mul(n)),
          other: `${fmtPercent(red.mul(1200), 3)} a year on the reducing balance`,
        };
      }
      const e = level(P, toD(i.rate).div(1200), n);
      const tot = e.mul(n);
      return {
        emi: fmtCurrency(e),
        int: fmtCurrency(tot.minus(P)),
        tot: fmtCurrency(tot),
        other: `${fmtPercent(tot.minus(P).div(P.mul(yrs)).mul(100), 3)} a year flat`,
      };
    },
    formulaDescription:
      'Reducing balance: EMI = P r (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1) with r the yearly rate ÷ 12. Flat rate: EMI = (P + P × rate × years) ÷ months. The equivalent rate is found from the same EMI under the other convention. Fixed rate, fixed tenure.',
    formulaLatex: '\\mathrm{EMI} = \\dfrac{P\\,r(1+r)^{n}}{(1+r)^{n} - 1}',
    workedExample:
      '500,000 at 8.5% reducing over 20 years: EMI 4,339.12, interest 541,387.88, total 1,041,387.88, which is the same cost as a flat 5.414% a year. A flat 7% on 300,000 over 3 years has an EMI of 10,083.33, equal to 12.828% on the reducing balance.',
    faq: [
      {
        question: 'Why is a flat rate misleading?',
        answer: 'The interest is charged on the full original amount even as you repay it, so the true yearly cost is much higher than the quoted flat rate.',
      },
      { question: 'What does reducing balance mean?', answer: 'Interest is charged only on the amount you still owe, so it falls as you repay.' },
      {
        question: 'Can I use it for a home loan?',
        answer: 'Yes, for any fixed-rate loan with monthly payments; floating rates change the EMI when the rate changes.',
      },
    ],
    scenarios: varied(
      'emi-calculator',
      12,
      [
        { name: 'P', lo: 20000, hi: 4800000, step: 1000 },
        { name: 'rate', lo: 5, hi: 16, step: 0.1 },
        { name: 'ten', lo: 12, hi: 240, step: 6 },
      ],
      [
        { name: 'unit', options: ['months'] },
        { name: 'mode', options: ['reducing', 'flat'] },
      ],
      (v) => `${v.P} at ${v.rate}% ${v.mode} over ${v.ten} months`,
    ),
    introOutputs: ['emi', 'other'],
    relatedSlugs: ['loan-calculator', 'mortgage-calculator', 'amortization-calculator'],
    checks: [
      { inputs: {}, expect: { emi: '$4,339.12', int: '$541,387.88', tot: '$1,041,387.88', other: '5.414% a year flat' } },
      {
        inputs: { P: 1000000, rate: 9, ten: 60, unit: 'months' },
        expect: { emi: '$20,758.36', int: '$245,501.31', tot: '$1,245,501.31', other: '4.910% a year flat' },
      },
      {
        inputs: { P: 300000, rate: 7, ten: 3, unit: 'years', mode: 'flat' },
        expect: { emi: '$10,083.33', int: '$63,000.00', tot: '$363,000.00', other: '12.828% a year on the reducing balance' },
      },
    ],
  },
  {
    slug: 'credit-card-payoff-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Debt',
    title: 'Credit Card Payoff Calculator: Time to Pay Off and Interest Cost',
    h1: 'Credit Card Payoff Calculator',
    metaDescription:
      'Find how long a credit card balance takes to pay off at a fixed monthly payment, the total interest, and the payment needed to clear it in a target number of months.',
    about:
      "Credit card interest is charged every month on what you still owe, so paying only a small amount can keep a balance alive for years. Enter your balance, the card's yearly rate and the fixed amount you pay each month. The calculator steps through the months, adding interest and subtracting your payment, to show how long it takes, how much interest you pay and the total you will have paid. It also gives the monthly payment that would clear the card within a target number of months.",
    inputs: [
      dollars('bal', 'Card balance', 5000),
      percent('apr', 'Interest rate (APR)', 22, 100),
      dollars('pay', 'Fixed monthly payment', 200),
      whole('target', 'Target: pay off in (months)', 24, 1, 600),
    ],
    outputs: [
      out('time', 'Time to pay off', true),
      out('int', 'Total interest'),
      out('tot', 'Total paid'),
      out('need', 'Payment needed to finish in the target time'),
    ],
    calculate: (i) => {
      const bal = toD(i.bal);
      const r = toD(i.apr).div(1200);
      const need = fmtCurrency(level(bal, r, Number(i.target)));
      const pay = toD(i.pay);
      if (pay.lte(cents(bal.mul(r)))) return { time: 'The payment does not cover the monthly interest', int: '', tot: '', need };
      let b = bal;
      let paid = ZERO;
      let months = 0;
      while (b.gt(0) && months < 1200) {
        months += 1;
        b = b.plus(cents(b.mul(r)));
        const p = D.min(pay, b);
        b = b.minus(p);
        paid = paid.plus(p);
      }
      return { time: `${months} months (${yrsMo(months)})`, int: fmtCurrency(paid.minus(bal)), tot: fmtCurrency(paid), need };
    },
    formulaDescription:
      "Each month: balance = balance + interest (balance × APR ÷ 12, rounded to the cent) − payment; the last payment is trimmed. If the payment is not above the first month's interest the balance never falls. The target payment is B r ÷ (1 − (1 + r)⁻ⁿ). No new purchases, fees or changes in rate.",
    formulaLatex: 'P = \\dfrac{B\\,r}{1 - (1+r)^{-n}}',
    workedExample:
      '$5,000 at 22% with $200 a month takes 34 months (2 years 10 months), costs $1,749.90 in interest and $6,749.90 in all. To clear it in 24 months you would pay $259.39 a month.',
    faq: [
      {
        question: 'Why does the minimum payment take so long?',
        answer: 'The minimum is often just above the monthly interest, so very little reduces the balance.',
      },
      { question: 'Does it include new purchases?', answer: 'No. It assumes the card is not used again while you pay it off.' },
      {
        question: 'Which pays off faster, more each month or a lower rate?',
        answer: 'Both help; a balance transfer to a lower rate can save a lot, but check the fee and how long the rate lasts.',
      },
    ],
    scenarios: varied(
      'credit-card-payoff-calculator',
      12,
      [
        { name: 'bal', lo: 400, hi: 28000, step: 50 },
        { name: 'apr', lo: 9.5, hi: 29.9, step: 0.1 },
        { name: 'pay', lo: 60, hi: 900, step: 5 },
        { name: 'target', lo: 6, hi: 84, step: 3 },
      ],
      [],
      (v) => `owing ${v.bal} at ${v.apr}% paying ${v.pay} aiming at ${v.target} months`,
    ),
    introOutputs: ['time', 'int'],
    relatedSlugs: ['credit-card-interest-calculator', 'loan-calculator', 'amortization-calculator'],
    checks: [
      { inputs: {}, expect: { time: '34 months (2 years 10 months)', int: '$1,749.90', tot: '$6,749.90', need: '$259.39' } },
      {
        inputs: { bal: 12000, apr: 19.99, pay: 400, target: 36 },
        expect: { time: '42 months (3 years 6 months)', int: '$4,770.24', tot: '$16,770.24', need: '$445.90' },
      },
      {
        inputs: { bal: 3000, apr: 24, pay: 50, target: 12 },
        expect: { time: 'The payment does not cover the monthly interest', int: '', tot: '', need: '$283.68' },
      },
    ],
  },
  {
    slug: 'credit-card-interest-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Debt',
    title: 'Credit Card Interest Calculator: Cost of Carrying a Balance',
    h1: 'Credit Card Interest Calculator',
    metaDescription:
      'Calculate the interest a credit card charges on a balance over one billing cycle from the APR and the number of days, with the daily rate and the true yearly cost.',
    about:
      'Most credit cards work out interest every day: the APR is divided by 365 to give a daily rate that is applied to the balance you carry. Enter the balance that stays on the card, the APR and the number of days in the billing cycle. You get the interest charge for the cycle, the daily rate in percent and the effective annual rate once the monthly charges compound, which is higher than the advertised APR and shows what carrying a balance really costs.',
    inputs: [dollars('bal', 'Balance carried', 3200), percent('apr', 'APR', 24.99, 100), whole('days', 'Days in the billing cycle', 30, 1, 366)],
    outputs: [out('int', 'Interest for the cycle', true), out('daily', 'Daily rate'), out('eff', 'Effective yearly rate with monthly compounding')],
    calculate: (i) => {
      const apr = toD(i.apr);
      return {
        int: fmtCurrency(toD(i.bal).mul(apr).div(100).div(365).mul(toD(i.days))),
        daily: `${fmtNumber(apr.div(365), 5)}%`,
        eff: fmtPercent(ONE.plus(apr.div(1200)).pow(12).minus(1).mul(100), 2),
      };
    },
    formulaDescription:
      'Interest = balance × (APR ÷ 365) × days. The daily rate is APR ÷ 365. The effective rate assumes the charge is added each month: (1 + APR ÷ 12)¹² − 1. The balance is assumed constant through the cycle (average daily balance).',
    formulaLatex: 'I = B\\cdot\\dfrac{\\mathrm{APR}}{365}\\cdot d',
    workedExample:
      'A $3,200 balance at 24.99% for 30 days: the daily rate is 0.06847% and the cycle charge is $65.73. With monthly compounding the effective yearly rate is 28.06%.',
    faq: [
      {
        question: 'Is interest charged if I pay in full?',
        answer: 'Usually not, if you pay the full statement balance by the due date and have no balance carried over (the grace period).',
      },
      {
        question: 'Why is the effective rate higher than the APR?',
        answer: 'The monthly charge is added to the balance and then earns interest, so the cost compounds.',
      },
      { question: 'What is the average daily balance?', answer: "The mean of each day's balance in the cycle; this page assumes it stays constant." },
    ],
    scenarios: varied(
      'credit-card-interest-calculator',
      12,
      [
        { name: 'bal', lo: 150, hi: 27500, step: 25 },
        { name: 'apr', lo: 11.9, hi: 29.9, step: 0.1 },
        { name: 'days', lo: 28, hi: 31, step: 1 },
      ],
      [],
      (v) => `carrying ${v.bal} at ${v.apr}% over ${v.days} days`,
    ),
    introOutputs: ['int'],
    relatedSlugs: ['credit-card-payoff-calculator', 'effective-interest-rate-calculator', 'loan-calculator'],
    checks: [
      { inputs: {}, expect: { int: '$65.73', daily: '0.06847%', eff: '28.06%' } },
      { inputs: { bal: 800, apr: 18, days: 31 }, expect: { int: '$12.23', daily: '0.04932%', eff: '19.56%' } },
      { inputs: { bal: 15000, apr: 29.99, days: 28 }, expect: { int: '$345.09', daily: '0.08216%', eff: '34.48%' } },
    ],
  },
  {
    slug: 'depreciation-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Business',
    title: 'Depreciation Calculator: Straight-Line, Declining Balance and Sum-of-Years',
    h1: 'Depreciation Calculator',
    metaDescription:
      'Calculate asset depreciation for any year with the straight-line, double-declining-balance or sum-of-years-digits method, with accumulated depreciation and book value.',
    about:
      "Depreciation spreads the cost of an asset over its useful life, so each year's accounts carry a share of the expense. Straight-line charges the same amount every year, double-declining-balance front-loads the charge by applying twice the straight-line rate to what is left, and sum-of-years-digits front-loads it by a falling fraction. Enter the cost, the salvage value, the life in years, the method and the year you care about. The page returns that year's depreciation, the total so far and the book value.",
    inputs: [
      dollars('cost', 'Asset cost', 25000),
      dollars('salv', 'Salvage value', 5000),
      whole('life', 'Useful life (years)', 5, 1, 100),
      sel('method', 'Method', 'sl', [
        ['sl', 'Straight-line'],
        ['ddb', 'Double-declining balance'],
        ['syd', "Sum of the years' digits"],
      ]),
      whole('yr', 'Year to show', 3, 1, 100),
    ],
    outputs: [out('dep', 'Depreciation in that year', true), out('acc', 'Accumulated depreciation'), out('bv', 'Book value at year end')],
    calculate: (i) => {
      const cost = toD(i.cost);
      const salv = toD(i.salv);
      const life = Number(i.life);
      const base = cost.minus(salv);
      const method = String(i.method);
      let bv = cost;
      let acc = ZERO;
      let dep = ZERO;
      for (let y = 1; y <= Number(i.yr); y++) {
        let d =
          method === 'sl'
            ? base.div(life)
            : method === 'ddb'
              ? D.min(bv.mul(2).div(life), bv.minus(salv))
              : base.mul(life - y + 1).div(new D(life).mul(life + 1).div(2));
        if (d.lt(0) || y > life) d = ZERO;
        bv = bv.minus(d);
        acc = acc.plus(d);
        dep = d;
      }
      return { dep: fmtCurrency(dep), acc: fmtCurrency(acc), bv: fmtCurrency(bv) };
    },
    formulaDescription:
      'Straight-line: (cost − salvage) ÷ life. Double-declining: 2 ÷ life × opening book value, never taking the book value below salvage. Sum-of-years: (cost − salvage) × (life − year + 1) ÷ (life (life + 1) ÷ 2). Book value = cost − accumulated depreciation.',
    formulaLatex: 'D_{SL} = \\dfrac{C - S}{L}',
    workedExample:
      'A $25,000 asset with $5,000 salvage and a 5-year life, straight-line: $4,000 a year, so after year 3 accumulated depreciation is $12,000 and book value $13,000. Double-declining in year 2 charges $6,000, leaving $9,000.',
    faq: [
      {
        question: 'Which method should I use?',
        answer: 'It depends on the accounting or tax rules that apply to you; straight-line is the simplest and the usual default for reports.',
      },
      {
        question: 'What is salvage value?',
        answer: 'The estimated resale or scrap value at the end of the useful life; the asset is not depreciated below it.',
      },
      { question: 'Is this tax advice?', answer: 'No. Tax depreciation often follows prescribed schedules that differ from these methods.' },
    ],
    scenarios: varied(
      'depreciation-calculator',
      12,
      [
        { name: 'cost', lo: 1500, hi: 480000, step: 100 },
        { name: 'salv', lo: 0, hi: 40000, step: 100 },
        { name: 'life', lo: 3, hi: 25, step: 1 },
        { name: 'yr', lo: 1, hi: 5, step: 1 },
      ],
      [{ name: 'method', options: ['sl', 'ddb', 'syd'] }],
      (v) => `${v.method} on ${v.cost} salvage ${v.salv} over ${v.life} years, year ${v.yr}`,
    ),
    introOutputs: ['dep', 'bv'],
    relatedSlugs: ['break-even-point-calculator', 'profit-margin-calculator', 'roi-calculator'],
    checks: [
      { inputs: {}, expect: { dep: '$4,000.00', acc: '$12,000.00', bv: '$13,000.00' } },
      { inputs: { method: 'ddb', yr: 2 }, expect: { dep: '$6,000.00', acc: '$16,000.00', bv: '$9,000.00' } },
      { inputs: { method: 'syd', yr: 1 }, expect: { dep: '$6,666.67', acc: '$6,666.67', bv: '$18,333.33' } },
      { inputs: { method: 'ddb', yr: 5 }, expect: { dep: '$0.00', acc: '$20,000.00', bv: '$5,000.00' } },
      { inputs: { method: 'syd', yr: 5 }, expect: { dep: '$1,333.33', acc: '$20,000.00', bv: '$5,000.00' } },
    ],
  },
  {
    slug: 'payback-period-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Business',
    title: 'Payback Period Calculator: Simple and Discounted',
    h1: 'Payback Period Calculator',
    metaDescription:
      'Calculate how long an investment takes to pay for itself from steady annual cash inflows, both the simple payback period and the discounted payback period.',
    about:
      "The payback period is the time it takes for an investment's cash inflows to repay its cost. The simple version just divides the cost by the yearly inflow, but it ignores the fact that money received later is worth less. The discounted version values each inflow at a discount rate, so it takes longer and may never happen. Enter the investment, the steady annual inflow and the discount rate; use zero for the simple case. Results are in years and months.",
    inputs: [dollars('inv', 'Initial investment', 50000), dollars('inflow', 'Annual cash inflow', 12000), percent('rate', 'Discount rate', 8, 100)],
    outputs: [out('simple', 'Simple payback period', true), out('ym', 'In years and months'), out('disc', 'Discounted payback period')],
    calculate: (i) => {
      const inv = toD(i.inv);
      const inflow = toD(i.inflow);
      const r = toD(i.rate).div(100);
      const simple = inv.div(inflow);
      let y = Number(simple.floor().toFixed(0));
      let mo = Number(simple.minus(y).mul(12).toFixed(0, D.ROUND_HALF_UP));
      if (mo === 12) {
        y += 1;
        mo = 0;
      }
      let disc: string;
      if (r.isZero()) disc = `${fmtNumber(simple, 2)} years`;
      else if (inv.mul(r).gte(inflow)) disc = 'Never (the discounted inflows never reach the investment)';
      else
        disc = `${fmtNumber(
          D.ln(ONE.minus(inv.mul(r).div(inflow)))
            .neg()
            .div(D.ln(ONE.plus(r))),
          2,
        )} years`;
      return { simple: `${fmtNumber(simple, 2)} years`, ym: `${plural(y, 'year')} ${plural(mo, 'month')}`, disc };
    },
    formulaDescription:
      'Simple payback = investment ÷ annual inflow. Discounted payback solves inflow × (1 − (1 + r)⁻ⁿ) ÷ r = investment, so n = −ln(1 − investment × r ÷ inflow) ÷ ln(1 + r), which exists only if investment × r is below the inflow. Level inflows at the end of each year.',
    formulaLatex: 'n = \\dfrac{-\\ln\\left(1 - \\dfrac{I\\,r}{C}\\right)}{\\ln(1 + r)}',
    workedExample:
      '$50,000 returning $12,000 a year: simple payback 4.17 years (4 years 2 months). At an 8% discount rate it takes 5.27 years. $100,000 returning $6,000 a year at 8% never pays back in discounted terms.',
    faq: [
      {
        question: 'Why is the discounted payback longer?',
        answer: 'Later cash is worth less than cash today, so more years of inflow are needed to make up the same value.',
      },
      {
        question: 'Is a shorter payback always better?',
        answer: 'Not necessarily. It ignores what happens after payback and the size of the total return, so use it alongside other measures.',
      },
      {
        question: 'What if the inflows vary?',
        answer: 'Add them year by year until the running total reaches the investment; this page assumes level inflows.',
      },
    ],
    scenarios: varied(
      'payback-period-calculator',
      12,
      [
        { name: 'inv', lo: 2500, hi: 940000, step: 500 },
        { name: 'inflow', lo: 600, hi: 190000, step: 100 },
        { name: 'rate', lo: 0, hi: 15, step: 0.5 },
      ],
      [],
      (v) => `invest ${v.inv} returning ${v.inflow} a year at ${v.rate}%`,
    ),
    introOutputs: ['simple', 'disc'],
    relatedSlugs: ['roi-calculator', 'present-value-calculator', 'break-even-point-calculator'],
    checks: [
      { inputs: {}, expect: { simple: '4.17 years', ym: '4 years 2 months', disc: '5.27 years' } },
      { inputs: { inv: 100000, inflow: 20000, rate: 0 }, expect: { simple: '5 years', ym: '5 years 0 months', disc: '5 years' } },
      {
        inputs: { inv: 100000, inflow: 6000, rate: 8 },
        expect: { simple: '16.67 years', ym: '16 years 8 months', disc: 'Never (the discounted inflows never reach the investment)' },
      },
      { inputs: { inv: 30000, inflow: 9500, rate: 12 }, expect: { simple: '3.16 years', ym: '3 years 2 months', disc: '4.2 years' } },
    ],
  },
  {
    slug: 'interest-rate-parity-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Foreign exchange',
    title: 'Interest Rate Parity Calculator: Forward Exchange Rate',
    h1: 'Interest Rate Parity Calculator',
    metaDescription:
      'Calculate the forward exchange rate implied by covered interest rate parity from the spot rate and the two interest rates, with the annualised forward premium or discount.',
    about:
      'Covered interest rate parity says a currency with the higher interest rate should trade at a forward discount, so that borrowing in one currency, converting and lending in the other earns no riskless profit. Enter the spot rate, quoted as units of the domestic currency per unit of foreign, the two interest rates and the length of the forward in days. The page returns the forward rate that parity implies, the annualised premium or discount and the forward points.',
    inputs: [
      num('spot', 'Spot rate (domestic per 1 foreign)', 1.08, 0.000001, 1e9),
      percent('dom', 'Domestic interest rate', 4.5, 100),
      percent('frn', 'Foreign interest rate', 3, 100),
      whole('days', 'Forward period (days)', 180, 1, 3650),
    ],
    outputs: [
      out('fwd', 'Forward rate', true),
      out('prem', 'Forward premium (+) or discount (−), annualised'),
      out('pts', 'Forward points (spot to forward, × 10,000)'),
    ],
    calculate: (i) => {
      const spot = toD(i.spot);
      const days = toD(i.days);
      const fwd = spot.mul(ONE.plus(toD(i.dom).div(100).mul(days).div(360))).div(ONE.plus(toD(i.frn).div(100).mul(days).div(360)));
      return {
        fwd: fmtNumber(fwd, 5),
        prem: fmtPercent(fwd.div(spot).minus(1).mul(360).div(days).mul(100), 3),
        pts: `${fmtNumber(fwd.minus(spot).mul(10000), 1)} points`,
      };
    },
    formulaDescription:
      'F = S × (1 + i_d × t ÷ 360) ÷ (1 + i_f × t ÷ 360), with S the spot rate (domestic per foreign), i_d and i_f the domestic and foreign money-market rates and t the days. A 360-day basis is used; some currencies quote on 365.',
    formulaLatex: 'F = S\\,\\dfrac{1 + i_{d}\\,t/360}{1 + i_{f}\\,t/360}',
    workedExample:
      'Spot 1.08, a 4.5% domestic and 3% foreign rate over 180 days: F = 1.08 × 1.0225 ÷ 1.015 = 1.08798, a forward premium of 1.478% a year and 79.8 points.',
    faq: [
      {
        question: 'What does parity mean?',
        answer: 'That a hedged investment in either currency earns the same return, so the forward rate offsets the interest difference.',
      },
      {
        question: 'Does it hold in practice?',
        answer: 'Covered parity holds closely for major currencies; uncovered parity, which depends on expected spot moves, does not hold reliably.',
      },
      {
        question: 'How is the quote direction set?',
        answer: 'The spot is domestic currency per one unit of foreign currency; reverse it if your quote is the other way.',
      },
    ],
    scenarios: varied(
      'interest-rate-parity-calculator',
      12,
      [
        { name: 'spot', lo: 0.55, hi: 160, step: 0.01 },
        { name: 'dom', lo: 0.1, hi: 9.5, step: 0.1 },
        { name: 'frn', lo: 0.1, hi: 9.5, step: 0.1 },
        { name: 'days', lo: 30, hi: 720, step: 30 },
      ],
      [],
      (v) => `spot ${v.spot}, rates ${v.dom}% and ${v.frn}%, ${v.days} days`,
    ),
    introOutputs: ['fwd'],
    relatedSlugs: ['effective-interest-rate-calculator', 'real-interest-rate-calculator', 'present-value-calculator'],
    checks: [
      { inputs: {}, expect: { fwd: '1.08798', prem: '1.478%', pts: '79.8 points' } },
      { inputs: { spot: 150, dom: 0.1, frn: 5, days: 90 }, expect: { fwd: '148.18519', prem: '-4.840%', pts: '-18,148.1 points' } },
      { inputs: { spot: 0.92, dom: 3, frn: 3, days: 360 }, expect: { fwd: '0.92', prem: '0.000%', pts: '0 points' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
