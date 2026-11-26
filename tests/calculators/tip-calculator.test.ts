import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/tip-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('tip-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ tipAmount: '$15.39', totalBill: '$100.89', perPerson: '$50.45', tipPerPerson: '$7.70' });
    for (const quoted of ['$85.50', '18%', '$15.39', '$100.89', '$50.45']) expect(config.intro).toContain(quoted);
  });

  it('splits a round bill evenly', () => {
    expect(run({ bill: 100, tipPercent: 20, people: 4 })).toEqual({ tipAmount: '$20.00', totalBill: '$120.00', perPerson: '$30.00', tipPerPerson: '$5.00' });
  });

  it('allows a 0% tip and a single diner', () => {
    expect(run({ bill: 45, tipPercent: 0, people: 1 })).toMatchObject({ tipAmount: '$0.00', totalBill: '$45.00', perPerson: '$45.00' });
  });

  it('is exact in decimals: 10% of $1.15 is $0.12 (0.115 rounds half up; floats give 0.11)', () => {
    expect(run({ bill: '1.15', tipPercent: 10, people: 1 }).tipAmount).toBe('$0.12');
  });
});
