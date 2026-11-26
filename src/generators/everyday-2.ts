import { z } from 'zod';
import { numberField, selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtCurrency, fmtNumber, plural } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 21b (everyday life): time and pay arithmetic (hours worked, time sums, hours to decimals, timesheets),
 * bra sizing from measurements and tyre sizes. Exact decimal arithmetic. Sizing pages say fit varies by maker.
 * Everyday life shows no disclaimer. Tier 2 or 3, so none is live until the cohort gate opens.
 */

const PI = D.acos(-1);
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
const out = (name: string, label: string, highlight = false) => ({ name, label, format: 'text' as const, ...(highlight ? { highlight: true } : {}) });
const amt = (x: Dec, dp: number, one: string, many: string): string => {
  const t = fmtNumber(x, dp);
  return `${t} ${t === '1' ? one : many}`;
};
const hm = (minutes: number): string => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
const roundMin = (hours: Dec): number => Number(hours.mul(60).toFixed(0, D.ROUND_HALF_UP));
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
  validator: z.string().refine(clockOk, 'Enter a time such as 9:00 am or 17:30'),
});
const clockMinutes = (text: string): number => {
  const m = CLOCK.exec(text) as RegExpExecArray;
  let h = Number(m[1]);
  const ap = m[3]?.toLowerCase();
  if (ap) h = (h % 12) + (ap === 'pm' ? 12 : 0);
  return h * 60 + Number(m[2]);
};
const TOKEN = /^\d+(:\d{2})?$|^\d+(\.\d+)?$/;
const tokenHours = (t: string): Dec => {
  if (t.includes(':')) {
    const [h, m] = t.split(':');
    return toD(h).plus(toD(m).div(60));
  }
  return toD(t);
};
const US_CUP: Record<number, string> = { 0: 'AA', 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'DD', 6: 'DDD', 7: 'DDDD' };
const UK_CUP: Record<number, string> = { 0: 'AA', 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'DD', 6: 'E', 7: 'F' };
const TIRE = /^\s*(\d{3})\/(\d{2})\s*[rR]\s*(\d{2})\s*$/;
const tireText = (name: string, label: string, def: string) => ({
  name,
  label,
  type: 'text' as const,
  default: def,
  validator: z.string().refine((v) => TIRE.test(v), 'Enter a tyre size such as 205/55R16'),
});
const tire = (text: string): { w: number; a: number; r: number } => {
  const m = TIRE.exec(text) as RegExpExecArray;
  return { w: Number(m[1]), a: Number(m[2]), r: Number(m[3]) };
};
const tireDiameter = (t: { w: number; a: number; r: number }): Dec => new D(t.r).mul('25.4').plus(new D(t.w).mul(t.a).div(100).mul(2));

