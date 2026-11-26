import { dateField, selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { addDaysIso, longDate } from '../lib/dates';
import { fmtCurrency, fmtNumber, fmtPercent } from '../lib/format';
import { defineCalculator, mixed, type Spec } from '../lib/spec';
import { field, intField, varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 11 (biology): pets, small animals, livestock fencing, lawn and tree work, and a wastewater load page.
 * Age conversions and lifespans are rules of thumb and the pages say so. No drug doses, no toxicity thresholds and no
 * quality-of-life scores. Money pages use fmtCurrency with `($)` labels and inputs the reader supplies. Tier 2 or 3, so
 * none is live until the cohort gate opens. Biology shows the category disclaimer.
 */

const PI = new D('3.14159265358979323846264338327950288');
const LB_PER_KG = new D('2.20462262185');
const select = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});
const dateInput = (name: string, label: string, def: string) => ({ name, label, type: 'date' as const, default: def, validator: dateField() });

const DOG_LIFE: Record<string, { label: string; lo: number; hi: number }> = {
  toy: { label: 'Toy (under 5 kg)', lo: 13, hi: 16 },
  small: { label: 'Small (5 to 10 kg)', lo: 12, hi: 15 },
  medium: { label: 'Medium (10 to 25 kg)', lo: 10, hi: 14 },
  large: { label: 'Large (25 to 45 kg)', lo: 9, hi: 12 },
  giant: { label: 'Giant (over 45 kg)', lo: 7, hi: 10 },
};
const BIRDS: Record<string, { label: string; years: number }> = {
  budgie: { label: 'Budgerigar (8 years)', years: 8 },
  canary: { label: 'Canary (10)', years: 10 },
  lovebird: { label: 'Lovebird (12)', years: 12 },
  cockatiel: { label: 'Cockatiel (20)', years: 20 },
  conure: { label: 'Conure (25)', years: 25 },
  grey: { label: 'African grey parrot (50)', years: 50 },
  macaw: { label: 'Macaw (55)', years: 55 },
};
const HAMSTERS: Record<string, { label: string; years: string }> = {
  syrian: { label: 'Syrian (2.5 years)', years: '2.5' },
  dwarf: { label: 'Dwarf, Campbell or winter white (2)', years: '2' },
  roborovski: { label: 'Roborovski (3)', years: '3' },
  chinese: { label: 'Chinese (2.5)', years: '2.5' },
};

/** Human-equivalent age on a straight scale: the animal's share of its typical life times a human lifespan. */
const humanEquivalent = (age: Dec, lifespan: Dec, human: Dec): Dec => age.div(lifespan).mul(human);

