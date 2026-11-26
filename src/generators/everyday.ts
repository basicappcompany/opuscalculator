import { dateField, numberField, selectField } from '../lib/calc-utils';
import { addDaysIso, daysBetween, longDate, parseIso, weekdaysBetween } from '../lib/dates';
import { D, toD } from '../lib/decimal';
import { fmtCurrency, fmtNumber, fmtPercent } from '../lib/format';
import { defineCalculator, mixed, type Spec } from '../lib/spec';
import type { CalculatorConfig } from '../lib/types';

/**
 * Prompt 5, everyday.ts (item 5.7): dates and time, money and tips, randomizers. Thirteen calculators.
 * The randomizers are deterministic: a plain multiply-and-shift linear congruential generator seeded from an input,
 * so calculate() stays pure (the same seed always gives the same numbers, which the page says). They are for games
 * and picking, NOT for security or lotteries. Dates use fixed defaults so the pre-rendered result never goes stale.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const dateInput = (name: string, label: string, def: string) => ({ name, label, type: 'date' as const, default: def, validator: dateField() });
const pos = (name: string, label: string, def: number, max = 1e9) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min: 0.000001,
  max,
  validator: numberField({ min: 0.000001, max }),
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
const weekdayOf = (iso: string): number => {
  const { y, m, d } = parseIso(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** ISO 8601 week: weeks start on Monday and week 1 contains the first Thursday of the year. */
function isoWeek(iso: string): { isoYear: number; week: number } {
  const { y, m, d } = parseIso(iso);
  const t = Date.UTC(y, m - 1, d);
  const dow = ((new Date(t).getUTCDay() + 6) % 7) + 1;
  const thursday = new Date(t + (4 - dow) * 86400000);
  const isoYear = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / 86400000 / 7) + 1;
  return { isoYear, week };
}

const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const ordinal = (n: number): string => ['', '1st', '2nd', '3rd', '4th', '5th'][n] ?? `${n}th`;

/** Multiply-and-shift LCG on 32 bits: x' = 1664525 x + 1013904223. Values in [lo, hi] come from the top bits. */
function* stream(seed: number): Generator<bigint> {
  let x = BigInt(Math.trunc(seed)) & 0xffffffffn;
  for (;;) {
    x = (x * 1664525n + 1013904223n) & 0xffffffffn;
    yield x;
  }
}
const SEED = (def: number) => whole('seed', 'Seed (any whole number)', def, 0, 4294967295);
const RANDOM_NOTE =
  'The numbers come from a fixed formula started from your seed, so the same seed always gives the same result, which makes it repeatable but not suitable for lotteries, passwords or anything security-related.';

