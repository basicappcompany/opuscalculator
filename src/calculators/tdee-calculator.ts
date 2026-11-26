import { numberField, selectField, unitOf } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtFixed } from '../lib/format';
import { LENGTH_UNITS, WEIGHT_UNITS, toCm, toKg } from '../lib/units';
import type { CalculatorConfig } from '../lib/types';

const FACTORS = { sedentary: '1.2', light: '1.375', moderate: '1.55', active: '1.725', extra: '1.9' } as const;
type Level = keyof typeof FACTORS;

const whole = (d: Dec) => fmtFixed(d, 0);

const config: CalculatorConfig = {
  slug: 'tdee-calculator',
  category: 'health',
  tier: 2,
  publish: false,
  title: 'TDEE Calculator: Total Daily Energy Expenditure and BMR',
  h1: 'TDEE Calculator',
  metaDescription:
    'Calculate your BMR and total daily energy expenditure (TDEE) with the Mifflin-St Jeor or Harris-Benedict equation, and see TDEE for every activity level.',
  intro:
    'A 30-year-old man who is 180 cm tall and weighs 80 kg has a basal metabolic rate of 1,780 calories and, with moderate exercise, a total daily energy expenditure of 2,759 calories. TDEE is the full number of calories your body burns in a day, and it is built from four parts: the energy needed just to stay alive at rest, the small cost of digesting food, the everyday movement that is not formal exercise, and deliberate workouts. This calculator estimates the first part with the Mifflin-St Jeor equation or the revised Harris-Benedict equation, whichever you prefer, and multiplies it by an activity factor to give your TDEE, then lays out the TDEE for all five activity levels so you can see how much each step up in movement is worth. Knowing your TDEE is the foundation of any nutrition plan, since eating below it leads to weight loss and eating above it leads to weight gain. The equations predict an average person, so use the number as a starting estimate and refine it with real-world results.',
  inputs: [
    {
      name: 'sex',
      label: 'Sex',
      type: 'select',
      default: 'male',
      unitOptions: [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
      ],
      validator: selectField(['male', 'female']),
    },
    { name: 'age', label: 'Age (years)', type: 'number', min: 15, max: 100, default: 30, validator: numberField({ min: 15, max: 100, integer: true }) },
    {
      name: 'weight',
      label: 'Weight',
      type: 'unit',
      unitOptions: WEIGHT_UNITS,
      min: 20,
      max: 700,
      default: 80,
      validator: numberField({ min: 20, max: 1500 }),
    },
    {
      name: 'height',
      label: 'Height',
      type: 'unit',
      unitOptions: LENGTH_UNITS,
      min: 100,
      max: 250,
      default: 180,
      validator: numberField({ min: 50, max: 300 }),
    },
    {
      name: 'activity',
      label: 'Activity level',
      type: 'select',
      default: 'moderate',
      unitOptions: [
        { value: 'sedentary', label: 'Sedentary (× 1.2)' },
        { value: 'light', label: 'Lightly active (× 1.375)' },
        { value: 'moderate', label: 'Moderately active (× 1.55)' },
        { value: 'active', label: 'Very active (× 1.725)' },
        { value: 'extra', label: 'Extra active (× 1.9)' },
      ],
      validator: selectField(['sedentary', 'light', 'moderate', 'active', 'extra']),
    },
    {
      name: 'formula',
      label: 'BMR equation',
      type: 'select',
      default: 'mifflin',
      unitOptions: [
        { value: 'mifflin', label: 'Mifflin-St Jeor (1990)' },
        { value: 'harris', label: 'Harris-Benedict, revised (1984)' },
      ],
      validator: selectField(['mifflin', 'harris']),
    },
  ],
  outputs: [
    { name: 'bmr', label: 'BMR (calories/day at rest)', format: 'number' },
    { name: 'tdee', label: 'TDEE for your activity level', format: 'number', highlight: true },
    { name: 'tdeeSedentary', label: 'Sedentary', format: 'number' },
    { name: 'tdeeLight', label: 'Lightly active', format: 'number' },
    { name: 'tdeeModerate', label: 'Moderately active', format: 'number' },
    { name: 'tdeeActive', label: 'Very active', format: 'number' },
    { name: 'tdeeExtra', label: 'Extra active', format: 'number' },
  ],
  calculate: (i) => {
    const kg = toKg(i.weight, unitOf(i, 'weight', 'kg'));
    const cm = toCm(i.height, unitOf(i, 'height', 'cm'));
    const age = toD(i.age);
    const male = i.sex !== 'female';
    const bmr =
      i.formula === 'harris'
        ? male
          ? new D('88.362').plus(new D('13.397').mul(kg)).plus(new D('4.799').mul(cm)).minus(new D('5.677').mul(age))
          : new D('447.593').plus(new D('9.247').mul(kg)).plus(new D('3.098').mul(cm)).minus(new D('4.330').mul(age))
        : new D(10)
            .mul(kg)
            .plus(new D('6.25').mul(cm))
            .minus(new D(5).mul(age))
            .plus(male ? 5 : -161);
    const at = (level: Level) => bmr.mul(FACTORS[level]);
    const chosen = (Object.keys(FACTORS) as Level[]).includes(i.activity as Level) ? (i.activity as Level) : 'moderate';
    return {
      bmr: whole(bmr),
      tdee: whole(at(chosen)),
      tdeeSedentary: whole(at('sedentary')),
      tdeeLight: whole(at('light')),
      tdeeModerate: whole(at('moderate')),
      tdeeActive: whole(at('active')),
      tdeeExtra: whole(at('extra')),
    };
  },
  formulaDescription:
    'TDEE = BMR × activity factor. Mifflin-St Jeor: BMR = 10 × kg + 6.25 × cm − 5 × age + 5 (men) or − 161 (women). Revised Harris-Benedict: men 88.362 + 13.397 × kg + 4.799 × cm − 5.677 × age; women 447.593 + 9.247 × kg + 3.098 × cm − 4.330 × age. Activity factors: 1.2, 1.375, 1.55, 1.725 and 1.9.',
  workedExample:
    'A 30-year-old man, 80 kg, 180 cm. Mifflin-St Jeor: BMR = 800 + 1,125 − 150 + 5 = 1,780, and TDEE at the moderate factor = 1,780 × 1.55 = 2,759. Harris-Benedict gives 88.362 + 1,071.76 + 863.82 − 170.31 = 1,853.632, rounded to 1,854, and TDEE = 1,853.632 × 1.55 = 2,873.',
  faq: [
    {
      question: 'What is the difference between BMR and TDEE?',
      answer:
        'BMR is the energy your body uses at complete rest to keep you alive. TDEE adds everything else: digesting food, everyday movement and exercise. TDEE is the number to use when planning how much to eat.',
    },
    {
      question: 'Which equation is more accurate, Mifflin-St Jeor or Harris-Benedict?',
      answer:
        'Studies of adults generally find Mifflin-St Jeor closer to measured resting energy use, and it is the one most often recommended today. The revised Harris-Benedict equation tends to give a slightly higher number.',
    },
    {
      question: 'How do I choose my activity level?',
      answer:
        'Count your whole week, not just your workouts. A desk job with a few gym sessions is usually "lightly" or "moderately active". If you are unsure, pick the lower option, because people tend to overestimate how much they move.',
    },
    {
      question: 'Does muscle mass change my TDEE?',
      answer:
        'Yes. Muscle burns more energy than fat, so a very muscular person has a higher true TDEE than these height-and-weight equations predict. Formulas that use lean body mass, such as Katch-McArdle, are better for that case.',
    },
  ],
  relatedSlugs: ['calorie-calculator', 'bmi-calculator', 'body-fat-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
