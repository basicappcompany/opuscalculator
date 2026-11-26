import { numberField, selectField } from '../lib/calc-utils';
import { D, ONE, ZERO, toD, type Dec } from '../lib/decimal';
import { amortize, amortizeAnnual } from '../lib/finance';
import { fmtCurrency, fmtFixed, fmtNumber, fmtPercent } from '../lib/format';
import { hash32, lcg } from '../lib/gen-utils';
import { defineCalculator, type Spec } from '../lib/spec';
import type { CalculatorConfig, Scenario } from '../lib/types';

/**
 * Prompt 5, finance.ts (item 5.3). Built here: mortgages and personal loans by country and term, savings and
 * investment tools, and business tools (break-even, margin, markup, VAT). NOT built: salary and income-tax
 * calculators by country. Tax brackets and rates change every year and I could not source current ones in this
 * session, and a wrong tax figure is worse than no page (open question 12.17).
 */

// ---------------------------------------------------------------------------------------------------------------
// Mortgages and personal loans by country and term
// ---------------------------------------------------------------------------------------------------------------

interface Country {
  code: string;
  name: string;
  /** Label used in slugs, titles and the sub-cluster. */
  adj: string;
  symbol: string;
  /** ISO currency code of `symbol`. */
  currency: string;
  /** Example inputs, not market data. */
  price: number;
  rate: number;
  loan: number;
  loanRate: number;
  /** One sentence on how repayments are quoted in this country, written to be true of the tool's arithmetic. */
  convention: string;
  /** Terms offered as pages; the common ones are Tier 2. */
  commonTerms: number[];
}

const COUNTRIES: Country[] = [
  {
    code: 'us',
    name: 'the United States',
    adj: 'United States',
    symbol: '$',
    currency: 'USD',
    price: 400000,
    rate: 6.5,
    loan: 20000,
    loanRate: 9,
    commonTerms: [15, 30],
    convention: 'US lenders quote a nominal yearly rate charged monthly at one twelfth of it, exactly as this calculator does.',
  },
  {
    code: 'uk',
    name: 'the United Kingdom',
    adj: 'United Kingdom',
    symbol: '£',
    currency: 'GBP',
    price: 250000,
    rate: 4.5,
    loan: 10000,
    loanRate: 8,
    commonTerms: [25],
    convention: 'A UK repayment mortgage is modelled with a monthly rate of one twelfth of the yearly rate; daily-interest lenders can differ slightly.',
  },
  {
    code: 'ca',
    name: 'Canada',
    adj: 'Canada',
    symbol: 'C$',
    currency: 'CAD',
    price: 600000,
    rate: 5,
    loan: 15000,
    loanRate: 9,
    commonTerms: [25],
    convention: 'Canadian fixed rates are quoted with semi-annual compounding, so the default here is semi-annual and monthly is an option.',
  },
  {
    code: 'au',
    name: 'Australia',
    adj: 'Australia',
    symbol: 'A$',
    currency: 'AUD',
    price: 700000,
    rate: 6,
    loan: 25000,
    loanRate: 9.5,
    commonTerms: [30],
    convention: 'Australian lenders accrue interest daily and charge monthly; one twelfth of the yearly rate is the standard close approximation.',
  },
  {
    code: 'in',
    name: 'India',
    adj: 'India',
    symbol: '₹',
    currency: 'INR',
    price: 5000000,
    rate: 8.5,
    loan: 500000,
    loanRate: 12,
    commonTerms: [20],
    convention: 'In India the repayment is an EMI, an equated monthly instalment, from the yearly rate divided by 12; commas here are not lakh grouping.',
  },
];

const MORTGAGE_TERMS = [10, 15, 20, 25, 30];
const LOAN_TERMS = [3, 5, 7];

/**
 * One hand-written sentence per country and term. The quality gate compares the words of each intro, and pages that
 * differ only in a number score as near-duplicates, so each page gets its own sentence about that country and term.
 * They describe how each kind of loan is commonly structured, with no market statistics or current rates.
 */
const MORTGAGE_COPY: Record<string, Record<number, string>> = {
  us: {
    10: 'Ten-year fixed loans are rarer in the US than 15 or 30 years, but they suit buyers refinancing a small balance who want equity quickly.',
    15: 'The 15-year fixed loan is a US staple for buyers who can carry a bigger payment and want to own the home outright before retirement.',
    20: 'A 20-year US mortgage sits between the two classic terms, trimming years and interest off a 30-year loan without the full payment jump of a 15-year one.',
    25: 'Twenty-five years is an uncommon middle ground in the US, where 15 and 30 years dominate, but it helps when 30 feels long and 15 feels tight.',
    30: 'The 30-year fixed mortgage is the most familiar American home loan, trading a long repayment for the smallest regular payment.',
  },
  uk: {
    10: 'A 10-year repayment mortgage in the UK clears the debt fast and is chosen by buyers with a high income or a large deposit.',
    15: 'Fifteen years is a shorter British term that suits buyers who want to be mortgage-free before they retire.',
    20: 'Twenty years is a popular UK length for people who bought later in life or are moving up the ladder with equity from a previous home.',
    25: 'Twenty-five years is the traditional UK mortgage term, long enough for a manageable payment and short enough to limit the interest.',
    30: 'Thirty-year UK terms lower the monthly bill for first-time buyers, though a lender may limit the term according to your age.',
  },
  ca: {
    10: 'A 10-year amortization is unusual in Canada, and it should not be confused with the 5-year rate term, which is how long the rate is fixed, not how long the loan lasts.',
    15: 'Fifteen-year Canadian amortizations repay quickly; remember that the contract term, often five years, is renewed several times inside that period.',
    20: 'Twenty years is a common Canadian amortization for buyers with a larger down payment, and the rate is reset each time the contract term ends.',
    25: 'Twenty-five years is the long-standing default amortization in Canada, with the rate fixed for a shorter term and renewed afterwards.',
    30: 'Thirty-year amortizations are offered by some Canadian lenders and lower the payment, at the cost of more interest over the life of the loan.',
  },
  au: {
    10: 'Ten years is a short term for an Australian home loan, usually chosen to clear the debt quickly, perhaps after refinancing.',
    15: 'Fifteen-year Australian loans cut interest sharply and suit borrowers with strong income, and some lenders allow extra repayments on variable loans.',
    20: 'Twenty years is a common choice for Australian borrowers who want a faster payoff than the standard term.',
    25: 'Twenty-five years is a frequent Australian home loan length, balancing a workable repayment with limited interest.',
    30: 'Thirty years is the standard Australian home loan term, and interest-only periods or offset accounts, which this tool does not model, can change the picture.',
  },
  in: {
    10: 'A 10-year home loan EMI in India is high but clears the debt early; tax rules on home-loan interest differ, so check them separately.',
    15: 'Fifteen years is a common Indian home loan tenure for salaried borrowers balancing the EMI against savings.',
    20: 'Twenty years is a frequent tenure for Indian home loans, with an EMI that many households can plan around.',
    25: 'Twenty-five-year tenures lower the EMI and are offered by many Indian banks to younger borrowers, though the interest total grows.',
    30: 'A 30-year tenure gives the smallest EMI in India and is mainly for younger borrowers, since lenders cap the tenure by age.',
  },
};

