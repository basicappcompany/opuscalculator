import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/loan-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('loan-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ monthlyPayment: '$500.95', totalInterest: '$5,056.96', totalRepayment: '$30,056.96', interestShare: '16.8%' });
    for (const quoted of ['$25,000', '7.5%', '60 months', '$500.95', '$5,056.96', '$30,056.96']) expect(config.intro).toContain(quoted);
  });

  it.each([
    [10000, 5, 12, '$856.07', '$272.89'],
    [20000, 6, 60, '$386.66', '$3,199.35'],
    [5000, 12, 12, '$444.24', '$330.93'],
  ])('matches reference schedule results: %i at %f percent for %i months', (amount, rate, months, payment, interest) => {
    const r = run({ loanAmount: amount, interestRate: rate, termMonths: months });
    expect(r.monthlyPayment).toBe(payment);
    expect(r.totalInterest).toBe(interest);
  });

  it('0% interest splits the amount evenly', () => {
    expect(run({ loanAmount: 12000, interestRate: 0, termMonths: 12 })).toMatchObject({
      monthlyPayment: '$1,000.00',
      totalInterest: '$0.00',
      interestShare: '0.0%',
    });
  });

  it('is exact in decimals: 100 / 7 * 7 repays $100.00 with $0.00 interest, never -$0.00', () => {
    const r = run({ loanAmount: 100, interestRate: 0, termMonths: 7 });
    expect(r.totalRepayment).toBe('$100.00');
    expect(r.totalInterest).toBe('$0.00');
  });
});
