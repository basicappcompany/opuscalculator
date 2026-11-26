import { numberField } from '../lib/calc-utils';
import { HUNDRED, ZERO, toD } from '../lib/decimal';
import { amortizeAnnual } from '../lib/finance';
import { fmtCurrency, fmtPercent } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const config: CalculatorConfig = {
  slug: 'loan-calculator',
  category: 'finance',
  tier: 2,
  publish: false,
  title: 'Loan Calculator: Monthly Payment and Total Interest for Any Loan',
  h1: 'Loan Calculator',
  metaDescription:
    'Calculate the monthly payment, total interest and total repayment on a fixed-rate personal, auto or student loan. Enter the amount, rate and term in months.',
  intro:
    'Borrowing $25,000 at 7.5% a year and paying it back over 60 months means a fixed payment of $500.95, $5,056.96 in total interest and $30,056.96 repaid altogether. This calculator is built for ordinary installment loans such as a car loan, a personal loan, a student loan or a loan from a family member, where the rate is fixed and the same amount is paid every month. Type in the amount, the yearly rate and the length of the loan in months, and the monthly payment, interest cost and total repayment appear straight away. It is a quick way to test whether a payment fits your budget before you apply, and to see what a shorter or longer term does to the price of borrowing. A longer term lowers the monthly payment but raises the interest, while a shorter term does the opposite. Remember that lenders may add an origination fee, so the annual percentage rate they quote can be higher than the interest rate used here, and that variable-rate loans will not follow a single fixed payment.',
  inputs: [
    {
      name: 'loanAmount',
      label: 'Loan amount ($)',
      type: 'number',
      min: 1,
      max: 100000000,
      default: 25000,
      validator: numberField({ min: 1, max: 100000000 }),
    },
    { name: 'interestRate', label: 'Interest rate (% per year)', type: 'number', min: 0, max: 100, default: 7.5, validator: numberField({ min: 0, max: 100 }) },
    {
      name: 'termMonths',
      label: 'Loan term (months)',
      type: 'number',
      min: 1,
      max: 600,
      default: 60,
      validator: numberField({ min: 1, max: 600, integer: true }),
    },
  ],
  outputs: [
    { name: 'monthlyPayment', label: 'Monthly payment', format: 'currency', highlight: true },
    { name: 'totalInterest', label: 'Total interest', format: 'currency' },
    { name: 'totalRepayment', label: 'Total repayment', format: 'currency' },
    { name: 'interestShare', label: 'Share of repayment that is interest', format: 'percent' },
  ],
  calculate: (i) => {
    const amount = toD(i.loanAmount);
    const months = toD(i.termMonths).round().toNumber();
    const { payment, totalPaid: total, totalInterest } = amortizeAnnual(amount, toD(i.interestRate), months);
    return {
      monthlyPayment: fmtCurrency(payment),
      totalInterest: fmtCurrency(totalInterest),
      totalRepayment: fmtCurrency(total),
      interestShare: fmtPercent(total.gt(0) ? totalInterest.div(total).mul(HUNDRED) : ZERO, 1),
    };
  },
  formulaDescription:
    'Payment = P × r ÷ (1 − (1 + r)^−n), where P is the amount borrowed, r is the monthly interest rate (annual rate ÷ 100 ÷ 12) and n is the number of monthly payments. With a 0% rate the payment is simply P ÷ n. Totals come from a month-by-month schedule as a lender bills it: the payment and the monthly interest are rounded to the cent and the last payment clears the balance. Total repayment is the sum of the payments, and total interest is that minus P.',
  workedExample:
    'Borrow $10,000 at 5% for 12 months: r = 0.05 ÷ 12 = 0.0041667 and n = 12. (1 + r)^−12 = 0.951352, so the payment = 10,000 × 0.0041667 ÷ (1 − 0.951352) = $856.07. Over 12 months that is $10,272.90 repaid, which is $272.90 of interest.',
  faq: [
    {
      question: 'What is the difference between the interest rate and the APR on a loan?',
      answer:
        'The interest rate is the yearly cost of the money you borrow. The APR also folds in upfront fees such as an origination fee, so it is usually a little higher. This calculator uses the interest rate, so add any fees separately when you compare offers.',
    },
    {
      question: 'How does the loan term change what I pay?',
      answer:
        'A longer term spreads the balance over more payments, so each one is smaller, but you pay interest for more months and the total cost rises. A shorter term has bigger payments and a lower total cost.',
    },
    {
      question: 'Can I use this for a car loan or a student loan?',
      answer:
        'Yes, as long as the rate is fixed and the loan is repaid in equal monthly installments. Enter the amount financed, the yearly rate and the term in months. Loans with a variable rate or deferred interest need a different calculation.',
    },
    {
      question: 'What happens if I pay extra each month?',
      answer:
        'Extra payments go straight to the balance, which shortens the loan and cuts the interest. This calculator shows the standard schedule without extra payments, so your real payoff date and interest cost would be lower.',
    },
  ],
  relatedSlugs: ['mortgage-calculator', 'compound-interest-calculator', 'discount-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
