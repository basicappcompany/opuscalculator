import type { HubContent } from './types';

const hub: HubContent = {
  category: 'everyday-life',
  title: 'Everyday Life Calculators: Age, Dates and Time',
  metaDescription:
    'Free everyday calculators for age, dates and the time between them, with clear explanations of how calendars work and where date arithmetic goes wrong.',
  h1: 'Everyday Life Calculators',
  lede: 'Some of the most common questions people type into a search box are small, practical and oddly hard to answer in your head: how old is someone on a given date, how many days until an event, how long between two dates. Calendars are irregular, so date arithmetic is a classic source of off-by-one mistakes. These calculators do the counting for you, and this page explains the traps.',
  sections: [
    {
      heading: 'What everyday calculations are used for',
      paragraphs: [
        'Date and time questions turn up constantly. A person wants to know their exact age in years, months and days for a form. A project manager needs the number of days between a start date and a deadline. A parent counts weeks to a due date or to a school term. Someone planning a trip wants to know how long remains before departure, or how long a stay will last.',
        'The need is often precise. A form may ask for age on a particular date rather than today. A contract may specify a notice period counted in days. A warranty or a subscription may begin on one date and end after a set number of months. In each case a rough answer is not enough, and the risk is a miscount of a day or a month at a boundary.',
        'Everyday calculators also help with planning and curiosity. Knowing how many days you have been alive, how many weeks remain until a holiday or how long a task will take once weekends are excluded makes abstract time concrete, and often makes it easier to plan around.',
      ],
    },
    {
      heading: 'How date calculations work and relate to each other',
      paragraphs: [
        'There are two basic ways to measure the gap between two dates. One counts elapsed days: the exact number of calendar days from one date to the other. The other breaks the gap into calendar units: years, months and days. The two answers look different, and each is the right answer to a different question.',
        'The age calculator uses the second approach. It subtracts the birth date from the target date in calendar units, borrowing from the preceding month when needed, to give a result such as thirty-one years, four months and twelve days. The date difference calculator can give the same gap as a total number of days, or as weeks, which is the figure you want for deadlines and durations.',
        'Both depend on the calendar rules. Months have different lengths, and a leap year adds a day to February. A year is not a fixed number of days, and a month is not either, so converting between calendar units and days always requires the actual dates, not a simple multiplication.',
        'A good rule is to choose the unit that matches the question. Use calendar units for age, anniversaries and anything described in months. Use exact days for notice periods, countdowns and durations. Using the wrong one is the most common reason two people reach different answers to the same question.',
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The most common mistake is the off-by-one error: whether to count both the start date and the end date. From the first of the month to the tenth is nine days elapsed, but ten calendar days if both ends are included. Contracts and bookings often use inclusive counting, so check which one applies before relying on a number.',
        'A second mistake is assuming a month is thirty days or a year is three hundred and sixty-five. Neither is reliably true. Counting from the thirty-first of January by one month is a particular puzzle, because February has no thirty-first. Calendar-aware calculators apply a consistent rule here, and it is worth knowing that rule if the date matters legally.',
        'Third, the leap day. Someone born on the twenty-ninth of February has a birthday that exists only in leap years, and different institutions treat the non-leap years differently, using either the twenty-eighth of February or the first of March. A calculator can show the age on any chosen date, but the legal convention depends on the jurisdiction.',
        'Fourth, ignoring time zones and the time of day. Date-only calculators treat each date as a whole day. If an event spans midnight in a different time zone, the local date may differ from yours, so for international deadlines it is worth confirming the time zone in addition to the date.',
        'Finally, relying on a date that has silently gone stale. A countdown or an age is only correct as of the moment you looked. Re-run the calculation close to the date that matters, especially for legal or financial deadlines.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        'Anyone filling in forms that ask for age at a specific date benefits from a quick and exact answer, especially for school admissions, sports eligibility and applications with age cut-offs, where being a day out can matter.',
        'Project planners, freelancers and small business owners benefit from the day-count tools when they set deadlines, calculate invoice terms or measure how long a task actually took. Having the exact number removes a source of disagreement.',
        'Families use them to mark milestones, from the number of days since a birth to the weeks until an event. These are small things, but they are the sort of small things that people enjoy knowing accurately.',
        'These calculators give calendar arithmetic only. They do not give legal advice, and where a date has legal consequences, such as a statutory deadline or an age of consent, confirm the rule that applies in your jurisdiction and, if necessary, with a qualified professional.',
      ],
    },
  ],
  subclusters: [
    {
      label: 'Age and dates',
      blurb: 'Count years, months and days between two dates.',
      slugs: ['age-calculator', 'date-difference-calculator'],
    },
  ],
  featured: [
    {
      slug: 'age-calculator',
      blurb:
        'Gives exact age in years, months and days from a birth date, either as of today or as of any date you choose. It is the one to use when a form asks for age on a particular day.',
    },
    {
      slug: 'date-difference-calculator',
      blurb:
        'Counts the time between two dates as total days, weeks and calendar units. Use it for deadlines, notice periods and anything where the number of days is what matters.',
    },
  ],
  guide: [
    {
      situation: "You need someone's exact age on a given date",
      slug: 'age-calculator',
      advice: 'Enter the date of birth and the date you want the age on, rather than relying on today.',
    },
    {
      situation: 'You need the number of days between two dates',
      slug: 'date-difference-calculator',
      advice: 'Check whether your situation counts the end date too, since that changes the total by one.',
    },
  ],
};

export default hub;
