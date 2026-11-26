import { numberField } from '../lib/calc-utils';
import { HUNDRED, ONE, toD } from '../lib/decimal';
import { fmtCurrency, fmtPercent } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const config: CalculatorConfig = {
  slug: 'discount-calculator',
  category: 'finance',
  tier: 2,
  publish: false,
  title: 'Discount Calculator: Sale Price, Savings and Stacked Discounts',
  h1: 'Discount Calculator',
  metaDescription:
    'Find the sale price and how much you save after a percentage discount, with an optional second discount and sales tax. Handy for shopping and price checks.',
  intro:
    'A $80.00 item that is 25% off costs $60.00, so you save $20.00. Enter the original price and the discount percentage and the calculator gives the sale price and the amount saved immediately, which makes it easy to check a price tag before you reach the register. If a store stacks a second coupon on top of the sale, add it as the additional discount: the second percentage is taken off the already-reduced price, not off the original, which is why two 10% discounts add up to 19% rather than 20%. You can also enter a sales tax rate to see the final amount you will actually pay, since tax is normally charged on the discounted price. Shoppers use this to compare deals across stores, retailers use it to set promotional prices, and anyone can use it to turn a confusing sticker such as 35% off into a plain amount in dollars. The figures are rounded to the nearest cent, using the usual half-up rule.',
  inputs: [
    {
      name: 'originalPrice',
      label: 'Original price ($)',
      type: 'number',
      min: 0,
      max: 1000000000,
      default: 80,
      validator: numberField({ min: 0, max: 1000000000 }),
    },
    { name: 'discountPercent', label: 'Discount (%)', type: 'number', min: 0, max: 100, default: 25, validator: numberField({ min: 0, max: 100 }) },
    {
      name: 'additionalDiscountPercent',
      label: 'Additional discount (%)',
      type: 'number',
      min: 0,
      max: 100,
      default: 0,
      validator: numberField({ min: 0, max: 100 }),
    },
    { name: 'taxPercent', label: 'Sales tax (%)', type: 'number', min: 0, max: 100, default: 0, validator: numberField({ min: 0, max: 100 }) },
  ],
  outputs: [
    { name: 'salePrice', label: 'Sale price', format: 'currency', highlight: true },
    { name: 'amountSaved', label: 'You save', format: 'currency' },
    { name: 'totalDiscountPercent', label: 'Total discount', format: 'percent' },
    { name: 'priceWithTax', label: 'Price with sales tax', format: 'currency' },
  ],
  calculate: (i) => {
    const original = toD(i.originalPrice);
    const keep = ONE.minus(toD(i.discountPercent).div(HUNDRED)).mul(ONE.minus(toD(i.additionalDiscountPercent).div(HUNDRED)));
    const sale = original.mul(keep);
    return {
      salePrice: fmtCurrency(sale),
      amountSaved: fmtCurrency(original.minus(sale)),
      totalDiscountPercent: fmtPercent(ONE.minus(keep).mul(HUNDRED), 2),
      priceWithTax: fmtCurrency(sale.mul(ONE.plus(toD(i.taxPercent).div(HUNDRED)))),
    };
  },
  formulaDescription:
    'Sale price = Original × (1 − d1 ÷ 100) × (1 − d2 ÷ 100), where d1 is the discount and d2 the optional additional discount. Amount saved = Original − Sale price. Total discount % = (1 − (1 − d1 ÷ 100) × (1 − d2 ÷ 100)) × 100. Price with tax = Sale price × (1 + tax ÷ 100).',
  workedExample:
    'A $19.99 item with 15% off: 19.99 × 0.85 = $16.9915, shown as $16.99, so you save $3.00. With a further 10% coupon the price becomes 19.99 × 0.85 × 0.90 = $15.29 and the combined discount is 23.5%, not 25%.',
  faq: [
    {
      question: 'How do I calculate a percentage discount?',
      answer:
        'Multiply the original price by the discount percentage divided by 100 to get the amount off, then subtract it from the original price. Or multiply the original price by (1 minus the discount as a decimal) to get the sale price in one step.',
    },
    {
      question: 'Why do two 10% discounts not make 20% off?',
      answer:
        'The second discount applies to the price after the first one. Taking 10% off $100 leaves $90, and 10% off $90 is $9, so you save $19 in total, which is 19%.',
    },
    {
      question: 'Is sales tax charged before or after the discount?',
      answer:
        'In most places tax is charged on the discounted price, which is how this calculator works. Some stores treat manufacturer coupons differently, so the receipt is the final word.',
    },
    {
      question: 'How do I work out the original price from a sale price?',
      answer: 'Divide the sale price by (1 minus the discount as a decimal). For example, a $60 sale price after 25% off came from $60 ÷ 0.75 = $80.',
    },
  ],
  relatedSlugs: ['tip-calculator', 'percentage-calculator', 'loan-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
