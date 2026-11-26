import { dateField, numberField, selectField } from '../lib/calc-utils';
import { addDaysIso, daysBetween, ymd } from '../lib/dates';
import { D, ONE, ZERO, toD, type Dec } from '../lib/decimal';
import { currencySymbol, fmtCurrency, fmtFixed, fmtNumber, fmtPercent } from '../lib/format';
import { defineCalculator, mixed, type Spec } from '../lib/spec';
import type { CalculatorConfig } from '../lib/types';

/**
 * Prompt 5, emerging.ts (item 5.8): LLM token cost, crypto, parenting, pets, gaming, real estate, automotive and
 * education. Fifteen calculators. Anything that depends on a price or a rate (token prices, crypto prices) is an INPUT
 * with a clearly labelled example default, never a fetched or remembered current value, because calculate() may not
 * fetch and prices go stale. NOT built: localized tax calculators (they need sourced, dated rate tables, open
 * question 12.17). All Tier 3 except the common ones, so unpublished until their cohort is switched on.
 */

const pos = (name: string, label: string, def: number, max = 1e12) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min: 0.000001,
  max,
  validator: numberField({ min: 0.000001, max }),
});
const nonneg = (name: string, label: string, def: number, max = 1e12) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min: 0,
  max,
  validator: numberField({ min: 0, max }),
});
const percent = (name: string, label: string, def: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min: 0,
  max: 100,
  validator: numberField({ min: 0, max: 100 }),
});
const small = (x: Dec): string => (x.lt(1) ? `${currencySymbol()}${fmtFixed(x, 4)}` : fmtCurrency(x));

const US_MPG_FACTOR = new D('378.5411784').div('1.609344'); // litres per 100 km at 1 US mpg
const UK_MPG_FACTOR = new D('454.609').div('1.609344'); // litres per 100 km at 1 imperial mpg

