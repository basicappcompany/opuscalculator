import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/discount-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('discount-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ salePrice: '$60.00', amountSaved: '$20.00', totalDiscountPercent: '25.00%', priceWithTax: '$60.00' });
    for (const quoted of ['$80.00', '25%', '$60.00', '$20.00']) expect(config.intro).toContain(quoted);
  });

  it('applies one discount', () => {
    expect(run({ originalPrice: '19.99', discountPercent: 15 })).toMatchObject({ salePrice: '$16.99', amountSaved: '$3.00' });
  });

  it('stacks two 10% discounts to 19%, not 20%', () => {
    expect(run({ originalPrice: 100, discountPercent: 10, additionalDiscountPercent: 10 })).toMatchObject({
      salePrice: '$81.00',
      amountSaved: '$19.00',
      totalDiscountPercent: '19.00%',
    });
  });

  it('charges tax on the discounted price', () => {
    expect(run({ taxPercent: 8 }).priceWithTax).toBe('$64.80');
  });

  it('100% off is free', () => {
    expect(run({ discountPercent: 100 })).toMatchObject({ salePrice: '$0.00', amountSaved: '$80.00' });
  });

  it('is exact in decimals: 10% off $1.15 is $1.04 (1.035 rounds half up; floats give 1.03)', () => {
    const r = run({ originalPrice: '1.15', discountPercent: 10 });
    expect(r.salePrice).toBe('$1.04');
    expect(r.amountSaved).toBe('$0.12');
  });
});
