import { dateField, numberField, selectField } from '../lib/calc-utils';
import { addDaysIso, daysBetween, longDate } from '../lib/dates';
import { D, ONE, toD, type Dec } from '../lib/decimal';
import { fmtFixed, fmtNumber, fmtPercent } from '../lib/format';
import { defineCalculator, mixed, type Spec } from '../lib/spec';
import type { CalculatorConfig } from '../lib/types';

/**
 * Prompt 5, health.ts (item 5.4): body metrics, pregnancy and fertility, nutrition and fitness. Every formula names
 * its published source in `formulaDescription`. These are estimates from population equations; none is medical advice.
 * The category disclaimers and "last reviewed" lines from Prompt 12 are not built yet, so no page here should be
 * published before that work (Cohort 1 is untouched: everything here is Tier 2 or 3).
 */

const SEX = {
  name: 'sex',
  label: 'Sex',
  type: 'select' as const,
  default: 'male',
  unitOptions: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ],
  validator: selectField(['male', 'female']),
};
const num = (min: number, max: number) => ({ min, max, validator: numberField({ min, max }) });
const weightKg = (def: number) => ({ name: 'weight', label: 'Weight (kg)', type: 'number' as const, default: def, ...num(20, 400) });
const heightCm = (def: number) => ({ name: 'height', label: 'Height (cm)', type: 'number' as const, default: def, ...num(100, 250) });
const age = (def: number) => ({ name: 'age', label: 'Age (years)', type: 'number' as const, default: def, ...num(15, 100) });

