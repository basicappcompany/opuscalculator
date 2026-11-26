import { selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { currencySymbol, fmtCurrency, fmtFixed, fmtNumber, fmtPercent } from '../lib/format';
import { defineCalculator, mixed, type Spec } from '../lib/spec';
import { field, intField, varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 8 (ecology): footprints of food, plastic, paper, water, computing and travel, energy economics and
 * two population ideas. Every emission factor, price and efficiency is an input with a stated default and says
 * that it is a typical figure, never a hidden constant. Ecology shows no disclaimer. Money outputs use
 * fmtCurrency and write labels as `($)`. Tier 2 or 3, so none is live until the cohort gate opens.
 */

const DAYS = new D(365);
const select = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});

const kg = (x: Dec, dp = 2): string => `${fmtNumber(x, dp)} kg`;
/** A price per unit with four decimals, in the visitor's currency symbol. */
const small = (x: Dec): string => `${currencySymbol()}${fmtFixed(x, 4)}`;

/** Typical kg CO2e per kg of food as served from the farm gate to the retail shelf. Sources differ by a factor of two or more. */
const MEAT_FACTOR: Record<string, string> = { beef: '60', lamb: '24', pork: '7', chicken: '6', fish: '5', tofu: '3' };
const MEAT_OPTIONS: [string, string][] = [
  ['beef', 'Beef (60 kg CO2e per kg)'],
  ['lamb', 'Lamb (24)'],
  ['pork', 'Pork (7)'],
  ['chicken', 'Chicken (6)'],
  ['fish', 'Farmed fish (5)'],
  ['tofu', 'Tofu (3)'],
];

/** kg CO2e per day for a typical adult on each diet, from a widely cited 2014 study of diets in the UK. */
const DIET_KG: Record<string, string> = { highmeat: '7.19', mediummeat: '5.63', lowmeat: '4.67', fish: '3.91', vegetarian: '3.81', vegan: '2.89' };
const DIET_OPTIONS: [string, string][] = [
  ['highmeat', 'High meat eater (7.19 kg CO2e a day)'],
  ['mediummeat', 'Medium meat eater (5.63)'],
  ['lowmeat', 'Low meat eater (4.67)'],
  ['fish', 'Fish eater (3.91)'],
  ['vegetarian', 'Vegetarian (3.81)'],
  ['vegan', 'Vegan (2.89)'],
];

