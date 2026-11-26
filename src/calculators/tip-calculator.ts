import { numberField } from '../lib/calc-utils';
import { HUNDRED, toD } from '../lib/decimal';
import { fmtCurrency } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const config: CalculatorConfig = {
  slug: 'tip-calculator',
  category: 'finance',
  tier: 2,
  publish: false,
  title: 'Tip Calculator: Gratuity and Bill Split Per Person',
  h1: 'Tip Calculator',
  metaDescription:
    "Calculate the tip, the total bill and each person's share when you split a restaurant check. Choose any tip percentage and number of diners.",
  intro:
    'On an $85.50 restaurant bill, an 18% tip is $15.39, which brings the total to $100.89, and split between two people that comes to $50.45 each. Enter the bill, choose the tip percentage and say how many people are sharing, and the calculator works out the gratuity, the final total and what each diner owes in one go. In the United States a tip of 15 to 20 percent of the pre-tax bill is customary for table service, with higher amounts for exceptional service, while many other countries add a service charge to the check or expect only small round-up tips. Check your receipt before you tip, because some restaurants automatically add gratuity for large parties. When the total does not divide evenly, each share is rounded to the nearest cent, so the shares can differ from the exact total by a cent or two, and someone may want to cover the difference. The tip amount here is based on the bill you enter, so type the pre-tax subtotal if you tip on that.',
  inputs: [
    { name: 'bill', label: 'Bill amount ($)', type: 'number', min: 0, max: 10000000, default: 85.5, validator: numberField({ min: 0, max: 10000000 }) },
    { name: 'tipPercent', label: 'Tip (%)', type: 'number', min: 0, max: 100, default: 18, validator: numberField({ min: 0, max: 100 }) },
    { name: 'people', label: 'Number of people', type: 'number', min: 1, max: 1000, default: 2, validator: numberField({ min: 1, max: 1000, integer: true }) },
  ],
  outputs: [
    { name: 'tipAmount', label: 'Tip amount', format: 'currency' },
    { name: 'totalBill', label: 'Total with tip', format: 'currency', highlight: true },
    { name: 'perPerson', label: 'Total per person', format: 'currency', highlight: true },
    { name: 'tipPerPerson', label: 'Tip per person', format: 'currency' },
  ],
  calculate: (i) => {
    const bill = toD(i.bill);
    const people = toD(i.people);
    const tip = bill.mul(toD(i.tipPercent).div(HUNDRED));
    const total = bill.plus(tip);
    return {
      tipAmount: fmtCurrency(tip),
      totalBill: fmtCurrency(total),
      perPerson: fmtCurrency(total.div(people)),
      tipPerPerson: fmtCurrency(tip.div(people)),
    };
  },
  formulaDescription:
    'Tip = Bill × (Tip % ÷ 100). Total = Bill + Tip. Per person = Total ÷ Number of people. Each figure is rounded to the nearest cent (half up) only at the end, so rounding does not build up.',
  workedExample:
    'Bill $85.50, tip 18%, two people: tip = 85.50 × 0.18 = $15.39. Total = $85.50 + $15.39 = $100.89. Per person = $100.89 ÷ 2 = $50.445, which rounds up to $50.45.',
  faq: [
    {
      question: 'How much should I tip at a restaurant?',
      answer:
        'In the United States 15 to 20 percent of the pre-tax bill is the usual range for table service. Customs differ a lot between countries, and some places include a service charge, so check the receipt first.',
    },
    {
      question: 'Should I tip on the bill before or after tax?',
      answer:
        'Many people tip on the pre-tax subtotal, and that is the amount to enter here if you do. Tipping on the after-tax total is also common and simply gives a slightly larger tip.',
    },
    {
      question: 'Why might the shares not add up exactly to the total?',
      answer:
        "Each person's share is rounded to the nearest cent. When the total does not divide evenly the rounded shares can be a cent above or below the exact total, so one person may need to add a cent.",
    },
    {
      question: 'Can I leave a tip as a fixed amount instead of a percentage?',
      answer:
        'Divide the amount you want to leave by the bill and multiply by 100 to find the equivalent percentage, then enter it here. For example, $12 on an $80 bill is 15%.',
    },
  ],
  relatedSlugs: ['discount-calculator', 'percentage-calculator', 'loan-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
