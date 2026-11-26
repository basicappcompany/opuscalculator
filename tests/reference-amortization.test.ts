import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import loan from '../src/calculators/loan-calculator';
import mortgage from '../src/calculators/mortgage-calculator';
import { runner } from './helpers';

/**
 * Item 9.1: the mortgage and loan calculators must match a reference amortization schedule to the cent.
 * The reference below is written independently of src/lib/finance.ts on purpose: plain decimal.js, one loop, the way
 * a lender bills (payment rounded to the cent, interest rounded to the cent each month, final payment clears the balance).
 */
const Dec = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

function referenceSchedule(principal: number, annualPercent: number, months: number) {
  const r = new Dec(annualPercent).div(1200);
  const exact = r.isZero() ? new Dec(principal).div(months) : new Dec(principal).mul(r).div(new Dec(1).minus(new Dec(1).plus(r).pow(-months)));
  const payment = exact.toDecimalPlaces(2);
  let balance = new Dec(principal);
  let paid = new Dec(0);
  const rows: { month: number; interest: Decimal; payment: Decimal; balance: Decimal }[] = [];
  for (let month = 1; month <= months && balance.gt(0); month++) {
    const interest = balance.mul(r).toDecimalPlaces(2);
    const due = balance.plus(interest);
    const pay = month === months || payment.gt(due) ? due : payment;
    balance = due.minus(pay);
    paid = paid.plus(pay);
    rows.push({ month, interest, payment: pay, balance });
  }
  return { payment, totalPaid: paid, totalInterest: paid.minus(principal), rows };
}

const usd = (d: Decimal) => {
  const [int, frac] = d.toFixed(2).split('.');
  return `$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
};

const mortgageCases: [number, number, number][] = [
  [320000, 6.5, 30],
  [200000, 6, 30],
  [100000, 5, 15],
  [300000, 4, 30],
  [250000, 7.25, 20],
  [450000, 3.125, 25],
  [95000, 8.99, 10],
  [1000000, 2.5, 40],
  [60000, 0.5, 5],
  [180000, 12, 30],
];

const loanCases: [number, number, number][] = [
  [25000, 7.5, 60],
  [10000, 5, 12],
  [20000, 6, 60],
  [5000, 12, 12],
  [8000, 19.99, 36],
  [1500, 0.9, 6],
  [75000, 4.4, 84],
];

describe('reference amortization schedule (item 9.1)', () => {
  const runMortgage = runner(mortgage);
  it.each(mortgageCases)('mortgage %i at %f%% for %i years matches the schedule to the cent', (loanAmount, rate, years) => {
    const ref = referenceSchedule(loanAmount, rate, years * 12);
    const r = runMortgage({ homePrice: loanAmount, downPayment: 0, interestRate: rate, termYears: years });
    expect(r.monthlyPayment).toBe(usd(ref.payment));
    expect(r.totalInterest).toBe(usd(ref.totalInterest));
    expect(r.totalPaid).toBe(usd(ref.totalPaid));
  });

  const runLoan = runner(loan);
  it.each(loanCases)('loan %i at %f%% for %i months matches the schedule to the cent', (amount, rate, months) => {
    const ref = referenceSchedule(amount, rate, months);
    const r = runLoan({ loanAmount: amount, interestRate: rate, termMonths: months });
    expect(r.monthlyPayment).toBe(usd(ref.payment));
    expect(r.totalInterest).toBe(usd(ref.totalInterest));
    expect(r.totalRepayment).toBe(usd(ref.totalPaid));
  });

  it('the reference schedule itself is sound: balance reaches exactly zero and interest adds up', () => {
    const ref = referenceSchedule(200000, 6, 360);
    expect(ref.rows).toHaveLength(360);
    expect(ref.rows.at(-1)!.balance.toFixed(2)).toBe('0.00');
    const interest = ref.rows.reduce((sum, row) => sum.plus(row.interest), new Dec(0));
    expect(ref.totalInterest.toFixed(2)).toBe(interest.toFixed(2));
    // First month on $200,000 at 6%: interest $1,000.00, so $199.10 goes to principal.
    expect(ref.rows[0].interest.toFixed(2)).toBe('1000.00');
    expect(ref.payment.minus(ref.rows[0].interest).toFixed(2)).toBe('199.10');
  });
});
