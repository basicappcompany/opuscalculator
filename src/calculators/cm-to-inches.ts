import { numberField } from '../lib/calc-utils';
import { toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { CM_PER_IN } from '../lib/units';
import type { CalculatorConfig } from '../lib/types';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Nearest sixteenth of an inch, written the way a tape measure reads: 66 15/16. */
function toSixteenths(inches: Dec): string {
  const whole = inches.floor();
  let sixteenths = inches.minus(whole).mul(16).round().toNumber();
  let w = whole.toNumber();
  if (sixteenths === 16) {
    w += 1;
    sixteenths = 0;
  }
  if (sixteenths === 0) return `${w}`;
  const g = gcd(sixteenths, 16);
  const frac = `${sixteenths / g}/${16 / g}`;
  return w === 0 ? frac : `${w} ${frac}`;
}

const config: CalculatorConfig = {
  slug: 'cm-to-inches',
  category: 'conversion',
  tier: 2,
  publish: false,
  title: 'cm to Inches Converter: Centimeters to Inches and Feet',
  h1: 'Centimeters to Inches Converter',
  metaDescription:
    'Convert centimeters to inches instantly. Also shows feet and inches and the nearest tape-measure fraction. Exact conversion using 1 inch = 2.54 cm.',
  intro:
    '170 cm is 66.93 inches, which is 5 feet 6.93 inches, or about 66 15/16 inches on a tape measure. The conversion is exact because the international inch is defined as precisely 2.54 centimeters, so you divide the number of centimeters by 2.54 to get inches. Type any length in centimeters and the converter shows the decimal inches, the same length split into feet and inches, and the nearest sixteenth of an inch, which is the smallest mark on most imperial rulers and tape measures. It is handy for body height, clothing and furniture sizes, screen and picture dimensions, luggage limits, and anything sold in one system but measured in the other. To go the other way, multiply inches by 2.54. For rough mental math, remember that 10 cm is just under 4 inches and 2.5 cm is about 1 inch. Results are rounded to two decimal places for display, while the underlying arithmetic keeps full precision.',
  inputs: [
    {
      name: 'centimeters',
      label: 'Centimeters (cm)',
      type: 'number',
      min: 0,
      max: 1000000000,
      default: 170,
      validator: numberField({ min: 0, max: 1000000000 }),
    },
  ],
  outputs: [
    { name: 'inches', label: 'Inches', format: 'number', highlight: true },
    { name: 'feetInches', label: 'Feet and inches', format: 'text', highlight: true },
    { name: 'fraction', label: 'Nearest 1/16 inch', format: 'text' },
  ],
  calculate: (i) => {
    const inches = toD(i.centimeters).div(CM_PER_IN);
    const feet = inches.div(12).floor();
    const rest = inches.minus(feet.mul(12));
    return {
      inches: fmtNumber(inches, 2),
      feetInches: `${fmtNumber(feet, 0)} ft ${fmtNumber(rest, 2)} in`,
      fraction: `${toSixteenths(inches)} in`,
    };
  },
  formulaDescription:
    'Inches = centimeters ÷ 2.54 (exact, since 1 inch is defined as 2.54 cm). Feet = the whole number of 12-inch units in that length, and the remainder is the inches. The tape-measure value rounds the fractional part to the nearest sixteenth and reduces the fraction.',
  workedExample:
    '170 cm ÷ 2.54 = 66.929 inches. 66.929 ÷ 12 gives 5 whole feet (60 inches), leaving 6.929 inches, so 5 ft 6.93 in. The fraction 0.929 × 16 = 14.9, which rounds to 15, so the tape-measure reading is 66 15/16 in.',
  faq: [
    { question: 'How do I convert centimeters to inches?', answer: 'Divide the number of centimeters by 2.54. For example, 100 cm ÷ 2.54 = 39.37 inches.' },
    {
      question: 'Is the conversion factor exact or rounded?',
      answer: 'It is exact. Since 1959 the international inch has been defined as exactly 2.54 centimeters, so there is no rounding in the factor itself.',
    },
    { question: 'How many cm is 5 feet 10 inches?', answer: 'Five feet ten inches is 70 inches, and 70 × 2.54 = 177.8 cm.' },
    {
      question: 'Why does the result show a fraction like 15/16?',
      answer:
        'Imperial tape measures are marked in sixteenths of an inch, so the converter also shows the closest sixteenth for when you need to find a length on a ruler.',
    },
  ],
  relatedSlugs: ['bmi-calculator', 'paint-calculator', 'concrete-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
