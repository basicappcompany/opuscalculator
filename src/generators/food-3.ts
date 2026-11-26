import { selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtCurrency, fmtNumber, fmtPercent } from '../lib/format';
import { defineCalculator, mixed, type Spec } from '../lib/spec';
import { field, intField, varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 12 (food): coffee and holiday calories, baking and pricing, spreads, and a ham timer. Calorie and
 * time figures are typical values and say so on the page; food-safety temperatures are quoted as reminders to use a
 * thermometer, never as the only authority. No curing-salt doses and no drinking games. Money pages use fmtCurrency
 * with `($)` labels. Tier 2 or 3, so none is live until the cohort gate opens. Food shows the category disclaimer.
 */

const select = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});

/** Minutes written as hours and minutes: 100 gives "1 h 40 min", 240 gives "4 h", 45 gives "45 min". */
function hoursMinutes(minutes: Dec): string {
  const total = minutes.toDecimalPlaces(0);
  const h = total.div(60).floor();
  const m = total.minus(h.mul(60));
  if (h.isZero()) return `${m.toFixed(0)} min`;
  return m.isZero() ? `${h.toFixed(0)} h` : `${h.toFixed(0)} h ${m.toFixed(0)} min`;
}

const HAMS: Record<string, { label: string; lo: number; hi: number; target: string }> = {
  cookedWhole: { label: 'Fully cooked, whole', lo: 10, hi: 15, target: 'Reheat until a thermometer in the thickest part reads 140 °F (60 °C)' },
  cookedHalf: { label: 'Fully cooked, half', lo: 15, hi: 18, target: 'Reheat until a thermometer in the thickest part reads 140 °F (60 °C)' },
  rawWhole: {
    label: 'Raw (cook before eating), whole',
    lo: 18,
    hi: 20,
    target: 'Cook until a thermometer in the thickest part reads 145 °F (63 °C), then rest for 3 minutes',
  },
  rawHalf: {
    label: 'Raw (cook before eating), half',
    lo: 22,
    hi: 25,
    target: 'Cook until a thermometer in the thickest part reads 145 °F (63 °C), then rest for 3 minutes',
  },
};

const GANACHE: Record<string, { label: string; ratio: string }> = {
  darkGlaze: { label: 'Dark chocolate, pouring glaze (1 : 1)', ratio: '1' },
  darkTruffle: { label: 'Dark chocolate, truffles or filling (2 : 1)', ratio: '2' },
  milkGlaze: { label: 'Milk chocolate, pouring glaze (1.5 : 1)', ratio: '1.5' },
  milkTruffle: { label: 'Milk chocolate, truffles or filling (2.5 : 1)', ratio: '2.5' },
  whiteGlaze: { label: 'White chocolate, pouring glaze (2 : 1)', ratio: '2' },
  whiteTruffle: { label: 'White chocolate, truffles or filling (3 : 1)', ratio: '3' },
};

const DONUT_PERCENTS = { flour: '100', milk: '55', sugar: '12', butter: '10', egg: '12', yeast: '1.5', salt: '1.8' } as const;
const DONUT_TOTAL = Object.values(DONUT_PERCENTS).reduce((sum, p) => sum.plus(p), new D(0));

const THANKS: [string, string, number][] = [
  ['turkey', 'Turkey, 4 oz', 190],
  ['stuffing', 'Stuffing, ½ cup', 180],
  ['mash', 'Mashed potatoes, ½ cup', 120],
  ['gravy', 'Gravy, ¼ cup', 30],
  ['cranberry', 'Cranberry sauce, ¼ cup', 105],
  ['beans', 'Green bean casserole, ½ cup', 130],
  ['roll', 'Dinner roll, 1', 110],
  ['pie', 'Pumpkin pie, 1 slice', 320],
];

const SALAD: [string, string, number, number][] = [
  ['greens', 'Mixed salad leaves', 15, 100],
  ['tomato', 'Tomato', 18, 80],
  ['cucumber', 'Cucumber', 15, 60],
  ['chicken', 'Cooked chicken breast', 165, 100],
  ['cheese', 'Cheddar cheese', 403, 30],
  ['croutons', 'Croutons', 407, 20],
  ['oil', 'Olive oil', 884, 10],
];