export const SPECS: Spec[] = [
  {
    slug: 'llm-token-cost-calculator',
    category: 'other',
    tier: 3,
    subCluster: 'AI and software',
    title: 'LLM Token Cost Calculator: API Cost per Request and per Month',
    h1: 'LLM Token Cost Calculator',
    metaDescription:
      "Estimate the cost of language-model API calls from token counts and per-million-token prices. Enter your provider's current prices; the defaults are examples.",
    about:
      "Language-model APIs charge by the token, with separate prices for the tokens you send and the tokens the model writes back, usually quoted per million. This calculator multiplies your input and output token counts by those prices to give the cost of one request and the cost of a batch, such as a day or month of traffic. Prices change often and differ by model, so type in the current figures from your provider's pricing page; the defaults are placeholders for illustration, not real quotes.",
    inputs: [
      nonneg('input', 'Input tokens per request', 1000, 1e9),
      nonneg('output', 'Output tokens per request', 500, 1e9),
      nonneg('pin', 'Input price per million tokens ($)', 3, 1e6),
      nonneg('pout', 'Output price per million tokens ($)', 15, 1e6),
      pos('requests', 'Number of requests', 1000, 1e12),
    ],
    outputs: [
      { name: 'each', label: 'Cost per request', format: 'text', highlight: true },
      { name: 'total', label: 'Cost for all requests', format: 'text' },
    ],
    calculate: (i) => {
      const each = toD(i.input)
        .mul(toD(i.pin))
        .plus(toD(i.output).mul(toD(i.pout)))
        .div(1000000);
      return { each: small(each), total: small(each.mul(toD(i.requests))) };
    },
    formulaDescription:
      'Cost per request = (input tokens × input price + output tokens × output price) ÷ 1,000,000. Total = cost per request × number of requests. Prices are per million tokens.',
    workedExample: '1,000 input and 500 output tokens at $3 and $15 per million: $0.003 + $0.0075 = $0.0105 per request, or $10.50 for 1,000 requests.',
    faq: [
      {
        question: 'What is a token?',
        answer:
          'A chunk of text, often a few characters or part of a word; English averages roughly three quarters of a word per token, but it varies by model and language.',
      },
      { question: 'Where do I get current prices?', answer: "From your provider's pricing page. The default prices here are examples only and may be wrong." },
      {
        question: 'Does it include caching or batch discounts?',
        answer: 'No. Enter an effective price per million tokens that already reflects any discount.',
      },
    ],
    scenarios: mixed(
      'llm-token-cost-calculator',
      12,
      (r) => ({ input: Math.round(r(200, 60000)), output: Math.round(r(50, 8000)), pin: r(0.1, 15), pout: r(0.4, 75), requests: Math.round(r(10, 90000)) }),
      (v) => `${v.input} in, ${v.output} out at ${v.pin} and ${v.pout}, ${v.requests} requests`,
    ),
    introOutputs: ['each'],
    relatedSlugs: ['percentage-calculator', 'break-even-point-calculator'],
    checks: [
      { inputs: {}, expect: { each: '$0.0105', total: '$10.50' } },
      { inputs: { input: 2000, output: 1000, pin: 0.25, pout: 1.25, requests: 1 }, expect: { each: '$0.0018' } },
      { inputs: { input: 0, output: 0 }, expect: { each: '$0.0000', total: '$0.0000' } },
    ],
  },
  {
    slug: 'crypto-profit-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Savings and investing',
    title: 'Crypto Profit and Loss Calculator with Fees',
    h1: 'Crypto Profit and Loss Calculator',
    metaDescription:
      'Work out the profit or loss on a crypto trade from the buy price, sell price, amount and exchange fees. You enter the prices; none are fetched.',
    about:
      'This calculator shows what a completed trade made or lost once exchange fees are counted. Enter the price you paid per coin, the price you sold at, how many coins you traded and the fee percentage charged on each side. It returns the profit or loss, the fees paid and the return on the money you put in. Prices here are only what you type, so it works for any asset. It does not estimate tax, which depends on where you live, and it is not investment advice.',
    inputs: [
      pos('buy', 'Buy price per coin ($)', 30000),
      pos('sell', 'Sell price per coin ($)', 45000),
      pos('amount', 'Amount of coins', 0.5, 1e12),
      percent('fee', 'Fee per trade (%)', 1),
    ],
    outputs: [
      { name: 'profit', label: 'Profit or loss', format: 'text', highlight: true },
      { name: 'roi', label: 'Return on invested amount', format: 'text' },
      { name: 'fees', label: 'Total fees', format: 'text' },
    ],
    calculate: (i) => {
      const buy = toD(i.buy).mul(toD(i.amount));
      const sell = toD(i.sell).mul(toD(i.amount));
      const fees = buy.plus(sell).mul(toD(i.fee)).div(100);
      const profit = sell.minus(buy).minus(fees);
      return { profit: fmtCurrency(profit), roi: fmtPercent(profit.div(buy).mul(100), 2), fees: fmtCurrency(fees) };
    },
    formulaDescription:
      'Invested = buy price × amount. Proceeds = sell price × amount. Fees = (invested + proceeds) × fee%. Profit = proceeds − invested − fees. Return = profit ÷ invested × 100.',
    workedExample:
      '0.5 coin bought at $30,000 and sold at $45,000 with a 1% fee each way: invested $15,000, proceeds $22,500, fees $375, profit $7,125, a return of 47.50%.',
    faq: [
      { question: 'Does it include tax?', answer: 'No. Capital gains rules depend on your country and holding period; ask a tax professional.' },
      { question: 'Where do the prices come from?', answer: 'You enter them. Nothing is fetched, so the calculator never shows stale market data.' },
      { question: 'What about network fees?', answer: 'Add them to the fee percentage or reduce the sell price by the amount.' },
    ],
    scenarios: mixed(
      'crypto-profit-calculator',
      12,
      (r) => ({ buy: r(0.05, 70000), sell: r(0.05, 90000), amount: r(0.01, 500), fee: r(0.1, 2) }),
      (v) => `buy ${v.buy}, sell ${v.sell}, ${v.amount} coins, ${v.fee}% fee`,
    ),
    introOutputs: ['profit'],
    relatedSlugs: ['roi-calculator', 'percentage-increase-calculator'],
    checks: [
      { inputs: {}, expect: { profit: '$7,125.00', roi: '47.50%', fees: '$375.00' } },
      { inputs: { buy: 100, sell: 100, amount: 1, fee: 0 }, expect: { profit: '$0.00' } },
      { inputs: { buy: 100, sell: 50, amount: 2, fee: 0 }, expect: { profit: '-$100.00', roi: '-50.00%' } },
    ],
  },
  {
    slug: 'mid-parental-height-calculator',
    category: 'health',
    tier: 3,
    subCluster: 'Parenting',
    title: 'Mid-Parental Height Calculator: Predicted Adult Height of a Child',
    h1: 'Mid-Parental Height Calculator',
    metaDescription: "Estimate a child's likely adult height from the parents' heights with the mid-parental formula, with the usual range either side.",
    about:
      "A child's adult height tends to fall near the average of their parents' heights, adjusted for sex. The mid-parental formula adds the parents' heights, adds 13 centimetres for a boy or subtracts 13 for a girl to allow for the average difference between men and women, and halves the result. The estimate is a target, and children commonly land within about 8.5 centimetres either side of it. It is a rough screening tool used in paediatrics, not a prediction for an individual; nutrition, health and chance all matter.",
    inputs: [
      {
        name: 'sex',
        label: 'Child is a',
        type: 'select',
        default: 'boy',
        unitOptions: [
          { value: 'boy', label: 'Boy' },
          { value: 'girl', label: 'Girl' },
        ],
        validator: selectField(['boy', 'girl']),
      },
      pos('father', "Father's height (cm)", 180, 260),
      pos('mother', "Mother's height (cm)", 165, 260),
    ],
    outputs: [
      { name: 'target', label: 'Predicted adult height', format: 'text', highlight: true },
      { name: 'range', label: 'Likely range', format: 'text' },
    ],
    calculate: (i) => {
      const t = toD(i.father)
        .plus(toD(i.mother))
        .plus(String(i.sex) === 'girl' ? -13 : 13)
        .div(2);
      return { target: `${fmtNumber(t, 1)} cm`, range: `${fmtNumber(t.minus('8.5'), 1)} to ${fmtNumber(t.plus('8.5'), 1)} cm` };
    },
    formulaDescription: 'Boys: (father + mother + 13 cm) ÷ 2. Girls: (father + mother − 13 cm) ÷ 2. The usual range is plus or minus 8.5 cm (Tanner method).',
    workedExample: 'A father of 180 cm and mother of 165 cm: a boy is predicted at (180 + 165 + 13) ÷ 2 = 179 cm, a girl at (180 + 165 − 13) ÷ 2 = 166 cm.',
    faq: [
      {
        question: 'How accurate is it?',
        answer: 'It is a population average. Individual children can be well outside the range, so it should not be used to diagnose growth problems.',
      },
      { question: "Do I need to adjust for the parents' age?", answer: 'The formula uses adult heights; measure each parent standing, not an old figure.' },
      { question: 'What if growth looks unusual?', answer: "Talk to a paediatrician, who will use growth charts and the child's own measurements." },
    ],
    scenarios: mixed(
      'mid-parental-height-calculator',
      12,
      (r) => ({ father: r(158, 205), mother: r(145, 190) }),
      (v) => `father ${v.father} cm, mother ${v.mother} cm`,
    ),
    introOutputs: ['target'],
    relatedSlugs: ['bmi-calculator', 'cm-to-inches'],
    checks: [
      { inputs: {}, expect: { target: '179 cm', range: '170.5 to 187.5 cm' } },
      { inputs: { sex: 'girl' }, expect: { target: '166 cm', range: '157.5 to 174.5 cm' } },
      { inputs: { father: 170, mother: 170 }, expect: { target: '176.5 cm' } },
    ],
  },
  {
    slug: 'baby-age-calculator',
    category: 'everyday-life',
    tier: 3,
    subCluster: 'Parenting',
    title: 'Baby Age Calculator: Age in Weeks and Months',
    h1: 'Baby Age Calculator',
    metaDescription: "Find a baby's age in weeks and days and in months and days from the date of birth and a chosen date.",
    about:
      "Parents and health visitors often describe a baby's age in weeks for the first months and in months after that. Enter the date of birth and the date you want the age on, and this calculator gives both forms. Weeks are exact multiples of seven days, while months follow the calendar. For a baby born early, health professionals may use a corrected age based on the due date; this tool counts from the actual birth date only.",
    inputs: [
      { name: 'dob', label: 'Date of birth', type: 'date', default: '2026-04-10', validator: dateField() },
      { name: 'asOf', label: 'Age on', type: 'date', default: '2026-11-22', validator: dateField() },
    ],
    outputs: [
      { name: 'weeks', label: 'Age in weeks', format: 'text', highlight: true },
      { name: 'months', label: 'Age in months', format: 'text' },
      { name: 'days', label: 'Total days', format: 'text' },
    ],
    calculate: (i) => {
      const dob = String(i.dob);
      const on = String(i.asOf);
      const days = daysBetween(dob, on);
      if (days < 0) return { weeks: 'The chosen date is before the birth date', months: '-', days: '-' };
      const m = ymd(dob, on);
      return { weeks: `${Math.floor(days / 7)} weeks ${days % 7} days`, months: `${m.years * 12 + m.months} months ${m.days} days`, days: String(days) };
    },
    formulaDescription:
      'Total days = days between the two dates. Weeks = whole weeks and the remainder in days. Months follow the calendar: the largest whole number of months that fits, then the days left over.',
    workedExample: 'Born 10 April 2026 and measured on 22 November 2026: 226 days, which is 32 weeks 2 days, or 7 months 12 days.',
    faq: [
      {
        question: 'What is corrected age?',
        answer: 'For babies born early, age counted from the due date. Ask your health professional; this tool uses the birth date.',
      },
      { question: 'Why weeks for young babies?', answer: 'Development changes quickly early on, so weeks are a more precise way to describe it.' },
      { question: 'How are months counted?', answer: 'By the calendar, so a month can be 28 to 31 days.' },
    ],
    scenarios: mixed(
      'baby-age-calculator',
      12,
      (r) => ({ d: Math.round(r(3, 700)) }),
      (v) => `${v.d} days old`,
    ).map((sc) => ({ label: sc.label, inputs: { dob: '2026-11-22', asOf: addDaysIso('2026-11-22', Number(sc.inputs.d)) } })),
    introOutputs: ['weeks', 'months'],
    relatedSlugs: ['age-calculator', 'pregnancy-due-date-calculator'],
    checks: [
      { inputs: {}, expect: { weeks: '32 weeks 2 days', months: '7 months 12 days', days: '226' } },
      { inputs: { dob: '2025-11-22' }, expect: { weeks: '52 weeks 1 days', months: '12 months 0 days' } },
      { inputs: { dob: '2026-12-01' }, expect: { weeks: 'The chosen date is before the birth date' } },
    ],
  },
  {
    slug: 'cat-age-calculator',
    category: 'other',
    tier: 3,
    subCluster: 'Pets',
    title: 'Cat Age Calculator: Cat Years to Human Years',
    h1: 'Cat Age Calculator',
    metaDescription: "Convert a cat's age in years to an approximate human age using the widely used guideline of 15, 24 and then 4 years per cat year.",
    about:
      'Cats age quickly at first. A common guideline treats a one-year-old cat as roughly 15 in human terms, a two-year-old as about 24, and every year after that as four more human years. The figures come from veterinary life-stage guidance and are approximations, not a biological measurement, and they ignore breed, health and indoor or outdoor life. Use the result to understand life stages such as kitten, adult, mature and senior, and ask a veterinarian about the care your cat needs.',
    inputs: [{ name: 'age', label: "Cat's age (years)", type: 'number', default: 5, min: 0.1, max: 30, validator: numberField({ min: 0.1, max: 30 }) }],
    outputs: [
      { name: 'human', label: 'Approximate human age', format: 'text', highlight: true },
      { name: 'stage', label: 'Life stage', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.age);
      const human = a.lte(1) ? a.mul(15) : a.lte(2) ? new D(15).plus(a.minus(1).mul(9)) : new D(24).plus(a.minus(2).mul(4));
      const stage = a.lt(1) ? 'Kitten or junior' : a.lt(7) ? 'Adult' : a.lt(11) ? 'Mature' : 'Senior';
      return { human: `${fmtNumber(human, 1)} years`, stage };
    },
    formulaDescription:
      'Under 1 year: 15 × age. From 1 to 2 years: 15 + 9 × (age − 1). After 2 years: 24 + 4 × (age − 2). Life stages: under 1 kitten, 1 to 6 adult, 7 to 10 mature, 11 and over senior.',
    workedExample: 'A 5-year-old cat: 24 + 4 × 3 = 36 human years, an adult. A 0.5-year-old is 7.5.',
    faq: [
      { question: 'Is the old rule of 7 years right?', answer: 'No. Cats mature faster early and slower later, so a single multiplier misleads.' },
      { question: 'Does breed matter?', answer: 'Individual cats vary with genetics, diet and lifestyle, so treat the number as a guide.' },
      {
        question: 'Where do the stages come from?',
        answer: 'They follow common veterinary life-stage categories, which differ slightly between organisations.',
      },
    ],
    scenarios: mixed(
      'cat-age-calculator',
      12,
      (r) => ({ age: r(0.2, 22) }),
      (v) => `a cat aged ${v.age}`,
    ),
    relatedSlugs: ['dog-age-calculator', 'age-calculator'],
    checks: [
      { inputs: {}, expect: { human: '36 years', stage: 'Adult' } },
      { inputs: { age: 0.5 }, expect: { human: '7.5 years', stage: 'Kitten or junior' } },
      { inputs: { age: 1.5 }, expect: { human: '19.5 years' } },
      { inputs: { age: 12 }, expect: { human: '64 years', stage: 'Senior' } },
    ],
  },
  {
    slug: 'dps-calculator',
    category: 'other',
    tier: 3,
    subCluster: 'Gaming',
    title: 'DPS Calculator: Damage per Second with Critical Hits',
    h1: 'DPS Calculator',
    metaDescription: 'Calculate expected damage per second from damage per hit, attack speed, critical chance and critical multiplier.',
    about:
      'Damage per second, or DPS, lets you compare weapons and builds in games by turning damage per hit, attack speed and critical hits into one number. The calculator multiplies the damage of a hit by how often you attack, then scales it by the average bonus from critical hits, which is the crit chance times the extra damage a crit adds. The result is the expected average over many attacks; short fights vary. Game-specific effects such as armour, buffs and cooldowns are not included.',
    inputs: [
      pos('dmg', 'Damage per hit', 100),
      pos('aps', 'Attacks per second', 1.5, 1000),
      percent('crit', 'Critical chance (%)', 20),
      { name: 'mult', label: 'Critical multiplier (×)', type: 'number', default: 2, min: 1, max: 100, validator: numberField({ min: 1, max: 100 }) },
    ],
    outputs: [
      { name: 'dps', label: 'Expected DPS', format: 'text', highlight: true },
      { name: 'avg', label: 'Average damage per attack', format: 'text' },
    ],
    calculate: (i) => {
      const avg = toD(i.dmg).mul(ONE.plus(toD(i.crit).div(100).mul(toD(i.mult).minus(1))));
      return { dps: fmtNumber(avg.mul(toD(i.aps)), 2), avg: fmtNumber(avg, 2) };
    },
    formulaDescription: 'Average hit = damage × (1 + crit chance × (multiplier − 1)). DPS = average hit × attacks per second.',
    workedExample: '100 damage, 1.5 attacks a second, 20% crit chance and a 2× multiplier: average hit 120, so DPS = 180.',
    faq: [
      { question: 'Is the result exact in a fight?', answer: 'It is an average. Short fights depend on luck with critical hits.' },
      { question: 'Does it include armour?', answer: "No. Reduce the damage per hit by the target's mitigation first." },
      { question: 'What if my crit chance is over 100%?', answer: 'Cap it at 100; extra chance usually does nothing.' },
    ],
    scenarios: mixed(
      'dps-calculator',
      12,
      (r) => ({ dmg: r(5, 2500), aps: r(0.2, 8), crit: r(0, 70), mult: r(1.2, 4) }),
      (v) => `${v.dmg} damage, ${v.aps} per second, ${v.crit}% crit x${v.mult}`,
    ),
    introOutputs: ['dps'],
    relatedSlugs: ['drop-rate-calculator', 'percentage-calculator'],
    checks: [
      { inputs: {}, expect: { dps: '180', avg: '120' } },
      { inputs: { dmg: 50, aps: 2, crit: 25, mult: 3 }, expect: { dps: '150' } },
      { inputs: { crit: 0 }, expect: { dps: '150' } },
    ],
  },
  {
    slug: 'drop-rate-calculator',
    category: 'other',
    tier: 3,
    subCluster: 'Gaming',
    title: 'Drop Rate Calculator: Chance of Getting a Drop in N Tries',
    h1: 'Drop Rate Calculator',
    metaDescription: 'Find the probability of at least one drop after a number of attempts, and how many attempts give a 50%, 90% or 99% chance.',
    about:
      'If a rare item drops with a fixed chance each attempt, the chance of getting it at least once rises with every try but never quite reaches certainty. The probability of at least one drop is one minus the chance of missing every time. Enter the drop chance and the number of attempts to see your odds, along with how many attempts you need for a 50%, 90% and 99% chance. Each attempt is independent, so a long dry streak does not make the next drop more likely.',
    inputs: [
      { name: 'p', label: 'Drop chance per attempt (%)', type: 'number', default: 1, min: 0.0001, max: 100, validator: numberField({ min: 0.0001, max: 100 }) },
      { name: 'n', label: 'Attempts', type: 'number', default: 100, min: 1, max: 10000000, validator: numberField({ min: 1, max: 10000000, integer: true }) },
    ],
    outputs: [
      { name: 'chance', label: 'Chance of at least one drop', format: 'text', highlight: true },
      { name: 'a50', label: 'Attempts for 50%', format: 'text' },
      { name: 'a90', label: 'Attempts for 90%', format: 'text' },
      { name: 'a99', label: 'Attempts for 99%', format: 'text' },
    ],
    calculate: (i) => {
      const p = toD(i.p).div(100);
      const miss = ONE.minus(p);
      const need = (q: number) => (miss.isZero() ? '1' : fmtNumber(D.ln(ONE.minus(q)).div(D.ln(miss)).ceil(), 0));
      return { chance: fmtPercent(ONE.minus(miss.pow(toD(i.n))).mul(100), 2), a50: need(0.5), a90: need(0.9), a99: need(0.99) };
    },
    formulaDescription: 'Chance of at least one = 1 − (1 − p)^n. Attempts needed for probability q = ⌈ln(1 − q) ÷ ln(1 − p)⌉.',
    workedExample: 'A 1% drop over 100 attempts: 1 − 0.99^100 = 63.40%. You need 69 attempts for 50%, 230 for 90% and 459 for 99%.',
    faq: [
      { question: 'Does 100 attempts at 1% guarantee a drop?', answer: 'No. It gives about 63%; a drop is only certain with a 100% chance.' },
      { question: 'Do dry streaks make a drop due?', answer: 'No. Each attempt is independent, so the chance does not build up.' },
      { question: 'Can I enter a chance like 1 in 500?', answer: 'Yes: 1 in 500 is 0.2%.' },
    ],
    scenarios: mixed(
      'drop-rate-calculator',
      12,
      (r) => ({ p: r(0.01, 40), n: Math.round(r(3, 5000)) }),
      (v) => `${v.p}% chance, ${v.n} attempts`,
    ),
    introOutputs: ['chance', 'a50'],
    relatedSlugs: ['dps-calculator', 'factorial-calculator'],
    checks: [
      { inputs: {}, expect: { chance: '63.40%', a50: '69', a90: '230', a99: '459' } },
      { inputs: { p: 5, n: 20 }, expect: { chance: '64.15%', a50: '14' } },
      { inputs: { p: 100, n: 3 }, expect: { chance: '100.00%', a50: '1' } },
    ],
  },
  {
    slug: 'rental-yield-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Real estate',
    title: 'Rental Yield Calculator: Gross and Net Yield',
    h1: 'Rental Yield Calculator',
    metaDescription: 'Calculate the gross and net rental yield of a property from the purchase price, annual rent and annual running costs.',
    about:
      "Rental yield measures the income a property earns as a percentage of its price, which lets you compare it with other investments. Gross yield divides the annual rent by the price. Net yield first subtracts running costs such as maintenance, insurance, management fees and property taxes. Neither includes mortgage interest, vacancy periods or the change in the property's value, so use them as a first screen and not as the whole return.",
    inputs: [pos('price', 'Purchase price ($)', 400000), pos('rent', 'Annual rent ($)', 24000), nonneg('costs', 'Annual running costs ($)', 6000)],
    outputs: [
      { name: 'gross', label: 'Gross yield', format: 'text', highlight: true },
      { name: 'net', label: 'Net yield', format: 'text' },
      { name: 'income', label: 'Annual income after costs', format: 'text' },
    ],
    calculate: (i) => {
      const price = toD(i.price);
      const net = toD(i.rent).minus(toD(i.costs));
      return { gross: fmtPercent(toD(i.rent).div(price).mul(100), 2), net: fmtPercent(net.div(price).mul(100), 2), income: fmtCurrency(net) };
    },
    formulaDescription: 'Gross yield = annual rent ÷ price × 100. Net yield = (annual rent − annual costs) ÷ price × 100.',
    workedExample: 'A $400,000 property let for $24,000 a year with $6,000 of costs: gross 6.00%, net 4.50%, income $18,000.',
    faq: [
      { question: 'Does it include the mortgage?', answer: 'No. Yield ignores how the purchase is financed.' },
      { question: 'What is a good yield?', answer: 'It varies by market and risk; compare with the yields of similar properties locally.' },
      { question: 'Should I include vacancy?', answer: 'Yes, subtract expected empty periods from the annual rent.' },
    ],
    scenarios: mixed(
      'rental-yield-calculator',
      12,
      (r) => ({ price: Math.round(r(60000, 1800000)), rent: Math.round(r(3000, 120000)), costs: Math.round(r(200, 30000)) }),
      (v) => `price ${v.price}, rent ${v.rent}, costs ${v.costs}`,
    ),
    introOutputs: ['gross', 'net'],
    relatedSlugs: ['cap-rate-calculator', 'mortgage-calculator'],
    checks: [
      { inputs: {}, expect: { gross: '6.00%', net: '4.50%', income: '$18,000.00' } },
      { inputs: { price: 250000, rent: 18000, costs: 3000 }, expect: { gross: '7.20%', net: '6.00%' } },
      { inputs: { costs: 0 }, expect: { net: '6.00%' } },
    ],
  },
  {
    slug: 'cap-rate-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Real estate',
    title: 'Cap Rate Calculator: Capitalization Rate from NOI',
    h1: 'Cap Rate Calculator',
    metaDescription: "Calculate a property's capitalization rate from its income, operating expenses and value or price.",
    about:
      'The capitalization rate, or cap rate, is the annual net operating income of an investment property divided by its value or price. Net operating income is the rent and other income minus operating expenses such as maintenance, insurance, management and property tax, but before mortgage payments and income tax. The cap rate gives a quick way to compare properties regardless of how each is financed, and a higher rate means more income per dollar of price, usually with more risk.',
    inputs: [
      pos('income', 'Annual income ($)', 60000),
      nonneg('expenses', 'Annual operating expenses ($)', 24000),
      pos('value', 'Property value or price ($)', 600000),
    ],
    outputs: [
      { name: 'cap', label: 'Cap rate', format: 'text', highlight: true },
      { name: 'noi', label: 'Net operating income', format: 'text' },
    ],
    calculate: (i) => {
      const noi = toD(i.income).minus(toD(i.expenses));
      return { cap: fmtPercent(noi.div(toD(i.value)).mul(100), 2), noi: fmtCurrency(noi) };
    },
    formulaDescription: 'NOI = income − operating expenses (excluding debt service and income tax). Cap rate = NOI ÷ value × 100.',
    workedExample: '$60,000 of income less $24,000 of expenses is a $36,000 NOI; on a $600,000 property that is a 6.00% cap rate.',
    faq: [
      { question: 'Is the mortgage an operating expense?', answer: 'No. Cap rate ignores financing so properties can be compared on equal terms.' },
      { question: 'What is a good cap rate?', answer: 'It depends on location, property type and risk; there is no universal figure.' },
      {
        question: 'How does it differ from rental yield?',
        answer: 'Net yield on price is the same calculation; cap rate usually uses the market value and NOI including all operating items.',
      },
    ],
    scenarios: mixed(
      'cap-rate-calculator',
      12,
      (r) => ({ income: Math.round(r(8000, 900000)), expenses: Math.round(r(1000, 300000)), value: Math.round(r(90000, 12000000)) }),
      (v) => `income ${v.income}, expenses ${v.expenses}, value ${v.value}`,
    ),
    introOutputs: ['cap'],
    relatedSlugs: ['rental-yield-calculator', 'roi-calculator'],
    checks: [
      { inputs: {}, expect: { cap: '6.00%', noi: '$36,000.00' } },
      { inputs: { income: 100000, expenses: 40000, value: 1000000 }, expect: { cap: '6.00%' } },
      { inputs: { expenses: 70000 }, expect: { noi: '-$10,000.00' } },
    ],
  },
  {
    slug: 'price-per-square-foot-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Real estate',
    title: 'Price per Square Foot Calculator (and per Square Metre)',
    h1: 'Price per Square Foot Calculator',
    metaDescription: 'Divide a property price by its floor area to get the price per square foot and per square metre.',
    about:
      'Price per square foot, or per square metre outside the United States, is the simplest way to compare homes of different sizes. Divide the asking price by the floor area. Make sure both listings measure area the same way, since some count only heated living space and others include garages, balconies or basements, which can change the result a great deal. Enter the price and the area in square feet and the calculator returns both units.',
    inputs: [pos('price', 'Price ($)', 450000), pos('area', 'Floor area (sq ft)', 1800, 1e8)],
    outputs: [
      { name: 'psf', label: 'Price per square foot', format: 'text', highlight: true },
      { name: 'psm', label: 'Price per square metre', format: 'text' },
    ],
    calculate: (i) => {
      const price = toD(i.price);
      const area = toD(i.area);
      return { psf: fmtCurrency(price.div(area)), psm: fmtCurrency(price.div(area.mul('0.09290304'))) };
    },
    formulaDescription: 'Price per sq ft = price ÷ area in square feet. Price per square metre = price ÷ (area × 0.09290304).',
    workedExample: '$450,000 for 1,800 sq ft is $250.00 per sq ft, or $2,690.98 per square metre.',
    faq: [
      { question: 'What area should I use?', answer: 'Use the same measure for every listing, ideally the finished, heated floor area.' },
      { question: 'Does it include land?', answer: 'Only if the price does. A house on a large plot is not comparable to a flat on the same per-foot figure.' },
      { question: 'How do I convert square metres?', answer: 'Multiply square metres by 10.7639 to get square feet.' },
    ],
    scenarios: mixed(
      'price-per-square-foot-calculator',
      12,
      (r) => ({ price: Math.round(r(60000, 2500000)), area: Math.round(r(350, 6500)) }),
      (v) => `price ${v.price} for ${v.area} sq ft`,
    ),
    introOutputs: ['psf'],
    relatedSlugs: ['rental-yield-calculator', 'paint-calculator'],
    checks: [
      { inputs: {}, expect: { psf: '$250.00', psm: '$2,690.98' } },
      { inputs: { price: 100000, area: 1000 }, expect: { psf: '$100.00' } },
      { inputs: { price: 0.092903, area: 1 }, expect: { psf: '$0.09' } },
    ],
  },
  {
    slug: 'fuel-economy-converter',
    category: 'conversion',
    tier: 3,
    subCluster: 'fuel economy',
    title: 'Fuel Economy Converter: MPG to L/100 km and km/L',
    h1: 'Fuel Economy Converter',
    metaDescription: 'Convert fuel economy between US miles per gallon, imperial miles per gallon, litres per 100 km and kilometres per litre.',
    about:
      'Fuel economy is quoted in three incompatible ways: miles per gallon, litres per 100 kilometres, and kilometres per litre. Higher is better for the first and last, lower is better for litres per 100 km, and a US gallon is smaller than an imperial gallon, so the two miles-per-gallon figures differ by about 20 percent. Enter a value, choose which kind it is, and every other form is shown, which is useful when comparing cars from different countries or reading a foreign review.',
    inputs: [
      pos('v', 'Value', 30, 100000),
      {
        name: 'mode',
        label: 'This value is',
        type: 'select',
        default: 'us',
        unitOptions: [
          { value: 'us', label: 'US miles per gallon' },
          { value: 'uk', label: 'Imperial miles per gallon' },
          { value: 'l100', label: 'Litres per 100 km' },
        ],
        validator: selectField(['us', 'uk', 'l100']),
      },
    ],
    outputs: [
      { name: 'l100', label: 'Litres per 100 km', format: 'text', highlight: true },
      { name: 'kmpl', label: 'Kilometres per litre', format: 'text' },
      { name: 'us', label: 'US mpg', format: 'text' },
      { name: 'uk', label: 'Imperial mpg', format: 'text' },
    ],
    calculate: (i) => {
      const v = toD(i.v);
      const mode = String(i.mode);
      const l100 = mode === 'l100' ? v : (mode === 'uk' ? UK_MPG_FACTOR : US_MPG_FACTOR).div(v);
      return {
        l100: fmtNumber(l100, 2),
        kmpl: fmtNumber(new D(100).div(l100), 2),
        us: fmtNumber(US_MPG_FACTOR.div(l100), 2),
        uk: fmtNumber(UK_MPG_FACTOR.div(l100), 2),
      };
    },
    formulaDescription:
      'L/100 km = 235.2146 ÷ US mpg = 282.4809 ÷ imperial mpg. km/L = 100 ÷ (L/100 km). The constants come from 3.785411784 L per US gallon, 4.54609 L per imperial gallon and 1.609344 km per mile.',
    workedExample: '30 US mpg is 7.84 L/100 km, 12.75 km/L and 36.03 imperial mpg. 8 L/100 km is 29.4 US mpg.',
    faq: [
      {
        question: 'Why are US and imperial mpg different?',
        answer: 'The imperial gallon is about 20% larger than the US gallon, so the same car shows a higher imperial figure.',
      },
      { question: 'Which is better, low L/100 km or high mpg?', answer: 'Low L/100 km and high mpg both mean better economy.' },
      { question: 'Why use L/100 km?', answer: 'It measures fuel used per distance, so savings add up more intuitively than with mpg.' },
    ],
    scenarios: mixed(
      'fuel-economy-converter',
      12,
      (r) => ({ v: r(8, 70) }),
      (v) => `${v.v} US mpg`,
    ),
    introOutputs: ['l100'],
    relatedSlugs: ['trip-fuel-cost-calculator', 'miles-to-km'],
    checks: [
      { inputs: {}, expect: { l100: '7.84', kmpl: '12.75', us: '30', uk: '36.03' } },
      { inputs: { v: 8, mode: 'l100' }, expect: { us: '29.4', uk: '35.31' } },
      { inputs: { v: 36.0285, mode: 'uk' }, expect: { us: '30' } },
    ],
  },
  {
    slug: 'trip-fuel-cost-calculator',
    category: 'other',
    tier: 3,
    subCluster: 'Automotive',
    title: 'Trip Fuel Cost Calculator: Litres and Cost for a Journey',
    h1: 'Trip Fuel Cost Calculator',
    metaDescription: "Estimate the fuel used and the cost of a trip from the distance, the car's fuel economy in litres per 100 km and the price per litre.",
    about:
      "Planning a drive means knowing roughly what the fuel will cost. Enter the trip distance in kilometres, your car's fuel economy in litres per 100 kilometres and the price you pay for a litre. The calculator returns the fuel used, the total cost and the cost per kilometre. Real consumption changes with speed, load, traffic, weather and driving style, so treat the figure as an estimate. If your economy is in miles per gallon, convert it first with the fuel economy converter.",
    inputs: [pos('km', 'Distance (km)', 450, 1e6), pos('l100', 'Fuel economy (L/100 km)', 7.2, 100), pos('price', 'Fuel price per litre', 1.85, 1000)],
    outputs: [
      { name: 'cost', label: 'Fuel cost', format: 'text', highlight: true },
      { name: 'litres', label: 'Fuel used', format: 'text' },
      { name: 'perKm', label: 'Cost per kilometre', format: 'text' },
    ],
    calculate: (i) => {
      const litres = toD(i.km).mul(toD(i.l100)).div(100);
      return { cost: fmtNumber(litres.mul(toD(i.price)), 2), litres: `${fmtNumber(litres, 2)} L`, perKm: fmtNumber(toD(i.l100).div(100).mul(toD(i.price)), 3) };
    },
    formulaDescription:
      'Fuel used (L) = distance × L/100 km ÷ 100. Cost = litres × price per litre. Cost per km = L/100 km ÷ 100 × price. The cost is in the currency of your price.',
    workedExample: '450 km at 7.2 L/100 km uses 32.4 L; at 1.85 per litre that costs 59.94, or 0.133 per kilometre.',
    faq: [
      { question: 'Which currency is used?', answer: 'Whatever your fuel price is in; nothing is converted.' },
      { question: 'How do I find my real fuel economy?', answer: 'Fill the tank, drive, refill, and divide the litres added by the distance, times 100.' },
      { question: 'Does it include tolls or wear?', answer: 'No, only fuel.' },
    ],
    scenarios: mixed(
      'trip-fuel-cost-calculator',
      12,
      (r) => ({ km: Math.round(r(20, 4500)), l100: r(3.5, 16), price: r(1, 2.6) }),
      (v) => `${v.km} km at ${v.l100} L/100 km, ${v.price} a litre`,
    ),
    introOutputs: ['cost'],
    relatedSlugs: ['fuel-economy-converter', 'electricity-cost-calculator'],
    checks: [
      { inputs: {}, expect: { cost: '59.94', litres: '32.4 L', perKm: '0.133' } },
      { inputs: { km: 100, l100: 5, price: 2 }, expect: { litres: '5 L', cost: '10' } },
      { inputs: { km: 1000, l100: 10, price: 1 }, expect: { litres: '100 L', perKm: '0.1' } },
    ],
  },
  {
    slug: 'gpa-calculator',
    category: 'other',
    tier: 2,
    subCluster: 'Education',
    title: 'GPA Calculator: Grade Point Average from Credits and Grades',
    h1: 'GPA Calculator',
    metaDescription: 'Calculate a grade point average from the credit hours and grade points of up to four courses, weighted by credits.',
    about:
      'A grade point average is the credit-weighted mean of your grade points, so a four-credit course counts more than a two-credit one. Enter the credits and the grade points for up to four courses, using the scale your school uses, commonly 4.0 for an A and 0 for a fail, and the calculator returns the GPA and the total credits. Leave a course with zero credits to ignore it. Schools differ on plus and minus grades and on repeated courses, so check your own rules for official figures. Students use it to see how a single retake, a heavy lab course or a pass-fail elective would move the semester result before registering, and scholarship holders to check a minimum.',
    inputs: [
      pos('c1', 'Course 1 credits', 3, 100),
      nonneg('g1', 'Course 1 grade points', 4, 10),
      pos('c2', 'Course 2 credits', 4, 100),
      nonneg('g2', 'Course 2 grade points', 3.7, 10),
      pos('c3', 'Course 3 credits', 3, 100),
      nonneg('g3', 'Course 3 grade points', 3, 10),
      nonneg('c4', 'Course 4 credits', 2, 100),
      nonneg('g4', 'Course 4 grade points', 2.3, 10),
    ],
    outputs: [
      { name: 'gpa', label: 'GPA', format: 'text', highlight: true },
      { name: 'credits', label: 'Total credits', format: 'text' },
    ],
    calculate: (i) => {
      const pairs = [
        ['c1', 'g1'],
        ['c2', 'g2'],
        ['c3', 'g3'],
        ['c4', 'g4'],
      ].map(([c, g]) => [toD(i[c]), toD(i[g])]);
      const credits = pairs.reduce((a, [c]) => a.plus(c), ZERO);
      if (credits.isZero()) return { gpa: 'Enter at least one course with credits', credits: '0' };
      return { gpa: fmtFixed(pairs.reduce((a, [c, g]) => a.plus(c.mul(g)), ZERO).div(credits), 2), credits: fmtNumber(credits, 2) };
    },
    formulaDescription: 'GPA = Σ(credits × grade points) ÷ Σ(credits).',
    workedExample: '3 credits at 4.0, 4 at 3.7, 3 at 3.0 and 2 at 2.3: (12 + 14.8 + 9 + 4.6) ÷ 12 = 3.37.',
    faq: [
      { question: 'What is the scale?', answer: 'Use the grade points your institution assigns; 4.0 for an A is common in the United States.' },
      { question: 'Does it handle weighted or honours courses?', answer: 'Enter the weighted grade points your school uses.' },
      { question: 'Why is the GPA weighted by credits?', answer: 'Longer courses represent more work, so they affect the average more.' },
    ],
    scenarios: mixed(
      'gpa-calculator',
      12,
      (r) => ({
        c1: Math.round(r(1, 6)),
        g1: r(0, 4),
        c2: Math.round(r(1, 6)),
        g2: r(0, 4),
        c3: Math.round(r(1, 6)),
        g3: r(0, 4),
        c4: Math.round(r(1, 6)),
        g4: r(0, 4),
      }),
      (v) => `${v.c1} at ${v.g1}, ${v.c2} at ${v.g2}, ${v.c3} at ${v.g3}, ${v.c4} at ${v.g4}`,
    ),
    introOutputs: ['gpa'],
    relatedSlugs: ['final-grade-calculator', 'weighted-average-calculator'],
    checks: [
      { inputs: {}, expect: { gpa: '3.37', credits: '12' } },
      { inputs: { g1: 4, g2: 4, g3: 4, g4: 4 }, expect: { gpa: '4.00' } },
      { inputs: { c4: 0, g4: 0, c1: 3, g1: 2, c2: 3, g2: 2, c3: 3, g3: 2 }, expect: { gpa: '2.00', credits: '9' } },
    ],
  },
  {
    slug: 'final-grade-calculator',
    category: 'other',
    tier: 2,
    subCluster: 'Education',
    title: 'Final Grade Calculator: What Score Do I Need on the Exam?',
    h1: 'Final Grade Calculator',
    metaDescription: "Find the score you need on a final exam to reach a target course grade, from your current grade and the exam's weight.",
    about:
      'If your course grade is made of coursework and a final exam, you can work out the mark you need on the exam to reach a grade you want. Enter your current grade percentage, the percentage of the course grade that the final counts for and the grade you are aiming for. The calculator shows the score required. If it comes out above 100 percent, the target is out of reach without extra credit, and if it is below zero you have already secured it.',
    inputs: [percent('current', 'Current grade (%)', 88), percent('weight', 'Final exam weight (%)', 25), percent('target', 'Target grade (%)', 90)],
    outputs: [{ name: 'needed', label: 'Score needed on the final', format: 'text', highlight: true }],
    calculate: (i) => {
      const w = toD(i.weight).div(100);
      if (w.isZero()) return { needed: 'The final must count for more than 0%' };
      const needed = toD(i.target)
        .minus(toD(i.current).mul(ONE.minus(w)))
        .div(w);
      if (needed.gt(100)) return { needed: `${fmtNumber(needed, 2)}%, above 100%: not reachable without extra credit` };
      if (needed.lt(0)) return { needed: 'Already secured: any score will do' };
      return { needed: `${fmtNumber(needed, 2)}%` };
    },
    formulaDescription:
      'Needed = (target − current × (1 − weight)) ÷ weight, with weight as a decimal. Your current grade is assumed to be the average of everything except the final.',
    workedExample: 'Current 88%, final worth 25%, target 90%: (90 − 88 × 0.75) ÷ 0.25 = 96%.',
    faq: [
      { question: 'What counts as the current grade?', answer: 'The weighted average of all graded work excluding the final.' },
      { question: 'What if my course uses points?', answer: 'Convert everything to percentages of the total first.' },
      { question: 'Does it consider rounding rules?', answer: 'No. Check whether your instructor rounds up at the boundary.' },
    ],
    scenarios: mixed(
      'final-grade-calculator',
      12,
      (r) => ({ current: r(45, 99), weight: Math.round(r(10, 50)), target: Math.round(r(60, 98)) }),
      (v) => `current ${v.current}%, final ${v.weight}%, aiming for ${v.target}%`,
    ),
    introOutputs: ['needed'],
    relatedSlugs: ['gpa-calculator', 'weighted-average-calculator'],
    checks: [
      { inputs: {}, expect: { needed: '96%' } },
      { inputs: { current: 75, weight: 40, target: 70 }, expect: { needed: '62.5%' } },
      { inputs: { current: 90, weight: 20, target: 95 }, expect: { needed: '115%, above 100%: not reachable without extra credit' } },
      { inputs: { current: 99, weight: 10, target: 60 }, expect: { needed: 'Already secured: any score will do' } },
    ],
  },
  {
    slug: 'weighted-average-calculator',
    category: 'other',
    tier: 3,
    subCluster: 'Education',
    title: 'Weighted Average Calculator: Scores and Weights',
    h1: 'Weighted Average Calculator',
    metaDescription: 'Calculate a weighted average from up to four scores and their weights. Weights are normalised, so they need not add up to 100.',
    about:
      'A weighted average counts some values more than others. A course might count homework for 30 percent, a midterm for 20 and the final exam for 50, so a strong final moves the grade more than a strong homework mark. Enter up to four scores with their weights and the calculator multiplies each score by its weight, adds them and divides by the total weight, so the weights can be percentages, points or any proportional numbers. Leave a weight at zero to skip that row. Teachers blending quizzes and projects, analysts averaging prices by volume, and shoppers averaging ratings by number of reviews all rely on the same arithmetic.',
    inputs: [
      nonneg('s1', 'Score 1', 90, 1e9),
      nonneg('w1', 'Weight 1', 30, 1e9),
      nonneg('s2', 'Score 2', 80, 1e9),
      nonneg('w2', 'Weight 2', 20, 1e9),
      nonneg('s3', 'Score 3', 70, 1e9),
      nonneg('w3', 'Weight 3', 50, 1e9),
      nonneg('s4', 'Score 4', 0, 1e9),
      nonneg('w4', 'Weight 4', 0, 1e9),
    ],
    outputs: [
      { name: 'avg', label: 'Weighted average', format: 'text', highlight: true },
      { name: 'weight', label: 'Total weight', format: 'text' },
    ],
    calculate: (i) => {
      const rows = [
        ['s1', 'w1'],
        ['s2', 'w2'],
        ['s3', 'w3'],
        ['s4', 'w4'],
      ].map(([s, w]) => [toD(i[s]), toD(i[w])]);
      const total = rows.reduce((a, [, w]) => a.plus(w), ZERO);
      if (total.isZero()) return { avg: 'Enter at least one weight above 0', weight: '0' };
      return { avg: fmtNumber(rows.reduce((a, [s, w]) => a.plus(s.mul(w)), ZERO).div(total), 4), weight: fmtNumber(total, 4) };
    },
    formulaDescription: 'Weighted average = Σ(score × weight) ÷ Σ(weight).',
    workedExample: 'Scores 90, 80, 70 with weights 30, 20, 50: (2,700 + 1,600 + 3,500) ÷ 100 = 78.',
    faq: [
      { question: 'Do the weights have to add to 100?', answer: 'No. They are divided by their total, so any proportional numbers work.' },
      {
        question: 'How is this different from a simple average?',
        answer: 'A simple average treats every value equally; a weighted average lets some count more.',
      },
      { question: 'Can I use it for GPA?', answer: 'Yes, with credits as weights and grade points as scores.' },
    ],
    scenarios: mixed(
      'weighted-average-calculator',
      12,
      (r) => ({ s1: r(40, 100), w1: Math.round(r(5, 60)), s2: r(40, 100), w2: Math.round(r(5, 60)), s3: r(40, 100), w3: Math.round(r(5, 60)), s4: 0, w4: 0 }),
      (v) => `${v.s1} at ${v.w1}, ${v.s2} at ${v.w2}, ${v.s3} at ${v.w3}`,
    ),
    introOutputs: ['avg'],
    relatedSlugs: ['gpa-calculator', 'final-grade-calculator', 'mean-median-mode-calculator'],
    checks: [
      { inputs: {}, expect: { avg: '78', weight: '100' } },
      { inputs: { s1: 100, w1: 1, s2: 100, w2: 1, s3: 100, w3: 1 }, expect: { avg: '100' } },
      { inputs: { s1: 80, w1: 1, s2: 90, w2: 1, s3: 70, w3: 2 }, expect: { avg: '77.5', weight: '4' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