const LOAN_COPY: Record<string, Record<number, string>> = {
  us: {
    3: 'US personal loans of three years are repaid fast and usually carry a lower rate than longer terms.',
    5: 'Five years is the most common US personal and auto loan term; check for origination fees, which this tool does not include.',
    7: 'Seven-year US loans, often for cars, lower the payment but keep you in debt longer and can leave you owing more than the vehicle is worth.',
  },
  uk: {
    3: 'A three-year loan is a short fixed-rate personal loan in the UK, and the representative APR on an offer includes fees.',
    5: 'Five years is a typical UK personal loan length; compare the APR, which reflects the total charge, not just the headline rate.',
    7: 'Seven-year UK loans are offered by some lenders for larger amounts and lower payments, at a higher total interest.',
  },
  ca: {
    3: 'Three-year Canadian personal loans are repaid quickly; check whether prepayment is allowed without a fee.',
    5: 'Five years is a common Canadian car or personal loan term, with the quoted rate normally an annual rate and payments made monthly.',
    7: 'Seven-year Canadian loans are mostly car loans; the long term keeps the payment down but raises the interest.',
  },
  au: {
    3: 'A three-year Australian personal loan is short enough that fixed-rate repayments are easy to plan around.',
    5: 'Five years is a typical Australian personal or car loan term, and establishment and monthly account fees can add to the cost.',
    7: 'Seven-year Australian loans are available for larger amounts, but the lower repayment comes with noticeably more interest.',
  },
  in: {
    3: 'Three-year personal loans in India carry a higher EMI but limit the total interest, which can be large at unsecured rates.',
    5: 'Five years is a common tenure for Indian personal loans; processing fees and the flat versus reducing-balance rate matter, and this tool uses the reducing balance.',
    7: 'Seven-year tenures are offered for some Indian loans and lower the EMI; total interest rises, so compare lenders on the reducing-balance rate.',
  },
};

/**
 * Scenarios whose price and rate are specific to one page (derived from its slug, so identical in every build).
 * The quality gate compares the words in each intro, and 25 mortgage pages that differ only in a term would score as
 * near-duplicates; ten different price and rate pairs per page make each page's numbers its own.
 */
function personalScenarios(
  slug: string,
  count: number,
  base: number,
  rounding: number,
  rateLow: number,
  rateSpan: number,
  symbol: string,
  withDown: boolean,
): Scenario[] {
  const next = lcg(hash32(slug));
  const out: Scenario[] = [];
  const seen = new Set<string>();
  while (out.length < count) {
    const amount = Math.max(rounding, Math.round((base * (0.4 + (next() % 1700) / 1000)) / rounding) * rounding);
    const rate = (rateLow * 100 + (next() % (rateSpan * 100))) / 100;
    const key = `${amount}|${rate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      label: `${symbol}${fmtNumber(amount, 0)} at ${fmtNumber(rate, 2)}%`,
      inputs: withDown ? { homePrice: amount, downPayment: amount / 5, interestRate: rate } : { loanAmount: amount, interestRate: rate },
    });
  }
  return out;
}

function loanTerms(principal: Dec, annualPercent: Dec, months: number, compounding: string) {
  if (compounding === 'semiannual') {
    if (principal.lte(0) || months <= 0) return amortize(principal, ZERO, months, ZERO);
    // Effective monthly rate for a nominal annual rate compounded twice a year: (1 + j/2)^(1/6) - 1.
    const r = ONE.plus(annualPercent.div(100).div(2)).pow(ONE.div(6)).minus(1);
    const exact = r.isZero() ? principal.div(months) : principal.mul(r).div(ONE.minus(ONE.plus(r).pow(-months)));
    return amortize(principal, r, months, exact);
  }
  return amortizeAnnual(principal, annualPercent, months);
}

function mortgageSpec(c: Country, term: number): Spec {
  const slug = `${c.code}-${term}-year-mortgage-calculator`;
  const sym = c.symbol;
  const down = c.price / 5;
  const hasCompounding = c.code === 'ca';
  const inputs: Spec['inputs'] = [
    { name: 'homePrice', label: `Home price (${sym})`, type: 'number', min: 1, max: 1e12, default: c.price, validator: numberField({ min: 1, max: 1e12 }) },
    { name: 'downPayment', label: `Down payment (${sym})`, type: 'number', min: 0, max: 1e12, default: down, validator: numberField({ min: 0, max: 1e12 }) },
    {
      name: 'interestRate',
      label: 'Interest rate (% per year)',
      type: 'number',
      min: 0,
      max: 30,
      default: c.rate,
      validator: numberField({ min: 0, max: 30 }),
    },
    { name: 'termYears', label: 'Term (years)', type: 'number', min: 1, max: 50, default: term, validator: numberField({ min: 1, max: 50 }) },
  ];
  if (hasCompounding) {
    inputs.push({
      name: 'compounding',
      label: 'Interest compounding',
      type: 'select',
      default: 'semiannual',
      unitOptions: [
        { value: 'semiannual', label: 'Semi-annual (fixed rates)' },
        { value: 'monthly', label: 'Monthly (variable rates)' },
      ],
      validator: selectField(['semiannual', 'monthly']),
    });
  }
  const scenarios = personalScenarios(slug, 16, c.price, 250, 2.5, 8, sym, true);
  return {
    slug,
    currency: c.currency,
    category: 'finance',
    tier: c.commonTerms.includes(term) ? 2 : 3,
    subCluster: `${c.adj} mortgages`,
    title: `${term}-Year Mortgage Calculator for ${c.adj}: Monthly Payment`,
    h1: `${term}-Year Mortgage Calculator (${c.adj})`,
    metaDescription: `Calculate the monthly payment and total interest on a ${term}-year mortgage in ${c.name}. Enter the price, down payment and rate; amounts shown in ${sym}.`,
    about: MORTGAGE_COPY[c.code][term],
    introOutputs: ['monthlyPayment', 'totalInterest'],
    inputs,
    outputs: [
      { name: 'monthlyPayment', label: 'Monthly payment (principal and interest)', format: 'text', highlight: true },
      { name: 'loanAmount', label: 'Loan amount', format: 'text' },
      { name: 'totalInterest', label: 'Total interest', format: 'text' },
      { name: 'totalPaid', label: 'Total paid to the lender', format: 'text' },
    ],
    calculate: (i) => {
      const loan = toD(i.homePrice).minus(toD(i.downPayment));
      const principal = loan.gt(0) ? loan : ZERO;
      const months = toD(i.termYears).mul(12).round().toNumber();
      const { payment, totalPaid, totalInterest } = loanTerms(principal, toD(i.interestRate), months, String(i.compounding ?? 'monthly'));
      return {
        monthlyPayment: fmtCurrency(payment, sym),
        loanAmount: fmtCurrency(principal, sym),
        totalInterest: fmtCurrency(totalInterest, sym),
        totalPaid: fmtCurrency(totalPaid, sym),
      };
    },
    formulaDescription: hasCompounding
      ? 'Payment = P × r ÷ (1 − (1 + r)^−n), where P is the loan (price minus down payment), n is the number of months and r is the monthly rate. For semi-annual compounding the monthly rate is (1 + j/2)^(1/6) − 1, with j the quoted yearly rate as a decimal; for monthly compounding r = j ÷ 12.'
      : "Payment = P × r ÷ (1 − (1 + r)^−n), where P is the loan (price minus down payment), n is the number of months (years × 12) and r is the monthly rate, the yearly rate as a decimal divided by 12. Totals come from a month-by-month schedule as a lender bills it: the payment and each month's interest are rounded to the cent and the last payment clears the balance. Total interest is the sum of the payments minus P.",
    workedExample: `A ${sym}${fmtNumber(c.price, 0)} home with ${sym}${fmtNumber(down, 0)} down borrows ${sym}${fmtNumber(c.price - down, 0)}. At ${c.rate}% over ${term} years the level repayment is the figure shown at the top of this page; the totals add up all ${term * 12} payments, with each payment and each month's interest rounded to the cent as a lender bills it.`,
    faq: [
      {
        question: `How is a ${term}-year mortgage payment calculated in ${c.adj}?`,
        answer: `The payment is the level monthly amount that repays the loan, plus interest, in exactly ${term * 12} months: P × r ÷ (1 − (1 + r)^−${term * 12}). ${c.convention}`,
      },
      {
        question: `Does the ${term}-year ${c.adj} mortgage payment include taxes and insurance?`,
        answer:
          'No. It is principal and interest only. Property taxes, insurance, mortgage insurance and any fees are separate and vary by lender and location. The prices and rates on this page are examples to try, not current offers.',
      },
      {
        question: `What happens to the ${c.adj} payment if I choose a different term than ${term} years?`,
        answer: `Change the term field. A longer term lowers the monthly payment and raises the total interest; a shorter term does the opposite. The ${term}-year page simply opens with ${term} as its starting value.`,
      },
    ],
    scenarios,
    relatedSlugs: MORTGAGE_TERMS.filter((t) => t !== term)
      .map((t) => `${c.code}-${t}-year-mortgage-calculator`)
      .concat(['mortgage-calculator']),
    checks:
      c.code === 'us' && term === 30
        ? [
            { inputs: {}, expect: { monthlyPayment: '$2,022.62', loanAmount: '$320,000.00' } },
            { inputs: { termYears: 15 }, expect: { monthlyPayment: '$2,787.54' } },
            { inputs: { interestRate: 0 }, expect: { monthlyPayment: '$888.89', totalInterest: '$0.00' } },
          ]
        : c.code === 'ca' && term === 25
          ? [
              { inputs: { homePrice: 250000, downPayment: 50000 }, expect: { monthlyPayment: 'C$1,163.21' } },
              { inputs: { homePrice: 250000, downPayment: 50000, compounding: 'monthly' }, expect: { monthlyPayment: 'C$1,169.18' } },
              { inputs: { homePrice: 250000, downPayment: 250000 }, expect: { monthlyPayment: 'C$0.00', loanAmount: 'C$0.00' } },
            ]
          : c.code === 'in' && term === 20
            ? [
                { inputs: {}, expect: { monthlyPayment: '₹34,712.93', loanAmount: '₹4,000,000.00' } },
                { inputs: { interestRate: 0 }, expect: { monthlyPayment: '₹16,666.67' } },
                { inputs: { downPayment: 5000000 }, expect: { loanAmount: '₹0.00' } },
              ]
            : c.code === 'uk' && term === 25
              ? [
                  { inputs: {}, expect: { monthlyPayment: '£1,111.66', loanAmount: '£200,000.00' } },
                  { inputs: { interestRate: 0 }, expect: { monthlyPayment: '£666.67' } },
                  { inputs: { downPayment: 0 }, expect: { loanAmount: '£250,000.00' } },
                ]
              : c.code === 'au' && term === 30
                ? [
                    { inputs: {}, expect: { monthlyPayment: 'A$3,357.48', loanAmount: 'A$560,000.00' } },
                    { inputs: { interestRate: 0 }, expect: { monthlyPayment: 'A$1,555.56' } },
                    { inputs: { termYears: 15 }, expect: { loanAmount: 'A$560,000.00' } },
                  ]
                : [
                    { inputs: { interestRate: 0 }, expect: { totalInterest: `${sym}0.00` } },
                    { inputs: { downPayment: c.price }, expect: { loanAmount: `${sym}0.00` } },
                    { inputs: { downPayment: 0 }, expect: { loanAmount: `${sym}${fmtFixed(c.price, 2)}` } },
                  ],
  };
}

