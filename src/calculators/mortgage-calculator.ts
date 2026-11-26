import { numberField } from '../lib/calc-utils';
import { HUNDRED, ZERO, toD } from '../lib/decimal';
import { amortizeAnnual } from '../lib/finance';
import { fmtCurrency, fmtPercent } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const config: CalculatorConfig = {
  slug: 'mortgage-calculator',
  category: 'finance',
  tier: 1,
  publish: true,
  title: 'Mortgage Calculator: Monthly Payment, Interest and Total Cost',
  h1: 'Mortgage Calculator',
  metaDescription:
    'Work out your monthly mortgage payment, total interest and total cost from the home price, down payment, interest rate and loan term. Free, instant and exact to the cent.',
  intro:
    'On a $400,000 home with $80,000 down, a 30-year mortgage at 6.5% interest costs $2,022.62 a month in principal and interest, and about $408,140.64 in interest over the life of the loan. Change the home price, down payment, rate or term above and the payment, total interest and total cost update as you type. The monthly figure comes from the standard amortizing-loan formula that lenders use, so it matches the principal-and-interest line on a loan estimate to the cent. Keep in mind that a real monthly housing bill is larger: property tax, homeowners insurance, mortgage insurance when you put down less than 20 percent, and any association dues all sit on top of this number. Use the calculator to compare scenarios side by side, for example how much a bigger down payment saves, or how a 15-year term trades a higher payment for far less interest. Because the loan amount is the price minus the down payment, a larger deposit lowers both the payment and the interest, and even a quarter-point difference in the rate can move the lifetime cost by tens of thousands of dollars.',
  inputs: [
    { name: 'homePrice', label: 'Home price ($)', type: 'number', min: 1, max: 100000000, default: 400000, validator: numberField({ min: 1, max: 100000000 }) },
    {
      name: 'downPayment',
      label: 'Down payment ($)',
      type: 'number',
      min: 0,
      max: 100000000,
      default: 80000,
      validator: numberField({ min: 0, max: 100000000 }),
    },
    { name: 'interestRate', label: 'Interest rate (% per year)', type: 'number', min: 0, max: 30, default: 6.5, validator: numberField({ min: 0, max: 30 }) },
    { name: 'termYears', label: 'Loan term (years)', type: 'number', min: 1, max: 50, default: 30, validator: numberField({ min: 1, max: 50 }) },
  ],
  outputs: [
    { name: 'monthlyPayment', label: 'Monthly payment (principal and interest)', format: 'currency', highlight: true },
    { name: 'loanAmount', label: 'Loan amount', format: 'currency' },
    { name: 'totalInterest', label: 'Total interest', format: 'currency' },
    { name: 'totalPaid', label: 'Total paid to the lender', format: 'currency' },
    { name: 'loanToValue', label: 'Loan-to-value', format: 'percent' },
  ],
  calculate: (i) => {
    const price = toD(i.homePrice);
    const loan = price.minus(toD(i.downPayment));
    const principal = loan.gt(0) ? loan : ZERO;
    const months = toD(i.termYears).mul(12).round().toNumber();
    const { payment, totalPaid, totalInterest } = amortizeAnnual(principal, toD(i.interestRate), months);
    return {
      monthlyPayment: fmtCurrency(payment),
      loanAmount: fmtCurrency(principal),
      totalInterest: fmtCurrency(totalInterest),
      totalPaid: fmtCurrency(totalPaid),
      loanToValue: fmtPercent(price.gt(0) ? principal.div(price).mul(HUNDRED) : ZERO, 1),
    };
  },
  formulaDescription:
    'Monthly payment M = P × r × (1 + r)^n ÷ ((1 + r)^n − 1), where P is the loan amount (home price minus down payment), r is the monthly rate (annual rate ÷ 100 ÷ 12) and n is the number of monthly payments (years × 12). At a 0% rate M = P ÷ n. The totals come from a month-by-month schedule the way a lender bills: the payment is rounded to the cent, the monthly interest is rounded to the cent and the last payment clears the balance. Total paid is the sum of all payments and total interest is that minus P. Because of the rounding, this can differ by a dollar or two from the rounded payment multiplied by n.',
  scenarios: [
    { label: 'Default: $80,000 down, 6.5%, 30 years', inputs: {} },
    { label: 'Shorter term: 15 years', inputs: { termYears: 15 } },
    { label: 'Lower rate: 5.5%', inputs: { interestRate: 5.5 } },
    { label: 'Higher rate: 7.5%', inputs: { interestRate: 7.5 } },
    { label: 'Smaller down payment: $40,000', inputs: { downPayment: 40000 } },
  ],
  assumptions: [
    'A fixed rate and equal monthly payments for the whole term.',
    'Principal and interest only: taxes, insurance and fees are not included.',
    'Interest is charged monthly at one twelfth of the annual rate; the payment and each month of interest are rounded to the cent, as a lender bills, and the last payment clears the balance.',
  ],
  references: [
    {
      title: 'The Basics of Loans (Contemporary Mathematics, section 6.8)',
      publisher: 'OpenStax, Rice University',
      url: 'https://openstax.org/books/contemporary-mathematics/pages/6-8-the-basics-of-loans',
      accessed: '2026-11-26',
      supports:
        'How to calculate the payment needed to pay off an installment loan and how an amortization table splits each payment between interest and principal.',
    },
    {
      title: 'Loan Amortization (Principles of Finance 2e, section 8.3)',
      publisher: 'OpenStax, Rice University',
      url: 'https://openstax.org/books/principles-finance-2e/pages/8-3-loan-amortization',
      accessed: '2026-11-26',
      supports:
        'The present value of an annuity formula PV = PYMT x [1 - 1/(1 + r)^n] / r that gives the payment on a loan, and how to build an amortization schedule.',
    },
  ],
  workedExample:
    'A $200,000 loan at 6% for 30 years: r = 0.06 ÷ 12 = 0.005 and n = 360. (1.005)^360 ≈ 6.022575, so M = 200,000 × 0.005 × 6.022575 ÷ 5.022575 = $1,199.10. Paid month by month with each payment and the monthly interest rounded to the cent, the 360 payments total $431,677.04, which makes the total interest $231,677.04.',
  faq: [
    {
      question: 'How is a monthly mortgage payment calculated?',
      answer:
        'Lenders use the amortizing-loan formula: the loan amount multiplied by the monthly rate, divided by one minus the monthly growth factor raised to the power of minus the number of payments. Each payment is the same amount, but early payments are mostly interest and later payments are mostly principal.',
    },
    {
      question: 'Does this payment include property tax and homeowners insurance?',
      answer:
        'No. The result is principal and interest only. Property tax, homeowners insurance, private mortgage insurance and association dues are added by your lender or paid separately, so your real monthly housing cost will be higher.',
    },
    {
      question: 'How much interest will I pay over a 30-year mortgage?',
      answer:
        'It depends on the rate, but at typical rates the total interest over 30 years is often close to or above the amount you borrowed. Enter your own numbers above to see the exact figure, then try a 15-year term to compare.',
    },
    {
      question: 'Is a 15-year or a 30-year mortgage better?',
      answer:
        'A 15-year loan has a higher monthly payment but a lower rate and far less total interest. A 30-year loan has a lower payment and more flexibility but costs more overall. The right choice depends on whether the monthly budget or the lifetime cost matters more to you.',
    },
  ],
  relatedSlugs: ['loan-calculator', 'compound-interest-calculator', 'cagr-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