export const SPECS: Spec[] = [
  {
    slug: 'add-days-to-date-calculator',
    category: 'everyday-life',
    tier: 2,
    subCluster: 'Dates and time',
    title: 'Add or Subtract Days from a Date Calculator',
    h1: 'Add or Subtract Days from a Date',
    metaDescription: 'Find the date that is a number of days after or before a starting date, with the weekday and the length in weeks.',
    about:
      'Counting forward or back from a date by hand means juggling months of different lengths and leap years. Enter a starting date and a number of days, choose whether to add or subtract, and this calculator returns the exact calendar date and the weekday it falls on, plus the span expressed in weeks and days. It is handy for deadlines, notice periods, warranty ends, delivery estimates and due dates. Days are counted as calendar days, including weekends and holidays.',
    inputs: [
      dateInput('start', 'Starting date', '2026-11-22'),
      whole('days', 'Number of days', 90, 0, 100000),
      {
        name: 'mode',
        label: 'Direction',
        type: 'select',
        default: 'add',
        unitOptions: [
          { value: 'add', label: 'Add days' },
          { value: 'sub', label: 'Subtract days' },
        ],
        validator: selectField(['add', 'sub']),
      },
    ],
    outputs: [
      { name: 'date', label: 'Resulting date', format: 'text', highlight: true },
      { name: 'span', label: 'That is', format: 'text' },
    ],
    calculate: (i) => {
      const n = toD(i.days).toNumber();
      const end = addDaysIso(String(i.start), String(i.mode) === 'sub' ? -n : n);
      return { date: longDate(end), span: `${Math.floor(n / 7)} weeks ${n % 7} days` };
    },
    formulaDescription: 'Result = start date ± n calendar days, counted on the Gregorian calendar with leap years. Weeks = whole multiples of 7 days.',
    workedExample: '90 days after 22 November 2026 is Saturday, 20 February 2027, which is 12 weeks and 6 days later.',
    faq: [
      { question: 'Does it skip weekends or holidays?', answer: 'No. It counts every calendar day. Use the business days calculator to skip weekends.' },
      { question: 'How are leap years handled?', answer: 'The calculation uses the real calendar, so 29 February is included in leap years.' },
      { question: 'Can I subtract days?', answer: 'Yes, choose Subtract days to count backwards.' },
    ],
    scenarios: mixed(
      'add-days-to-date-calculator',
      12,
      (r) => ({ days: Math.round(r(1, 900)) }),
      (v) => `${v.days} days after 22 Nov 2026`,
    ),
    introOutputs: ['span'],
    relatedSlugs: ['date-difference-calculator', 'business-days-calculator'],
    checks: [
      { inputs: {}, expect: { date: 'Saturday, 20 Feb 2027', span: '12 weeks 6 days' } },
      { inputs: { days: 30, mode: 'sub' }, expect: { date: 'Friday, 23 Oct 2026' } },
      { inputs: { days: 365 }, expect: { date: 'Monday, 22 Nov 2027', span: '52 weeks 1 days' } },
    ],
  },
  {
    slug: 'business-days-calculator',
    category: 'everyday-life',
    tier: 2,
    subCluster: 'Dates and time',
    title: 'Business Days Calculator: Working Days Between Two Dates',
    h1: 'Business Days Calculator',
    metaDescription:
      'Count the weekdays, weekend days and calendar days between two dates, with an option to include the end date. Public holidays are not removed.',
    about:
      'Contracts, shipping estimates and project plans often count working days rather than calendar days. This calculator counts the Monday-to-Friday days between two dates and separates them from weekend days. Choose whether the end date itself counts. Public holidays differ by country and region and are not removed, so subtract any that apply to you. Use it to estimate delivery times, notice periods, invoice terms or how many days of work are left before a deadline.',
    inputs: [
      dateInput('start', 'Start date', '2026-11-02'),
      dateInput('end', 'End date', '2026-11-23'),
      {
        name: 'include',
        label: 'Count the end date too?',
        type: 'select',
        default: 'no',
        unitOptions: [
          { value: 'no', label: 'No (end date not counted)' },
          { value: 'yes', label: 'Yes (include it)' },
        ],
        validator: selectField(['no', 'yes']),
      },
    ],
    outputs: [
      { name: 'weekdays', label: 'Business days', format: 'text', highlight: true },
      { name: 'weekend', label: 'Weekend days', format: 'text' },
      { name: 'total', label: 'Calendar days', format: 'text' },
    ],
    calculate: (i) => {
      const end = String(i.include) === 'yes' ? addDaysIso(String(i.end), 1) : String(i.end);
      const total = Math.max(0, daysBetween(String(i.start), end));
      const weekdays = weekdaysBetween(String(i.start), end);
      return { weekdays: String(weekdays), weekend: String(total - weekdays), total: String(total) };
    },
    formulaDescription:
      'Business days = Monday to Friday days in the half-open range [start, end), or [start, end] if the end date is included. Weekend days = calendar days − business days. Holidays are not removed.',
    workedExample: 'From Monday 2 November 2026 up to but not including Monday 23 November: 21 calendar days, of which 15 are weekdays and 6 are weekend days.',
    faq: [
      { question: 'Are public holidays excluded?', answer: 'No. Holidays vary by country, so subtract them yourself from the result.' },
      {
        question: 'Why does the end date option matter?',
        answer: 'Some contracts count both the first and last day, others only one; choose what your agreement says.',
      },
      { question: 'What if the end is before the start?', answer: 'The result is zero.' },
    ],
    scenarios: mixed(
      'business-days-calculator',
      12,
      (r) => ({ s: Math.round(r(0, 300)), e: Math.round(r(10, 120)) }),
      (v) => `${v.s} days after 1 Jan 2026, lasting ${v.e} days`,
    ).map((sc) => ({
      label: sc.label,
      inputs: { start: addDaysIso('2026-01-01', Number(sc.inputs.s)), end: addDaysIso('2026-01-01', Number(sc.inputs.s) + Number(sc.inputs.e)) },
    })),
    introOutputs: ['weekdays', 'weekend'],
    relatedSlugs: ['date-difference-calculator', 'add-days-to-date-calculator'],
    checks: [
      { inputs: {}, expect: { weekdays: '15', weekend: '6', total: '21' } },
      { inputs: { include: 'yes' }, expect: { weekdays: '16', total: '22' } },
      { inputs: { end: '2026-11-02' }, expect: { weekdays: '0', total: '0' } },
    ],
  },
  {
    slug: 'week-number-calculator',
    category: 'everyday-life',
    tier: 3,
    subCluster: 'Dates and time',
    title: 'Week Number Calculator: ISO Week of the Year',
    h1: 'Week Number Calculator',
    metaDescription: 'Find the ISO 8601 week number, the weekday and the day of the year for any date.',
    about:
      'Many businesses, schools and shipping schedules refer to week numbers. The ISO 8601 standard defines them: weeks start on Monday, and week 1 is the week that contains the first Thursday of the year, which means the first days of January can belong to the last week of the previous year and the last days of December to week 1 of the next. Enter a date to see its ISO week and year, its weekday number and its day of the year, from 1 to 365 or 366.',
    inputs: [dateInput('date', 'Date', '2026-11-22')],
    outputs: [
      { name: 'week', label: 'ISO week', format: 'text', highlight: true },
      { name: 'doy', label: 'Day of the year', format: 'text' },
      { name: 'weekday', label: 'Weekday', format: 'text' },
    ],
    calculate: (i) => {
      const iso = String(i.date);
      const { isoYear, week } = isoWeek(iso);
      const { y } = parseIso(iso);
      return { week: `Week ${week} of ${isoYear}`, doy: `Day ${daysBetween(`${y}-01-01`, iso) + 1}`, weekday: WEEKDAYS[weekdayOf(iso)] };
    },
    formulaDescription:
      "ISO week: find the Thursday of the date's week (weeks run Monday to Sunday); its year is the ISO year, and the week number is the number of whole weeks from 1 January of that year, plus one.",
    workedExample: '22 November 2026 is a Sunday in ISO week 47 of 2026 and day 326 of the year. 3 January 2027 still belongs to week 53 of 2026.',
    faq: [
      {
        question: 'Why can 1 January be in week 52 or 53?',
        answer: 'ISO weeks belong to the year that holds their Thursday, so a week straddling the new year may count for the old one.',
      },
      {
        question: 'Is this the same as the US week number?',
        answer: 'Not always. The US often starts weeks on Sunday and numbers week 1 as the one containing 1 January.',
      },
      { question: 'How many ISO weeks are there in a year?', answer: '52 or 53, depending on the year.' },
    ],
    scenarios: mixed(
      'week-number-calculator',
      12,
      (r) => ({ d: Math.round(r(0, 2400)) }),
      (v) => `${v.d} days after 1 Jan 2024`,
    ).map((sc) => ({ label: sc.label, inputs: { date: addDaysIso('2024-01-01', Number(sc.inputs.d)) } })),
    introOutputs: ['week', 'doy'],
    relatedSlugs: ['day-of-week-calculator', 'date-difference-calculator'],
    checks: [
      { inputs: {}, expect: { week: 'Week 47 of 2026', doy: 'Day 326', weekday: 'Sunday' } },
      { inputs: { date: '2027-01-03' }, expect: { week: 'Week 53 of 2026', doy: 'Day 3' } },
      { inputs: { date: '2024-02-29' }, expect: { week: 'Week 9 of 2024', doy: 'Day 60', weekday: 'Thursday' } },
    ],
  },
  {
    slug: 'day-of-week-calculator',
    category: 'everyday-life',
    tier: 3,
    subCluster: 'Dates and time',
    title: 'Day of the Week Calculator: What Weekday Is a Date?',
    h1: 'Day of the Week Calculator',
    metaDescription: 'Find out which day of the week any date falls on, and whether it is the first, second, third, fourth or fifth such weekday of its month.',
    about:
      'Which weekday was your birthday, or will a future date fall on a weekend? Enter any date in the Gregorian calendar and this calculator returns its weekday, whether that is a weekend, and its position in the month, such as the fourth Sunday of November. The position is useful for holidays defined that way, like the fourth Thursday of November. Dates before the Gregorian calendar was adopted in your country are extended backwards using the same rules.',
    inputs: [dateInput('date', 'Date', '2026-11-22')],
    outputs: [
      { name: 'weekday', label: 'Day of the week', format: 'text', highlight: true },
      { name: 'nth', label: 'Position in the month', format: 'text' },
      { name: 'weekend', label: 'Weekend?', format: 'text' },
    ],
    calculate: (i) => {
      const iso = String(i.date);
      const { m, d } = parseIso(iso);
      const w = weekdayOf(iso);
      return { weekday: WEEKDAYS[w], nth: `${ordinal(Math.ceil(d / 7))} ${WEEKDAYS[w]} of ${MONTHS[m - 1]}`, weekend: w === 0 || w === 6 ? 'Yes' : 'No' };
    },
    formulaDescription:
      'The weekday follows from counting days from a known reference date, modulo 7. The position in the month is the date divided by 7, rounded up.',
    workedExample: '22 November 2026 is a Sunday, the 4th Sunday of November, and a weekend day.',
    faq: [
      {
        question: 'Does it work for old dates?',
        answer: 'Yes, using the proleptic Gregorian calendar, though historical dates may use the older Julian calendar.',
      },
      { question: 'What is the position in the month for?', answer: 'Rules like "the second Monday of May" use it to find exact dates.' },
      { question: 'Is the weekend Saturday and Sunday?', answer: 'Here yes. Some countries use different weekend days.' },
    ],
    scenarios: mixed(
      'day-of-week-calculator',
      12,
      (r) => ({ d: Math.round(r(0, 9000)) }),
      (v) => `${v.d} days after 1 Jan 2000`,
    ).map((sc) => ({ label: sc.label, inputs: { date: addDaysIso('2000-01-01', Number(sc.inputs.d)) } })),
    introOutputs: ['nth'],
    relatedSlugs: ['week-number-calculator', 'age-calculator'],
    checks: [
      { inputs: {}, expect: { weekday: 'Sunday', nth: '4th Sunday of November', weekend: 'Yes' } },
      { inputs: { date: '2026-01-01' }, expect: { weekday: 'Thursday', nth: '1st Thursday of January', weekend: 'No' } },
      { inputs: { date: '2026-12-31' }, expect: { nth: '5th Thursday of December' } },
    ],
  },
  {
    slug: 'time-duration-calculator',
    category: 'everyday-life',
    tier: 2,
    subCluster: 'Dates and time',
    title: 'Time Duration Calculator: Hours Between Two Times',
    h1: 'Time Duration Calculator',
    metaDescription:
      'Work out the hours and minutes between a start time and an end time, including shifts that cross midnight, and the decimal hours for pay.',
    about:
      'Timesheets, shift work and travel plans need the length of time between a start and an end. Enter the two clock times in 24-hour form and this calculator returns the duration in hours and minutes and as decimal hours, which is what payroll usually needs. If the end time is earlier than the start it assumes the period crosses midnight, so 22:00 to 06:00 is eight hours. Subtract any unpaid break from the result yourself. Nurses, drivers, shop staff and anyone on rotating shifts use this to check a rota against a pay slip.',
    inputs: [
      whole('sh', 'Start hour (0-23)', 9, 0, 23),
      whole('sm', 'Start minute (0-59)', 30, 0, 59),
      whole('eh', 'End hour (0-23)', 17, 0, 23),
      whole('em', 'End minute (0-59)', 45, 0, 59),
    ],
    outputs: [
      { name: 'duration', label: 'Duration', format: 'text', highlight: true },
      { name: 'decimal', label: 'Decimal hours', format: 'text' },
    ],
    calculate: (i) => {
      const start = toD(i.sh).toNumber() * 60 + toD(i.sm).toNumber();
      const end = toD(i.eh).toNumber() * 60 + toD(i.em).toNumber();
      const minutes = end >= start ? end - start : end + 1440 - start;
      return { duration: `${Math.floor(minutes / 60)} h ${minutes % 60} min`, decimal: `${fmtNumber(new D(minutes).div(60), 2)} hours` };
    },
    formulaDescription:
      'Minutes = (end hour × 60 + end minute) − (start hour × 60 + start minute), adding 1,440 minutes if the result is negative (the period crosses midnight). Decimal hours = minutes ÷ 60.',
    workedExample: '09:30 to 17:45 is 8 h 15 min, which is 8.25 decimal hours. 22:00 to 06:00 is 8 h.',
    faq: [
      { question: 'What if start and end are the same?', answer: 'The duration is zero. For a full 24 hours use a date calculator.' },
      { question: 'How do I subtract a break?', answer: 'Subtract the break minutes from the result, or convert it to decimal hours first.' },
      { question: 'Why decimal hours?', answer: 'Pay is usually rate per hour, and 8.25 hours is easier to multiply than 8 h 15 min.' },
    ],
    scenarios: mixed(
      'time-duration-calculator',
      16,
      (r) => ({ from: Math.round(r(0, 1439)), length: Math.round(r(15, 900)) }),
      (v) => `begins ${v.from} minutes after midnight and runs ${v.length} minutes`,
    ).map((sc) => {
      const a = Number(sc.inputs.from);
      const b = (a + Number(sc.inputs.length)) % 1440;
      return { label: sc.label, inputs: { sh: Math.floor(a / 60), sm: a % 60, eh: Math.floor(b / 60), em: b % 60 } };
    }),
    introOutputs: ['duration'],
    relatedSlugs: ['hourly-to-salary-calculator', 'date-difference-calculator'],
    checks: [
      { inputs: {}, expect: { duration: '8 h 15 min', decimal: '8.25 hours' } },
      { inputs: { sh: 22, sm: 0, eh: 6, em: 0 }, expect: { duration: '8 h 0 min', decimal: '8 hours' } },
      { inputs: { sh: 8, sm: 0, eh: 8, em: 0 }, expect: { duration: '0 h 0 min' } },
    ],
  },
  {
    slug: 'leap-year-calculator',
    category: 'everyday-life',
    tier: 3,
    subCluster: 'Dates and time',
    title: 'Leap Year Calculator: Is It a Leap Year?',
    h1: 'Leap Year Calculator',
    metaDescription: 'Check whether a year is a leap year, how many days it has, and the previous and next leap years.',
    about:
      "A leap year adds a 29th of February to keep the calendar aligned with the Earth's orbit, which takes about 365.2422 days. The Gregorian rule is that a year is a leap year if it is divisible by 4, except for century years, which must be divisible by 400. So 2000 was a leap year and 1900 was not. Enter a year to see whether it qualifies, how many days it has and the nearest leap years either side of it.",
    inputs: [whole('year', 'Year', 2026, 1, 9999)],
    outputs: [
      { name: 'leap', label: 'Leap year?', format: 'text', highlight: true },
      { name: 'days', label: 'Days in the year', format: 'text' },
      { name: 'next', label: 'Next leap year', format: 'text' },
      { name: 'prev', label: 'Previous leap year', format: 'text' },
    ],
    calculate: (i) => {
      const y = toD(i.year).toNumber();
      let next = y + 1;
      while (!isLeapYear(next)) next++;
      let prev = y - 1;
      while (prev > 0 && !isLeapYear(prev)) prev--;
      return {
        leap: isLeapYear(y) ? `Yes, ${y} is a leap year` : `No, ${y} is not a leap year`,
        days: isLeapYear(y) ? '366' : '365',
        next: String(next),
        prev: prev > 0 ? String(prev) : 'None',
      };
    },
    formulaDescription: 'Leap if (year mod 4 = 0 and year mod 100 ≠ 0) or year mod 400 = 0.',
    workedExample: '2024 is divisible by 4 and not by 100, so it is a leap year of 366 days. 1900 is divisible by 100 but not 400, so it is not.',
    faq: [
      {
        question: 'Why is 1900 not a leap year but 2000 is?',
        answer: 'Century years are leap years only if divisible by 400, which corrects the small excess of adding a day every four years.',
      },
      { question: 'When was the calendar introduced?', answer: 'The Gregorian calendar began in 1582, and countries adopted it at different times.' },
      {
        question: 'What if I was born on 29 February?',
        answer: 'You have a birthday every four years; many places treat 28 February or 1 March as the legal date in other years.',
      },
    ],
    scenarios: [1896, 1900, 1999, 2000, 2020, 2023, 2024, 2100, 2400, 2026, 2096, 2200].map((y) => ({ label: `Year ${y}`, inputs: { year: y } })),
    relatedSlugs: ['age-calculator', 'day-of-week-calculator'],
    checks: [
      { inputs: { year: 2024 }, expect: { leap: 'Yes, 2024 is a leap year', days: '366', next: '2028', prev: '2020' } },
      { inputs: { year: 1900 }, expect: { leap: 'No, 1900 is not a leap year', next: '1904', prev: '1896' } },
      { inputs: {}, expect: { leap: 'No, 2026 is not a leap year', next: '2028', prev: '2024' } },
    ],
  },
  {
    slug: 'split-bill-calculator',
    category: 'everyday-life',
    tier: 2,
    subCluster: 'Money and tips',
    title: 'Split the Bill Calculator: Tip and Share per Person',
    h1: 'Split the Bill Calculator',
    metaDescription: 'Add a tip to a restaurant bill and split the total evenly between a number of people.',
    about:
      'Dividing a restaurant bill fairly means adding the tip first and then sharing the total. Enter the bill before tip, the tip percentage and how many people are paying, and this calculator returns the tip, the total and what each person owes. It assumes an even split; if people ordered very different amounts, calculate each share separately. Customs on tipping vary widely by country and venue, so the default percentage is only an example.',
    inputs: [
      pos('bill', 'Bill before tip ($)', 120, 1e7),
      { name: 'tip', label: 'Tip (%)', type: 'number', default: 18, min: 0, max: 100, validator: numberField({ min: 0, max: 100 }) },
      whole('people', 'Number of people', 4, 1, 1000),
    ],
    outputs: [
      { name: 'each', label: 'Each person pays', format: 'text', highlight: true },
      { name: 'tip', label: 'Tip', format: 'text' },
      { name: 'total', label: 'Total with tip', format: 'text' },
    ],
    calculate: (i) => {
      const bill = toD(i.bill);
      const tip = bill.mul(toD(i.tip)).div(100);
      const total = bill.plus(tip);
      return { each: fmtCurrency(total.div(toD(i.people))), tip: fmtCurrency(tip), total: fmtCurrency(total) };
    },
    formulaDescription: 'Tip = bill × tip% ÷ 100. Total = bill + tip. Each person = total ÷ number of people.',
    workedExample: 'A $120 bill with an 18% tip is $21.60 of tip and $141.60 in total; split four ways that is $35.40 each.',
    faq: [
      { question: 'Does the tip apply before or after tax?', answer: 'Customs differ. Enter the amount you want the percentage applied to.' },
      { question: 'What if the split is uneven?', answer: "Run each person's own order through the calculator with a people count of 1." },
      { question: 'How is rounding handled?', answer: 'Each result is rounded to the cent; shares may differ from the total by a cent.' },
    ],
    scenarios: mixed(
      'split-bill-calculator',
      12,
      (r) => ({ bill: r(15, 900), tip: Math.round(r(5, 30)), people: Math.round(r(1, 12)) }),
      (v) => `$${v.bill} with ${v.tip}% tip for ${v.people}`,
    ),
    introOutputs: ['each'],
    relatedSlugs: ['tip-calculator', 'tip-percentage-calculator'],
    checks: [
      { inputs: {}, expect: { each: '$35.40', tip: '$21.60', total: '$141.60' } },
      { inputs: { bill: 85.5, tip: 20, people: 3 }, expect: { each: '$34.20', tip: '$17.10', total: '$102.60' } },
      { inputs: { tip: 0, people: 1 }, expect: { each: '$120.00' } },
    ],
  },
  {
    slug: 'sales-tax-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Money and tips',
    title: 'Sales Tax Calculator: Tax Amount and Total Price',
    h1: 'Sales Tax Calculator',
    metaDescription: 'Calculate the sales tax on a purchase and the total price from the pre-tax price and the local tax rate.',
    about:
      'In many places a sales tax is added at the register to the sticker price. Multiply the pre-tax price by the tax rate to get the tax, then add it to get the total you will pay. The rate depends on the state, city and type of goods, so look up the current rate for your location; the default here is only an example. Some items such as groceries or clothing are taxed at a lower rate or not at all, and if you know the final price, the reverse VAT calculator can find the pre-tax price.',
    inputs: [
      pos('price', 'Price before tax ($)', 59.99, 1e9),
      { name: 'rate', label: 'Sales tax rate (%)', type: 'number', default: 8.25, min: 0, max: 100, validator: numberField({ min: 0, max: 100 }) },
    ],
    outputs: [
      { name: 'total', label: 'Total price', format: 'text', highlight: true },
      { name: 'tax', label: 'Sales tax', format: 'text' },
    ],
    calculate: (i) => {
      const price = toD(i.price);
      const tax = price.mul(toD(i.rate)).div(100);
      return { total: fmtCurrency(price.plus(tax)), tax: fmtCurrency(tax) };
    },
    formulaDescription: 'Tax = price × rate ÷ 100. Total = price + tax.',
    workedExample: 'A $59.99 item at 8.25% tax: tax = $4.95, total = $64.94.',
    faq: [
      { question: 'How do I find my rate?', answer: 'Check your state or local tax authority; combined state and local rates are often listed online.' },
      { question: 'Is tax charged on shipping?', answer: 'Rules differ by place and by whether shipping is itemised.' },
      { question: 'Why round to the cent?', answer: 'Totals are charged in whole cents, so the tax is rounded to the nearest cent.' },
    ],
    scenarios: mixed(
      'sales-tax-calculator',
      12,
      (r) => ({ price: r(1, 4000), rate: r(2, 11) }),
      (v) => `$${v.price} at ${v.rate}%`,
    ),
    introOutputs: ['tax'],
    relatedSlugs: ['vat-calculator', 'reverse-vat-calculator', 'discount-calculator'],
    checks: [
      { inputs: {}, expect: { total: '$64.94', tax: '$4.95' } },
      { inputs: { price: 100, rate: 7 }, expect: { total: '$107.00', tax: '$7.00' } },
      { inputs: { price: 19.99, rate: 0 }, expect: { total: '$19.99' } },
    ],
  },
  {
    slug: 'tip-percentage-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Money and tips',
    title: 'Tip Percentage Calculator: What Percent Did I Tip?',
    h1: 'Tip Percentage Calculator',
    metaDescription: 'Work out what percentage tip you left from the bill and the total you paid.',
    about:
      'Sometimes you hand over a round amount and wonder how generous the tip really was. Enter the bill before tip and the total you paid, and this calculator returns the tip in money and as a percentage of the bill. It is the reverse of the usual tip calculator, which starts from a percentage. If you paid less than the bill, it says so rather than showing a negative tip. Customary tip sizes depend on the country and the kind of service.',
    inputs: [
      pos('bill', 'Bill before tip ($)', 85, 1e7),
      { name: 'paid', label: 'Total paid ($)', type: 'number', default: 100, min: 0, max: 1e7, validator: numberField({ min: 0, max: 1e7 }) },
    ],
    outputs: [
      { name: 'pct', label: 'Tip as a percentage', format: 'text', highlight: true },
      { name: 'tip', label: 'Tip amount', format: 'text' },
    ],
    calculate: (i) => {
      const bill = toD(i.bill);
      const tip = toD(i.paid).minus(bill);
      if (tip.isNeg()) return { pct: 'You paid less than the bill', tip: '-' };
      return { pct: fmtPercent(tip.div(bill).mul(100), 2), tip: fmtCurrency(tip) };
    },
    formulaDescription: 'Tip = total paid − bill. Tip % = tip ÷ bill × 100.',
    workedExample: 'A $85 bill paid with $100: tip $15.00, which is 17.65% of the bill.',
    faq: [
      {
        question: 'What is a typical tip?',
        answer: 'It varies by country and service; many places expect between 10% and 20% for table service, and some none at all.',
      },
      {
        question: 'Is the percentage on the bill with or without tax?',
        answer: 'This tool uses the bill figure you enter; use the pre-tax amount if that is how you tip.',
      },
      { question: 'What if I overpaid by mistake?', answer: 'The extra counts as tip; check the bill first.' },
    ],
    scenarios: mixed(
      'tip-percentage-calculator',
      12,
      (r) => ({ bill: r(8, 600), paid: 0 }),
      (v) => `bill ${v.bill}`,
    ).map((sc) => ({ label: sc.label, inputs: { bill: sc.inputs.bill, paid: Math.ceil((Number(sc.inputs.bill) * 1.18) / 5) * 5 } })),
    relatedSlugs: ['tip-calculator', 'split-bill-calculator'],
    checks: [
      { inputs: {}, expect: { pct: '17.65%', tip: '$15.00' } },
      { inputs: { bill: 50, paid: 60 }, expect: { pct: '20.00%', tip: '$10.00' } },
      { inputs: { bill: 80, paid: 70 }, expect: { pct: 'You paid less than the bill' } },
    ],
  },
  {
    slug: 'unit-price-calculator',
    category: 'everyday-life',
    tier: 2,
    subCluster: 'Money and tips',
    title: 'Unit Price Calculator: Which Is the Better Deal?',
    h1: 'Unit Price Calculator',
    metaDescription: 'Compare the price per unit of two products of different sizes and see which is cheaper and by how much.',
    about:
      'Bigger packs are not always cheaper per gram or per sheet, and shelf labels do not always make the comparison easy. Enter the price and the quantity of two products in the same unit, and this calculator works out the price per unit for each, per 100 units to keep the numbers readable, then tells you which is cheaper and by what percentage. Make sure both quantities use the same unit, such as grams, millilitres or rolls.',
    inputs: [
      pos('pa', 'Product A price', 4.99, 1e7),
      pos('qa', 'Product A quantity', 500, 1e9),
      pos('pb', 'Product B price', 8.49, 1e7),
      pos('qb', 'Product B quantity', 900, 1e9),
    ],
    outputs: [
      { name: 'verdict', label: 'Better value', format: 'text', highlight: true },
      { name: 'ua', label: 'A per 100 units', format: 'text' },
      { name: 'ub', label: 'B per 100 units', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.pa).div(toD(i.qa));
      const b = toD(i.pb).div(toD(i.qb));
      const ua = fmtNumber(a.mul(100), 4);
      const ub = fmtNumber(b.mul(100), 4);
      if (a.eq(b)) return { verdict: 'Both cost the same per unit', ua, ub };
      const cheaper = a.lt(b) ? 'A' : 'B';
      const saving = a
        .minus(b)
        .abs()
        .div(a.gt(b) ? a : b)
        .mul(100);
      return { verdict: `Product ${cheaper} is cheaper per unit (${fmtNumber(saving, 2)}% less)`, ua, ub };
    },
    formulaDescription: 'Unit price = price ÷ quantity. The saving is the difference between the two unit prices divided by the higher one.',
    workedExample: 'A: $4.99 for 500 g is $0.998 per 100 g. B: $8.49 for 900 g is $0.9433 per 100 g, so B is 5.48% cheaper.',
    faq: [
      { question: 'Does the cheaper unit price always win?', answer: 'Not if you will not use the larger amount before it spoils, or if quality differs.' },
      { question: 'Do the units have to match?', answer: 'Yes. Convert both to the same unit, such as grams, before entering.' },
      { question: 'Why per 100 units?', answer: 'It keeps the figures readable instead of tiny fractions of a cent.' },
    ],
    scenarios: mixed(
      'unit-price-calculator',
      12,
      (r) => ({ pa: r(1, 40), qa: Math.round(r(100, 900)), pb: r(1, 60), qb: Math.round(r(200, 3000)) }),
      (v) => `A ${v.pa} for ${v.qa}, B ${v.pb} for ${v.qb}`,
    ),
    introOutputs: ['verdict'],
    relatedSlugs: ['discount-calculator', 'percentage-calculator'],
    checks: [
      { inputs: {}, expect: { verdict: 'Product B is cheaper per unit (5.48% less)', ua: '0.998', ub: '0.9433' } },
      { inputs: { pa: 2, qa: 100, pb: 4, qb: 200 }, expect: { verdict: 'Both cost the same per unit' } },
      { inputs: { pa: 1, qa: 10, pb: 1, qb: 20 }, expect: { verdict: 'Product B is cheaper per unit (50% less)' } },
    ],
  },
  {
    slug: 'random-number-generator',
    category: 'everyday-life',
    tier: 3,
    subCluster: 'Randomizers',
    title: 'Random Number Generator: Repeatable Numbers from a Seed',
    h1: 'Random Number Generator',
    metaDescription:
      'Generate random whole numbers between a minimum and maximum from a seed. The same seed always gives the same list, so results can be repeated.',
    about: `This generator draws whole numbers between a minimum and a maximum, inclusive, using a simple formula started from a seed you choose. Because the formula is fixed, entering the same seed gives the same list every time, which is useful for fair draws you want to show were not changed, for classroom exercises and for repeatable simulations. Change the seed for a new set.`,
    inputs: [
      whole('min', 'Minimum', 1, -1000000000, 1000000000),
      whole('max', 'Maximum', 100, -1000000000, 1000000000),
      whole('count', 'How many numbers', 5, 1, 500),
      SEED(12345),
    ],
    outputs: [
      { name: 'list', label: 'Numbers', format: 'text', highlight: true },
      { name: 'sum', label: 'Sum', format: 'text' },
    ],
    calculate: (i) => {
      const lo = toD(i.min).toNumber();
      const hi = toD(i.max).toNumber();
      if (hi < lo) return { list: 'The maximum must not be below the minimum', sum: '-' };
      const range = BigInt(hi - lo + 1);
      const g = stream(toD(i.seed).toNumber());
      const values: number[] = [];
      for (let k = 0, n = toD(i.count).toNumber(); k < n; k++) values.push(lo + Number(((g.next().value as bigint) * range) >> 32n));
      return { list: values.join(', '), sum: String(values.reduce((a, b) => a + b, 0)) };
    },
    formulaDescription:
      'x ← (1,664,525 × x + 1,013,904,223) mod 2³², starting from the seed. Each value = minimum + ⌊x × range ÷ 2³²⌋, where range = maximum − minimum + 1, so every value in the range is equally likely.',
    workedExample: 'Seed 12345, five numbers from 1 to 100: 3, 2, 55, 64, 92 (sum 216). The same seed always gives these.',
    faq: [
      { question: 'Is it suitable for lotteries or security?', answer: RANDOM_NOTE },
      { question: 'Is it truly random?', answer: 'No. It is pseudo-random: a fixed formula that looks random, which is why the same seed repeats.' },
      { question: 'Can I use it for a lottery or a password?', answer: 'No. It is predictable and not secure; use a certified or cryptographic source.' },
      { question: 'Can a number repeat?', answer: 'Yes, each draw is independent, so repeats can occur.' },
    ],
    scenarios: mixed(
      'random-number-generator',
      12,
      (r) => ({ seed: Math.round(r(0, 4000000000)), min: 1, max: Math.round(r(10, 1000)), count: 5 }),
      (v) => `seed ${v.seed}, 1 to ${v.max}`,
    ),
    introOutputs: ['list'],
    relatedSlugs: ['dice-roller', 'coin-flip-simulator'],
    checks: [
      { inputs: {}, expect: { list: '3, 2, 55, 64, 92', sum: '216' } },
      { inputs: { seed: 1, count: 3, max: 6 }, expect: { list: '2, 3, 4', sum: '9' } },
      { inputs: { seed: 0, count: 4, min: 0, max: 9 }, expect: { list: '2, 2, 8, 6', sum: '18' } },
      { inputs: { min: 10, max: 5 }, expect: { list: 'The maximum must not be below the minimum' } },
    ],
  },
  {
    slug: 'dice-roller',
    category: 'everyday-life',
    tier: 3,
    subCluster: 'Randomizers',
    title: 'Dice Roller: Roll Any Number of Dice from a Seed',
    h1: 'Dice Roller',
    metaDescription: 'Roll one or more dice with any number of sides from a seed and see each roll and the total. The same seed repeats the same rolls.',
    about: `Choose how many dice to roll and how many sides each has, from a standard six-sided die to a twenty-sided one used in tabletop games, and the roller shows every die and the total. The rolls come from a fixed formula started from the seed you enter, so the same seed always produces the same rolls, which suits games where you want a record, and a different seed gives a fresh roll.`,
    inputs: [whole('dice', 'Number of dice', 2, 1, 100), whole('sides', 'Sides per die', 6, 2, 1000), SEED(12345)],
    outputs: [
      { name: 'rolls', label: 'Rolls', format: 'text', highlight: true },
      { name: 'total', label: 'Total', format: 'text' },
    ],
    calculate: (i) => {
      const sides = BigInt(toD(i.sides).toNumber());
      const g = stream(toD(i.seed).toNumber());
      const rolls: number[] = [];
      for (let k = 0, n = toD(i.dice).toNumber(); k < n; k++) rolls.push(1 + Number(((g.next().value as bigint) * sides) >> 32n));
      return { rolls: rolls.join(', '), total: String(rolls.reduce((a, b) => a + b, 0)) };
    },
    formulaDescription: 'Same generator as the random number page: x ← (1,664,525 x + 1,013,904,223) mod 2³²; each roll = 1 + ⌊x × sides ÷ 2³²⌋.',
    workedExample: 'Seed 12345, two six-sided dice: 1 and 1, a total of 2. Seed 7, three twenty-sided dice: 5, 19, 13, total 37.',
    faq: [
      { question: 'Can I use the dice roller for gambling?', answer: RANDOM_NOTE },
      { question: 'Are the rolls fair?', answer: 'Each face is equally likely over many rolls, though a short run can look streaky, as with real dice.' },
      {
        question: 'Why a seed?',
        answer: "It makes the result repeatable and keeps the page's calculation fixed, so the same seed always shows the same roll.",
      },
      { question: 'What is d20?', answer: 'A twenty-sided die; enter 20 sides.' },
    ],
    scenarios: mixed(
      'dice-roller',
      12,
      (r) => ({ dice: Math.round(r(1, 6)), sides: Math.round(r(4, 20)), seed: Math.round(r(0, 4000000000)) }),
      (v) => `${v.dice} dice of ${v.sides} sides, seed ${v.seed}`,
    ),
    introOutputs: ['rolls'],
    relatedSlugs: ['random-number-generator', 'coin-flip-simulator'],
    checks: [
      { inputs: {}, expect: { rolls: '1, 1', total: '2' } },
      { inputs: { dice: 3, sides: 20, seed: 7 }, expect: { rolls: '5, 19, 13', total: '37' } },
      { inputs: { dice: 1, seed: 1 }, expect: { rolls: '2', total: '2' } },
    ],
  },
  {
    slug: 'coin-flip-simulator',
    category: 'everyday-life',
    tier: 3,
    subCluster: 'Randomizers',
    title: 'Coin Flip Simulator: Heads or Tails from a Seed',
    h1: 'Coin Flip Simulator',
    metaDescription: 'Flip a virtual coin one or many times from a seed and see each flip and the counts of heads and tails.',
    about: `Flip a coin to settle a choice, or flip many to see how heads and tails balance out over a larger number of tosses. Enter how many flips you want and a seed, and the simulator shows the sequence of heads and tails and the totals. Over a few flips the split can look lopsided, as with a real coin, and it tends toward half and half as the number grows.`,
    inputs: [whole('flips', 'Number of flips', 10, 1, 1000), SEED(12345)],
    outputs: [
      { name: 'seq', label: 'Sequence (H = heads, T = tails)', format: 'text', highlight: true },
      { name: 'heads', label: 'Heads', format: 'text' },
      { name: 'tails', label: 'Tails', format: 'text' },
    ],
    calculate: (i) => {
      const g = stream(toD(i.seed).toNumber());
      let seq = '';
      for (let k = 0, n = toD(i.flips).toNumber(); k < n; k++) seq += (g.next().value as bigint) >= 2147483648n ? 'H' : 'T';
      const heads = seq.split('H').length - 1;
      return { seq, heads: String(heads), tails: String(seq.length - heads) };
    },
    formulaDescription: 'Same generator as the random number page: heads if the 32-bit value x is at least 2³¹ (the top bit is set), tails otherwise.',
    workedExample: 'Seed 12345, ten flips: TTHHHTTHHH, which is 6 heads and 4 tails.',
    faq: [
      { question: 'Can I use the coin flip for anything important?', answer: RANDOM_NOTE },
      { question: 'Is it a fair coin?', answer: 'Heads and tails are equally likely for each flip, and flips do not depend on each other.' },
      {
        question: 'Why can I get several heads in a row?',
        answer: 'Streaks are normal in random sequences, and become less surprising the more flips you make.',
      },
      { question: 'Can I get different results?', answer: 'Change the seed.' },
    ],
    scenarios: mixed(
      'coin-flip-simulator',
      12,
      (r) => ({ flips: Math.round(r(4, 24)), seed: Math.round(r(0, 4000000000)) }),
      (v) => `${v.flips} flips, seed ${v.seed}`,
    ),
    introOutputs: ['seq', 'heads'],
    relatedSlugs: ['dice-roller', 'random-number-generator'],
    checks: [
      { inputs: {}, expect: { seq: 'TTHHHTTHHH', heads: '6', tails: '4' } },
      { inputs: { flips: 8, seed: 99 }, expect: { seq: 'TTHTTHTT', heads: '2', tails: '6' } },
      { inputs: { flips: 1 }, expect: { seq: 'T', heads: '0' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