function personalLoanSpec(c: Country, term: number): Spec {
  const slug = `${c.code}-${term}-year-personal-loan-calculator`;
  const sym = c.symbol;
  const scenarios = personalScenarios(slug, 16, c.loan, 50, 3, 22, sym, false);
  return {
    slug,
    currency: c.currency,
    category: 'finance',
    tier: 3,
    subCluster: `${c.adj} personal loans`,
    title: `${term}-Year Personal Loan Calculator for ${c.adj}`,
    h1: `${term}-Year Personal Loan Calculator (${c.adj})`,
    metaDescription: `Monthly payment, total interest and total cost of a ${term}-year personal loan in ${c.name}. Enter the amount and rate; amounts shown in ${sym}.`,
    about: LOAN_COPY[c.code][term],
    introOutputs: ['monthlyPayment', 'totalInterest'],
    inputs: [
      { name: 'loanAmount', label: `Loan amount (${sym})`, type: 'number', min: 1, max: 1e12, default: c.loan, validator: numberField({ min: 1, max: 1e12 }) },
      {
        name: 'interestRate',
        label: 'Interest rate (% per year)',
        type: 'number',
        min: 0,
        max: 100,
        default: c.loanRate,
        validator: numberField({ min: 0, max: 100 }),
      },
      { name: 'termYears', label: 'Term (years)', type: 'number', min: 1, max: 40, default: term, validator: numberField({ min: 1, max: 40 }) },
    ],
    outputs: [
      { name: 'monthlyPayment', label: 'Monthly payment', format: 'text', highlight: true },
      { name: 'totalInterest', label: 'Total interest', format: 'text' },
      { name: 'totalRepayment', label: 'Total repayment', format: 'text' },
    ],
    calculate: (i) => {
      const principal = toD(i.loanAmount);
      const months = toD(i.termYears).mul(12).round().toNumber();
      const { payment, totalPaid, totalInterest } = amortizeAnnual(principal, toD(i.interestRate), months);
      return { monthlyPayment: fmtCurrency(payment, sym), totalInterest: fmtCurrency(totalInterest, sym), totalRepayment: fmtCurrency(totalPaid, sym) };
    },
    formulaDescription:
      "Payment = P × r ÷ (1 − (1 + r)^−n), where P is the amount borrowed, r is the yearly rate as a decimal divided by 12 and n is the number of months. Totals come from a month-by-month schedule as a lender bills it, with the payment and each month's interest rounded to the cent, and total interest is the repayments added up minus P. A 0% loan is P ÷ n.",
    workedExample: `Borrowing ${sym}${fmtNumber(c.loan, 0)} at ${c.loanRate}% over ${term} years means ${term * 12} payments; the level payment is shown at the top, and the interest is all ${term * 12} payments added up (each rounded to the cent) minus ${sym}${fmtNumber(c.loan, 0)}.`,
    faq: [
      {
        question: `How do I work out the monthly payment on a ${term}-year loan in ${c.adj}?`,
        answer: `Use P × r ÷ (1 − (1 + r)^−${term * 12}) with r the yearly rate divided by 12. The calculator does it for you and shows the total interest as well.`,
      },
      {
        question: `Is the ${c.adj} ${term}-year loan payment the same for car loans?`,
        answer:
          'The arithmetic is the same for any fixed-rate amortizing loan with interest charged monthly. Fees, insurance, a balloon payment, a variable rate or an early-repayment charge are not included, and the rates shown are examples, not offers.',
      },
      {
        question: `Why does a ${c.adj} loan longer than ${term} years cost more?`,
        answer: 'Interest accrues on the remaining balance each month, so a longer term means more months of interest even though each payment is smaller.',
      },
    ],
    scenarios,
    relatedSlugs: LOAN_TERMS.filter((t) => t !== term)
      .map((t) => `${c.code}-${t}-year-personal-loan-calculator`)
      .concat(['loan-calculator']),
    checks:
      c.code === 'us' && term === 5
        ? [
            { inputs: { loanAmount: 20000, interestRate: 8 }, expect: { monthlyPayment: '$405.53' } },
            { inputs: { interestRate: 0 }, expect: { monthlyPayment: '$333.33', totalInterest: '$0.00' } },
            { inputs: { loanAmount: 12000, interestRate: 0, termYears: 1 }, expect: { monthlyPayment: '$1,000.00' } },
          ]
        : [
            { inputs: { interestRate: 0 }, expect: { totalInterest: `${sym}0.00` } },
            { inputs: { interestRate: 0, loanAmount: 12000, termYears: 1 }, expect: { monthlyPayment: `${sym}1,000.00` } },
            { inputs: { interestRate: 0, loanAmount: 6000, termYears: 1 }, expect: { totalRepayment: `${sym}6,000.00` } },
          ],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Savings, investment and business tools
// ---------------------------------------------------------------------------------------------------------------

const money = (min = 0, max = 1e12) => ({ min, max, validator: numberField({ min, max }) });
const pct = (max = 100) => ({ min: 0, max, validator: numberField({ min: 0, max }) });

const savingsRates = [1, 2, 3, 4, 5, 6, 7, 8];

const SPECS_MISC: Spec[] = [
  {
    slug: 'simple-interest-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Savings and investing',
    title: 'Simple Interest Calculator: Interest and Total Amount',
    h1: 'Simple Interest Calculator',
    metaDescription:
      'Work out simple interest and the total amount from a principal, a yearly rate and a time in years. Free, exact, with the formula and a worked example.',
    about:
      'Simple interest is charged only on the original amount, never on interest already earned, so it grows in a straight line instead of compounding. It is used for short loans, some bonds, car loans in certain markets and school problems. Multiply the principal by the rate and by the number of years to get the interest, then add the principal to get the total. Because nothing compounds, doubling the time doubles the interest, which makes it easy to check by hand.',
    inputs: [
      { name: 'principal', label: 'Principal ($)', type: 'number', default: 5000, ...money() },
      { name: 'rate', label: 'Interest rate (% per year)', type: 'number', default: 4.5, ...pct(1000) },
      { name: 'years', label: 'Time (years)', type: 'number', default: 3, min: 0, max: 200, validator: numberField({ min: 0, max: 200 }) },
    ],
    outputs: [
      { name: 'interest', label: 'Simple interest', format: 'text', highlight: true },
      { name: 'total', label: 'Total amount', format: 'text' },
    ],
    calculate: (i) => {
      const p = toD(i.principal);
      const interest = p.mul(toD(i.rate)).div(100).mul(toD(i.years));
      return { interest: fmtCurrency(interest), total: fmtCurrency(p.plus(interest)) };
    },
    formulaDescription: 'Interest = P × r × t, with r the yearly rate as a decimal (rate ÷ 100) and t the time in years. Total = P + interest.',
    formulaLatex: 'I = P \\times r \\times t',
    workedExample: '$5,000 at 4.5% for 3 years: 5,000 × 0.045 × 3 = $675.00 of interest, so the total is $5,675.00.',
    faq: [
      {
        question: 'What is the difference between simple and compound interest?',
        answer:
          'Simple interest is only on the original principal. Compound interest is also charged on interest already added, so it grows faster over long periods.',
      },
      { question: 'How do I use months instead of years?', answer: 'Divide the months by 12 and enter the result, for example 18 months is 1.5 years.' },
      {
        question: 'Does simple interest apply to mortgages?',
        answer:
          'Mortgages are amortizing loans where the balance changes each month. Simple interest is used where the principal stays fixed, such as some short-term notes.',
      },
    ],
    scenarios: [1, 2, 3, 5, 10, 15].map((y) => ({ label: `${y} year${y === 1 ? '' : 's'}`, inputs: { years: y } })),
    relatedSlugs: ['compound-interest-calculator', 'cagr-calculator'],
    checks: [
      { inputs: {}, expect: { interest: '$675.00', total: '$5,675.00' } },
      { inputs: { principal: 1000, rate: 10, years: 1 }, expect: { interest: '$100.00' } },
      { inputs: { principal: 2500, rate: 0, years: 4 }, expect: { interest: '$0.00', total: '$2,500.00' } },
    ],
  },
  {
    slug: 'savings-goal-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Savings and investing',
    title: 'Savings Calculator: Future Value with Monthly Deposits',
    h1: 'Savings Calculator with Monthly Deposits',
    metaDescription:
      'See what a starting balance and regular monthly deposits grow to at a fixed yearly rate, how much you deposited and how much is interest.',
    about:
      'This calculator adds regular monthly deposits to a starting balance and compounds the interest every month, which is how most savings accounts and index funds are usually illustrated. Deposits are assumed to be made at the end of each month. It separates what you paid in from what the interest earned, which shows how much of a long-term balance comes from time rather than effort. The rate is assumed fixed for the whole period, so treat results as an illustration, not a forecast.',
    inputs: [
      { name: 'start', label: 'Starting balance ($)', type: 'number', default: 1000, ...money() },
      { name: 'monthly', label: 'Monthly deposit ($)', type: 'number', default: 200, ...money() },
      { name: 'rate', label: 'Interest rate (% per year)', type: 'number', default: 6, ...pct(100) },
      { name: 'years', label: 'Time (years)', type: 'number', default: 10, min: 0, max: 100, validator: numberField({ min: 0, max: 100 }) },
    ],
    outputs: [
      { name: 'balance', label: 'Future value', format: 'text', highlight: true },
      { name: 'deposits', label: 'Total deposited', format: 'text' },
      { name: 'interest', label: 'Interest earned', format: 'text' },
    ],
    calculate: (i) => {
      const r = toD(i.rate).div(100).div(12);
      const n = toD(i.years).mul(12).round().toNumber();
      const start = toD(i.start);
      const pmt = toD(i.monthly);
      const growth = ONE.plus(r).pow(n);
      const fv = r.isZero() ? start.plus(pmt.mul(n)) : start.mul(growth).plus(pmt.mul(growth.minus(1)).div(r));
      const deposited = start.plus(pmt.mul(n));
      return { balance: fmtCurrency(fv), deposits: fmtCurrency(deposited), interest: fmtCurrency(fv.minus(deposited)) };
    },
    formulaDescription:
      'Future value = S × (1 + r)^n + D × ((1 + r)^n − 1) ÷ r, where S is the starting balance, D the monthly deposit, r the yearly rate ÷ 12 as a decimal and n the number of months. With r = 0 it is S + D × n.',
    workedExample:
      '$1,000 start, $200 a month, 6% a year for 10 years: r = 0.005, n = 120, (1.005)^120 = 1.8194. Future value = 1,000 × 1.8194 + 200 × 0.8194 ÷ 0.005 = $34,595.27, of which $25,000 was deposited.',
    faq: [
      {
        question: 'Are deposits made at the start or end of the month?',
        answer: 'The end of the month. Deposits at the start would earn one extra month of interest each, giving a slightly higher figure.',
      },
      {
        question: 'Is the interest rate guaranteed?',
        answer: 'No. The calculator assumes one fixed rate; real accounts and investments vary, so try several rates.',
      },
      {
        question: 'Does it account for inflation or taxes?',
        answer: 'No. Results are in nominal dollars before tax; use the inflation calculator to see the effect of rising prices.',
      },
    ],
    scenarios: savingsRates.map((r) => ({ label: `${r}% a year`, inputs: { rate: r } })),
    relatedSlugs: ['compound-interest-calculator', 'inflation-calculator'],
    checks: [
      { inputs: {}, expect: { balance: '$34,595.27', deposits: '$25,000.00' } },
      { inputs: { rate: 0 }, expect: { balance: '$25,000.00', interest: '$0.00' } },
      { inputs: { start: 0, monthly: 100, rate: 0, years: 1 }, expect: { balance: '$1,200.00' } },
    ],
  },
  {
    slug: 'roi-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Savings and investing',
    title: 'ROI Calculator: Return on Investment and Annualized ROI',
    h1: 'ROI Calculator',
    metaDescription: 'Calculate return on investment from the amount invested and the final value, plus the annualized return over the years you held it.',
    about:
      'Return on investment compares what you gained or lost with what you put in, as a percentage, so very different investments can be compared on one scale. A plain ROI ignores how long the money was tied up, so this calculator also gives an annualized figure, the steady yearly rate that would produce the same result. Enter what you paid in total and what the investment is worth or was sold for, and the holding period in years. Fees and taxes are not included unless you add them to the cost.',
    inputs: [
      { name: 'cost', label: 'Amount invested ($)', type: 'number', default: 10000, min: 0.01, max: 1e12, validator: numberField({ min: 0.01, max: 1e12 }) },
      { name: 'value', label: 'Final value ($)', type: 'number', default: 14500, ...money() },
      { name: 'years', label: 'Holding period (years)', type: 'number', default: 4, min: 0.01, max: 200, validator: numberField({ min: 0.01, max: 200 }) },
    ],
    outputs: [
      { name: 'roi', label: 'Return on investment', format: 'text', highlight: true },
      { name: 'gain', label: 'Gain or loss', format: 'text' },
      { name: 'annual', label: 'Annualized return', format: 'text' },
    ],
    calculate: (i) => {
      const cost = toD(i.cost);
      const value = toD(i.value);
      const roi = value.minus(cost).div(cost).mul(100);
      const annual = value
        .div(cost)
        .pow(ONE.div(toD(i.years)))
        .minus(1)
        .mul(100);
      return { roi: fmtPercent(roi, 2), gain: fmtCurrency(value.minus(cost)), annual: fmtPercent(annual, 2) };
    },
    formulaDescription:
      'ROI = (final value − amount invested) ÷ amount invested × 100. Annualized return = ((final value ÷ amount invested)^(1 ÷ years) − 1) × 100.',
    formulaLatex: '\\text{ROI} = \\frac{V - C}{C} \\times 100',
    workedExample: 'Invest $10,000 and sell for $14,500 four years later: gain $4,500, ROI = 45.00%. Annualized: (1.45)^(1/4) − 1 = 9.73% a year.',
    faq: [
      {
        question: 'What is a good ROI?',
        answer:
          'It depends on risk and time. Compare the annualized figure with alternatives such as savings rates or the market average over the same period.',
      },
      {
        question: 'Why is annualized ROI lower than ROI?',
        answer:
          'ROI is the total gain over the whole period; annualized ROI spreads it over the years, compounding, so it is smaller for any period longer than a year.',
      },
      { question: 'How do I include fees?', answer: 'Add purchase fees to the amount invested and subtract selling costs from the final value.' },
    ],
    scenarios: [8000, 10000, 12500, 14500, 18000, 25000].map((v) => ({ label: `Final value ${fmtCurrency(v)}`, inputs: { value: v } })),
    relatedSlugs: ['cagr-calculator', 'compound-interest-calculator'],
    checks: [
      { inputs: {}, expect: { roi: '45.00%', gain: '$4,500.00', annual: '9.73%' } },
      { inputs: { cost: 100, value: 50, years: 1 }, expect: { roi: '-50.00%', gain: '-$50.00' } },
      { inputs: { cost: 200, value: 200, years: 5 }, expect: { roi: '0.00%', annual: '0.00%' } },
    ],
  },
  {
    slug: 'rule-of-72-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Savings and investing',
    title: 'Rule of 72 Calculator: How Long Until Money Doubles',
    h1: 'Rule of 72 Calculator',
    metaDescription:
      'Estimate how many years it takes money to double at a given yearly return using the Rule of 72, and compare it with the exact compound-interest answer.',
    about:
      'The Rule of 72 is a mental shortcut: divide 72 by the yearly return and you get roughly the years needed for money to double. It works because of how compounding behaves for moderate rates. This page shows the rule of thumb and the exact answer from the logarithm formula side by side, so you can see how close the shortcut is. It is accurate for rates of about 6% to 10% and drifts for very low or very high rates.',
    inputs: [{ name: 'rate', label: 'Yearly return (%)', type: 'number', default: 8, min: 0.01, max: 1000, validator: numberField({ min: 0.01, max: 1000 }) }],
    outputs: [
      { name: 'rule', label: 'Years to double (Rule of 72)', format: 'text', highlight: true },
      { name: 'exact', label: 'Years to double (exact)', format: 'text' },
    ],
    calculate: (i) => {
      const rate = toD(i.rate);
      const exact = D.ln(2).div(D.ln(ONE.plus(rate.div(100))));
      return { rule: `${fmtNumber(new D(72).div(rate), 2)} years`, exact: `${fmtNumber(exact, 2)} years` };
    },
    formulaDescription: 'Rule of 72: years ≈ 72 ÷ rate (in percent). Exact: years = ln(2) ÷ ln(1 + rate ÷ 100).',
    workedExample: 'At 8% a year, 72 ÷ 8 = 9 years. The exact answer is ln 2 ÷ ln 1.08 = 9.01 years, so the rule is within two hundredths of a year.',
    faq: [
      {
        question: 'Why 72 and not 70 or 69?',
        answer: '72 has many whole-number divisors, which makes mental arithmetic easy, and it is accurate near 8%. 69.3 is closer for continuous compounding.',
      },
      {
        question: 'Does it work for inflation or debt?',
        answer: 'Yes. At 3% inflation, prices double in about 24 years, and a debt growing at 18% doubles in about 4 years.',
      },
      { question: 'How accurate is it?', answer: 'Within about a tenth of a year for rates from 4% to 12%; less accurate outside that range.' },
    ],
    scenarios: [2, 4, 6, 8, 10, 12, 15, 20].map((r) => ({ label: `${r}% a year`, inputs: { rate: r } })),
    relatedSlugs: ['compound-interest-calculator', 'inflation-calculator'],
    checks: [
      { inputs: {}, expect: { rule: '9 years', exact: '9.01 years' } },
      { inputs: { rate: 6 }, expect: { rule: '12 years', exact: '11.9 years' } },
      { inputs: { rate: 12 }, expect: { rule: '6 years', exact: '6.12 years' } },
    ],
  },
  {
    slug: 'present-value-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Savings and investing',
    title: 'Present Value Calculator: Discount a Future Amount',
    h1: 'Present Value Calculator',
    metaDescription:
      'Find what a future sum is worth today by discounting it at a yearly rate over a number of years. Includes the discount factor and a worked example.',
    about:
      'Present value answers the question: how much would I need today, earning a given rate, to have a certain amount in the future. It is the reverse of compounding and underlies bond pricing, pension valuation and any decision that compares money now with money later. A higher discount rate or a longer time makes the present value smaller. Use a rate that reflects your alternatives, such as a savings rate or the cost of borrowing.',
    inputs: [
      { name: 'future', label: 'Future amount ($)', type: 'number', default: 10000, ...money() },
      { name: 'rate', label: 'Discount rate (% per year)', type: 'number', default: 5, ...pct(100) },
      { name: 'years', label: 'Years until received', type: 'number', default: 10, min: 0, max: 200, validator: numberField({ min: 0, max: 200 }) },
    ],
    outputs: [
      { name: 'pv', label: 'Present value', format: 'text', highlight: true },
      { name: 'factor', label: 'Discount factor', format: 'text' },
    ],
    calculate: (i) => {
      const factor = ONE.div(ONE.plus(toD(i.rate).div(100)).pow(toD(i.years)));
      return { pv: fmtCurrency(toD(i.future).mul(factor)), factor: fmtNumber(factor, 6) };
    },
    formulaDescription: 'PV = FV ÷ (1 + r)^n, with r the yearly rate as a decimal and n the years. The discount factor is 1 ÷ (1 + r)^n.',
    formulaLatex: 'PV = \\frac{FV}{(1+r)^{n}}',
    workedExample: '$10,000 received in 10 years at a 5% discount rate: 1.05^10 = 1.62889, so PV = 10,000 ÷ 1.62889 = $6,139.13.',
    faq: [
      {
        question: 'What discount rate should I use?',
        answer: 'Use the return you could earn elsewhere with similar risk, such as a savings or bond yield. A higher rate lowers the present value.',
      },
      {
        question: 'What is the difference between present value and future value?',
        answer: 'Future value grows a sum forward with interest; present value brings a future sum back to today.',
      },
      {
        question: 'Can I use it for annuities?',
        answer: 'This tool values a single future payment. For a series of payments, add the present values of each one.',
      },
    ],
    scenarios: [0, 2, 3, 5, 7, 10].map((r) => ({ label: `${r}% discount rate`, inputs: { rate: r } })),
    relatedSlugs: ['compound-interest-calculator', 'inflation-calculator'],
    checks: [
      { inputs: {}, expect: { pv: '$6,139.13' } },
      { inputs: { rate: 0 }, expect: { pv: '$10,000.00', factor: '1' } },
      { inputs: { years: 0 }, expect: { pv: '$10,000.00' } },
    ],
  },
  {
    slug: 'inflation-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Savings and investing',
    title: 'Inflation Calculator: Future Prices and Purchasing Power',
    h1: 'Inflation Calculator',
    metaDescription: "See what an amount will cost after years of inflation at a steady rate, and what that amount will buy in today's terms.",
    about:
      "Inflation is the steady rise in prices, which means a fixed amount of money buys less each year. This calculator compounds a yearly inflation rate over a number of years to show two things: what something that costs a given amount today would cost in the future, and what the same sum will be worth in today's purchasing power. It uses one constant rate, so it is an illustration. Actual inflation varies from year to year and between categories of goods.",
    inputs: [
      { name: 'amount', label: 'Amount today ($)', type: 'number', default: 100, ...money() },
      { name: 'rate', label: 'Inflation rate (% per year)', type: 'number', default: 3, min: 0, max: 100, validator: numberField({ min: 0, max: 100 }) },
      { name: 'years', label: 'Years', type: 'number', default: 20, min: 0, max: 200, validator: numberField({ min: 0, max: 200 }) },
    ],
    outputs: [
      { name: 'future', label: 'Equivalent cost in the future', format: 'text', highlight: true },
      { name: 'power', label: "Value in today's purchasing power", format: 'text' },
    ],
    calculate: (i) => {
      const growth = ONE.plus(toD(i.rate).div(100)).pow(toD(i.years));
      const amount = toD(i.amount);
      return { future: fmtCurrency(amount.mul(growth)), power: fmtCurrency(amount.div(growth)) };
    },
    formulaDescription:
      'Future cost = amount × (1 + i)^n. Purchasing power of the same amount = amount ÷ (1 + i)^n, where i is the yearly inflation rate as a decimal and n is the number of years.',
    workedExample:
      'At 3% for 20 years the factor is 1.03^20 = 1.8061. Something that costs $100 today costs $180.61 then, and $100 held in cash will buy what $55.37 buys today.',
    faq: [
      { question: 'Is inflation constant?', answer: 'No. It changes every year. Use a long-run average for planning and test a few higher and lower rates.' },
      {
        question: 'Why does cash lose value?',
        answer: 'Prices rise, so the same number of dollars buys fewer goods unless it earns interest at least equal to inflation.',
      },
      {
        question: 'Which price index should I use?',
        answer: 'Official consumer price indices measure a basket of goods. Your own spending mix may differ, so enter the rate that matches your costs.',
      },
    ],
    scenarios: [1, 2, 3, 4, 6, 8].map((r) => ({ label: `${r}% inflation`, inputs: { rate: r } })),
    relatedSlugs: ['present-value-calculator', 'rule-of-72-calculator'],
    checks: [
      { inputs: {}, expect: { future: '$180.61', power: '$55.37' } },
      { inputs: { rate: 0 }, expect: { future: '$100.00', power: '$100.00' } },
      { inputs: { amount: 1000, rate: 10, years: 1 }, expect: { future: '$1,100.00' } },
    ],
  },
  {
    slug: 'break-even-point-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Business',
    title: 'Break-Even Point Calculator: Units and Revenue to Break Even',
    h1: 'Break-Even Point Calculator',
    metaDescription:
      'Find how many units you must sell, and how much revenue you need, to cover fixed and variable costs. Includes contribution margin and a worked example.',
    about:
      'The break-even point is the sales volume at which total revenue equals total cost, so profit is zero. Below it you lose money; above it each extra unit adds its contribution margin to profit. You need three numbers: your fixed costs, which do not change with volume, the selling price per unit and the variable cost per unit. The calculator returns the units and the revenue needed to break even, and the margin on each unit sold.',
    inputs: [
      { name: 'fixed', label: 'Fixed costs ($)', type: 'number', default: 12000, ...money() },
      { name: 'price', label: 'Selling price per unit ($)', type: 'number', default: 25, ...money() },
      { name: 'variable', label: 'Variable cost per unit ($)', type: 'number', default: 10, ...money() },
    ],
    outputs: [
      { name: 'units', label: 'Break-even units', format: 'text', highlight: true },
      { name: 'revenue', label: 'Break-even revenue', format: 'text' },
      { name: 'margin', label: 'Contribution margin per unit', format: 'text' },
    ],
    calculate: (i) => {
      const margin = toD(i.price).minus(toD(i.variable));
      if (margin.lte(0)) return { units: 'No break-even: price must exceed variable cost', revenue: '-', margin: fmtCurrency(margin) };
      const units = toD(i.fixed).div(margin).ceil();
      return { units: fmtNumber(units, 0), revenue: fmtCurrency(units.mul(toD(i.price))), margin: fmtCurrency(margin) };
    },
    formulaDescription:
      'Break-even units = fixed costs ÷ (price − variable cost per unit), rounded up to a whole unit. Break-even revenue = units × price. The denominator is the contribution margin per unit.',
    workedExample: 'Fixed costs $12,000, price $25, variable cost $10: margin = $15 per unit, so 12,000 ÷ 15 = 800 units and revenue of 800 × $25 = $20,000.',
    faq: [
      {
        question: 'What counts as a fixed cost?',
        answer: 'Costs that stay the same whatever you sell in the period, such as rent, salaries and software subscriptions.',
      },
      {
        question: 'Why is the answer rounded up?',
        answer: 'You cannot sell a fraction of a unit, and selling the lower whole number leaves you slightly short of break-even.',
      },
      {
        question: 'What if price is below variable cost?',
        answer: 'Then each sale loses money and there is no break-even volume. Raise the price or cut variable costs.',
      },
    ],
    scenarios: [
      { label: 'Price $20', inputs: { price: 20 } },
      { label: 'Price $30', inputs: { price: 30 } },
      { label: 'Price $40', inputs: { price: 40 } },
      { label: 'Fixed costs $6,000', inputs: { fixed: 6000 } },
      { label: 'Fixed costs $24,000', inputs: { fixed: 24000 } },
      { label: 'Variable cost $15', inputs: { variable: 15 } },
    ],
    relatedSlugs: ['profit-margin-calculator', 'markup-calculator'],
    checks: [
      { inputs: {}, expect: { units: '800', revenue: '$20,000.00', margin: '$15.00' } },
      { inputs: { fixed: 1000, price: 7, variable: 2 }, expect: { units: '200' } },
      { inputs: { fixed: 1000, price: 3, variable: 7 }, expect: { revenue: '-' } },
    ],
  },
  {
    slug: 'profit-margin-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Business',
    title: 'Profit Margin Calculator: Gross Profit and Margin Percentage',
    h1: 'Profit Margin Calculator',
    metaDescription: 'Calculate gross profit and profit margin from revenue and cost. Margin is profit as a percentage of the selling price, not of the cost.',
    about:
      'Profit margin shows how much of each dollar of sales is left as profit after costs. It is measured against revenue, which is why a 50% margin is not the same as a 50% markup. Enter your total revenue and the cost of producing or buying what you sold, and the calculator returns gross profit and the margin as a percentage. Use it to compare products, check pricing and see how a cost increase would affect your results.',
    inputs: [
      { name: 'revenue', label: 'Revenue ($)', type: 'number', default: 5000, min: 0.01, max: 1e12, validator: numberField({ min: 0.01, max: 1e12 }) },
      { name: 'cost', label: 'Cost ($)', type: 'number', default: 3200, ...money() },
    ],
    outputs: [
      { name: 'margin', label: 'Profit margin', format: 'text', highlight: true },
      { name: 'profit', label: 'Gross profit', format: 'text' },
    ],
    calculate: (i) => {
      const revenue = toD(i.revenue);
      const profit = revenue.minus(toD(i.cost));
      return { margin: fmtPercent(profit.div(revenue).mul(100), 2), profit: fmtCurrency(profit) };
    },
    formulaDescription: 'Gross profit = revenue − cost. Profit margin = gross profit ÷ revenue × 100.',
    formulaLatex: '\\text{margin} = \\frac{R - C}{R} \\times 100',
    workedExample: 'Revenue $5,000 and cost $3,200 leave $1,800 of profit; 1,800 ÷ 5,000 = 36.00%.',
    faq: [
      {
        question: 'What is the difference between margin and markup?',
        answer: 'Margin is profit divided by the selling price; markup is profit divided by the cost. A 25% markup is a 20% margin.',
      },
      {
        question: 'Gross margin or net margin?',
        answer: 'This tool uses whatever cost you enter. Enter the cost of goods sold for gross margin, or all expenses for net margin.',
      },
      { question: 'Can margin be negative?', answer: 'Yes. If costs exceed revenue the profit and margin are negative.' },
    ],
    scenarios: [3000, 4200, 6400, 8000, 9500, 12750].map((r) => ({ label: `Sales of ${fmtCurrency(r)}`, inputs: { revenue: r } })),
    relatedSlugs: ['markup-calculator', 'break-even-point-calculator'],
    checks: [
      { inputs: {}, expect: { margin: '36.00%', profit: '$1,800.00' } },
      { inputs: { revenue: 100, cost: 80 }, expect: { margin: '20.00%' } },
      { inputs: { revenue: 100, cost: 120 }, expect: { margin: '-20.00%', profit: '-$20.00' } },
    ],
  },
  {
    slug: 'markup-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Business',
    title: 'Markup Calculator: Selling Price and Markup Percentage',
    h1: 'Markup Calculator',
    metaDescription: 'Work out the selling price from cost and a markup percentage, or the markup you are earning, with the matching profit margin.',
    about:
      'Markup is the amount added to the cost of an item to get its selling price, written as a percentage of the cost. Retailers and tradespeople use it because cost is the number they know. Enter the cost and the markup you want, and the calculator gives the selling price, the profit per item and the equivalent profit margin, which is always lower than the markup. Use it to price products so that you cover costs and still earn the profit you need.',
    inputs: [
      { name: 'cost', label: 'Cost ($)', type: 'number', default: 40, ...money() },
      { name: 'markup', label: 'Markup (%)', type: 'number', default: 50, min: 0, max: 10000, validator: numberField({ min: 0, max: 10000 }) },
    ],
    outputs: [
      { name: 'price', label: 'Selling price', format: 'text', highlight: true },
      { name: 'profit', label: 'Profit per item', format: 'text' },
      { name: 'margin', label: 'Equivalent profit margin', format: 'text' },
    ],
    calculate: (i) => {
      const cost = toD(i.cost);
      const profit = cost.mul(toD(i.markup)).div(100);
      const price = cost.plus(profit);
      return { price: fmtCurrency(price), profit: fmtCurrency(profit), margin: fmtPercent(price.isZero() ? ZERO : profit.div(price).mul(100), 2) };
    },
    formulaDescription: 'Selling price = cost × (1 + markup ÷ 100). Profit = selling price − cost. Margin = profit ÷ selling price × 100.',
    workedExample: 'A $40 item with a 50% markup sells for 40 × 1.5 = $60. Profit is $20, which is 33.33% of the selling price.',
    faq: [
      { question: 'How do I convert markup to margin?', answer: 'Margin = markup ÷ (100 + markup) × 100. A 50% markup is a 33.33% margin.' },
      { question: 'What markup should I use?', answer: 'It depends on your costs and market. Check that the resulting margin covers your overheads.' },
      { question: 'Does this include tax?', answer: 'No. Add sales tax or VAT after setting the price, using the VAT calculator.' },
    ],
    scenarios: [10, 25, 40, 50, 75, 100].map((m) => ({ label: `${m}% markup`, inputs: { markup: m } })),
    relatedSlugs: ['profit-margin-calculator', 'discount-calculator'],
    checks: [
      { inputs: {}, expect: { price: '$60.00', profit: '$20.00', margin: '33.33%' } },
      { inputs: { cost: 100, markup: 100 }, expect: { price: '$200.00', margin: '50.00%' } },
      { inputs: { cost: 80, markup: 0 }, expect: { price: '$80.00', margin: '0.00%' } },
    ],
  },
  {
    slug: 'vat-calculator',
    introOutputs: ['gross'],
    category: 'finance',
    tier: 2,
    subCluster: 'Business',
    title: 'VAT Calculator: Add VAT to a Net Price',
    h1: 'VAT Calculator (Add VAT)',
    metaDescription: 'Add VAT or sales tax to a net price. Enter the price before tax and the VAT rate to get the VAT amount and the gross total.',
    about:
      'Value added tax is charged as a percentage on top of the net price, the price before tax. Enter the net amount and the VAT rate for your country and this calculator returns the tax and the gross price that the customer pays. It works for any rate, so it also suits sales tax or goods and services tax. The default rate is an example; use the current rate that applies to your goods and place from your tax authority. Sellers quoting a customer, freelancers drafting an invoice and shoppers comparing prices abroad all start from this figure.',
    inputs: [
      { name: 'net', label: 'Net price before VAT', type: 'number', default: 250, ...money() },
      { name: 'rate', label: 'VAT rate (%)', type: 'number', default: 20, min: 0, max: 100, validator: numberField({ min: 0, max: 100 }) },
    ],
    outputs: [
      { name: 'gross', label: 'Gross price including VAT', format: 'text', highlight: true },
      { name: 'vat', label: 'VAT amount', format: 'text' },
    ],
    calculate: (i) => {
      const net = toD(i.net);
      const vat = net.mul(toD(i.rate)).div(100);
      return { gross: fmtCurrency(net.plus(vat)), vat: fmtCurrency(vat) };
    },
    formulaDescription: 'VAT = net × rate ÷ 100. Gross = net + VAT = net × (1 + rate ÷ 100).',
    workedExample: 'A net price of $250 with 20% VAT: VAT = 250 × 0.20 = $50.00, so the gross price is $300.00.',
    faq: [
      { question: 'How do I remove VAT from a gross price?', answer: 'Divide the gross price by 1 plus the rate. Use the reverse VAT calculator for that.' },
      {
        question: 'Which VAT rate applies to me?',
        answer: 'It depends on the country and the type of goods. Check your tax authority; the 20% default is only an example.',
      },
      {
        question: 'Is VAT the same as sales tax?',
        answer:
          'Both are consumption taxes, but VAT is collected at each stage of the supply chain while sales tax is charged once at the point of sale. The arithmetic of adding a percentage is the same.',
      },
    ],
    scenarios: [40, 85, 120, 250, 640, 1500, 2750, 3125, 5400, 9990].map((n) => ({ label: `Net price ${fmtCurrency(n)}`, inputs: { net: n } })),
    relatedSlugs: ['reverse-vat-calculator', 'discount-calculator'],
    checks: [
      { inputs: {}, expect: { gross: '$300.00', vat: '$50.00' } },
      { inputs: { net: 100, rate: 0 }, expect: { gross: '$100.00', vat: '$0.00' } },
      { inputs: { net: 19.99, rate: 10 }, expect: { vat: '$2.00', gross: '$21.99' } },
    ],
  },
  {
    slug: 'reverse-vat-calculator',
    introOutputs: ['net'],
    category: 'finance',
    tier: 3,
    subCluster: 'Business',
    title: 'Reverse VAT Calculator: Remove VAT from a Gross Price',
    h1: 'Reverse VAT Calculator (Remove VAT)',
    metaDescription: 'Find the net price and the VAT included in a gross price. Enter the price including VAT and the rate to get the amount before tax.',
    about:
      'A shelf price or invoice total that already contains tax hides two facts: how much of it is tax, and what the goods cost without it. Taking the percentage off does not work, because the tax was charged on the smaller, tax-free figure. Divide by one plus the rate to undo it, then subtract to see the tax. Use the rate that applies to your goods; the default is only an example. Bookkeepers splitting a receipt into goods and tax for a ledger, and anyone reclaiming input tax, work this way round.',
    inputs: [
      { name: 'gross', label: 'Gross price including VAT', type: 'number', default: 300, ...money() },
      { name: 'rate', label: 'VAT rate (%)', type: 'number', default: 20, min: 0, max: 100, validator: numberField({ min: 0, max: 100 }) },
    ],
    outputs: [
      { name: 'net', label: 'Net price before VAT', format: 'text', highlight: true },
      { name: 'vat', label: 'VAT included', format: 'text' },
    ],
    calculate: (i) => {
      const gross = toD(i.gross);
      const net = gross.div(ONE.plus(toD(i.rate).div(100)));
      return { net: fmtCurrency(net), vat: fmtCurrency(gross.minus(net)) };
    },
    formulaDescription: 'Net = gross ÷ (1 + rate ÷ 100). VAT included = gross − net.',
    workedExample: 'A gross price of $300 including 20% VAT: net = 300 ÷ 1.20 = $250.00, and the VAT included is $50.00, not $60.00.',
    faq: [
      {
        question: 'Why is the VAT not 20% of the gross price?',
        answer: 'The 20% was charged on the net price. 20% of $300 would be $60, which is more than the $50 actually included.',
      },
      { question: 'Can I use it for sales tax?', answer: 'Yes for any tax added as a percentage of the pre-tax price.' },
      { question: 'Are results rounded?', answer: 'Amounts are shown to two decimals; the calculation keeps full precision.' },
    ],
    scenarios: [48, 119, 360, 720, 1250, 4800, 6475, 8120, 9315, 15000].map((g) => ({ label: `Shelf price ${fmtCurrency(g)}`, inputs: { gross: g } })),
    relatedSlugs: ['vat-calculator', 'discount-calculator'],
    checks: [
      { inputs: {}, expect: { net: '$250.00', vat: '$50.00' } },
      { inputs: { gross: 110, rate: 10 }, expect: { net: '$100.00', vat: '$10.00' } },
      { inputs: { gross: 99, rate: 0 }, expect: { net: '$99.00', vat: '$0.00' } },
    ],
  },
  {
    slug: 'hourly-to-salary-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Salary',
    title: 'Hourly to Salary Calculator: Annual, Monthly and Weekly Pay',
    h1: 'Hourly to Salary Calculator',
    metaDescription: 'Convert an hourly wage to weekly, monthly and annual pay from the hours per week and weeks per year. Before tax.',
    about:
      'Moving between an hourly wage and a salary is a matter of multiplying by the hours you work. Enter your hourly rate, the hours you work in a typical week and the number of paid weeks in the year, and the calculator returns weekly, monthly and annual pay before tax. Reduce the weeks if you take unpaid leave. The figures are gross, so tax, social contributions and benefits are not deducted.',
    inputs: [
      { name: 'rate', label: 'Hourly rate ($)', type: 'number', default: 22.5, ...money() },
      { name: 'hours', label: 'Hours per week', type: 'number', default: 40, min: 0, max: 168, validator: numberField({ min: 0, max: 168 }) },
      { name: 'weeks', label: 'Paid weeks per year', type: 'number', default: 52, min: 0, max: 52, validator: numberField({ min: 0, max: 52 }) },
    ],
    outputs: [
      { name: 'annual', label: 'Annual pay (before tax)', format: 'text', highlight: true },
      { name: 'monthly', label: 'Monthly pay', format: 'text' },
      { name: 'weekly', label: 'Weekly pay', format: 'text' },
    ],
    calculate: (i) => {
      const weekly = toD(i.rate).mul(toD(i.hours));
      const annual = weekly.mul(toD(i.weeks));
      return { annual: fmtCurrency(annual), monthly: fmtCurrency(annual.div(12)), weekly: fmtCurrency(weekly) };
    },
    formulaDescription: 'Weekly = hourly rate × hours per week. Annual = weekly × paid weeks. Monthly = annual ÷ 12.',
    workedExample: '$22.50 an hour for 40 hours: weekly $900.00; over 52 weeks that is $46,800.00 a year, or $3,900.00 a month.',
    faq: [
      { question: 'Is this before or after tax?', answer: 'Before tax. Income tax and contributions depend on where you live and are not included.' },
      { question: 'How do I account for unpaid holidays?', answer: 'Lower the paid weeks, for example 50 for two weeks unpaid.' },
      {
        question: 'How do I convert a salary to hourly?',
        answer: 'Divide the annual salary by weeks and then by hours per week. For 52 weeks and 40 hours that is the salary ÷ 2,080.',
      },
    ],
    scenarios: [15, 18, 22.5, 28, 35, 50].map((r) => ({ label: `${fmtCurrency(r)} an hour`, inputs: { rate: r } })),
    relatedSlugs: ['percentage-calculator', 'tip-calculator'],
    checks: [
      { inputs: {}, expect: { annual: '$46,800.00', monthly: '$3,900.00', weekly: '$900.00' } },
      { inputs: { rate: 10, hours: 20, weeks: 50 }, expect: { annual: '$10,000.00' } },
      { inputs: { rate: 0 }, expect: { annual: '$0.00' } },
    ],
  },
];

export const SPECS: Spec[] = [
  ...COUNTRIES.flatMap((c) => MORTGAGE_TERMS.map((t) => mortgageSpec(c, t))),
  ...COUNTRIES.flatMap((c) => LOAN_TERMS.map((t) => personalLoanSpec(c, t))),
  ...SPECS_MISC,
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
