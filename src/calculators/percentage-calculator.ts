import { numberField, selectField } from '../lib/calc-utils';
import { HUNDRED, ZERO, toD } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const UNDEFINED = 'Undefined (cannot divide by zero)';

const config: CalculatorConfig = {
  slug: 'percentage-calculator',
  category: 'math',
  tier: 1,
  publish: true,
  title: 'Percentage Calculator: Percent Of, Percent Change and What Percent',
  h1: 'Percentage Calculator',
  metaDescription:
    'Solve the three common percentage problems: what is X% of Y, X is what percent of Y, and the percentage change between two numbers. Exact answers with working.',
  intro:
    '15% of 200 is 30. That is the first of three questions this calculator answers, and you pick the one you need: what is a percentage of a number, what percentage one number is of another, and by what percentage a value has increased or decreased. The word percent simply means per hundred, so 15% is the fraction 15/100, or 0.15, and finding 15% of a quantity means multiplying it by 0.15. Percentages turn up in discounts, interest rates, exam scores, tax, nutrition labels, statistics and almost every report, which makes it worth getting them right. Two traps catch many people. A rise of 50% followed by a fall of 50% does not bring you back to where you started, because the second percentage is taken from a bigger number. And a change from 10% to 12% is two percentage points, but it is a 20% relative increase. The answers below are exact, calculated with decimal arithmetic rather than floating point, so results such as 110% of 1.1 come out as 1.21 and not 1.2100000000000002.',
  inputs: [
    {
      name: 'mode',
      label: 'What do you want to find?',
      type: 'select',
      default: 'percentOf',
      unitOptions: [
        { value: 'percentOf', label: 'What is A% of B?' },
        { value: 'whatPercent', label: 'A is what percent of B?' },
        { value: 'change', label: 'Percentage change from A to B' },
      ],
      validator: selectField(['percentOf', 'whatPercent', 'change']),
    },
    { name: 'valueA', label: 'Value A', type: 'number', default: 15, validator: numberField({ min: -1e12, max: 1e12 }) },
    { name: 'valueB', label: 'Value B', type: 'number', default: 200, validator: numberField({ min: -1e12, max: 1e12 }) },
  ],
  outputs: [
    { name: 'result', label: 'Result', format: 'text', highlight: true },
    { name: 'summary', label: 'In words', format: 'text' },
  ],
  calculate: (i) => {
    const a = toD(i.valueA);
    const b = toD(i.valueB);
    const [A, B] = [fmtNumber(a, 6), fmtNumber(b, 6)];
    if (i.mode === 'whatPercent') {
      if (b.isZero()) return { result: UNDEFINED, summary: '' };
      const r = fmtNumber(a.div(b).mul(HUNDRED), 6);
      return { result: `${r}%`, summary: `${A} is ${r}% of ${B}` };
    }
    if (i.mode === 'change') {
      if (a.isZero()) return { result: UNDEFINED, summary: '' };
      const change = b.minus(a).div(a.abs()).mul(HUNDRED);
      const r = fmtNumber(change, 6);
      const word = change.gt(ZERO) ? 'an increase' : change.lt(ZERO) ? 'a decrease' : 'no change';
      return { result: `${change.gt(ZERO) ? '+' : ''}${r}%`, summary: `From ${A} to ${B} is ${word} of ${fmtNumber(change.abs(), 6)}%` };
    }
    const r = fmtNumber(a.div(HUNDRED).mul(b), 6);
    return { result: r, summary: `${A}% of ${B} is ${r}` };
  },
  formulaDescription:
    'A% of B = (A ÷ 100) × B. A is what percent of B = (A ÷ B) × 100. Percentage change from A to B = ((B − A) ÷ |A|) × 100, where a positive result is an increase and a negative result is a decrease. Division by zero is undefined, so those cases show a message instead of a number.',
  formulaLatex: String.raw`\begin{aligned} A\%\text{ of }B &= \frac{A}{100}\times B \cr A\text{ is what percent of }B &= \frac{A}{B}\times 100 \cr \text{Change from }A\text{ to }B &= \frac{B-A}{|A|}\times 100 \end{aligned}`,
  derivation: [
    String.raw`Percent means per hundred, so $x\%$ is the fraction $\frac{x}{100}$. For example $15\% = \frac{15}{100} = 0.15$.`,
    String.raw`To take $A\%$ of $B$, multiply the fraction by the number: $\frac{A}{100}\times B$. With $A = 15$ and $B = 200$ this is $0.15 \times 200 = 30$.`,
    String.raw`To ask what percent $A$ is of $B$, form the fraction $\frac{A}{B}$ and scale it to per hundred: $\frac{A}{B}\times 100$. So 30 is $\frac{30}{200}\times 100 = 15\%$ of 200.`,
    String.raw`Percentage change measures the change $B - A$ against where you started, $|A|$, so it is $\frac{B-A}{|A|}\times 100$. The absolute value keeps an increase positive even when $A$ is negative.`,
    String.raw`Division by zero has no value, so $B = 0$ in the third formula and $A = 0$ in the fourth are reported as undefined rather than as a number.`,
  ],
  workedExample:
    '15% of 200: 15 ÷ 100 = 0.15, and 0.15 × 200 = 30. 30 is what percent of 200: 30 ÷ 200 = 0.15, and 0.15 × 100 = 15%. Percentage change from 80 to 100: (100 − 80) ÷ 80 = 0.25, so a 25% increase. Going back from 100 to 80 is (80 − 100) ÷ 100 = −20%, which shows why the same gap is a different percentage.',
  faq: [
    {
      question: 'How do I calculate a percentage of a number?',
      answer: 'Divide the percentage by 100 and multiply by the number. For 15% of 200, 15 ÷ 100 = 0.15 and 0.15 × 200 = 30.',
    },
    {
      question: 'How do I find the percentage change between two numbers?',
      answer:
        'Subtract the old value from the new value, divide by the old value and multiply by 100. A positive answer is an increase and a negative answer is a decrease.',
    },
    {
      question: 'What is the difference between percent and percentage points?',
      answer:
        'Percentage points are the plain difference between two percentages. Moving from 10% to 12% is 2 percentage points but a 20% relative increase, because 2 is 20% of 10.',
    },
    {
      question: 'Why does a 50% increase followed by a 50% decrease not return to the start?',
      answer: 'The second percentage is applied to a larger number. Starting at 100, +50% gives 150 and −50% of 150 is 75, which is 25% below where you began.',
    },
  ],
  relatedSlugs: ['discount-calculator', 'tip-calculator', 'cagr-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
