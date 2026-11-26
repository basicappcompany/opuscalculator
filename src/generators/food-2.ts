import { selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { field, intField, plus, rows, varied } from '../lib/spec-helpers';
import type { CalculatorConfig, Scenario } from '../lib/types';

/**
 * Catalog batch 7 (food): the rest of the cooking converters, coffee and tea, drinks, baking, party and holiday
 * planning. Planning amounts are typical rules of thumb and say so in the page copy. Temperatures and times for food
 * safety are not given as authority: pages tell the cook to use a thermometer. No money outputs and no curing-salt
 * doses. Tier 2 or 3, so none is live until the cohort gate opens.
 */

const KG_PER_LB = new D('0.45359237');
const G_PER_LB = new D('453.59237');
const G_PER_OZ = new D('28.349523125');
const ML_PER_US_CUP = new D('236.5882365');
const ML_PER_FL_OZ = new D('29.5735295625');
const LITRES_PER_GALLON = new D('3.785411784');

const select = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});

const withInputs = (label: string, inputs: Scenario['inputs']): Scenario => ({ label, inputs });

/** Grams in one US cup of common ingredients: typical bakery values, real products vary by up to about 10 %. */
const GRAMS_PER_CUP: Record<string, string> = {
  flour: '120',
  sugar: '200',
  brown: '213',
  powdered: '120',
  butter: '227',
  honey: '340',
  water: '237',
  milk: '245',
  oil: '218',
  rice: '185',
  oats: '90',
  cocoa: '85',
};
const INGREDIENTS: [string, string][] = [
  ['flour', 'All-purpose flour (120 g per cup)'],
  ['sugar', 'Granulated sugar (200 g)'],
  ['brown', 'Brown sugar, packed (213 g)'],
  ['powdered', 'Powdered sugar (120 g)'],
  ['butter', 'Butter (227 g)'],
  ['honey', 'Honey (340 g)'],
  ['water', 'Water (237 g)'],
  ['milk', 'Milk (245 g)'],
  ['oil', 'Vegetable oil (218 g)'],
  ['rice', 'Uncooked white rice (185 g)'],
  ['oats', 'Rolled oats (90 g)'],
  ['cocoa', 'Cocoa powder (85 g)'],
];
const gramsPerCup = (key: unknown): Dec => new D(GRAMS_PER_CUP[String(key)] ?? '120');

/** Millilitres per volume unit for the measurement converter. */
const VOLUME_ML: Record<string, string> = {
  tsp: '4.92892159375',
  tbsp: '14.78676478125',
  floz: '29.5735295625',
  cup: '236.5882365',
  pint: '473.176473',
  quart: '946.352946',
  gal: '3785.411784',
  ml: '1',
  l: '1000',
};
const VOLUME_UNITS: [string, string][] = [
  ['tsp', 'Teaspoons (US)'],
  ['tbsp', 'Tablespoons (US)'],
  ['floz', 'Fluid ounces (US)'],
  ['cup', 'Cups (US)'],
  ['pint', 'Pints (US)'],
  ['quart', 'Quarts (US)'],
  ['gal', 'Gallons (US)'],
  ['ml', 'Millilitres'],
  ['l', 'Litres'],
];
const UNIT_SHORT: Record<string, string> = {
  tsp: 'tsp',
  tbsp: 'tbsp',
  floz: 'fl oz',
  cup: 'cups',
  pint: 'pints',
  quart: 'quarts',
  gal: 'gal',
  ml: 'mL',
  l: 'L',
};

/** Density in g per mL for liquids and a few powders, typical values. */
const DENSITY: Record<string, string> = { water: '1', milk: '1.03', oil: '0.92', honey: '1.42', butter: '0.96', sugar: '0.85', flour: '0.51' };

const mmss = (minutes: Dec): string => {
  const total = minutes.mul(60).round();
  const m = total.div(60).floor();
  const s = total.sub(m.mul(60));
  return `${fmtNumber(m, 0)}:${s.lt(10) ? '0' : ''}${fmtNumber(s, 0)}`;
};