export const SPECS: Spec[] = [
  {
    slug: 'coffee-footprint-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Tea and coffee',
    title: 'Coffee Carbon Footprint Calculator: CO2e per Cup and per Year',
    h1: 'Coffee Carbon Footprint Calculator',
    metaDescription: 'Estimate the greenhouse gas emissions of your daily coffee from cups per day, grounds per cup, milk and editable emission factors.',
    about:
      'Most of the footprint of a cup of coffee comes from growing and processing the beans, and the milk added to it can be as large a share as the coffee itself. Enter how many cups you drink a day, the grams of ground coffee in each, the amount of milk and two emission factors in kilograms of carbon dioxide equivalent: one per kilogram of ground coffee and one per litre of milk. The defaults are round placeholders and published figures vary widely with farm, roast, transport and brewing. The page returns the emissions of one cup, of a year of drinking and the share that comes from the milk.',
    inputs: [
      intField('cups', 'Cups per day', 2, 1, 40),
      field('grams', 'Ground coffee per cup (g)', 10, 1, 60),
      field('coffee', 'Footprint of ground coffee (kg CO2e per kg)', 15, 1, 100),
      field('milk', 'Milk per cup (mL)', 50, 0, 500),
      field('milkf', 'Footprint of milk (kg CO2e per litre)', 1.4, 0, 20),
    ],
    outputs: [
      { name: 'cup', label: 'CO2e per cup', format: 'text' },
      { name: 'year', label: 'CO2e per year', format: 'text', highlight: true },
      { name: 'share', label: 'Share from the milk', format: 'text' },
    ],
    calculate: (i) => {
      const beans = toD(i.grams).div(1000).mul(toD(i.coffee));
      const milk = toD(i.milk).div(1000).mul(toD(i.milkf));
      const cup = beans.plus(milk);
      return {
        cup: `${fmtNumber(cup, 3)} kg`,
        year: `${fmtNumber(cup.mul(toD(i.cups)).mul(365), 1)} kg`,
        share: cup.isZero() ? '0%' : fmtPercent(milk.div(cup).mul(100), 1),
      };
    },
    formulaDescription:
      'Per cup = grams ÷ 1,000 × coffee factor + mL ÷ 1,000 × milk factor. Per year = per cup × cups per day × 365. Milk share = milk part ÷ per cup × 100.',
    workedExample:
      '10 g of coffee at 15 kg/kg is 0.15 kg and 50 mL of milk at 1.4 kg/L is 0.07 kg, so 0.22 kg a cup. Two cups a day for 365 days is 160.6 kg, and the milk is 31.8% of it. Without milk: 0.15 kg and 109.5 kg.',
    faq: [
      {
        question: 'Why does milk matter so much?',
        answer: 'Dairy has a high footprint per litre. A flat white can have more emissions from the milk than from the beans.',
      },
      {
        question: 'Do the factors cover brewing?',
        answer: 'No. The electricity for a machine, the water and the cup or capsule are not in these two factors.',
      },
      {
        question: 'What lowers it?',
        answer: 'Using less milk or a plant-based one, brewing only what you drink, avoiding single-use capsules and buying beans that are not air freighted.',
      },
    ],
    scenarios: mixed(
      'coffee-footprint-calculator',
      8,
      (r) => ({ cups: Math.round(r(1, 8)), grams: r(6, 20), coffee: Math.round(r(8, 30)), milk: Math.round(r(0, 200)), milkf: r(0.4, 2.2) }),
      (v) => `${v.cups} cups of ${v.grams} g at ${v.coffee} kg/kg, ${v.milk} mL milk at ${v.milkf}`,
    ),
    introOutputs: ['year'],
    relatedSlugs: ['coffee-calculator', 'coffee-to-water-ratio-calculator'],
    checks: [
      { inputs: {}, expect: { cup: '0.22 kg', year: '160.6 kg', share: '31.8%' } },
      { inputs: { milk: 0 }, expect: { cup: '0.15 kg', year: '109.5 kg', share: '0.0%' } },
      { inputs: { cups: 4, grams: 12, coffee: 20, milk: 100, milkf: 1 }, expect: { cup: '0.34 kg', year: '496.4 kg' } },
    ],
  },
  {
    slug: 'cake-pricing-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Desserts and baking',
    title: 'Cake Pricing Calculator: Price per Cake and per Slice',
    h1: 'Cake Pricing Calculator',
    metaDescription: 'Price a cake from ingredients, packaging, hours worked, overhead and markup, with the price per slice.',
    about:
      'A home baker who prices a cake by the cost of flour and sugar alone ends up working for nothing. A sound price covers the ingredients and packaging, the hours spent baking and decorating at a fair hourly rate, a share of overheads such as oven time, electricity, insurance and fees, and a profit on top. Enter each cost, the overhead percentage and the markup, and the number of slices, and the page returns the total cost, the selling price and the price per slice. Check local rules on selling food from home, since many places require registration or a licence.',
    inputs: [
      field('ingredients', 'Ingredients ($)', 18, 0, 10000),
      field('packaging', 'Box, board and ribbon ($)', 3, 0, 10000),
      field('hours', 'Hours of work', 3, 0, 200),
      field('wage', 'Hourly rate ($)', 20, 0, 1000),
      field('overhead', 'Overhead on top (%)', 15, 0, 200),
      field('markup', 'Markup for profit (%)', 30, 0, 500),
      intField('slices', 'Slices', 24, 1, 500),
    ],
    outputs: [
      { name: 'cost', label: 'Total cost', format: 'text' },
      { name: 'price', label: 'Selling price', format: 'text', highlight: true },
      { name: 'slice', label: 'Price per slice', format: 'text' },
    ],
    calculate: (i) => {
      const direct = toD(i.ingredients)
        .plus(toD(i.packaging))
        .plus(toD(i.hours).mul(toD(i.wage)));
      const cost = direct.mul(new D(1).plus(toD(i.overhead).div(100)));
      const price = cost.mul(new D(1).plus(toD(i.markup).div(100)));
      return { cost: fmtCurrency(cost), price: fmtCurrency(price), slice: fmtCurrency(price.div(toD(i.slices))) };
    },
    formulaDescription:
      'Direct cost = ingredients + packaging + hours × hourly rate. Total cost = direct × (1 + overhead%). Price = total cost × (1 + markup%). Per slice = price ÷ slices.',
    workedExample:
      '$18 of ingredients, $3 of packaging and 3 hours at $20 make $81. Overhead of 15% brings the cost to $93.15, a 30% markup gives a price of $121.10, and 24 slices come to $5.05 each.',
    faq: [
      {
        question: 'What should my hourly rate be?',
        answer: 'Use at least the local minimum wage and more for skilled decoration. Count shopping, cleaning and delivery time as well as baking.',
      },
      {
        question: 'What is overhead?',
        answer: 'The cost of running the kitchen that is not in a single cake: energy, equipment, insurance, licences and card fees, spread over each order.',
      },
      { question: 'Is markup the same as margin?', answer: 'No. A 30% markup on cost is a margin of about 23% of the price. This page uses markup.' },
    ],
    scenarios: mixed(
      'cake-pricing-calculator',
      8,
      (r) => ({
        ingredients: Math.round(r(6, 80)),
        packaging: Math.round(r(1, 15)),
        hours: r(1, 9),
        wage: Math.round(r(12, 45)),
        overhead: Math.round(r(5, 30)),
        markup: Math.round(r(10, 60)),
        slices: Math.round(r(8, 60)),
      }),
      (v) => `ingredients ${v.ingredients}, box ${v.packaging}, ${v.hours} h at ${v.wage}, overhead ${v.overhead}%, markup ${v.markup}%, ${v.slices} slices`,
    ),
    introOutputs: ['price'],
    relatedSlugs: ['cake-serving-calculator', 'cake-pan-converter-calculator'],
    checks: [
      { inputs: {}, expect: { cost: '$93.15', price: '$121.10', slice: '$5.05' } },
      {
        inputs: { ingredients: 30, packaging: 5, hours: 4, wage: 25, overhead: 10, markup: 50, slices: 12 },
        expect: { cost: '$148.50', price: '$222.75', slice: '$18.56' },
      },
      { inputs: { ingredients: 0, packaging: 0, hours: 0 }, expect: { price: '$0.00' } },
    ],
  },
  {
    slug: 'chocolate-ganache-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Desserts and baking',
    title: 'Chocolate Ganache Calculator: Chocolate and Cream by Weight',
    h1: 'Chocolate Ganache Calculator',
    metaDescription: 'Split a wanted weight of ganache into chocolate and cream for dark, milk or white chocolate and for a glaze or a firm truffle filling.',
    about:
      'Ganache is only chocolate and cream, but the ratio decides what it does. Equal weights make a soft pouring glaze, while two or three parts of chocolate to one of cream set firm enough to roll into truffles. Milk and white chocolate contain more milk solids and sugar and less cocoa, so they need more chocolate for the same firmness. Choose the chocolate and the use, enter the total weight of ganache you want, and the page splits it into grams of chocolate and cream and the ratio used. Heat the cream, pour it on chopped chocolate and stir gently so the emulsion does not split.',
    inputs: [
      select(
        'type',
        'Chocolate and use',
        'darkTruffle',
        Object.entries(GANACHE).map(([k, v]): [string, string] => [k, v.label]),
      ),
      field('total', 'Total ganache wanted (g)', 400, 20, 20000),
    ],
    outputs: [
      { name: 'choc', label: 'Chocolate', format: 'text', highlight: true },
      { name: 'cream', label: 'Cream', format: 'text' },
      { name: 'ratio', label: 'Ratio chocolate : cream', format: 'text' },
    ],
    calculate: (i) => {
      const ratio = new D((GANACHE[String(i.type)] ?? GANACHE.darkTruffle).ratio);
      const total = toD(i.total);
      return {
        choc: `${fmtNumber(total.mul(ratio).div(ratio.plus(1)), 1)} g`,
        cream: `${fmtNumber(total.div(ratio.plus(1)), 1)} g`,
        ratio: `${ratio.toString()} : 1`,
      };
    },
    formulaDescription:
      'Chocolate = total × r ÷ (r + 1). Cream = total ÷ (r + 1). The ratio r of chocolate to cream by weight is 1 (dark glaze), 2 (dark truffle), 1.5 and 2.5 (milk), 2 and 3 (white).',
    workedExample:
      '400 g of dark ganache for truffles at 2 : 1 is 266.7 g of chocolate and 133.3 g of cream. The same weight of white chocolate for truffles at 3 : 1 is 300 g of chocolate and 100 g of cream.',
    faq: [
      {
        question: 'Why does white chocolate need more chocolate?',
        answer: 'It has no cocoa solids to set the mixture, so more cocoa butter and sugar by weight is needed for the same firmness.',
      },
      {
        question: 'What if it splits?',
        answer: 'Add a spoonful of warm cream and stir from the centre. A hand blender can bring a split ganache back together.',
      },
      { question: 'Can I whip it?', answer: 'Yes, once cool. Chilled glaze-strength ganache whips into a light frosting.' },
    ],
    scenarios: varied(
      'chocolate-ganache-calculator',
      8,
      [{ name: 'total', lo: 60, hi: 2200, step: 10 }],
      [{ name: 'type', options: ['darkGlaze', 'darkTruffle', 'milkGlaze', 'milkTruffle', 'whiteGlaze', 'whiteTruffle'] }],
      (v) => `${v.total} g of ${v.type}`,
    ),
    introOutputs: ['choc'],
    relatedSlugs: ['cake-serving-calculator', 'ice-cream-calculator'],
    checks: [
      { inputs: {}, expect: { choc: '266.7 g', cream: '133.3 g', ratio: '2 : 1' } },
      { inputs: { type: 'darkGlaze' }, expect: { choc: '200 g', cream: '200 g', ratio: '1 : 1' } },
      { inputs: { type: 'milkTruffle' }, expect: { choc: '285.7 g', cream: '114.3 g', ratio: '2.5 : 1' } },
      { inputs: { type: 'whiteTruffle' }, expect: { choc: '300 g', cream: '100 g' } },
      { inputs: { type: 'milkGlaze' }, expect: { choc: '240 g', cream: '160 g' } },
    ],
  },
  {
    slug: 'donut-dough-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Desserts and baking',
    title: 'Donut Dough Calculator: Ingredients for a Yeast Donut Batch',
    h1: 'Donut Dough Calculator',
    metaDescription: 'Scale a yeast donut dough to the number of donuts and the weight of each, with grams of flour, milk, sugar, butter, egg, yeast and salt.',
    about:
      "A yeast donut dough is a rich, soft dough, and like any bread it is easiest to scale in baker's percentages, where every ingredient is a share of the flour weight. This recipe uses flour at 100 percent, milk at 55, sugar at 12, butter at 10, egg at 12, instant yeast at 1.5 and salt at 1.8. Enter the number of donuts and the raw dough weight of each, and the page adds the percentages, finds the flour that makes the total and gives every other ingredient in grams. A 65 gram piece of dough fries up into a standard ring donut. Frying oil needs a thermometer and an adult watching.",
    inputs: [intField('n', 'Number of donuts', 12, 1, 500), field('each', 'Raw dough per donut (g)', 65, 20, 300)],
    outputs: [
      { name: 'total', label: 'Total dough', format: 'text' },
      { name: 'flour', label: 'Flour', format: 'text', highlight: true },
      { name: 'milk', label: 'Milk', format: 'text' },
      { name: 'sugar', label: 'Sugar', format: 'text' },
      { name: 'butter', label: 'Butter', format: 'text' },
      { name: 'egg', label: 'Egg (beaten)', format: 'text' },
      { name: 'yeast', label: 'Instant yeast', format: 'text' },
      { name: 'salt', label: 'Salt', format: 'text' },
    ],
    calculate: (i) => {
      const total = toD(i.n).mul(toD(i.each));
      const part = (p: string) => `${fmtNumber(total.mul(p).div(DONUT_TOTAL), 1)} g`;
      return {
        total: `${fmtNumber(total, 0)} g`,
        flour: part(DONUT_PERCENTS.flour),
        milk: part(DONUT_PERCENTS.milk),
        sugar: part(DONUT_PERCENTS.sugar),
        butter: part(DONUT_PERCENTS.butter),
        egg: part(DONUT_PERCENTS.egg),
        yeast: part(DONUT_PERCENTS.yeast),
        salt: part(DONUT_PERCENTS.salt),
      };
    },
    formulaDescription:
      'Total dough = donuts × dough per donut. The percentages add to 192.3. Each ingredient = total × its percentage ÷ 192.3, so flour = total ÷ 1.923.',
    workedExample:
      '12 donuts of 65 g need 780 g of dough: flour 405.6 g, milk 223.1 g, sugar 48.7 g, butter 40.6 g, egg 48.7 g, instant yeast 6.1 g and salt 7.3 g.',
    faq: [
      {
        question: 'How much dough makes a donut?',
        answer: 'About 55 to 70 g of raw dough for a ring, and the piece is cut with a cutter and rested before frying.',
      },
      { question: 'Can I use active dry yeast?', answer: 'Yes, at about 1.33 times the instant amount, dissolved in the warm milk first.' },
      {
        question: 'What oil temperature should I use?',
        answer: 'Around 175 to 185 °C (350 to 365 °F), checked with a thermometer. Too cool and they soak up oil; too hot and the outside burns.',
      },
    ],
    scenarios: mixed(
      'donut-dough-calculator',
      8,
      (r) => ({ n: Math.round(r(4, 60)), each: Math.round(r(40, 110)) }),
      (v) => `${v.n} donuts of ${v.each} g dough`,
    ),
    introOutputs: ['flour'],
    relatedSlugs: ['pizza-dough-calculator', 'bakers-percentage-calculator'],
    checks: [
      {
        inputs: {},
        expect: { total: '780 g', flour: '405.6 g', milk: '223.1 g', sugar: '48.7 g', butter: '40.6 g', egg: '48.7 g', yeast: '6.1 g', salt: '7.3 g' },
      },
      { inputs: { n: 24, each: 50 }, expect: { total: '1,200 g', flour: '624 g', milk: '343.2 g', yeast: '9.4 g', salt: '11.2 g' } },
      { inputs: { n: 1, each: 20 }, expect: { total: '20 g' } },
    ],
  },
  {
    slug: 'thanksgiving-calories-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Thanksgiving',
    title: 'Thanksgiving Dinner Calories Calculator by Dish',
    h1: 'Thanksgiving Calories Calculator',
    metaDescription:
      'Add up the calories of a holiday plate from the number of portions of turkey, stuffing, potatoes, gravy, sauce, casserole, rolls and pie.',
    about:
      'A holiday plate is built from many small helpings, and the calories add up faster than most people expect. Enter how many portions you expect to eat of eight classic dishes, each with a typical portion size shown in its label, and the page adds up the calories and compares the total with a 2,000 calorie reference day. The calorie values are typical estimates, because recipes vary: butter, cream, sugar and the way the turkey is cooked all change them. Use the result to plan, not as a diet target, and adjust a portion in half-portion steps to match your own plate.',
    inputs: THANKS.map(([name, label, kcal]) => field(name, `${label} (${kcal} kcal) — portions`, 1, 0, 10)),
    outputs: [
      { name: 'kcal', label: 'Total calories', format: 'text', highlight: true },
      { name: 'pct', label: 'Share of a 2,000 kcal day', format: 'text' },
    ],
    calculate: (i) => {
      const total = THANKS.reduce((sum, [name, , kcal]) => sum.plus(toD(i[name]).mul(kcal)), new D(0));
      return { kcal: `${fmtNumber(total, 0)} kcal`, pct: fmtPercent(total.div(2000).mul(100), 1) };
    },
    formulaDescription:
      'Calories = Σ portions × calories per portion. Share = calories ÷ 2,000 × 100. The per-portion values are typical estimates: turkey 190, stuffing 180, mashed potatoes 120, gravy 30, cranberry sauce 105, green bean casserole 130, roll 110, pumpkin pie 320.',
    workedExample:
      'One portion of each dish gives 190 + 180 + 120 + 30 + 105 + 130 + 110 + 320 = 1,185 kcal, 59.3% of a 2,000 kcal day. Two portions of the main dishes and rolls, none of the sauce and one pie slice give 1,710 kcal.',
    faq: [
      {
        question: 'How accurate are the calories?',
        answer: 'They are typical figures. A stuffing with sausage and butter, or a pie with a thick crust, can differ by a third or more.',
      },
      { question: 'Is 2,000 calories right for me?', answer: 'It is a reference value used on food labels. Your needs depend on age, size and activity.' },
      { question: 'Does it include drinks and starters?', answer: 'No, only the eight dishes. Add drinks and snacks separately.' },
    ],
    scenarios: mixed(
      'thanksgiving-calories-calculator',
      8,
      (r) => ({
        turkey: Math.round(r(0, 4)),
        stuffing: Math.round(r(0, 3)),
        mash: Math.round(r(0, 3)),
        gravy: Math.round(r(0, 4)),
        cranberry: Math.round(r(0, 3)),
        beans: Math.round(r(0, 3)),
        roll: Math.round(r(0, 3)),
        pie: Math.round(r(0, 3)),
      }),
      (v) =>
        `turkey ${v.turkey}, stuffing ${v.stuffing}, potatoes ${v.mash}, gravy ${v.gravy}, sauce ${v.cranberry}, casserole ${v.beans}, rolls ${v.roll}, pie ${v.pie}`,
    ),
    introOutputs: ['kcal'],
    relatedSlugs: ['thanksgiving-calculator', 'mashed-potatoes-per-person-calculator'],
    checks: [
      { inputs: {}, expect: { kcal: '1,185 kcal', pct: '59.3%' } },
      { inputs: { turkey: 2, stuffing: 2, mash: 2, gravy: 2, cranberry: 0, beans: 1, roll: 2, pie: 1 }, expect: { kcal: '1,710 kcal', pct: '85.5%' } },
      { inputs: { turkey: 0, stuffing: 0, mash: 0, gravy: 0, cranberry: 0, beans: 0, roll: 0, pie: 0 }, expect: { kcal: '0 kcal' } },
    ],
  },
  {
    slug: 'bread-spreads-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Other',
    title: 'Bread Spread Calculator: Slices per Jar and Jars Needed',
    h1: 'Bread Spreads Calculator',
    metaDescription: 'Find how many slices a jar of jam, butter or spread covers, the cost per slice and how many jars to buy for a number of slices.',
    about:
      'Whether it is jam, peanut butter, chocolate spread or honey, a jar goes further than it looks, and the number of slices it covers depends on how thickly you spread it. A thin layer is around 10 grams, a normal one 15 and a generous one 25 or more. Enter the weight of the jar, the weight you spread on a slice and the price, and the page returns the slices per jar, the cost of the spread on each slice and, for a party or a school week, how many jars to buy for a number of slices. It shows whole slices, since a part-slice means the jar is empty.',
    inputs: [
      field('jar', 'Jar weight (g)', 370, 20, 5000),
      field('slice', 'Spread per slice (g)', 15, 1, 100),
      field('price', 'Price of a jar ($)', 4.5, 0, 200),
      intField('need', 'Slices needed', 100, 1, 10000),
    ],
    outputs: [
      { name: 'slices', label: 'Slices per jar', format: 'text', highlight: true },
      { name: 'cost', label: 'Spread cost per slice', format: 'text' },
      { name: 'jars', label: 'Jars for the slices needed', format: 'text' },
    ],
    calculate: (i) => {
      const perJar = toD(i.jar).div(toD(i.slice));
      return { slices: fmtNumber(perJar.floor(), 0), cost: fmtCurrency(toD(i.price).div(perJar)), jars: fmtNumber(toD(i.need).div(perJar).ceil(), 0) };
    },
    formulaDescription:
      'Slices per jar = jar weight ÷ spread per slice, rounded down. Cost per slice = price ÷ (jar ÷ spread). Jars needed = slices ÷ (jar ÷ spread), rounded up.',
    workedExample: 'A 370 g jar at 15 g a slice covers 24 slices, about $0.18 each at $4.50. For 100 slices you need 100 × 15 ÷ 370 = 4.05, so 5 jars.',
    faq: [
      {
        question: 'How much spread is a normal amount?',
        answer: 'About 15 g is a level tablespoon of jam or peanut butter. Thin is 8 to 10 g and thick is 25 g or more.',
      },
      { question: 'Why round the jars up?', answer: 'You cannot buy part of a jar, and the last one will be a little left over.' },
      { question: 'Does it work for butter?', answer: 'Yes. A 250 g pack at 10 g a slice covers 25 slices.' },
    ],
    scenarios: mixed(
      'bread-spreads-calculator',
      8,
      (r) => ({ jar: Math.round(r(150, 900)), slice: Math.round(r(6, 30)), price: r(1.5, 9), need: Math.round(r(20, 400)) }),
      (v) => `${v.jar} g jar, ${v.slice} g a slice at ${v.price}, ${v.need} slices`,
    ),
    introOutputs: ['slices'],
    relatedSlugs: ['butter-stick-calculator', 'grams-to-tablespoons-calculator'],
    checks: [
      { inputs: {}, expect: { slices: '24', cost: '$0.18', jars: '5' } },
      { inputs: { jar: 500, slice: 10, price: 3, need: 60 }, expect: { slices: '50', cost: '$0.06', jars: '2' } },
      { inputs: { jar: 100, slice: 100, need: 1 }, expect: { slices: '1', jars: '1' } },
    ],
  },
  {
    slug: 'ham-cooking-time-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Other',
    title: 'Ham Cooking Time Calculator by Weight and Type',
    h1: 'Ham Cooking Time Calculator',
    metaDescription: 'Estimate the oven time for a ham from its weight and whether it is fully cooked or raw, whole or half, at 325 degrees Fahrenheit.',
    about:
      'Hams are sold fully cooked, which only need reheating, or raw, which must be cooked through, and they come whole or as a half. Oven time scales with weight, in minutes per pound at 325 degrees Fahrenheit, with a range because ovens and hams differ. Enter the weight in pounds or kilograms and choose the type, and the page returns the time range in hours and minutes and the internal temperature to aim for. The times are only an estimate for planning when to put it in. The ham is ready when a food thermometer in the thickest part, away from the bone, reads the safe temperature.',
    inputs: [
      field('weight', 'Weight', 10, 1, 40),
      select('unit', 'Unit', 'lb', [
        ['lb', 'Pounds'],
        ['kg', 'Kilograms'],
      ]),
      select(
        'type',
        'Type of ham',
        'cookedWhole',
        Object.entries(HAMS).map(([k, v]): [string, string] => [k, v.label]),
      ),
    ],
    outputs: [
      { name: 'time', label: 'Oven time at 325 °F (163 °C)', format: 'text', highlight: true },
      { name: 'pounds', label: 'Weight in pounds', format: 'text' },
      { name: 'target', label: 'Check with a thermometer', format: 'text' },
    ],
    calculate: (i) => {
      const ham = HAMS[String(i.type)] ?? HAMS.cookedWhole;
      const pounds = String(i.unit) === 'kg' ? toD(i.weight).mul('2.20462262185') : toD(i.weight);
      return { time: `${hoursMinutes(pounds.mul(ham.lo))} to ${hoursMinutes(pounds.mul(ham.hi))}`, pounds: `${fmtNumber(pounds, 1)} lb`, target: ham.target };
    },
    formulaDescription:
      'Time = pounds × minutes per pound, shown as a range. Whole fully cooked 10 to 15; half fully cooked 15 to 18; raw whole 18 to 20; raw half 22 to 25 minutes per pound, at 325 °F. Kilograms × 2.2046 = pounds.',
    workedExample:
      'A fully cooked 10 lb whole ham needs 100 to 150 minutes, so 1 h 40 min to 2 h 30 min. A raw 12 lb whole ham needs 216 to 240 minutes, 3 h 36 min to 4 h.',
    faq: [
      {
        question: 'What temperature is safe?',
        answer:
          'Guidance for reheating a fully cooked ham is 140 °F (60 °C) and for a raw ham 145 °F (63 °C) with a three-minute rest. Always check with a thermometer.',
      },
      {
        question: 'Should I cover the ham?',
        answer: 'Cover it loosely with foil for most of the time so it does not dry out, then uncover to glaze for the last 20 to 30 minutes.',
      },
      {
        question: 'Does a bone change the time?',
        answer: 'A bone-in ham takes about the same per pound, but start checking early and keep the probe clear of the bone.',
      },
    ],
    scenarios: varied(
      'ham-cooking-time-calculator',
      8,
      [{ name: 'weight', lo: 3, hi: 24, step: 0.5 }],
      [
        { name: 'type', options: ['cookedWhole', 'cookedHalf', 'rawWhole', 'rawHalf'] },
        { name: 'unit', options: ['lb'] },
      ],
      (v) => `${v.weight} lb ${v.type}`,
    ),
    introOutputs: ['time'],
    relatedSlugs: ['ham-per-person-calculator', 'turkey-cooking-time-calculator'],
    checks: [
      { inputs: {}, expect: { time: '1 h 40 min to 2 h 30 min', pounds: '10 lb' } },
      { inputs: { weight: 12, type: 'rawWhole' }, expect: { time: '3 h 36 min to 4 h' } },
      { inputs: { weight: 8, type: 'cookedHalf' }, expect: { time: '2 h to 2 h 24 min' } },
      {
        inputs: { weight: 6, type: 'rawHalf' },
        expect: { time: '2 h 12 min to 2 h 30 min', target: 'Cook until a thermometer in the thickest part reads 145 °F (63 °C), then rest for 3 minutes' },
      },
    ],
  },
  {
    slug: 'salad-calories-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Other',
    title: 'Salad Calories Calculator: Total Calories from Ingredients',
    h1: 'Salad Calories Calculator',
    metaDescription: 'Add up the calories of a salad from the grams of leaves, vegetables, chicken, cheese, croutons and oil, with calories per 100 g.',
    about:
      'A salad can be light or as heavy as a burger depending on what goes in. Leaves and most vegetables add very little, while cheese, croutons and above all oil carry most of the calories because they are dense in fat. Enter the grams of each ingredient and the page multiplies each by its calories per 100 grams, adds them up and shows the total, the weight of the salad and its calories per 100 grams. A tablespoon of olive oil is about 13 grams and 115 calories. The values are typical, so check your own cheese, dressing and brand of croutons against their labels.',
    inputs: SALAD.map(([name, label, kcal, def]) => field(name, `${label} (${kcal} kcal per 100 g) — grams`, def, 0, 2000)),
    outputs: [
      { name: 'kcal', label: 'Total calories', format: 'text', highlight: true },
      { name: 'grams', label: 'Total weight', format: 'text' },
      { name: 'per100', label: 'Calories per 100 g', format: 'text' },
    ],
    calculate: (i) => {
      const grams = SALAD.reduce((sum, [name]) => sum.plus(toD(i[name])), new D(0));
      const kcal = SALAD.reduce((sum, [name, , per100]) => sum.plus(toD(i[name]).mul(per100).div(100)), new D(0));
      return { kcal: `${fmtNumber(kcal, 0)} kcal`, grams: `${fmtNumber(grams, 0)} g`, per100: grams.isZero() ? '-' : fmtNumber(kcal.div(grams).mul(100), 1) };
    },
    formulaDescription:
      'Calories = Σ grams × calories per 100 g ÷ 100. Per 100 g = total calories ÷ total grams × 100. Per 100 g values: leaves 15, tomato 18, cucumber 15, chicken breast 165, cheddar 403, croutons 407, olive oil 884.',
    workedExample:
      '100 g leaves, 80 g tomato, 60 g cucumber, 100 g chicken, 30 g cheddar, 20 g croutons and 10 g oil total 494 kcal in 400 g, or 123.5 kcal per 100 g. The 10 g of oil alone is 88 kcal.',
    faq: [
      {
        question: 'Why does a small amount of oil count so much?',
        answer: 'Fat has 9 calories per gram against 4 for protein and carbohydrate, and oil is pure fat.',
      },
      {
        question: 'What about a bottled dressing?',
        answer: 'Check the label. Creamy dressings are often 300 to 500 calories per 100 g; vinaigrettes are mostly oil.',
      },
      {
        question: 'Does cooking change the values?',
        answer: 'The values are for the foods as listed, and chicken is cooked weight. Raw weights give different numbers.',
      },
    ],
    scenarios: mixed(
      'salad-calories-calculator',
      8,
      (r) => ({
        greens: Math.round(r(30, 250)),
        tomato: Math.round(r(0, 150)),
        cucumber: Math.round(r(0, 120)),
        chicken: Math.round(r(0, 220)),
        cheese: Math.round(r(0, 70)),
        croutons: Math.round(r(0, 50)),
        oil: Math.round(r(0, 30)),
      }),
      (v) =>
        `leaves ${v.greens} g, tomato ${v.tomato} g, cucumber ${v.cucumber} g, chicken ${v.chicken} g, cheese ${v.cheese} g, croutons ${v.croutons} g, oil ${v.oil} g`,
    ),
    introOutputs: ['kcal'],
    relatedSlugs: ['thanksgiving-calories-calculator', 'dry-to-cooked-pasta-calculator'],
    checks: [
      { inputs: {}, expect: { kcal: '494 kcal', grams: '400 g', per100: '123.5' } },
      { inputs: { greens: 120, tomato: 100, cucumber: 0, chicken: 150, cheese: 0, croutons: 0, oil: 20 }, expect: { per100: '118' } },
      { inputs: { greens: 0, tomato: 0, cucumber: 0, chicken: 0, cheese: 0, croutons: 0, oil: 0 }, expect: { kcal: '0 kcal', per100: '-' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
