import { numberField, unitOf } from '../lib/calc-utils';
import { D } from '../lib/decimal';
import { fmtFixed } from '../lib/format';
import { LENGTH_UNITS, WEIGHT_UNITS, kgToUnit, toCm, toKg } from '../lib/units';
import type { CalculatorConfig } from '../lib/types';

const config: CalculatorConfig = {
  slug: 'bmi-calculator',
  category: 'health',
  tier: 1,
  publish: true,
  title: 'BMI Calculator: Body Mass Index for Adults (kg/cm or lb/in)',
  h1: 'BMI Calculator',
  metaDescription:
    'Calculate your body mass index (BMI) from your weight and height in metric or imperial units, see your WHO weight category and the healthy weight range for your height.',
  intro:
    'A person who weighs 70 kg and is 175 cm tall has a body mass index of 22.9, which sits in the healthy-weight range of 18.5 to 24.9 defined by the World Health Organization. BMI is a simple ratio of weight to height squared, and this calculator accepts metric or imperial measurements, then shows your BMI, your weight category and the range of weights that would count as healthy at your height. It is a screening number, not a diagnosis: it cannot tell muscle from fat, so a muscular athlete can read as overweight, and it does not reflect where fat is carried or differences with age, sex and ethnicity. Some health bodies use lower cut-offs for people of Asian descent, and for children and teenagers BMI is interpreted against growth charts rather than these adult bands. Use the result as a starting point for a conversation with a doctor or dietitian, together with other measures such as waist size, blood pressure and blood tests, rather than as a verdict on your health.',
  inputs: [
    { name: 'weight', label: 'Weight', type: 'unit', unitOptions: WEIGHT_UNITS, min: 1, max: 1500, default: 70, validator: numberField({ min: 1, max: 1500 }) },
    {
      name: 'height',
      label: 'Height',
      type: 'unit',
      unitOptions: LENGTH_UNITS,
      min: 20,
      max: 300,
      default: 175,
      validator: numberField({ min: 20, max: 300 }),
    },
  ],
  outputs: [
    { name: 'bmi', label: 'Your BMI', format: 'number', highlight: true },
    { name: 'category', label: 'Weight category (WHO)', format: 'text', highlight: true },
    { name: 'healthyRange', label: 'Healthy weight range for your height', format: 'text' },
  ],
  calculate: (i) => {
    const weightUnit = unitOf(i, 'weight', 'kg');
    const kg = toKg(i.weight, weightUnit);
    const metres = toCm(i.height, unitOf(i, 'height', 'cm')).div(100);
    const metresSquared = metres.pow(2);
    // The category is decided on the value as displayed (one decimal, half up), so 24.95 shows as 25.0 and is "Overweight".
    const bmi = new D(kg.div(metresSquared).toFixed(1, D.ROUND_HALF_UP));
    const category = bmi.lt('18.5') ? 'Underweight' : bmi.lt('25') ? 'Healthy weight' : bmi.lt('30') ? 'Overweight' : 'Obese';
    const low = kgToUnit(metresSquared.mul('18.5'), weightUnit);
    const high = kgToUnit(metresSquared.mul('24.9'), weightUnit);
    return {
      bmi: fmtFixed(bmi, 1),
      category,
      healthyRange: `${fmtFixed(low, 1)} to ${fmtFixed(high, 1)} ${weightUnit}`,
    };
  },
  formulaDescription:
    'BMI = weight in kilograms ÷ (height in metres)². Pounds and inches are converted exactly (1 lb = 0.45359237 kg, 1 in = 2.54 cm), which matches the common imperial form 703 × lb ÷ in². WHO adult categories: under 18.5 underweight, 18.5 to 24.9 healthy weight, 25 to 29.9 overweight, 30 and above obese. The healthy range is the weight that gives a BMI of 18.5 up to 24.9 at your height.',
  scenarios: [
    { label: '55 kg at 175 cm', inputs: { weight: 55 } },
    { label: '70 kg at 175 cm (default)', inputs: {} },
    { label: '85 kg at 175 cm', inputs: { weight: 85 } },
    { label: '100 kg at 175 cm', inputs: { weight: 100 } },
    { label: '70 kg at 160 cm', inputs: { height: 160 } },
    { label: '70 kg at 190 cm', inputs: { height: 190 } },
  ],
  assumptions: [
    'Adult categories only (age 20 and over): children and teenagers are judged against growth charts, not these cut-offs.',
    'BMI is a screening measure. It does not separate muscle from fat and it is not a diagnosis.',
    'Pounds and inches are converted exactly (1 lb = 0.45359237 kg, 1 in = 2.54 cm).',
  ],
  references: [
    {
      title: 'Adult BMI Categories',
      publisher: 'Centers for Disease Control and Prevention (CDC)',
      url: 'https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html',
      accessed: '2026-11-26',
      supports:
        'BMI as weight in kilograms divided by the square of height in metres, the adult categories (underweight, healthy weight, overweight, obesity) and that BMI is a screening measure.',
    },
    {
      title: 'Malnutrition in women (Nutrition Landscape Information System)',
      publisher: 'World Health Organization (WHO)',
      url: 'https://www.who.int/data/nutrition/nlis/info/malnutrition-in-women',
      accessed: '2026-11-26',
      supports: 'The WHO cut-offs used here: below 18.5 underweight, 18.5 to 24.9 normal weight, 25.0 and above overweight, 30.0 and above obesity.',
    },
  ],
  workedExample:
    'A person 175 cm tall weighing 70 kg: height = 1.75 m, so height² = 3.0625. BMI = 70 ÷ 3.0625 = 22.857, shown as 22.9: healthy weight. At 1.75 m the healthy range is 18.5 × 3.0625 = 56.7 kg up to 24.9 × 3.0625 = 76.3 kg.',
  faq: [
    {
      question: 'What is a healthy BMI for an adult?',
      answer:
        'The World Health Organization defines 18.5 to 24.9 as the healthy-weight range for adults. Below 18.5 is underweight, 25 to 29.9 is overweight and 30 or more is obese.',
    },
    {
      question: 'Is BMI accurate for athletes and muscular people?',
      answer:
        'Not always. BMI uses only weight and height, so it cannot distinguish muscle from fat. A very muscular person can have a BMI in the overweight range with a low body fat percentage.',
    },
    {
      question: 'Does BMI work for children and teenagers?',
      answer:
        'Not with the adult bands. For people under 20, BMI is compared with growth charts for the same age and sex, and the result is given as a percentile. Ask a pediatrician to interpret it.',
    },
    {
      question: 'How do I calculate BMI in pounds and inches?',
      answer:
        'Multiply your weight in pounds by 703 and divide by your height in inches squared. This calculator does the same thing with exact conversions when you switch the units to lb and in.',
    },
  ],
  relatedSlugs: ['body-fat-calculator', 'calorie-calculator', 'tdee-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