const KG_TO_LB = new D('2.2046226218');
const clock = (seconds: Dec): string => {
  const total = seconds.round().toNumber();
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const SPECS: Spec[] = [
  {
    slug: 'ideal-weight-calculator',
    category: 'health',
    tier: 2,
    subCluster: 'Body measurements',
    title: 'Ideal Weight Calculator: Devine Formula by Height and Sex',
    h1: 'Ideal Weight Calculator',
    metaDescription:
      'Estimate an ideal body weight from height and sex with the Devine formula, in kilograms and pounds. An old clinical rule of thumb, not a health target.',
    about:
      'The Devine formula was published in 1974 to help clinicians choose drug doses, and it is still quoted as an ideal body weight. It starts from a base weight at 5 feet of height and adds a fixed amount for every inch above that. It ignores frame size, muscle and age, so treat it as one reference point beside a healthy BMI range, not as a goal. Enter height in centimetres and pick a sex to see the estimate in kilograms and pounds.',
    inputs: [SEX, heightCm(175)],
    outputs: [
      { name: 'kg', label: 'Ideal body weight', format: 'text', highlight: true },
      { name: 'lb', label: 'In pounds', format: 'text' },
    ],
    calculate: (i) => {
      const inchesOver = toD(i.height).div('2.54').minus(60);
      const base = String(i.sex) === 'female' ? new D('45.5') : new D(50);
      const kg = base.plus(inchesOver.mul('2.3'));
      return { kg: `${fmtFixed(kg, 1)} kg`, lb: `${fmtFixed(kg.mul(KG_TO_LB), 1)} lb` };
    },
    formulaDescription:
      'Devine (1974): men 50 kg + 2.3 kg for each inch over 5 feet; women 45.5 kg + 2.3 kg for each inch over 5 feet. Height in centimetres is divided by 2.54 to get inches.',
    workedExample:
      'A man 175 cm tall is 68.9 inches, 8.9 inches over 5 feet: 50 + 2.3 × 8.9 = 70.5 kg, which is 155.3 lb. A woman of the same height gets 45.5 + 20.5 = 66.0 kg.',
    faq: [
      {
        question: 'Is the Devine formula the same as a healthy weight?',
        answer:
          'No. It was built for drug dosing. A healthy weight range depends on build, muscle, age and health, so compare it with a BMI range and ask a clinician.',
      },
      {
        question: 'What happens below 5 feet?',
        answer: 'The formula still works mathematically and gives less than the base weight, but it was designed for adults above about 5 feet.',
      },
      {
        question: 'Are there other ideal weight formulas?',
        answer: 'Yes: Robinson, Miller and Hamwi give different numbers for the same person. The spread between them shows how rough any single figure is.',
      },
    ],
    scenarios: [150, 158, 165, 170, 178, 185, 192, 200].map((h) => ({ label: `${h} cm`, inputs: { height: h } })),
    relatedSlugs: ['bmi-calculator', 'body-fat-calculator'],
    checks: [
      { inputs: {}, expect: { kg: '70.5 kg', lb: '155.3 lb' } },
      { inputs: { sex: 'female' }, expect: { kg: '66.0 kg' } },
      { inputs: { height: 152.4 }, expect: { kg: '50.0 kg' } },
    ],
  },
  {
    slug: 'lean-body-mass-calculator',
    category: 'health',
    tier: 2,
    subCluster: 'Body measurements',
    title: 'Lean Body Mass Calculator: Boer Formula',
    h1: 'Lean Body Mass Calculator',
    metaDescription: 'Estimate lean body mass and the implied body fat percentage from weight, height and sex using the Boer formula.',
    about:
      'Lean body mass is everything in the body that is not fat: muscle, bone, organs and water. The Boer equation, from a 1984 study of body composition, estimates it from weight and height with separate coefficients for men and women. The calculator also shows the fat mass this implies and the body fat percentage. Because it uses only two measurements it cannot see where weight is carried, so a tape-measure or scan method will be more individual.',
    inputs: [SEX, weightKg(80), heightCm(180)],
    outputs: [
      { name: 'lbm', label: 'Lean body mass', format: 'text', highlight: true },
      { name: 'fat', label: 'Implied fat mass', format: 'text' },
      { name: 'pct', label: 'Implied body fat', format: 'text' },
    ],
    calculate: (i) => {
      const w = toD(i.weight);
      const h = toD(i.height);
      const lbm = String(i.sex) === 'female' ? w.mul('0.252').plus(h.mul('0.473')).minus('48.3') : w.mul('0.407').plus(h.mul('0.267')).minus('19.2');
      const fat = w.minus(lbm);
      return { lbm: `${fmtFixed(lbm, 1)} kg`, fat: `${fmtFixed(fat, 1)} kg`, pct: fmtPercent(fat.div(w).mul(100), 1) };
    },
    formulaDescription:
      'Boer (1984): men LBM = 0.407 × weight (kg) + 0.267 × height (cm) − 19.2; women LBM = 0.252 × weight + 0.473 × height − 48.3. Fat mass = weight − LBM.',
    workedExample: 'A man of 80 kg and 180 cm: 0.407 × 80 + 0.267 × 180 − 19.2 = 61.4 kg lean mass, 18.6 kg fat, 23.2% of body weight.',
    faq: [
      {
        question: 'How accurate is the body fat percentage?',
        answer: 'It is a population estimate from weight and height alone and can be several percentage points off for an individual, especially athletes.',
      },
      {
        question: 'Why do men and women use different equations?',
        answer: 'Men and women differ on average in muscle and fat distribution, so the fitted coefficients differ.',
      },
      { question: 'Does lean mass equal muscle mass?', answer: 'No. Lean mass also includes bone, organs, skin and body water, so muscle is only part of it.' },
    ],
    scenarios: [
      { label: '70 kg, 175 cm', inputs: { weight: 70, height: 175 } },
      { label: '85 kg, 182 cm', inputs: { weight: 85, height: 182 } },
      { label: '95 kg, 190 cm', inputs: { weight: 95, height: 190 } },
      { label: '60 kg, 168 cm', inputs: { weight: 60, height: 168 } },
      { label: '110 kg, 178 cm', inputs: { weight: 110, height: 178 } },
      { label: '75 kg, 160 cm', inputs: { weight: 75, height: 160 } },
      { label: '65 kg, 183 cm', inputs: { weight: 65, height: 183 } },
    ],
    relatedSlugs: ['body-fat-calculator', 'bmi-calculator'],
    checks: [
      { inputs: {}, expect: { lbm: '61.4 kg', fat: '18.6 kg', pct: '23.2%' } },
      { inputs: { sex: 'female', weight: 65, height: 165 }, expect: { lbm: '46.1 kg', pct: '29.0%' } },
      { inputs: { weight: 100, height: 100 }, expect: { lbm: '48.2 kg' } },
    ],
  },
  {
    slug: 'body-surface-area-calculator',
    category: 'health',
    tier: 3,
    subCluster: 'Body measurements',
    title: 'Body Surface Area Calculator: Mosteller Formula',
    h1: 'Body Surface Area Calculator',
    metaDescription: 'Calculate body surface area in square metres from height and weight with the Mosteller formula used in medicine and drug dosing.',
    about:
      'Body surface area, BSA, is the total area of the skin and is used in medicine to scale some doses, particularly in chemotherapy, and to index measures such as cardiac output. Several formulas exist; the Mosteller equation is popular because it is simply the square root of height times weight divided by 3,600. Enter height in centimetres and weight in kilograms. Dosing decisions must always be made by a clinician using the formula their protocol specifies.',
    inputs: [heightCm(175), weightKg(70)],
    outputs: [{ name: 'bsa', label: 'Body surface area', format: 'text', highlight: true }],
    calculate: (i) => ({ bsa: `${fmtFixed(D.sqrt(toD(i.height).mul(toD(i.weight)).div(3600)), 2)} m²` }),
    formulaDescription: 'Mosteller (1987): BSA (m²) = √(height in cm × weight in kg ÷ 3600).',
    formulaLatex: '\\text{BSA} = \\sqrt{\\frac{h \\times w}{3600}}',
    workedExample: '175 cm and 70 kg: 175 × 70 = 12,250; ÷ 3,600 = 3.4028; square root = 1.84 m².',
    faq: [
      {
        question: 'Why is BSA used instead of weight for some drugs?',
        answer: 'Some physiological quantities scale with surface area more closely than with weight, so certain doses are expressed per square metre.',
      },
      {
        question: 'Is Mosteller the only formula?',
        answer: 'No. DuBois, Haycock and others give slightly different values, so use the one specified by the protocol you follow.',
      },
      {
        question: 'Can I use it for children?',
        answer: 'The formula is widely used in paediatrics too, but dosing for children should be set by a clinician.',
      },
    ],
    scenarios: [
      { label: '150 cm, 50 kg', inputs: { height: 150, weight: 50 } },
      { label: '160 cm, 60 kg', inputs: { height: 160, weight: 60 } },
      { label: '170 cm, 68 kg', inputs: { height: 170, weight: 68 } },
      { label: '180 cm, 90 kg', inputs: { height: 180, weight: 90 } },
      { label: '190 cm, 105 kg', inputs: { height: 190, weight: 105 } },
      { label: '200 cm, 100 kg', inputs: { height: 200, weight: 100 } },
    ],
    relatedSlugs: ['bmi-calculator', 'lean-body-mass-calculator'],
    checks: [
      { inputs: {}, expect: { bsa: '1.84 m²' } },
      { inputs: { height: 150, weight: 50 }, expect: { bsa: '1.44 m²' } },
      { inputs: { height: 180, weight: 90 }, expect: { bsa: '2.12 m²' } },
    ],
  },
  {
    slug: 'waist-to-hip-ratio-calculator',
    category: 'health',
    tier: 3,
    subCluster: 'Body measurements',
    title: 'Waist-to-Hip Ratio Calculator with WHO Thresholds',
    h1: 'Waist-to-Hip Ratio Calculator',
    metaDescription: 'Divide waist by hip circumference and compare the ratio with the World Health Organization thresholds for abdominal obesity.',
    about:
      'The waist-to-hip ratio compares the circumference of your waist with that of your hips and is used as a simple marker of where body fat is carried. The World Health Organization describes abdominal obesity as a ratio above 0.90 for men and above 0.85 for women. Measure at the narrowest part of the waist and the widest part of the hips, in the same units, standing relaxed. A single ratio is a screening figure, not a diagnosis, and should be discussed with a clinician if it concerns you.',
    inputs: [
      SEX,
      { name: 'waist', label: 'Waist (cm)', type: 'number', default: 88, ...num(40, 250) },
      { name: 'hip', label: 'Hip (cm)', type: 'number', default: 100, ...num(50, 250) },
    ],
    outputs: [
      { name: 'ratio', label: 'Waist-to-hip ratio', format: 'text', highlight: true },
      { name: 'band', label: 'Against the WHO threshold', format: 'text' },
    ],
    calculate: (i) => {
      const ratio = toD(i.waist).div(toD(i.hip));
      const limit = String(i.sex) === 'female' ? new D('0.85') : new D('0.90');
      return {
        ratio: fmtFixed(ratio, 2),
        band: ratio.gt(limit) ? `Above ${limit.toFixed(2)}, the WHO threshold` : `At or below ${limit.toFixed(2)}, within the WHO range`,
      };
    },
    formulaDescription:
      'Ratio = waist circumference ÷ hip circumference. WHO (2008) thresholds for abdominal obesity: above 0.90 in men and above 0.85 in women.',
    workedExample:
      'A man with an 88 cm waist and 100 cm hips has a ratio of 0.88, below the 0.90 threshold. A woman with 86 cm and 100 cm has 0.86, above the 0.85 threshold.',
    faq: [
      {
        question: 'Where do I measure?',
        answer: 'Waist at the narrowest point between ribs and hips, hips at the widest part of the buttocks, with a tape level and not tight.',
      },
      {
        question: 'Is WHR better than BMI?',
        answer: 'They measure different things. BMI ignores where fat is stored; WHR shows distribution but not total weight. Many clinicians use both.',
      },
      {
        question: 'Do the thresholds apply to everyone?',
        answer: 'They are population thresholds and may differ by ethnicity and age, so they are a guide, not a diagnosis.',
      },
    ],
    scenarios: [
      { label: 'Waist 80, hip 100', inputs: { waist: 80 } },
      { label: 'Waist 90, hip 100', inputs: { waist: 90 } },
      { label: 'Waist 95, hip 100', inputs: { waist: 95 } },
      { label: 'Waist 104, hip 110', inputs: { waist: 104, hip: 110 } },
      { label: 'Waist 72, hip 98', inputs: { waist: 72, hip: 98 } },
      { label: 'Waist 112, hip 105', inputs: { waist: 112, hip: 105 } },
    ],
    relatedSlugs: ['bmi-calculator', 'body-fat-calculator'],
    checks: [
      { inputs: {}, expect: { ratio: '0.88', band: 'At or below 0.90, within the WHO range' } },
      { inputs: { waist: 95 }, expect: { ratio: '0.95', band: 'Above 0.90, the WHO threshold' } },
      { inputs: { sex: 'female', waist: 86 }, expect: { ratio: '0.86', band: 'Above 0.85, the WHO threshold' } },
    ],
  },
  {
    slug: 'pregnancy-due-date-calculator',
    category: 'health',
    tier: 2,
    subCluster: 'Pregnancy and fertility',
    title: "Pregnancy Due Date Calculator: Naegele's Rule from Last Period",
    h1: 'Pregnancy Due Date Calculator',
    metaDescription:
      'Estimate a due date by adding 280 days to the first day of the last menstrual period, and see weeks pregnant and the trimester on a chosen date.',
    about:
      "The usual way to date a pregnancy is from the first day of the last menstrual period. Naegele's rule adds 280 days, which is 40 weeks, to that date to estimate the due date. It assumes a 28-day cycle with ovulation around day 14, so it is less precise for people with longer or shorter cycles, and ultrasound dating can adjust it. Only about 5% of babies arrive on the estimated date. Enter the date and, if you like, another date to see how far along you are, which week of gestation that is and which trimester it falls in.",
    inputs: [
      { name: 'lmp', label: 'First day of last period', type: 'date', default: '2026-03-01', validator: dateField() },
      { name: 'asOf', label: 'Show progress on', type: 'date', default: '2026-11-22', validator: dateField() },
    ],
    outputs: [
      { name: 'due', label: 'Estimated due date', format: 'text', highlight: true },
      { name: 'progress', label: 'Pregnancy progress', format: 'text' },
      { name: 'trimester', label: 'Trimester', format: 'text' },
    ],
    calculate: (i) => {
      const lmp = String(i.lmp);
      const days = daysBetween(lmp, String(i.asOf));
      const due = longDate(addDaysIso(lmp, 280));
      if (days < 0) return { due, progress: 'The chosen date is before the last period', trimester: '-' };
      const w = Math.floor(days / 7);
      const d = days % 7;
      const trimester = days < 98 ? 'First trimester' : days < 196 ? 'Second trimester' : days <= 294 ? 'Third trimester' : 'Beyond 42 weeks';
      return { due, progress: `${w} weeks ${d} days`, trimester };
    },
    formulaDescription:
      "Due date = first day of the last menstrual period + 280 days (Naegele's rule). Gestational age on a date = days since that first day, as whole weeks and days. Trimesters: weeks 0 to 13, 14 to 27, and 28 onwards.",
    workedExample:
      'A period starting 1 March 2026 gives a due date of 280 days later, Sunday 6 December 2026. On 22 November 2026, 266 days have passed: 38 weeks 0 days, in the third trimester.',
    faq: [
      {
        question: 'How accurate is the due date?',
        answer:
          'It is an estimate: most births occur within a few weeks either side. A dating ultrasound can refine it, and your midwife or doctor makes the final call.',
      },
      {
        question: 'What if my cycle is not 28 days?',
        answer: "Naegele's rule assumes ovulation on day 14. With a longer or shorter cycle the date shifts, so clinicians may adjust it.",
      },
      { question: 'Why 280 days?', answer: 'It is 40 weeks counted from the last period, which is about 38 weeks after conception.' },
    ],
    introOutputs: ['progress', 'trimester'],
    scenarios: [
      [6, 2],
      [11, 5],
      [17, 1],
      [22, 4],
      [27, 6],
      [31, 3],
      [36, 0],
      [41, 2],
    ].map(([w, d]) => ({
      label: `At ${w} weeks ${d} days`,
      inputs: { asOf: addDaysIso('2026-03-01', w * 7 + d) },
    })),
    relatedSlugs: ['ovulation-calculator', 'date-difference-calculator'],
    checks: [
      { inputs: {}, expect: { due: 'Sunday, 6 Dec 2026', progress: '38 weeks 0 days', trimester: 'Third trimester' } },
      { inputs: { asOf: '2026-03-01' }, expect: { progress: '0 weeks 0 days', trimester: 'First trimester' } },
      { inputs: { asOf: '2026-02-01' }, expect: { progress: 'The chosen date is before the last period' } },
    ],
  },
  {
    slug: 'ovulation-calculator',
    category: 'health',
    tier: 3,
    subCluster: 'Pregnancy and fertility',
    title: 'Ovulation Calculator: Estimated Ovulation and Fertile Window',
    h1: 'Ovulation Calculator',
    metaDescription: 'Estimate the day of ovulation and the fertile window from the first day of your last period and your usual cycle length.',
    about:
      'Ovulation usually happens about 14 days before the next period starts, so the day of ovulation depends on how long your cycle is. This calculator counts forward from the first day of your last period by your cycle length minus 14 days, then shows a fertile window of the five days before ovulation and the day after. The result is a calendar estimate that assumes regular cycles. It cannot confirm ovulation, and it is not a contraceptive method.',
    inputs: [
      { name: 'lmp', label: 'First day of last period', type: 'date', default: '2026-03-01', validator: dateField() },
      {
        name: 'cycle',
        label: 'Cycle length (days)',
        type: 'number',
        default: 28,
        min: 21,
        max: 45,
        validator: numberField({ min: 21, max: 45, integer: true }),
      },
    ],
    outputs: [
      { name: 'ovulation', label: 'Estimated ovulation', format: 'text', highlight: true },
      { name: 'fertile', label: 'Fertile window', format: 'text' },
      { name: 'next', label: 'Next period expected', format: 'text' },
    ],
    calculate: (i) => {
      const lmp = String(i.lmp);
      const cycle = toD(i.cycle).toNumber();
      const ov = addDaysIso(lmp, cycle - 14);
      return {
        ovulation: longDate(ov),
        fertile: `${longDate(addDaysIso(ov, -5))} to ${longDate(addDaysIso(ov, 1))}`,
        next: longDate(addDaysIso(lmp, cycle)),
      };
    },
    formulaDescription:
      'Ovulation ≈ first day of last period + (cycle length − 14) days. Fertile window ≈ 5 days before ovulation to 1 day after. Next period = first day + cycle length.',
    workedExample:
      'A period starting 1 March with a 28-day cycle: ovulation is day 14, 15 March; the fertile window runs 10 March to 16 March; the next period is expected 29 March.',
    faq: [
      {
        question: 'Can I rely on this to avoid pregnancy?',
        answer: 'No. It is a calendar estimate and real ovulation varies from cycle to cycle. Talk to a clinician about contraception.',
      },
      {
        question: 'Why is the fertile window before ovulation?',
        answer: 'Sperm can survive for several days, while the egg survives about a day, so intercourse in the days before ovulation can lead to pregnancy.',
      },
      {
        question: 'What if my cycles are irregular?',
        answer: 'The estimate becomes unreliable. Tracking symptoms or using tests, with medical advice, is more accurate than a calendar.',
      },
    ],
    scenarios: [
      ['2026-01-04', 24],
      ['2026-02-17', 26],
      ['2026-03-30', 30],
      ['2026-05-12', 32],
      ['2026-06-25', 35],
      ['2026-08-08', 21],
      ['2026-09-21', 27],
      ['2026-11-03', 29],
    ].map(([d, c]) => ({
      label: `A ${c}-day cycle starting ${d}`,
      inputs: { lmp: d, cycle: c },
    })),
    relatedSlugs: ['pregnancy-due-date-calculator', 'date-difference-calculator'],
    checks: [
      { inputs: {}, expect: { ovulation: 'Sunday, 15 Mar 2026', fertile: 'Tuesday, 10 Mar 2026 to Monday, 16 Mar 2026', next: 'Sunday, 29 Mar 2026' } },
      { inputs: { cycle: 32 }, expect: { ovulation: 'Thursday, 19 Mar 2026', next: 'Thursday, 2 Apr 2026' } },
      { inputs: { cycle: 24 }, expect: { ovulation: 'Wednesday, 11 Mar 2026', next: 'Wednesday, 25 Mar 2026' } },
    ],
  },
  {
    slug: 'bmr-calculator',
    category: 'health',
    tier: 2,
    subCluster: 'Calories and energy',
    title: 'BMR Calculator: Mifflin-St Jeor and Harris-Benedict',
    h1: 'BMR Calculator',
    metaDescription: 'Estimate basal metabolic rate, the calories your body uses at rest, with the Mifflin-St Jeor and revised Harris-Benedict equations.',
    about:
      'Basal metabolic rate is the energy your body burns at complete rest to keep you alive: breathing, circulation and cell repair. Two equations are in common use. Mifflin-St Jeor (1990) is generally considered more accurate for modern populations, while the revised Harris-Benedict equation dates from 1984. Both use age, sex, height and weight, and they usually differ by under 100 calories a day. Multiply the result by an activity factor, or use the TDEE calculator, to estimate daily needs.',
    inputs: [SEX, age(30), weightKg(80), heightCm(180)],
    outputs: [
      { name: 'mifflin', label: 'BMR (Mifflin-St Jeor)', format: 'text', highlight: true },
      { name: 'harris', label: 'BMR (Harris-Benedict)', format: 'text' },
    ],
    calculate: (i) => {
      const w = toD(i.weight);
      const h = toD(i.height);
      const a = toD(i.age);
      const female = String(i.sex) === 'female';
      const mifflin = w
        .mul(10)
        .plus(h.mul('6.25'))
        .minus(a.mul(5))
        .plus(female ? -161 : 5);
      const harris = female
        ? new D('447.593').plus(w.mul('9.247')).plus(h.mul('3.098')).minus(a.mul('4.330'))
        : new D('88.362').plus(w.mul('13.397')).plus(h.mul('4.799')).minus(a.mul('5.677'));
      return { mifflin: `${fmtNumber(mifflin, 0)} kcal/day`, harris: `${fmtNumber(harris, 0)} kcal/day` };
    },
    formulaDescription:
      'Mifflin-St Jeor: 10 × weight (kg) + 6.25 × height (cm) − 5 × age + 5 (men) or − 161 (women). Revised Harris-Benedict (Roza and Shizgal, 1984): men 88.362 + 13.397 w + 4.799 h − 5.677 a; women 447.593 + 9.247 w + 3.098 h − 4.330 a.',
    workedExample: 'A man of 30, 80 kg, 180 cm: 800 + 1,125 − 150 + 5 = 1,780 kcal a day by Mifflin-St Jeor; the Harris-Benedict equation gives 1,854.',
    faq: [
      {
        question: 'Is BMR the same as the calories I should eat?',
        answer: 'No. BMR is only resting energy. Daily needs also include movement, exercise and digestion; the TDEE calculator adds an activity factor.',
      },
      {
        question: 'Which equation is better?',
        answer: 'Mifflin-St Jeor tends to be closer in modern studies, but both are population averages and an individual can differ by hundreds of calories.',
      },
      { question: 'Why does BMR fall with age?', answer: 'Lean mass tends to decline with age, and muscle burns more energy than fat, so resting needs drop.' },
    ],
    scenarios: [
      { label: 'Man 25, 70 kg, 175 cm', inputs: { age: 25, weight: 70, height: 175 } },
      { label: 'Man 45, 95 kg, 185 cm', inputs: { age: 45, weight: 95, height: 185 } },
      { label: 'Woman 30, 65 kg, 165 cm', inputs: { sex: 'female', weight: 65, height: 165 } },
      { label: 'Woman 55, 72 kg, 160 cm', inputs: { sex: 'female', age: 55, weight: 72, height: 160 } },
      { label: 'Man 65, 78 kg, 172 cm', inputs: { age: 65, weight: 78, height: 172 } },
      { label: 'Woman 22, 55 kg, 170 cm', inputs: { sex: 'female', age: 22, weight: 55, height: 170 } },
    ],
    relatedSlugs: ['tdee-calculator', 'calorie-calculator', 'bmi-calculator'],
    checks: [
      { inputs: {}, expect: { mifflin: '1,780 kcal/day', harris: '1,854 kcal/day' } },
      { inputs: { sex: 'female', weight: 65, height: 165 }, expect: { mifflin: '1,370 kcal/day', harris: '1,430 kcal/day' } },
      { inputs: { age: 15, weight: 20, height: 100 }, expect: { mifflin: '755 kcal/day' } },
    ],
  },
  {
    slug: 'calorie-deficit-calculator',
    category: 'health',
    tier: 2,
    subCluster: 'Calories and energy',
    title: 'Calorie Deficit Calculator: Expected Weight Loss Over Time',
    h1: 'Calorie Deficit Calculator',
    metaDescription: 'Estimate weight change from a daily calorie deficit over a number of weeks using the common 7,700 calories per kilogram rule of thumb.',
    about:
      'A calorie deficit means eating less energy than you use. A common rule of thumb says that about 7,700 calories, the energy in a kilogram of body fat, must be missed to lose a kilogram. This calculator multiplies your daily deficit by the days involved to project the loss and your new weight. In practice the body adapts, water shifts and metabolism slows, so real results usually fall short of the straight-line figure. Large deficits are not suitable for everyone, so ask a clinician before starting one.',
    inputs: [
      { name: 'weight', label: 'Current weight (kg)', type: 'number', default: 80, ...num(20, 400) },
      { name: 'deficit', label: 'Daily deficit (calories)', type: 'number', default: 500, ...num(0, 3000) },
      { name: 'weeks', label: 'Time (weeks)', type: 'number', default: 12, ...num(0, 104) },
    ],
    outputs: [
      { name: 'loss', label: 'Projected weight loss', format: 'text', highlight: true },
      { name: 'weight', label: 'Projected weight', format: 'text' },
      { name: 'rate', label: 'Average loss per week', format: 'text' },
    ],
    calculate: (i) => {
      const deficit = toD(i.deficit);
      const weeks = toD(i.weeks);
      const loss = deficit.mul(7).mul(weeks).div(7700);
      return {
        loss: `${fmtNumber(loss, 2)} kg`,
        weight: `${fmtNumber(toD(i.weight).minus(loss), 2)} kg`,
        rate: `${fmtNumber(deficit.mul(7).div(7700), 2)} kg per week`,
      };
    },
    formulaDescription:
      'Loss (kg) = daily deficit × 7 × weeks ÷ 7,700. New weight = current weight − loss. The 7,700 kcal per kilogram figure is an approximation of the energy in body fat.',
    workedExample:
      'A 500-calorie daily deficit for 12 weeks is 500 × 84 = 42,000 calories, which is 42,000 ÷ 7,700 = 5.45 kg. From 80 kg that projects 74.55 kg.',
    faq: [
      {
        question: 'Why do results differ from the calculation?',
        answer:
          'The body adapts as you lose weight, water balance changes, and the energy content of lost tissue varies, so progress is rarely a straight line.',
      },
      {
        question: 'Is a bigger deficit better?',
        answer:
          'Not necessarily. Very large deficits can cost muscle and nutrients and are not suitable for everyone. Seek medical advice before a large deficit.',
      },
      { question: 'How do I find my deficit?', answer: 'Estimate daily needs with the TDEE calculator and subtract what you eat.' },
    ],
    scenarios: [
      { label: '250 kcal for 8 weeks', inputs: { deficit: 250, weeks: 8 } },
      { label: '350 kcal for 10 weeks', inputs: { deficit: 350, weeks: 10 } },
      { label: '500 kcal for 6 weeks', inputs: { deficit: 500, weeks: 6 } },
      { label: '600 kcal for 16 weeks', inputs: { deficit: 600, weeks: 16 } },
      { label: '750 kcal for 4 weeks', inputs: { deficit: 750, weeks: 4 } },
      { label: '400 kcal for 20 weeks', inputs: { deficit: 400, weeks: 20 } },
    ],
    relatedSlugs: ['calorie-calculator', 'tdee-calculator', 'bmi-calculator'],
    checks: [
      { inputs: {}, expect: { loss: '5.45 kg', weight: '74.55 kg', rate: '0.45 kg per week' } },
      { inputs: { deficit: 1100, weeks: 10 }, expect: { loss: '10 kg' } },
      { inputs: { deficit: 0 }, expect: { loss: '0 kg', weight: '80 kg' } },
    ],
  },
  {
    slug: 'macro-calculator',
    category: 'health',
    tier: 3,
    subCluster: 'Calories and energy',
    title: 'Macro Calculator: Grams of Carbs, Protein and Fat',
    h1: 'Macro Calculator',
    metaDescription: 'Turn a daily calorie target and a percentage split into grams of carbohydrate, protein and fat using 4, 4 and 9 calories per gram.',
    about:
      'Macronutrients are the carbohydrate, protein and fat that supply your calories. If you know a daily calorie target and the share you want from each, the grams follow directly: carbohydrate and protein provide about 4 calories per gram and fat about 9. Enter your calories and the three percentages, which must add up to 100, and the calculator returns the daily grams of each. It does not choose a healthy split for you, so ask a dietitian if you have particular needs.',
    inputs: [
      { name: 'calories', label: 'Daily calories', type: 'number', default: 2000, ...num(500, 10000) },
      { name: 'carbs', label: 'Carbohydrate (%)', type: 'number', default: 40, ...num(0, 100) },
      { name: 'protein', label: 'Protein (%)', type: 'number', default: 30, ...num(0, 100) },
      { name: 'fat', label: 'Fat (%)', type: 'number', default: 30, ...num(0, 100) },
    ],
    outputs: [
      { name: 'carbsG', label: 'Carbohydrate', format: 'text', highlight: true },
      { name: 'proteinG', label: 'Protein', format: 'text' },
      { name: 'fatG', label: 'Fat', format: 'text' },
    ],
    calculate: (i) => {
      const total = toD(i.carbs).plus(toD(i.protein)).plus(toD(i.fat));
      if (!total.eq(100)) return { carbsG: `Percentages add up to ${fmtNumber(total, 2)}, not 100`, proteinG: '-', fatG: '-' };
      const kcal = toD(i.calories);
      const grams = (share: unknown, per: number) => `${fmtNumber(kcal.mul(toD(share)).div(100).div(per), 1)} g`;
      return { carbsG: grams(i.carbs, 4), proteinG: grams(i.protein, 4), fatG: grams(i.fat, 9) };
    },
    formulaDescription:
      'Grams = calories × share ÷ calories per gram, with 4 kcal per gram for carbohydrate and protein and 9 kcal per gram for fat (Atwater factors).',
    workedExample: '2,000 calories split 40/30/30: carbohydrate 800 ÷ 4 = 200 g, protein 600 ÷ 4 = 150 g, fat 600 ÷ 9 = 66.7 g.',
    faq: [
      {
        question: 'Why must the percentages add to 100?',
        answer: 'They describe how all of your calories are divided. If they do not add up, the targets would not match your calorie goal.',
      },
      {
        question: 'What split should I use?',
        answer: 'It depends on your goals, health and preferences. A registered dietitian can advise; this tool only does the arithmetic.',
      },
      {
        question: 'Where do 4 and 9 come from?',
        answer: 'They are the average energy in a gram of each nutrient (Atwater factors). Alcohol, at about 7 calories per gram, is not included.',
      },
    ],
    scenarios: [
      { label: '1,600 kcal, 45/25/30', inputs: { calories: 1600, carbs: 45, protein: 25, fat: 30 } },
      { label: '1,800 kcal, 50/20/30', inputs: { calories: 1800, carbs: 50, protein: 20, fat: 30 } },
      { label: '2,200 kcal, 35/35/30', inputs: { calories: 2200, carbs: 35, protein: 35, fat: 30 } },
      { label: '2,500 kcal, 50/20/30', inputs: { calories: 2500, carbs: 50, protein: 20, fat: 30 } },
      { label: '2,800 kcal, 40/30/30', inputs: { calories: 2800, carbs: 40, protein: 30, fat: 30 } },
      { label: '3,200 kcal, 55/20/25', inputs: { calories: 3200, carbs: 55, protein: 20, fat: 25 } },
    ],
    relatedSlugs: ['calorie-calculator', 'tdee-calculator'],
    checks: [
      { inputs: {}, expect: { carbsG: '200 g', proteinG: '150 g', fatG: '66.7 g' } },
      { inputs: { calories: 2500, carbs: 50, protein: 20, fat: 30 }, expect: { carbsG: '312.5 g', proteinG: '125 g', fatG: '83.3 g' } },
      { inputs: { carbs: 50 }, expect: { carbsG: 'Percentages add up to 110, not 100' } },
    ],
  },
  {
    slug: 'max-heart-rate-calculator',
    category: 'sports',
    tier: 3,
    subCluster: 'Heart rate',
    title: 'Max Heart Rate Calculator: Fox and Tanaka Formulas',
    h1: 'Max Heart Rate Calculator',
    metaDescription: 'Estimate maximum heart rate from age with the 220 minus age rule and the Tanaka equation, 208 minus 0.7 times age.',
    about:
      'Maximum heart rate is the highest number of beats per minute your heart can reach during hard effort, and training zones are usually set as percentages of it. The familiar rule subtracts age from 220; a 2001 analysis by Tanaka and colleagues found that 208 minus 0.7 times age fits data from healthy adults better, especially at older ages. Either figure is an average with a spread of roughly plus or minus ten beats, so a supervised test is the only real measure. Speak to a clinician before intense exercise if you have a heart condition.',
    inputs: [{ name: 'age', label: 'Age (years)', type: 'number', default: 40, ...num(10, 100) }],
    outputs: [
      { name: 'fox', label: 'Max heart rate (220 − age)', format: 'text', highlight: true },
      { name: 'tanaka', label: 'Max heart rate (Tanaka)', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.age);
      return { fox: `${fmtNumber(new D(220).minus(a), 0)} bpm`, tanaka: `${fmtNumber(new D(208).minus(a.mul('0.7')), 0)} bpm` };
    },
    formulaDescription: 'Fox: HRmax = 220 − age. Tanaka, Monahan and Seals (2001): HRmax = 208 − 0.7 × age.',
    workedExample: 'At age 40: 220 − 40 = 180 bpm; 208 − 0.7 × 40 = 180 bpm. At 60 the first gives 160 and the second 166.',
    faq: [
      {
        question: 'How accurate is it?',
        answer: 'Individuals vary by about ten beats either way, so treat the figure as a starting estimate for zones, not a limit.',
      },
      {
        question: 'Why do the formulas differ at older ages?',
        answer: 'The 220 rule falls faster with age than the Tanaka equation fitted to data, so they diverge for people over about 40.',
      },
      {
        question: 'Can I exceed my estimated max?',
        answer: 'Yes, some people do. Use perceived effort as well, and see a doctor if you feel unwell during exercise.',
      },
    ],
    scenarios: [20, 25, 30, 35, 45, 50, 55, 60, 65, 70].map((a) => ({ label: `Age ${a}`, inputs: { age: a } })),
    relatedSlugs: ['target-heart-rate-calculator', 'running-pace-calculator'],
    checks: [
      { inputs: {}, expect: { fox: '180 bpm', tanaka: '180 bpm' } },
      { inputs: { age: 30 }, expect: { fox: '190 bpm', tanaka: '187 bpm' } },
      { inputs: { age: 60 }, expect: { fox: '160 bpm', tanaka: '166 bpm' } },
    ],
  },
  {
    slug: 'target-heart-rate-calculator',
    category: 'sports',
    tier: 3,
    subCluster: 'Heart rate',
    title: 'Target Heart Rate Calculator: Karvonen Training Zone',
    h1: 'Target Heart Rate Calculator',
    metaDescription: 'Work out a training heart rate range from age, resting heart rate and intensity with the Karvonen heart rate reserve method.',
    about:
      'The Karvonen method sets a target heart rate by using your heart rate reserve, the gap between your resting rate and your maximum, rather than the maximum alone. That makes the zone depend on your fitness, since a fitter person has a lower resting rate and a wider reserve. This calculator estimates maximum heart rate with the Tanaka equation, then returns the beats per minute for the lower and upper intensity you choose. Use a resting rate measured when calm, ideally on waking, and check with a clinician before hard training.',
    inputs: [
      { name: 'age', label: 'Age (years)', type: 'number', default: 40, ...num(10, 100) },
      { name: 'rest', label: 'Resting heart rate (bpm)', type: 'number', default: 60, ...num(30, 120) },
      { name: 'low', label: 'Lower intensity (%)', type: 'number', default: 60, ...num(30, 95) },
      { name: 'high', label: 'Upper intensity (%)', type: 'number', default: 80, ...num(30, 100) },
    ],
    outputs: [
      { name: 'zone', label: 'Target heart rate zone', format: 'text', highlight: true },
      { name: 'max', label: 'Estimated maximum', format: 'text' },
      { name: 'reserve', label: 'Heart rate reserve', format: 'text' },
    ],
    calculate: (i) => {
      const max = new D(208).minus(toD(i.age).mul('0.7'));
      const rest = toD(i.rest);
      const reserve = max.minus(rest);
      const at = (pctValue: unknown) => rest.plus(reserve.mul(toD(pctValue)).div(100));
      return {
        zone: `${fmtNumber(at(i.low), 0)} to ${fmtNumber(at(i.high), 0)} bpm`,
        max: `${fmtNumber(max, 0)} bpm`,
        reserve: `${fmtNumber(reserve, 0)} bpm`,
      };
    },
    formulaDescription: 'Karvonen: target = (HRmax − HRrest) × intensity + HRrest, with HRmax = 208 − 0.7 × age (Tanaka) and intensity as a fraction.',
    workedExample: 'Age 40, resting 60: max 180, reserve 120. At 60% the target is 120 × 0.6 + 60 = 132 bpm; at 80% it is 156 bpm.',
    faq: [
      {
        question: 'Why use heart rate reserve?',
        answer: 'It adjusts for fitness: two people of the same age but different resting rates get different zones, which tends to match effort better.',
      },
      {
        question: 'What intensity should I pick?',
        answer: 'Moderate exercise is commonly described as roughly 50 to 70% of reserve and vigorous as 70 to 85%. A coach or clinician can tailor it.',
      },
      {
        question: 'How do I measure resting heart rate?',
        answer: 'Count your pulse for a full minute after waking, before getting up, and average a few mornings.',
      },
    ],
    scenarios: [
      { label: 'Age 25, resting 55, 60-75%', inputs: { age: 25, rest: 55, low: 60, high: 75 } },
      { label: 'Age 35, resting 62, 65-85%', inputs: { age: 35, rest: 62, low: 65, high: 85 } },
      { label: 'Age 50, resting 70, 50-70%', inputs: { age: 50, rest: 70, low: 50, high: 70 } },
      { label: 'Age 60, resting 66, 55-75%', inputs: { age: 60, rest: 66, low: 55, high: 75 } },
      { label: 'Age 30, resting 48, 70-90%', inputs: { age: 30, rest: 48, low: 70, high: 90 } },
      { label: 'Age 45, resting 75, 60-80%', inputs: { age: 45, rest: 75, low: 60, high: 80 } },
    ],
    relatedSlugs: ['max-heart-rate-calculator', 'running-pace-calculator'],
    checks: [
      { inputs: {}, expect: { zone: '132 to 156 bpm', max: '180 bpm', reserve: '120 bpm' } },
      { inputs: { low: 50, high: 50 }, expect: { zone: '120 to 120 bpm' } },
      { inputs: { age: 20, rest: 50 }, expect: { max: '194 bpm', zone: '136 to 165 bpm' } },
    ],
  },
  {
    slug: 'one-rep-max-calculator',
    category: 'sports',
    tier: 3,
    subCluster: 'Strength',
    title: 'One Rep Max Calculator: Epley and Brzycki Estimates',
    h1: 'One Rep Max Calculator',
    metaDescription: 'Estimate the heaviest weight you could lift once from a lighter set of repetitions, using the Epley and Brzycki formulas.',
    about:
      'A one-repetition maximum is the heaviest load you can lift once with good form. Testing it directly is tiring and carries injury risk, so lifters estimate it from a lighter set taken close to failure. The Epley and Brzycki formulas turn the weight and the number of repetitions into an estimate, and they agree closely for sets of about ten reps or fewer. Accuracy falls as the reps rise and varies by exercise. Use the result to choose training percentages, and warm up properly before heavy attempts.',
    inputs: [
      { name: 'weight', label: 'Weight lifted (kg)', type: 'number', default: 100, ...num(1, 1000) },
      { name: 'reps', label: 'Repetitions completed', type: 'number', default: 5, min: 1, max: 12, validator: numberField({ min: 1, max: 12, integer: true }) },
    ],
    outputs: [
      { name: 'epley', label: 'Estimated 1RM (Epley)', format: 'text', highlight: true },
      { name: 'brzycki', label: 'Estimated 1RM (Brzycki)', format: 'text' },
    ],
    calculate: (i) => {
      const w = toD(i.weight);
      const reps = toD(i.reps);
      return { epley: `${fmtFixed(w.mul(ONE.plus(reps.div(30))), 1)} kg`, brzycki: `${fmtFixed(w.mul(36).div(new D(37).minus(reps)), 1)} kg` };
    },
    formulaDescription:
      'Epley (1985): 1RM = weight × (1 + reps ÷ 30). Brzycki (1993): 1RM = weight × 36 ÷ (37 − reps). Both are valid for low repetition counts; this tool limits reps to 12.',
    workedExample: '100 kg for 5 reps: Epley = 100 × (1 + 5/30) = 116.7 kg; Brzycki = 100 × 36 ÷ 32 = 112.5 kg.',
    faq: [
      {
        question: 'Why are the two estimates different?',
        answer: 'They are fitted to different data. For 1 rep both return the weight lifted, and they spread as reps increase.',
      },
      { question: 'Why limit reps to 12?', answer: 'Estimates from high-rep sets are unreliable, and Brzycki breaks down at 37 reps.' },
      { question: 'Should I test my true max?', answer: 'Only with experience, a warm-up and a spotter. Many lifters train from estimates instead.' },
    ],
    scenarios: [
      { label: '60 kg for 10', inputs: { weight: 60, reps: 10 } },
      { label: '80 kg for 8', inputs: { weight: 80, reps: 8 } },
      { label: '100 kg for 3', inputs: { weight: 100, reps: 3 } },
      { label: '120 kg for 5', inputs: { weight: 120, reps: 5 } },
      { label: '140 kg for 2', inputs: { weight: 140, reps: 2 } },
      { label: '45 kg for 12', inputs: { weight: 45, reps: 12 } },
      { label: '200 kg for 1', inputs: { weight: 200, reps: 1 } },
    ],
    relatedSlugs: ['running-pace-calculator', 'target-heart-rate-calculator'],
    checks: [
      { inputs: {}, expect: { epley: '116.7 kg', brzycki: '112.5 kg' } },
      { inputs: { weight: 100, reps: 1 }, expect: { epley: '103.3 kg', brzycki: '100.0 kg' } },
      { inputs: { weight: 60, reps: 10 }, expect: { epley: '80.0 kg', brzycki: '80.0 kg' } },
    ],
  },
  {
    slug: 'running-pace-calculator',
    category: 'sports',
    tier: 2,
    subCluster: 'Running',
    title: 'Running Pace Calculator: Pace per Kilometre and Mile',
    h1: 'Running Pace Calculator',
    metaDescription: 'Find your pace per kilometre and per mile, and your speed, from the distance you ran and the time it took.',
    about:
      'Pace is the time it takes to cover one unit of distance, and runners usually quote it per kilometre or per mile. Enter the distance and your finishing time in hours, minutes and seconds and this calculator returns your average pace in both units along with your speed in kilometres per hour. It is useful for setting a goal pace for a race, comparing a training run with an earlier one, or checking what a finish time implies per kilometre. Average pace hides pacing differences between laps.',
    inputs: [
      { name: 'distance', label: 'Distance (km)', type: 'number', default: 10, min: 0.1, max: 1000, validator: numberField({ min: 0.1, max: 1000 }) },
      { name: 'hours', label: 'Hours', type: 'number', default: 0, ...num(0, 100) },
      { name: 'minutes', label: 'Minutes', type: 'number', default: 50, ...num(0, 59) },
      { name: 'seconds', label: 'Seconds', type: 'number', default: 0, ...num(0, 59) },
    ],
    outputs: [
      { name: 'perKm', label: 'Pace per kilometre', format: 'text', highlight: true },
      { name: 'perMile', label: 'Pace per mile', format: 'text' },
      { name: 'speed', label: 'Average speed', format: 'text' },
    ],
    calculate: (i) => {
      const seconds = toD(i.hours).mul(3600).plus(toD(i.minutes).mul(60)).plus(toD(i.seconds));
      const km = toD(i.distance);
      if (seconds.lte(0)) return { perKm: 'Enter a time', perMile: '-', speed: '-' };
      const perKm = seconds.div(km);
      return { perKm: `${clock(perKm)} /km`, perMile: `${clock(perKm.mul('1.609344'))} /mile`, speed: `${fmtNumber(km.div(seconds).mul(3600), 2)} km/h` };
    },
    formulaDescription:
      'Pace per km = total seconds ÷ kilometres, shown as minutes:seconds. Pace per mile = pace per km × 1.609344. Speed = kilometres ÷ hours.',
    workedExample: '10 km in 50 minutes: 3,000 seconds ÷ 10 = 300 s per km, or 5:00 per km. Per mile that is 300 × 1.609344 = 482.8 s, 8:03. Speed is 12 km/h.',
    faq: [
      { question: 'How do I enter a half marathon?', answer: 'Use 21.0975 km and your time in hours, minutes and seconds; a marathon is 42.195 km.' },
      {
        question: 'Is average pace the same as my pace each kilometre?',
        answer: 'No. It is the mean over the whole distance; real pace varies with hills, fatigue and strategy.',
      },
      { question: 'How is the pace rounded?', answer: 'To the nearest second.' },
    ],
    scenarios: mixed(
      'running-pace-calculator',
      12,
      (r) => ({ distance: r(1, 42), total: Math.round(r(600, 19000)) }),
      (v) => `${v.distance} km in ${v.total} seconds`,
    ).map((sc) => {
      const t = Number(sc.inputs.total);
      return { label: sc.label, inputs: { distance: sc.inputs.distance, hours: Math.floor(t / 3600), minutes: Math.floor((t % 3600) / 60), seconds: t % 60 } };
    }),
    relatedSlugs: ['max-heart-rate-calculator', 'one-rep-max-calculator', 'miles-to-km'],
    checks: [
      { inputs: {}, expect: { perKm: '5:00 /km', perMile: '8:03 /mile', speed: '12 km/h' } },
      { inputs: { distance: 42.195, hours: 4, minutes: 0 }, expect: { perKm: '5:41 /km', perMile: '9:09 /mile', speed: '10.55 km/h' } },
      { inputs: { distance: 5, minutes: 20 }, expect: { perKm: '4:00 /km', perMile: '6:26 /mile', speed: '15 km/h' } },
    ],
  },
  {
    slug: 'calories-burned-calculator',
    category: 'sports',
    tier: 3,
    subCluster: 'Calories and energy',
    title: 'Calories Burned Calculator: MET Value, Weight and Time',
    h1: 'Calories Burned Calculator',
    metaDescription: "Estimate calories burned from an activity's MET value, your body weight and how long you exercise. A rough guide, not an exact measure.",
    about:
      'A MET, or metabolic equivalent, expresses how hard an activity is compared with sitting still, which is 1 MET. Published activity compendiums list approximate MET values, with brisk walking around 3 to 5, cycling at a steady pace around 6 to 8 and running faster than 8. Multiply the MET by your weight in kilograms and the time in hours to get a rough calorie estimate. It cannot account for fitness, terrain or individual differences, so it is a guide only; use the MET from a source for your activity.',
    inputs: [
      { name: 'met', label: 'MET value of the activity', type: 'number', default: 5, min: 1, max: 25, validator: numberField({ min: 1, max: 25 }) },
      { name: 'weight', label: 'Body weight (kg)', type: 'number', default: 70, ...num(20, 400) },
      { name: 'minutes', label: 'Duration (minutes)', type: 'number', default: 45, ...num(0, 1440) },
    ],
    outputs: [{ name: 'kcal', label: 'Estimated calories burned', format: 'text', highlight: true }],
    calculate: (i) => ({ kcal: `${fmtNumber(toD(i.met).mul(toD(i.weight)).mul(toD(i.minutes)).div(60), 1)} kcal` }),
    formulaDescription:
      'Calories ≈ MET × body weight (kg) × duration (hours). This counts total energy, including the resting energy you would have used anyway.',
    workedExample: 'An activity of 5 METs for 45 minutes at 70 kg: 5 × 70 × 0.75 = 262.5 kcal.',
    faq: [
      {
        question: 'Where do I find the MET for my activity?',
        answer: 'In published compendiums of physical activities. Values are averages and depend on speed and effort.',
      },
      {
        question: 'Does it include resting calories?',
        answer: 'Yes, MET-based totals include the energy you would have used at rest, so net exercise calories are lower.',
      },
      {
        question: 'How accurate is it?',
        answer: 'Within a rough range for typical activities, but heavily dependent on the MET you choose and your own physiology.',
      },
    ],
    scenarios: [
      { label: 'MET 3.5, 60 kg, 30 min', inputs: { met: 3.5, weight: 60, minutes: 30 } },
      { label: 'MET 4.3, 75 kg, 40 min', inputs: { met: 4.3, weight: 75, minutes: 40 } },
      { label: 'MET 6, 80 kg, 60 min', inputs: { met: 6, weight: 80, minutes: 60 } },
      { label: 'MET 8, 68 kg, 25 min', inputs: { met: 8, weight: 68, minutes: 25 } },
      { label: 'MET 10, 90 kg, 35 min', inputs: { met: 10, weight: 90, minutes: 35 } },
      { label: 'MET 2.5, 55 kg, 90 min', inputs: { met: 2.5, weight: 55, minutes: 90 } },
    ],
    relatedSlugs: ['calorie-calculator', 'tdee-calculator', 'running-pace-calculator'],
    checks: [
      { inputs: {}, expect: { kcal: '262.5 kcal' } },
      { inputs: { met: 8, weight: 80, minutes: 60 }, expect: { kcal: '640 kcal' } },
      { inputs: { minutes: 0 }, expect: { kcal: '0 kcal' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
