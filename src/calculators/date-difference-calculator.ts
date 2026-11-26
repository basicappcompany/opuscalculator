import { dateField, selectField } from '../lib/calc-utils';
import { addDaysIso, daysBetween, weekdaysBetween, ymd } from '../lib/dates';
import { fmtFixed, plural } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const config: CalculatorConfig = {
  slug: 'date-difference-calculator',
  category: 'everyday-life',
  tier: 2,
  publish: false,
  title: 'Date Difference Calculator: Days, Weeks and Weekdays Between Two Dates',
  h1: 'Date Difference Calculator',
  metaDescription:
    'Count the days, weeks, months and weekdays between any two dates. Choose whether to include the end date. Good for deadlines, projects and countdowns.',
  intro:
    'There are 358 days between 1 January 2026 and 25 December 2026, which is 11 months and 24 days, or 51 weeks and 1 day, and it contains 256 weekdays. Pick a start date and an end date and the calculator reports the gap as a calendar breakdown, as a plain number of days and weeks, and as a count of working days from Monday to Friday. It is meant for planning and checking things like project timelines, notice periods, the days remaining before a deadline, the length of a contract, a trip countdown or the time since an event. By default the end date is not counted, so the gap between consecutive days is one day; switch the option on to include both the first and last day, which is how many rental and hotel nights or inclusive deadlines are counted. If you enter the dates in the wrong order the calculator simply swaps them. Weekdays do not account for public holidays, which differ by country and region, so subtract those yourself when you need a precise number of working days.',
  inputs: [
    { name: 'startDate', label: 'Start date', type: 'date', default: '2026-01-01', validator: dateField() },
    { name: 'endDate', label: 'End date', type: 'date', default: '2026-12-25', validator: dateField() },
    {
      name: 'includeEnd',
      label: 'Count the end date too?',
      type: 'select',
      default: 'no',
      unitOptions: [
        { value: 'no', label: 'No (end date not counted)' },
        { value: 'yes', label: 'Yes (include both days)' },
      ],
      validator: selectField(['no', 'yes']),
    },
  ],
  outputs: [
    { name: 'breakdown', label: 'Difference', format: 'text', highlight: true },
    { name: 'totalDays', label: 'Total days', format: 'number', highlight: true },
    { name: 'weeks', label: 'Weeks and days', format: 'text' },
    { name: 'weekdays', label: 'Weekdays (Mon to Fri)', format: 'number' },
    { name: 'weekendDays', label: 'Weekend days', format: 'number' },
  ],
  calculate: (i) => {
    let start = String(i.startDate);
    let end = String(i.endDate);
    if (daysBetween(start, end) < 0) [start, end] = [end, start];
    const extra = i.includeEnd === 'yes' ? 1 : 0;
    const total = daysBetween(start, end) + extra;
    const { years, months, days } = ymd(start, extra ? addDaysIso(end, 1) : end);
    const weekdays = weekdaysBetween(start, addDaysIso(end, extra));
    return {
      breakdown: `${plural(years, 'year')}, ${plural(months, 'month')}, ${plural(days, 'day')}`,
      totalDays: fmtFixed(total, 0),
      weeks: `${plural(Math.floor(total / 7), 'week')}, ${plural(total % 7, 'day')}`,
      weekdays: fmtFixed(weekdays, 0),
      weekendDays: fmtFixed(total - weekdays, 0),
    };
  },
  formulaDescription:
    'Total days = the number of calendar days from the start date to the end date, plus one if the end date is included. Weeks = total days ÷ 7 with the remainder in days. Years, months and days are counted calendar-wise, borrowing the length of the previous month when needed. Weekdays are the Monday to Friday days in the range; weekend days are the rest.',
  workedExample:
    '1 January 2026 to 25 December 2026: 358 days. 358 ÷ 7 = 51 weeks with 1 day left over. Calendar breakdown: 11 months and 24 days. Because 358 = 51 × 7 + 1, there are 51 × 5 = 255 weekdays in the full weeks, plus the one extra day, a Thursday, making 256 weekdays and 102 weekend days.',
  faq: [
    {
      question: 'Does the calculation include the end date?',
      answer:
        'Not by default. The gap between 1 January and 2 January is one day. Choose "include both days" if you count the first and last day, as in hotel nights or an inclusive deadline.',
    },
    {
      question: 'How many working days are there between two dates?',
      answer:
        'The weekday count shows the Monday to Friday days in the range. Public holidays are not removed, because they vary by country and region, so subtract them yourself for an exact working-day figure.',
    },
    {
      question: 'What if my start date is after my end date?',
      answer: 'The calculator swaps them, so you always get a positive number of days. The result is the distance between the two dates in either direction.',
    },
    {
      question: 'How are months counted when months have different lengths?',
      answer:
        'Whole calendar months are counted first, then the remaining days. When the end day of the month is earlier than the start day, it borrows the length of the month before the end date.',
    },
  ],
  relatedSlugs: ['age-calculator', 'percentage-calculator', 'tip-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
