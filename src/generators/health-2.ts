import { dateField, numberField, selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { addDaysIso, longDate } from '../lib/dates';
import { fmtNumber } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { varied } from '../lib/spec-helpers';
import { z } from 'zod';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 21a (health): pregnancy weight gain (Institute of Medicine 2009 ranges), weight gain, IVF and reverse
 * due dates, period dates, daily protein and sleep cycles. Every page is general information that is not medical
 * advice, and the health disclaimer renders on all of them; ranges come from published guidance and are shown with
 * their limits. Not built on purpose: a blood-alcohol estimator, because an estimate can be acted on when driving.
 * Tier 2 or 3, so none is live until the cohort gate opens.
 */

const LB = '0.45359237';
const INCH = '0.0254';
const num = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max }),
});
const whole = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max, integer: true }),
});
const sel = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});
const date = (name: string, label: string, def: string) => ({ name, label, type: 'date' as const, default: def, validator: dateField() });
const out = (name: string, label: string, highlight = false) => ({ name, label, format: 'text' as const, ...(highlight ? { highlight: true } : {}) });
const amt = (x: Dec, dp: number, one: string, many: string): string => {
  const t = fmtNumber(x, dp);
  return `${t} ${t === '1' ? one : many}`;
};
const CLOCK = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)?\s*$/i;
const clockOk = (v: string): boolean => {
  const m = CLOCK.exec(v);
  if (!m) return false;
  const h = Number(m[1]);
  return Number(m[2]) <= 59 && (m[3] ? h >= 1 && h <= 12 : h <= 23);
};
const clockText = (name: string, label: string, def: string) => ({
  name,
  label,
  type: 'text' as const,
  default: def,
  validator: z.string().refine(clockOk, 'Enter a time such as 7:00 am or 23:45'),
});
const clockMinutes = (text: string): number => {
  const m = CLOCK.exec(text) as RegExpExecArray;
  let h = Number(m[1]);
  const ap = m[3]?.toLowerCase();
  if (ap) h = (h % 12) + (ap === 'pm' ? 12 : 0);
  return h * 60 + Number(m[2]);
};
const clock12 = (mins: number): string => {
  const t = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  return `${h % 12 || 12}:${String(t % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

type Cat = 'under' | 'healthy' | 'over' | 'obese';
const CAT_NAME: Record<Cat, string> = { under: 'Underweight', healthy: 'Healthy weight', over: 'Overweight', obese: 'Obese' };
/** Institute of Medicine (2009) singleton ranges: total in lb and kg, then weekly rate after week 13 in lb and kg. */
const SINGLE: Record<Cat, { lb: [string, string]; kg: [string, string]; rl: [string, string] }> = {
  under: { lb: ['28', '40'], kg: ['12.5', '18'], rl: ['1', '1.3'] },
  healthy: { lb: ['25', '35'], kg: ['11.5', '16'], rl: ['0.8', '1'] },
  over: { lb: ['15', '25'], kg: ['7', '11.5'], rl: ['0.5', '0.7'] },
  obese: { lb: ['11', '20'], kg: ['5', '9'], rl: ['0.4', '0.6'] },
};
const TWINS: Partial<Record<Cat, { lb: [number, number]; kg: [number, number] }>> = {
  healthy: { lb: [37, 54], kg: [17, 25] },
  over: { lb: [31, 50], kg: [14, 23] },
  obese: { lb: [25, 42], kg: [11, 19] },
};
const LEVELS: Record<string, [string, string]> = { rda: ['0.8', '0.8'], older: ['1', '1.2'], active: ['1.2', '1.6'], strength: ['1.4', '2'] };

export const SPECS: Spec[] = [
  {
    slug: 'pregnancy-weight-gain-calculator',
    category: 'health',
    tier: 2,
    subCluster: 'Pregnancy and fertility',
    title: 'Pregnancy Weight Gain Calculator: Recommended Range by Week',
    h1: 'Pregnancy Weight Gain Calculator',
    metaDescription:
      'See the recommended total weight gain for your pre-pregnancy BMI, singleton or twins, the typical range at your week of pregnancy and how your gain so far compares.',
    about:
      'How much weight is advisable to gain in pregnancy depends on where you started. The guidelines most widely quoted, from the US Institute of Medicine in 2009, set a range for each pre-pregnancy BMI group: more for those who began underweight, less for those who began with a higher weight. Enter your weight before pregnancy, your height, the week you are in, your weight now and whether you are expecting one baby or twins. The page gives your BMI group, the total range, the approximate range for this week and where your gain sits.',
    inputs: [
      sel('unit', 'Units', 'lb', [
        ['lb', 'Pounds and inches'],
        ['kg', 'Kilograms and centimetres'],
      ]),
      num('w0', 'Weight before pregnancy', 140, 60, 600),
      num('h', 'Height (inches, or cm in metric)', 65, 40, 250),
      whole('week', 'Weeks pregnant now', 22, 4, 42),
      num('w1', 'Weight now', 150, 60, 600),
      sel('twins', 'Expecting', 'one', [
        ['one', 'One baby'],
        ['twins', 'Twins'],
      ]),
    ],
    outputs: [
      out('bmi', 'Pre-pregnancy BMI', true),
      out('total', 'Recommended total gain'),
      out('now', 'Typical range by this week'),
      out('gained', 'Your gain so far'),
      out('status', 'How it compares'),
    ],
    calculate: (i) => {
      const lbUnit = String(i.unit) === 'lb';
      const w0 = toD(i.w0);
      const kg = lbUnit ? w0.mul(LB) : w0;
      const m = lbUnit ? toD(i.h).mul(INCH) : toD(i.h).div(100);
      const bmi = kg.div(m.pow(2));
      const cat: Cat = bmi.lt('18.5') ? 'under' : bmi.lt(25) ? 'healthy' : bmi.lt(30) ? 'over' : 'obese';
      const u = lbUnit ? 'lb' : 'kg';
      const gained = toD(i.w1).minus(w0);
      const base = { bmi: `${fmtNumber(bmi, 1)} (${CAT_NAME[cat]})`, gained: `${fmtNumber(gained, 1)} ${u}` };
      if (String(i.twins) === 'twins') {
        const t = TWINS[cat];
        if (!t) return { ...base, total: 'No firm guidance for underweight twin pregnancies', now: '', status: '' };
        const r = lbUnit ? t.lb : t.kg;
        return {
          ...base,
          total: `${r[0]} to ${r[1]} ${u}`,
          now: 'Not given for twins: ask your care provider about week-by-week targets',
          status: 'Compare your gain with the total above and discuss it with your care provider',
        };
      }
      const s = SINGLE[cat];
      const week = Number(i.week);
      const t = Math.min(week, 13);
      let lo = new D('1.1').mul(t).div(13);
      let hi = new D('4.4').mul(t).div(13);
      if (week > 13) {
        lo = lo.plus(new D(s.rl[0]).mul(week - 13));
        hi = hi.plus(new D(s.rl[1]).mul(week - 13));
      }
      if (!lbUnit) {
        lo = lo.mul(LB);
        hi = hi.mul(LB);
      }
      const r = lbUnit ? s.lb : s.kg;
      return {
        ...base,
        total: `${fmtNumber(new D(r[0]), 1)} to ${fmtNumber(new D(r[1]), 1)} ${u}`,
        now: `${fmtNumber(lo, 1)} to ${fmtNumber(hi, 1)} ${u} by week ${week}`,
        status: gained.lt(lo)
          ? 'Below the usual range for this week'
          : gained.gt(hi)
            ? 'Above the usual range for this week'
            : 'Within the usual range for this week',
      };
    },
    formulaDescription:
      'BMI = weight ÷ height². Total ranges (single baby, IOM 2009): underweight 28 to 40 lb, healthy 25 to 35, overweight 15 to 25, obese 11 to 20. After a first-trimester gain of about 1.1 to 4.4 lb, weekly gain is 1 to 1.3, 0.8 to 1, 0.5 to 0.7 and 0.4 to 0.6 lb. Twins (healthy weight 37 to 54 lb, overweight 31 to 50, obese 25 to 42) have no weekly guidance here.',
    formulaLatex: '\\text{BMI} = \\dfrac{m}{h^{2}}',
    workedExample:
      'Before pregnancy 140 lb at 65 inches is a BMI of 23.3, a healthy weight, so the total range is 25 to 35 lb. At week 22 the typical range is 8.3 to 13.4 lb; a gain of 10 lb is within it.',
    faq: [
      {
        question: 'Is this medical advice?',
        answer:
          'No. These are general guidelines; your own care provider sets targets for you, especially with a medical condition, twins or a very low or high starting weight.',
      },
      {
        question: 'Why is the range for this week approximate?',
        answer:
          'The guidelines give total and weekly rates, not a week-by-week chart, and individual pregnancies vary; the page interpolates from the published rates.',
      },
      {
        question: 'What if I am gaining outside the range?',
        answer: 'Talk to your midwife or doctor rather than changing your diet on your own; both too little and too much gain are worth discussing.',
      },
    ],
    scenarios: varied(
      'pregnancy-weight-gain-calculator',
      12,
      [
        { name: 'w0', lo: 98, hi: 240, step: 1 },
        { name: 'h', lo: 58, hi: 72, step: 1 },
        { name: 'week', lo: 8, hi: 40, step: 1 },
        { name: 'w1', lo: 100, hi: 270, step: 1 },
      ],
      [],
      (v) => `${v.w0} lb at ${v.h} in, week ${v.week}, now ${v.w1} lb`,
    ),
    introOutputs: ['total', 'now'],
    relatedSlugs: ['pregnancy-due-date-calculator', 'bmi-calculator', 'ovulation-calculator'],
    checks: [
      {
        inputs: {},
        expect: {
          bmi: '23.3 (Healthy weight)',
          gained: '10 lb',
          total: '25 to 35 lb',
          now: '8.3 to 13.4 lb by week 22',
          status: 'Within the usual range for this week',
        },
      },
      {
        inputs: { unit: 'kg', w0: 55, h: 165, week: 30, w1: 63 },
        expect: {
          bmi: '20.2 (Healthy weight)',
          gained: '8 kg',
          total: '11.5 to 16 kg',
          now: '6.7 to 9.7 kg by week 30',
          status: 'Within the usual range for this week',
        },
      },
      {
        inputs: { unit: 'lb', w0: 190, h: 64, week: 12, w1: 188 },
        expect: { bmi: '32.6 (Obese)', gained: '-2 lb', total: '11 to 20 lb', now: '1 to 4.1 lb by week 12', status: 'Below the usual range for this week' },
      },
      {
        inputs: { twins: 'twins' },
        expect: {
          bmi: '23.3 (Healthy weight)',
          gained: '10 lb',
          total: '37 to 54 lb',
          now: 'Not given for twins: ask your care provider about week-by-week targets',
          status: 'Compare your gain with the total above and discuss it with your care provider',
        },
      },
      {
        inputs: { unit: 'lb', w0: 105, h: 66, week: 36, w1: 140 },
        expect: {
          bmi: '16.9 (Underweight)',
          gained: '35 lb',
          total: '28 to 40 lb',
          now: '24.1 to 34.3 lb by week 36',
          status: 'Above the usual range for this week',
        },
      },
      {
        inputs: { unit: 'kg', w0: 62, h: 170, twins: 'twins', week: 20, w1: 70 },
        expect: {
          bmi: '21.5 (Healthy weight)',
          gained: '8 kg',
          total: '17 to 25 kg',
          now: 'Not given for twins: ask your care provider about week-by-week targets',
          status: 'Compare your gain with the total above and discuss it with your care provider',
        },
      },
      { inputs: { unit: 'kg', w0: 48, h: 172, twins: 'twins' }, expect: { total: 'No firm guidance for underweight twin pregnancies' } },
    ],
  },
  {
    slug: 'weight-gain-calculator',
    category: 'health',
    tier: 3,
    subCluster: 'Calories and energy',
    title: 'Weight Gain Calculator: Weekly Pace and Daily Calorie Surplus',
    h1: 'Weight Gain Calculator',
    metaDescription:
      'Work out the weekly gain and daily calorie surplus needed to reach a goal weight in a chosen number of weeks, and see how the pace compares with the gentle pace usually suggested.',
    about:
      'Gaining weight steadily comes down to eating a little more than you burn, day after day. A commonly used rule of thumb is that about 7,700 kilocalories, or 3,500 per pound, correspond to a kilogram of body weight. Enter your current weight, your goal and the number of weeks you want to take. The calculator shows the total to gain, the weekly gain and the average daily surplus, and says whether that pace is faster or slower than the 0.25 to 0.5 kilograms a week often suggested.',
    inputs: [
      sel('unit', 'Units', 'kg', [
        ['kg', 'Kilograms'],
        ['lb', 'Pounds'],
      ]),
      num('cur', 'Current weight', 60, 20, 600),
      num('goal', 'Goal weight', 65, 20, 600),
      whole('weeks', 'Weeks to reach it', 20, 1, 520),
    ],
    outputs: [out('gain', 'Total to gain', true), out('wk', 'Gain per week'), out('kcal', 'Extra calories per day'), out('pace', 'Pace')],
    calculate: (i) => {
      const cur = toD(i.cur);
      const goal = toD(i.goal);
      const kg = String(i.unit) === 'kg';
      if (goal.lte(cur)) return { gain: 'The goal must be above your current weight', wk: '', kcal: '', pace: '' };
      const gain = goal.minus(cur);
      const per = gain.div(toD(i.weeks));
      const kcal = per.mul(kg ? 7700 : 3500).div(7);
      const fast = per.gt(kg ? '0.5' : 1);
      const slow = per.lt(kg ? '0.25' : '0.5');
      return {
        gain: `${fmtNumber(gain, 1)} ${kg ? 'kg' : 'lb'}`,
        wk: `${fmtNumber(per, 2)} ${kg ? 'kg' : 'lb'} a week`,
        kcal: `${fmtNumber(kcal, 0)} kcal a day`,
        pace: fast
          ? 'Faster than the 0.25 to 0.5 kg (0.5 to 1 lb) a week often suggested for steady gain'
          : slow
            ? 'Slower than the pace often suggested, so it will take longer but is gentle'
            : 'Within the 0.25 to 0.5 kg (0.5 to 1 lb) a week often suggested for steady gain',
      };
    },
    formulaDescription:
      'Gain = goal − current. Weekly gain = gain ÷ weeks. Daily surplus = weekly gain × 7,700 kcal per kg (3,500 per lb) ÷ 7. This is a rule of thumb: real needs change as your weight and activity change, and not all gain is fat.',
    formulaLatex: '\\Delta E = \\dfrac{\\Delta W\\cdot 7700}{7\\,\\cdot\\, \\text{weeks}}',
    workedExample:
      'From 60 kg to 65 kg in 20 weeks is 5 kg, or 0.25 kg a week, which needs about 275 extra kilocalories a day. 15 lb in 10 weeks is 1.5 lb a week and 750 kcal a day, faster than the pace often suggested.',
    faq: [
      {
        question: 'Is the 7,700 kcal figure exact?',
        answer: 'No. It is an average; the energy in a kilogram of gain varies with the mix of fat and muscle, and your metabolism adapts.',
      },
      {
        question: 'Is this medical advice?',
        answer: 'No. If you are underweight or have lost weight without trying, speak to a doctor before changing your diet.',
      },
      {
        question: 'How do I gain muscle rather than fat?',
        answer: 'Combine a modest surplus with resistance training and enough protein; the protein calculator gives a typical range.',
      },
    ],
    scenarios: varied(
      'weight-gain-calculator',
      12,
      [
        { name: 'cur', lo: 42, hi: 90, step: 0.5 },
        { name: 'goal', lo: 48, hi: 98, step: 0.5 },
        { name: 'weeks', lo: 6, hi: 60, step: 1 },
      ],
      [{ name: 'unit', options: ['kg'] }],
      (v) => `${v.cur} kg to ${v.goal} kg in ${v.weeks} weeks`,
    ),
    introOutputs: ['wk', 'kcal'],
    relatedSlugs: ['calorie-calculator', 'tdee-calculator', 'bmi-calculator'],
    checks: [
      {
        inputs: {},
        expect: {
          gain: '5 kg',
          wk: '0.25 kg a week',
          kcal: '275 kcal a day',
          pace: 'Within the 0.25 to 0.5 kg (0.5 to 1 lb) a week often suggested for steady gain',
        },
      },
      {
        inputs: { unit: 'lb', cur: 130, goal: 145, weeks: 10 },
        expect: {
          gain: '15 lb',
          wk: '1.5 lb a week',
          kcal: '750 kcal a day',
          pace: 'Faster than the 0.25 to 0.5 kg (0.5 to 1 lb) a week often suggested for steady gain',
        },
      },
      {
        inputs: { unit: 'kg', cur: 70, goal: 72, weeks: 52 },
        expect: {
          gain: '2 kg',
          wk: '0.04 kg a week',
          kcal: '42 kcal a day',
          pace: 'Slower than the pace often suggested, so it will take longer but is gentle',
        },
      },
      { inputs: { cur: 60, goal: 55 }, expect: { gain: 'The goal must be above your current weight' } },
    ],
  },
  {
    slug: 'ivf-due-date-calculator',
    category: 'health',
    tier: 3,
    subCluster: 'Pregnancy and fertility',
    title: 'IVF Due Date Calculator: From Embryo Transfer Date',
    h1: 'IVF Due Date Calculator',
    metaDescription:
      'Estimate the due date after IVF from the embryo transfer date and the age of the embryo at transfer, with the equivalent last-period date and key pregnancy dates.',
    about:
      'Fertility treatment gives an unusually precise starting point, because the age of the embryo is known to the day. A blastocyst moved on its fifth day has already developed for five days, so the birth estimate sits 261 days after the transfer; a three-day embryo adds two more days to the wait. Enter the transfer date and the day of the embryo. The result is the estimated birth date, plus the matching first-day-of-last-cycle date clinics use to count weeks, the close of the first trimester and the 20-week scan point. Embryologists, nurses and the patients themselves use the figure to plan medication schedules, the first blood test, early scans and leave from work, whether the transfer was fresh or from a cryopreserved cycle. Dating from your own clinic always takes priority.',
    inputs: [
      date('t', 'Embryo transfer date', '2026-03-10'),
      sel('age', 'Age of the embryo at transfer', '5', [
        ['3', 'Day 3 embryo'],
        ['5', 'Day 5 blastocyst'],
        ['6', 'Day 6 blastocyst'],
      ]),
    ],
    outputs: [
      out('due', 'Estimated birth date', true),
      out('lmp', 'Last-cycle equivalent date'),
      out('tri', 'Close of the first trimester'),
      out('scan', 'Mid-pregnancy scan point (20 weeks)'),
    ],
    calculate: (i) => {
      const due = addDaysIso(String(i.t), 266 - Number(i.age));
      const lmp = addDaysIso(due, -280);
      return { due: longDate(due), lmp: longDate(lmp), tri: longDate(addDaysIso(lmp, 91)), scan: longDate(addDaysIso(lmp, 140)) };
    },
    formulaDescription:
      'Due date = transfer date + 266 − embryo age in days (261 days after a day-5 transfer, 263 after day 3, 260 after day 6). The equivalent last-period date is the due date minus 280 days; 13 weeks is 91 days and 20 weeks 140 days from it.',
    formulaLatex: '\\text{due} = \\text{transfer} + 266 - a',
    workedExample:
      'A day-5 transfer on 10 March 2026 gives a due date of Thursday 26 Nov 2026, an equivalent last period of 19 Feb 2026, the end of the first trimester on 21 May and 20 weeks on 9 July.',
    faq: [
      {
        question: 'Why 266 days?',
        answer:
          'It is the average time from conception to birth, 38 weeks; a transferred embryo has already had a few days of development, which are subtracted.',
      },
      { question: 'Is the due date exact?', answer: 'No. Most babies arrive within a couple of weeks of it; your clinic confirms dating with scans.' },
      { question: 'What about a frozen transfer?', answer: 'The same rule applies, as the embryo age counts from fertilisation.' },
    ],
    scenarios: varied('ivf-due-date-calculator', 12, [], [{ name: 'age', options: ['3', '5', '6'] }], (v) => `day ${v.age} transfer`)
      .map((s, k) => ({
        ...s,
        label: `${s.label} on 2026-${String((k % 9) + 2).padStart(2, '0')}-${String(3 + k * 2).padStart(2, '0')}`,
        inputs: { ...s.inputs, t: `2026-${String((k % 9) + 2).padStart(2, '0')}-${String(3 + k * 2).padStart(2, '0')}` },
      }))
      .slice(0, 5),
    introOutputs: ['due'],
    relatedSlugs: ['pregnancy-due-date-calculator', 'reverse-due-date-calculator', 'ovulation-calculator'],
    checks: [
      { inputs: {}, expect: { due: 'Thursday, 26 Nov 2026', lmp: 'Thursday, 19 Feb 2026', tri: 'Thursday, 21 May 2026', scan: 'Thursday, 9 Jul 2026' } },
      {
        inputs: { t: '2026-06-15', age: 3 },
        expect: { due: 'Friday, 5 Mar 2027', lmp: 'Friday, 29 May 2026', tri: 'Friday, 28 Aug 2026', scan: 'Friday, 16 Oct 2026' },
      },
      {
        inputs: { t: '2027-01-20', age: 6 },
        expect: { due: 'Thursday, 7 Oct 2027', lmp: 'Thursday, 31 Dec 2026', tri: 'Thursday, 1 Apr 2027', scan: 'Thursday, 20 May 2027' },
      },
    ],
  },
  {
    slug: 'reverse-due-date-calculator',
    category: 'health',
    tier: 3,
    subCluster: 'Pregnancy and fertility',
    title: 'Reverse Due Date Calculator: Work Back From the Due Date',
    h1: 'Reverse Due Date Calculator',
    metaDescription:
      'Work backwards from a due date to the estimated conception date, the first day of the last period, the end of the first trimester and the start of 37 weeks.',
    about:
      'Already holding a due date from a scan or a clinic letter, and curious when it all began? Count backward: the official start of the pregnancy is 280 days before the expected birth, while the moment of conception falls roughly two weeks after that, 266 days before. Type the expected birth date and the page returns both anchors, the day the first twelve weeks wrap up and the day week 37 begins, the point at which a newborn counts as early term.',
    inputs: [date('due', 'Due date', '2026-12-06')],
    outputs: [
      out('lmp', 'Day the pregnancy is counted from', true),
      out('conc', 'About when conception happened'),
      out('tri', 'Day twelve weeks are complete'),
      out('w37', 'Day week 37 begins'),
    ],
    calculate: (i) => {
      const due = String(i.due);
      const lmp = addDaysIso(due, -280);
      return { lmp: longDate(lmp), conc: longDate(addDaysIso(due, -266)), tri: longDate(addDaysIso(lmp, 91)), w37: longDate(addDaysIso(lmp, 259)) };
    },
    formulaDescription:
      'Last-period date = due date − 280 days. Estimated conception = due date − 266 days. End of the first trimester = last-period date + 91 days; 37 weeks = last-period date + 259 days. Based on an average 28-day cycle.',
    formulaLatex: '\\text{LMP} = \\text{due} - 280',
    workedExample:
      'A due date of Sunday 6 Dec 2026 means the pregnancy is dated from Sunday 1 Mar 2026, with conception around 15 March, the first trimester ending 31 May and 37 weeks on 15 Nov.',
    faq: [
      {
        question: 'Is the conception date reliable?',
        answer: 'It is an estimate: with a cycle longer or shorter than 28 days, or after fertility treatment, the real date differs.',
      },
      {
        question: 'Why does pregnancy start before conception?',
        answer: 'By convention weeks are counted from the last period, about two weeks before conception.',
      },
      {
        question: 'What is early term?',
        answer: 'Babies born from 37 weeks and 0 days to 38 weeks and 6 days are called early term; full term starts at 39 weeks.',
      },
    ],
    scenarios: [...Array(12).keys()]
      .map((k) => ({
        label: `due 2026-${String((k % 12) + 1).padStart(2, '0')}-${String(5 + k * 2).padStart(2, '0')}`,
        inputs: { due: `2026-${String((k % 12) + 1).padStart(2, '0')}-${String(5 + k * 2).padStart(2, '0')}` },
      }))
      .slice(0, 5),
    introOutputs: ['lmp'],
    relatedSlugs: ['pregnancy-due-date-calculator', 'ivf-due-date-calculator', 'ovulation-calculator'],
    checks: [
      { inputs: {}, expect: { lmp: 'Sunday, 1 Mar 2026', conc: 'Sunday, 15 Mar 2026', tri: 'Sunday, 31 May 2026', w37: 'Sunday, 15 Nov 2026' } },
      {
        inputs: { due: '2027-02-28' },
        expect: { lmp: 'Sunday, 24 May 2026', conc: 'Sunday, 7 Jun 2026', tri: 'Sunday, 23 Aug 2026', w37: 'Sunday, 7 Feb 2027' },
      },
      {
        inputs: { due: '2028-03-01' },
        expect: { lmp: 'Wednesday, 26 May 2027', conc: 'Wednesday, 9 Jun 2027', tri: 'Wednesday, 25 Aug 2027', w37: 'Wednesday, 9 Feb 2028' },
      },
    ],
  },
  {
    slug: 'period-calculator',
    category: 'health',
    tier: 3,
    subCluster: 'Pregnancy and fertility',
    title: 'Period Calculator: Next Period Dates and Fertile Window',
    h1: 'Period Calculator',
    metaDescription:
      'Predict your next three period dates from the first day of your last period and your cycle length, with the estimated ovulation day and fertile window.',
    about:
      'Menstrual cycles tick along at an individual rhythm, usually between three and five weeks from one bleed to the next. Provide the first day of your latest bleed, your typical gap in days and how long the bleeding usually lasts, and the planner lists the next three start dates, the end of the coming one, the probable ovulation day and the days when conception is most likely. Erratic cycles make every forecast shaky, and none of this replaces contraception or medical advice. It is handy for slotting a holiday, a swimming gala, an exam week or a hiking trip around the bleed, for knowing when to stock the bathroom cupboard, and for spotting that a cycle has gone unusually long. Teenagers learning their own pattern, people coming off the pill or back from postnatal months, and anyone keeping a diary can compare the forecast with what really happens.',
    inputs: [
      date('last', 'First day of your last period', '2026-03-01'),
      whole('cycle', 'Cycle length (days)', 28, 21, 45),
      whole('plen', 'Length of your period (days)', 5, 1, 10),
    ],
    outputs: [
      out('next', 'Next period starts', true),
      out('ends', 'It should end'),
      out('n2', 'The one after'),
      out('n3', 'Then'),
      out('ov', 'Likely egg-release day'),
      out('fert', 'Days with the best chance of conception'),
    ],
    calculate: (i) => {
      const last = String(i.last);
      const cyc = Number(i.cycle);
      const next = addDaysIso(last, cyc);
      const ov = addDaysIso(next, -14);
      return {
        next: longDate(next),
        ends: longDate(addDaysIso(next, Number(i.plen) - 1)),
        n2: longDate(addDaysIso(last, 2 * cyc)),
        n3: longDate(addDaysIso(last, 3 * cyc)),
        ov: longDate(ov),
        fert: `${longDate(addDaysIso(ov, -5))} to ${longDate(addDaysIso(ov, 1))}`,
      };
    },
    formulaDescription:
      'Next period = last period start + cycle length. Ovulation is estimated 14 days before the next period; the fertile window runs from 5 days before ovulation to 1 day after. Predictions assume a regular cycle; stress, illness and hormones can shift it. It is not a contraception method.',
    formulaLatex: 'd_{next} = d_{last} + L',
    workedExample:
      'A period starting 1 March 2026 with a 28-day cycle: the next starts Sunday 29 Mar and ends 2 Apr (5 days), then 26 Apr and 24 May. Ovulation is around Sunday 15 Mar and the fertile window runs 10 to 16 March.',
    faq: [
      {
        question: 'Can I use it to avoid pregnancy?',
        answer: 'No. Predictions are estimates and cycles vary, so this is not a reliable way to prevent pregnancy.',
      },
      {
        question: 'What if my cycle is irregular?',
        answer: 'The estimates become unreliable; tracking several cycles and speaking to a doctor is more useful.',
      },
      { question: 'Is a late period always pregnancy?', answer: 'No, many things delay a period. A test or a clinician can tell.' },
    ],
    scenarios: varied(
      'period-calculator',
      12,
      [
        { name: 'cycle', lo: 23, hi: 38, step: 1 },
        { name: 'plen', lo: 3, hi: 8, step: 1 },
      ],
      [],
      (v) => `cycle ${v.cycle} days, period ${v.plen} days`,
    )
      .map((s, k) => ({
        ...s,
        label: `${s.label} from 2026-${String((k % 12) + 1).padStart(2, '0')}-${String(3 + k)}`,
        inputs: { ...s.inputs, last: `2026-${String((k % 12) + 1).padStart(2, '0')}-${String(3 + k).padStart(2, '0')}` },
      }))
      .slice(0, 5),
    introOutputs: ['next'],
    relatedSlugs: ['ovulation-calculator', 'pregnancy-due-date-calculator', 'date-difference-calculator'],
    checks: [
      {
        inputs: {},
        expect: {
          next: 'Sunday, 29 Mar 2026',
          ends: 'Thursday, 2 Apr 2026',
          n2: 'Sunday, 26 Apr 2026',
          n3: 'Sunday, 24 May 2026',
          ov: 'Sunday, 15 Mar 2026',
          fert: 'Tuesday, 10 Mar 2026 to Monday, 16 Mar 2026',
        },
      },
      {
        inputs: { last: '2026-12-20', cycle: 35, plen: 7 },
        expect: {
          next: 'Sunday, 24 Jan 2027',
          ends: 'Saturday, 30 Jan 2027',
          n2: 'Sunday, 28 Feb 2027',
          n3: 'Sunday, 4 Apr 2027',
          ov: 'Sunday, 10 Jan 2027',
          fert: 'Tuesday, 5 Jan 2027 to Monday, 11 Jan 2027',
        },
      },
      {
        inputs: { last: '2027-02-01', cycle: 24, plen: 4 },
        expect: {
          next: 'Thursday, 25 Feb 2027',
          ends: 'Sunday, 28 Feb 2027',
          n2: 'Sunday, 21 Mar 2027',
          n3: 'Wednesday, 14 Apr 2027',
          ov: 'Thursday, 11 Feb 2027',
          fert: 'Saturday, 6 Feb 2027 to Friday, 12 Feb 2027',
        },
      },
    ],
  },
  {
    slug: 'protein-calculator',
    category: 'health',
    tier: 2,
    subCluster: 'Nutrition',
    title: 'Protein Calculator: Daily Protein Intake by Weight and Activity',
    h1: 'Protein Calculator',
    metaDescription: 'Estimate a daily protein range from your body weight and activity level, with the amount per meal and the calories it provides.',
    about:
      'How much protein you need depends on your body weight and how active you are. The recommended daily allowance for most adults is 0.8 grams per kilogram, a minimum to prevent deficiency. Higher intakes are often suggested for older adults, around 1 to 1.2 grams, for people who exercise regularly, 1.2 to 1.6, and for those in serious strength or endurance training, 1.4 to 2. Enter your weight, choose your level and the number of meals to see a daily range, the amount per meal and the calories it supplies.',
    inputs: [
      sel('unit', 'Weight unit', 'kg', [
        ['kg', 'Kilograms'],
        ['lb', 'Pounds'],
      ]),
      num('w', 'Body weight', 70, 20, 400),
      sel('lvl', 'Activity level', 'active', [
        ['rda', 'General adult (RDA minimum)'],
        ['older', 'Older adult'],
        ['active', 'Regular exercise'],
        ['strength', 'Strength or endurance training'],
      ]),
      whole('meals', 'Meals to spread it over', 4, 1, 8),
    ],
    outputs: [out('day', 'Daily protein', true), out('meal', 'Per meal'), out('kcal', 'Calories from protein'), out('gkg', 'Range used')],
    calculate: (i) => {
      const w = toD(i.w);
      const kg = String(i.unit) === 'lb' ? w.mul(LB) : w;
      const [lo, hi] = (LEVELS[String(i.lvl)] ?? LEVELS.active).map((x) => new D(x));
      const meals = toD(i.meals);
      const rng = (a: Dec, b: Dec, unit = 'g'): string =>
        fmtNumber(a, 0) === fmtNumber(b, 0) ? `${fmtNumber(a, 0)} ${unit}` : `${fmtNumber(a, 0)} to ${fmtNumber(b, 0)} ${unit}`;
      const a = kg.mul(lo);
      const b = kg.mul(hi);
      return {
        day: rng(a, b),
        meal: rng(a.div(meals), b.div(meals)),
        kcal: rng(a.mul(4), b.mul(4), 'kcal'),
        gkg: lo.eq(hi) ? `${fmtNumber(lo, 1)} g per kg` : `${fmtNumber(lo, 1)} to ${fmtNumber(hi, 1)} g per kg`,
      };
    },
    formulaDescription:
      'Protein = body weight in kg × grams per kg for your level: 0.8 (RDA), 1.0 to 1.2 (older adults), 1.2 to 1.6 (regular exercise), 1.4 to 2.0 (training). Calories = grams × 4. These are general ranges; kidney disease, pregnancy and other conditions need individual advice.',
    formulaLatex: 'P = m_{kg}\\times g',
    workedExample:
      'A 70 kg person who exercises regularly: 1.2 to 1.6 g per kg is 84 to 112 g a day, which is 21 to 28 g across four meals and 336 to 448 kcal. At the RDA, 60 kg needs 48 g.',
    faq: [
      {
        question: 'Can I eat too much protein?',
        answer: 'Most healthy people tolerate higher intakes, but kidney disease and some other conditions need limits; ask your doctor.',
      },
      { question: 'Does it matter when I eat it?', answer: 'Spreading it over the day, with 20 to 30 g at meals, is often suggested for muscle maintenance.' },
      { question: 'Is this a diet plan?', answer: 'No, it only estimates a protein range; your total energy and overall diet matter too.' },
    ],
    scenarios: varied(
      'protein-calculator',
      12,
      [
        { name: 'w', lo: 42, hi: 125, step: 0.5 },
        { name: 'meals', lo: 2, hi: 6, step: 1 },
      ],
      [
        { name: 'lvl', options: ['rda', 'older', 'active', 'strength'] },
        { name: 'unit', options: ['kg'] },
      ],
      (v) => `${v.w} kg, ${v.lvl}, ${v.meals} meals`,
    ),
    introOutputs: ['day'],
    relatedSlugs: ['macro-calculator', 'calorie-calculator', 'tdee-calculator'],
    checks: [
      { inputs: {}, expect: { day: '84 to 112 g', meal: '21 to 28 g', kcal: '336 to 448 kcal', gkg: '1.2 to 1.6 g per kg' } },
      {
        inputs: { unit: 'lb', w: 180, lvl: 'strength', meals: 5 },
        expect: { day: '114 to 163 g', meal: '23 to 33 g', kcal: '457 to 653 kcal', gkg: '1.4 to 2 g per kg' },
      },
      { inputs: { w: 60, lvl: 'rda', meals: 3 }, expect: { day: '48 g', meal: '16 g', kcal: '192 kcal', gkg: '0.8 g per kg' } },
      { inputs: { w: 82, lvl: 'older', meals: 3 }, expect: { day: '82 to 98 g', meal: '27 to 33 g', kcal: '328 to 394 kcal', gkg: '1 to 1.2 g per kg' } },
    ],
  },
  {
    slug: 'sleep-calculator',
    category: 'health',
    tier: 2,
    subCluster: 'Sleep',
    title: 'Sleep Calculator: Bedtimes and Wake Times by Sleep Cycle',
    h1: 'Sleep Calculator',
    metaDescription: 'Find the best times to go to bed or wake up so that you complete whole 90-minute sleep cycles, allowing time to fall asleep.',
    about:
      'Rest comes in loops lasting roughly ninety minutes, from light drowsiness down to deep sleep and back up toward dreaming, and an alarm that lands near the top of a loop tends to feel gentler. Choose whether the alarm time is fixed or the lights-out time is fixed, add the minutes you normally lie awake before dozing off, and the page lists four candidate clock times that complete whole loops, along with the hours of rest each represents. Individual loop length differs, so use it as a guide.',
    inputs: [
      sel('mode', 'I want to', 'wake', [
        ['wake', 'Wake up at a set time (find bedtimes)'],
        ['bed', 'Go to bed at a set time (find wake times)'],
      ]),
      clockText('t', 'Time (e.g. 7:00 am or 23:45)', '7:00 am'),
      whole('fall', 'Minutes to fall asleep', 15, 0, 90),
    ],
    outputs: [out('t6', 'Six cycles', true), out('t5', 'Five cycles'), out('t4', 'Four cycles'), out('t3', 'Three cycles')],
    calculate: (i) => {
      const t = clockMinutes(String(i.t));
      const fall = Number(i.fall);
      const wake = String(i.mode) === 'wake';
      const line = (k: number): string => `${clock12(wake ? t - fall - k * 90 : t + fall + k * 90)} (${fmtNumber(new D(k).mul('1.5'), 1)} hours of sleep)`;
      return { t6: line(6), t5: line(5), t4: line(4), t3: line(3) };
    },
    formulaDescription:
      'Time = target time ∓ (minutes to fall asleep + 90 × number of cycles). Six cycles is 9 hours of sleep, five is 7.5, four is 6 and three is 4.5. The 90-minute cycle is an average; most adults are advised to aim for 7 to 9 hours.',
    formulaLatex: 't = t_{target} \\mp (f + 90\\,n)',
    workedExample:
      'To wake at 7:00 am with 15 minutes to fall asleep, go to bed at 9:45 PM for nine hours, 11:15 PM for 7.5, or 12:45 AM for six. Going to bed at 10:30 pm, you would wake at 6:15 AM after five cycles.',
    faq: [
      {
        question: 'Is waking at the end of a cycle really better?',
        answer: 'Many people find it easier, but evidence is mixed; total sleep matters more than the exact minute.',
      },
      { question: 'How much sleep do adults need?', answer: 'Most adults do best with 7 to 9 hours; this page lists four to help you choose.' },
      { question: 'Is this medical advice?', answer: 'No. Persistent sleep problems are worth discussing with a doctor.' },
    ],
    scenarios: varied(
      'sleep-calculator',
      12,
      [{ name: 'fall', lo: 5, hi: 40, step: 5 }],
      [{ name: 'mode', options: ['wake', 'bed'] }],
      (v) => `${v.mode} with ${v.fall} minutes to doze off`,
    )
      .map((s, k) => ({
        ...s,
        label: `${s.label} at ${5 + (k % 5)}:${['00', '15', '30', '45'][k % 4]} ${k % 2 ? 'am' : 'pm'}`,
        inputs: { ...s.inputs, t: `${5 + (k % 5)}:${['00', '15', '30', '45'][k % 4]} ${k % 2 ? 'am' : 'pm'}` },
      }))
      .slice(0, 6),
    introOutputs: ['t6', 't5'],
    relatedSlugs: ['hours-calculator', 'time-duration-calculator', 'bmr-calculator'],
    checks: [
      {
        inputs: {},
        expect: {
          t6: '9:45 PM (9 hours of sleep)',
          t5: '11:15 PM (7.5 hours of sleep)',
          t4: '12:45 AM (6 hours of sleep)',
          t3: '2:15 AM (4.5 hours of sleep)',
        },
      },
      {
        inputs: { mode: 'bed', t: '10:30 pm' },
        expect: { t6: '7:45 AM (9 hours of sleep)', t5: '6:15 AM (7.5 hours of sleep)', t4: '4:45 AM (6 hours of sleep)', t3: '3:15 AM (4.5 hours of sleep)' },
      },
      {
        inputs: { t: '5:45', fall: 20 },
        expect: {
          t6: '8:25 PM (9 hours of sleep)',
          t5: '9:55 PM (7.5 hours of sleep)',
          t4: '11:25 PM (6 hours of sleep)',
          t3: '12:55 AM (4.5 hours of sleep)',
        },
      },
      {
        inputs: { mode: 'bed', t: '23:45', fall: 10 },
        expect: { t6: '8:55 AM (9 hours of sleep)', t5: '7:25 AM (7.5 hours of sleep)', t4: '5:55 AM (6 hours of sleep)', t3: '4:25 AM (4.5 hours of sleep)' },
      },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
