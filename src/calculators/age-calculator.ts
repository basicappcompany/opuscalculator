import { dateField } from '../lib/calc-utils';
import { D } from '../lib/decimal';
import { daysBetween, isLeap, longDate, parseIso, ymd } from '../lib/dates';
import { fmtFixed, fmtNumber, plural } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

/** The next time the birthday falls, on or after the as-of date. A 29 February birthday is observed on 1 March in other years. */
function nextBirthday(birthIso: string, asOfIso: string): string {
  const b = parseIso(birthIso);
  const a = parseIso(asOfIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const onYear = (year: number) => {
    if (b.m === 2 && b.d === 29 && !isLeap(year)) return `${year}-03-01`;
    return `${year}-${pad(b.m)}-${pad(b.d)}`;
  };
  const thisYear = onYear(a.y);
  return daysBetween(asOfIso, thisYear) >= 0 ? thisYear : onYear(a.y + 1);
}

const config: CalculatorConfig = {
  slug: 'age-calculator',
  category: 'everyday-life',
  tier: 1,
  publish: true,
  title: 'Age Calculator: Exact Age in Years, Months and Days',
  h1: 'Age Calculator',
  metaDescription:
    'Find exact age in years, months and days from a date of birth, plus total days and weeks lived and the number of days until the next birthday.',
  intro:
    'Someone born on 15 June 1990 is 36 years, 5 months and 7 days old on 22 November 2026, which is 13,309 days lived. Enter a date of birth and the date you want the age at, and the calculator counts whole years first, then the leftover months and days, the way people normally state their age. It also gives the total number of months, weeks and days, and tells you how long until the next birthday and which day of the week it falls on. Because the as-of date is an input rather than the current date, you can find the age someone was on any day in the past, or will be on a future date, such as the age needed for a school cutoff, a retirement date or a legal milestone. Months have different lengths, so the day count borrows from the month before the as-of date, and a leap-day birthday is treated as falling on 1 March in years that are not leap years. All calculations use calendar dates without clock times, so time zones and daylight saving never change the answer.',
  inputs: [
    { name: 'birthDate', label: 'Date of birth', type: 'date', default: '1990-06-15', validator: dateField() },
    { name: 'asOfDate', label: 'Age at date', type: 'date', default: '2026-11-22', validator: dateField() },
  ],
  outputs: [
    { name: 'age', label: 'Age', format: 'text', highlight: true },
    { name: 'totalMonths', label: 'Total months', format: 'number' },
    { name: 'totalWeeks', label: 'Total weeks', format: 'number' },
    { name: 'totalDays', label: 'Total days', format: 'number' },
    { name: 'nextBirthday', label: 'Next birthday', format: 'text' },
  ],
  calculate: (i) => {
    const birth = String(i.birthDate);
    const asOf = String(i.asOfDate);
    const days = daysBetween(birth, asOf);
    if (days < 0) {
      return { age: 'The date of birth is after the age-at date', totalMonths: '', totalWeeks: '', totalDays: '', nextBirthday: '' };
    }
    const { years, months, days: d } = ymd(birth, asOf);
    const next = nextBirthday(birth, asOf);
    const until = daysBetween(asOf, next);
    return {
      age: `${plural(years, 'year')}, ${plural(months, 'month')}, ${plural(d, 'day')}`,
      totalMonths: fmtFixed(years * 12 + months, 0),
      totalWeeks: fmtNumber(new D(days).div(7), 2),
      totalDays: fmtFixed(days, 0),
      nextBirthday: until === 0 ? `Today! (${longDate(next)})` : `${longDate(next)}, in ${plural(until, 'day')}`,
    };
  },
  formulaDescription:
    'Years = difference in calendar years, reduced by one if the birthday has not yet happened in the as-of year. Months and days are what remains, with a negative day count borrowing the length of the month before the as-of date. Total days = the number of calendar days between the two dates, total weeks = total days ÷ 7, and total months = years × 12 + months.',
  scenarios: [
    { label: 'Born 15 June 1990 (default)', inputs: {} },
    { label: 'Born 1 January 2000', inputs: { birthDate: '2000-01-01' } },
    { label: 'Born 4 July 1980', inputs: { birthDate: '1980-07-04' } },
    { label: 'Born 29 February 2004', inputs: { birthDate: '2004-02-29' } },
    { label: 'Born 31 December 1960', inputs: { birthDate: '1960-12-31' } },
  ],
  assumptions: [
    'Dates are calendar dates in the Gregorian calendar, including its leap-year rule, for every year.',
    'Months and days are counted from the last birthday, borrowing the length of the month before the as-of date when the day count would be negative.',
    'Only the date counts: time of day and time zones are ignored.',
  ],
  references: [
    {
      title: 'Leap Year',
      publisher: 'Hong Kong Observatory',
      url: 'https://www.weather.gov.hk/en/gts/time/basicterms-leapyear.htm',
      accessed: '2026-11-26',
      supports: 'The Gregorian leap-year rule (century years are leap years only when divisible by 400) that decides how many days lie between two dates.',
    },
    {
      title: 'ISO 8601: Date and time format',
      publisher: 'International Organization for Standardization (ISO)',
      url: 'https://www.iso.org/iso-8601-date-and-time-format.html',
      accessed: '2026-11-26',
      supports: 'Dates are entered and handled as calendar dates in year-month-day order.',
    },
  ],
  workedExample:
    'Born 15 June 1990, age on 22 November 2026: years = 2026 − 1990 = 36; months = 11 − 6 = 5; days = 22 − 15 = 7. So 36 years, 5 months and 7 days. Total days = 13,309 and total weeks = 13,309 ÷ 7 = 1,901.29. The next birthday is 15 June 2027.',
  faq: [
    {
      question: 'How is age calculated in years, months and days?',
      answer:
        'Subtract the birth date from the target date year by year, then month by month, then day by day. If the day difference is negative, borrow the number of days in the previous month; if the month difference is negative, borrow a year.',
    },
    {
      question: 'How is a leap-day birthday (29 February) handled?',
      answer:
        'In years that are not leap years the birthday is treated as 1 March for the countdown to the next birthday. Some places legally treat 28 February instead, so check the local rule if it matters for a legal age.',
    },
    {
      question: "Can I find someone's age on a past or future date?",
      answer:
        'Yes. Change the "age at" date to any date, for example a school cutoff day, an exam date or a retirement date, and the calculator shows the exact age on that day.',
    },
    {
      question: 'Does the calculator include the time of day or time zones?',
      answer: 'No. It counts whole calendar days between two dates, so the result is the same everywhere and is not affected by daylight saving changes.',
    },
  ],
  relatedSlugs: ['date-difference-calculator', 'dog-age-calculator', 'percentage-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
