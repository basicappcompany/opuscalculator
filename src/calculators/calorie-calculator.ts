import { numberField, selectField, unitOf } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtFixed } from '../lib/format';
import { LENGTH_UNITS, WEIGHT_UNITS, toCm, toKg } from '../lib/units';
import type { CalculatorConfig } from '../lib/types';

const ACTIVITY: Record<string, string> = { sedentary: '1.2', light: '1.375', moderate: '1.55', active: '1.725', extra: '1.9' };
// Kilograms of body weight per week to lose (negative) or gain; 7,700 kcal is the usual energy value of 1 kg.
const GOALS: Record<string, string> = { maintain: '0', 'lose-0.25': '-0.25', 'lose-0.5': '-0.5', 'lose-1': '-1', 'gain-0.25': '0.25', 'gain-0.5': '0.5' };

const whole = (d: Dec) => fmtFixed(d, 0);

const config: CalculatorConfig = {
  slug: 'calorie-calculator',
  category: 'health',
  tier: 2,
  publish: false,
  title: 'Calorie Calculator: Daily Calories to Lose, Maintain or Gain Weight',
  h1: 'Calorie Calculator',
  metaDescription: 'Estimate how many calories you need each day to maintain, lose or gain weight, based on your age, sex, height, weight and activity level.',
  intro:
    'To lose half a kilogram a week, a moderately active 30-year-old man who stands 180 cm tall and weighs 80 kg should eat about 2,209 calories a day, which is 550 below the 2,759 he needs to stay the same size. Pick a goal and this calculator turns it into a daily food target: it first finds the calories that hold your weight steady, then subtracts a deficit to lose weight or adds a surplus to gain it. Body weight changes when the energy you eat differs from the energy you burn, and a kilogram of stored body fat holds roughly 7,700 calories, so a steady shortfall of 1,100 calories a day would remove about a kilogram a week. Slower is usually kinder: a gap of 250 to 500 calories a day is easier to stick with, protects muscle and leaves more energy for training. Weigh yourself under the same conditions, watch the trend over two or three weeks rather than single days, and nudge the target up or down if progress stalls. Results below the lowest intake normally recommended for adults are flagged, and anyone with a medical condition, pregnancy or a history of disordered eating should plan changes with a health professional.',
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
        { value: 'sedentary', label: 'Sedentary (desk job, little exercise)' },
        { value: 'light', label: 'Light (exercise 1 to 3 days a week)' },
        { value: 'moderate', label: 'Moderate (exercise 3 to 5 days a week)' },
        { value: 'active', label: 'Active (hard exercise 6 to 7 days a week)' },
        { value: 'extra', label: 'Very active (physical job plus training)' },
      ],
      validator: selectField(['sedentary', 'light', 'moderate', 'active', 'extra']),
    },
    {
      name: 'goal',
      label: 'Goal',
      type: 'select',
      default: 'lose-0.5',
      unitOptions: [
        { value: 'maintain', label: 'Maintain my weight' },
        { value: 'lose-0.25', label: 'Lose 0.25 kg (0.5 lb) a week' },
        { value: 'lose-0.5', label: 'Lose 0.5 kg (1 lb) a week' },
        { value: 'lose-1', label: 'Lose 1 kg (2 lb) a week' },
        { value: 'gain-0.25', label: 'Gain 0.25 kg (0.5 lb) a week' },
        { value: 'gain-0.5', label: 'Gain 0.5 kg (1 lb) a week' },
      ],
      validator: selectField(['maintain', 'lose-0.25', 'lose-0.5', 'lose-1', 'gain-0.25', 'gain-0.5']),
    },
  ],
  outputs: [
    { name: 'bmr', label: 'Basal metabolic rate (calories/day)', format: 'number' },
    { name: 'maintenance', label: 'Maintenance calories per day', format: 'number', highlight: true },
    { name: 'goalCalories', label: 'Calories per day for your goal', format: 'number', highlight: true },
    { name: 'note', label: 'Note', format: 'text' },
  ],
  calculate: (i) => {
    const kg = toKg(i.weight, unitOf(i, 'weight', 'kg'));
    const cm = toCm(i.height, unitOf(i, 'height', 'cm'));
    const male = i.sex !== 'female';
    const bmr = new D(10)
      .mul(kg)
      .plus(new D('6.25').mul(cm))
      .minus(new D(5).mul(toD(i.age)))
      .plus(male ? 5 : -161);
    const maintenance = bmr.mul(ACTIVITY[String(i.activity)] ?? ACTIVITY.moderate);
    const perDay = new D(GOALS[String(i.goal)] ?? '0').mul(1100); // 7,700 kcal per kg ÷ 7 days
    const target = maintenance.plus(perDay);
    const floor = male ? 1500 : 1200;
    return {
      bmr: whole(bmr),
      maintenance: whole(maintenance),
      goalCalories: whole(target),
      note: target.lt(floor)
        ? `This is below the ${fmtFixed(floor, 0)} calories a day usually given as a minimum for ${male ? 'men' : 'women'}. Talk to a doctor or dietitian before eating this little.`
        : '',
    };
  },
  formulaDescription:
    'BMR (Mifflin-St Jeor) = 10 × weight in kg + 6.25 × height in cm − 5 × age + 5 for men, or − 161 for women. Maintenance = BMR × activity factor (1.2 sedentary, 1.375 light, 1.55 moderate, 1.725 active, 1.9 very active). Goal calories = maintenance + 1,100 × (kg per week to gain), or − 1,100 × (kg per week to lose), based on 7,700 calories per kilogram of body weight spread over 7 days.',
  workedExample:
    'A 30-year-old man, 80 kg, 180 cm, moderately active: BMR = 800 + 1,125 − 150 + 5 = 1,780. Maintenance = 1,780 × 1.55 = 2,759 calories. To lose 0.5 kg a week: 0.5 × 1,100 = 550 fewer calories a day, so 2,759 − 550 = 2,209 calories.',
  faq: [
    {
      question: 'How many calories should I eat a day to lose weight?',
      answer:
        'Start from your maintenance calories and subtract a daily deficit. About 550 fewer calories a day loses roughly half a kilogram a week. Avoid going below about 1,200 calories (women) or 1,500 (men) without medical advice.',
    },
    {
      question: 'How accurate is a calorie calculator?',
      answer:
        'It is an estimate. The Mifflin-St Jeor equation is considered one of the better predictors for most adults, but real energy use varies by several hundred calories between individuals, so adjust after a few weeks based on how your weight actually changes.',
    },
    {
      question: 'Why does the activity level matter so much?',
      answer:
        'Your basal rate is only the energy your body needs at rest. Daily movement and exercise can add 20 to 90 percent on top of it, so choosing the wrong activity level is the biggest source of error.',
    },
    {
      question: 'Is a weekly weight-loss target of 1 kg safe?',
      answer:
        'For most people a loss of 0.25 to 0.5 kg a week is easier to sustain. One kilogram a week needs a large deficit and is usually only suitable for people with a lot of weight to lose, ideally under professional guidance.',
    },
  ],
  relatedSlugs: ['tdee-calculator', 'bmi-calculator', 'body-fat-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