export const SPECS: Spec[] = [
  {
    slug: 'hours-calculator',
    category: 'everyday-life',
    tier: 2,
    subCluster: 'Time and work',
    title: 'Hours Calculator: Hours Worked Between Two Times',
    h1: 'Hours Calculator',
    metaDescription:
      'Calculate the hours worked between a start and an end time, including overnight shifts and an unpaid break, in hours and minutes and in decimal hours, for one or several days.',
    about:
      'Clock in at one time, clock out at another, and the gap between them is what a payslip or invoice is built on. Type when the shift began and ended, in 24-hour style such as 17:30 or with am and pm, then the unpaid lunch in minutes and how many days you repeated the shift. Shifts that stretch beyond midnight are handled automatically. You receive the length of one shift in hours and minutes, the same length as a decimal ready for multiplying by a wage, and the grand total for the stretch. Freelancers use it to bill a client for a morning session, supervisors to check rota lengths, and students to log study blocks against a timetable.',
    inputs: [
      clockText('s', 'Start time', '9:00 am'),
      clockText('e', 'End time', '5:30 pm'),
      whole('brk', 'Unpaid break (minutes)', 30, 0, 600),
      whole('days', 'Number of days', 5, 1, 366),
    ],
    outputs: [out('day', 'Time worked per day', true), out('dec', 'In decimal hours'), out('tot', 'Total over all the days'), out('days', 'Days')],
    calculate: (i) => {
      const s = clockMinutes(String(i.s));
      const e = clockMinutes(String(i.e));
      const span = e === s ? 0 : (((e - s) % 1440) + 1440) % 1440;
      const net = Math.max(0, span - Number(i.brk));
      const days = Number(i.days);
      return {
        day: hm(net),
        dec: amt(new D(net).div(60), 2, 'hour', 'hours'),
        tot: amt(new D(net * days).div(60), 2, 'hour', 'hours'),
        days: plural(days, 'day'),
      };
    },
    formulaDescription:
      'Time worked = end − start (adding 24 hours if the end is earlier, an overnight shift) − unpaid break. Decimal hours = minutes ÷ 60. Total = daily time × days. The same start and end time counts as no time worked.',
    formulaLatex: 't = (t_{end} - t_{start}) \\bmod 24\\,\\text{h} - b',
    workedExample:
      '9:00 am to 5:30 pm with a 30-minute break is 8 hours 0 minutes, 8 decimal hours, and 40 hours over five days. A 22:00 to 6:30 night shift with a 45-minute break is 7 h 45 min, 7.75 hours.',
    faq: [
      {
        question: 'How are overnight shifts handled?',
        answer: 'If the end time is earlier than the start, the shift is assumed to run past midnight into the next day.',
      },
      { question: 'Why decimal hours?', answer: 'Pay is hours times a rate, so 7 h 45 min must become 7.75 before multiplying.' },
      { question: 'Is a break included?', answer: 'Only if you leave the minutes at zero; the unpaid break is subtracted.' },
    ],
    scenarios: [
      ['9:00 am', '5:30 pm', 30, 5],
      ['22:00', '6:30', 45, 4],
      ['7:15 am', '3:45 pm', 30, 5],
      ['8:30', '12:15', 0, 3],
      ['1:00 pm', '10:00 pm', 60, 6],
      ['6:00 am', '2:30 pm', 20, 5],
      ['11:00 pm', '7:00 am', 30, 2],
      ['10:20', '16:50', 25, 4],
      ['8:00 am', '8:00 pm', 90, 3],
      ['5:45 am', '1:15 pm', 15, 5],
      ['12:30 pm', '9:15 pm', 45, 7],
      ['9:10', '17:05', 35, 20],
    ]
      .map(([s, e, brk, days]) => ({ label: `clock-in ${s} clock-out ${e} lunch ${brk}`, inputs: { s, e, brk, days } }))
      .slice(0, 6),
    introOutputs: ['day'],
    relatedSlugs: ['time-duration-calculator', 'time-card-calculator', 'sleep-calculator'],
    checks: [
      { inputs: {}, expect: { day: '8 h 0 min', dec: '8 hours', tot: '40 hours', days: '5 days' } },
      { inputs: { s: '22:00', e: '6:30', brk: 45, days: 4 }, expect: { day: '7 h 45 min', dec: '7.75 hours', tot: '31 hours', days: '4 days' } },
      { inputs: { s: '8:15 am', e: '12:15 pm', brk: 0, days: 1 }, expect: { day: '4 h 0 min', dec: '4 hours', tot: '4 hours', days: '1 day' } },
      { inputs: { s: '9:00', e: '9:00' }, expect: { day: '0 h 0 min', dec: '0 hours', tot: '0 hours', days: '5 days' } },
    ],
  },
  {
    slug: 'time-calculator',
    category: 'everyday-life',
    tier: 2,
    subCluster: 'Time and work',
    title: 'Time Calculator: Add or Subtract Days, Hours, Minutes and Seconds',
    h1: 'Time Calculator',
    metaDescription:
      'Add or subtract two lengths of time in days, hours, minutes and seconds, with the result in each unit and in total hours, minutes and seconds.',
    about:
      'Adding lap times, summing the length of videos or working out how far apart two durations are all need arithmetic in base 60, which is easy to get wrong by hand. Enter a first duration in days, hours, minutes and seconds, choose add or subtract, then enter a second duration in hours, minutes and seconds. The calculator carries the seconds into minutes and the minutes into hours and shows the answer in days, hours, minutes and seconds, together with the total in hours, minutes and seconds. A negative result is shown with a minus sign.',
    inputs: [
      whole('d1', 'First: days', 1, 0, 100000),
      whole('h1', 'First: hours', 5, 0, 100000),
      whole('m1', 'First: minutes', 45, 0, 100000),
      whole('s1', 'First: seconds', 30, 0, 100000),
      sel('op', 'Operation', 'add', [
        ['add', 'Add'],
        ['sub', 'Subtract'],
      ]),
      whole('h2', 'Second: hours', 2, 0, 100000),
      whole('m2', 'Second: minutes', 20, 0, 100000),
      whole('s2', 'Second: seconds', 50, 0, 100000),
    ],
    outputs: [out('res', 'Result', true), out('hrs', 'In hours'), out('min', 'In minutes'), out('sec', 'In seconds')],
    calculate: (i) => {
      const a = ((Number(i.d1) * 24 + Number(i.h1)) * 60 + Number(i.m1)) * 60 + Number(i.s1);
      const b = (Number(i.h2) * 60 + Number(i.m2)) * 60 + Number(i.s2);
      const r = String(i.op) === 'add' ? a + b : a - b;
      const abs = Math.abs(r);
      const parts = [Math.floor(abs / 86400), Math.floor((abs % 86400) / 3600), Math.floor((abs % 3600) / 60), abs % 60];
      const text = ['d', 'h', 'min', 's']
        .map((u, k) => (parts[k] ? `${parts[k]} ${u}` : ''))
        .filter(Boolean)
        .join(' ');
      return {
        res: `${r < 0 ? '-' : ''}${text || '0 s'}`,
        hrs: amt(new D(abs).div(3600), 4, 'hour', 'hours'),
        min: amt(new D(abs).div(60), 2, 'minute', 'minutes'),
        sec: amt(new D(abs), 0, 'second', 'seconds'),
      };
    },
    formulaDescription:
      'Everything is converted to seconds (1 day = 86,400 s, 1 hour = 3,600 s, 1 minute = 60 s), added or subtracted, and converted back by repeated division with remainder.',
    formulaLatex: 't = t_{1} \\pm t_{2}',
    workedExample:
      '1 d 5 h 45 min 30 s plus 2 h 20 min 50 s is 1 d 8 h 6 min 20 s, which is 32.1056 hours or 115,580 seconds. Subtracting 2 h 5 min 30 s from 1 h 10 min gives −55 min 30 s.',
    faq: [
      { question: 'Does it work for clock times?', answer: 'It adds durations. To find the time between two clock times use the hours calculator.' },
      { question: 'What does the minus sign mean?', answer: 'The second duration was longer than the first, so the result is below zero.' },
      { question: 'How do I enter hours over 24?', answer: 'Put them in the hours field; they are carried into days in the result.' },
    ],
    scenarios: varied(
      'time-calculator',
      12,
      [
        { name: 'd1', lo: 0, hi: 4, step: 1 },
        { name: 'h1', lo: 0, hi: 23, step: 1 },
        { name: 'm1', lo: 0, hi: 59, step: 1 },
        { name: 's1', lo: 0, hi: 59, step: 1 },
        { name: 'h2', lo: 0, hi: 23, step: 1 },
        { name: 'm2', lo: 0, hi: 59, step: 1 },
        { name: 's2', lo: 0, hi: 59, step: 1 },
      ],
      [{ name: 'op', options: ['add', 'sub'] }],
      (v) => `${v.d1}d ${v.h1}h ${v.m1}m ${v.s1}s ${v.op} ${v.h2}h ${v.m2}m ${v.s2}s`,
    ),
    introOutputs: ['res'],
    relatedSlugs: ['hours-calculator', 'time-to-decimal-calculator', 'time-duration-calculator'],
    checks: [
      { inputs: {}, expect: { res: '1 d 8 h 6 min 20 s', hrs: '32.1056 hours', min: '1,926.33 minutes', sec: '115,580 seconds' } },
      {
        inputs: { op: 'sub', d1: 0, h1: 1, m1: 10, s1: 0, h2: 2, m2: 5, s2: 30 },
        expect: { res: '-55 min 30 s', hrs: '0.925 hours', min: '55.5 minutes', sec: '3,330 seconds' },
      },
      { inputs: { d1: 0, h1: 0, m1: 59, s1: 59, h2: 0, m2: 0, s2: 1 }, expect: { res: '1 h', hrs: '1 hour', min: '60 minutes', sec: '3,600 seconds' } },
    ],
  },
  {
    slug: 'time-to-decimal-calculator',
    category: 'everyday-life',
    tier: 2,
    subCluster: 'Time and work',
    title: 'Time to Decimal Calculator: Hours and Minutes to Decimal Hours',
    h1: 'Time to Decimal Calculator',
    metaDescription: 'Convert hours and minutes (7:45 or 7:45:30) to decimal hours, or decimal hours such as 7.75 back to hours, minutes and seconds.',
    about:
      'Wall clocks count in sixties but wage formulas count in tenths, so 7 hours 45 minutes has to become 7.75 before it can be multiplied by a rate. This converter works both ways: key in a time as hours and minutes, optionally with seconds, to see the decimal, or key in a decimal to see the clock form back. Because a minute is one sixtieth of an hour, 30 minutes is half, not 0.30. The answer arrives with up to six decimals and with the total expressed in minutes.',
    inputs: [
      sel('mode', 'Convert', 'hm', [
        ['hm', 'Hours:minutes to decimal hours'],
        ['dec', 'Decimal hours to hours:minutes:seconds'],
      ]),
      {
        name: 'x',
        label: 'Value (e.g. 7:45 or 7.75)',
        type: 'text' as const,
        default: '7:45',
        validator: z
          .string()
          .refine((v) => /^\s*(\d+:\d{2}(:\d{2})?|\d+(\.\d+)?)\s*$/.test(v), 'Enter hours and minutes like 7:45, or decimal hours like 7.75'),
      },
    ],
    outputs: [out('res', 'Result', true), out('dec', 'Other form'), out('min', 'In minutes')],
    calculate: (i) => {
      const x = String(i.x).trim();
      if (String(i.mode) === 'dec') {
        if (x.includes(':')) return { res: 'Enter decimal hours such as 7.75', dec: '', min: '' };
        const v = toD(x);
        const total = Number(v.mul(3600).toFixed(0, D.ROUND_HALF_UP));
        return {
          res: `${Math.floor(total / 3600)}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`,
          dec: amt(v, 6, 'hour', 'hours'),
          min: amt(v.mul(60), 4, 'minute', 'minutes'),
        };
      }
      if (!x.includes(':')) return { res: 'Enter hours and minutes such as 7:45', dec: '', min: '' };
      const [h, m, s] = x.split(':');
      const v = toD(h)
        .plus(toD(m).div(60))
        .plus(toD(s ?? '0').div(3600));
      return { res: amt(v, 6, 'hour', 'hours'), dec: `${Number(h)}:${m}:${(s ?? '0').padStart(2, '0')}`, min: amt(v.mul(60), 4, 'minute', 'minutes') };
    },
    formulaDescription:
      'Decimal hours = hours + minutes ÷ 60 + seconds ÷ 3,600. Back: the whole part is the hours, the fractional part × 60 is the minutes, and what remains × 60 is the seconds. Results show up to six decimals.',
    formulaLatex: 'h_{dec} = h + \\dfrac{m}{60} + \\dfrac{s}{3600}',
    workedExample: '7:45 is 7 + 45 ÷ 60 = 7.75 hours, or 465 minutes. 12:20:30 is 12.341667 hours. In reverse 7.75 hours is 7:45:00 and 0.1 hours is 0:06:00.',
    faq: [
      { question: 'Why is 30 minutes 0.5 and not 0.30?', answer: 'Because an hour has 60 minutes, not 100, so 30 minutes is half an hour.' },
      { question: 'Where is this used?', answer: 'Payroll and billing, where rates are per hour and times are recorded in minutes.' },
      { question: 'Why six decimals?', answer: 'Minutes such as 20 give repeating decimals (0.333333…), so the page rounds to six places.' },
    ],
    scenarios: [
      ['hm', '7:45'],
      ['hm', '12:20:30'],
      ['dec', '7.75'],
      ['hm', '0:07'],
      ['dec', '3.2'],
      ['hm', '9:18'],
      ['dec', '0.1'],
      ['hm', '26:40'],
      ['dec', '10.4167'],
      ['hm', '4:59:59'],
      ['dec', '1.05'],
      ['hm', '8:22'],
    ]
      .map(([mode, x]) => ({ label: `${mode} ${x}`, inputs: { mode, x } }))
      .slice(0, 6),
    introOutputs: ['res'],
    relatedSlugs: ['time-calculator', 'hours-calculator', 'time-card-calculator'],
    checks: [
      { inputs: {}, expect: { res: '7.75 hours', dec: '7:45:00', min: '465 minutes' } },
      { inputs: { x: '12:20:30' }, expect: { res: '12.341667 hours', dec: '12:20:30', min: '740.5 minutes' } },
      { inputs: { mode: 'dec', x: '7.75' }, expect: { res: '7:45:00', dec: '7.75 hours', min: '465 minutes' } },
      { inputs: { mode: 'dec', x: '0.1' }, expect: { res: '0:06:00', dec: '0.1 hours', min: '6 minutes' } },
      { inputs: { x: '0:07' }, expect: { res: '0.116667 hours', dec: '0:07:00', min: '7 minutes' } },
    ],
  },
  {
    slug: 'time-card-calculator',
    category: 'everyday-life',
    tier: 3,
    subCluster: 'Time and work',
    title: 'Time Card Calculator: Weekly Hours, Overtime and Pay',
    h1: 'Time Card Calculator',
    metaDescription:
      'Total a week of daily hours entered as hours:minutes or decimals, split them into regular and overtime hours and calculate the gross pay with an overtime multiplier.',
    about:
      'Weekly pay for hourly staff comes from adding up the hours of each day, deciding which of them fall above the overtime line and paying those at a higher multiplier. List the hours for every day separated by commas, using either the 8:30 style or decimals like 8.5, then give the wage, the weekly threshold and the premium multiplier. The sheet returns the grand total, the regular and overtime portions and the earnings from each. Local labour law may define overtime by day or by week, so adjust to suit.',
    inputs: [
      {
        name: 'days',
        label: 'Daily hours (e.g. 8:30, 8, 7:45, 9, 8:15, 4, 0)',
        type: 'text' as const,
        default: '8:30, 8, 7:45, 9, 8:15, 4, 0',
        validator: z.string().refine(
          (v) =>
            v.split(/[\s,;]+/).filter(Boolean).length >= 1 &&
            v
              .split(/[\s,;]+/)
              .filter(Boolean)
              .every((t) => TOKEN.test(t)),
          'Enter hours like 8:30 or 8.5, separated by commas',
        ),
      },
      num('rate', 'Hourly rate ($)', 22, 0, 100000),
      num('thr', 'Overtime starts after (hours)', 40, 0, 1000),
      num('mult', 'Overtime multiplier', 1.5, 1, 5),
    ],
    outputs: [
      out('tot', 'Total hours', true),
      out('reg', 'Regular hours'),
      out('ot', 'Overtime hours'),
      out('pay', 'Gross pay'),
      out('otpay', 'Of which overtime pay'),
    ],
    calculate: (i) => {
      const tot = String(i.days)
        .split(/[\s,;]+/)
        .filter(Boolean)
        .reduce((a, t) => a.plus(tokenHours(t)), new D(0));
      const thr = toD(i.thr);
      const reg = D.min(tot, thr);
      const ot = D.max(new D(0), tot.minus(thr));
      const rate = toD(i.rate);
      return {
        tot: `${amt(tot, 2, 'hour', 'hours')} (${hm(roundMin(tot))})`,
        reg: amt(reg, 2, 'hour', 'hours'),
        ot: amt(ot, 2, 'hour', 'hours'),
        pay: fmtCurrency(reg.mul(rate).plus(ot.mul(rate).mul(toD(i.mult)))),
        otpay: fmtCurrency(ot.mul(rate).mul(toD(i.mult))),
      };
    },
    formulaDescription:
      'Total = Σ daily hours (hours:minutes converted to decimals). Regular = min(total, threshold); overtime = max(0, total − threshold). Pay = regular × rate + overtime × rate × multiplier. Weekly overtime only; daily overtime, shift premiums and rounding rules of some employers are not modelled.',
    formulaLatex: 'P = r\\,h_{reg} + m\\,r\\,h_{ot}',
    workedExample:
      'Days of 8:30, 8, 7:45, 9, 8:15, 4 and 0 total 45.5 hours (45 h 30 min): 40 regular and 5.5 overtime. At $22 an hour with time and a half the gross pay is $1,061.50, of which $181.50 is overtime.',
    faq: [
      { question: 'How do I enter 8 hours 30 minutes?', answer: 'As 8:30 or as 8.5; both mean the same.' },
      { question: 'Is the pay before tax?', answer: 'Yes, gross pay. Taxes and deductions are not applied.' },
      {
        question: 'What if overtime is daily, not weekly?',
        answer: 'Some places count overtime per day; this page uses a weekly total, so adapt the hours accordingly.',
      },
    ],
    scenarios: [
      ['8:30, 8, 7:45, 9, 8:15, 4, 0', 22, 40, 1.5],
      ['8, 8, 8, 8, 8', 18.5, 40, 1.5],
      ['10:30, 10, 9:45, 11, 10:15, 6', 25, 40, 2],
      ['7:20, 7:40, 6:55, 8:05, 7:30', 16.75, 40, 1.5],
      ['9.5, 9.5, 9.5, 9.5, 9.5, 3', 31.2, 40, 1.5],
      ['6, 6, 6, 5:30, 4', 14.4, 40, 1.5],
      ['11, 11, 11, 11, 12', 27.8, 40, 1.5],
      ['8:10, 8:20, 8:15, 8:05, 8:25, 5:30', 19.9, 38, 1.5],
      ['4, 5, 3:30, 6, 4:45', 12.25, 40, 1.5],
      ['9, 9, 9, 9, 9, 9', 21.6, 40, 2],
      ['7:45, 8:15, 8, 8, 7:30, 2', 33.4, 37.5, 1.25],
      ['10, 10, 10, 10, 8', 44.5, 40, 1.5],
    ]
      .map(([days, rate, thr, mult]) => ({ label: `${days} at ${rate}, overtime after ${thr}`, inputs: { days, rate, thr, mult } }))
      .slice(0, 6),
    introOutputs: ['tot', 'pay'],
    relatedSlugs: ['hours-calculator', 'salary-calculator', 'time-to-decimal-calculator'],
    checks: [
      { inputs: {}, expect: { tot: '45.5 hours (45 h 30 min)', reg: '40 hours', ot: '5.5 hours', pay: '$1,061.50', otpay: '$181.50' } },
      {
        inputs: { days: '8, 8, 8, 8, 8', rate: 18.5, thr: 40, mult: 1.5 },
        expect: { tot: '40 hours (40 h 0 min)', reg: '40 hours', ot: '0 hours', pay: '$740.00', otpay: '$0.00' },
      },
      {
        inputs: { days: '10:30, 10, 9:45, 11, 10:15, 6', rate: 25, thr: 40, mult: 2 },
        expect: { tot: '57.5 hours (57 h 30 min)', reg: '40 hours', ot: '17.5 hours', pay: '$1,875.00', otpay: '$875.00' },
      },
    ],
  },
  {
    slug: 'bra-size-calculator',
    category: 'everyday-life',
    tier: 3,
    subCluster: 'Sizing',
    title: 'Bra Size Calculator: Band and Cup From Your Measurements',
    h1: 'Bra Size Calculator',
    metaDescription: 'Estimate your bra band and cup size in US and UK sizing from your under-bust and bust measurements in inches, with the sister sizes.',
    about:
      'A bra size has two parts. The band number comes from the measurement around your ribcage just under the bust, and the cup letter from how much larger the measurement around the fullest part of the bust is. Measure both in inches while wearing a lightly padded bra, then enter them. The page rounds the under-bust to the nearest even number for the band, turns the difference into a cup letter in US and UK sizing and lists sister sizes. Sizes differ between brands, so use the result as a starting point for a fitting.',
    inputs: [num('ub', 'Under-bust measurement (inches)', 32.5, 20, 60), num('bust', 'Bust measurement (inches)', 35.5, 20, 70)],
    outputs: [out('us', 'US size', true), out('uk', 'UK size'), out('sis', 'Sister sizes (same cup volume)'), out('band', 'Band')],
    calculate: (i) => {
      const ub = toD(i.ub);
      const band = Number(ub.div(2).plus('0.5').floor().toFixed(0)) * 2;
      const diff = Number(toD(i.bust).minus(ub).plus('0.5').floor().toFixed(0));
      if (diff < 0 || diff > 7) return { us: 'The difference is outside the usual range; a professional fitting is recommended', uk: '', sis: '', band: '' };
      const up = Math.max(diff - 1, 0);
      const dn = Math.min(diff + 1, 7);
      return { us: `${band}${US_CUP[diff]}`, uk: `${band}${UK_CUP[diff]}`, sis: `${band + 2}${US_CUP[up]} or ${band - 2}${US_CUP[dn]}`, band: String(band) };
    },
    formulaDescription:
      'Band = under-bust rounded to the nearest even number. Cup = bust − under-bust, rounded: 0 AA, 1 A, 2 B, 3 C, 4 D, 5 DD, 6 DDD (UK E), 7 DDDD (UK F). Sister sizes go up a band and down a cup, or down a band and up a cup. A general guide only: brands and styles differ.',
    formulaLatex: '\\text{cup} = \\operatorname{round}(\\text{bust} - \\text{under-bust})',
    workedExample:
      'Under-bust 32.5 in rounds to a band of 32 (the nearest even number), and a bust of 35.5 in is a difference of 3 in, a C cup: size 32C in the US and UK, with sister sizes 34B and 30D.',
    faq: [
      {
        question: 'Why are the sizes only a starting point?',
        answer: 'Cup size depends on the band, brands cut differently, and shape and stretch vary, so a fitting is the best test.',
      },
      {
        question: 'What are sister sizes?',
        answer: 'Sizes with the same cup volume on a different band: going up a band needs a smaller cup letter and vice versa.',
      },
      { question: 'Where do I measure?', answer: 'Snug under the bust for the band, and around the fullest part of the bust, with the tape level.' },
    ],
    scenarios: varied(
      'bra-size-calculator',
      12,
      [
        { name: 'ub', lo: 26, hi: 42, step: 0.5 },
        { name: 'bust', lo: 28, hi: 48, step: 0.5 },
      ],
      [],
      (v) => `under-bust ${v.ub} in, bust ${v.bust} in`,
    ),
    introOutputs: ['us'],
    relatedSlugs: ['bmi-calculator', 'tire-size-calculator', 'unit-price-calculator'],
    checks: [
      { inputs: {}, expect: { us: '32C', uk: '32C', sis: '34B or 30D', band: '32' } },
      { inputs: { ub: 28, bust: 31 }, expect: { us: '28C', uk: '28C', sis: '30B or 26D', band: '28' } },
      { inputs: { ub: 36, bust: 43 }, expect: { us: '36DDDD', uk: '36F', sis: '38DDD or 34DDDD', band: '36' } },
      { inputs: { ub: 30, bust: 38.5 }, expect: { us: 'The difference is outside the usual range; a professional fitting is recommended', uk: '', sis: '' } },
      { inputs: { ub: 34.4, bust: 34 }, expect: { us: '34AA', uk: '34AA', sis: '36AA or 32A', band: '34' } },
    ],
  },
  {
    slug: 'tire-size-calculator',
    category: 'everyday-life',
    tier: 2,
    subCluster: 'Vehicles',
    title: 'Tire Size Calculator: Diameter, Sidewall and Speedometer Error',
    h1: 'Tire Size Calculator',
    metaDescription:
      'Compare two tyre sizes such as 205/55R16 and 225/45R17: overall diameter, sidewall height, the percentage difference and the true speed when your speedometer reads 100 km/h or 60 mph.',
    about:
      'A tyre size like 205/55R16 packs three numbers: the width in millimetres, the sidewall height as a percentage of that width and the wheel diameter in inches. From them you can work out the overall diameter, which decides how far the car travels per wheel turn and whether the speedometer is accurate. Enter your current size and a replacement. The page gives the diameter and sidewall of each, the percentage difference, the true speed for a speedometer reading of 100 km/h or 60 mph, and the revolutions per kilometre of the new tyre.',
    inputs: [tireText('a', 'Current tyre size', '205/55R16'), tireText('b', 'New tyre size', '225/45R17')],
    outputs: [
      out('diff', 'Overall diameter difference', true),
      out('da', 'Current tyre'),
      out('db', 'New tyre'),
      out('true', 'True speed when the speedometer reads 100 km/h'),
      out('trueMph', 'True speed when it reads 60 mph'),
      out('revs', 'Revolutions of the new tyre'),
    ],
    calculate: (i) => {
      const a = tire(String(i.a));
      const b = tire(String(i.b));
      const da = tireDiameter(a);
      const db = tireDiameter(b);
      const diff = db.div(da).minus(1).mul(100);
      const fmt = (t: { w: number; a: number; r: number }, dd: Dec): string =>
        `${fmtNumber(dd, 1)} mm (${fmtNumber(dd.div('25.4'), 2)} in), sidewall ${fmtNumber(new D(t.w).mul(t.a).div(100), 1)} mm`;
      return {
        da: fmt(a, da),
        db: fmt(b, db),
        diff: `${diff.gte(0) ? '+' : ''}${fmtNumber(diff, 2)}%`,
        true: `${fmtNumber(new D(100).mul(db).div(da), 1)} km/h`,
        trueMph: `${fmtNumber(new D(60).mul(db).div(da), 1)} mph`,
        revs: `${fmtNumber(new D(1000000).div(db.mul(PI)), 1)} per km`,
      };
    },
    formulaDescription:
      'Sidewall = width × aspect ratio ÷ 100 (mm). Diameter = rim size × 25.4 + 2 × sidewall (mm). Circumference = π × diameter. True speed = indicated speed × new diameter ÷ old diameter (speedometers read from the original size). Tyre load and speed ratings must also match the vehicle.',
    formulaLatex: 'D = 25.4\\,r + 2\\,\\dfrac{w\\,a}{100}',
    workedExample:
      '205/55R16 has an overall diameter of 631.9 mm (24.88 in) with a 112.8 mm sidewall; 225/45R17 is 634.3 mm, 0.38% larger, so when the speedometer reads 100 km/h the true speed is 100.4 km/h. The new tyre turns 501.8 times per kilometre.',
    faq: [
      {
        question: 'How much difference is acceptable?',
        answer: 'Vehicle makers often suggest staying within about 3 percent of the original diameter; check your handbook.',
      },
      {
        question: 'Why does a bigger tyre make the speedometer read low?',
        answer: 'It covers more ground per turn, but the speedometer counts turns as before, so the true speed is higher than shown.',
      },
      { question: 'Is size the only thing to check?', answer: "No: load index, speed rating, clearance and what your car's documents allow all matter." },
    ],
    scenarios: [
      ['205/55R16', '225/45R17'],
      ['195/65R15', '215/60R16'],
      ['225/45R17', '205/55R16'],
      ['215/65R16', '235/60R17'],
      ['175/70R14', '185/65R15'],
      ['245/40R18', '225/45R18'],
      ['265/70R17', '285/70R17'],
      ['205/60R16', '215/55R17'],
      ['185/60R15', '195/55R16'],
      ['225/55R17', '245/45R19'],
      ['155/80R13', '165/70R14'],
      ['235/65R17', '255/55R18'],
    ].map(([a, b]) => ({ label: `${a} to ${b}`, inputs: { a, b } })),
    introOutputs: ['diff', 'true'],
    relatedSlugs: ['speed-distance-time-calculator', 'trip-fuel-cost-calculator', 'unit-price-calculator'],
    checks: [
      {
        inputs: {},
        expect: {
          da: '631.9 mm (24.88 in), sidewall 112.8 mm',
          db: '634.3 mm (24.97 in), sidewall 101.3 mm',
          diff: '+0.38%',
          true: '100.4 km/h',
          trueMph: '60.2 mph',
          revs: '501.8 per km',
        },
      },
      {
        inputs: { a: '195/65R15', b: '215/60R16' },
        expect: {
          da: '634.5 mm (24.98 in), sidewall 126.8 mm',
          db: '664.4 mm (26.16 in), sidewall 129 mm',
          diff: '+4.71%',
          true: '104.7 km/h',
          trueMph: '62.8 mph',
          revs: '479.1 per km',
        },
      },
      {
        inputs: { a: '225/45R17', b: '205/55R16' },
        expect: {
          da: '634.3 mm (24.97 in), sidewall 101.3 mm',
          db: '631.9 mm (24.88 in), sidewall 112.8 mm',
          diff: '-0.38%',
          true: '99.6 km/h',
          trueMph: '59.8 mph',
          revs: '503.7 per km',
        },
      },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