export const SPECS: Spec[] = [
  {
    slug: 'cost-of-owning-a-dog-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Dog',
    title: 'Cost of Owning a Dog Calculator: Yearly and Lifetime Budget',
    h1: 'Cost of Owning a Dog Calculator',
    metaDescription: 'Add up food, vet care, grooming, supplies and one-time costs to see what a dog costs per month, per year and over its life.',
    about:
      'The purchase or adoption fee is only the start of what a dog costs. Food, routine veterinary care and insurance, grooming, toys, beds, training and boarding recur every year, and a dog may live for ten to fifteen years. Enter your own figures, since prices differ by country, breed and size, and the page totals the yearly and monthly running cost and the lifetime cost over the years you expect. One-time costs such as adoption, the first vaccinations, a crate and a collar are added once. The result is a budgeting tool built from your numbers, not a statement of what dogs cost.',
    inputs: [
      field('food', 'Food per month ($)', 60, 0, 10000),
      field('vet', 'Vet care and insurance per year ($)', 700, 0, 100000),
      field('groom', 'Grooming per year ($)', 300, 0, 100000),
      field('supplies', 'Toys, bedding and supplies per year ($)', 250, 0, 100000),
      field('other', 'Training, boarding and other per year ($)', 200, 0, 100000),
      field('once', 'One-time costs ($)', 600, 0, 1000000),
      intField('years', 'Years you expect to keep the dog', 12, 1, 30),
    ],
    outputs: [
      { name: 'year', label: 'Running cost per year', format: 'text' },
      { name: 'month', label: 'Per month', format: 'text' },
      { name: 'life', label: "Total over the dog's life", format: 'text', highlight: true },
    ],
    calculate: (i) => {
      const year = toD(i.food).mul(12).plus(toD(i.vet)).plus(toD(i.groom)).plus(toD(i.supplies)).plus(toD(i.other));
      return { year: fmtCurrency(year), month: fmtCurrency(year.div(12)), life: fmtCurrency(year.mul(toD(i.years)).plus(toD(i.once))) };
    },
    formulaDescription: 'Per year = food × 12 + vet + grooming + supplies + other. Per month = per year ÷ 12. Lifetime = per year × years + one-time costs.',
    workedExample:
      'Food $60 a month is $720; with $700 vet, $300 grooming, $250 supplies and $200 other the year costs $2,170, or $180.83 a month. Over 12 years plus $600 up front the total is $26,640.',
    faq: [
      {
        question: 'What is usually the biggest cost?',
        answer:
          'Over a lifetime, veterinary care and food, and one emergency can exceed a year of the rest. A savings buffer or insurance helps with surprises.',
      },
      { question: 'Do large dogs cost more?', answer: 'Usually yes: they eat more, need larger gear and often cost more for medicines and boarding.' },
      { question: 'Are the defaults typical?', answer: 'They are placeholders. Replace them with prices from your area and your vet.' },
    ],
    scenarios: mixed(
      'cost-of-owning-a-dog-calculator',
      8,
      (r) => ({
        food: Math.round(r(20, 160)),
        vet: Math.round(r(200, 2400)),
        groom: Math.round(r(0, 900)),
        supplies: Math.round(r(60, 700)),
        other: Math.round(r(0, 1200)),
        once: Math.round(r(100, 2500)),
        years: Math.round(r(6, 16)),
      }),
      (v) => `food ${v.food} a month, vet ${v.vet}, grooming ${v.groom}, supplies ${v.supplies}, other ${v.other}, up front ${v.once}, ${v.years} years`,
    ),
    introOutputs: ['life'],
    relatedSlugs: ['dog-food-calculator', 'dog-life-expectancy-calculator'],
    checks: [
      { inputs: {}, expect: { year: '$2,170.00', month: '$180.83', life: '$26,640.00' } },
      { inputs: { food: 40, vet: 400, groom: 0, supplies: 150, other: 100, once: 300, years: 10 }, expect: { year: '$1,130.00', life: '$11,600.00' } },
      { inputs: { food: 0, vet: 0, groom: 0, supplies: 0, other: 0, once: 0 }, expect: { life: '$0.00' } },
    ],
  },
  {
    slug: 'dog-harness-size-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Dog',
    title: 'Dog Harness Size Calculator from Chest Girth',
    h1: 'Dog Harness Size Calculator',
    metaDescription: 'Pick a dog harness size from the girth of the chest in centimetres or inches, with the range for each size.',
    about:
      "A harness fits when it is snug enough not to slip over the shoulders and loose enough that two fingers pass under every strap. The key measurement is the girth, the distance around the widest part of the chest just behind the front legs. Wrap a soft tape measure around the dog, keep it flat and not tight, and enter the number in centimetres or inches. The page converts to centimetres and returns a size from extra small to double extra large and the range it covers. Brands cut their sizes differently, so compare with the maker's chart and choose the larger size if you fall between two.",
    inputs: [
      field('girth', 'Chest girth', 60, 10, 200),
      select('unit', 'Unit', 'cm', [
        ['cm', 'Centimetres'],
        ['in', 'Inches'],
      ]),
    ],
    outputs: [
      { name: 'size', label: 'Suggested size', format: 'text', highlight: true },
      { name: 'range', label: 'Range for that size', format: 'text' },
      { name: 'cm', label: 'Girth in centimetres', format: 'text' },
    ],
    calculate: (i) => {
      const cm = String(i.unit) === 'in' ? toD(i.girth).mul('2.54') : toD(i.girth);
      const bands: [number, string, string][] = [
        [40, 'XS', 'up to 40 cm'],
        [50, 'S', '40 to 50 cm'],
        [65, 'M', '50 to 65 cm'],
        [80, 'L', '65 to 80 cm'],
        [95, 'XL', '80 to 95 cm'],
      ];
      const band = bands.find(([upper]) => cm.lte(upper));
      return { size: band ? band[1] : 'XXL', range: band ? band[2] : 'over 95 cm', cm: `${fmtNumber(cm, 1)} cm` };
    },
    formulaDescription:
      'Girth in cm = inches × 2.54. Sizes by girth: XS to 40 cm, S 40 to 50, M 50 to 65, L 65 to 80, XL 80 to 95, XXL above 95. These are generic bands; use the brand chart when it differs.',
    workedExample: 'A chest girth of 60 cm falls in the 50 to 65 cm band, so M. A measurement of 20 inches is 50.8 cm, also M; 41 cm is the start of S.',
    faq: [
      {
        question: 'Where do I measure?',
        answer: 'Around the broadest part of the ribcage, directly behind the front legs, with the tape flat against the coat.',
      },
      {
        question: 'Should I add room?',
        answer: "The girth is the dog's size. A good fit leaves room for two fingers under the straps, which most adjustable harnesses allow.",
      },
      { question: 'What if the dog is still growing?', answer: 'Choose an adjustable harness and re-measure every few weeks for a puppy.' },
    ],
    scenarios: varied(
      'dog-harness-size-calculator',
      8,
      [{ name: 'girth', lo: 22, hi: 105 }],
      [{ name: 'unit', options: ['cm', 'in'] }],
      (v) => `girth ${v.girth} ${v.unit}`,
    ),
    introOutputs: ['size'],
    relatedSlugs: ['dog-size-calculator', 'dog-crate-size-calculator'],
    checks: [
      { inputs: {}, expect: { size: 'M', range: '50 to 65 cm', cm: '60 cm' } },
      { inputs: { girth: 40 }, expect: { size: 'XS' } },
      { inputs: { girth: 41 }, expect: { size: 'S' } },
      { inputs: { girth: 100 }, expect: { size: 'XXL', range: 'over 95 cm' } },
      { inputs: { girth: 20, unit: 'in' }, expect: { size: 'M', cm: '50.8 cm' } },
    ],
  },
  {
    slug: 'dog-heat-cycle-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Dog',
    title: 'Dog Heat Cycle Calculator: Next Heat and Fertile Window',
    h1: 'Dog Heat Cycle Calculator',
    metaDescription: "Estimate the date of a dog's next heat from the start of the last one and the usual gap between heats, with the likely fertile window.",
    about:
      'A female dog comes into heat about twice a year, though small breeds may cycle three times and giant breeds only once, and the gap between heats is fairly steady for each dog. The first days, called proestrus, bring swelling and discharge but she usually refuses males; ovulation and the fertile days of estrus follow, roughly from day nine to day eighteen counting from the first signs. Enter the first day of the last heat and the number of days between her heats, and the page predicts the next start and the likely fertile window. Early cycles are irregular, so treat the dates as estimates and ask your vet when planning. Breeders, kennel clubs and shelter staff log the first day of bleeding on a calendar, because proestrus, estrus, diestrus and anestrus follow one another in a fixed order and the gap between litters matters for the health of the bitch.',
    inputs: [dateInput('last', 'First day of the last heat', '2026-01-10'), intField('interval', 'Days between heats', 180, 120, 420)],
    outputs: [
      { name: 'next', label: 'Next heat expected', format: 'text', highlight: true },
      { name: 'fertile', label: 'Likely fertile days', format: 'text' },
      { name: 'peryear', label: 'Heats per year', format: 'text' },
    ],
    calculate: (i) => {
      const start = addDaysIso(String(i.last), Number(i.interval));
      return {
        next: longDate(start),
        fertile: `${longDate(addDaysIso(start, 9))} to ${longDate(addDaysIso(start, 18))}`,
        peryear: fmtNumber(new D(365).div(toD(i.interval)), 2),
      };
    },
    formulaDescription:
      'Next heat = first day of the last heat + days between heats. Fertile window = days 9 to 18 after the first signs. Heats per year = 365 ÷ days between heats.',
    workedExample:
      'Last heat began 10 January 2026 and she cycles every 180 days: the next begins on Thursday, 9 Jul 2026, with a fertile window from 18 Jul to 27 Jul and about 2.03 heats a year.',
    faq: [
      {
        question: 'How long does a heat last?',
        answer: 'About three weeks in total, from the first swelling to the end of discharge, though it varies between dogs.',
      },
      {
        question: 'When is it safe to say she is not fertile?',
        answer: 'It is not safe to rely on dates alone. Dogs can ovulate earlier or later, so a vet can use blood tests or a smear to time breeding.',
      },
      { question: 'Should I spay?', answer: 'That is a decision for you and your vet, depending on age, breed and health.' },
    ],
    scenarios: mixed(
      'dog-heat-cycle-calculator',
      12,
      (r) => ({ interval: Math.round(r(140, 400)) }),
      (v) => `every ${v.interval} days from 10 January`,
    ).map((s, k) => ({
      ...s,
      inputs: { ...s.inputs, last: ['2026-01-10', '2026-02-03', '2026-03-18', '2026-04-22', '2026-05-09', '2026-06-30', '2026-08-12', '2026-09-27'][k % 8] },
      label: `${s.label.replace('10 January', ['10 January', '3 February', '18 March', '22 April', '9 May', '30 June', '12 August', '27 September'][k % 8])}`,
    })),
    introOutputs: ['peryear'],
    relatedSlugs: ['dog-pregnancy-calculator', 'dog-age-calculator'],
    checks: [
      { inputs: {}, expect: { next: 'Thursday, 9 Jul 2026', fertile: 'Saturday, 18 Jul 2026 to Monday, 27 Jul 2026', peryear: '2.03' } },
      { inputs: { last: '2025-12-31', interval: 365 }, expect: { next: 'Thursday, 31 Dec 2026', peryear: '1' } },
      { inputs: { last: '2026-03-01', interval: 210 }, expect: { next: 'Sunday, 27 Sep 2026' } },
    ],
  },
  {
    slug: 'dog-life-expectancy-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Dog',
    title: 'Dog Life Expectancy Calculator by Size: Typical Years Left',
    h1: 'Dog Life Expectancy Calculator',
    metaDescription: 'See the typical lifespan range for a dog of your size class, the midpoint, and the typical years left for the age of your dog.',
    about:
      'How long a dog lives depends mostly on size: toy breeds often reach fifteen, while giant breeds are old at eight or nine. The reason is thought to be faster growth in large dogs, which age more quickly. This page uses typical ranges for five size classes taken from published surveys of pet dogs, picks the midpoint, and subtracts the age you enter to give a rough number of years left. It is an average over many animals, not a prediction for yours. Genetics, weight, dental care, exercise and veterinary attention all move an individual dog well above or below the range.',
    inputs: [
      select(
        'size',
        'Size class',
        'medium',
        Object.entries(DOG_LIFE).map(([k, v]): [string, string] => [k, v.label]),
      ),
      field('age', 'Age of your dog (years)', 5, 0, 30),
    ],
    outputs: [
      { name: 'range', label: 'Typical lifespan', format: 'text' },
      { name: 'mid', label: 'Midpoint', format: 'text' },
      { name: 'left', label: 'Typical years left', format: 'text', highlight: true },
      { name: 'pct', label: 'Share of the midpoint lifespan', format: 'text' },
    ],
    calculate: (i) => {
      const band = DOG_LIFE[String(i.size)] ?? DOG_LIFE.medium;
      const mid = new D(band.lo).plus(band.hi).div(2);
      const age = toD(i.age);
      const left = mid.minus(age);
      return {
        range: `${band.lo} to ${band.hi} years`,
        mid: `${fmtNumber(mid, 1)} years`,
        left: left.gt(0) ? `${fmtNumber(left, 1)} years` : '0 years: past the typical average',
        pct: fmtPercent(age.div(mid).mul(100), 1),
      };
    },
    formulaDescription: 'Midpoint = (low + high) ÷ 2 for the size class. Typical years left = midpoint − age, never below 0. Share = age ÷ midpoint × 100.',
    workedExample: 'A medium dog is typically 10 to 14 years, midpoint 12. At 5 years it has about 7 years left and has used 41.7% of the midpoint lifespan.',
    faq: [
      { question: 'Why do small dogs live longer?', answer: 'Large dogs grow faster and appear to age faster, though the exact cause is still being studied.' },
      { question: 'Can a dog live past the range?', answer: 'Yes. The figures are averages and plenty of dogs live beyond them, especially with good care.' },
      {
        question: 'Does the breed matter beyond size?',
        answer: 'Yes. Some breeds have inherited conditions that shorten life, and mixed breeds often sit in the middle of their size class.',
      },
    ],
    scenarios: varied(
      'dog-life-expectancy-calculator',
      8,
      [{ name: 'age', lo: 0.5, hi: 16, step: 0.5 }],
      [{ name: 'size', options: ['toy', 'small', 'medium', 'large', 'giant'] }],
      (v) => `a ${v.size} dog aged ${v.age} years`,
    ),
    introOutputs: ['left'],
    relatedSlugs: ['dog-age-calculator', 'cost-of-owning-a-dog-calculator'],
    checks: [
      { inputs: {}, expect: { range: '10 to 14 years', mid: '12 years', left: '7 years', pct: '41.7%' } },
      { inputs: { size: 'giant', age: 9 }, expect: { left: '0 years: past the typical average' } },
      { inputs: { size: 'toy', age: 3 }, expect: { left: '11.5 years', pct: '20.7%' } },
    ],
  },
  {
    slug: 'raw-dog-food-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Dog',
    title: 'Raw Dog Food Calculator: Daily Amount and Meat, Bone, Organ Split',
    h1: 'Raw Dog Food Calculator',
    metaDescription: 'Work out the daily amount of raw food for a dog as a percentage of body weight, split into muscle meat, bone and organ.',
    about:
      "Raw feeding plans usually start from a percentage of the dog's body weight, commonly 2 to 3 percent a day for an adult, more for puppies and active dogs and less for dogs that gain weight easily. A popular model divides the food into about 80 percent muscle meat, 10 percent edible bone and 10 percent organ, half of it liver. Enter the weight, the daily percentage and the shares, and the page returns grams a day for each part and the weekly total to shop for. Raw diets carry food-safety risks and need balanced recipes, so discuss the plan with a vet.",
    inputs: [
      field('kg', "Dog's weight (kg)", 20, 0.5, 100),
      field('pct', 'Daily food (% of body weight)', 2.5, 0.5, 10),
      field('meat', 'Muscle meat (%)', 80, 0, 100),
      field('bone', 'Edible bone (%)', 10, 0, 100),
      field('organ', 'Organ (%)', 10, 0, 100),
    ],
    outputs: [
      { name: 'day', label: 'Food per day', format: 'text', highlight: true },
      { name: 'meatg', label: 'Muscle meat', format: 'text' },
      { name: 'boneg', label: 'Bone', format: 'text' },
      { name: 'organg', label: 'Organ', format: 'text' },
      { name: 'week', label: 'Per week', format: 'text' },
    ],
    calculate: (i) => {
      const shares = toD(i.meat).plus(toD(i.bone)).plus(toD(i.organ));
      if (!shares.eq(100)) return { day: `The shares add up to ${fmtNumber(shares, 1)}%, not 100%`, meatg: '-', boneg: '-', organg: '-', week: '-' };
      const day = toD(i.kg).mul(toD(i.pct)).div(100).mul(1000);
      const part = (p: unknown) => `${fmtNumber(day.mul(toD(p)).div(100), 1)} g`;
      return {
        day: `${fmtNumber(day, 0)} g`,
        meatg: part(i.meat),
        boneg: part(i.bone),
        organg: part(i.organ),
        week: `${fmtNumber(day.mul(7).div(1000), 2)} kg`,
      };
    },
    formulaDescription:
      'Daily food (g) = weight (kg) × % ÷ 100 × 1,000. Each part = daily food × its share ÷ 100. Weekly kg = daily grams × 7 ÷ 1,000. The shares must add to 100%.',
    workedExample: 'A 20 kg dog at 2.5% eats 500 g a day: 400 g muscle meat, 50 g bone and 50 g organ, which is 3.5 kg a week.',
    faq: [
      {
        question: 'Is the percentage fixed?',
        answer: 'No. Adjust it up or down to keep the dog at a healthy body condition. Puppies may need two to three times the adult share.',
      },
      {
        question: 'Is raw feeding safe?',
        answer:
          'It carries a risk of bacteria for dogs and people and of unbalanced nutrition. Handle raw meat hygienically and ask a veterinary nutritionist about the recipe.',
      },
      { question: 'What counts as organ?', answer: 'Liver and other secreting organs such as kidney. Many guides use half liver and half other organs.' },
    ],
    scenarios: mixed(
      'raw-dog-food-calculator',
      8,
      (r) => ({ kg: Math.round(r(3, 55)), pct: r(1.5, 4), meat: 80, bone: 10, organ: 10 }),
      (v) => `${v.kg} kg dog at ${v.pct}% a day`,
    ),
    introOutputs: ['day'],
    relatedSlugs: ['dog-food-calculator', 'dog-water-intake-calculator'],
    checks: [
      { inputs: {}, expect: { day: '500 g', meatg: '400 g', boneg: '50 g', organg: '50 g', week: '3.5 kg' } },
      { inputs: { kg: 8, pct: 3 }, expect: { day: '240 g', meatg: '192 g' } },
      { inputs: { organ: 5 }, expect: { day: 'The shares add up to 95%, not 100%' } },
    ],
  },
  {
    slug: 'cat-bmi-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Cat',
    title: 'Cat BMI Calculator: Feline Body Fat from Ribcage and Leg Length',
    h1: 'Cat BMI Calculator',
    metaDescription: "Estimate a cat's body fat percentage from the ribcage circumference and the lower hind leg length using the feline BMI formula.",
    about:
      "A weight in kilograms does not say whether a cat is lean or overweight, because frames differ. The feline body mass index, published by veterinary researchers, estimates the percentage of body fat from two measurements: the circumference of the ribcage at the ninth rib and the length of the lower hind leg from the knee to the heel, called the leg index measurement. Enter both in centimetres and the page returns the estimate. It is a screening figure with some error, and a vet's body condition score is more reliable. Do not put a cat on a diet without veterinary advice.",
    inputs: [field('rc', 'Ribcage circumference (cm)', 36, 15, 70), field('lim', 'Lower hind leg length, knee to heel (cm)', 17, 8, 30)],
    outputs: [{ name: 'fat', label: 'Estimated body fat', format: 'text', highlight: true }],
    calculate: (i) => {
      const lim = toD(i.lim);
      const fat = toD(i.rc).div('0.7062').minus(lim).div('0.9156').minus(lim);
      return { fat: fat.lte(0) ? 'Below 0%: check the measurements' : fmtPercent(fat, 1) };
    },
    formulaDescription: 'Body fat % = ((ribcage ÷ 0.7062) − leg index) ÷ 0.9156 − leg index, with both measurements in centimetres.',
    workedExample: 'Ribcage 36 cm and leg index 17 cm: 36 ÷ 0.7062 = 50.98; minus 17 = 33.98; ÷ 0.9156 = 37.11; minus 17 = 20.1% body fat.',
    faq: [
      {
        question: 'How do I measure the ribcage?',
        answer: 'With a soft tape around the chest at the ninth rib, just behind the front legs, while the cat stands and breathes out.',
      },
      {
        question: 'What is a healthy value?',
        answer:
          "Ranges used in studies are wide. A vet's body condition score on a 9-point scale is the practical standard, so use this figure only as a prompt to ask.",
      },
      { question: 'Why not just weigh the cat?', answer: 'Weight alone ignores frame size and muscle. Two cats of 5 kg can have very different fat levels.' },
    ],
    scenarios: mixed(
      'cat-bmi-calculator',
      8,
      (r) => ({ rc: r(28, 50), lim: r(13, 21) }),
      (v) => `ribcage ${v.rc} cm, leg ${v.lim} cm`,
    ),
    introOutputs: ['fat'],
    relatedSlugs: ['cat-calorie-calculator', 'cat-age-calculator'],
    checks: [
      { inputs: {}, expect: { fat: '20.1%' } },
      { inputs: { rc: 40, lim: 19 }, expect: { fat: '22.1%' } },
      { inputs: { rc: 30, lim: 15 }, expect: { fat: '15.0%' } },
      { inputs: { rc: 15, lim: 30 }, expect: { fat: 'Below 0%: check the measurements' } },
    ],
  },
  {
    slug: 'how-big-will-my-cat-get-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Cat',
    title: 'How Big Will My Cat Get? Adult Weight Estimate from a Kitten',
    h1: 'How Big Will My Cat Get Calculator',
    metaDescription: "Estimate a kitten's adult weight from its weight at 16 weeks or at 6 months, with a plausible range in kilograms and pounds.",
    about:
      'Kittens grow fast and then slow down, so a weight taken at a known age can be scaled to an adult weight. Two rules of thumb are widely quoted. A kitten at sixteen weeks is usually about half of its final weight, so it will roughly double. A kitten at six months is about three quarters grown. Choose which age you weighed at, enter the weight in kilograms, and the page returns an estimate and a range of ten percent either way, in kilograms and pounds. Breed matters a great deal: large breeds keep growing for up to four years, so treat this as a rough guide.',
    inputs: [
      field('kg', "Kitten's weight (kg)", 2, 0.2, 10),
      select('age', 'Weighed at', 'w16', [
        ['w16', '16 weeks (adult is about double)'],
        ['m6', '6 months (about 75% grown)'],
      ]),
    ],
    outputs: [
      { name: 'adult', label: 'Estimated adult weight', format: 'text', highlight: true },
      { name: 'range', label: 'Plausible range', format: 'text' },
      { name: 'lb', label: 'In pounds', format: 'text' },
    ],
    calculate: (i) => {
      const adult = String(i.age) === 'm6' ? toD(i.kg).div('0.75') : toD(i.kg).mul(2);
      return {
        adult: `${fmtNumber(adult, 2)} kg`,
        range: `${fmtNumber(adult.mul('0.9'), 2)} to ${fmtNumber(adult.mul('1.1'), 2)} kg`,
        lb: `${fmtNumber(adult.mul(LB_PER_KG), 1)} lb`,
      };
    },
    formulaDescription:
      'Weighed at 16 weeks: adult ≈ weight × 2. Weighed at 6 months: adult ≈ weight ÷ 0.75. Range = estimate × 0.9 to × 1.1. Pounds = kg × 2.2046.',
    workedExample: 'A kitten of 2 kg at 16 weeks is about 4 kg when grown, in a range of 3.6 to 4.4 kg, or 8.8 lb. One of 3 kg at 6 months is 3 ÷ 0.75 = 4 kg.',
    faq: [
      {
        question: 'Do all breeds follow the rule?',
        answer: 'No. Maine coons and some other large breeds keep growing to three or four years and can end up much heavier than the rule suggests.',
      },
      { question: 'Does neutering change it?', answer: 'Neutered cats tend to gain weight more easily, so watch food portions after the operation.' },
      {
        question: 'What is a healthy adult weight?',
        answer: "It depends on frame size. A vet can score body condition and say whether your cat's weight is right for it.",
      },
    ],
    scenarios: varied(
      'how-big-will-my-cat-get-calculator',
      8,
      [{ name: 'kg', lo: 0.8, hi: 4.5, step: 0.1 }],
      [{ name: 'age', options: ['w16', 'm6'] }],
      (v) => `${v.kg} kg at ${v.age}`,
    ),
    introOutputs: ['adult'],
    relatedSlugs: ['cat-age-calculator', 'cat-calorie-calculator'],
    checks: [
      { inputs: {}, expect: { adult: '4 kg', range: '3.6 to 4.4 kg', lb: '8.8 lb' } },
      { inputs: { kg: 3, age: 'm6' }, expect: { adult: '4 kg' } },
      { inputs: { kg: 1.5 }, expect: { adult: '3 kg', lb: '6.6 lb' } },
    ],
  },
  {
    slug: 'bird-age-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Other animals',
    title: 'Bird Age Calculator: Pet Bird Years to Human Years',
    h1: 'Bird Age Calculator',
    metaDescription: "Convert a pet bird's age to human years from the typical lifespan of its species, and see how much of its life has passed.",
    about:
      "Pet birds range from canaries that live about ten years to macaws that may reach fifty-five or more, so a single conversion would mislead. This page scales by species. It divides the bird's age by the typical captive lifespan to find how far through life the bird is, then applies that share to an eighty-year human life. A four-year-old budgerigar, with a lifespan near eight, is halfway and compares with a human of forty, while a four-year-old macaw is still very young. The lifespans are typical figures and a well-cared-for bird can live longer. Feather condition, beak growth, droppings, appetite and singing all change with age, so a vet who weighs the bird each year can spot trouble earlier than any conversion.",
    inputs: [
      select(
        'species',
        'Species (typical lifespan)',
        'budgie',
        Object.entries(BIRDS).map(([k, v]): [string, string] => [k, v.label]),
      ),
      field('age', 'Age of your bird (years)', 4, 0, 80),
      field('human', 'Human lifespan to scale to (years)', 80, 50, 120),
    ],
    outputs: [
      { name: 'human', label: 'Human-equivalent age', format: 'text', highlight: true },
      { name: 'share', label: 'Share of the typical lifespan', format: 'text' },
    ],
    calculate: (i) => {
      const life = new D((BIRDS[String(i.species)] ?? BIRDS.budgie).years);
      return { human: `${fmtNumber(humanEquivalent(toD(i.age), life, toD(i.human)), 1)} years`, share: fmtPercent(toD(i.age).div(life).mul(100), 0) };
    },
    formulaDescription: 'Human equivalent = bird age ÷ typical species lifespan × human lifespan. Share = bird age ÷ lifespan × 100.',
    workedExample:
      'A 4-year-old budgerigar (typical lifespan 8 years): 4 ÷ 8 × 80 = 40 human years, half of its life. A 10-year-old cockatiel (20) is also 40; an 11-year-old macaw (55) is 16.',
    faq: [
      {
        question: 'How long do pet birds live?',
        answer: 'Small birds such as budgerigars live 5 to 10 years, cockatiels 15 to 20 and large parrots 40 to 60 or more with good care.',
      },
      {
        question: 'Why do larger birds live longer?',
        answer: 'In general, larger animals have slower metabolisms, and parrots are unusually long-lived for their size.',
      },
      {
        question: 'Can I use another lifespan?',
        answer: 'The species are typical averages. If your vet gives a different figure for your bird, divide by that.',
      },
    ],
    scenarios: varied(
      'bird-age-calculator',
      8,
      [{ name: 'age', lo: 0.5, hi: 40, step: 0.5 }],
      [{ name: 'species', options: ['budgie', 'canary', 'lovebird', 'cockatiel', 'conure', 'grey', 'macaw'] }],
      (v) => `a ${v.species} aged ${v.age}`,
    ).map((s) => ({ ...s, inputs: { ...s.inputs, human: 80 } })),
    introOutputs: ['share'],
    relatedSlugs: ['hamster-age-calculator', 'guinea-pig-years-to-human-years-calculator'],
    checks: [
      { inputs: {}, expect: { human: '40 years', share: '50%' } },
      { inputs: { species: 'cockatiel', age: 10 }, expect: { human: '40 years' } },
      { inputs: { species: 'macaw', age: 11 }, expect: { human: '16 years', share: '20%' } },
    ],
  },
  {
    slug: 'guinea-pig-years-to-human-years-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Other animals',
    title: 'Guinea Pig Years to Human Years Calculator',
    h1: 'Guinea Pig Years to Human Years Calculator',
    metaDescription: "Convert a guinea pig's age in years and months to human years from a typical lifespan of five to seven years.",
    about:
      'Guinea pigs, also called cavies, usually live five to seven years in good care, so each year of a guinea pig is roughly twelve or thirteen human years. They mature quickly, reaching adulthood at about three to four months, and are considered seniors from around four years. Enter the age in years and months and the lifespan you want to use, and the page scales the age to a human lifespan of eighty years and shows the stage. It is a proportional rule of thumb, which makes the age easy to picture without suggesting an exact equivalent. Cavies need hay, vitamin C from vegetables or pellets, a roomy pen and a companion, and owners who see wheeking, popcorning or slower movement can adjust the diet as the animal grows old.',
    inputs: [intField('years', 'Years', 3, 0, 15), intField('months', 'Months', 0, 0, 11), field('life', 'Typical lifespan (years)', 6, 4, 10)],
    outputs: [
      { name: 'human', label: 'Human-equivalent age', format: 'text', highlight: true },
      { name: 'stage', label: 'Life stage', format: 'text' },
    ],
    calculate: (i) => {
      const age = toD(i.years).plus(toD(i.months).div(12));
      const stage = age.lt('0.33') ? 'Young' : age.lt(4) ? 'Adult' : 'Senior';
      return { human: `${fmtNumber(humanEquivalent(age, toD(i.life), new D(80)), 1)} years`, stage };
    },
    formulaDescription: 'Human equivalent = age in years ÷ typical lifespan × 80. Stages: young under about 4 months, adult up to 4 years, senior beyond.',
    workedExample: 'At 18 months (1.5 years) with a lifespan of 6 years: 1.5 ÷ 6 × 80 = 20 human years. At 3 years it is 40, and at 6 years it is 80.',
    faq: [
      { question: 'How long do guinea pigs live?', answer: 'Five to seven years is typical, and some reach eight with excellent care.' },
      { question: 'When is a guinea pig a senior?', answer: 'From about four years. Seniors benefit from check-ups and softer food.' },
      {
        question: 'Is the conversion scientific?',
        answer: 'It is proportional, matching the share of life used. Developmental stages in the first months are faster than the line suggests.',
      },
    ],
    scenarios: mixed(
      'guinea-pig-years-to-human-years-calculator',
      12,
      (r) => ({ years: Math.round(r(0, 7)), months: Math.round(r(0, 11)), life: Math.round(r(5, 8)) }),
      (v) => `${v.years} years and ${v.months} months, lifespan ${v.life}`,
    ),
    introOutputs: ['human', 'stage'],
    relatedSlugs: ['hamster-age-calculator', 'rabbit-cage-size-calculator'],
    checks: [
      { inputs: {}, expect: { human: '40 years', stage: 'Adult' } },
      { inputs: { years: 1, months: 6 }, expect: { human: '20 years' } },
      { inputs: { years: 6 }, expect: { human: '80 years', stage: 'Senior' } },
    ],
  },
  {
    slug: 'hamster-age-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Other animals',
    title: 'Hamster Age Calculator: Hamster Months to Human Years',
    h1: 'Hamster Age Calculator',
    metaDescription: "Convert a hamster's age in months to human years using the typical lifespan of its species, and see how far through life it is.",
    about:
      'A hamster lives only two to three years, so every month counts. Syrian and Chinese hamsters are usually good for about two and a half years, dwarf hamsters around two and Roborovski hamsters up to three. Choose the species, enter the age in months and the page works out how much of the typical lifespan has passed, then applies that share to an eighty-year human life. A six-month-old Syrian is about sixteen in human terms, an eighteen-month-old is near forty-eight. Because the figures are averages, a healthy hamster can easily live a few months longer. Wheel running, burrowing, cheek pouches, gnawing on wood and a nocturnal schedule are the habits to protect, since an older hamster slows down, sleeps more and may need softer food and a lower bedding pile.',
    inputs: [
      select(
        'species',
        'Species (typical lifespan)',
        'syrian',
        Object.entries(HAMSTERS).map(([k, v]): [string, string] => [k, v.label]),
      ),
      field('months', 'Age (months)', 12, 0, 60),
    ],
    outputs: [
      { name: 'human', label: 'Human-equivalent age', format: 'text', highlight: true },
      { name: 'share', label: 'Share of the typical lifespan', format: 'text' },
      { name: 'left', label: 'Typical months left', format: 'text' },
    ],
    calculate: (i) => {
      const months = new D((HAMSTERS[String(i.species)] ?? HAMSTERS.syrian).years).mul(12);
      const age = toD(i.months);
      const left = months.minus(age);
      return {
        human: `${fmtNumber(humanEquivalent(age, months, new D(80)), 1)} years`,
        share: fmtPercent(age.div(months).mul(100), 0),
        left: left.gt(0) ? fmtNumber(left, 1) : '0',
      };
    },
    formulaDescription:
      'Lifespan in months = typical years × 12. Human equivalent = age in months ÷ lifespan in months × 80. Months left = lifespan − age, never below 0.',
    workedExample:
      'A 12-month-old Syrian (typical lifespan 30 months): 12 ÷ 30 × 80 = 32 human years and 40% of its life, with 18 months to go. An 18-month dwarf hamster (24 months) is 60.',
    faq: [
      { question: 'How long do hamsters live?', answer: 'Syrians typically live 2 to 3 years, dwarfs about 1.5 to 2 and Roborovskis up to 3.' },
      {
        question: "How can I tell a hamster's age?",
        answer: 'It is hard. Teeth, coat and size give only a rough idea, so the date it was born or bought is the best guide.',
      },
      { question: 'Can hamsters live longer?', answer: 'Some do, with a good diet, a large cage and a clean, calm home. The figures are averages.' },
    ],
    scenarios: varied(
      'hamster-age-calculator',
      8,
      [{ name: 'months', lo: 1, hi: 34 }],
      [{ name: 'species', options: ['syrian', 'dwarf', 'roborovski', 'chinese'] }],
      (v) => `a ${v.species} hamster of ${v.months} months`,
    ),
    introOutputs: ['left'],
    relatedSlugs: ['guinea-pig-years-to-human-years-calculator', 'bird-age-calculator'],
    checks: [
      { inputs: {}, expect: { human: '32 years', share: '40%', left: '18' } },
      { inputs: { species: 'dwarf', months: 18 }, expect: { human: '60 years' } },
      { inputs: { species: 'roborovski', months: 6 }, expect: { human: '13.3 years' } },
    ],
  },
  {
    slug: 'rabbit-cage-size-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Other animals',
    title: 'Rabbit Cage Size Calculator: Minimum Pen Dimensions',
    h1: 'Rabbit Cage Size Calculator',
    metaDescription: 'Find the minimum floor area and pen dimensions for one or more rabbits from the length of a rabbit stretched out.',
    about:
      'Rabbits need room to hop, stretch and stand on their hind legs, and a cage that is too small harms their health and temperament. A common welfare guideline is that the pen should be at least four times as long as a rabbit stretched out, twice as wide and tall enough for it to stand upright. Measure your rabbit from nose to the base of its tail while it is stretched out and enter the length and the number of rabbits. The page returns the minimum floor area, length, width and height, and adds half as much floor again for each extra rabbit. A hutch should always be attached to an exercise run.',
    inputs: [field('len', 'Stretched-out body length (cm)', 50, 15, 90), intField('n', 'Number of rabbits', 1, 1, 8)],
    outputs: [
      { name: 'area', label: 'Minimum floor area', format: 'text', highlight: true },
      { name: 'length', label: 'Pen length', format: 'text' },
      { name: 'width', label: 'Pen width', format: 'text' },
      { name: 'height', label: 'Minimum height', format: 'text' },
    ],
    calculate: (i) => {
      const len = toD(i.len);
      const width = len.mul(2);
      const area = len
        .mul(4)
        .mul(width)
        .mul(new D(1).plus(toD(i.n).minus(1).mul('0.5')));
      return {
        area: `${fmtNumber(area.div(10000), 2)} m²`,
        length: `${fmtNumber(area.div(width), 0)} cm`,
        width: `${fmtNumber(width, 0)} cm`,
        height: `${fmtNumber(len.mul('1.5'), 0)} cm`,
      };
    },
    formulaDescription:
      'Length = 4 × stretched body length; width = 2 × body length; height = 1.5 × body length. Area = length × width × (1 + 0.5 per extra rabbit). The pen length grows to match the area.',
    workedExample:
      'A rabbit that stretches to 50 cm needs a pen at least 200 cm × 100 cm × 75 cm, a floor of 2 m². Two rabbits need 3 m², which is a 300 cm pen of the same width.',
    faq: [
      {
        question: 'Is this enough for all day?',
        answer: 'It is a minimum for a hutch or pen. Rabbits also need several hours a day in a larger run or a rabbit-proofed room.',
      },
      {
        question: 'Why add half for a second rabbit?',
        answer: 'A pair shares space and does not need double the floor, but they still need room to move apart when they want to.',
      },
      {
        question: 'Can a rabbit live in a small cage?',
        answer: 'Pet rabbit cages sold in shops are usually too small. Welfare groups advise much larger enclosures.',
      },
    ],
    scenarios: mixed(
      'rabbit-cage-size-calculator',
      8,
      (r) => ({ len: Math.round(r(22, 75)), n: Math.round(r(1, 4)) }),
      (v) => `rabbit of ${v.len} cm, ${v.n} in the pen`,
    ),
    introOutputs: ['area'],
    relatedSlugs: ['guinea-pig-years-to-human-years-calculator', 'dog-crate-size-calculator'],
    checks: [
      { inputs: {}, expect: { area: '2 m²', length: '200 cm', width: '100 cm', height: '75 cm' } },
      { inputs: { n: 2 }, expect: { area: '3 m²', length: '300 cm', width: '100 cm' } },
      { inputs: { len: 30, n: 1 }, expect: { area: '0.72 m²', height: '45 cm' } },
    ],
  },
  {
    slug: 'livestock-fence-cost-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Livestock',
    title: 'Livestock Fence Cost Calculator: Posts, Wire and Gates',
    h1: 'Livestock Fence Cost Calculator',
    metaDescription: 'Estimate the cost of fencing a rectangular paddock from its size, post spacing, strands of wire, gates and a contingency.',
    about:
      'Fencing a paddock is mostly counting: the perimeter fixes how many metres of wire or rail you need, and the post spacing fixes the number of posts. Enter the length and width of the paddock in metres, the spacing of posts, how many strands of wire the fence will have and the prices you have been quoted for posts, wire per metre and gates. The page works out the perimeter, the number of posts, the cost of materials and a total with a contingency allowance for waste and extras. Labour, delivery and tools are not included, so add them from your own quotes.',
    inputs: [
      field('length', 'Paddock length (m)', 100, 1, 10000),
      field('width', 'Paddock width (m)', 50, 1, 10000),
      field('spacing', 'Post spacing (m)', 3, 0.5, 20),
      intField('strands', 'Strands of wire or rails', 4, 1, 12),
      field('post', 'Price per post ($)', 9, 0, 1000),
      field('wire', 'Wire or rail price per metre ($)', 0.35, 0, 100),
      intField('gates', 'Number of gates', 1, 0, 20),
      field('gate', 'Price per gate ($)', 150, 0, 10000),
      field('extra', 'Contingency (%)', 10, 0, 100),
    ],
    outputs: [
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
      { name: 'posts', label: 'Posts', format: 'text' },
      { name: 'materials', label: 'Materials before contingency', format: 'text' },
      { name: 'total', label: 'Total with contingency', format: 'text', highlight: true },
    ],
    calculate: (i) => {
      const perimeter = toD(i.length).plus(toD(i.width)).mul(2);
      const posts = perimeter.div(toD(i.spacing)).ceil();
      const materials = perimeter
        .mul(toD(i.strands))
        .mul(toD(i.wire))
        .plus(posts.mul(toD(i.post)))
        .plus(toD(i.gates).mul(toD(i.gate)));
      return {
        perimeter: `${fmtNumber(perimeter, 1)} m`,
        posts: fmtNumber(posts, 0),
        materials: fmtCurrency(materials),
        total: fmtCurrency(materials.mul(new D(1).plus(toD(i.extra).div(100)))),
      };
    },
    formulaDescription:
      'Perimeter = 2 × (length + width). Posts = perimeter ÷ spacing, rounded up. Materials = perimeter × strands × wire price + posts × post price + gates × gate price. Total = materials × (1 + contingency%).',
    workedExample:
      'A 100 m × 50 m paddock has a 300 m perimeter and needs 100 posts at 3 m. Wire: 300 × 4 × $0.35 = $420; posts $900; one gate $150: $1,470, or $1,617 with 10% contingency.',
    faq: [
      {
        question: 'Does the count include corner or brace posts?',
        answer: 'Not separately. Add extra posts for corners and gates from your own design, or raise the contingency.',
      },
      {
        question: 'How many strands do I need?',
        answer: 'It depends on the animal: cattle and horses often use 3 to 5, sheep and goats need more strands closer together or mesh.',
      },
      { question: 'What is not included?', answer: 'Labour, machine hire, delivery, tensioners, staples, insulators and any energiser for electric fencing.' },
    ],
    scenarios: mixed(
      'livestock-fence-cost-calculator',
      8,
      (r) => ({
        length: Math.round(r(30, 600)),
        width: Math.round(r(20, 400)),
        spacing: r(2, 6),
        strands: Math.round(r(2, 7)),
        post: r(4, 20),
        wire: r(0.1, 1.2),
        gates: Math.round(r(0, 3)),
        gate: Math.round(r(80, 400)),
        extra: Math.round(r(0, 20)),
      }),
      (v) => `${v.length} × ${v.width} m, posts every ${v.spacing} m, ${v.strands} strands, ${v.gates} gates`,
    ),
    introOutputs: ['total'],
    relatedSlugs: ['cattle-per-acre-calculator', 'acres-per-hour-calculator'],
    checks: [
      { inputs: {}, expect: { perimeter: '300 m', posts: '100', materials: '$1,470.00', total: '$1,617.00' } },
      {
        inputs: { length: 60, width: 40, spacing: 2.5, strands: 3, post: 12, wire: 0.5, gates: 2, gate: 200, extra: 0 },
        expect: { posts: '80', total: '$1,660.00' },
      },
      { inputs: { spacing: 7 }, expect: { posts: '43' } },
    ],
  },
  {
    slug: 'lawn-mowing-cost-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Lawn and garden',
    title: 'Lawn Mowing Cost Calculator: Cost per Visit and per Season',
    h1: 'Lawn Mowing Cost Calculator',
    metaDescription: 'Estimate the time and cost of mowing a lawn per visit and per season from the area, mowing speed, hourly rate and edging.',
    about:
      'Whether you hire a service or value your own time, the cost of mowing comes down to how long the lawn takes and what an hour is worth. Enter the lawn area in square metres, how many square metres you can mow in an hour with your mower, the hourly rate, a percentage for trimming and edging and the number of visits in the season. The page returns the time for one visit, the cost of one visit and the cost for the whole season. Speed depends on the width of the mower, obstacles and the slope, so time one mow with a stopwatch to get your own number.',
    inputs: [
      field('area', 'Lawn area (m²)', 500, 10, 1e6),
      field('speed', 'Mowing speed (m² per hour)', 700, 50, 20000),
      field('rate', 'Rate per hour ($)', 40, 0, 1000),
      field('edge', 'Trimming and edging extra (%)', 15, 0, 200),
      intField('visits', 'Visits per season', 28, 1, 60),
    ],
    outputs: [
      { name: 'time', label: 'Time per visit', format: 'text' },
      { name: 'visit', label: 'Cost per visit', format: 'text', highlight: true },
      { name: 'season', label: 'Cost per season', format: 'text' },
    ],
    calculate: (i) => {
      const hours = toD(i.area).div(toD(i.speed));
      const visit = hours.mul(toD(i.rate)).mul(new D(1).plus(toD(i.edge).div(100)));
      return { time: `${fmtNumber(hours.mul(60), 0)} min`, visit: fmtCurrency(visit), season: fmtCurrency(visit.mul(toD(i.visits))) };
    },
    formulaDescription: 'Hours = area ÷ speed. Cost per visit = hours × rate × (1 + edging%). Season = cost per visit × visits.',
    workedExample:
      '500 m² at 700 m² an hour takes 0.714 hours, 43 minutes. At $40 an hour plus 15% for edging one visit costs $32.86, and 28 visits cost $920.',
    faq: [
      {
        question: 'How do I find my mowing speed?',
        answer: 'Time one mow and divide the area by the hours. A walk-behind mower manages about 500 to 1,000 m² an hour, a ride-on 2,000 to 4,000.',
      },
      { question: 'How many visits are normal?', answer: 'Weekly in the growing season is common, so 25 to 35 visits a year in a temperate climate.' },
      { question: 'What is not included?', answer: 'Fuel, equipment wear, disposal of clippings and any travel charge.' },
    ],
    scenarios: mixed(
      'lawn-mowing-cost-calculator',
      8,
      (r) => ({
        area: Math.round(r(120, 4000)),
        speed: Math.round(r(300, 3500)),
        rate: Math.round(r(20, 90)),
        edge: Math.round(r(0, 30)),
        visits: Math.round(r(12, 40)),
      }),
      (v) => `${v.area} m² at ${v.speed} m² an hour, rate ${v.rate}, edging ${v.edge}%, ${v.visits} visits`,
    ),
    introOutputs: ['visit'],
    relatedSlugs: ['sod-calculator', 'grass-seed-calculator'],
    checks: [
      { inputs: {}, expect: { time: '43 min', visit: '$32.86', season: '$920.00' } },
      { inputs: { area: 1000, speed: 500, rate: 50, edge: 0, visits: 20 }, expect: { time: '120 min', visit: '$100.00', season: '$2,000.00' } },
      { inputs: { rate: 0 }, expect: { visit: '$0.00' } },
    ],
  },
  {
    slug: 'tree-value-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Trees and forestry',
    title: 'Tree Value Calculator: Trunk Formula Method Estimate',
    h1: 'Tree Value Calculator',
    metaDescription:
      "Estimate a landscape tree's value with the trunk formula method from its diameter, a unit cost and the species, condition and location ratings.",
    about:
      "Arborists appraise a landscape tree with the trunk formula method. The cross-sectional area of the trunk measures the size of the tree. It is multiplied by a unit cost per square inch, then reduced by three percentages: the species rating for how suited and valuable the species is, the condition rating for health and structure, and the location rating for how well it suits the site. Enter the trunk diameter at breast height in inches, the unit cost from your region's guide and the three ratings. The result is an educational estimate, not a certified appraisal, which needs a qualified arborist.",
    inputs: [
      field('dbh', 'Trunk diameter at breast height (inches)', 12, 1, 120),
      field('unit', 'Unit cost per square inch ($)', 60, 1, 1000),
      field('species', 'Species rating (%)', 80, 0, 100),
      field('condition', 'Condition rating (%)', 70, 0, 100),
      field('site', 'Location rating (%)', 80, 0, 100),
    ],
    outputs: [
      { name: 'area', label: 'Trunk cross-section', format: 'text' },
      { name: 'basic', label: 'Basic value', format: 'text' },
      { name: 'value', label: 'Appraised value', format: 'text', highlight: true },
    ],
    calculate: (i) => {
      const area = PI.div(4).mul(toD(i.dbh).pow(2));
      const basic = area.mul(toD(i.unit));
      return {
        area: `${fmtNumber(area, 1)} in²`,
        basic: fmtCurrency(basic),
        value: fmtCurrency(basic.mul(toD(i.species)).mul(toD(i.condition)).mul(toD(i.site)).div(1000000)),
      };
    },
    formulaDescription:
      'Area = π ÷ 4 × diameter². Basic value = area × unit cost. Value = basic value × species% × condition% × location%, each as a share of 100.',
    workedExample:
      'A 12 inch trunk has an area of 113.1 in². At $60 per square inch the basic value is $6,785.84. With species 80%, condition 70% and location 80% it comes to $3,040.06.',
    faq: [
      {
        question: 'Where do the ratings come from?',
        answer: 'Regional tree appraisal guides publish species ratings; condition and location ratings are judged on the site by an arborist.',
      },
      {
        question: 'Is it legal evidence of value?',
        answer: 'No. Insurers and courts expect a formal appraisal from a qualified arborist. This is for planning and learning.',
      },
      {
        question: 'Why is the diameter squared?',
        answer: 'Value follows the area of the trunk, which grows with the square of the diameter, so big trees are worth far more than small ones.',
      },
    ],
    scenarios: mixed(
      'tree-value-calculator',
      8,
      (r) => ({
        dbh: Math.round(r(3, 44)),
        unit: Math.round(r(30, 110)),
        species: Math.round(r(40, 100)),
        condition: Math.round(r(30, 100)),
        site: Math.round(r(40, 100)),
      }),
      (v) => `${v.dbh} inch trunk, unit cost ${v.unit}, ratings ${v.species}, ${v.condition} and ${v.site}`,
    ),
    introOutputs: ['value'],
    relatedSlugs: ['tree-diameter-calculator', 'tree-age-calculator'],
    checks: [
      { inputs: {}, expect: { area: '113.1 in²', basic: '$6,785.84', value: '$3,040.06' } },
      { inputs: { dbh: 20, unit: 50, species: 100, condition: 100, site: 100 }, expect: { area: '314.2 in²', value: '$15,707.96' } },
      { inputs: { condition: 0 }, expect: { value: '$0.00' } },
    ],
  },
  {
    slug: 'pet-sitter-rates-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Pets',
    title: 'Pet Sitter Rates Calculator: Total Cost of a Stay',
    h1: 'Pet Sitter Rates Calculator',
    metaDescription: 'Add up nightly boarding, extra pets, holiday surcharges and drop-in visits to find the total cost of a pet sitter for a trip.',
    about:
      'Pet sitters price in a mix of nightly stays and short visits, with extras for additional animals and for holidays when demand is high. To budget a trip, enter the number of nights, the nightly rate, how many extra pets there are and what the sitter charges for each, how many of the nights fall on a holiday and the surcharge percentage, and the number of drop-in visits with their price. The page adds them up into a total and the average cost per night. Rates differ widely by city and service, so use the figures quoted by your own sitter.',
    inputs: [
      intField('nights', 'Nights', 7, 0, 90),
      field('rate', 'Nightly rate ($)', 50, 0, 1000),
      intField('pets', 'Extra pets', 1, 0, 10),
      field('petfee', 'Extra charge per extra pet per night ($)', 10, 0, 500),
      intField('holiday', 'Holiday nights', 2, 0, 90),
      field('surcharge', 'Holiday surcharge (%)', 25, 0, 200),
      intField('visits', 'Drop-in visits', 0, 0, 200),
      field('visitRate', 'Price per visit ($)', 20, 0, 500),
    ],
    outputs: [
      { name: 'total', label: 'Total', format: 'text', highlight: true },
      { name: 'stay', label: 'Nightly stays including extra pets', format: 'text' },
      { name: 'holidayCost', label: 'Holiday surcharge', format: 'text' },
      { name: 'avg', label: 'Average per night', format: 'text' },
    ],
    calculate: (i) => {
      const stay = toD(i.nights).mul(toD(i.rate).plus(toD(i.pets).mul(toD(i.petfee))));
      const holiday = toD(i.holiday).mul(toD(i.rate)).mul(toD(i.surcharge)).div(100);
      const total = stay.plus(holiday).plus(toD(i.visits).mul(toD(i.visitRate)));
      return {
        total: fmtCurrency(total),
        stay: fmtCurrency(stay),
        holidayCost: fmtCurrency(holiday),
        avg: toD(i.nights).isZero() ? '-' : fmtCurrency(total.div(toD(i.nights))),
      };
    },
    formulaDescription:
      'Stay = nights × (rate + extra pets × fee). Holiday surcharge = holiday nights × rate × surcharge%. Total = stay + surcharge + visits × visit price.',
    workedExample:
      '7 nights at $50 with one extra pet at $10 is 7 × $60 = $420. Two holiday nights add 2 × $50 × 25% = $25, so the total is $445, an average of $63.57 a night.',
    faq: [
      {
        question: 'Is the holiday surcharge on the whole stay?',
        answer: 'Usually only on the holiday nights. This page applies it to the nightly rate, not the extra pet fee.',
      },
      {
        question: 'What else might a sitter charge?',
        answer: 'Medication, grooming, a cleaning fee, a deposit or a travel fee, which you can fold into the extra charge.',
      },
      { question: 'Should I tip?', answer: 'It is optional and depends on the service. Many owners add a tip for holidays or difficult care.' },
    ],
    scenarios: mixed(
      'pet-sitter-rates-calculator',
      8,
      (r) => ({
        nights: Math.round(r(1, 21)),
        rate: Math.round(r(25, 95)),
        pets: Math.round(r(0, 3)),
        petfee: Math.round(r(5, 25)),
        holiday: Math.round(r(0, 4)),
        surcharge: Math.round(r(10, 60)),
        visits: Math.round(r(0, 14)),
        visitRate: Math.round(r(12, 40)),
      }),
      (v) =>
        `${v.nights} nights at ${v.rate} with ${v.pets} extra pets at ${v.petfee}, ${v.holiday} holiday nights at ${v.surcharge}%, ${v.visits} visits at ${v.visitRate}`,
    ),
    introOutputs: ['total'],
    relatedSlugs: ['cost-of-owning-a-dog-calculator', 'dog-food-calculator'],
    checks: [
      { inputs: {}, expect: { total: '$445.00', stay: '$420.00', holidayCost: '$25.00', avg: '$63.57' } },
      { inputs: { nights: 3, rate: 45, pets: 2, petfee: 18, holiday: 0, visits: 4, visitRate: 25 }, expect: { total: '$343.00' } },
      { inputs: { nights: 0, holiday: 0 }, expect: { total: '$0.00', avg: '-' } },
    ],
  },
  {
    slug: 'wastewater-flow-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Wastewater',
    title: 'Wastewater Flow and Load Calculator for a Population',
    h1: 'Wastewater Flow Calculator',
    metaDescription:
      'Estimate the daily wastewater flow, the organic load and the BOD concentration for a population, and the population equivalent of a load.',
    about:
      'Designing or checking a treatment plant starts with how much wastewater arrives and how strong it is. Each person produces a flow of water, often 100 to 250 litres a day, and an organic load measured as biochemical oxygen demand, commonly about 60 grams per person per day. Enter the population, the litres per person per day and the BOD per person, and the page returns the average daily flow in cubic metres, the BOD load in kilograms per day and the concentration of the sewage in milligrams per litre. A population equivalent is the load divided by the 60 grams one person is assumed to produce.',
    inputs: [
      intField('pop', 'Population', 5000, 1, 100000000),
      field('lpcd', 'Flow (litres per person per day)', 150, 20, 1000),
      field('bod', 'BOD (grams per person per day)', 60, 10, 200),
    ],
    outputs: [
      { name: 'flow', label: 'Average flow', format: 'text', highlight: true },
      { name: 'load', label: 'BOD load', format: 'text' },
      { name: 'conc', label: 'BOD concentration', format: 'text' },
      { name: 'pe', label: 'Population equivalent (at 60 g per person)', format: 'text' },
    ],
    calculate: (i) => {
      const pop = toD(i.pop);
      const flow = pop.mul(toD(i.lpcd)).div(1000);
      const load = pop.mul(toD(i.bod));
      return {
        flow: `${fmtNumber(flow, 1)} m³/day`,
        load: `${fmtNumber(load.div(1000), 1)} kg/day`,
        conc: `${fmtNumber(load.div(flow), 0)} mg/L`,
        pe: fmtNumber(load.div(60), 0),
      };
    },
    formulaDescription:
      'Flow (m³/day) = population × litres per person ÷ 1,000. Load (kg/day) = population × g BOD per person ÷ 1,000. Concentration (mg/L) = load in g ÷ flow in m³. Population equivalent = load in g ÷ 60.',
    workedExample:
      '5,000 people at 150 L and 60 g BOD each give 750 m³/day, 300 kg of BOD a day and a concentration of 60 ÷ 0.15 = 400 mg/L, a population equivalent of 5,000.',
    faq: [
      {
        question: 'Why does the concentration change with water use?',
        answer: 'The BOD load is the same, so people using more water give a weaker, more dilute sewage.',
      },
      { question: 'What is a population equivalent?', answer: 'It states an industrial or other load as the number of people who would produce the same BOD.' },
      {
        question: 'What about peak flows?',
        answer: 'Plants are designed for peaks of two to four times the average, plus storm water. This page gives the daily average.',
      },
    ],
    scenarios: mixed(
      'wastewater-flow-calculator',
      8,
      (r) => ({ pop: Math.round(r(200, 90000)), lpcd: Math.round(r(60, 380)), bod: Math.round(r(35, 90)) }),
      (v) => `${v.pop} people at ${v.lpcd} L and ${v.bod} g BOD each`,
    ),
    introOutputs: ['flow'],
    relatedSlugs: ['hydraulic-retention-time-calculator', 'mlvss-calculator'],
    checks: [
      { inputs: {}, expect: { flow: '750 m³/day', load: '300 kg/day', conc: '400 mg/L', pe: '5,000' } },
      { inputs: { pop: 12000, lpcd: 220, bod: 50 }, expect: { flow: '2,640 m³/day', load: '600 kg/day', conc: '227 mg/L', pe: '10,000' } },
      { inputs: { pop: 1 }, expect: { flow: '0.2 m³/day' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