export const SPECS: Spec[] = [
  {
    slug: 'meat-footprint-calculator',
    category: 'ecology',
    tier: 2,
    subCluster: 'Eco footprint',
    title: 'Meat Carbon Footprint Calculator: CO2e per Serving and Year',
    h1: 'Meat Carbon Footprint Calculator',
    metaDescription:
      'Estimate the greenhouse gas emissions of the beef, lamb, pork, chicken or fish you eat, per serving and per year, from typical emission factors.',
    about:
      'Cattle and sheep belch methane and need a great deal of land, so a kilogram of beef carries many times the emissions of a kilogram of chicken, pork or tofu. Choose the food, the size of a serving in grams and how many servings you eat in a week, and the calculator multiplies the weight by a typical factor in kilograms of carbon dioxide equivalent per kilogram. The factors are round figures from lifecycle studies, and farms, countries and methods vary widely, so treat the result as an order of magnitude rather than a measurement.',
    inputs: [
      field('servings', 'Servings per week', 3, 0, 100),
      field('grams', 'Serving size (g)', 150, 10, 1000),
      select('food', 'Food', 'beef', MEAT_OPTIONS),
    ],
    outputs: [
      { name: 'serving', label: 'CO2e per serving', format: 'text' },
      { name: 'year', label: 'CO2e per year', format: 'text', highlight: true },
      { name: 'tonnes', label: 'In tonnes per year', format: 'text' },
    ],
    calculate: (i) => {
      const perServing = toD(i.grams)
        .div(1000)
        .mul(MEAT_FACTOR[String(i.food)] ?? '60');
      const year = perServing.mul(toD(i.servings)).mul(52);
      return { serving: kg(perServing), year: kg(year), tonnes: `${fmtNumber(year.div(1000), 3)} t` };
    },
    formulaDescription: 'CO2e per serving = grams ÷ 1,000 × factor (kg CO2e per kg of food). Per year = per serving × servings per week × 52.',
    workedExample: 'A 150 g serving of beef at 60 kg CO2e per kg is 0.15 × 60 = 9 kg. Three a week for 52 weeks is 1,404 kg, or 1.404 tonnes.',
    faq: [
      {
        question: 'Why is beef so much higher than chicken?',
        answer: 'Cattle emit methane as they digest and take far more feed and land per kilogram of meat, so the factor is roughly ten times that of poultry.',
      },
      {
        question: 'Are the factors exact?',
        answer: 'No. They are rounded typical values and published figures differ by region and farming method, sometimes by a factor of two.',
      },
      {
        question: 'Does it count cooking or transport?',
        answer: 'The factors cover production up to the shop shelf. Cooking, refrigeration and waste at home are not included.',
      },
    ],
    scenarios: varied(
      'meat-footprint-calculator',
      8,
      [
        { name: 'servings', lo: 1, hi: 14 },
        { name: 'grams', lo: 60, hi: 400, step: 10 },
      ],
      [{ name: 'food', options: ['beef', 'lamb', 'pork', 'chicken', 'fish', 'tofu'] }],
      (v) => `${v.servings} servings a week of ${v.grams} g ${v.food}`,
    ),
    introOutputs: ['year'],
    relatedSlugs: ['vegan-footprint-calculator', 'car-vs-bike-carbon-calculator'],
    checks: [
      { inputs: {}, expect: { serving: '9 kg', year: '1,404 kg', tonnes: '1.404 t' } },
      { inputs: { food: 'chicken' }, expect: { serving: '0.9 kg', year: '140.4 kg' } },
      { inputs: { servings: 5, grams: 200, food: 'lamb' }, expect: { serving: '4.8 kg', year: '1,248 kg' } },
      { inputs: { servings: 0 }, expect: { year: '0 kg' } },
    ],
  },
  {
    slug: 'vegan-footprint-calculator',
    category: 'ecology',
    tier: 2,
    subCluster: 'Eco footprint',
    title: 'Diet Carbon Footprint Calculator: Meat Eater to Vegan Savings',
    h1: 'Vegan and Vegetarian Footprint Calculator',
    metaDescription:
      'Compare the daily greenhouse gas emissions of two diets, from high meat to vegan, and see the saving per person per year in kilograms and percent.',
    about:
      'Diets differ in emissions mostly because of meat and dairy. A widely cited 2014 study of adults in the United Kingdom estimated the average footprint of six eating patterns, from heavy meat eaters to vegans, in kilograms of carbon dioxide equivalent a day. Pick the diet you eat now, the one you are thinking of, and the number of people in the household. The calculator subtracts the daily figures, multiplies by 365 and gives the yearly saving and the percentage cut. The figures describe typical British menus and your own shopping will differ.',
    inputs: [select('from', 'Current diet', 'highmeat', DIET_OPTIONS), select('to', 'New diet', 'vegan', DIET_OPTIONS), intField('people', 'People', 1, 1, 50)],
    outputs: [
      { name: 'day', label: 'Saving per day', format: 'text' },
      { name: 'year', label: 'Saving per year', format: 'text', highlight: true },
      { name: 'cut', label: 'Reduction of the diet footprint', format: 'text' },
    ],
    calculate: (i) => {
      const from = toD(DIET_KG[String(i.from)] ?? '7.19');
      const to = toD(DIET_KG[String(i.to)] ?? '2.89');
      const people = toD(i.people);
      const day = from.minus(to).mul(people);
      return { day: kg(day), year: kg(day.mul(DAYS), 1), cut: fmtPercent(from.minus(to).div(from).mul(100), 1) };
    },
    formulaDescription:
      'Saving per day = (daily kg CO2e of the current diet − that of the new diet) × people. Per year = per day × 365. Reduction = saving ÷ current diet × 100.',
    workedExample: 'From 7.19 to 2.89 kg a day is 4.3 kg a day, or 1,569.5 kg a year for one person: a cut of 59.8%.',
    faq: [
      {
        question: 'Where do the daily figures come from?',
        answer:
          'They are the typical values from a 2014 study of dietary greenhouse gas emissions in the UK, rounded here to two decimals. Other countries and years differ.',
      },
      { question: 'What if the new diet is higher?', answer: 'The saving shows as a negative number, which means your emissions would go up.' },
      {
        question: 'Do these figures include air freight or waste?',
        answer: 'They include production and some transport. Food thrown away at home is not counted separately.',
      },
    ],
    scenarios: varied(
      'vegan-footprint-calculator',
      8,
      [{ name: 'people', lo: 1, hi: 8 }],
      [
        { name: 'from', options: ['highmeat', 'mediummeat', 'lowmeat', 'fish'] },
        { name: 'to', options: ['lowmeat', 'fish', 'vegetarian', 'vegan'] },
      ],
      (v) => `${v.people} people moving from ${v.from} to ${v.to}`,
    ),
    introOutputs: ['year'],
    relatedSlugs: ['meat-footprint-calculator', 'kaya-identity-calculator'],
    checks: [
      { inputs: {}, expect: { day: '4.3 kg', year: '1,569.5 kg', cut: '59.8%' } },
      { inputs: { from: 'mediummeat', to: 'vegetarian', people: 2 }, expect: { day: '3.64 kg', year: '1,328.6 kg', cut: '32.3%' } },
      { inputs: { from: 'vegan', to: 'vegan' }, expect: { day: '0 kg', year: '0 kg', cut: '0.0%' } },
    ],
  },
  {
    slug: 'plastic-footprint-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Eco footprint',
    title: 'Plastic Footprint Calculator: How Much Plastic You Use a Year',
    h1: 'Plastic Footprint Calculator',
    metaDescription: 'Add up the plastic in the bottles, bags and other packaging you use each week and see the weight per year and over ten years.',
    about:
      'Most single-use plastic is small and quickly forgotten, so the habit looks harmless until it is added up. Enter how many bottles and carrier bags you use in a week, what each weighs in grams, and a figure for everything else, such as wrappers, cups, straws and food trays. The calculator totals the weekly weight and scales it to a year and to a decade. An empty half-litre water bottle weighs roughly 10 to 25 grams and a thin carrier bag about 5, but weigh your own if you can, since brands vary a great deal.',
    inputs: [
      intField('bottles', 'Bottles per week', 7, 0, 500),
      field('bottleg', 'Weight of a bottle (g)', 20, 1, 200),
      intField('bags', 'Bags per week', 5, 0, 500),
      field('bagg', 'Weight of a bag (g)', 5, 1, 200),
      field('other', 'Other plastic per week (g)', 100, 0, 20000),
    ],
    outputs: [
      { name: 'week', label: 'Plastic per week', format: 'text' },
      { name: 'year', label: 'Plastic per year', format: 'text', highlight: true },
      { name: 'decade', label: 'Plastic over ten years', format: 'text' },
    ],
    calculate: (i) => {
      const week = toD(i.bottles)
        .mul(toD(i.bottleg))
        .plus(toD(i.bags).mul(toD(i.bagg)))
        .plus(toD(i.other));
      const year = week.mul(52).div(1000);
      return { week: `${fmtNumber(week, 1)} g`, year: kg(year), decade: kg(year.mul(10), 1) };
    },
    formulaDescription:
      'Grams per week = bottles × bottle weight + bags × bag weight + other grams. Per year = grams per week × 52 ÷ 1,000. Ten years = per year × 10.',
    workedExample:
      '7 bottles of 20 g, 5 bags of 5 g and 100 g of other plastic make 140 + 25 + 100 = 265 g a week, which is 13.78 kg a year and 137.8 kg in ten years.',
    faq: [
      {
        question: 'How much does a plastic bottle weigh?',
        answer: 'A half-litre bottle is typically 10 to 25 grams. Lightweight designs are at the low end and thick reusable-style bottles at the high end.',
      },
      {
        question: 'What counts as other plastic?',
        answer:
          'Food wrappers, trays, coffee cups and lids, straws, cling film and personal-care packaging. A weekly kitchen bin can be weighed to estimate it.',
      },
      {
        question: 'Is this the same as a carbon footprint?',
        answer: 'No. This is the weight of plastic you use, not the emissions of making it. Multiply by an emission factor if you want a carbon figure.',
      },
    ],
    scenarios: mixed(
      'plastic-footprint-calculator',
      8,
      (r) => ({
        bottles: Math.round(r(0, 30)),
        bottleg: Math.round(r(8, 45)),
        bags: Math.round(r(0, 20)),
        bagg: Math.round(r(3, 25)),
        other: Math.round(r(20, 600)),
      }),
      (v) => `${v.bottles} bottles of ${v.bottleg} g, ${v.bags} bags of ${v.bagg} g, ${v.other} g other`,
    ),
    introOutputs: ['year'],
    relatedSlugs: ['bag-footprint-calculator', 'tap-water-vs-bottled-calculator'],
    checks: [
      { inputs: {}, expect: { week: '265 g', year: '13.78 kg', decade: '137.8 kg' } },
      { inputs: { bottles: 10, bottleg: 25, bags: 0, other: 0 }, expect: { week: '250 g', year: '13 kg' } },
      { inputs: { bottles: 0, bags: 0, other: 0 }, expect: { week: '0 g', year: '0 kg' } },
    ],
  },
  {
    slug: 'bag-footprint-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Eco footprint',
    title: 'Reusable Bag Break-Even Calculator: How Many Uses to Beat Plastic',
    h1: 'Reusable Bag Footprint Calculator',
    metaDescription: 'Find how many times a reusable bag must be used before its manufacturing emissions are lower than the single-use bags it replaces.',
    about:
      'A cotton or canvas tote takes far more energy and water to make than a thin plastic bag, so it only helps the climate once it has been used enough times. This calculator divides the footprint of making the reusable bag by the footprint of one single-use bag to find the break-even number of uses, then converts that into weeks from how often you shop. It also shows the saving over five years. The defaults are typical estimates in kilograms of carbon dioxide equivalent and life-cycle studies disagree, so replace them with a figure you trust.',
    inputs: [
      field('reusable', 'Footprint of the reusable bag (kg CO2e)', 2.1, 0.01, 50),
      field('single', 'Footprint of one single-use bag (kg CO2e)', 0.04, 0.001, 5),
      field('trips', 'Shopping trips per week', 2, 0.1, 21),
    ],
    outputs: [
      { name: 'uses', label: 'Uses to break even', format: 'text', highlight: true },
      { name: 'weeks', label: 'Weeks to break even', format: 'text' },
      { name: 'saved', label: 'Net saving over five years', format: 'text' },
    ],
    calculate: (i) => {
      const reusable = toD(i.reusable);
      const single = toD(i.single);
      const uses = reusable.div(single).ceil();
      const weeks = uses.div(toD(i.trips)).ceil();
      const saved = toD(i.trips).mul(52).mul(5).mul(single).minus(reusable);
      return { uses: fmtNumber(uses, 0), weeks: fmtNumber(weeks, 0), saved: kg(saved) };
    },
    formulaDescription:
      'Uses to break even = reusable footprint ÷ single-use footprint, rounded up. Weeks = uses ÷ trips per week, rounded up. Five-year saving = trips × 52 × 5 × single-use footprint − reusable footprint.',
    workedExample:
      'A tote of 2.1 kg against a 0.04 kg bag needs 2.1 ÷ 0.04 = 52.5, so 53 uses. At two trips a week that is 27 weeks, and over five years the saving is 520 × 0.04 − 2.1 = 18.7 kg.',
    faq: [
      {
        question: 'Why do cotton bags need so many uses?',
        answer: 'Growing cotton uses a great deal of water, land and fertiliser, so a cotton tote can need over a hundred uses to match thin plastic bags.',
      },
      {
        question: 'Does it count what the plastic bag does after use?',
        answer:
          'Only the making. Litter and persistence in the environment are not in the emission figure, and they are a reason many people prefer reusable bags anyway.',
      },
      {
        question: 'What if I reuse the plastic bag?',
        answer: 'Divide the single-use footprint by the number of times you reuse it before throwing it away, then enter that smaller figure.',
      },
    ],
    scenarios: mixed(
      'bag-footprint-calculator',
      8,
      (r) => ({ reusable: r(0.3, 8), single: r(0.02, 0.09), trips: r(0.5, 8) }),
      (v) => `a ${v.reusable} kg bag against ${v.single} kg, ${v.trips} trips a week`,
    ),
    introOutputs: ['uses'],
    relatedSlugs: ['plastic-footprint-calculator', 'hand-drying-footprint-calculator'],
    checks: [
      { inputs: {}, expect: { uses: '53', weeks: '27', saved: '18.7 kg' } },
      { inputs: { reusable: 5.24, single: 0.04 }, expect: { uses: '131' } },
      { inputs: { reusable: 0.04, single: 0.04 }, expect: { uses: '1' } },
    ],
  },
  {
    slug: 'hand-drying-footprint-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Eco footprint',
    title: 'Hand Drying Footprint Calculator: Paper Towels or Hand Dryer',
    h1: 'Hand Drying Footprint Calculator',
    metaDescription:
      'Compare the greenhouse gas emissions of an electric hand dryer with paper towels, per dry and over a year, from the power, time and towel footprint.',
    about:
      'A hot-air dryer uses electricity for half a minute, while a paper towel uses wood, water and a factory run before it is thrown away. The cleaner choice depends on the dryer power, the carbon intensity of the local grid and how many towels people take. Enter the dryer power in kilowatts, the drying time, the grid factor, the number of towels used and the emissions of one towel, plus how many hands are dried a day. The calculator gives grams per dry for each method and the yearly difference. Figures are typical, so use your own readings where you have them.',
    inputs: [
      field('kw', 'Dryer power (kW)', 2, 0.1, 10),
      field('seconds', 'Drying time (seconds)', 30, 5, 120),
      field('grid', 'Grid emissions (kg CO2e per kWh)', 0.4, 0, 1.5),
      field('towels', 'Towels per dry', 2, 0, 10),
      field('towelg', 'Footprint of one towel (g CO2e)', 10, 0.5, 100),
      intField('dries', 'Dries per day', 10, 1, 100000),
    ],
    outputs: [
      { name: 'dryer', label: 'Dryer, per dry', format: 'text' },
      { name: 'paper', label: 'Paper, per dry', format: 'text' },
      { name: 'saving', label: 'Yearly saving of the dryer over paper', format: 'text', highlight: true },
    ],
    calculate: (i) => {
      const dryer = toD(i.kw).mul(toD(i.seconds)).div(3600).mul(toD(i.grid)).mul(1000);
      const paper = toD(i.towels).mul(toD(i.towelg));
      const saving = paper.minus(dryer).mul(toD(i.dries)).mul(DAYS).div(1000);
      return { dryer: `${fmtNumber(dryer, 2)} g`, paper: `${fmtNumber(paper, 2)} g`, saving: kg(saving) };
    },
    formulaDescription:
      'Dryer grams = kW × seconds ÷ 3,600 × grid factor × 1,000. Paper grams = towels × grams per towel. Yearly saving = (paper − dryer) × dries per day × 365 ÷ 1,000, negative when the dryer is worse.',
    workedExample:
      'A 2 kW dryer for 30 s on a 0.4 kg/kWh grid gives 6.67 g. Two 10 g towels give 20 g. Ten dries a day save 13.33 g × 3,650 ÷ 1,000 = 48.67 kg a year.',
    faq: [
      {
        question: 'Is a hand dryer always better?',
        answer: 'Not always. On a coal-heavy grid or with a long cycle the dryer can emit more than a single towel, and the result turns negative.',
      },
      {
        question: 'What about recycled paper?',
        answer: 'Lower the footprint of one towel to reflect recycled content. Recycling after use is not counted here.',
      },
      { question: 'Does hygiene matter?', answer: 'This tool only compares emissions. Both methods are considered hygienic when hands are washed properly.' },
    ],
    scenarios: mixed(
      'hand-drying-footprint-calculator',
      8,
      (r) => ({
        kw: r(0.5, 3),
        seconds: Math.round(r(8, 60)),
        grid: r(0.05, 0.9),
        towels: Math.round(r(1, 4)),
        towelg: r(4, 25),
        dries: Math.round(r(5, 400)),
      }),
      (v) => `${v.kw} kW for ${v.seconds} s on ${v.grid} kg/kWh, ${v.towels} towels of ${v.towelg} g, ${v.dries} dries a day`,
    ),
    introOutputs: ['saving'],
    relatedSlugs: ['bag-footprint-calculator', 'solar-panel-calculator'],
    checks: [
      { inputs: {}, expect: { dryer: '6.67 g', paper: '20 g', saving: '48.67 kg' } },
      { inputs: { kw: 3, seconds: 20, grid: 0.5, towels: 1, towelg: 8, dries: 5 }, expect: { dryer: '8.33 g', paper: '8 g', saving: '-0.61 kg' } },
      { inputs: { towels: 0 }, expect: { paper: '0 g' } },
    ],
  },
  {
    slug: 'christmas-tree-footprint-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Eco footprint',
    title: 'Christmas Tree Footprint Calculator: Real or Artificial Tree',
    h1: 'Christmas Tree Footprint Calculator',
    metaDescription:
      'Compare a real Christmas tree bought each year with an artificial tree reused for several years, and find how many years the artificial one needs to break even.',
    about:
      'A plastic tree has a large footprint on the day it is made but none afterwards, whereas a real tree is grown, cut, driven home and disposed of every December. The artificial tree only wins when it is kept long enough, and the break-even point depends on the figures you believe. Enter the footprint of the artificial tree, the annual footprint of a real one and the number of years you expect to use the artificial one. The calculator gives the break-even age, the yearly average of the plastic tree and which choice is lower over your period. Defaults are typical estimates.',
    inputs: [
      field('artificial', 'Artificial tree footprint (kg CO2e)', 40, 1, 500),
      field('real', 'Real tree footprint per year (kg CO2e)', 3.5, 0.1, 100),
      intField('years', 'Years you keep the artificial tree', 6, 1, 50),
    ],
    outputs: [
      { name: 'breakeven', label: 'Break-even age of the artificial tree', format: 'text', highlight: true },
      { name: 'yearly', label: 'Artificial tree, average per year of use', format: 'text' },
      { name: 'lower', label: 'Lower over your period', format: 'text' },
    ],
    calculate: (i) => {
      const artificial = toD(i.artificial);
      const real = toD(i.real);
      const years = toD(i.years);
      const realTotal = real.mul(years);
      return {
        breakeven: `${fmtNumber(artificial.div(real), 1)} years`,
        yearly: kg(artificial.div(years)),
        lower: artificial.lt(realTotal) ? 'Artificial tree' : artificial.gt(realTotal) ? 'Real tree' : 'Equal',
      };
    },
    formulaDescription:
      'Break-even age = artificial footprint ÷ real tree footprint per year. Average per year of use = artificial footprint ÷ years kept. The lower choice compares the artificial footprint with real footprint × years.',
    workedExample:
      'A 40 kg artificial tree against 3.5 kg a year for real trees breaks even after 40 ÷ 3.5 = 11.4 years. Kept for six years it averages 6.67 kg a year, so the real tree is lower over that period.',
    faq: [
      {
        question: 'Is a real tree really greener?',
        answer:
          'For most households yes, unless the artificial tree is kept for a decade or more. A tree grown locally and composted or chipped has the lowest footprint.',
      },
      {
        question: 'What about a potted tree?',
        answer: 'A potted tree replanted each year can approach zero if it survives. Set the real tree footprint very low to see the effect.',
      },
      {
        question: 'Why is the real tree figure small?',
        answer: 'Growing trees takes in carbon, which offsets the transport and disposal. Burning or landfilling the tree raises the footprint.',
      },
    ],
    scenarios: mixed(
      'christmas-tree-footprint-calculator',
      8,
      (r) => ({ artificial: Math.round(r(12, 120)), real: r(1.2, 16), years: Math.round(r(2, 25)) }),
      (v) => `a ${v.artificial} kg artificial tree kept ${v.years} years against ${v.real} kg a year`,
    ),
    introOutputs: ['breakeven'],
    relatedSlugs: ['tree-benefits-calculator', 'bag-footprint-calculator'],
    checks: [
      { inputs: {}, expect: { breakeven: '11.4 years', yearly: '6.67 kg', lower: 'Real tree' } },
      { inputs: { years: 20 }, expect: { yearly: '2 kg', lower: 'Artificial tree' } },
      { inputs: { artificial: 21, real: 3.5, years: 6 }, expect: { lower: 'Equal' } },
    ],
  },
  {
    slug: 'ai-water-footprint-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Eco footprint',
    title: 'AI Water Footprint Calculator: Water Used per Chatbot Query',
    h1: 'AI Water Footprint Calculator',
    metaDescription:
      'Estimate the cooling water and electricity behind your AI queries from the energy per query and the litres of water used per kilowatt-hour.',
    about:
      'Data centres use electricity to run the models and water to cool the machines and the power stations that feed them, so each query has a small share of both. Published estimates range widely because they depend on the model, the length of the answer, the cooling method and the grid. Enter how many queries you make in a day, the energy of one in watt-hours and the litres of water per kilowatt-hour. The calculator gives the water for one query in millilitres, the yearly total in litres and the electricity. Treat the defaults as placeholders and replace them with a figure from a source you trust.',
    inputs: [
      intField('queries', 'Queries per day', 20, 1, 100000),
      field('wh', 'Energy per query (Wh)', 0.3, 0.01, 100),
      field('lperkwh', 'Water per kWh (litres)', 1.8, 0, 20),
    ],
    outputs: [
      { name: 'query', label: 'Water per query', format: 'text' },
      { name: 'year', label: 'Water per year', format: 'text', highlight: true },
      { name: 'kwh', label: 'Electricity per year', format: 'text' },
    ],
    calculate: (i) => {
      const kwhPerQuery = toD(i.wh).div(1000);
      const litresPerQuery = kwhPerQuery.mul(toD(i.lperkwh));
      const queriesYear = toD(i.queries).mul(DAYS);
      return {
        query: `${fmtNumber(litresPerQuery.mul(1000), 2)} mL`,
        year: `${fmtNumber(litresPerQuery.mul(queriesYear), 2)} L`,
        kwh: `${fmtNumber(kwhPerQuery.mul(queriesYear), 2)} kWh`,
      };
    },
    formulaDescription:
      'Litres per query = Wh ÷ 1,000 × litres per kWh. Per year = litres per query × queries per day × 365. Electricity = Wh ÷ 1,000 × queries per year.',
    workedExample: '0.3 Wh is 0.0003 kWh; at 1.8 L per kWh that is 0.54 mL a query. Twenty queries a day for 365 days use 3.94 L and 2.19 kWh.',
    faq: [
      {
        question: 'Why is the range so wide?',
        answer:
          'Energy per query depends on the model size and the length of the reply, and water per kWh depends on the cooling design and on how the electricity is made.',
      },
      {
        question: 'Does the water get used up?',
        answer: 'Part evaporates from cooling towers and is lost to the local supply. How much matters depends on where and how the centre is cooled.',
      },
      { question: 'Is training the model included?', answer: 'No. Only the use of a model for queries is counted, not the energy of building it.' },
    ],
    scenarios: mixed(
      'ai-water-footprint-calculator',
      8,
      (r) => ({ queries: Math.round(r(3, 900)), wh: r(0.05, 8), lperkwh: r(0.2, 5) }),
      (v) => `${v.queries} queries a day at ${v.wh} Wh and ${v.lperkwh} L per kWh`,
    ),
    introOutputs: ['year'],
    relatedSlugs: ['cryptocurrency-footprint-calculator', 'water-demand-calculator'],
    checks: [
      { inputs: {}, expect: { query: '0.54 mL', year: '3.94 L', kwh: '2.19 kWh' } },
      { inputs: { queries: 100, wh: 3, lperkwh: 3 }, expect: { query: '9 mL', year: '328.5 L', kwh: '109.5 kWh' } },
      { inputs: { lperkwh: 0 }, expect: { query: '0 mL', year: '0 L' } },
    ],
  },
  {
    slug: 'cryptocurrency-footprint-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Eco footprint',
    title: 'Cryptocurrency Footprint Calculator: Energy and CO2 per Transaction',
    h1: 'Cryptocurrency Footprint Calculator',
    metaDescription:
      'Estimate the electricity and CO2 emissions of a number of cryptocurrency transactions from the energy per transaction and the grid emissions.',
    about:
      'Proof-of-work networks such as Bitcoin use a lot of electricity because miners compete to solve puzzles, and published estimates of the energy attributed to a single transaction vary enormously with the method used. Enter the number of transactions, the kilowatt-hours you attribute to each and the grid emission factor, and the calculator returns the electricity, the CO2 equivalent and a comparison with the number of days of electricity an average home uses. Networks that use proof-of-stake need a tiny fraction of this energy, so set the energy per transaction accordingly. Nothing is fetched, and the defaults are illustrative.',
    inputs: [
      intField('transactions', 'Transactions', 10, 1, 100000000),
      field('kwh', 'Energy per transaction (kWh)', 700, 0.001, 5000),
      field('grid', 'Grid emissions (kg CO2e per kWh)', 0.4, 0, 1.5),
      field('home', 'Home electricity per day (kWh)', 29, 1, 200),
    ],
    outputs: [
      { name: 'energy', label: 'Electricity', format: 'text' },
      { name: 'co2', label: 'CO2 equivalent', format: 'text', highlight: true },
      { name: 'homedays', label: 'Days of an average home', format: 'text' },
    ],
    calculate: (i) => {
      const energy = toD(i.transactions).mul(toD(i.kwh));
      return { energy: `${fmtNumber(energy, 1)} kWh`, co2: kg(energy.mul(toD(i.grid)), 1), homedays: fmtNumber(energy.div(toD(i.home)), 1) };
    },
    formulaDescription: 'Electricity = transactions × kWh per transaction. CO2e = electricity × grid factor. Home days = electricity ÷ home kWh per day.',
    workedExample: 'Ten transactions at 700 kWh use 7,000 kWh, which at 0.4 kg per kWh is 2,800 kg of CO2e, about 241.4 days of a home using 29 kWh a day.',
    faq: [
      {
        question: 'Why is the energy per transaction a debated figure?',
        answer:
          'The network spends the same energy whether it handles few or many transactions, so dividing the total by the transaction count gives a number that moves with usage.',
      },
      {
        question: 'What about proof-of-stake?',
        answer: 'Proof-of-stake networks do not run competitive mining and use a tiny share of the energy; enter a very small figure to model them.',
      },
      { question: 'Does the grid factor matter?', answer: 'Yes. Miners on hydro or solar power emit far less per kilowatt-hour than miners on coal.' },
    ],
    scenarios: mixed(
      'cryptocurrency-footprint-calculator',
      8,
      (r) => ({ transactions: Math.round(r(1, 4000)), kwh: Math.round(r(2, 1400)), grid: r(0.03, 0.9), home: Math.round(r(8, 60)) }),
      (v) => `${v.transactions} transactions at ${v.kwh} kWh on ${v.grid} kg per kWh`,
    ),
    introOutputs: ['co2'],
    relatedSlugs: ['ai-water-footprint-calculator', 'kaya-identity-calculator'],
    checks: [
      { inputs: {}, expect: { energy: '7,000 kWh', co2: '2,800 kg', homedays: '241.4' } },
      { inputs: { transactions: 1, kwh: 50, grid: 0.2, home: 10 }, expect: { energy: '50 kWh', co2: '10 kg', homedays: '5' } },
      { inputs: { grid: 0 }, expect: { co2: '0 kg' } },
    ],
  },
  {
    slug: 'wind-turbine-profit-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Renewable energy',
    title: 'Wind Turbine Profit Calculator: Yearly Income and Payback',
    h1: 'Wind Turbine Profit Calculator',
    metaDescription:
      'Estimate the yearly energy, income, running costs, profit and simple payback of a wind turbine from its rating, capacity factor and electricity price.',
    about:
      'A turbine earns by selling the energy it generates, and the main unknown is the capacity factor, the share of the year it effectively runs at full rating. Onshore turbines typically reach 25 to 40 percent depending on the site. Enter the rated power in kilowatts, the capacity factor, the price you are paid for each kilowatt-hour, the yearly operating cost per kilowatt and the installed cost per kilowatt. The calculator gives the energy in megawatt-hours, the yearly revenue, the profit after operating costs and the simple payback in years. It ignores tax, finance costs, degradation and grid connection charges.',
    inputs: [
      field('kw', 'Rated power (kW)', 2000, 1, 20000),
      field('cf', 'Capacity factor (%)', 30, 1, 70),
      field('price', 'Price per kWh ($)', 0.06, 0, 2),
      field('om', 'Operating cost per kW per year ($)', 40, 0, 1000),
      field('capex', 'Installed cost per kW ($)', 1500, 100, 10000),
    ],
    outputs: [
      { name: 'energy', label: 'Energy per year', format: 'text' },
      { name: 'revenue', label: 'Revenue per year', format: 'text' },
      { name: 'profit', label: 'Profit per year', format: 'text', highlight: true },
      { name: 'payback', label: 'Simple payback', format: 'text' },
    ],
    calculate: (i) => {
      const kwh = toD(i.kw).mul(8760).mul(toD(i.cf)).div(100);
      const revenue = kwh.mul(toD(i.price));
      const profit = revenue.minus(toD(i.kw).mul(toD(i.om)));
      const capex = toD(i.kw).mul(toD(i.capex));
      return {
        energy: `${fmtNumber(kwh.div(1000), 0)} MWh`,
        revenue: fmtCurrency(revenue),
        profit: fmtCurrency(profit),
        payback: profit.gt(0) ? `${fmtNumber(capex.div(profit), 1)} years` : 'Not paid back',
      };
    },
    formulaDescription:
      'Energy = kW × 8,760 hours × capacity factor. Revenue = energy × price. Profit = revenue − kW × operating cost. Payback = kW × installed cost ÷ profit.',
    workedExample:
      'A 2,000 kW turbine at 30% yields 5,256 MWh. At $0.06 per kWh that is $315,360; less $80,000 to run it leaves $235,360 a year, and $3,000,000 of cost is paid back in 12.7 years.',
    faq: [
      {
        question: 'What capacity factor should I use?',
        answer:
          'Use the figure from a wind resource assessment of your site. Onshore sites commonly range from 25 to 40 percent and offshore sites are higher.',
      },
      {
        question: 'What is missing from the payback?',
        answer: 'Tax, interest, subsidies, turbine degradation, lease payments and grid connection are all left out, so the real payback is usually longer.',
      },
      {
        question: 'Why does a low price give no payback?',
        answer: 'If revenue does not cover the operating costs, profit is zero or negative and the investment never pays back at that price.',
      },
    ],
    scenarios: mixed(
      'wind-turbine-profit-calculator',
      8,
      (r) => ({ kw: Math.round(r(100, 6000)), cf: Math.round(r(18, 48)), price: r(0.03, 0.14), om: Math.round(r(20, 90)), capex: Math.round(r(1100, 2600)) }),
      (v) => `${v.kw} kW at ${v.cf}% and ${v.price} per kWh, running cost ${v.om}, installed ${v.capex}`,
    ),
    introOutputs: ['profit'],
    relatedSlugs: ['wind-turbine-calculator', 'solar-panel-calculator'],
    checks: [
      { inputs: {}, expect: { energy: '5,256 MWh', revenue: '$315,360.00', profit: '$235,360.00', payback: '12.7 years' } },
      { inputs: { price: 0.02 }, expect: { revenue: '$105,120.00', profit: '$25,120.00', payback: '119.4 years' } },
      { inputs: { price: 0.01 }, expect: { profit: '-$27,440.00', payback: 'Not paid back' } },
      { inputs: { kw: 1000, cf: 35, price: 0.08 }, expect: { energy: '3,066 MWh', revenue: '$245,280.00', profit: '$205,280.00', payback: '7.3 years' } },
    ],
  },
  {
    slug: 'passive-house-savings-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Sustainable living',
    title: 'Passive House Savings Calculator: Heating Energy and Money Saved',
    h1: 'Passive House Savings Calculator',
    metaDescription:
      'Estimate the heating energy and money saved by a passive house compared with a typical home, from floor area, heating demand and the energy price.',
    about:
      'A passive house is built with thick insulation, airtight construction, good windows and heat recovery, so it needs only a small fraction of the heating energy of an ordinary home. The standard sets a heating demand of at most 15 kilowatt-hours per square metre of floor area a year. Enter your floor area, the heating demand of the existing home, the demand of the new one and the price of energy, and the calculator finds the energy saved, the yearly money saved, the percentage cut and the saving over twenty years. It excludes extra construction cost, so compare the result with the price of the upgrade.',
    inputs: [
      field('area', 'Floor area (m²)', 150, 10, 5000),
      field('now', 'Current heating demand (kWh per m² per year)', 120, 1, 600),
      field('passive', 'Passive house demand (kWh per m² per year)', 15, 0, 100),
      field('price', 'Energy price per kWh ($)', 0.12, 0, 2),
    ],
    outputs: [
      { name: 'kwh', label: 'Energy saved per year', format: 'text' },
      { name: 'money', label: 'Money saved per year', format: 'text', highlight: true },
      { name: 'twenty', label: 'Saved over 20 years', format: 'text' },
      { name: 'cut', label: 'Reduction in heating energy', format: 'text' },
    ],
    calculate: (i) => {
      const demandCut = toD(i.now).minus(toD(i.passive));
      const kwh = toD(i.area).mul(demandCut);
      const money = kwh.mul(toD(i.price));
      return {
        kwh: `${fmtNumber(kwh, 0)} kWh`,
        money: fmtCurrency(money),
        twenty: fmtCurrency(money.mul(20)),
        cut: fmtPercent(demandCut.div(toD(i.now)).mul(100), 1),
      };
    },
    formulaDescription:
      'Energy saved = area × (current demand − passive demand). Money saved = energy saved × price. Twenty years = money saved × 20, with no discounting. Reduction = demand cut ÷ current demand × 100.',
    workedExample:
      '150 m² cutting demand from 120 to 15 kWh per m² saves 150 × 105 = 15,750 kWh a year, which at $0.12 is $1,890 a year, $37,800 over twenty years and an 87.5% reduction.',
    faq: [
      {
        question: 'What is a typical heating demand?',
        answer:
          'Older homes often need 100 to 200 kWh per square metre a year; modern code-compliant homes about 50 to 80. A certificate or energy audit gives your figure.',
      },
      {
        question: 'Is the saving guaranteed?',
        answer: 'No. Real use depends on occupant behaviour, the climate and how well the building is built, and the heating demand is a calculated value.',
      },
      {
        question: 'Does it include the cost of building?',
        answer: 'No. Passive houses can cost more to build, so compare the twenty-year saving with the extra price.',
      },
    ],
    scenarios: mixed(
      'passive-house-savings-calculator',
      8,
      (r) => ({ area: Math.round(r(40, 420)), now: Math.round(r(60, 240)), passive: Math.round(r(8, 30)), price: r(0.05, 0.4) }),
      (v) => `${v.area} m² cutting ${v.now} to ${v.passive} kWh per m², energy at ${v.price}`,
    ),
    introOutputs: ['money'],
    relatedSlugs: ['solar-panel-calculator', 'kaya-identity-calculator'],
    checks: [
      { inputs: {}, expect: { kwh: '15,750 kWh', money: '$1,890.00', twenty: '$37,800.00', cut: '87.5%' } },
      { inputs: { area: 80, now: 100, passive: 20, price: 0.2 }, expect: { kwh: '6,400 kWh', money: '$1,280.00', twenty: '$25,600.00', cut: '80.0%' } },
      { inputs: { now: 15, passive: 15 }, expect: { kwh: '0 kWh', money: '$0.00' } },
    ],
  },
  {
    slug: 'plug-in-hybrid-economy-calculator',
    category: 'ecology',
    tier: 2,
    subCluster: 'Sustainable living',
    title: 'Plug-in Hybrid Economy Calculator: Running Cost per Mile',
    h1: 'Plug-in Hybrid Economy Calculator',
    metaDescription:
      'Find the blended running cost per mile of a plug-in hybrid from the share of miles driven on electricity, the fuel economy and the energy prices.',
    about:
      'A plug-in hybrid runs on a battery for its first miles and on petrol after that, so its cost per mile sits between an electric car and an ordinary one and depends on how often it is charged. Enter the fuel economy in miles per gallon, the electric efficiency in miles per kilowatt-hour, the price of each fuel, the share of miles driven on electricity and the miles you drive in a year. The calculator blends the two costs per mile, adds up the yearly bill and compares it with running the same car only on petrol. Maintenance, depreciation and the price of the car are not included.',
    inputs: [
      field('mpg', 'Fuel economy on petrol (mpg)', 40, 5, 150),
      field('mikwh', 'Electric efficiency (miles per kWh)', 3, 0.5, 10),
      field('fuel', 'Fuel price per gallon ($)', 3.5, 0, 20),
      field('power', 'Electricity price per kWh ($)', 0.15, 0, 2),
      field('share', 'Share of miles on electricity (%)', 60, 0, 100),
      field('miles', 'Miles per year', 12000, 100, 200000),
    ],
    outputs: [
      { name: 'permile', label: 'Blended cost per mile', format: 'text' },
      { name: 'year', label: 'Cost per year', format: 'text', highlight: true },
      { name: 'saving', label: 'Saving against petrol only', format: 'text' },
    ],
    calculate: (i) => {
      const gas = toD(i.fuel).div(toD(i.mpg));
      const electric = toD(i.power).div(toD(i.mikwh));
      const share = toD(i.share).div(100);
      const blended = share.mul(electric).plus(D(1).minus(share).mul(gas));
      const miles = toD(i.miles);
      return { permile: small(blended), year: fmtCurrency(blended.mul(miles)), saving: fmtCurrency(gas.minus(blended).mul(miles)) };
    },
    formulaDescription:
      'Petrol cost per mile = fuel price ÷ mpg. Electric cost per mile = electricity price ÷ miles per kWh. Blended = share × electric + (1 − share) × petrol. Yearly cost = blended × miles.',
    workedExample:
      'Petrol at $3.50 and 40 mpg costs $0.0875 a mile and electricity at $0.15 and 3 miles per kWh costs $0.05. With 60% electric miles the blend is $0.065, so 12,000 miles cost $780 against $1,050 on petrol alone: a $270 saving.',
    faq: [
      {
        question: 'How do I find the share of electric miles?',
        answer: 'It depends on the battery range and how often you charge. Drivers who plug in every night and make short trips can reach 70 to 80 percent.',
      },
      {
        question: 'What if the battery is never charged?',
        answer: 'Set the share to zero. The hybrid then runs on petrol and the saving is nothing, or slightly negative if it is heavier than a normal car.',
      },
      {
        question: 'Does it include charging losses?',
        answer: 'Enter miles per kWh measured at the wall, not the dashboard, so that charging losses are counted.',
      },
    ],
    scenarios: mixed(
      'plug-in-hybrid-economy-calculator',
      8,
      (r) => ({
        mpg: Math.round(r(25, 65)),
        mikwh: r(2, 4.5),
        fuel: r(2.5, 6.5),
        power: r(0.08, 0.5),
        share: Math.round(r(10, 90)),
        miles: Math.round(r(4000, 25000)),
      }),
      (v) => `${v.mpg} mpg and ${v.mikwh} miles per kWh, fuel ${v.fuel}, power ${v.power}, ${v.share}% electric over ${v.miles} miles`,
    ),
    introOutputs: ['year'],
    relatedSlugs: ['car-vs-bike-carbon-calculator', 'solar-panel-calculator'],
    checks: [
      { inputs: {}, expect: { permile: '$0.0650', year: '$780.00', saving: '$270.00' } },
      { inputs: { share: 100 }, expect: { year: '$600.00', saving: '$450.00' } },
      { inputs: { share: 0 }, expect: { year: '$1,050.00', saving: '$0.00' } },
    ],
  },
  {
    slug: 'tap-water-vs-bottled-calculator',
    category: 'ecology',
    tier: 2,
    subCluster: 'Sustainable living',
    title: 'Tap Water vs Bottled Water Calculator: Cost and Plastic Saved',
    h1: 'Tap Water vs Bottled Water Calculator',
    metaDescription: 'Compare the yearly cost of drinking bottled water with tap water, and count the bottles and kilograms of plastic you would avoid.',
    about:
      'Bottled water costs hundreds or thousands of times more than the same volume from the tap, and each bottle adds plastic that has to be recycled or thrown away. Enter how many litres you drink in a day, the price per litre of bottled and tap water, the size of the bottle and the weight of one empty bottle. The calculator finds the yearly cost of each, the saving, the number of bottles used and the plastic they contain. If your tap water is not safe to drink, filtered or treated water may be the sensible choice and the comparison does not apply.',
    inputs: [
      field('litres', 'Water drunk per day (litres)', 2, 0.1, 50),
      field('bottled', 'Bottled water price per litre ($)', 1, 0, 20),
      field('tap', 'Tap water price per litre ($)', 0.002, 0, 1),
      field('size', 'Bottle size (litres)', 0.5, 0.1, 5),
      field('bottleg', 'Weight of an empty bottle (g)', 12, 1, 200),
    ],
    outputs: [
      { name: 'saving', label: 'Saving per year', format: 'text', highlight: true },
      { name: 'bottles', label: 'Bottles avoided per year', format: 'text' },
      { name: 'plastic', label: 'Plastic avoided per year', format: 'text' },
    ],
    calculate: (i) => {
      const litres = toD(i.litres).mul(DAYS);
      const saving = litres.mul(toD(i.bottled)).minus(litres.mul(toD(i.tap)));
      const bottles = litres.div(toD(i.size));
      return { saving: fmtCurrency(saving), bottles: fmtNumber(bottles.ceil(), 0), plastic: kg(bottles.mul(toD(i.bottleg)).div(1000)) };
    },
    formulaDescription:
      'Litres per year = litres per day × 365. Saving = litres × (bottled price − tap price). Bottles = litres ÷ bottle size, rounded up. Plastic = bottles × empty bottle weight ÷ 1,000.',
    workedExample:
      '2 litres a day is 730 litres a year. Bottled at $1 costs $730, tap at $0.002 costs $1.46, a saving of $728.54. In 0.5 litre bottles that is 1,460 bottles and 17.52 kg of plastic.',
    faq: [
      {
        question: 'Is tap water as safe as bottled?',
        answer: 'In many places tap water is tested more often than bottled water. Where the supply is unsafe, use boiled, filtered or treated water instead.',
      },
      { question: 'What about a filter jug?', answer: 'Add the cost of filters to the tap price per litre. It remains far below the cost of bottled water.' },
      {
        question: 'Do bottles get recycled?',
        answer: 'Many are, but not all, and recycling uses energy. The plastic weight shown is what would otherwise need to be collected and processed.',
      },
    ],
    scenarios: mixed(
      'tap-water-vs-bottled-calculator',
      8,
      (r) => ({ litres: r(0.5, 6), bottled: r(0.3, 3.5), tap: r(0.0005, 0.01), size: r(0.33, 1.5), bottleg: Math.round(r(8, 40)) }),
      (v) => `${v.litres} L a day, bottled ${v.bottled} against tap ${v.tap}, ${v.size} L bottles of ${v.bottleg} g`,
    ),
    introOutputs: ['saving'],
    relatedSlugs: ['plastic-footprint-calculator', 'water-demand-calculator'],
    checks: [
      { inputs: {}, expect: { saving: '$728.54', bottles: '1,460', plastic: '17.52 kg' } },
      { inputs: { litres: 1, bottled: 2, tap: 0.005, size: 1, bottleg: 25 }, expect: { saving: '$728.18', bottles: '365', plastic: '9.13 kg' } },
      { inputs: { bottled: 0.002 }, expect: { saving: '$0.00' } },
    ],
  },
  {
    slug: 'water-demand-calculator',
    category: 'ecology',
    tier: 2,
    subCluster: 'Sustainable living',
    title: 'Household Water Demand Calculator: Litres per Day, Month and Year',
    h1: 'Household Water Demand Calculator',
    metaDescription:
      'Estimate the water a household uses per day, month and year from the number of people, litres per person and extra uses such as the garden.',
    about:
      'Planning a rainwater tank, a well, a borehole or a water-saving plan starts with knowing how much water a household needs. Enter the number of people, the litres each person uses in a day and any extra daily use such as watering a garden or filling a pool. The calculator adds them up and converts the daily demand to cubic metres for a month and a year. Typical use varies from under 50 litres a person where water is scarce to 300 litres or more in wasteful homes, and a metered bill gives your own figure. The tool counts demand only and does not size the supply.',
    inputs: [
      intField('people', 'People', 4, 1, 1000),
      field('lpp', 'Litres per person per day', 140, 5, 1000),
      field('extra', 'Extra use per day (litres)', 0, 0, 100000),
    ],
    outputs: [
      { name: 'day', label: 'Water per day', format: 'text' },
      { name: 'month', label: 'Water per month', format: 'text' },
      { name: 'year', label: 'Water per year', format: 'text', highlight: true },
    ],
    calculate: (i) => {
      const day = toD(i.people).mul(toD(i.lpp)).plus(toD(i.extra));
      return {
        day: `${fmtNumber(day, 0)} L`,
        month: `${fmtNumber(day.mul(DAYS).div(12).div(1000), 2)} m³`,
        year: `${fmtNumber(day.mul(DAYS).div(1000), 2)} m³`,
      };
    },
    formulaDescription:
      'Per day = people × litres per person + extra litres. Per month = per day × 365 ÷ 12 ÷ 1,000 cubic metres. Per year = per day × 365 ÷ 1,000.',
    workedExample:
      'Four people at 140 litres use 560 litres a day, which is 17.03 m³ a month and 204.4 m³ a year. Adding a 50 litre garden use raises the daily figure to 610 litres.',
    faq: [
      {
        question: 'How much water does a person use?',
        answer:
          'It ranges from about 50 litres in water-scarce regions to over 300 litres in some wealthy countries. A water bill divided by occupants shows your own figure.',
      },
      { question: 'What is one cubic metre?', answer: 'One cubic metre is 1,000 litres, the unit most water meters and bills use.' },
      { question: 'Should I add a margin?', answer: 'When sizing storage, add a safety margin for dry spells, guests and leaks, usually 10 to 25 percent.' },
    ],
    scenarios: mixed(
      'water-demand-calculator',
      8,
      (r) => ({ people: Math.round(r(1, 12)), lpp: Math.round(r(35, 320)), extra: Math.round(r(0, 900)) }),
      (v) => `${v.people} people at ${v.lpp} L each plus ${v.extra} L`,
    ),
    introOutputs: ['year'],
    relatedSlugs: ['tap-water-vs-bottled-calculator', 'drip-faucet-calculator'],
    checks: [
      { inputs: {}, expect: { day: '560 L', month: '17.03 m³', year: '204.4 m³' } },
      { inputs: { people: 2, lpp: 200, extra: 50 }, expect: { day: '450 L', month: '13.69 m³', year: '164.25 m³' } },
      { inputs: { people: 1, lpp: 100, extra: 0 }, expect: { day: '100 L', year: '36.5 m³' } },
    ],
  },
  {
    slug: 'carrying-capacity-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Other',
    title: 'Carrying Capacity Calculator: How Many Individuals a Habitat Supports',
    h1: 'Carrying Capacity Calculator',
    metaDescription:
      'Estimate the carrying capacity of a habitat from the resource supply and what one individual consumes, and see how full it is and how fast the population grows.',
    about:
      'Carrying capacity, written K, is the largest population a habitat can support indefinitely with the food, water or space it provides. A simple estimate divides the supply of the limiting resource in a year by what one individual needs in that time. Enter the yearly supply, the use per individual, the current population and the intrinsic growth rate, and the calculator returns K, how much of it the population already uses, the room left and the logistic growth rate right now. It assumes a single limiting resource and a constant need, which real ecosystems rarely show, so use it as a first estimate.',
    inputs: [
      field('supply', 'Resource supply per year', 1000000, 1, 1e12),
      field('use', 'Use per individual per year', 2500, 0.001, 1e9),
      field('n', 'Current population', 250, 0, 1e12),
      field('r', 'Intrinsic growth rate per year', 0.2, 0, 10),
    ],
    outputs: [
      { name: 'k', label: 'Carrying capacity (K)', format: 'text', highlight: true },
      { name: 'full', label: 'Share of K in use', format: 'text' },
      { name: 'room', label: 'Room left', format: 'text' },
      { name: 'growth', label: 'Growth now', format: 'text' },
    ],
    calculate: (i) => {
      const k = toD(i.supply).div(toD(i.use));
      const n = toD(i.n);
      return {
        k: fmtNumber(k, 1),
        full: fmtPercent(n.div(k).mul(100), 1),
        room: fmtNumber(k.minus(n), 1),
        growth: `${fmtNumber(
          toD(i.r)
            .mul(n)
            .mul(D(1).minus(n.div(k))),
          2,
        )} a year`,
      };
    },
    formulaDescription:
      'K = resource supply ÷ use per individual. Share in use = N ÷ K × 100. Logistic growth now = r × N × (1 − N ÷ K), which falls to zero as N reaches K.',
    workedExample:
      'A supply of 1,000,000 units with 2,500 used per individual gives K = 400. A population of 250 uses 62.5% of it, leaves room for 150 and grows by 0.2 × 250 × (1 − 0.625) = 18.75 a year.',
    faq: [
      {
        question: 'Is carrying capacity fixed?',
        answer: 'No. It shifts with rainfall, food supply, disease and the way individuals use the habitat, so K for a year is an estimate.',
      },
      {
        question: 'What if the population exceeds K?',
        answer: 'The share is over 100 percent and the growth rate is negative, so the population is expected to fall back toward K.',
      },
      {
        question: 'Does it apply to people?',
        answer: 'The idea comes from ecology, but human use of resources changes with technology and trade, so a single K is much less meaningful for people.',
      },
    ],
    scenarios: mixed(
      'carrying-capacity-calculator',
      8,
      (r) => ({ supply: Math.round(r(20000, 5000000)), use: Math.round(r(120, 9000)), n: Math.round(r(10, 900)), r: r(0.05, 1.2) }),
      (v) => `supply ${v.supply}, ${v.use} each, ${v.n} present, growth rate ${v.r}`,
    ),
    introOutputs: ['k'],
    relatedSlugs: ['logistic-growth-calculator', 'lotka-volterra-calculator'],
    checks: [
      { inputs: {}, expect: { k: '400', full: '62.5%', room: '150', growth: '18.75 a year' } },
      { inputs: { supply: 50000, use: 100, n: 500 }, expect: { k: '500', full: '100.0%', growth: '0 a year' } },
      { inputs: { n: 0 }, expect: { full: '0.0%', growth: '0 a year' } },
    ],
  },
  {
    slug: 'co2-breathing-emission-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Other',
    title: 'CO2 from Breathing Calculator: How Much People Exhale',
    h1: 'CO2 from Breathing Calculator',
    metaDescription:
      'Work out how much carbon dioxide a group of people breathes out over a number of hours, and over a year, from the average per person per day.',
    about:
      'People breathe out carbon dioxide as a result of burning food in their cells, and an adult at rest exhales roughly one kilogram a day, a little more when active. Enter the number of people, the hours they spend in the place and the kilograms per person per day, and the calculator returns the carbon dioxide breathed out in that time and over a full year of continuous presence. The carbon in food came from the air recently through plants, so breathing is part of the natural cycle rather than a new source, unlike burning fossil fuels. It matters for ventilating crowded rooms.',
    inputs: [
      intField('people', 'People', 30, 1, 1000000),
      field('hours', 'Hours present', 8, 0.1, 24),
      field('perday', 'CO2 breathed out per person per day (kg)', 1, 0.3, 2),
    ],
    outputs: [
      { name: 'period', label: 'CO2 over that time', format: 'text', highlight: true },
      { name: 'year', label: 'CO2 if present all year', format: 'text' },
    ],
    calculate: (i) => {
      const daily = toD(i.people).mul(toD(i.perday));
      return { period: kg(daily.mul(toD(i.hours)).div(24)), year: `${fmtNumber(daily.mul(DAYS).div(1000), 2)} t` };
    },
    formulaDescription: 'CO2 over the time = people × kg per person per day × hours ÷ 24. Over a year = people × kg per day × 365 ÷ 1,000 tonnes.',
    workedExample: '30 people at 1 kg a day for 8 hours breathe out 30 × 8 ÷ 24 = 10 kg, and the same group present all year would breathe out 10.95 tonnes.',
    faq: [
      {
        question: 'Is breathing a cause of climate change?',
        answer:
          'No. The carbon comes from plants eaten recently, so it is part of the short natural cycle. Fossil fuels add carbon that was locked underground.',
      },
      {
        question: 'How much does a person breathe out?',
        answer: 'About 0.9 to 1 kilogram a day for an adult at rest, higher during exercise and lower for children.',
      },
      {
        question: 'Why does it matter indoors?',
        answer: 'In a crowded, poorly ventilated room the concentration rises and people feel drowsy, so ventilation is needed to keep it down.',
      },
    ],
    scenarios: mixed(
      'co2-breathing-emission-calculator',
      8,
      (r) => ({ people: Math.round(r(2, 900)), hours: r(0.5, 16), perday: r(0.6, 1.4) }),
      (v) => `${v.people} people for ${v.hours} h at ${v.perday} kg a day`,
    ),
    introOutputs: ['period'],
    relatedSlugs: ['tree-benefits-calculator', 'kaya-identity-calculator'],
    checks: [
      { inputs: {}, expect: { period: '10 kg', year: '10.95 t' } },
      { inputs: { people: 100, hours: 2, perday: 0.9 }, expect: { period: '7.5 kg', year: '32.85 t' } },
      { inputs: { hours: 24, people: 1, perday: 1 }, expect: { period: '1 kg' } },
    ],
  },
  {
    slug: 'tree-benefits-calculator',
    category: 'ecology',
    tier: 2,
    subCluster: 'Sustainable living',
    title: 'Tree Benefits Calculator: CO2 Absorbed by Planted Trees',
    h1: 'Tree Benefits Calculator',
    metaDescription:
      'Estimate the carbon dioxide a number of trees absorb over the years, in kilograms and tonnes, and compare it with a car driven for a year.',
    about:
      'Trees take carbon dioxide from the air as they grow and store the carbon in wood and roots. A figure often quoted is about 22 kilograms of CO2 a year for a mature tree, though a young sapling takes in far less and a large old tree much more. Enter how many trees you plant, how long you count their growth and the absorption per tree per year, and the calculator returns the total in kilograms and tonnes, and how many years of a typical passenger car the total represents. Survival matters, so reduce the count to the number you expect to live.',
    inputs: [
      intField('trees', 'Trees', 10, 1, 10000000),
      intField('years', 'Years of growth', 20, 1, 200),
      field('perTree', 'CO2 per tree per year (kg)', 22, 0.1, 500),
      field('car', 'CO2 of a car per year (kg)', 4600, 500, 20000),
    ],
    outputs: [
      { name: 'total', label: 'CO2 absorbed in total', format: 'text', highlight: true },
      { name: 'tonnes', label: 'In tonnes', format: 'text' },
      { name: 'yearly', label: 'Per year', format: 'text' },
      { name: 'cars', label: 'Car-years of emissions', format: 'text' },
    ],
    calculate: (i) => {
      const yearly = toD(i.trees).mul(toD(i.perTree));
      const total = yearly.mul(toD(i.years));
      return { total: kg(total, 0), tonnes: `${fmtNumber(total.div(1000), 2)} t`, yearly: kg(yearly, 0), cars: fmtNumber(total.div(toD(i.car)), 2) };
    },
    formulaDescription: "Per year = trees × kg per tree. Total = per year × years. Car-years = total ÷ a car's annual emissions.",
    workedExample:
      '10 trees at 22 kg a year absorb 220 kg a year, so 4,400 kg or 4.4 tonnes over 20 years. A car emitting 4,600 kg a year is matched for 0.96 of a year.',
    faq: [
      {
        question: 'Is 22 kg per tree right?',
        answer: 'It is a commonly quoted average for a mature tree. Species, climate, age and soil change it, and young trees absorb much less.',
      },
      {
        question: 'Do trees fix climate change?',
        answer: "Planting helps, but one tree offsets only a small fraction of a car's annual emissions, so cutting emissions matters most.",
      },
      {
        question: 'What if some trees die?',
        answer: 'Enter only the number you expect to survive. Protecting existing forest also avoids emissions that planting cannot replace.',
      },
    ],
    scenarios: mixed(
      'tree-benefits-calculator',
      8,
      (r) => ({ trees: Math.round(r(1, 5000)), years: Math.round(r(5, 60)), perTree: r(5, 48), car: Math.round(r(2500, 7000)) }),
      (v) => `${v.trees} trees for ${v.years} years at ${v.perTree} kg each, a car at ${v.car} kg`,
    ),
    introOutputs: ['total'],
    relatedSlugs: ['christmas-tree-footprint-calculator', 'co2-breathing-emission-calculator'],
    checks: [
      { inputs: {}, expect: { total: '4,400 kg', tonnes: '4.4 t', yearly: '220 kg', cars: '0.96' } },
      { inputs: { trees: 1, years: 1 }, expect: { total: '22 kg', cars: '0' } },
      { inputs: { trees: 100, years: 10, perTree: 10, car: 5000 }, expect: { total: '10,000 kg', cars: '2' } },
    ],
  },
  {
    slug: 'books-vs-ebooks-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Sustainable living',
    title: 'Books vs E-Readers Calculator: How Many Books to Break Even',
    h1: 'Books vs E-Books Footprint Calculator',
    metaDescription:
      'Find how many printed books an e-reader must replace before its manufacturing footprint is lower, and the net saving over your reading years.',
    about:
      'An e-reader is made from metals, plastics and electronics and has a large footprint on day one, while each printed book has a smaller footprint of paper, ink, printing and transport. The e-reader wins once it has replaced enough books, and the break-even depends on how much you read. Enter the footprint of the device, the footprint of one printed book, how many books you read in a year and for how many years you will use the device. The calculator gives the break-even count of books, the time it takes and the net saving. Electricity for reading is small and left out, and library or second-hand books change the sum.',
    inputs: [
      field('device', 'E-reader footprint (kg CO2e)', 168, 10, 1000),
      field('book', 'One printed book (kg CO2e)', 2.7, 0.1, 30),
      intField('perYear', 'Books read per year', 20, 1, 1000),
      intField('years', 'Years you use the device', 5, 1, 30),
    ],
    outputs: [
      { name: 'breakeven', label: 'Books to break even', format: 'text', highlight: true },
      { name: 'time', label: 'Time to break even', format: 'text' },
      { name: 'net', label: 'Net saving over your years', format: 'text' },
    ],
    calculate: (i) => {
      const device = toD(i.device);
      const book = toD(i.book);
      const breakeven = device.div(book).ceil();
      const books = toD(i.perYear).mul(toD(i.years));
      return { breakeven: fmtNumber(breakeven, 0), time: `${fmtNumber(breakeven.div(toD(i.perYear)), 2)} years`, net: kg(books.mul(book).minus(device), 1) };
    },
    formulaDescription:
      'Break-even books = e-reader footprint ÷ footprint of one printed book, rounded up. Time = break-even books ÷ books per year. Net saving = books read × book footprint − e-reader footprint, negative when the device has not yet paid back.',
    workedExample:
      '168 kg ÷ 2.7 kg is 62.2, so 63 books. At 20 books a year that takes 3.15 years, and over five years 100 books at 2.7 kg save 270 − 168 = 102 kg.',
    faq: [
      {
        question: 'Why do estimates of a printed book vary so much?',
        answer:
          'Footprints range from about 1 to 8 kg of CO2e depending on paper, length, print run and shipping, so use the figure for the books you actually buy.',
      },
      {
        question: 'What about library or second-hand books?',
        answer: 'A borrowed or second-hand book has a very small footprint per read, which can make a device hard to justify on climate grounds alone.',
      },
      {
        question: 'Does the e-reader use electricity?',
        answer: 'Very little: a charge lasts weeks, so its running emissions are small compared with making the device.',
      },
    ],
    scenarios: mixed(
      'books-vs-ebooks-calculator',
      8,
      (r) => ({ device: Math.round(r(40, 400)), book: r(0.8, 7), perYear: Math.round(r(3, 90)), years: Math.round(r(1, 12)) }),
      (v) => `a ${v.device} kg device against ${v.book} kg books, ${v.perYear} a year for ${v.years} years`,
    ),
    introOutputs: ['breakeven'],
    relatedSlugs: ['plastic-footprint-calculator', 'bag-footprint-calculator'],
    checks: [
      { inputs: {}, expect: { breakeven: '63', time: '3.15 years', net: '102 kg' } },
      { inputs: { perYear: 40 }, expect: { time: '1.58 years', net: '372 kg' } },
      { inputs: { perYear: 5 }, expect: { net: '-100.5 kg' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
