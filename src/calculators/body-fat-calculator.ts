import { numberField, selectField, unitOf } from '../lib/calc-utils';
import { D } from '../lib/decimal';
import { fmtFixed, fmtPercent } from '../lib/format';
import { CM_PER_IN, LENGTH_UNITS, WEIGHT_UNITS, kgToUnit, toCm, toKg } from '../lib/units';
import type { CalculatorConfig } from '../lib/types';

const BAD = 'Check your measurements';

function category(percent: InstanceType<typeof D>, male: boolean): string {
  const [essential, athlete, fitness, average] = male ? [6, 14, 18, 25] : [14, 21, 25, 32];
  if (percent.lt(essential)) return 'Essential fat';
  if (percent.lt(athlete)) return 'Athletes';
  if (percent.lt(fitness)) return 'Fitness';
  if (percent.lt(average)) return 'Average';
  return 'Obese';
}

const config: CalculatorConfig = {
  slug: 'body-fat-calculator',
  category: 'health',
  tier: 3,
  publish: false,
  title: 'Body Fat Calculator: Estimate Body Fat Percentage (US Navy Method)',
  h1: 'Body Fat Calculator',
  metaDescription:
    'Estimate your body fat percentage with the US Navy tape-measure method using your height, neck, waist and (for women) hip measurements, plus fat and lean mass.',
  intro:
    'A man who is 178 cm tall with a 38 cm neck and a 90 cm waist, weighing 80 kg, has an estimated body fat of 20.3 percent using the US Navy circumference method, which falls in the average range and means about 16.2 kg of fat and 63.8 kg of lean mass. The method needs nothing but a tape measure: it combines your height with the circumference of your neck and waist, plus your hips if you are a woman, and converts them into a body fat percentage with a logarithmic formula developed from body density studies. Measure on bare skin, keep the tape snug but not tight, take the waist at the navel for men and at the narrowest point for women, and repeat each measurement a couple of times for consistency. Tape-based estimates are convenient but not precise, typically landing within three to four percentage points of laboratory methods such as DEXA scans, so they are most useful for tracking change over weeks and months rather than for an exact number on a single day.',
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
      default: 178,
      validator: numberField({ min: 50, max: 300 }),
    },
    {
      name: 'neck',
      label: 'Neck circumference',
      type: 'unit',
      unitOptions: LENGTH_UNITS,
      min: 20,
      max: 80,
      default: 38,
      validator: numberField({ min: 10, max: 80 }),
    },
    {
      name: 'waist',
      label: 'Waist circumference',
      type: 'unit',
      unitOptions: LENGTH_UNITS,
      min: 40,
      max: 250,
      default: 90,
      validator: numberField({ min: 20, max: 250 }),
    },
    {
      name: 'hip',
      label: 'Hip circumference (women only)',
      type: 'unit',
      unitOptions: LENGTH_UNITS,
      min: 50,
      max: 250,
      default: 95,
      validator: numberField({ min: 20, max: 250 }),
    },
  ],
  outputs: [
    { name: 'bodyFat', label: 'Estimated body fat', format: 'percent', highlight: true },
    { name: 'category', label: 'Category (ACE)', format: 'text', highlight: true },
    { name: 'fatMass', label: 'Fat mass', format: 'text' },
    { name: 'leanMass', label: 'Lean mass', format: 'text' },
  ],
  calculate: (i) => {
    const male = i.sex !== 'female';
    const inches = (name: string) => toCm(i[name], unitOf(i, name, 'cm')).div(CM_PER_IN);
    const height = inches('height');
    const neck = inches('neck');
    const waist = inches('waist');
    const hip = inches('hip');
    const tape = male ? waist.minus(neck) : waist.plus(hip).minus(neck);
    if (tape.lte(0) || height.lte(0)) return { bodyFat: BAD, category: '', fatMass: '', leanMass: '' };

    const raw = male
      ? new D('86.010')
          .mul(tape.log(10))
          .minus(new D('70.041').mul(height.log(10)))
          .plus('36.76')
      : new D('163.205')
          .mul(tape.log(10))
          .minus(new D('97.684').mul(height.log(10)))
          .minus('78.387');
    if (raw.lte(0) || raw.gte(70)) return { bodyFat: BAD, category: '', fatMass: '', leanMass: '' };

    const percent = new D(raw.toFixed(1, D.ROUND_HALF_UP));
    const unit = unitOf(i, 'weight', 'kg');
    const total = toKg(i.weight, unit);
    const fat = total.mul(percent).div(100);
    const show = (kg: InstanceType<typeof D>) => `${fmtFixed(kgToUnit(kg, unit), 1)} ${unit}`;
    return {
      bodyFat: fmtPercent(percent, 1),
      category: category(percent, male),
      fatMass: show(fat),
      leanMass: show(total.minus(fat)),
    };
  },
  formulaDescription:
    'US Navy method, with every length in inches. Men: body fat % = 86.010 × log10(waist − neck) − 70.041 × log10(height) + 36.76. Women: body fat % = 163.205 × log10(waist + hip − neck) − 97.684 × log10(height) − 78.387. Fat mass = weight × body fat %, and lean mass = weight − fat mass. Centimetres are converted exactly (1 in = 2.54 cm). The category uses the American Council on Exercise bands.',
  workedExample:
    'A man 178 cm tall, neck 38 cm, waist 90 cm, weight 80 kg. In inches: height 70.08, neck 14.96, waist 35.43, so waist − neck = 20.47. Body fat = 86.010 × log10(20.47) − 70.041 × log10(70.08) + 36.76 = 112.77 − 129.27 + 36.76 ≈ 20.3%. Fat mass = 80 × 0.203 ≈ 16.2 kg and lean mass ≈ 63.8 kg.',
  faq: [
    {
      question: 'How accurate is the US Navy body fat method?',
      answer:
        'It is usually within about three to four percentage points of lab methods such as DEXA for most people, but it can be further off for very lean, very muscular or very heavy people. It is best for tracking your own trend over time.',
    },
    {
      question: 'Where exactly should I measure my waist and neck?',
      answer:
        'Measure the neck just below the larynx and slope slightly down to the front. For men, take the waist at the navel; for women, at the narrowest point, and hips at the widest point. Keep the tape level and snug without pressing into the skin.',
    },
    {
      question: 'What is a healthy body fat percentage?',
      answer:
        'Ranges differ by sex and age. The American Council on Exercise lists roughly 14 to 24 percent for men and 21 to 31 percent for women as fitness-to-average ranges, with essential fat below that and obese above 25 and 32 percent.',
    },
    {
      question: 'Why does the calculator ask for hips only for women?',
      answer:
        "The Navy formula for women includes hip circumference because women store more fat around the hips. The men's formula uses only height, neck and waist, so the hip value is ignored when you choose male.",
    },
  ],
  relatedSlugs: ['bmi-calculator', 'tdee-calculator', 'calorie-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
