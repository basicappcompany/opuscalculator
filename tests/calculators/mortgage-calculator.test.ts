import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/mortgage-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('mortgage-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({
      monthlyPayment: '$2,022.62',
      loanAmount: '$320,000.00',
      totalInterest: '$408,140.64',
      totalPaid: '$728,140.64',
      loanToValue: '80.0%',
    });
    for (const quoted of ['$400,000', '$80,000', '6.5%', '$2,022.62', '$408,140.64']) expect(config.intro).toContain(quoted);
  });

  it.each([
    [200000, 6, 30, '$1,199.10', '$231,677.04'],
    [100000, 5, 15, '$790.79', '$42,343.24'],
    [300000, 4, 30, '$1,432.25', '$215,607.10'],
  ])('matches reference schedule results: %i at %f percent for %i years', (price, rate, years, payment, interest) => {
    const r = run({ homePrice: price, downPayment: 0, interestRate: rate, termYears: years });
    expect(r.monthlyPayment).toBe(payment);
    expect(r.totalInterest).toBe(interest);
  });

  it('handles a 0% rate as principal divided by months', () => {
    const r = run({ homePrice: 120000, downPayment: 0, interestRate: 0, termYears: 10 });
    expect(r.monthlyPayment).toBe('$1,000.00');
    expect(r.totalInterest).toBe('$0.00');
  });

  it('returns a zero loan when the down payment covers the price', () => {
    const r = run({ homePrice: 100000, downPayment: 150000 });
    expect(r.monthlyPayment).toBe('$0.00');
    expect(r.loanAmount).toBe('$0.00');
  });

  it('is exact in decimals: 0.3 - 0.1 is 0.20, and interest never shows as -$0.00', () => {
    const r = run({ homePrice: '0.3', downPayment: '0.1', interestRate: 0, termYears: 1 });
    expect(r.loanAmount).toBe('$0.20');
    expect(r.totalPaid).toBe('$0.20');
    expect(r.totalInterest).toBe('$0.00');
  });
});