export const SPECS: Spec[] = [
  {
    slug: 'butter-stick-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Cooking converters',
    title: 'Butter Stick Converter: Sticks, Cups, Tablespoons and Grams',
    h1: 'Butter Stick Converter',
    metaDescription: 'Convert between sticks of butter, cups, tablespoons, grams and ounces for American recipes and block butter.',
    about:
      'American butter is sold in quarter-pound sticks wrapped in paper marked with tablespoon lines, and recipes write amounts as sticks, cups or tablespoons. A stick is half a cup, eight tablespoons or four ounces, so two sticks make a cup and a pound is four sticks. Cooks outside the United States buy butter in blocks of 250 grams and need the metric equivalent: a stick is about 113 grams. Pick the unit you have, type the amount, and the other measures appear. Because butter is mostly fat and water, it measures the same cold or softened as long as it is packed without air gaps, but melted butter loses a little volume. For baking, weigh it when you can.',
    inputs: [
      field('amount', 'Amount', 2, 0, 1000),
      select('unit', 'Unit', 'sticks', [
        ['sticks', 'Sticks'],
        ['cups', 'Cups'],
        ['tbsp', 'Tablespoons'],
        ['grams', 'Grams'],
        ['oz', 'Ounces'],
      ]),
    ],
    outputs: [
      { name: 'sticks', label: 'Sticks', format: 'text', highlight: true },
      { name: 'cups', label: 'Cups', format: 'text' },
      { name: 'tbsp', label: 'Tablespoons', format: 'text' },
      { name: 'grams', label: 'Grams', format: 'text' },
      { name: 'oz', label: 'Ounces', format: 'text' },
    ],
    calculate: (i) => {
      const stick = G_PER_OZ.mul(4);
      const per: Record<string, Dec> = { sticks: stick, cups: stick.mul(2), tbsp: stick.div(8), grams: new D(1), oz: G_PER_OZ };
      const grams = toD(i.amount).mul(per[String(i.unit)] ?? stick);
      return {
        sticks: fmtNumber(grams.div(stick), 2),
        cups: fmtNumber(grams.div(stick.mul(2)), 2),
        tbsp: fmtNumber(grams.div(stick.div(8)), 1),
        grams: `${fmtNumber(grams, 1)} g`,
        oz: `${fmtNumber(grams.div(G_PER_OZ), 2)} oz`,
      };
    },
    formulaDescription: '1 stick = ½ cup = 8 tablespoons = 4 oz = 113.4 g. Enter any unit and the amount is converted through grams.',
    workedExample: 'Two sticks of butter are 1 cup, 16 tablespoons, 8 oz or 226.8 g. A 250 g block is about 2.2 sticks.',
    faq: [
      { question: 'How much is a stick of butter in grams?', answer: 'Four ounces, which is 113.4 g. Many packs are labelled 113 g.' },
      {
        question: 'Is a block of European butter the same?',
        answer: 'A 250 g block is about 2.2 sticks or just over a cup. Use the grams figure for recipes written in metric.',
      },
      {
        question: 'Does margarine measure the same?',
        answer: 'Stick margarine follows the same sizes, but tubs are softer and whipped spreads contain air, so weigh them.',
      },
    ],
    scenarios: rows(['amount'], [[2], [1], [8], [250], [4], [113]], (v) => `${v[0]} (in the unit chosen)`).map((s, k) => ({
      ...s,
      label: ['2 sticks', '1 stick', '8 tablespoons', '250 g block', '4 oz', '113 g'][k],
      inputs: { ...s.inputs, unit: ['sticks', 'sticks', 'tbsp', 'grams', 'oz', 'grams'][k] },
    })),
    introOutputs: ['sticks', 'grams'],
    relatedSlugs: ['butter-oil-conversion-calculator', 'grams-to-cups-calculator'],
    checks: [
      { inputs: {}, expect: { sticks: '2', cups: '1', tbsp: '16', grams: '226.8 g', oz: '8 oz' } },
      { inputs: { amount: 113.4, unit: 'grams' }, expect: { sticks: '1', tbsp: '8' } },
      { inputs: { amount: 250, unit: 'grams' }, expect: { sticks: '2.2', cups: '1.1' } },
    ],
  },
  {
    slug: 'cooking-measurement-converter',
    category: 'food',
    tier: 2,
    subCluster: 'Cooking converters',
    title: 'Cooking Measurement Converter: Teaspoons, Cups, Litres',
    h1: 'Cooking Measurement Converter',
    metaDescription: 'Convert kitchen volumes between teaspoons, tablespoons, fluid ounces, cups, pints, quarts, gallons, millilitres and litres.',
    about:
      'A recipe from another country often uses a different set of measures, and kitchen volumes pile up odd ratios: three teaspoons in a tablespoon, two tablespoons in a fluid ounce, eight ounces in a cup, two cups in a pint, two pints in a quart and four quarts in a gallon. This converter handles the US customary units and the metric ones in one place. Choose the unit you have, the unit you want and the amount, and it passes through millilitres, so any pair works. Everything is a measure of volume, not weight, so it cannot turn cups of flour into grams. For that, use a page that knows the ingredient. US and imperial pints and gallons differ by about 20 percent, and this tool uses the US sizes.',
    inputs: [field('value', 'Amount', 1, 0, 1000000), select('from', 'From', 'cup', VOLUME_UNITS), select('to', 'To', 'tbsp', VOLUME_UNITS)],
    outputs: [
      { name: 'result', label: 'Converted amount', format: 'text', highlight: true },
      { name: 'ml', label: 'Same amount in millilitres', format: 'text' },
    ],
    calculate: (i) => {
      const ml = toD(i.value).mul(VOLUME_ML[String(i.from)] ?? '1');
      const out = ml.div(VOLUME_ML[String(i.to)] ?? '1');
      return { result: `${fmtNumber(out, 3)} ${UNIT_SHORT[String(i.to)] ?? ''}`, ml: `${fmtNumber(ml, 2)} mL` };
    },
    formulaDescription:
      'Amount in mL = amount × mL per unit of the starting unit. Result = mL ÷ mL per unit of the target unit. US units: 1 tsp = 4.929 mL, 1 tbsp = 14.787 mL, 1 fl oz = 29.574 mL, 1 cup = 236.588 mL, 1 gallon = 3,785.41 mL.',
    workedExample: '1 US cup is 236.59 mL, which is 16 tablespoons or 8 fluid ounces. 500 mL is 2.113 cups.',
    faq: [
      {
        question: 'Why does a US cup differ from a metric cup?',
        answer: 'A US cup is 236.6 mL, while the metric cup used in Australia and elsewhere is 250 mL. The difference matters in baking.',
      },
      {
        question: 'Are imperial pints the same?',
        answer: 'No. An imperial pint is 568 mL, about 20 percent more than the US pint of 473 mL. This converter uses US sizes.',
      },
      { question: 'Can I convert cups to grams here?', answer: 'No. Volume to weight depends on the ingredient. Use the grams to cups calculator.' },
    ],
    scenarios: [
      withInputs('1 cup to tablespoons', { value: 1, from: 'cup', to: 'tbsp' }),
      withInputs('1 gallon to cups', { value: 1, from: 'gal', to: 'cup' }),
      withInputs('500 mL to cups', { value: 500, from: 'ml', to: 'cup' }),
      withInputs('3 tablespoons to millilitres', { value: 3, from: 'tbsp', to: 'ml' }),
      withInputs('2 quarts to litres', { value: 2, from: 'quart', to: 'l' }),
    ],
    introOutputs: ['result', 'ml'],
    relatedSlugs: ['grams-to-cups-calculator', 'butter-stick-calculator'],
    checks: [
      { inputs: {}, expect: { result: '16 tbsp', ml: '236.59 mL' } },
      { inputs: { value: 1, from: 'gal', to: 'cup' }, expect: { result: '16 cups' } },
      { inputs: { value: 500, from: 'ml', to: 'cup' }, expect: { result: '2.113 cups' } },
    ],
  },
  {
    slug: 'cups-to-pounds-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Cooking converters',
    title: 'Cups to Pounds Calculator for Baking Ingredients',
    h1: 'Cups to Pounds Calculator',
    metaDescription: 'Convert cups of flour, sugar, butter, honey, rice and other ingredients to pounds, ounces and kilograms.',
    about:
      'Bulk ingredients are priced and packed by the pound, but the recipe on your counter counts cups, and the link between the two is the weight of one cup of that ingredient. A cup of flour weighs about a quarter of a pound, a cup of sugar nearer to half a pound and a cup of honey three quarters of a pound. Choose the ingredient, enter the cups and the page multiplies by its typical weight per cup, then restates the result in pounds, ounces and kilograms. Use it when you are shopping for a big batch of cookies, checking how many bags of flour a recipe consumes, or working out a portion from a bulk bin. Packing, sifting and humidity change the weight, so treat the answer as close, not exact.',
    inputs: [field('cups', 'Cups', 2, 0, 10000), select('ingredient', 'Ingredient', 'flour', INGREDIENTS)],
    outputs: [
      { name: 'lb', label: 'Pounds', format: 'text', highlight: true },
      { name: 'oz', label: 'Ounces', format: 'text' },
      { name: 'kg', label: 'Kilograms', format: 'text' },
    ],
    calculate: (i) => {
      const grams = toD(i.cups).mul(gramsPerCup(i.ingredient));
      return { lb: `${fmtNumber(grams.div(G_PER_LB), 2)} lb`, oz: `${fmtNumber(grams.div(G_PER_OZ), 2)} oz`, kg: `${fmtNumber(grams.div(1000), 2)} kg` };
    },
    formulaDescription: 'Weight in grams = cups × grams per cup of the ingredient. Pounds = grams ÷ 453.59. Ounces = grams ÷ 28.35.',
    workedExample: '2 cups of all-purpose flour weigh 2 × 120 = 240 g, which is 0.53 lb or 8.47 oz. 2 cups of honey weigh 680 g, or 1.5 lb.',
    faq: [
      {
        question: 'How many cups are in a pound of flour?',
        answer: 'About 3.8 cups of all-purpose flour, since one cup weighs around 120 g. Use the pounds to cups calculator for the reverse.',
      },
      {
        question: 'Why do pounds differ by ingredient?',
        answer: 'A cup holds the same volume, but flour is airy and honey is dense, so the weight per cup differs.',
      },
      {
        question: 'How accurate is it?',
        answer: 'Typical values only. Scooped flour can weigh 20 to 30 percent more than spooned flour, so use a scale when it counts.',
      },
    ],
    scenarios: plus(
      [
        ['flour', 2],
        ['sugar', 4],
        ['butter', 4],
        ['honey', 2],
        ['rice', 3],
        ['oats', 5],
      ].map(([ingredient, cups]) => ({ label: `${cups} cups of ${ingredient}`, inputs: { cups, ingredient } })),
      varied(
        'cups-to-pounds-calculator',
        6,
        [{ name: 'cups', lo: 3, hi: 90 }],
        [{ name: 'ingredient', options: ['flour', 'sugar', 'butter', 'honey', 'rice', 'oats', 'cocoa', 'oil', 'milk', 'water'] }],
        (v) => `${v.cups} cups of ${v.ingredient}`,
      ),
    ),
    introOutputs: ['lb', 'oz'],
    relatedSlugs: ['pounds-to-cups-calculator', 'grams-to-cups-calculator'],
    checks: [
      { inputs: {}, expect: { lb: '0.53 lb', oz: '8.47 oz', kg: '0.24 kg' } },
      { inputs: { cups: 2, ingredient: 'honey' }, expect: { lb: '1.5 lb' } },
      { inputs: { cups: 4, ingredient: 'butter' }, expect: { lb: '2 lb' } },
    ],
  },
  {
    slug: 'pounds-to-cups-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Cooking converters',
    title: 'Pounds to Cups Calculator for Flour, Sugar and More',
    h1: 'Pounds to Cups Calculator',
    metaDescription: 'Find how many cups are in a pound of flour, sugar, butter, honey, rice, oats or cocoa, with tablespoons too.',
    about:
      'Shopping lists speak in pounds while recipes speak in cups, so a cook with a five-pound bag of sugar wants to know how many batches it will make. Divide the weight of the bag by the weight of one cup of that ingredient. A pound is 453.6 grams, a cup of flour weighs about 120 and a cup of granulated sugar 200, so a pound of flour is nearly four cups and a pound of sugar a little over two. Choose the ingredient and the pounds you have, and the calculator shows the cups and the tablespoons. Powders such as flour and cocoa pack down in a bag and fluff up when sifted, so a pound can measure a cup or more than the figure shown. Weigh recipes where accuracy matters and keep this for planning.',
    inputs: [field('lb', 'Pounds', 1, 0, 10000), select('ingredient', 'Ingredient', 'flour', INGREDIENTS)],
    outputs: [
      { name: 'cups', label: 'Cups', format: 'text', highlight: true },
      { name: 'tbsp', label: 'Tablespoons', format: 'text' },
    ],
    calculate: (i) => {
      const cups = toD(i.lb).mul(G_PER_LB).div(gramsPerCup(i.ingredient));
      return { cups: `${fmtNumber(cups, 2)} cups`, tbsp: `${fmtNumber(cups.mul(16), 1)} tbsp` };
    },
    formulaDescription: 'Cups = pounds × 453.59 ÷ grams per cup of the ingredient. Tablespoons = cups × 16.',
    workedExample: '1 lb of all-purpose flour is 453.59 ÷ 120 = 3.78 cups, or 60.5 tablespoons. 5 lb of sugar is 11.34 cups.',
    faq: [
      { question: 'How many cups of sugar are in a 5 lb bag?', answer: 'About 11.3 cups of granulated sugar, at 200 g per cup.' },
      {
        question: 'Why is a pound of butter 4 cups?',
        answer: 'A cup of butter weighs about 227 g, so a pound (454 g) is two cups. This table gives about 2 cups, and four sticks equal two cups.',
      },
      {
        question: 'Does sifting change the result?',
        answer: 'Yes. Sifted flour fills more cups per pound because it holds air, so a sifted pound measures about 4 cups or more.',
      },
    ],
    scenarios: plus(
      [
        ['flour', 1],
        ['sugar', 5],
        ['butter', 2],
        ['honey', 1],
        ['rice', 2],
        ['cocoa', 0.5],
      ].map(([ingredient, lb]) => ({ label: `${lb} lb of ${ingredient}`, inputs: { lb, ingredient } })),
      varied(
        'pounds-to-cups-calculator',
        6,
        [{ name: 'lb', lo: 2, hi: 60 }],
        [{ name: 'ingredient', options: ['flour', 'sugar', 'butter', 'honey', 'rice', 'oats', 'cocoa', 'oil', 'milk', 'water'] }],
        (v) => `${v.lb} lb of ${v.ingredient}`,
      ),
    ),
    introOutputs: ['cups', 'tbsp'],
    relatedSlugs: ['cups-to-pounds-calculator', 'grams-to-cups-calculator'],
    checks: [
      { inputs: {}, expect: { cups: '3.78 cups', tbsp: '60.5 tbsp' } },
      { inputs: { lb: 5, ingredient: 'sugar' }, expect: { cups: '11.34 cups' } },
      { inputs: { lb: 2, ingredient: 'butter' }, expect: { cups: '4 cups' } },
    ],
  },
  {
    slug: 'grams-to-tablespoons-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Cooking converters',
    title: 'Grams to Tablespoons Calculator (US, Metric and Australian)',
    h1: 'Grams to Tablespoons Calculator',
    metaDescription: 'Convert grams of an ingredient to tablespoons, choosing the US, metric or Australian tablespoon size.',
    about:
      'A tablespoon is not the same size everywhere, which is a trap for anyone following a recipe from abroad. The US tablespoon holds 14.8 millilitres, the metric tablespoon used in much of Europe and in the UK holds 15, and the Australian tablespoon holds 20, a third more. This page converts grams of an ingredient to tablespoons of the size you choose. It finds the volume of the ingredient from its weight per cup, then divides by the size of the spoon. Spices, salt and baking powder are measured in teaspoons rather than tablespoons because the amounts are small, so the list here covers flour, sugars, butter, honey, oils and other bulk items. Level the spoon with a knife for dry goods, since a heaped spoon can hold half as much again. Measuring spoons from a set are more consistent than the cutlery drawer, and a bakery scale settles any disagreement: weigh the grams, then keep the spoon count for the recipe card, or fall back on the spoon you trust when the scale is out of reach. Syrups and oils pour, so fill the spoon to the brim and tip it level; sticky ingredients cling to the bowl and are best scraped out with a spatula.',
    inputs: [
      field('grams', 'Mass (g)', 100, 0, 100000),
      select('ingredient', 'Ingredient', 'flour', INGREDIENTS),
      select('spoon', 'Tablespoon size', 'us', [
        ['us', 'US (14.8 mL)'],
        ['metric', 'Metric (15 mL)'],
        ['au', 'Australian (20 mL)'],
      ]),
    ],
    outputs: [
      { name: 'tbsp', label: 'Tablespoons', format: 'text', highlight: true },
      { name: 'ml', label: 'Volume', format: 'text' },
    ],
    calculate: (i) => {
      const ml = toD(i.grams).div(gramsPerCup(i.ingredient)).mul(ML_PER_US_CUP);
      const size = new D({ us: '14.78676478125', metric: '15', au: '20' }[String(i.spoon)] ?? '14.78676478125');
      return { tbsp: `${fmtNumber(ml.div(size), 2)} tbsp`, ml: `${fmtNumber(ml, 1)} mL` };
    },
    formulaDescription: 'Volume (mL) = grams ÷ grams per cup × 236.59. Tablespoons = volume ÷ size of the spoon: US 14.79 mL, metric 15 mL, Australian 20 mL.',
    workedExample: '100 g of flour is 100 ÷ 120 of a cup, or 197.2 mL. That is 13.33 US tablespoons, 13.14 metric tablespoons or 9.86 Australian tablespoons.',
    faq: [
      {
        question: 'Which tablespoon does my recipe use?',
        answer: 'US recipes use the US tablespoon, UK and European ones 15 mL, and Australian ones 20 mL. If unsure, assume 15 mL.',
      },
      {
        question: 'Do I level or heap the spoon?',
        answer: 'Level it with the back of a knife, unless the recipe says heaped. A heaped spoon holds a lot more.',
      },
      { question: 'How many tablespoons in a cup?', answer: 'A US cup holds 16 US tablespoons, about 15.8 metric tablespoons or 11.8 Australian ones.' },
    ],
    scenarios: plus(
      [
        ['flour', 100, 'us'],
        ['sugar', 50, 'us'],
        ['butter', 28, 'metric'],
        ['honey', 21, 'us'],
        ['cocoa', 30, 'au'],
        ['oil', 14, 'metric'],
      ].map(([ingredient, grams, spoon]) => ({ label: `${grams} g of ${ingredient} with the ${spoon} tablespoon`, inputs: { grams, ingredient, spoon } })),
      varied(
        'grams-to-tablespoons-calculator',
        6,
        [{ name: 'grams', lo: 15, hi: 880 }],
        [
          { name: 'ingredient', options: ['flour', 'sugar', 'butter', 'honey', 'rice', 'oats', 'cocoa', 'oil', 'milk', 'water'] },
          { name: 'spoon', options: ['us', 'metric', 'au'] },
        ],
        (v) => `${v.grams} g of ${v.ingredient} with the ${v.spoon} tablespoon`,
      ),
    ),
    introOutputs: ['tbsp', 'ml'],
    relatedSlugs: ['grams-to-teaspoons-calculator', 'grams-to-cups-calculator'],
    checks: [
      { inputs: {}, expect: { tbsp: '13.33 tbsp', ml: '197.2 mL' } },
      { inputs: { spoon: 'metric' }, expect: { tbsp: '13.14 tbsp' } },
      { inputs: { spoon: 'au' }, expect: { tbsp: '9.86 tbsp' } },
      { inputs: { grams: 100, ingredient: 'sugar' }, expect: { tbsp: '8 tbsp' } },
    ],
  },
  {
    slug: 'grams-to-teaspoons-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Cooking converters',
    title: 'Grams to Teaspoons Calculator for Sugar, Flour and More',
    h1: 'Grams to Teaspoons Calculator',
    metaDescription: 'Convert grams of an ingredient into level teaspoons, using either the US teaspoon or the 5 mL metric teaspoon.',
    about:
      'Small quantities in a recipe, a spoon of sugar in tea, a measure of cocoa for a mug or a few grams of baking mix, are easiest to handle in teaspoons, and nutrition labels often quote sugar in grams. Dividing the grams by the weight of a teaspoon of that ingredient gives the answer. Here a teaspoon is a sixth of a fluid ounce for the US spoon, 4.93 millilitres, or exactly 5 millilitres for the metric spoon, and the page finds the volume of your amount from its weight per cup. A level teaspoon of granulated sugar weighs about 4 grams, which is why a can of soda with 39 grams of sugar holds almost ten teaspoons. Use a flat knife to level the spoon, and remember that salt and baking powder are denser than flour. Dietitians, diabetics and parents reading labels use this sum to picture sugar on a spoon: a teaspoon looks small, so seeing ten of them in one soft drink makes the figure on the label easier to judge against health guidance. Stirred into coffee or tea, the same spoons show how a daily habit adds up across a week, a month and a year.',
    inputs: [
      field('grams', 'Mass (g)', 10, 0, 100000),
      select('ingredient', 'Ingredient', 'sugar', INGREDIENTS),
      select('spoon', 'Teaspoon size', 'us', [
        ['us', 'US (4.93 mL)'],
        ['metric', 'Metric (5 mL)'],
      ]),
    ],
    outputs: [
      { name: 'tsp', label: 'Level teaspoons', format: 'text', highlight: true },
      { name: 'tbsp', label: 'In tablespoons', format: 'text' },
    ],
    calculate: (i) => {
      const ml = toD(i.grams).div(gramsPerCup(i.ingredient)).mul(ML_PER_US_CUP);
      const size = new D(String(i.spoon) === 'metric' ? '5' : '4.92892159375');
      const tsp = ml.div(size);
      return { tsp: `${fmtNumber(tsp, 2)} tsp`, tbsp: `${fmtNumber(tsp.div(3), 2)} tbsp` };
    },
    formulaDescription:
      'Volume (mL) = grams ÷ grams per cup × 236.59. Teaspoons = volume ÷ size of the teaspoon: US 4.929 mL, metric 5 mL. Three teaspoons make a tablespoon.',
    workedExample:
      '10 g of granulated sugar is 10 ÷ 200 of a cup, 11.83 mL, which is 2.4 US teaspoons or 2.37 metric teaspoons. A 39 g can of soda sugar is 9.4 teaspoons.',
    faq: [
      {
        question: 'How many grams is a teaspoon of sugar?',
        answer: 'About 4.2 grams for granulated sugar, which is the 200 g per cup figure divided by 48 teaspoons.',
      },
      { question: 'Is a heaped teaspoon larger?', answer: 'Yes, up to double. Recipes mean level spoons unless they say rounded or heaped.' },
      { question: 'Why use a measuring spoon, not a cutlery spoon?', answer: 'Dinner teaspoons vary from 3 to 7 mL. A measuring spoon is standardised.' },
    ],
    scenarios: plus(
      [
        ['sugar', 10, 'us'],
        ['sugar', 39, 'metric'],
        ['flour', 15, 'us'],
        ['cocoa', 8, 'us'],
        ['honey', 21, 'metric'],
        ['butter', 5, 'us'],
      ].map(([ingredient, grams, spoon]) => ({ label: `${grams} g of ${ingredient}, ${spoon} teaspoon`, inputs: { grams, ingredient, spoon } })),
      varied(
        'grams-to-teaspoons-calculator',
        6,
        [{ name: 'grams', lo: 3, hi: 240 }],
        [
          { name: 'ingredient', options: ['flour', 'sugar', 'butter', 'honey', 'rice', 'oats', 'cocoa', 'oil', 'milk', 'water'] },
          { name: 'spoon', options: ['us', 'metric'] },
        ],
        (v) => `${v.grams} g of ${v.ingredient}, ${v.spoon} teaspoon`,
      ),
    ),
    introOutputs: ['tsp', 'tbsp'],
    relatedSlugs: ['grams-to-tablespoons-calculator', 'grams-to-cups-calculator'],
    checks: [
      { inputs: {}, expect: { tsp: '2.4 tsp', tbsp: '0.8 tbsp' } },
      { inputs: { spoon: 'metric' }, expect: { tsp: '2.37 tsp' } },
      { inputs: { grams: 39 }, expect: { tsp: '9.36 tsp' } },
    ],
  },
  {
    slug: 'ml-to-grams-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Cooking converters',
    title: 'ML to Grams Calculator for Water, Milk, Oil and Honey',
    h1: 'ML to Grams Calculator',
    metaDescription: 'Convert millilitres to grams for water, milk, oil, honey, butter, sugar and flour using typical densities.',
    about:
      'Only water has a handy equivalence of one gram to one millilitre. Every other kitchen ingredient has its own density, the mass in each millilitre, and so the conversion from volume to weight needs a multiplier. Milk is slightly heavier than water at about 1.03 grams per millilitre because of its fats and proteins, oil is lighter at 0.92, which is why it floats, and honey is far denser at 1.42. Powders such as flour and sugar are measured by the scoop so their figures describe loose packing, 0.51 for flour and 0.85 for granulated sugar. Pick the ingredient, enter the millilitres, and the calculator multiplies by the density to give grams and ounces. Densities shift with temperature and brand by a few percent, so for very exact work weigh the ingredient directly.',
    inputs: [
      field('ml', 'Volume (mL)', 250, 0, 100000),
      select('ingredient', 'Ingredient', 'milk', [
        ['water', 'Water (1.00 g/mL)'],
        ['milk', 'Milk (1.03)'],
        ['oil', 'Vegetable oil (0.92)'],
        ['honey', 'Honey (1.42)'],
        ['butter', 'Butter (0.96)'],
        ['sugar', 'Granulated sugar (0.85)'],
        ['flour', 'All-purpose flour (0.51)'],
      ]),
    ],
    outputs: [
      { name: 'grams', label: 'Mass', format: 'text', highlight: true },
      { name: 'oz', label: 'In ounces', format: 'text' },
    ],
    calculate: (i) => {
      const grams = toD(i.ml).mul(DENSITY[String(i.ingredient)] ?? '1');
      return { grams: `${fmtNumber(grams, 1)} g`, oz: `${fmtNumber(grams.div(G_PER_OZ), 2)} oz` };
    },
    formulaDescription: 'Mass (g) = volume (mL) × density (g/mL). Densities: water 1.00, milk 1.03, oil 0.92, honey 1.42, butter 0.96, sugar 0.85, flour 0.51.',
    workedExample: '250 mL of milk weighs 250 × 1.03 = 257.5 g, or 9.08 oz. 100 mL of honey weighs 142 g.',
    faq: [
      { question: 'Is 1 mL always 1 g?', answer: 'Only for water near room temperature. Everything else is lighter or heavier.' },
      {
        question: 'Why do powders vary?',
        answer: 'Their density depends on how tightly they are packed. The figures here are for spooned, not packed, powder.',
      },
      {
        question: 'Do these densities change with temperature?',
        answer: 'A little. Oil and honey get less dense when warm, but the change is under 2 percent for kitchen temperatures.',
      },
    ],
    scenarios: plus(
      [
        ['water', 250],
        ['milk', 250],
        ['oil', 100],
        ['honey', 100],
        ['butter', 120],
        ['flour', 250],
      ].map(([ingredient, ml]) => ({ label: `${ml} mL of ${ingredient}`, inputs: { ml, ingredient } })),
      varied(
        'ml-to-grams-calculator',
        6,
        [{ name: 'ml', lo: 30, hi: 960 }],
        [{ name: 'ingredient', options: ['water', 'milk', 'oil', 'honey', 'butter', 'flour', 'sugar'] }],
        (v) => `${v.ml} mL of ${v.ingredient}`,
      ),
    ),
    introOutputs: ['grams', 'oz'],
    relatedSlugs: ['grams-to-cups-calculator', 'cooking-measurement-converter'],
    checks: [
      { inputs: {}, expect: { grams: '257.5 g', oz: '9.08 oz' } },
      { inputs: { ingredient: 'water' }, expect: { grams: '250 g' } },
      { inputs: { ml: 100, ingredient: 'honey' }, expect: { grams: '142 g' } },
      { inputs: { ml: 100, ingredient: 'oil' }, expect: { grams: '92 g' } },
    ],
  },
  {
    slug: 'dry-to-cooked-pasta-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Cooking converters',
    title: 'Dry to Cooked Pasta Calculator: How Much to Boil',
    h1: 'Dry to Cooked Pasta Calculator',
    metaDescription: 'Work out how much dry pasta to cook for a number of people, the cooked weight and cups, and the water for the pot.',
    about:
      'Dry pasta swells as it boils, soaking up about one and a quarter times its own weight in water, so it ends up roughly two and a quarter times heavier than it started. A portion of 85 grams, which is three ounces, becomes a bowl of about 190 grams and a little over a cup of cooked pasta. For a main course allow 85 to 115 grams of dry pasta per person and for a first course 55 to 70. Enter the number of people and the dry weight per person, and the calculator returns the total to weigh, the cooked weight, the cooked cups and the litres of water for the pot, using the classic proportion of one litre of water for every 100 grams of pasta. Salt the water generously, and keep a mug of the starchy cooking water to loosen the sauce.',
    inputs: [
      intField('people', 'People', 4, 1, 500),
      field('each', 'Dry pasta per person (g)', 85, 30, 200),
      field('factor', 'Cooked weight as a multiple of dry', 2.25, 2, 3),
    ],
    outputs: [
      { name: 'dry', label: 'Dry pasta to weigh', format: 'text', highlight: true },
      { name: 'cooked', label: 'Cooked weight', format: 'text' },
      { name: 'cups', label: 'Cooked pasta in cups', format: 'text' },
      { name: 'water', label: 'Water for the pot', format: 'text' },
    ],
    calculate: (i) => {
      const dry = toD(i.people).mul(toD(i.each));
      const cooked = dry.mul(toD(i.factor));
      return {
        dry: `${fmtNumber(dry, 0)} g`,
        cooked: `${fmtNumber(cooked, 0)} g`,
        cups: `${fmtNumber(cooked.div(140), 1)} cups`,
        water: `${fmtNumber(dry.div(100), 1)} L`,
      };
    },
    formulaDescription:
      'Dry weight = people × grams per person. Cooked weight = dry × 2.25 (adjustable). Cooked cups = cooked grams ÷ 140. Water = dry grams ÷ 100 litres.',
    workedExample: 'Four people at 85 g each need 340 g of dry pasta. Cooked it weighs 340 × 2.25 = 765 g, about 5.5 cups, in a pot of 3.4 litres of water.',
    faq: [
      {
        question: 'How much dry pasta is one serving?',
        answer: 'The usual serving is 85 g (3 oz), or 56 g in the nutrition label. Hungry eaters and main courses take 100 g or more.',
      },
      {
        question: 'Does the multiple vary by shape?',
        answer: 'Slightly. Thin pasta absorbs a bit less and thick tubes more. 2.25 is a good average, and the field lets you change it.',
      },
      {
        question: 'Do I need that much water?',
        answer: 'A big pot stops the pasta sticking and the water going off the boil, but a smaller pot with less water also works if you stir.',
      },
    ],
    scenarios: rows(
      ['people', 'each', 'factor'],
      [
        [4, 85, 2.25],
        [2, 100, 2.25],
        [8, 70, 2.25],
        [1, 85, 2.5],
        [6, 115, 2.25],
        [12, 56, 2],
      ],
      (v) => `${v[0]} people, ${v[1]} g each, cooked ${v[2]} times heavier`,
    ),
    introOutputs: ['dry', 'cooked'],
    relatedSlugs: ['uncooked-to-cooked-rice-calculator', 'rice-to-water-ratio-calculator'],
    checks: [
      { inputs: {}, expect: { dry: '340 g', cooked: '765 g', cups: '5.5 cups', water: '3.4 L' } },
      { inputs: { people: 2, each: 100 }, expect: { dry: '200 g', cooked: '450 g', water: '2 L' } },
      { inputs: { people: 1, factor: 2.5 }, expect: { cooked: '213 g' } },
    ],
  },
  {
    slug: 'garlic-clove-to-powder-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Cooking converters',
    title: 'Garlic Clove to Powder Calculator: Fresh, Jarred and Dried',
    h1: 'Garlic Clove to Powder Calculator',
    metaDescription: 'Convert cloves of fresh garlic to garlic powder, jarred minced garlic and a weight in grams, for small, medium and large cloves.',
    about:
      'A recipe that asks for four cloves of garlic is a problem when the jar of powder is all that is in the cupboard. Dehydrating garlic concentrates the flavour, so a clove becomes a very small amount of powder: the usual rule is one eighth of a teaspoon of garlic powder for one medium clove, and one half teaspoon of jarred minced garlic, which is packed in water and so less strong. Fresh garlic itself is about one teaspoon of finely minced pulp, or three grams, for a medium clove, with small cloves counting for about half and large ones for half as much again. Choose the size and the number, and the calculator returns the equivalents. Add the powder to the liquid in a dish, not to hot oil, where it scorches and goes bitter. These are cooking rules of thumb and your taste decides.',
    inputs: [
      intField('cloves', 'Cloves of garlic', 4, 1, 100),
      select('size', 'Clove size', 'medium', [
        ['small', 'Small (half of medium)'],
        ['medium', 'Medium'],
        ['large', 'Large (1.5 times medium)'],
      ]),
    ],
    outputs: [
      { name: 'powder', label: 'Garlic powder', format: 'text', highlight: true },
      { name: 'jarred', label: 'Jarred minced garlic', format: 'text' },
      { name: 'fresh', label: 'Fresh, finely minced', format: 'text' },
      { name: 'grams', label: 'Weight of fresh garlic', format: 'text' },
    ],
    calculate: (i) => {
      const scale = new D({ small: '0.5', medium: '1', large: '1.5' }[String(i.size)] ?? '1').mul(toD(i.cloves));
      return {
        powder: `${fmtNumber(scale.div(8), 2)} tsp`,
        jarred: `${fmtNumber(scale.div(2), 2)} tsp`,
        fresh: `${fmtNumber(scale, 2)} tsp`,
        grams: `${fmtNumber(scale.mul(3), 1)} g`,
      };
    },
    formulaDescription: 'One medium clove = 1 tsp fresh minced = ½ tsp jarred minced = ⅛ tsp powder = about 3 g. Small cloves count as 0.5 and large as 1.5.',
    workedExample: 'Four medium cloves equal 0.5 tsp of garlic powder, 2 tsp of jarred minced garlic, 4 tsp of fresh minced garlic and about 12 g.',
    faq: [
      {
        question: 'Is garlic powder the same as garlic salt?',
        answer: 'No. Garlic salt is mostly salt. Do not swap one for the other without reducing the salt in the recipe.',
      },
      {
        question: 'Why is the powder so little?',
        answer: 'Drying removes the water, and what is left is concentrated, so a small pinch replaces a whole clove.',
      },
      { question: 'Can I use granulated garlic?', answer: 'Yes, but it is coarser, so use about twice the volume of powder.' },
    ],
    scenarios: [
      [1, 'medium'],
      [4, 'medium'],
      [2, 'large'],
      [6, 'small'],
      [10, 'medium'],
      [3, 'large'],
    ].map(([cloves, size]) => ({ label: `${cloves} ${size} cloves`, inputs: { cloves, size } })),
    introOutputs: ['powder', 'jarred'],
    relatedSlugs: ['fresh-to-dried-herb-calculator', 'grams-to-teaspoons-calculator'],
    checks: [
      { inputs: {}, expect: { powder: '0.5 tsp', jarred: '2 tsp', fresh: '4 tsp', grams: '12 g' } },
      { inputs: { cloves: 2, size: 'large' }, expect: { powder: '0.38 tsp', grams: '9 g' } },
      { inputs: { cloves: 6, size: 'small' }, expect: { jarred: '1.5 tsp' } },
    ],
  },
  {
    slug: 'uncooked-to-cooked-rice-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Cooking converters',
    title: 'Uncooked to Cooked Rice Calculator: How Much to Cook',
    h1: 'Uncooked to Cooked Rice Calculator',
    metaDescription: 'Work out how many cups of uncooked rice make the cooked servings you need, and the dry weight in grams.',
    about:
      'Rice roughly triples in volume as it cooks, so one cup of dry grains makes about three cups of cooked rice, which is enough for four side servings. Cooks planning a meal for a crowd need the reverse sum: from the servings wanted and the cooked portion per person, how much dry rice goes into the pot. Enter the number of servings, the size of the portion in cups of cooked rice, and the yield factor, which is three for most long-grain white rice and a little less for sticky or short-grain varieties, and the calculator gives the cooked total, the cups of dry rice and the weight in grams. A side portion is about half to three quarters of a cup, and a rice bowl main course is one and a half cups. Leftover rice should be cooled quickly and chilled within an hour or two, and reheated until it is steaming hot, because the bacteria that can grow on it are not killed by reheating.',
    inputs: [
      intField('servings', 'Servings', 4, 1, 1000),
      field('portion', 'Cooked rice per serving (cups)', 0.75, 0.25, 3),
      field('factor', 'Cooked volume per dry volume', 3, 2, 4),
    ],
    outputs: [
      { name: 'cooked', label: 'Cooked rice you will have', format: 'text' },
      { name: 'dry', label: 'Dry rice to measure', format: 'text', highlight: true },
      { name: 'grams', label: 'Dry rice by weight', format: 'text' },
    ],
    calculate: (i) => {
      const cooked = toD(i.servings).mul(toD(i.portion));
      const dry = cooked.div(toD(i.factor));
      return { cooked: `${fmtNumber(cooked, 2)} cups`, dry: `${fmtNumber(dry, 2)} cups`, grams: `${fmtNumber(dry.mul(185), 0)} g` };
    },
    formulaDescription: 'Cooked cups = servings × cups per serving. Dry cups = cooked cups ÷ yield factor (3). Dry weight = dry cups × 185 g.',
    workedExample: 'Four servings of three quarters of a cup need 3 cups of cooked rice. With a factor of 3, that is 1 cup of dry rice, or 185 g.',
    faq: [
      {
        question: 'How much does rice expand?',
        answer: 'About threefold in volume, and about two and a half to three times in weight, depending on how much water it absorbs.',
      },
      {
        question: 'How do I store leftover rice safely?',
        answer: 'Cool it within an hour, refrigerate it, and use it within a day. Reheat until it is steaming hot all the way through.',
      },
      {
        question: 'What portion should I plan for?',
        answer: 'Half to three quarters of a cup cooked for a side, and about one and a half cups for a rice bowl.',
      },
    ],
    scenarios: plus(
      rows(
        ['servings', 'portion', 'factor'],
        [
          [4, 0.75, 3],
          [8, 0.75, 3],
          [2, 1.5, 3],
          [20, 0.5, 3],
          [6, 1, 2.5],
          [12, 0.75, 3.5],
        ],
        (v) => `${v[0]} servings of ${v[1]} cup, yield factor ${v[2]}`,
      ),
      varied(
        'uncooked-to-cooked-rice-calculator',
        6,
        [
          { name: 'servings', lo: 3, hi: 90 },
          { name: 'portion', lo: 0.3, hi: 2, step: 0.05 },
          { name: 'factor', lo: 2.2, hi: 3.8, step: 0.1 },
        ],
        [],
        (v) => `${v.servings} servings of ${v.portion} cup, yield factor ${v.factor}`,
      ),
    ),
    introOutputs: ['cooked', 'dry'],
    relatedSlugs: ['rice-to-water-ratio-calculator', 'dry-to-cooked-pasta-calculator'],
    checks: [
      { inputs: {}, expect: { cooked: '3 cups', dry: '1 cups', grams: '185 g' } },
      { inputs: { servings: 8 }, expect: { cooked: '6 cups', dry: '2 cups', grams: '370 g' } },
      { inputs: { factor: 2.5 }, expect: { dry: '1.2 cups', grams: '222 g' } },
    ],
  },
  {
    slug: 'yeast-converter-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Cooking converters',
    title: 'Yeast Converter: Active Dry, Instant and Fresh Yeast',
    h1: 'Yeast Converter',
    metaDescription: 'Swap active dry, instant and fresh (cake) yeast in a bread recipe, with the teaspoons of active dry yeast.',
    about:
      'Bakers meet three kinds of yeast, and recipes rarely say which to use when you do not own the one they name. Active dry yeast has a coarse, dormant granule that is best dissolved in warm water. Instant, or rapid-rise, yeast has finer particles and a high proportion of living cells, so it goes straight into the flour and a smaller amount does the same work, about three quarters as much. Fresh yeast, sold as a moist cake and used by many professionals, is about two and a half times the weight of active dry, since it is mostly water. Enter an amount of any one type in grams and see the other two, along with the teaspoons of active dry that equals. A packet of 7 grams is about two and a quarter teaspoons. These ratios are widely used guides and the rise time may differ slightly.',
    inputs: [
      field('amount', 'Amount (g)', 7, 0, 5000),
      select('from', 'Yeast you have', 'active', [
        ['active', 'Active dry yeast'],
        ['instant', 'Instant yeast'],
        ['fresh', 'Fresh (cake) yeast'],
      ]),
    ],
    outputs: [
      { name: 'active', label: 'Active dry', format: 'text', highlight: true },
      { name: 'instant', label: 'Instant', format: 'text' },
      { name: 'fresh', label: 'Fresh (cake)', format: 'text' },
      { name: 'tsp', label: 'Active dry in teaspoons', format: 'text' },
    ],
    calculate: (i) => {
      const per: Record<string, string> = { active: '1', instant: '1.3333333333333333333333333333333333', fresh: '0.4' };
      const active = toD(i.amount).mul(per[String(i.from)] ?? '1');
      return {
        active: `${fmtNumber(active, 2)} g`,
        instant: `${fmtNumber(active.mul('0.75'), 2)} g`,
        fresh: `${fmtNumber(active.mul('2.5'), 2)} g`,
        tsp: `${fmtNumber(active.div('3.1'), 2)} tsp`,
      };
    },
    formulaDescription: 'Instant = 0.75 × active dry. Fresh = 2.5 × active dry (so 3.33 × instant). Teaspoons of active dry = grams ÷ 3.1.',
    workedExample: 'A packet of 7 g active dry yeast equals 5.25 g instant, 17.5 g fresh and 2.26 teaspoons of active dry.',
    faq: [
      {
        question: 'Do I need to proof instant yeast?',
        answer: 'No. Mix it into the dry ingredients. Active dry yeast is usually dissolved in warm water first.',
      },
      {
        question: 'Will the rise take longer with less yeast?',
        answer: 'Slightly. If you swap, expect a rise that differs by a few minutes, and judge by the dough, not the clock.',
      },
      {
        question: 'How do I store yeast?',
        answer: 'Dry yeast keeps in the freezer for a year or more. Fresh yeast lasts about two weeks in the refrigerator.',
      },
    ],
    scenarios: [
      [7, 'active'],
      [7, 'instant'],
      [20, 'fresh'],
      [14, 'active'],
      [3, 'instant'],
      [42, 'fresh'],
    ].map(([amount, from]) => ({ label: `${amount} g of ${from} yeast`, inputs: { amount, from } })),
    introOutputs: ['active', 'instant', 'fresh'],
    relatedSlugs: ['sourdough-calculator', 'pizza-dough-calculator'],
    checks: [
      { inputs: {}, expect: { active: '7 g', instant: '5.25 g', fresh: '17.5 g', tsp: '2.26 tsp' } },
      { inputs: { amount: 5.25, from: 'instant' }, expect: { active: '7 g' } },
      { inputs: { amount: 17.5, from: 'fresh' }, expect: { active: '7 g', instant: '5.25 g' } },
    ],
  },
  {
    slug: 'coffee-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Tea and coffee',
    title: 'Coffee Calculator: Grams of Coffee for a Pot',
    h1: 'Coffee Calculator',
    metaDescription: 'Work out how much ground coffee and water you need for any number of cups, in grams, tablespoons and pots per bag.',
    about:
      'Weak coffee is nearly always a matter of too little grounds. A coffee maker marks its carafe in cups, but the cup is only five or six fluid ounces, not the mug you drink from, so a ten-cup pot makes six mugs of 10 ounces. Enter the number of cups and their size in ounces and the calculator finds the water volume, then divides by the brewing ratio you pick. A standard ratio is one part coffee to sixteen of water by weight, which is about 62 grams per litre, a mild brew uses 1:18 and a strong brew 1:14. It converts the grams of coffee to level tablespoons, at about five grams each, and tells you how many pots a bag will make. Use fresh whole beans ground just before brewing, and measure the grounds on a scale for a repeatable cup.',
    inputs: [
      intField('cups', 'Number of cups', 6, 1, 60),
      field('size', 'Size of a cup (fl oz)', 6, 3, 16),
      select('strength', 'Strength', 'standard', [
        ['mild', 'Mild (1:18)'],
        ['standard', 'Standard (1:16)'],
        ['strong', 'Strong (1:14)'],
      ]),
      field('bag', 'Bag size (g)', 340, 50, 2000),
    ],
    outputs: [
      { name: 'water', label: 'Water', format: 'text' },
      { name: 'coffee', label: 'Ground coffee', format: 'text', highlight: true },
      { name: 'tbsp', label: 'Level tablespoons of grounds', format: 'text' },
      { name: 'pots', label: 'Pots from one bag', format: 'text' },
    ],
    calculate: (i) => {
      const water = toD(i.cups).mul(toD(i.size)).mul(ML_PER_FL_OZ);
      const ratio = new D({ mild: '18', standard: '16', strong: '14' }[String(i.strength)] ?? '16');
      const coffee = water.div(ratio);
      return {
        water: `${fmtNumber(water, 0)} mL`,
        coffee: `${fmtNumber(coffee, 1)} g`,
        tbsp: `${fmtNumber(coffee.div(5), 1)} tbsp`,
        pots: `${fmtNumber(toD(i.bag).div(coffee), 1)} pots`,
      };
    },
    formulaDescription:
      'Water (mL) = cups × fl oz per cup × 29.57. Coffee (g) = water ÷ ratio (18, 16 or 14). Tablespoons = grams ÷ 5. Pots per bag = bag grams ÷ coffee grams.',
    workedExample:
      'Six cups of 6 fl oz is 36 fl oz, or 1,065 mL. At 1:16 you need 66.5 g of coffee, which is 13.3 level tablespoons, and a 340 g bag makes 5.1 pots.',
    faq: [
      { question: 'How big is a coffee maker cup?', answer: 'Usually 5 to 6 fluid ounces, much less than a mug. Check the markings on your carafe.' },
      { question: 'Should I scoop or weigh?', answer: 'Weigh. A tablespoon of coffee varies from 4 to 7 grams depending on grind and roast.' },
      {
        question: 'My coffee tastes bitter. What do I change?',
        answer: 'Grind coarser or shorten the brew time, and try a milder ratio. Weak, sour coffee usually needs a finer grind or more grounds.',
      },
    ],
    scenarios: plus(
      rows(
        ['cups', 'size', 'bag'],
        [
          [6, 6, 340],
          [10, 5, 340],
          [4, 8, 227],
          [12, 6, 454],
          [2, 10, 250],
          [8, 6, 340],
        ],
        (v) => `${v[0]} cups of ${v[1]} fl oz from a ${v[2]} g bag`,
      ),
      varied(
        'coffee-calculator',
        6,
        [
          { name: 'cups', lo: 2, hi: 48 },
          { name: 'size', lo: 4, hi: 14 },
          { name: 'bag', lo: 150, hi: 900 },
        ],
        [],
        (v) => `${v.cups} cups of ${v.size} fl oz from a ${v.bag} g bag`,
      ),
    ),
    introOutputs: ['coffee', 'pots'],
    relatedSlugs: ['coffee-to-water-ratio-calculator', 'cold-brew-ratio-calculator'],
    checks: [
      { inputs: {}, expect: { water: '1,065 mL', coffee: '66.5 g', tbsp: '13.3 tbsp', pots: '5.1 pots' } },
      { inputs: { strength: 'strong' }, expect: { coffee: '76 g' } },
      { inputs: { strength: 'mild' }, expect: { coffee: '59.1 g' } },
    ],
  },
  {
    slug: 'coffee-kick-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Tea and coffee',
    title: 'Coffee Kick Calculator: Caffeine in Your Drinks',
    h1: 'Coffee Kick Calculator',
    metaDescription: 'Estimate the caffeine in coffee, espresso, tea, cola and energy drinks, the share of a 400 mg day, and how much is left hours later.',
    about:
      'Caffeine is the most widely used stimulant in the world, and the amount in a cup depends on the drink. A typical 8 ounce cup of brewed coffee contains about 95 milligrams, a single shot of espresso about 63, instant coffee about 62, black tea about 47, green tea about 28, a can of cola about 34 and an energy drink about 80, with wide variation by brand and brewing. Choose the drink and the number of servings and the calculator adds them up and compares the total with 400 milligrams a day, the amount that health authorities regard as unlikely to cause harm for most healthy adults. It also estimates how much remains after a number of hours using the half-life, about five hours for an average adult, which is why an afternoon coffee can disturb sleep. Pregnant women, children and people with heart conditions or on some medicines should take less and follow their doctor.',
    inputs: [
      select('drink', 'Drink', 'drip', [
        ['drip', 'Brewed coffee, 8 fl oz'],
        ['espresso', 'Espresso, 1 shot'],
        ['instant', 'Instant coffee, 8 fl oz'],
        ['decaf', 'Decaf coffee, 8 fl oz'],
        ['black-tea', 'Black tea, 8 fl oz'],
        ['green-tea', 'Green tea, 8 fl oz'],
        ['cola', 'Cola, 12 fl oz can'],
        ['energy', 'Energy drink, can'],
      ]),
      intField('servings', 'Servings', 2, 1, 50),
      field('hours', 'Hours until you want to sleep', 5, 0, 24),
      field('half', 'Caffeine half-life (hours)', 5, 2, 12),
    ],
    outputs: [
      { name: 'mg', label: 'Caffeine', format: 'text', highlight: true },
      { name: 'share', label: 'Share of 400 mg', format: 'text' },
      { name: 'left', label: 'Still in your body after that time', format: 'text' },
    ],
    calculate: (i) => {
      const per = new D(
        { drip: '95', espresso: '63', instant: '62', decaf: '2', 'black-tea': '47', 'green-tea': '28', cola: '34', energy: '80' }[String(i.drink)] ?? '95',
      );
      const mg = per.mul(toD(i.servings));
      const left = mg.mul(new D('0.5').pow(toD(i.hours).div(toD(i.half))));
      return { mg: `${fmtNumber(mg, 0)} mg`, share: `${fmtNumber(mg.div(4), 1)} %`, left: `${fmtNumber(left, 1)} mg` };
    },
    formulaDescription:
      'Caffeine = mg per serving × servings. Share = caffeine ÷ 400. Remaining = caffeine × 0.5^(hours ÷ half-life). Per serving: brewed 95 mg, espresso 63, instant 62, decaf 2, black tea 47, green tea 28, cola 34, energy drink 80.',
    workedExample: 'Two cups of brewed coffee contain 190 mg, which is 47.5 % of 400 mg. After 5 hours, one half-life, about 95 mg is still in the body.',
    faq: [
      {
        question: 'How much caffeine is too much?',
        answer:
          'About 400 mg a day is the figure usually given for healthy adults. Pregnant women are advised to stay under about 200 mg, and children less. Individuals differ widely.',
      },
      {
        question: 'Why does the half-life matter?',
        answer:
          'Half of the caffeine is cleared every five hours or so, but it ranges from two to twelve hours between people, which is why some sleep fine after an evening coffee and others do not.',
      },
      {
        question: 'Are these numbers exact?',
        answer: 'No. Brewing time, roast, bean and brand change them by 30 percent or more. Treat them as typical values.',
      },
    ],
    scenarios: [
      ['drip', 2],
      ['espresso', 3],
      ['black-tea', 4],
      ['cola', 3],
      ['energy', 2],
      ['decaf', 4],
    ].map(([drink, servings]) => ({ label: `${servings} servings of ${drink}`, inputs: { drink, servings } })),
    introOutputs: ['mg', 'share'],
    relatedSlugs: ['coffee-calculator', 'tea-brewing-calculator'],
    checks: [
      { inputs: {}, expect: { mg: '190 mg', share: '47.5 %', left: '95 mg' } },
      { inputs: { drink: 'espresso', servings: 3 }, expect: { mg: '189 mg' } },
      { inputs: { hours: 10 }, expect: { left: '47.5 mg' } },
    ],
  },
  {
    slug: 'tea-brewing-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Tea and coffee',
    title: 'Tea Brewing Calculator: Leaf, Temperature and Time',
    h1: 'Tea Brewing Calculator',
    metaDescription: 'Find the grams of tea leaf, the water temperature and the steeping time for white, green, oolong, black and herbal tea.',
    about:
      'Each kind of tea has its own best conditions for the water, and getting them wrong turns a delicate leaf bitter or leaves a robust one flat. Delicate white and green teas are brewed with cooler water, about 75 to 85 degrees Celsius, for two to four minutes, because boiling water extracts harsh tannins. Oolong sits in between, and black tea and herbal infusions take water that has only just stopped boiling and a few minutes more. The amount of leaf is set by a simple ratio: about two and a half grams for each 250 millilitres, which is roughly one teaspoon of most loose teas for a cup, and a little more for heavy, rolled leaves. Enter the type and the volume of water, adjust the leaf per cup to taste, and the page gives the grams, the temperature in Celsius and Fahrenheit, and the steeping time. These are common guidelines, and the packet of the tea you bought is the best guide.',
    inputs: [
      select('tea', 'Type of tea', 'black', [
        ['white', 'White tea'],
        ['green', 'Green tea'],
        ['oolong', 'Oolong'],
        ['black', 'Black tea'],
        ['herbal', 'Herbal infusion'],
      ]),
      field('water', 'Water (mL)', 500, 50, 5000),
      field('rate', 'Leaf per 250 mL (g)', 2.5, 1, 6),
    ],
    outputs: [
      { name: 'leaf', label: 'Tea leaf', format: 'text', highlight: true },
      { name: 'temp', label: 'Water temperature', format: 'text' },
      { name: 'time', label: 'Steeping time', format: 'text' },
    ],
    calculate: (i) => {
      const table: Record<string, [string, string]> = {
        white: ['80 to 85 °C (176 to 185 °F)', '2 to 4 minutes'],
        green: ['75 to 80 °C (167 to 176 °F)', '2 to 3 minutes'],
        oolong: ['85 to 95 °C (185 to 203 °F)', '3 to 5 minutes'],
        black: ['95 to 100 °C (203 to 212 °F)', '3 to 5 minutes'],
        herbal: ['100 °C (212 °F)', '5 to 7 minutes'],
      };
      const [temp, time] = table[String(i.tea)] ?? table.black;
      return { leaf: `${fmtNumber(toD(i.water).div(250).mul(toD(i.rate)), 1)} g`, temp, time };
    },
    formulaDescription: 'Leaf (g) = water (mL) ÷ 250 × grams per 250 mL. Temperature and time come from typical guidance for each type of tea.',
    workedExample: '500 mL of black tea at 2.5 g per 250 mL needs 5 g of leaf, water at 95 to 100 °C, and 3 to 5 minutes of steeping.',
    faq: [
      {
        question: 'Why is cooler water better for green tea?',
        answer: 'Boiling water extracts bitter tannins quickly from delicate leaves. Cooler water gives a sweeter cup.',
      },
      {
        question: 'How many teaspoons is 2.5 grams?',
        answer: 'About one teaspoon of most loose-leaf teas, but fluffy leaves weigh less and dense ones more, so weigh if you can.',
      },
      {
        question: 'Can I use the leaves again?',
        answer: 'Yes. Good green, white and oolong teas are often steeped two or three times, with a little longer each time.',
      },
    ],
    scenarios: [
      ['black', 500, 2.5],
      ['green', 250, 2.5],
      ['white', 500, 3],
      ['oolong', 300, 3],
      ['herbal', 750, 3],
      ['black', 1000, 2],
    ].map(([tea, water, rate]) => ({ label: `${water} mL of ${tea} tea at ${rate} g per 250 mL`, inputs: { tea, water, rate } })),
    introOutputs: ['leaf', 'temp', 'time'],
    relatedSlugs: ['coffee-kick-calculator', 'coffee-calculator'],
    checks: [
      { inputs: {}, expect: { leaf: '5 g', temp: '95 to 100 °C (203 to 212 °F)', time: '3 to 5 minutes' } },
      { inputs: { tea: 'green', water: 250 }, expect: { leaf: '2.5 g', temp: '75 to 80 °C (167 to 176 °F)', time: '2 to 3 minutes' } },
      { inputs: { tea: 'herbal', water: 750, rate: 3 }, expect: { leaf: '9 g' } },
    ],
  },
  {
    slug: 'chilled-drink-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Drinks',
    title: 'Chilled Drink Calculator: How Much Ice to Cool a Drink',
    h1: 'Chilled Drink Calculator',
    metaDescription: 'Find the grams of ice that cool a drink from room temperature to the serving temperature, and how diluted it ends up.',
    about:
      'Dropping ice into a warm drink cools it in two ways: the ice warms up to the melting point and then melts, soaking up a large quantity of heat, and the cold meltwater then warms as it mixes. A gram of ice absorbs 334 joules just by melting, nearly as much as it takes to warm a gram of water by 80 degrees, which is why ice is such a good coolant. Enter the volume of the drink, its starting temperature, the temperature you want and the temperature of the ice, which is a few degrees below zero when it comes straight from the freezer. The calculator balances the heat lost by the drink with the heat gained by the ice, treating the drink as water, and gives the grams of ice, a count of 15 gram cubes and the dilution when all of it has melted. Shaking or stirring speeds up the exchange.',
    inputs: [
      field('volume', 'Drink volume (mL)', 355, 50, 5000),
      field('start', 'Starting temperature (°C)', 25, 5, 90),
      field('target', 'Target temperature (°C)', 5, 0, 30),
      field('ice', 'Ice temperature (°C)', -10, -30, 0),
    ],
    outputs: [
      { name: 'grams', label: 'Ice needed', format: 'text', highlight: true },
      { name: 'cubes', label: 'Cubes of 15 g', format: 'text' },
      { name: 'final', label: 'Final volume', format: 'text' },
      { name: 'dilution', label: 'Dilution by meltwater', format: 'text' },
    ],
    calculate: (i) => {
      const drop = toD(i.start).sub(toD(i.target));
      const heat = toD(i.volume)
        .mul('4.186')
        .mul(drop.lt(0) ? new D(0) : drop);
      const perGram = new D('334').add(new D('2.09').mul(toD(i.ice).neg())).add(new D('4.186').mul(toD(i.target)));
      const grams = heat.div(perGram);
      return {
        grams: `${fmtNumber(grams, 1)} g`,
        cubes: fmtNumber(grams.div(15).ceil(), 0),
        final: `${fmtNumber(toD(i.volume).add(grams), 0)} mL`,
        dilution: `${fmtNumber(grams.div(toD(i.volume).add(grams)).mul(100), 1)} %`,
      };
    },
    formulaDescription:
      'Heat to remove = volume × 4.186 × (start − target). Heat per gram of ice = 2.09 × (0 − ice temperature) + 334 + 4.186 × target. Ice = heat ÷ heat per gram.',
    workedExample:
      'To cool 355 mL from 25 °C to 5 °C: heat = 355 × 4.186 × 20 = 29,720 J. Each gram of −10 °C ice absorbs 20.9 + 334 + 20.9 = 375.8 J, so you need 79.1 g, which is 6 cubes, giving 434 mL and 18.2 % dilution.',
    faq: [
      {
        question: 'Why does the drink end up diluted?',
        answer: 'The ice that cools it melts into it. Colder ice and bigger cubes cool more per gram, but all the ice still adds water when it melts.',
      },
      {
        question: 'Does the glass matter?',
        answer: 'Yes. A warm glass absorbs heat too, and the calculator ignores it, so use a little more ice or chill the glass first.',
      },
      {
        question: 'Can I cool a drink without diluting it?',
        answer: 'Yes, with stones or metal cubes that are frozen, or by stirring the drink in a bowl of ice water.',
      },
    ],
    scenarios: rows(
      ['volume', 'start', 'target', 'ice'],
      [
        [355, 25, 5, -10],
        [355, 25, 5, 0],
        [250, 30, 10, -10],
        [1000, 22, 4, -15],
        [500, 20, 8, -10],
        [200, 60, 20, -10],
      ],
      (v) => `${v[0]} mL from ${v[1]} °C to ${v[2]} °C with ${v[3]} °C ice`,
    ),
    introOutputs: ['grams', 'dilution'],
    relatedSlugs: ['water-cooling-calculator', 'party-drink-calculator'],
    checks: [
      { inputs: {}, expect: { grams: '79.1 g', cubes: '6', final: '434 mL', dilution: '18.2 %' } },
      { inputs: { ice: 0 }, expect: { grams: '83.7 g' } },
      { inputs: { volume: 250, start: 30, target: 10 }, expect: { grams: '52.8 g' } },
    ],
  },
  {
    slug: 'water-cooling-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Other',
    title: 'Water Cooling Calculator: How Long for a Drink to Cool',
    h1: 'Water Cooling Calculator',
    metaDescription: "Estimate how many minutes a hot drink or pot of water takes to cool to a target temperature using Newton's law of cooling.",
    about:
      'A cup of tea left on the desk cools quickly at first and then more and more slowly, because the rate of heat loss is proportional to the gap between the drink and the room. Newton described this as an exponential decay: the excess temperature falls by the same fraction every minute. The fraction is set by a cooling constant that depends on the cup, the lid, the surface and the airflow, and is typically around 0.02 to 0.05 per minute for a mug of coffee. Enter the starting temperature, the room temperature, the temperature at which you want to drink it and the constant, and the page gives the minutes to wait and the temperature after ten minutes. Time the cooling of your own mug once with a thermometer to find its constant. A drink never drops below room temperature, which the calculator reports, and food that is cooling for storage must follow safe cooling guidance and not this estimate.',
    inputs: [
      field('start', 'Starting temperature (°C)', 90, 5, 100),
      field('room', 'Room temperature (°C)', 20, -10, 40),
      field('target', 'Target temperature (°C)', 60, 0, 100),
      field('k', 'Cooling constant (per minute)', 0.03, 0.005, 0.2),
    ],
    outputs: [
      { name: 'time', label: 'Time to reach the target', format: 'text', highlight: true },
      { name: 'after', label: 'Temperature after 10 minutes', format: 'text' },
    ],
    calculate: (i) => {
      const start = toD(i.start);
      const room = toD(i.room);
      const target = toD(i.target);
      const k = toD(i.k);
      const after = room.add(start.sub(room).mul(k.mul(10).neg().exp()));
      const time = target.lte(room)
        ? 'Never: the target is at or below room temperature'
        : target.gte(start)
          ? '0 min: already at or below the target'
          : `${fmtNumber(start.sub(room).div(target.sub(room)).ln().div(k), 1)} min`;
      return { time, after: `${fmtNumber(after, 1)} °C` };
    },
    formulaDescription: 'T(t) = room + (start − room) × e^(−k t). Time to reach the target = ln((start − room) ÷ (target − room)) ÷ k.',
    workedExample:
      'Coffee at 90 °C in a 20 °C room with k = 0.03 takes ln(70 ÷ 40) ÷ 0.03 = 18.7 minutes to reach 60 °C. After 10 minutes it is at 20 + 70 × e^(−0.3) = 71.9 °C.',
    faq: [
      {
        question: 'How do I find the cooling constant?',
        answer: 'Measure the temperature of your drink at two times a few minutes apart, then k = ln(excess 1 ÷ excess 2) ÷ minutes between them.',
      },
      { question: 'Does a lid change it?', answer: 'Yes. A lid cuts evaporation and convection, which can halve the constant and double the time.' },
      {
        question: 'Can I use it for cooling cooked food?',
        answer:
          'Not for safety. Cooked food must be cooled quickly through the danger zone and refrigerated within two hours, which needs shallow containers, not a model.',
      },
    ],
    scenarios: rows(
      ['start', 'room', 'target', 'k'],
      [
        [90, 20, 60, 0.03],
        [90, 20, 60, 0.05],
        [95, 22, 65, 0.02],
        [100, 20, 40, 0.04],
        [80, 25, 50, 0.03],
        [70, 20, 45, 0.025],
      ],
      (v) => `${v[0]} °C in a ${v[1]} °C room cooling to ${v[2]} °C with k = ${v[3]}`,
    ),
    introOutputs: ['time', 'after'],
    relatedSlugs: ['chilled-drink-calculator', 'coffee-calculator'],
    checks: [
      { inputs: {}, expect: { time: '18.7 min', after: '71.9 °C' } },
      { inputs: { k: 0.05 }, expect: { time: '11.2 min' } },
      { inputs: { target: 15 }, expect: { time: 'Never: the target is at or below room temperature' } },
    ],
  },
  {
    slug: 'priming-sugar-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Drinks',
    title: 'Priming Sugar Calculator: Carbonation for Home Brewing',
    h1: 'Priming Sugar Calculator',
    metaDescription: 'Work out the grams of table sugar or corn sugar to prime a batch of beer or cider for a target level of carbonation.',
    about:
      'Home brewers carbonate bottled beer by adding a measured amount of sugar before bottling, which the yeast ferments inside the sealed bottle to make carbon dioxide. The amount depends on three things: the carbonation you want, measured in volumes of CO2 per volume of beer, the beer that already holds some dissolved gas which depends on how warm it got during fermentation, and the type of sugar. This calculator estimates the dissolved gas from the highest temperature the beer reached, subtracts it from your target, and converts the shortfall to grams of sugar by the chemistry of fermentation: about 3.84 grams of table sugar or 4.45 grams of corn sugar, which holds a molecule of water, for each volume in each litre. British ales carry roughly 1.5 to 2.2 volumes, lagers and most American ales 2.4 to 2.8, wheat beers 3 or more. Too much sugar can make bottles burst, so weigh carefully, use strong bottles and store them behind a lid.',
    inputs: [
      field('litres', 'Batch volume (L)', 19, 1, 1000),
      field('temp', 'Highest beer temperature (°C)', 20, 0, 35),
      field('target', 'Target carbonation (volumes of CO2)', 2.4, 1, 4),
      select('sugar', 'Priming sugar', 'table', [
        ['table', 'Table sugar (sucrose)'],
        ['corn', 'Corn sugar (dextrose monohydrate)'],
      ]),
    ],
    outputs: [
      { name: 'residual', label: 'CO2 already dissolved', format: 'text' },
      { name: 'total', label: 'Sugar to add', format: 'text', highlight: true },
      { name: 'perL', label: 'Sugar per litre', format: 'text' },
      { name: 'bottle', label: 'Per 500 mL bottle', format: 'text' },
    ],
    calculate: (i) => {
      const f = toD(i.temp).mul(9).div(5).add(32);
      const residual = new D('3.0378').sub(new D('0.050062').mul(f)).add(new D('0.00026555').mul(f.pow(2)));
      const need = toD(i.target).sub(residual);
      const rise = need.lt(0) ? new D(0) : need;
      const perVolume = new D(String(i.sugar) === 'corn' ? '4.451' : '3.844');
      const perL = rise.mul(perVolume);
      return {
        residual: `${fmtNumber(residual, 2)} volumes`,
        total: `${fmtNumber(perL.mul(toD(i.litres)), 1)} g`,
        perL: `${fmtNumber(perL, 2)} g/L`,
        bottle: `${fmtNumber(perL.div(2), 2)} g`,
      };
    },
    formulaDescription:
      'Dissolved CO2 (volumes) = 3.0378 − 0.050062 F + 0.00026555 F², with F the highest beer temperature in °F. Sugar per litre = (target − dissolved) × 3.844 g for table sugar or × 4.451 g for corn sugar.',
    workedExample:
      'A 19 L batch kept at 20 °C (68 °F) already holds 0.86 volumes. To reach 2.4 you need 1.54 volumes, which is 5.91 g of table sugar per litre, so 112.4 g for the batch, or 2.96 g in a 500 mL bottle.',
    faq: [
      {
        question: 'Why does warmth matter?',
        answer: 'Cold liquid holds more dissolved CO2. Use the highest temperature the beer reached after fermentation, since gas leaves as it warms.',
      },
      {
        question: 'Can I use honey or malt extract?',
        answer: 'Yes, but they contain water and unfermentable matter, so the amount differs. Use a calculator written for that sugar.',
      },
      {
        question: 'What happens with too much sugar?',
        answer: 'Over-carbonation, gushing and in the worst case bursting bottles. Weigh the sugar, mix it evenly and use bottles rated for beer.',
      },
    ],
    scenarios: [
      withInputs('A 19 L ale at 20 °C to 2.4 volumes', { litres: 19, temp: 20, target: 2.4, sugar: 'table' }),
      withInputs('The same batch with corn sugar', { litres: 19, temp: 20, target: 2.4, sugar: 'corn' }),
      withInputs('A British bitter at 1.8 volumes', { litres: 23, temp: 18, target: 1.8, sugar: 'table' }),
      withInputs('A wheat beer of 20 L at 3.2 volumes', { litres: 20, temp: 21, target: 3.2, sugar: 'table' }),
      withInputs('A 5 L cider at 2.5 volumes', { litres: 5, temp: 15, target: 2.5, sugar: 'table' }),
    ],
    introOutputs: ['total', 'perL'],
    relatedSlugs: ['abv-calculator', 'alcohol-dilution-calculator'],
    checks: [
      { inputs: {}, expect: { residual: '0.86 volumes', total: '112.4 g', perL: '5.91 g/L', bottle: '2.96 g' } },
      { inputs: { sugar: 'corn' }, expect: { total: '130.1 g' } },
      { inputs: { target: 0.5 }, expect: { total: '0 g' } },
    ],
  },
  {
    slug: 'cake-serving-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Desserts and baking',
    title: 'Cake Serving Calculator: Slices from a Cake Pan',
    h1: 'Cake Serving Calculator',
    metaDescription: 'Count the servings in a round, square or rectangular cake from its size and the slice size, for one or several tiers.',
    about:
      'How many people can one cake feed? Caterers answer with a servings chart, and the chart is based on a simple idea: cut slices of a fixed size and count how many fit in the top of the cake. A wedding slice is about 1 inch by 2 inches and 4 inches tall, and a party slice, cut larger for a casual gathering, is about 2 inches by 2 inches. Enter the shape and the size of the pan in inches, choose the slice, and enter the number of equal tiers. The calculator divides the area of the cake by the area of one slice and rounds down. It gives 25 wedding servings for an 8 inch round and 29 party servings for a 9 by 13 sheet. Real cakes lose a little to uneven edges, and a tall cake or a rich one is cut into smaller pieces, so round the answer down when ordering.',
    inputs: [
      select('shape', 'Shape', 'round', [
        ['round', 'Round (diameter)'],
        ['square', 'Square (side)'],
        ['rect', 'Rectangle (length × width)'],
      ]),
      field('a', 'Diameter, side or length (in)', 8, 3, 36),
      field('b', 'Width, rectangles only (in)', 8, 3, 36),
      select('slice', 'Slice size', 'wedding', [
        ['wedding', 'Wedding slice (1 × 2 in)'],
        ['party', 'Party slice (2 × 2 in)'],
      ]),
      intField('tiers', 'Identical tiers', 1, 1, 10),
    ],
    outputs: [
      { name: 'servings', label: 'Servings', format: 'text', highlight: true },
      { name: 'area', label: 'Cake area', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.a);
      const area =
        String(i.shape) === 'round'
          ? new D('3.14159265358979323846264338327950288').mul(a.div(2).pow(2))
          : String(i.shape) === 'square'
            ? a.pow(2)
            : a.mul(toD(i.b));
      const slice = new D(String(i.slice) === 'party' ? '4' : '2');
      return { servings: `${fmtNumber(area.mul(toD(i.tiers)).div(slice).floor(), 0)} servings`, area: `${fmtNumber(area, 1)} sq in` };
    },
    formulaDescription:
      'Area = π × (diameter ÷ 2)² for a round cake, side² for a square, length × width for a rectangle. Servings = area × tiers ÷ slice area (2 sq in wedding, 4 sq in party), rounded down.',
    workedExample: 'An 8 inch round cake has an area of 50.3 sq in. Cut into 2 sq in wedding slices that gives 25 servings. Three such tiers give 75.',
    faq: [
      {
        question: 'What is a wedding slice?',
        answer: 'A thin piece about 1 inch wide, 2 inches long and as tall as the cake, usually 4 inches. It is a dessert portion after a meal.',
      },
      {
        question: 'How should I cut a round cake?',
        answer: 'Cut rings and then slices across them, or cut the cake in a grid, which wastes fewer scraps than wedges.',
      },
      {
        question: 'Should I round up for guests?',
        answer: 'Round down the serving count and order extra, because uneven edges and cake cutting lose a few servings.',
      },
    ],
    scenarios: [
      withInputs('An 8 inch round, wedding slices', { shape: 'round', a: 8, slice: 'wedding', tiers: 1 }),
      withInputs('A 10 inch square, party slices', { shape: 'square', a: 10, slice: 'party', tiers: 1 }),
      withInputs('A 9 by 13 inch sheet, party slices', { shape: 'rect', a: 9, b: 13, slice: 'party', tiers: 1 }),
      withInputs('Three 8 inch round tiers, wedding slices', { shape: 'round', a: 8, slice: 'wedding', tiers: 3 }),
      withInputs('A 6 inch round, party slices', { shape: 'round', a: 6, slice: 'party', tiers: 1 }),
    ],
    introOutputs: ['servings', 'area'],
    relatedSlugs: ['cake-pan-converter-calculator', 'pizza-party-calculator'],
    checks: [
      { inputs: {}, expect: { servings: '25 servings', area: '50.3 sq in' } },
      { inputs: { shape: 'square', a: 10, slice: 'party' }, expect: { servings: '25 servings' } },
      { inputs: { shape: 'rect', a: 9, b: 13, slice: 'party' }, expect: { servings: '29 servings' } },
      { inputs: { tiers: 3 }, expect: { servings: '75 servings' } },
    ],
  },
  {
    slug: 'pancake-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Desserts and baking',
    title: 'Pancake Recipe Calculator: Ingredients for Any Number',
    h1: 'Pancake Recipe Calculator',
    metaDescription: 'Scale a basic pancake batter to the number of pancakes you want, with flour, milk, eggs, butter, sugar and baking powder.',
    about:
      'A basic American pancake batter is nothing more than flour, milk and an egg lifted with baking powder, and its proportions scale in a straight line, so any quantity is a matter of multiplication. The reference batch here makes eight fluffy pancakes about four inches across: 180 grams of flour, 300 millilitres of milk, one egg, 40 grams of melted butter, 12 grams of sugar, three teaspoons of baking powder and a pinch of salt. Enter the number of pancakes you want and the quantities are scaled, with the eggs rounded up to whole eggs. Mix the wet and dry ingredients only until combined, since lumps are fine and overmixing makes tough pancakes, and let the batter rest for five minutes. A medium heat and a flip when bubbles break on the surface give an even golden colour. Use a quarter-cup scoop for a pancake of standard size.',
    inputs: [intField('pancakes', 'Pancakes wanted', 8, 1, 200)],
    outputs: [
      { name: 'flour', label: 'Flour', format: 'text', highlight: true },
      { name: 'milk', label: 'Milk', format: 'text' },
      { name: 'eggs', label: 'Eggs', format: 'text' },
      { name: 'butter', label: 'Melted butter', format: 'text' },
      { name: 'sugar', label: 'Sugar', format: 'text' },
      { name: 'bp', label: 'Baking powder', format: 'text' },
    ],
    calculate: (i) => {
      const s = toD(i.pancakes).div(8);
      return {
        flour: `${fmtNumber(s.mul(180), 0)} g`,
        milk: `${fmtNumber(s.mul(300), 0)} mL`,
        eggs: fmtNumber(s.ceil(), 0),
        butter: `${fmtNumber(s.mul(40), 0)} g`,
        sugar: `${fmtNumber(s.mul(12), 0)} g`,
        bp: `${fmtNumber(s.mul(3), 1)} tsp`,
      };
    },
    formulaDescription:
      'Scale = pancakes ÷ 8. Flour 180 g, milk 300 mL, butter 40 g, sugar 12 g and baking powder 3 tsp are each multiplied by the scale; eggs = scale rounded up.',
    workedExample: 'For 12 pancakes the scale is 1.5: 270 g of flour, 450 mL of milk, 2 eggs, 60 g of butter, 18 g of sugar and 4.5 tsp of baking powder.',
    faq: [
      { question: 'Why are my pancakes flat?', answer: 'Old baking powder or overmixing. Check the date and stir just until the flour disappears.' },
      {
        question: 'Can I make it ahead?',
        answer: 'Mix the dry ingredients ahead, but add the liquid shortly before cooking, because baking powder starts working when wet.',
      },
      { question: 'How big is a pancake here?', answer: 'About 4 inches across, from a quarter cup of batter, which is about 60 mL.' },
    ],
    scenarios: rows(['pancakes'], [[8], [12], [4], [20], [30], [2]], (v) => `${v[0]} pancakes`),
    introOutputs: ['flour', 'milk'],
    relatedSlugs: ['bakers-percentage-calculator', 'grams-to-cups-calculator'],
    checks: [
      { inputs: {}, expect: { flour: '180 g', milk: '300 mL', eggs: '1', butter: '40 g', sugar: '12 g', bp: '3 tsp' } },
      { inputs: { pancakes: 12 }, expect: { flour: '270 g', eggs: '2', bp: '4.5 tsp' } },
      { inputs: { pancakes: 20 }, expect: { flour: '450 g', milk: '750 mL', eggs: '3', butter: '100 g' } },
    ],
  },
  {
    slug: 'ice-cream-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Desserts and baking',
    title: 'Ice Cream Calculator: Mix Needed for a Batch and Overrun',
    h1: 'Ice Cream Calculator',
    metaDescription: 'Find how much ice cream mix to churn for the finished volume you want, allowing for overrun, with cream, milk and sugar amounts.',
    about:
      'Ice cream grows while it churns, because the paddle whips in air. That growth is called overrun and is the percentage by which the volume increases: a mix that doubles has 100 percent overrun. Industrial ice cream often has 80 to 100 percent, which makes it light and cheap, premium brands 20 to 50, and a home machine usually 30 to 50. To end with a litre of ice cream you therefore need less than a litre of mix, and the calculator divides the volume you want by one plus the overrun. It then splits the mix into the cream and the milk of a simple half-and-half base and adds sugar at about 120 grams per litre, a typical level that is sweet but still soft. Chill the mix overnight before churning, do not fill the machine past two thirds, and harden the ice cream in the freezer for a few hours.',
    inputs: [field('volume', 'Finished ice cream (L)', 1, 0.1, 20), field('overrun', 'Overrun (%)', 40, 0, 120)],
    outputs: [
      { name: 'mix', label: 'Mix to churn', format: 'text', highlight: true },
      { name: 'cream', label: 'Cream', format: 'text' },
      { name: 'milk', label: 'Milk', format: 'text' },
      { name: 'sugar', label: 'Sugar', format: 'text' },
    ],
    calculate: (i) => {
      const mix = toD(i.volume)
        .div(new D(1).add(toD(i.overrun).div(100)))
        .mul(1000);
      return {
        mix: `${fmtNumber(mix, 0)} mL`,
        cream: `${fmtNumber(mix.div(2), 0)} mL`,
        milk: `${fmtNumber(mix.div(2), 0)} mL`,
        sugar: `${fmtNumber(mix.mul('0.12'), 0)} g`,
      };
    },
    formulaDescription: 'Mix (mL) = finished volume (mL) ÷ (1 + overrun ÷ 100). Cream and milk are half of the mix each. Sugar = 0.12 g per mL of mix.',
    workedExample: 'For 1 litre of ice cream at 40 % overrun you churn 1,000 ÷ 1.4 = 714 mL of mix: 357 mL of cream, 357 mL of milk and 86 g of sugar.',
    faq: [
      {
        question: 'What is overrun?',
        answer: 'The increase in volume from the air whipped in. If 1 L of mix makes 1.4 L of ice cream, the overrun is 40 percent.',
      },
      {
        question: 'Why is premium ice cream heavier?',
        answer: 'It has less air. A tub with 25 percent overrun is denser and richer than one with 100 percent.',
      },
      { question: 'Is this a full recipe?', answer: 'It is a starting base. Add vanilla or other flavours, and egg yolks for a custard base if you like.' },
    ],
    scenarios: rows(
      ['volume', 'overrun'],
      [
        [1, 40],
        [1, 100],
        [1.5, 30],
        [0.5, 50],
        [2, 0],
        [4, 60],
      ],
      (v) => `${v[0]} L finished at ${v[1]} % overrun`,
    ),
    introOutputs: ['mix', 'sugar'],
    relatedSlugs: ['bakers-percentage-calculator', 'party-drink-calculator'],
    checks: [
      { inputs: {}, expect: { mix: '714 mL', cream: '357 mL', milk: '357 mL', sugar: '86 g' } },
      { inputs: { overrun: 100 }, expect: { mix: '500 mL', sugar: '60 g' } },
      { inputs: { overrun: 0 }, expect: { mix: '1,000 mL', sugar: '120 g' } },
    ],
  },
  {
    slug: 'pizza-dough-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Pizza',
    title: 'Pizza Dough Calculator: Flour, Water, Salt and Yeast',
    h1: 'Pizza Dough Calculator',
    metaDescription: 'Work out the flour, water, salt and yeast for any number of pizza dough balls from the ball weight and hydration.',
    about:
      'Good pizza dough is defined by percentages: the water is a share of the flour weight, called hydration, and so are the salt and the yeast. Neapolitan style dough is about 60 to 65 percent water, New York style 62 to 68 and a high hydration, airy crust 70 or more, though wetter dough is harder to shape. Salt at 2 to 3 percent flavours the crust and controls the yeast, and instant yeast at 0.2 to 0.4 percent allows a long, slow rise that develops flavour. Enter the number of dough balls, the weight of each, and the hydration, salt and yeast percentages, and the calculator works back from the total dough weight to the flour. A 250 gram ball makes a pizza of about 30 centimetres, and 280 grams a thicker 12 inch pie. Rest the dough in the refrigerator for a day or two for the best flavour and an easier stretch.',
    inputs: [
      intField('balls', 'Dough balls', 4, 1, 100),
      field('weight', 'Weight of each ball (g)', 250, 100, 600),
      field('hydration', 'Hydration (%)', 65, 50, 85),
      field('salt', 'Salt (% of flour)', 2.5, 1, 4),
      field('yeast', 'Instant yeast (% of flour)', 0.3, 0.05, 2),
    ],
    outputs: [
      { name: 'flour', label: 'Flour', format: 'text', highlight: true },
      { name: 'water', label: 'Water', format: 'text' },
      { name: 'salt', label: 'Salt', format: 'text' },
      { name: 'yeast', label: 'Instant yeast', format: 'text' },
      { name: 'total', label: 'Total dough', format: 'text' },
    ],
    calculate: (i) => {
      const total = toD(i.balls).mul(toD(i.weight));
      const flour = total.div(new D(1).add(toD(i.hydration).div(100)).add(toD(i.salt).div(100)).add(toD(i.yeast).div(100)));
      return {
        flour: `${fmtNumber(flour, 1)} g`,
        water: `${fmtNumber(flour.mul(toD(i.hydration)).div(100), 1)} g`,
        salt: `${fmtNumber(flour.mul(toD(i.salt)).div(100), 1)} g`,
        yeast: `${fmtNumber(flour.mul(toD(i.yeast)).div(100), 1)} g`,
        total: `${fmtNumber(total, 0)} g`,
      };
    },
    formulaDescription:
      'Total dough = balls × weight. Flour = total ÷ (1 + hydration + salt + yeast), each as a fraction. Water, salt and yeast = flour × their percentage.',
    workedExample:
      'Four balls of 250 g make 1,000 g of dough. At 65 % hydration, 2.5 % salt and 0.3 % yeast, flour = 1,000 ÷ 1.678 = 595.9 g, water 387.4 g, salt 14.9 g and yeast 1.8 g.',
    faq: [
      {
        question: 'What hydration should I use?',
        answer: 'Start at 62 to 65 percent. Higher is airier but stickier, and a home oven that is not very hot does better with a lower number.',
      },
      {
        question: 'Can I use active dry yeast?',
        answer: 'Yes. Use about one and a third times as much by weight and dissolve it in a little of the warm water first.',
      },
      { question: 'How long should the dough rest?', answer: 'Two hours at room temperature, or one to three days in the refrigerator for more flavour.' },
    ],
    scenarios: rows(
      ['balls', 'weight', 'hydration', 'salt', 'yeast'],
      [
        [4, 250, 65, 2.5, 0.3],
        [2, 300, 70, 2.5, 0.3],
        [4, 250, 60, 2.5, 0.3],
        [6, 270, 62, 2.8, 0.2],
        [1, 280, 65, 2.5, 0.4],
        [10, 220, 68, 2.5, 0.25],
      ],
      (v) => `${v[0]} balls of ${v[1]} g at ${v[2]} % hydration`,
    ),
    introOutputs: ['flour', 'water'],
    relatedSlugs: ['bakers-percentage-calculator', 'yeast-converter-calculator'],
    checks: [
      { inputs: {}, expect: { flour: '595.9 g', water: '387.4 g', salt: '14.9 g', yeast: '1.8 g', total: '1,000 g' } },
      { inputs: { balls: 2, weight: 300, hydration: 70 }, expect: { flour: '347.2 g', water: '243.1 g' } },
      { inputs: { hydration: 60 }, expect: { flour: '614.3 g' } },
    ],
  },
  {
    slug: 'thanksgiving-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Thanksgiving',
    title: 'Thanksgiving Calculator: Food Quantities for Your Guests',
    h1: 'Thanksgiving Calculator',
    metaDescription: 'Plan the amounts of turkey, potatoes, stuffing, gravy, cranberry sauce, green beans, rolls and pies for a Thanksgiving dinner.',
    about:
      'A holiday meal is easy to cook and hard to size, since every dish is made in bulk and leftovers are half the point. This planner uses typical amounts per guest that cooks and food writers repeat: a pound and a half of bone-in turkey, which allows for bones and a day of leftovers, half a pound of raw potatoes for mashing, half a cup of stuffing, a third of a cup of gravy, a quarter of a cup of cranberry sauce, a quarter pound of green beans, one and a half rolls and an eighth of a pie. Enter the number of guests and the pounds of turkey per guest, and you will have a shopping basis for the whole table. Adjust for the appetite of the group, for children, who eat about half, and for the number of other dishes. A larger turkey takes longer to thaw, so check the thawing and cooking pages early. Write the guest count on the shopping list before you leave, round pies and pounds up rather than down, and remember that vegetarian guests will want the sides to be a meal in themselves. Brining, spatchcocking and deep-frying change the cooking time but not the portion, so the shopping weight stays the same whichever method is chosen. Shopping lists usually add butter, sage, thyme, celery, onions, carrots, chicken stock, cinnamon, nutmeg, pumpkin puree, pecans, whipped cream, foil pans, roasting racks and a probe thermometer.',
    inputs: [intField('guests', 'Guests', 10, 1, 500), field('turkey', 'Turkey per guest (lb, bone-in)', 1.5, 1, 2.5)],
    outputs: [
      { name: 'turkey', label: 'Turkey', format: 'text', highlight: true },
      { name: 'potatoes', label: 'Potatoes for mashing', format: 'text' },
      { name: 'stuffing', label: 'Stuffing', format: 'text' },
      { name: 'gravy', label: 'Gravy', format: 'text' },
      { name: 'cranberry', label: 'Cranberry sauce', format: 'text' },
      { name: 'beans', label: 'Green beans', format: 'text' },
      { name: 'rolls', label: 'Rolls', format: 'text' },
      { name: 'pies', label: 'Pies', format: 'text' },
    ],
    calculate: (i) => {
      const g = toD(i.guests);
      return {
        turkey: `${fmtNumber(g.mul(toD(i.turkey)), 1)} lb`,
        potatoes: `${fmtNumber(g.div(2), 1)} lb`,
        stuffing: `${fmtNumber(g.div(2), 1)} cups`,
        gravy: `${fmtNumber(g.div(3), 1)} cups`,
        cranberry: `${fmtNumber(g.div(4), 1)} cups`,
        beans: `${fmtNumber(g.div(4), 1)} lb`,
        rolls: fmtNumber(g.mul('1.5').ceil(), 0),
        pies: fmtNumber(g.div(8).ceil(), 0),
      };
    },
    formulaDescription:
      'Per guest: turkey 1.5 lb, potatoes 0.5 lb, stuffing 0.5 cup, gravy ⅓ cup, cranberry sauce ¼ cup, green beans ¼ lb, rolls 1.5, pie ⅛. Totals are multiplied by the guest count; rolls and pies are rounded up.',
    workedExample:
      'Ten guests need 15 lb of turkey, 5 lb of potatoes, 5 cups of stuffing, 3.3 cups of gravy, 2.5 cups of cranberry sauce, 2.5 lb of green beans, 15 rolls and 2 pies.',
    faq: [
      { question: 'How much turkey do I need per person?', answer: 'About 1 lb per person without leftovers and 1.5 lb with them, for a whole bone-in bird.' },
      { question: 'What about children?', answer: 'Count two children as one adult, or reduce the guest count by half of the children.' },
      {
        question: 'How early should I defrost the turkey?',
        answer: 'In the refrigerator a turkey takes about 24 hours for every 4 to 5 lb. See the turkey thawing calculator.',
      },
    ],
    scenarios: plus(
      rows(
        ['guests', 'turkey'],
        [
          [10, 1.5],
          [6, 1.5],
          [20, 1.25],
          [15, 2],
          [4, 1.5],
          [30, 1.5],
        ],
        (v) => `${v[0]} guests at ${v[1]} lb of turkey each`,
      ),
      varied(
        'thanksgiving-calculator',
        6,
        [
          { name: 'guests', lo: 3, hi: 80 },
          { name: 'turkey', lo: 1.1, hi: 2.4, step: 0.05 },
        ],
        [],
        (v) => `${v.guests} guests at ${v.turkey} lb of turkey each`,
      ),
    ),
    introOutputs: ['potatoes', 'gravy', 'cranberry', 'pies'],
    relatedSlugs: ['turkey-size-calculator', 'turkey-thawing-calculator', 'turkey-cooking-time-calculator'],
    checks: [
      {
        inputs: {},
        expect: { turkey: '15 lb', potatoes: '5 lb', stuffing: '5 cups', gravy: '3.3 cups', cranberry: '2.5 cups', beans: '2.5 lb', rolls: '15', pies: '2' },
      },
      { inputs: { guests: 20, turkey: 1.25 }, expect: { turkey: '25 lb', potatoes: '10 lb', pies: '3' } },
      { inputs: { guests: 4 }, expect: { turkey: '6 lb', rolls: '6', pies: '1' } },
    ],
  },
  {
    slug: 'bbq-grill-size-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Party',
    title: 'BBQ Grill Size Calculator: Burgers per Round for a Crowd',
    h1: 'BBQ Grill Size Calculator',
    metaDescription: 'Work out how many patties fit on your grill, how many rounds of cooking a crowd needs and the grill area for one batch.',
    about:
      'A host with a small grill and a big guest list needs to know how many rounds of cooking lie ahead, and how long people will wait. Each burger patty needs room on the grates for itself and for a finger of space to turn and let the heat circulate. Enter the number of guests, the burgers each person will eat, the diameter of a patty, the clearance between them and the cooking area of the grill in square inches. The calculator treats each patty as a square of its diameter plus the clearance, counts how many fit in one round, and divides the total by that number to find the rounds. A three-burner gas grill usually has 400 to 500 square inches of main cooking surface and a small kettle charcoal grill about 360. Grill in rounds and keep finished burgers warm in a low oven, and use a thermometer to check that patties reach a safe 160 degrees Fahrenheit.',
    inputs: [
      intField('guests', 'Guests', 12, 1, 500),
      field('each', 'Burgers per guest', 1.5, 0.5, 4),
      field('diameter', 'Patty diameter (in)', 4, 2, 8),
      field('gap', 'Space between patties (in)', 1, 0.5, 3),
      field('area', 'Grill cooking area (sq in)', 300, 100, 1500),
    ],
    outputs: [
      { name: 'patties', label: 'Patties to cook', format: 'text' },
      { name: 'perRound', label: 'Patties that fit per round', format: 'text' },
      { name: 'rounds', label: 'Rounds of grilling', format: 'text', highlight: true },
      { name: 'oneBatch', label: 'Area to cook everything at once', format: 'text' },
    ],
    calculate: (i) => {
      const patties = toD(i.guests).mul(toD(i.each)).ceil();
      const cell = toD(i.diameter).add(toD(i.gap)).pow(2);
      const perRound = toD(i.area).div(cell).floor();
      const rounds = perRound.lt(1) ? new D(0) : patties.div(perRound).ceil();
      return {
        patties: fmtNumber(patties, 0),
        perRound: fmtNumber(perRound, 0),
        rounds: perRound.lt(1) ? 'Patties do not fit on this grill' : `${fmtNumber(rounds, 0)} rounds`,
        oneBatch: `${fmtNumber(patties.mul(cell), 0)} sq in (${fmtNumber(patties.mul(cell).div(144), 2)} sq ft)`,
      };
    },
    formulaDescription:
      'Patties = guests × burgers each, rounded up. Space per patty = (diameter + gap)². Per round = grill area ÷ space per patty, rounded down. Rounds = patties ÷ per round, rounded up.',
    workedExample:
      '12 guests at 1.5 burgers need 18 patties. Each takes (4 + 1)² = 25 sq in, so a 300 sq in grill holds 12 per round, which means 2 rounds. Cooking all 18 at once needs 450 sq in.',
    faq: [
      {
        question: 'How big is my grill?',
        answer: 'Multiply the length and width of the grates, or read the main cooking area in the manual. Do not count the warming rack.',
      },
      {
        question: 'What temperature are burgers cooked to?',
        answer: 'Ground beef should reach 160 degrees Fahrenheit (71 °C) inside, checked with a thermometer.',
      },
      { question: 'How long does each round take?', answer: 'About 8 to 12 minutes for a 4 inch patty, so plan for rounds of 10 minutes plus time to rest.' },
    ],
    scenarios: rows(
      ['guests', 'each', 'diameter', 'gap', 'area'],
      [
        [12, 1.5, 4, 1, 300],
        [12, 1.5, 4, 1, 450],
        [20, 2, 4, 1, 450],
        [8, 1, 5, 1, 360],
        [30, 1.5, 3.5, 1, 500],
        [6, 2, 4, 1, 250],
      ],
      (v) => `${v[0]} guests at ${v[1]} burgers on ${v[4]} sq in`,
    ),
    introOutputs: ['patties', 'rounds'],
    relatedSlugs: ['bbq-party-calculator', 'steak-cook-time-calculator'],
    checks: [
      { inputs: {}, expect: { patties: '18', perRound: '12', rounds: '2 rounds', oneBatch: '450 sq in (3.13 sq ft)' } },
      { inputs: { area: 450 }, expect: { perRound: '18', rounds: '1 rounds' } },
      { inputs: { guests: 20, each: 2, area: 450 }, expect: { patties: '40', rounds: '3 rounds' } },
    ],
  },
  {
    slug: 'bbq-party-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Party',
    title: 'BBQ Party Calculator: How Much Meat to Buy',
    h1: 'BBQ Party Calculator',
    metaDescription: 'Work out the raw weight of brisket, pork shoulder or chicken to buy for a barbecue from the guest count and appetite.',
    about:
      'Smoked and slow-cooked meats shrink a lot as they cook, as fat renders and moisture leaves, so the weight you buy is much more than the weight on the plate. Brisket loses about half of its raw weight, pork shoulder somewhat less, and bone-in chicken pieces about a third once bones are counted. Planners start with a portion of cooked meat per guest: about a third of a pound for light eaters, half a pound for an average group and three quarters for a hungry one. Enter the number of guests, the appetite and the meat, and the page divides the cooked amount by the yield to give the raw weight in pounds and kilograms. Allow extra when the meat is the only main dish, and less when there are many sides. Cook to a safe internal temperature, which is 145 degrees Fahrenheit for whole cuts of pork and 165 for poultry, and allow the meat to rest before slicing. Order from the butcher a few days ahead for a big cut, since brisket and shoulder are often cut to order, and keep a cooler of ice for the raw meat until it goes on the smoker.',
    inputs: [
      intField('guests', 'Guests', 20, 1, 1000),
      select('appetite', 'Appetite', 'average', [
        ['light', 'Light (⅓ lb cooked)'],
        ['average', 'Average (½ lb)'],
        ['hearty', 'Hearty (¾ lb)'],
      ]),
      select('meat', 'Meat', 'brisket', [
        ['brisket', 'Brisket (50 % yield)'],
        ['pork', 'Pork shoulder (55 % yield)'],
        ['chicken', 'Chicken pieces, bone-in (70 % yield)'],
      ]),
    ],
    outputs: [
      { name: 'cooked', label: 'Cooked meat needed', format: 'text' },
      { name: 'raw', label: 'Raw meat to buy', format: 'text', highlight: true },
      { name: 'kg', label: 'Raw meat in kilograms', format: 'text' },
    ],
    calculate: (i) => {
      const per = new D({ light: '0.33', average: '0.5', hearty: '0.75' }[String(i.appetite)] ?? '0.5');
      const yieldRate = new D({ brisket: '0.5', pork: '0.55', chicken: '0.7' }[String(i.meat)] ?? '0.5');
      const cooked = toD(i.guests).mul(per);
      const raw = cooked.div(yieldRate);
      return { cooked: `${fmtNumber(cooked, 1)} lb`, raw: `${fmtNumber(raw, 1)} lb`, kg: `${fmtNumber(raw.mul(KG_PER_LB), 1)} kg` };
    },
    formulaDescription:
      'Cooked meat = guests × cooked pounds per guest (0.33, 0.5 or 0.75). Raw meat = cooked ÷ yield (brisket 0.5, pork shoulder 0.55, chicken 0.7).',
    workedExample: '20 guests at half a pound of cooked brisket each need 10 lb cooked. With a 50 % yield you buy 20 lb raw, which is 9.1 kg.',
    faq: [
      {
        question: 'Why does brisket lose so much weight?',
        answer: 'Fat renders out and water evaporates over many hours of cooking. The surface also forms a crust that is trimmed or sliced off.',
      },
      { question: 'How much should I add if it is the only dish?', answer: 'Raise the appetite one step, and add about 10 percent for leftovers.' },
      {
        question: 'What internal temperature is safe?',
        answer:
          'Poultry 165 degrees Fahrenheit, whole cuts of pork 145 with a rest, and brisket is taken higher, to about 200, for tenderness. Use a thermometer.',
      },
    ],
    scenarios: [
      withInputs('20 guests, average appetite, brisket', { guests: 20, appetite: 'average', meat: 'brisket' }),
      withInputs('20 guests, pulled pork', { guests: 20, appetite: 'average', meat: 'pork' }),
      withInputs('12 hungry guests, chicken', { guests: 12, appetite: 'hearty', meat: 'chicken' }),
      withInputs('50 guests, light appetite, pork', { guests: 50, appetite: 'light', meat: 'pork' }),
      withInputs('8 guests, brisket', { guests: 8, appetite: 'average', meat: 'brisket' }),
      ...varied(
        'bbq-party-calculator',
        6,
        [{ name: 'guests', lo: 9, hi: 160 }],
        [
          { name: 'appetite', options: ['light', 'average', 'hearty'] },
          { name: 'meat', options: ['brisket', 'pork', 'chicken'] },
        ],
        (v) => `${v.guests} guests, ${v.appetite} appetite, ${v.meat}`,
      ),
    ],
    introOutputs: ['cooked', 'raw'],
    relatedSlugs: ['bbq-grill-size-calculator', 'ham-per-person-calculator'],
    checks: [
      { inputs: {}, expect: { cooked: '10 lb', raw: '20 lb', kg: '9.1 kg' } },
      { inputs: { meat: 'pork' }, expect: { raw: '18.2 lb' } },
      { inputs: { guests: 12, appetite: 'hearty', meat: 'chicken' }, expect: { cooked: '9 lb', raw: '12.9 lb' } },
    ],
  },
  {
    slug: 'ham-per-person-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Party',
    title: 'Ham per Person Calculator: Size of Ham to Buy',
    h1: 'Ham per Person Calculator',
    metaDescription: 'Find how many pounds of ham to buy for your guests, for boneless or bone-in ham, with or without leftovers.',
    about:
      'Ham is the centrepiece of Easter and Christmas tables, and buying the right size means weighing the bone. A boneless ham is all meat, so a third of a pound per person is plenty when other dishes are served, while a bone-in ham carries the weight of the bone and needs half a pound each. A spiral-cut ham is a bone-in ham sliced for you and is sized like one. Cooks who want sandwiches the next day should plan on half as much again. Choose the type, the number of guests and whether you want light portions, a normal meal or leftovers, and the page returns the weight in pounds and kilograms and the number of servings at 4 ounces each. Most hams in the shop are already cooked, so check the label for whether the ham is fully cooked or must be cooked before eating, and use a thermometer in the thickest part.',
    inputs: [
      intField('guests', 'Guests', 12, 1, 500),
      select('type', 'Type of ham', 'bone-in', [
        ['boneless', 'Boneless (⅓ lb each)'],
        ['bone-in', 'Bone-in or spiral (½ lb each)'],
      ]),
      select('plan', 'Plan', 'normal', [
        ['light', 'Light, many other dishes (× 0.75)'],
        ['normal', 'Normal meal (× 1)'],
        ['leftovers', 'With leftovers (× 1.5)'],
      ]),
    ],
    outputs: [
      { name: 'lb', label: 'Ham to buy', format: 'text', highlight: true },
      { name: 'kg', label: 'In kilograms', format: 'text' },
      { name: 'servings', label: 'Servings of 4 oz of meat', format: 'text' },
    ],
    calculate: (i) => {
      const base = new D(String(i.type) === 'boneless' ? '0.33' : '0.5');
      const plan = new D({ light: '0.75', normal: '1', leftovers: '1.5' }[String(i.plan)] ?? '1');
      const lb = toD(i.guests).mul(base).mul(plan);
      const meat = String(i.type) === 'boneless' ? lb : lb.mul('0.6');
      return { lb: `${fmtNumber(lb, 1)} lb`, kg: `${fmtNumber(lb.mul(KG_PER_LB), 1)} kg`, servings: fmtNumber(meat.mul(4).floor(), 0) };
    },
    formulaDescription:
      'Ham = guests × pounds per guest (boneless 0.33, bone-in 0.5) × plan factor (0.75, 1 or 1.5). Servings = meat pounds × 4, where bone-in ham is taken as 60 % meat.',
    workedExample:
      '12 guests with a bone-in ham at half a pound each need 6 lb, which is 2.7 kg. With leftovers, 9 lb. A boneless ham for the same group is 4 lb.',
    faq: [
      { question: 'How much ham is in a bone-in ham?', answer: 'About 55 to 65 percent of the weight is edible meat, the rest being bone, skin and fat.' },
      {
        question: 'How do I reheat a cooked ham?',
        answer: 'Warm it in a 325 °F (160 °C) oven covered with foil until a thermometer reads 140 °F (60 °C), then rest it before carving.',
      },
      {
        question: 'What is a spiral ham?',
        answer: 'A bone-in ham sliced round the bone, which makes serving easy. It dries out faster, so keep it covered while it reheats.',
      },
    ],
    scenarios: [
      withInputs('12 guests, bone-in ham', { guests: 12, type: 'bone-in', plan: 'normal' }),
      withInputs('12 guests, boneless ham', { guests: 12, type: 'boneless', plan: 'normal' }),
      withInputs('12 guests with leftovers, bone-in', { guests: 12, type: 'bone-in', plan: 'leftovers' }),
      withInputs('30 guests with many sides, boneless', { guests: 30, type: 'boneless', plan: 'light' }),
      withInputs('6 guests, bone-in', { guests: 6, type: 'bone-in', plan: 'normal' }),
    ],
    introOutputs: ['lb', 'servings'],
    relatedSlugs: ['bbq-party-calculator', 'turkey-size-calculator'],
    checks: [
      { inputs: {}, expect: { lb: '6 lb', kg: '2.7 kg', servings: '14' } },
      { inputs: { type: 'boneless' }, expect: { lb: '4 lb', servings: '15' } },
      { inputs: { plan: 'leftovers' }, expect: { lb: '9 lb' } },
    ],
  },
  {
    slug: 'popcorn-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Party',
    title: 'Popcorn Calculator: Kernels Needed for a Crowd',
    h1: 'Popcorn Calculator',
    metaDescription: 'Work out how much unpopped popcorn kernels you need for guests, with the popped volume in quarts and the weight in grams.',
    about:
      'Popcorn grows by thirty to forty times when it pops, because the moisture inside each kernel turns to steam and bursts the hull. A quarter cup of kernels makes about eight cups of popped corn, enough for two or three movie-night servings, which is why a small amount of kernels fills a very large bowl. Enter the number of guests, the cups of popped corn for each person and the expansion ratio, and the calculator finds the cups of kernels, the tablespoons and the weight. It also gives the popped volume in quarts so that you can choose a bowl or a pot. Popping large batches in a heavy pot with a lid is done in rounds, because a pot should be only a third filled with kernels when it has begun to pop, and one round of a quarter cup fills about a 4 quart bowl. Fresh kernels pop to a larger volume than old ones, which lose moisture.',
    inputs: [
      intField('guests', 'Guests', 12, 1, 1000),
      field('cups', 'Popped cups per person', 4, 1, 12),
      field('ratio', 'Expansion (popped cups per cup of kernels)', 32, 20, 50),
    ],
    outputs: [
      { name: 'kernels', label: 'Kernels needed', format: 'text', highlight: true },
      { name: 'tbsp', label: 'In tablespoons', format: 'text' },
      { name: 'grams', label: 'Weight of kernels', format: 'text' },
      { name: 'popped', label: 'Popped corn', format: 'text' },
    ],
    calculate: (i) => {
      const popped = toD(i.guests).mul(toD(i.cups));
      const kernels = popped.div(toD(i.ratio));
      return {
        kernels: `${fmtNumber(kernels, 2)} cups`,
        tbsp: `${fmtNumber(kernels.mul(16), 1)} tbsp`,
        grams: `${fmtNumber(kernels.mul(190), 0)} g`,
        popped: `${fmtNumber(popped, 0)} cups (${fmtNumber(popped.div(4), 1)} quarts)`,
      };
    },
    formulaDescription: 'Popped cups = guests × cups each. Kernels (cups) = popped cups ÷ expansion ratio. Tablespoons = cups × 16. Weight = cups × 190 g.',
    workedExample:
      '12 guests at 4 cups each is 48 cups of popcorn, or 12 quarts. With an expansion of 32, that takes 1.5 cups of kernels, 24 tablespoons or 285 g.',
    faq: [
      {
        question: 'Why do some kernels not pop?',
        answer: 'They have too little moisture or a cracked hull. Old kernels and kernels stored in a dry place pop worse, so keep them in a sealed jar.',
      },
      { question: 'How much oil do I need?', answer: 'About 2 to 3 tablespoons of oil per half cup of kernels on the stove, enough to coat them thinly.' },
      {
        question: 'Does microwave popcorn follow the same rule?',
        answer: 'Bagged popcorn already has the right amount of kernels. Check the weight on the bag for the volume it makes.',
      },
    ],
    scenarios: rows(
      ['guests', 'cups', 'ratio'],
      [
        [12, 4, 32],
        [4, 3, 32],
        [30, 4, 32],
        [20, 3, 40],
        [8, 5, 28],
        [50, 2, 32],
      ],
      (v) => `${v[0]} guests with ${v[1]} cups each at ${v[2]} times expansion`,
    ),
    introOutputs: ['kernels', 'popped'],
    relatedSlugs: ['party-drink-calculator', 'taco-bar-calculator'],
    checks: [
      { inputs: {}, expect: { kernels: '1.5 cups', tbsp: '24 tbsp', grams: '285 g', popped: '48 cups (12 quarts)' } },
      { inputs: { ratio: 40 }, expect: { kernels: '1.2 cups', grams: '228 g' } },
      { inputs: { guests: 4, cups: 3 }, expect: { popped: '12 cups (3 quarts)' } },
    ],
  },
  {
    slug: 'taco-bar-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Party',
    title: 'Taco Bar Calculator: Meat, Shells and Toppings for a Party',
    h1: 'Taco Bar Calculator',
    metaDescription: 'Plan a taco bar from the guest count: pounds of meat, tortillas, cheese, lettuce and salsa.',
    about:
      'A taco bar feeds a crowd cheaply and lets everyone build their own, but the amounts are easy to get wrong, since tortillas run out first and the toppings are all different. Planners assume each guest eats about three tacos, with a couple of ounces of cooked meat in each, half an ounce of shredded cheese, a quarter cup of shredded lettuce and a tablespoon of salsa. Enter the number of guests and tacos each, and the page totals the meat in pounds, the tortillas with ten percent in reserve for tears and second helpings, the cheese in ounces, the lettuce in cups and the salsa in cups. Cook the meat ahead and hold it hot, keeping cold toppings on ice, so that nothing stays out of refrigeration for more than two hours. Add beans, rice, sour cream, guacamole and lime wedges as extra sides, and offer a vegetarian filling.',
    inputs: [intField('guests', 'Guests', 10, 1, 500), field('tacos', 'Tacos per guest', 3, 1, 6), field('meat', 'Cooked meat per taco (oz)', 2, 1, 4)],
    outputs: [
      { name: 'total', label: 'Tacos in all', format: 'text' },
      { name: 'meat', label: 'Cooked meat', format: 'text', highlight: true },
      { name: 'tortillas', label: 'Tortillas or shells', format: 'text' },
      { name: 'cheese', label: 'Shredded cheese', format: 'text' },
      { name: 'lettuce', label: 'Shredded lettuce', format: 'text' },
      { name: 'salsa', label: 'Salsa', format: 'text' },
    ],
    calculate: (i) => {
      const tacos = toD(i.guests).mul(toD(i.tacos));
      return {
        total: fmtNumber(tacos, 0),
        meat: `${fmtNumber(tacos.mul(toD(i.meat)).div(16), 1)} lb`,
        tortillas: fmtNumber(tacos.mul('1.1').ceil(), 0),
        cheese: `${fmtNumber(tacos.div(2), 1)} oz`,
        lettuce: `${fmtNumber(tacos.div(4), 1)} cups`,
        salsa: `${fmtNumber(tacos.div(16), 1)} cups`,
      };
    },
    formulaDescription:
      'Tacos = guests × tacos each. Meat = tacos × ounces ÷ 16 pounds. Tortillas = tacos × 1.1, rounded up. Cheese = ½ oz per taco, lettuce ¼ cup per taco, salsa 1 tablespoon (1/16 cup) per taco.',
    workedExample:
      '10 guests at 3 tacos is 30 tacos. They take 3.8 lb of meat at 2 oz each, 33 tortillas, 15 oz of cheese, 7.5 cups of lettuce and 1.9 cups of salsa.',
    faq: [
      { question: 'How many tacos does a guest eat?', answer: 'Two to four, with three the usual planning number. Raise it for teenagers and hungry crowds.' },
      {
        question: 'How long can the food sit out?',
        answer: 'Two hours at most, or one hour above 90 degrees Fahrenheit. Keep hot food hot and cold food on ice.',
      },
      { question: 'What if some guests are vegetarian?', answer: 'Reduce the meat for them and add beans, grilled vegetables or roasted sweet potato.' },
    ],
    scenarios: rows(
      ['guests', 'tacos', 'meat'],
      [
        [10, 3, 2],
        [20, 3, 2],
        [6, 2, 2],
        [30, 4, 2],
        [15, 3, 3],
        [12, 3, 1.5],
      ],
      (v) => `${v[0]} guests at ${v[1]} tacos with ${v[2]} oz of meat`,
    ),
    introOutputs: ['meat', 'tortillas'],
    relatedSlugs: ['popcorn-calculator', 'party-drink-calculator'],
    checks: [
      { inputs: {}, expect: { total: '30', meat: '3.8 lb', tortillas: '33', cheese: '15 oz', lettuce: '7.5 cups', salsa: '1.9 cups' } },
      { inputs: { guests: 20 }, expect: { meat: '7.5 lb', tortillas: '66' } },
      { inputs: { guests: 6, tacos: 2 }, expect: { total: '12', tortillas: '14' } },
    ],
  },
  {
    slug: 'wedding-alcohol-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Party',
    title: 'Wedding Alcohol Calculator: Wine, Beer and Spirits',
    h1: 'Wedding Alcohol Calculator',
    metaDescription: 'Estimate bottles of wine, beers and bottles of spirits for a wedding from the guests, hours and your split of drinks.',
    about:
      'Wedding planners use a well-known rule of thumb: guests drink two drinks in the first hour and one each hour after that. For a five hour reception that is six drinks a guest, so a hundred guests will drink about six hundred. How those drinks divide between wine, beer and spirits depends on the crowd and on whether a signature cocktail is served. Enter the guests and the hours, the share of drinks that will be wine and the share beer, and the rest is taken as spirits. The calculator turns each share into bottles using standard servings: five glasses of wine to a 750 millilitre bottle, one beer per serving and about 17 drinks of 1.5 ounces from a 750 millilitre bottle of spirits. Rounding up is wise, since unopened bottles can often be returned. Also buy plenty of water and soft drinks, arrange transport for guests, and make sure the bar serves responsibly. Couples on a budget often serve only beer and wine, and a signature cocktail in place of a full bar cuts the number of spirit bottles a great deal. Ask the caterer or venue about corkage and licence rules, and keep ice, mixers, lemons, limes, glassware and a few non-alcoholic choices on the order sheet. Typical extras are champagne flutes for the toast, prosecco, signature cocktails, garnishes, bartenders, coolers, tumblers, napkins and a rental company for tables, linen and glassware.',
    inputs: [
      intField('guests', 'Guests who drink', 100, 1, 2000),
      field('hours', 'Hours of the reception', 5, 1, 12),
      field('wine', 'Share of drinks that are wine (%)', 40, 0, 100),
      field('beer', 'Share of drinks that are beer (%)', 40, 0, 100),
    ],
    outputs: [
      { name: 'drinks', label: 'Drinks in total', format: 'text' },
      { name: 'wine', label: 'Wine bottles (750 mL)', format: 'text', highlight: true },
      { name: 'beer', label: 'Beers', format: 'text' },
      { name: 'spirits', label: 'Spirit bottles (750 mL)', format: 'text' },
    ],
    calculate: (i) => {
      const drinks = toD(i.guests).mul(new D(2).add(toD(i.hours).sub(1)));
      const wineShare = toD(i.wine).div(100);
      const beerShare = toD(i.beer).div(100);
      const rest = new D(1).sub(wineShare).sub(beerShare);
      const spiritShare = rest.lt(0) ? new D(0) : rest;
      return {
        drinks: fmtNumber(drinks, 0),
        wine: `${fmtNumber(drinks.mul(wineShare).div(5).ceil(), 0)} bottles`,
        beer: fmtNumber(drinks.mul(beerShare).ceil(), 0),
        spirits: `${fmtNumber(
          drinks
            .mul(spiritShare)
            .div(new D(750).div(new D('44.3603')))
            .ceil(),
          0,
        )} bottles`,
      };
    },
    formulaDescription:
      'Drinks per guest = 2 + (hours − 1). Wine bottles = drinks × wine share ÷ 5. Beers = drinks × beer share. Spirit bottles = drinks × (1 − wine − beer) ÷ 16.9, where a drink is 1.5 oz (44.4 mL).',
    workedExample:
      '100 guests for 5 hours drink 100 × 6 = 600 drinks. With 40 % wine and 40 % beer: 240 wine drinks is 48 bottles, 240 beers, and 120 spirit drinks is 8 bottles.',
    faq: [
      {
        question: 'Is the two then one rule right?',
        answer: 'It is a common starting point. Adjust for the time of day, the crowd and the other entertainment, and plan more for a long dinner.',
      },
      { question: 'Should I count guests who do not drink?', answer: 'Enter only the number who drink. Children and non-drinkers should be left out.' },
      {
        question: 'What if I serve champagne for the toast?',
        answer: 'A 750 mL bottle gives six flutes of 4 oz, so allow one flute per guest and add it to the wine.',
      },
    ],
    scenarios: plus(
      rows(
        ['guests', 'hours', 'wine', 'beer'],
        [
          [100, 5, 40, 40],
          [50, 4, 50, 30],
          [150, 6, 45, 35],
          [80, 5, 30, 50],
          [200, 4, 40, 40],
          [30, 3, 60, 20],
        ],
        (v) => `${v[0]} guests for ${v[1]} hours, ${v[2]} % wine and ${v[3]} % beer`,
      ),
      varied(
        'wedding-alcohol-calculator',
        6,
        [
          { name: 'guests', lo: 20, hi: 400 },
          { name: 'hours', lo: 2, hi: 10 },
          { name: 'wine', lo: 20, hi: 60 },
          { name: 'beer', lo: 10, hi: 40 },
        ],
        [],
        (v) => `${v.guests} guests for ${v.hours} hours, ${v.wine} % wine and ${v.beer} % beer`,
      ),
    ),
    introOutputs: ['drinks', 'wine'],
    relatedSlugs: ['party-drink-calculator', 'alcohol-dilution-calculator'],
    checks: [
      { inputs: {}, expect: { drinks: '600', wine: '48 bottles', beer: '240', spirits: '8 bottles' } },
      { inputs: { guests: 50, hours: 4, wine: 50, beer: 30 }, expect: { drinks: '250', wine: '25 bottles', beer: '75', spirits: '3 bottles' } },
      { inputs: { wine: 100, beer: 0 }, expect: { spirits: '0 bottles' } },
    ],
  },
  {
    slug: 'egg-boiling-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Other',
    title: 'Egg Boiling Calculator: Time for Soft, Jammy and Hard Eggs',
    h1: 'Egg Boiling Calculator',
    metaDescription: 'Get the boiling time for an egg from the doneness you want, the egg size and whether it starts in the refrigerator.',
    about:
      'The difference between a runny yolk and a chalky one is a minute or two, and the right minute depends on the egg. A large egg lowered straight from the fridge into gently boiling water takes about six minutes for a soft yolk with a set white, seven and a half for a jammy centre, nine for a medium set and eleven and a half for a fully hard-boiled egg. A smaller egg needs a little less and a bigger one a little more, and an egg at room temperature cooks about a minute faster because it has less to heat. Pick the doneness, the size and the start, and the calculator returns the time in minutes and seconds. Lower the eggs carefully with a spoon, start the timer when the water returns to a simmer and move them straight to ice water when the time is up, which stops the cooking and makes them easier to peel. Hard-boiled eggs keep a week in the refrigerator.',
    inputs: [
      select('done', 'Doneness', 'hard', [
        ['soft', 'Soft: runny yolk, set white'],
        ['jammy', 'Jammy: soft, creamy centre'],
        ['medium', 'Medium: yolk just set'],
        ['hard', 'Hard: fully set'],
      ]),
      select('size', 'Egg size', 'large', [
        ['small', 'Small'],
        ['medium', 'Medium'],
        ['large', 'Large'],
        ['xl', 'Extra large'],
        ['jumbo', 'Jumbo'],
      ]),
      select('start', 'Start', 'fridge', [
        ['fridge', 'Straight from the refrigerator'],
        ['room', 'Room temperature'],
      ]),
    ],
    outputs: [
      { name: 'time', label: 'Boiling time', format: 'text', highlight: true },
      { name: 'after', label: 'Then', format: 'text' },
    ],
    calculate: (i) => {
      const base = new D({ soft: '6', jammy: '7.5', medium: '9', hard: '11.5' }[String(i.done)] ?? '11.5');
      const size = new D({ small: '-1', medium: '-0.5', large: '0', xl: '0.5', jumbo: '1' }[String(i.size)] ?? '0');
      const start = new D(String(i.start) === 'room' ? '-1' : '0');
      return { time: mmss(base.add(size).add(start)), after: 'Move to ice water for 5 minutes, then peel' };
    },
    formulaDescription:
      'Time = base time for the doneness (soft 6, jammy 7.5, medium 9, hard 11.5 minutes) + size adjustment (small −1, medium −½, large 0, extra large +½, jumbo +1) − 1 minute if the egg starts at room temperature.',
    workedExample: 'A large egg from the refrigerator boiled hard takes 11:30. A small room-temperature egg boiled to a jammy yolk takes 7.5 − 1 − 1 = 5:30.',
    faq: [
      {
        question: 'When do I start the timer?',
        answer: 'When the egg goes into water that is boiling or just back to a simmer. A rolling boil bangs eggs and cracks them.',
      },
      { question: 'Why use ice water?', answer: 'It stops the cooking at once, which prevents the grey ring around the yolk and loosens the shell.' },
      {
        question: 'Is a runny yolk safe?',
        answer: 'Eggs with a runny yolk are not fully cooked, and for pregnant women, the elderly and the very young the advice is to cook eggs until firm.',
      },
    ],
    scenarios: [
      withInputs('A large egg, hard, from the refrigerator', { done: 'hard', size: 'large', start: 'fridge' }),
      withInputs('A large egg, soft, from the refrigerator', { done: 'soft', size: 'large', start: 'fridge' }),
      withInputs('A small egg, jammy, at room temperature', { done: 'jammy', size: 'small', start: 'room' }),
      withInputs('An extra-large egg, hard, at room temperature', { done: 'hard', size: 'xl', start: 'room' }),
      withInputs('A medium egg, medium, from the refrigerator', { done: 'medium', size: 'medium', start: 'fridge' }),
    ],
    introOutputs: ['time'],
    relatedSlugs: ['steak-cook-time-calculator', 'rice-to-water-ratio-calculator'],
    checks: [
      { inputs: {}, expect: { time: '11:30' } },
      { inputs: { done: 'soft' }, expect: { time: '6:00' } },
      { inputs: { done: 'jammy', size: 'small', start: 'room' }, expect: { time: '5:30' } },
      { inputs: { size: 'xl', start: 'room' }, expect: { time: '11:00' } },
    ],
  },
  {
    slug: 'mashed-potatoes-per-person-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Other',
    title: 'Mashed Potatoes per Person: Potatoes, Butter and Milk',
    h1: 'Mashed Potatoes per Person Calculator',
    metaDescription: 'Find how many pounds of potatoes to peel for mashed potatoes for your guests, with butter and milk amounts.',
    about:
      'Mashed potatoes are a side dish that vanishes first, so cooks plan generously. Raw potatoes lose a little to peeling, then mash down to about the same weight once butter and milk go in, which means each pound of raw potatoes gives roughly two good servings. A third of a pound each suits a crowded buffet, half a pound is the standard for a sit-down dinner, and three quarters of a pound is for a holiday table where seconds are expected. Choose the guests and the portion, and the calculator gives the pounds and kilograms of potatoes, the butter at two tablespoons per pound and the warm milk at a quarter of a cup per pound. Floury potatoes such as russets and Yukon Golds mash the lightest, and waxy ones turn gluey. Start them in cold, salted water, drain well and mash while hot, adding warm milk gradually, since the potatoes absorb it.',
    inputs: [
      intField('guests', 'Guests', 10, 1, 500),
      select('portion', 'Portion', 'normal', [
        ['small', 'Small, buffet (⅓ lb raw each)'],
        ['normal', 'Normal (½ lb)'],
        ['big', 'Generous, with seconds (¾ lb)'],
      ]),
    ],
    outputs: [
      { name: 'lb', label: 'Raw potatoes', format: 'text', highlight: true },
      { name: 'kg', label: 'In kilograms', format: 'text' },
      { name: 'butter', label: 'Butter', format: 'text' },
      { name: 'milk', label: 'Warm milk', format: 'text' },
    ],
    calculate: (i) => {
      const per = new D({ small: '0.33', normal: '0.5', big: '0.75' }[String(i.portion)] ?? '0.5');
      const lb = toD(i.guests).mul(per);
      return {
        lb: `${fmtNumber(lb, 1)} lb`,
        kg: `${fmtNumber(lb.mul(KG_PER_LB), 1)} kg`,
        butter: `${fmtNumber(lb.mul(2), 1)} tbsp`,
        milk: `${fmtNumber(lb.div(4), 2)} cups`,
      };
    },
    formulaDescription: 'Potatoes = guests × pounds per guest (0.33, 0.5 or 0.75). Butter = 2 tablespoons per pound. Milk = ¼ cup per pound.',
    workedExample: '10 guests at half a pound each need 5 lb of potatoes, which is 2.3 kg, with 10 tablespoons of butter and 1.25 cups of milk.',
    faq: [
      {
        question: 'What are the best potatoes for mashing?',
        answer: 'Floury or all-purpose potatoes, such as russets and Yukon Golds. Waxy potatoes can turn gluey.',
      },
      {
        question: 'How do I keep them warm?',
        answer: 'In a covered bowl over a pan of hot water, or in a slow cooker on low, stirring in a splash of warm milk before serving.',
      },
      { question: 'Can I make them ahead?', answer: 'Yes. Cover and refrigerate for a day, then reheat gently with a little extra milk or butter.' },
    ],
    scenarios: [
      withInputs('10 guests, normal portion', { guests: 10, portion: 'normal' }),
      withInputs('12 guests, generous', { guests: 12, portion: 'big' }),
      withInputs('40 guests at a buffet', { guests: 40, portion: 'small' }),
      withInputs('4 guests, normal', { guests: 4, portion: 'normal' }),
      withInputs('25 guests, generous', { guests: 25, portion: 'big' }),
    ],
    introOutputs: ['lb', 'butter'],
    relatedSlugs: ['thanksgiving-calculator', 'turkey-size-calculator'],
    checks: [
      { inputs: {}, expect: { lb: '5 lb', kg: '2.3 kg', butter: '10 tbsp', milk: '1.25 cups' } },
      { inputs: { guests: 12, portion: 'big' }, expect: { lb: '9 lb', butter: '18 tbsp', milk: '2.25 cups' } },
      { inputs: { guests: 40, portion: 'small' }, expect: { lb: '13.2 lb' } },
    ],
  },
  {
    slug: 'steak-cook-time-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Other',
    title: 'Steak Cook Time Calculator: Minutes per Side by Doneness',
    h1: 'Steak Cook Time Calculator',
    metaDescription: 'Get the minutes per side for a steak from its thickness and the doneness you want, with the internal temperature to aim for.',
    about:
      'A steak is done when the middle reaches the temperature you like, and the time that takes depends mostly on the thickness. On a hot grill or in a hot pan, each inch of thickness needs about the same time per side: roughly three minutes for rare, four for medium rare, five for medium, six for medium well and seven for well done. A one and a half inch steak therefore needs about six minutes per side for medium rare. Enter the thickness in inches and the doneness, and the calculator returns the minutes on each side, the total and the internal temperature that a thermometer should show in both Fahrenheit and Celsius. The time is a guide and a thermometer is the real test. Take the steak off a few degrees before the target, since it keeps cooking as it rests for five minutes, and note that the food safety agencies advise 145 degrees Fahrenheit with a three minute rest for whole cuts.',
    inputs: [
      field('thick', 'Thickness (in)', 1, 0.5, 3),
      select('done', 'Doneness', 'medium-rare', [
        ['rare', 'Rare'],
        ['medium-rare', 'Medium rare'],
        ['medium', 'Medium'],
        ['medium-well', 'Medium well'],
        ['well', 'Well done'],
      ]),
    ],
    outputs: [
      { name: 'side', label: 'Per side', format: 'text', highlight: true },
      { name: 'total', label: 'Total cooking time', format: 'text' },
      { name: 'temp', label: 'Internal temperature to reach', format: 'text' },
    ],
    calculate: (i) => {
      const perInch = new D({ rare: '3', 'medium-rare': '4', medium: '5', 'medium-well': '6', well: '7' }[String(i.done)] ?? '4');
      const temp: Record<string, string> = {
        rare: '120 to 125 °F (49 to 52 °C)',
        'medium-rare': '130 to 135 °F (54 to 57 °C)',
        medium: '140 to 145 °F (60 to 63 °C)',
        'medium-well': '150 to 155 °F (66 to 68 °C)',
        well: '160 °F and above (71 °C)',
      };
      const side = perInch.mul(toD(i.thick));
      return { side: `${fmtNumber(side, 1)} min`, total: `${fmtNumber(side.mul(2), 1)} min`, temp: temp[String(i.done)] ?? temp['medium-rare'] };
    },
    formulaDescription: 'Minutes per side = thickness (in) × minutes per inch (rare 3, medium rare 4, medium 5, medium well 6, well 7). Total = 2 × per side.',
    workedExample: 'A 1.5 inch steak at medium rare takes 1.5 × 4 = 6 minutes per side and 12 minutes in all, until a thermometer reads 130 to 135 °F.',
    faq: [
      {
        question: 'Should I rest the steak?',
        answer: 'Yes, for about 5 minutes under loose foil. The juices settle and the temperature rises by 3 to 5 degrees.',
      },
      {
        question: 'How hot should the pan be?',
        answer: 'Very hot, so the surface browns within a minute. The times above assume a hot grill or a heavy pan over high heat.',
      },
      {
        question: 'Is medium rare safe?',
        answer:
          'Food safety agencies advise 145 degrees Fahrenheit for whole cuts of beef, rested for three minutes. Cooking to a lower temperature is a personal choice with a greater risk.',
      },
    ],
    scenarios: rows(['thick'], [[1], [1.5], [0.75], [2], [1.25], [1]], (v) => `A steak ${v[0]} in thick`).map((s, k) => ({
      ...s,
      label: `A steak ${s.inputs.thick} in thick, ${['medium rare', 'medium', 'rare', 'well done', 'medium well', 'rare'][k]}`,
      inputs: { ...s.inputs, done: ['medium-rare', 'medium', 'rare', 'well', 'medium-well', 'rare'][k] },
    })),
    introOutputs: ['side', 'temp'],
    relatedSlugs: ['egg-boiling-calculator', 'bbq-grill-size-calculator'],
    checks: [
      { inputs: {}, expect: { side: '4 min', total: '8 min', temp: '130 to 135 °F (54 to 57 °C)' } },
      { inputs: { thick: 1.5, done: 'medium-well' }, expect: { side: '9 min', total: '18 min' } },
      { inputs: { thick: 2, done: 'rare' }, expect: { side: '6 min', temp: '120 to 125 °F (49 to 52 °C)' } },
    ],
  },
  {
    slug: 'food-stockpile-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Other',
    title: 'Food Stockpile Calculator: Staples and Water for a Household',
    h1: 'Food Stockpile Calculator',
    metaDescription: 'Plan the calories, kilograms of a staple food and litres of water a household needs to be stocked for a number of days.',
    about:
      'Stocking the pantry ahead of a storm, a quarantine or a supply interruption comes down to two numbers, energy and water. An adult needs about 2,000 kilocalories a day on average, more for those who work hard and less for small children, and emergency guidance puts the water requirement at a gallon, about 3.8 litres, for each person each day, to cover drinking and basic hygiene. Enter the number of people, the days you want to cover, the calories per person and the share of the energy you plan to get from a staple food. The calculator finds the total energy, the weight of the staple that supplies the share you chose, using its dry energy density, and the volume of water. Dry rice, pasta, beans, flour and oats store for a year or more when sealed and kept dry. Add oil, canned foods, any special diets, pet food and medicines, and rotate the stock so that the oldest is used first.',
    inputs: [
      intField('people', 'People', 4, 1, 100),
      intField('days', 'Days to cover', 14, 1, 365),
      field('kcal', 'Calories per person per day', 2000, 1000, 4000),
      select('staple', 'Main staple', 'rice', [
        ['rice', 'White rice (3.65 kcal/g dry)'],
        ['pasta', 'Dry pasta (3.7 kcal/g)'],
        ['beans', 'Dried beans (3.4 kcal/g)'],
        ['flour', 'Wheat flour (3.64 kcal/g)'],
        ['oats', 'Rolled oats (3.89 kcal/g)'],
      ]),
      field('share', 'Share of calories from the staple (%)', 60, 10, 100),
    ],
    outputs: [
      { name: 'kcal', label: 'Total calories', format: 'text' },
      { name: 'kg', label: 'Staple to store', format: 'text', highlight: true },
      { name: 'water', label: 'Water at 1 gallon per person per day', format: 'text' },
    ],
    calculate: (i) => {
      const total = toD(i.people).mul(toD(i.days)).mul(toD(i.kcal));
      const density = new D({ rice: '3.65', pasta: '3.7', beans: '3.4', flour: '3.64', oats: '3.89' }[String(i.staple)] ?? '3.65');
      const kg = total.mul(toD(i.share).div(100)).div(density).div(1000);
      const gallons = toD(i.people).mul(toD(i.days));
      return {
        kcal: `${fmtNumber(total, 0)} kcal`,
        kg: `${fmtNumber(kg, 1)} kg (${fmtNumber(kg.div(KG_PER_LB), 1)} lb)`,
        water: `${fmtNumber(gallons.mul(LITRES_PER_GALLON), 0)} L (${fmtNumber(gallons, 0)} gal)`,
      };
    },
    formulaDescription:
      'Total energy = people × days × kcal per person. Staple (kg) = total × share ÷ kcal per gram ÷ 1,000. Water = people × days gallons, at 3.785 litres each.',
    workedExample:
      'A household of 4 covering 14 days at 2,000 kcal needs 112,000 kcal. If 60 % comes from rice at 3.65 kcal per gram, that is 18.4 kg of rice, with 56 gallons or 212 litres of water.',
    faq: [
      {
        question: 'Why a gallon of water per person?',
        answer: 'Emergency agencies suggest about half a gallon for drinking and half for cooking and hygiene. More is needed in hot weather and for the sick.',
      },
      {
        question: 'How long does dry rice keep?',
        answer: 'White rice keeps for years if sealed and dry. Brown rice has oils that go rancid within about six months.',
      },
      {
        question: 'Is it enough to be nutritious?',
        answer: 'No. This sizes calories only. Add protein, fats, vitamins and any special diets, and include foods that you will actually eat.',
      },
    ],
    scenarios: [
      withInputs('A family of four for two weeks, rice', {}),
      withInputs('A couple for 30 days, pasta', { people: 2, days: 30, staple: 'pasta' }),
      withInputs('A single person for a week, oats', { people: 1, days: 7, staple: 'oats', share: 50 }),
      withInputs('Six people for 3 days, flour', { people: 6, days: 3, staple: 'flour', share: 40 }),
      withInputs('Three people for 10 days, beans', { people: 3, days: 10, staple: 'beans', share: 50 }),
    ],
    introOutputs: ['kg', 'water'],
    relatedSlugs: ['rice-to-water-ratio-calculator', 'uncooked-to-cooked-rice-calculator'],
    checks: [
      { inputs: {}, expect: { kcal: '112,000 kcal', kg: '18.4 kg (40.6 lb)', water: '212 L (56 gal)' } },
      { inputs: { people: 2, days: 30, staple: 'pasta' }, expect: { kcal: '120,000 kcal', kg: '19.5 kg (42.9 lb)' } },
      { inputs: { people: 1, days: 7, staple: 'oats', share: 50 }, expect: { kg: '1.8 kg (4 lb)' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
