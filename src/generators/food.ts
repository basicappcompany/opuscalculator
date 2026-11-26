import { selectField } from '../lib/calc-utils';
import { D, toD } from '../lib/decimal';
import { fmtFixed, fmtNumber, fmtPercent } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { field, intField, rows } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 3 (food): conversions, brewing, baking, party planning and holiday cooking. Amounts are rules of
 * thumb written in the page text; food-safety numbers (turkey, thawing) follow USDA guidance and always say to use a
 * thermometer. All pages are tier 2 or 3, so none is live until the cohort gate opens.
 */

const PI = new D('3.14159265358979323846264338327950288');
const select = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});

/** Grams in one US cup of common ingredients, typical bakery values; real products vary by up to about 10%. */
const GRAMS_PER_CUP: Record<string, number> = {
  flour: 120,
  sugar: 200,
  brown: 213,
  powdered: 120,
  butter: 227,
  honey: 340,
  water: 237,
  milk: 245,
  oil: 218,
  rice: 185,
  oats: 90,
  cocoa: 85,
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

/** Cups of water per cup of uncooked rice for a typical stovetop pot. */
const RICE_WATER: Record<string, number> = { white: 2, jasmine: 1.5, basmati: 1.5, brown: 2.25, sushi: 1.25 };

/** USDA unstuffed whole turkey at 325 °F: [from lb, to lb, minimum minutes, maximum minutes]. */
const TURKEY_BANDS: [number, number, number, number][] = [
  [8, 12, 165, 180],
  [12, 14, 180, 225],
  [14, 18, 225, 255],
  [18, 20, 255, 270],
  [20, 24, 270, 300],
];
const hm = (minutes: number): string => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

const panArea = (shape: string, a: unknown, b: unknown) =>
  shape === 'round' ? PI.mul(toD(a).div(2).pow(2)) : shape === 'square' ? toD(a).pow(2) : toD(a).mul(toD(b));
const PAN_SHAPES: [string, string][] = [
  ['round', 'Round (diameter)'],
  ['square', 'Square (side)'],
  ['rect', 'Rectangle (length × width)'],
];

export const SPECS: Spec[] = [
  {
    slug: 'grams-to-cups-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Cooking converters',
    title: 'Grams to Cups Calculator for Common Baking Ingredients',
    h1: 'Grams to Cups Calculator',
    metaDescription: 'Convert grams of flour, sugar, butter, honey and other baking ingredients to US cups, tablespoons and teaspoons.',
    about:
      "A cup measures volume while a scale measures mass, so the same number of grams fills a different number of cups for every ingredient. A cup of flour weighs about 120 grams but a cup of honey about 340. Pick the ingredient, type the grams and the calculator divides by that ingredient's typical weight per US cup, then restates the amount in tablespoons and teaspoons. Scooping, packing and humidity change real weights by up to ten percent, so weigh whenever a recipe is picky.",
    inputs: [field('grams', 'Mass (g)', 240, 0, 100000), select('ingredient', 'Ingredient', 'flour', INGREDIENTS)],
    outputs: [
      { name: 'cups', label: 'US cups', format: 'text', highlight: true },
      { name: 'tbsp', label: 'Tablespoons', format: 'text' },
      { name: 'tsp', label: 'Teaspoons', format: 'text' },
    ],
    calculate: (i) => {
      const cups = toD(i.grams).div(GRAMS_PER_CUP[String(i.ingredient)] ?? 120);
      return { cups: `${fmtNumber(cups, 2)} cups`, tbsp: `${fmtNumber(cups.mul(16), 1)} tbsp`, tsp: `${fmtNumber(cups.mul(48), 1)} tsp` };
    },
    formulaDescription:
      'Cups = grams ÷ grams per cup of that ingredient. A US cup is 16 tablespoons or 48 teaspoons. Weights per cup: flour 120, sugar 200, brown sugar 213, powdered sugar 120, butter 227, honey 340, water 237, milk 245, oil 218, rice 185, oats 90, cocoa 85.',
    workedExample: '240 g of all-purpose flour is 240 ÷ 120 = 2 cups, which is 32 tablespoons or 96 teaspoons. 240 g of honey is only 0.71 cups.',
    faq: [
      {
        question: 'Why does flour weigh less per cup than sugar?',
        answer: 'Flour is fluffy and traps air, so a cup holds less mass. Granulated sugar packs more tightly.',
      },
      {
        question: 'How exact are these weights?',
        answer: 'They are typical values from baking references. Spooning flour into a cup instead of scooping can change a cup by 20 g or more.',
      },
      { question: 'Should I just weigh the ingredients?', answer: 'Yes where you can. A scale removes the scooping variable and makes a recipe repeatable.' },
    ],
    scenarios: [
      ['flour', 150],
      ['sugar', 100],
      ['butter', 113.5],
      ['honey', 85],
      ['oats', 45],
      ['cocoa', 42.5],
      ['milk', 300],
    ].map(([ingredient, grams]) => ({ label: `${grams} g of ${ingredient}`, inputs: { grams, ingredient } })),
    introOutputs: ['cups'],
    relatedSlugs: ['fresh-to-dried-herb-calculator', 'butter-oil-conversion-calculator', 'self-rising-flour-calculator'],
    checks: [
      { inputs: {}, expect: { cups: '2 cups', tbsp: '32 tbsp', tsp: '96 tsp' } },
      { inputs: { grams: 100, ingredient: 'sugar' }, expect: { cups: '0.5 cups' } },
      { inputs: { grams: 113.5, ingredient: 'butter' }, expect: { cups: '0.5 cups', tbsp: '8 tbsp' } },
    ],
  },
  {
    slug: 'coffee-to-water-ratio-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Tea and coffee',
    title: 'Coffee to Water Ratio Calculator: Grams of Coffee for Your Brew',
    h1: 'Coffee to Water Ratio Calculator',
    metaDescription: 'Find how many grams of ground coffee to use for a given volume of water at a chosen brew ratio, with a strength label.',
    about:
      'Brewing by ratio beats scooping because it scales to any cup or pot. A ratio of 1:16 means one gram of coffee for every sixteen grams, which is about sixteen millilitres, of water. Many specialty roasters recommend somewhere between 1:15 and 1:18, with stronger brews toward the low number. Enter how much water you will use and the ratio you prefer, and the calculator returns the coffee to weigh out, the water in cups and a plain-language strength label.',
    inputs: [field('water', 'Water (mL)', 500, 1, 100000), field('ratio', 'Ratio (water per 1 part coffee)', 16, 5, 30)],
    outputs: [
      { name: 'coffee', label: 'Ground coffee', format: 'text', highlight: true },
      { name: 'cups', label: 'Water in US cups', format: 'text' },
      { name: 'strength', label: 'Brew strength', format: 'text' },
    ],
    calculate: (i) => {
      const ratio = toD(i.ratio);
      return {
        coffee: `${fmtNumber(toD(i.water).div(ratio), 2)} g`,
        cups: `${fmtNumber(toD(i.water).div('236.588'), 2)} cups`,
        strength: ratio.lt(15) ? 'Strong' : ratio.lte(18) ? 'Balanced' : 'Light',
      };
    },
    formulaDescription:
      'Coffee (g) = water (mL) ÷ ratio, taking 1 mL of water as 1 g. A US cup is 236.588 mL. Below 1:15 reads as strong, 1:15 to 1:18 as balanced and above 1:18 as light.',
    workedExample: '500 mL of water at 1:16: 500 ÷ 16 = 31.25 g of coffee. The water is 2.11 US cups and the strength is balanced.',
    faq: [
      {
        question: 'Why use grams instead of scoops?',
        answer: 'A scoop of dark roast weighs less than the same scoop of light roast, so volume gives inconsistent strength.',
      },
      {
        question: 'Is the ratio the same for every brew method?',
        answer: 'No. Espresso uses far less water, around 1:2, while immersion and drip methods usually sit between 1:15 and 1:17.',
      },
      {
        question: 'What if my coffee tastes weak or bitter?',
        answer: 'Adjust the ratio in small steps first, then the grind size and brew time, which affect extraction as well as strength.',
      },
    ],
    scenarios: rows(
      ['water', 'ratio'],
      [
        [300, 15],
        [1000, 17],
        [250, 16],
        [600, 14],
        [1500, 18],
        [350, 12.5],
      ],
      (v) => `${v[0]} mL of water at 1:${v[1]}`,
    ),
    introOutputs: ['coffee', 'strength'],
    relatedSlugs: ['cold-brew-ratio-calculator', 'grams-to-cups-calculator'],
    checks: [
      { inputs: {}, expect: { coffee: '31.25 g', cups: '2.11 cups', strength: 'Balanced' } },
      { inputs: { water: 300, ratio: 15 }, expect: { coffee: '20 g', strength: 'Balanced' } },
      { inputs: { water: 1000, ratio: 17 }, expect: { coffee: '58.82 g' } },
      { inputs: { ratio: 12 }, expect: { strength: 'Strong' } },
    ],
  },
  {
    slug: 'cold-brew-ratio-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Tea and coffee',
    title: 'Cold Brew Ratio Calculator: Concentrate and Ready-to-Drink Volume',
    h1: 'Cold Brew Ratio Calculator',
    metaDescription: 'Plan a cold brew batch from the grams of coffee and the water ratio, then see how much concentrate you get and how much to dilute it.',
    about:
      'Cold brew is steeped for many hours in cold water, usually as a concentrate that you dilute before drinking. Because steeping is slow, recipes use much more coffee per litre than hot brewing, commonly one part coffee to four to eight parts water by weight. Ground coffee soaks up roughly twice its own weight in water, so the concentrate you strain off is less than the water you added. Enter the coffee, the ratio and how much water to add per part of concentrate. Grind coarse, as for a French press, to avoid a cloudy over-extracted result, steep in a covered jar and strain through a paper filter or fine cloth. The concentrate keeps about a week in the refrigerator.',
    inputs: [
      field('coffee', 'Ground coffee (g)', 100, 1, 100000),
      field('ratio', 'Water per 1 part coffee (by weight)', 5, 1, 20),
      field('dilute', 'Water to add per part of concentrate', 1, 0, 10),
    ],
    outputs: [
      { name: 'water', label: 'Water to steep with', format: 'text', highlight: true },
      { name: 'concentrate', label: 'Concentrate after straining', format: 'text' },
      { name: 'ready', label: 'Ready-to-drink volume', format: 'text' },
    ],
    calculate: (i) => {
      const coffee = toD(i.coffee);
      const water = coffee.mul(toD(i.ratio));
      const concentrate = water.minus(coffee.mul(2));
      if (concentrate.lte(0)) return { water: `${fmtNumber(water, 0)} mL`, concentrate: 'Too little water: the grounds absorb it all', ready: '-' };
      return {
        water: `${fmtNumber(water, 0)} mL`,
        concentrate: `${fmtNumber(concentrate, 0)} mL`,
        ready: `${fmtNumber(concentrate.mul(toD(i.dilute).plus(1)), 0)} mL`,
      };
    },
    formulaDescription:
      'Water = coffee × ratio. Concentrate ≈ water − 2 × coffee, since grounds hold about twice their weight in water. Ready-to-drink = concentrate × (1 + dilution parts). One gram of water is taken as one millilitre.',
    workedExample:
      '100 g of coffee at 1:5 steeps in 500 mL of water. The grounds keep about 200 mL, leaving 300 mL of concentrate, which diluted one to one makes 600 mL to drink.',
    faq: [
      { question: 'How long should I steep it?', answer: 'Twelve to eighteen hours in the fridge or at room temperature is typical. Longer risks bitterness.' },
      {
        question: 'Why is my yield smaller than the water I used?',
        answer: 'The wet grounds retain water. The two-times figure is an average and varies with grind and roast.',
      },
      {
        question: 'How strong should the concentrate be?',
        answer: 'Many recipes aim for a concentrate you dilute one to one, but taste decides. Add water in small steps until it suits you.',
      },
    ],
    scenarios: rows(
      ['coffee', 'ratio', 'dilute'],
      [
        [50, 8, 2],
        [200, 4, 1],
        [150, 6, 1.5],
        [80, 5, 0.5],
        [300, 7, 2],
        [60, 10, 3],
      ],
      (v) => `Steeping ${v[0]} g of grounds in ${v[1]} times their weight of water, then adding ${v[2]} part`,
    ),
    introOutputs: ['concentrate', 'ready'],
    relatedSlugs: ['coffee-to-water-ratio-calculator'],
    checks: [
      { inputs: {}, expect: { water: '500 mL', concentrate: '300 mL', ready: '600 mL' } },
      { inputs: { coffee: 50, ratio: 8, dilute: 2 }, expect: { water: '400 mL', concentrate: '300 mL', ready: '900 mL' } },
      { inputs: { ratio: 2 }, expect: { concentrate: 'Too little water: the grounds absorb it all' } },
    ],
  },
  {
    slug: 'abv-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Drinks',
    title: 'ABV Calculator: Alcohol by Volume from Original and Final Gravity',
    h1: 'ABV Calculator',
    metaDescription: 'Estimate alcohol by volume, alcohol by weight and apparent attenuation from hydrometer readings of original and final gravity.',
    about:
      'Brewers and winemakers estimate alcohol by comparing the density of their liquid before and after fermentation. A hydrometer reads the original gravity, the sugar-rich liquid, and the final gravity once the yeast has finished. The fall in density tracks the sugar turned into alcohol. The widely used shortcut multiplies the difference by 131.25. It is accurate to a few tenths of a percent for ordinary beers and wines, less so for very strong ones. Enter both readings as four-digit gravities such as 1.050.',
    inputs: [field('og', 'Original gravity', 1.05, 0.99, 1.2), field('fg', 'Final gravity', 1.01, 0.98, 1.2)],
    outputs: [
      { name: 'abv', label: 'Alcohol by volume', format: 'text', highlight: true },
      { name: 'abw', label: 'Alcohol by weight', format: 'text' },
      { name: 'attenuation', label: 'Apparent attenuation', format: 'text' },
    ],
    calculate: (i) => {
      const og = toD(i.og);
      const drop = og.minus(toD(i.fg));
      const abv = drop.mul('131.25');
      const attenuation = og.gt(1) ? drop.div(og.minus(1)).mul(100) : new D(0);
      return { abv: `${fmtFixed(abv, 2)}%`, abw: `${fmtFixed(abv.mul('0.79'), 2)}%`, attenuation: fmtPercent(attenuation, 1) };
    },
    formulaDescription: 'ABV ≈ (OG − FG) × 131.25. ABW ≈ ABV × 0.79. Apparent attenuation = (OG − FG) ÷ (OG − 1) × 100.',
    workedExample: 'OG 1.050 and FG 1.010: the drop is 0.040, so ABV = 0.040 × 131.25 = 5.25% and ABW = 4.15%. Attenuation is 0.040 ÷ 0.050 = 80.0%.',
    faq: [
      {
        question: 'Why is it only an estimate?',
        answer:
          'Alcohol is lighter than water and the sugar mix changes, so a straight multiplier cannot be exact. Distillation or lab density meters give true values.',
      },
      {
        question: 'What is a typical final gravity?',
        answer: 'Many beers finish between 1.008 and 1.016. A wine can drop below 1.000 because alcohol is less dense than water.',
      },
      {
        question: 'Does temperature affect the reading?',
        answer: 'Yes. Hydrometers are calibrated at a set temperature, often 20 °C, so correct readings taken warm or cold.',
      },
    ],
    scenarios: rows(
      ['og', 'fg'],
      [
        [1.09, 1.01],
        [1.04, 1.008],
        [1.065, 1.014],
        [1.12, 1.02],
        [1.045, 1.012],
        [1.08, 0.998],
      ],
      (v) => `OG ${v[0]} finishing at ${v[1]}`,
    ),
    introOutputs: ['abv'],
    relatedSlugs: ['alcohol-dilution-calculator', 'wine-so2-calculator'],
    checks: [
      { inputs: {}, expect: { abv: '5.25%', abw: '4.15%', attenuation: '80.0%' } },
      { inputs: { og: 1.09 }, expect: { abv: '10.50%', abw: '8.30%', attenuation: '88.9%' } },
      { inputs: { fg: 1.05 }, expect: { abv: '0.00%', attenuation: '0.0%' } },
    ],
  },
  {
    slug: 'bakers-percentage-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Desserts and baking',
    title: "Baker's Percentage Calculator: Hydration and Ingredient Ratios",
    h1: "Baker's Percentage Calculator",
    metaDescription: 'Express water, salt and yeast as percentages of the flour weight to get dough hydration and total dough weight.',
    about:
      "Bakers describe a dough by comparing every ingredient with the weight of the flour, which is always one hundred percent. A bread with 700 grams of water for 1,000 grams of flour is said to be at 70 percent hydration, and a salt level of 2 percent means 20 grams. This makes recipes easy to scale and compare. Enter the weights you use, in grams, and the calculator returns each ingredient as a baker's percentage along with the total dough weight. Professional bakeries keep formulas this way so a ten kilogram batch and a one kilogram test loaf use identical ratios. Whole grain flours need more water because bran absorbs it, and enrichments such as milk, eggs, sugar and butter are written as percentages too.",
    inputs: [
      field('flour', 'Flour (g)', 500, 1, 1000000),
      field('water', 'Water (g)', 350, 0, 1000000),
      field('salt', 'Salt (g)', 10, 0, 100000),
      field('yeast', 'Yeast (g)', 3, 0, 100000),
    ],
    outputs: [
      { name: 'hydration', label: 'Hydration', format: 'text', highlight: true },
      { name: 'salt', label: 'Salt', format: 'text' },
      { name: 'yeast', label: 'Yeast', format: 'text' },
      { name: 'total', label: 'Total dough weight', format: 'text' },
    ],
    calculate: (i) => {
      const flour = toD(i.flour);
      const pct = (v: unknown) => fmtPercent(toD(v).div(flour).mul(100), 1);
      return {
        hydration: pct(i.water),
        salt: pct(i.salt),
        yeast: pct(i.yeast),
        total: `${fmtNumber(flour.plus(toD(i.water)).plus(toD(i.salt)).plus(toD(i.yeast)), 0)} g`,
      };
    },
    formulaDescription: "Baker's percentage of an ingredient = ingredient weight ÷ flour weight × 100. Total dough weight is the sum of all ingredients.",
    workedExample: '500 g flour, 350 g water, 10 g salt and 3 g yeast: hydration 70.0%, salt 2.0%, yeast 0.6%, and 863 g of dough in total.',
    faq: [
      {
        question: 'Why do the percentages add to more than 100?',
        answer: 'Each is measured against the flour alone, not the whole dough, so the total is always above 100%.',
      },
      {
        question: 'What hydration is typical?',
        answer: 'Sandwich loaves sit near 60 to 65 percent, many artisan breads between 70 and 80, and ciabatta higher still.',
      },
      { question: 'What if I use several flours?', answer: 'Add them together and use the total as the flour weight.' },
    ],
    scenarios: rows(
      ['flour', 'water', 'salt', 'yeast'],
      [
        [1000, 650, 20, 4],
        [600, 480, 12, 2],
        [800, 560, 16, 5],
        [450, 270, 9, 4.5],
        [1000, 800, 22, 3],
        [350, 245, 7, 1.5],
      ],
      (v) => `${v[0]} g flour with ${v[1]} g water`,
    ),
    introOutputs: ['hydration', 'total'],
    relatedSlugs: ['sourdough-calculator', 'self-rising-flour-calculator'],
    checks: [
      { inputs: {}, expect: { hydration: '70.0%', salt: '2.0%', yeast: '0.6%', total: '863 g' } },
      { inputs: { water: 400 }, expect: { hydration: '80.0%' } },
      { inputs: { flour: 1000, water: 650, salt: 20, yeast: 4 }, expect: { hydration: '65.0%', salt: '2.0%', yeast: '0.4%' } },
    ],
  },
  {
    slug: 'sourdough-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Desserts and baking',
    title: 'Sourdough Calculator: Flour, Water and Starter for a Target Hydration',
    h1: 'Sourdough Calculator',
    metaDescription:
      'Work out the flour and water to add, plus salt, for a sourdough loaf from total flour, hydration, starter percentage and salt percentage.',
    about:
      'A sourdough starter is itself flour and water, so it adds both to the dough and has to be counted. This calculator assumes a starter fed at equal weights of flour and water, which is 100 percent hydration, so half of its weight is flour and half is water. Give the total flour in the finished dough, the hydration you want, the starter as a share of that flour and the salt percentage. It then tells you how much fresh flour and water to add. Feed the starter four to twelve hours before mixing, when it has doubled and is bubbly; a ripe starter floats in water. Bulk fermentation then takes four to eight hours in a room-temperature kitchen and less in a warm one.',
    inputs: [
      field('flour', 'Total flour in the dough (g)', 500, 1, 1000000),
      field('hydration', 'Hydration (%)', 70, 40, 120),
      field('starter', 'Starter (% of flour)', 20, 0, 100),
      field('salt', 'Salt (% of flour)', 2, 0, 5),
    ],
    outputs: [
      { name: 'flourAdd', label: 'Fresh flour to add', format: 'text', highlight: true },
      { name: 'waterAdd', label: 'Water to add', format: 'text' },
      { name: 'starter', label: 'Starter', format: 'text' },
      { name: 'salt', label: 'Salt', format: 'text' },
      { name: 'total', label: 'Total dough weight', format: 'text' },
    ],
    calculate: (i) => {
      const flour = toD(i.flour);
      const starter = flour.mul(toD(i.starter)).div(100);
      const water = flour.mul(toD(i.hydration)).div(100);
      const salt = flour.mul(toD(i.salt)).div(100);
      const half = starter.div(2);
      return {
        flourAdd: `${fmtNumber(flour.minus(half), 1)} g`,
        waterAdd: `${fmtNumber(water.minus(half), 1)} g`,
        starter: `${fmtNumber(starter, 1)} g`,
        salt: `${fmtNumber(salt, 1)} g`,
        total: `${fmtNumber(flour.plus(water).plus(salt), 1)} g`,
      };
    },
    formulaDescription:
      'Starter = flour × starter %. A 100% hydration starter is half flour and half water. Flour to add = total flour − starter ÷ 2. Water to add = flour × hydration − starter ÷ 2. Salt = flour × salt %.',
    workedExample:
      '500 g flour at 70% hydration with 20% starter and 2% salt: starter 100 g (50 flour, 50 water), flour to add 450 g, water to add 350 − 50 = 300 g, salt 10 g, 860 g of dough.',
    faq: [
      {
        question: 'What if my starter is not 100% hydration?',
        answer:
          'The split between flour and water changes slightly. A stiffer starter holds more flour, so you would add a little less flour and a little more water.',
      },
      {
        question: 'How much starter should I use?',
        answer: 'Ten to twenty percent of the flour is a usual range. More starter ferments faster and gives a milder, less sour dough.',
      },
      {
        question: "Why include the starter's flour?",
        answer: 'Because it counts toward the total, so hydration and salt percentages stay true to the recipe.',
      },
    ],
    scenarios: rows(
      ['flour', 'hydration', 'starter', 'salt'],
      [
        [1000, 75, 10, 2],
        [750, 68, 15, 2.2],
        [400, 80, 25, 1.8],
        [900, 72, 12, 2],
        [500, 65, 30, 2],
        [650, 85, 18, 2.4],
      ],
      (v) => `${v[0]} g flour, ${v[1]}% hydration, ${v[2]}% starter`,
    ),
    introOutputs: ['flourAdd', 'waterAdd'],
    relatedSlugs: ['bakers-percentage-calculator', 'self-rising-flour-calculator'],
    checks: [
      { inputs: {}, expect: { flourAdd: '450 g', waterAdd: '300 g', starter: '100 g', salt: '10 g', total: '860 g' } },
      { inputs: { flour: 1000, hydration: 75, starter: 10 }, expect: { flourAdd: '950 g', waterAdd: '700 g', salt: '20 g', total: '1,770 g' } },
      { inputs: { starter: 0 }, expect: { flourAdd: '500 g', waterAdd: '350 g' } },
    ],
  },
  {
    slug: 'pizza-size-comparison-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Pizza',
    title: 'Pizza Size Comparison Calculator: Area of Two Pizzas',
    h1: 'Pizza Size Comparison Calculator',
    metaDescription: 'Compare two round pizzas by diameter to see each area in square inches and how much more pizza the larger one gives you.',
    about:
      'Pizza is sold by diameter, but you eat area, and area grows with the square of the diameter. A 16 inch pizza is only a third wider than a 12 inch one but gives nearly 78 percent more pizza. That is why the large is usually the better value even when it costs only a little more. Enter two diameters in inches and the calculator shows both areas and the extra share the bigger one offers. Divide a menu price by the area to compare value yourself.',
    inputs: [field('d1', 'Smaller pizza diameter (in)', 12, 1, 100), field('d2', 'Larger pizza diameter (in)', 16, 1, 100)],
    outputs: [
      { name: 'a1', label: 'Area of the first pizza', format: 'text', highlight: true },
      { name: 'a2', label: 'Area of the second pizza', format: 'text' },
      { name: 'extra', label: 'Extra pizza in the second', format: 'text' },
    ],
    calculate: (i) => {
      const a1 = PI.mul(toD(i.d1).div(2).pow(2));
      const a2 = PI.mul(toD(i.d2).div(2).pow(2));
      return { a1: `${fmtNumber(a1, 2)} sq in`, a2: `${fmtNumber(a2, 2)} sq in`, extra: fmtPercent(a2.div(a1).minus(1).mul(100), 1) };
    },
    formulaDescription: 'Area = π × (diameter ÷ 2)². Extra pizza = (area 2 ÷ area 1 − 1) × 100, which equals ((d2 ÷ d1)² − 1) × 100.',
    workedExample:
      'A 12 inch pizza is π × 36 = 113.1 sq in and a 16 inch pizza is π × 64 = 201.06 sq in. The 16 inch has 201.06 ÷ 113.1 − 1 = 77.8% more pizza.',
    faq: [
      {
        question: 'Why does a slightly larger pizza have so much more area?',
        answer: 'Area depends on the square of the radius, so a few extra inches of diameter add far more area at the edge than at the centre.',
      },
      {
        question: 'How do I compare price?',
        answer: 'Divide each price by its area in square inches. The lower figure is the better value, other things equal.',
      },
      {
        question: 'Does crust thickness matter?',
        answer: 'It changes how filling the pizza is. Area ignores thickness, so a deep-dish pizza has more food than its area suggests.',
      },
    ],
    scenarios: rows(
      ['d1', 'd2'],
      [
        [10, 14],
        [8, 12],
        [12, 18],
        [14, 18],
        [9, 16],
        [10, 10],
      ],
      (v) => `${v[0]} inch against ${v[1]} inch`,
    ),
    introOutputs: ['a1', 'extra'],
    relatedSlugs: ['pizza-party-calculator', 'cake-pan-converter-calculator'],
    checks: [
      { inputs: {}, expect: { a1: '113.1 sq in', a2: '201.06 sq in', extra: '77.8%' } },
      { inputs: { d1: 10, d2: 14 }, expect: { a1: '78.54 sq in', a2: '153.94 sq in', extra: '96.0%' } },
      { inputs: { d1: 12, d2: 12 }, expect: { extra: '0.0%' } },
    ],
  },
  {
    slug: 'pizza-party-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Pizza',
    title: 'Pizza Party Calculator: How Many Pizzas to Order',
    h1: 'Pizza Party Calculator',
    metaDescription: 'Work out how many pizzas to order for a group from the number of guests, slices each person eats and slices per pizza.',
    about:
      'Ordering too little pizza is a disaster and ordering too much wastes money, so the arithmetic is worth doing. Multiply the number of guests by the slices each will eat, divide by the slices in one pizza and round up, since you cannot buy part of a pizza. Adults usually eat two to three slices of a large pizza and teenagers more, while younger children manage one or two. The result also shows the spare slices that will be left over.',
    inputs: [
      intField('guests', 'Number of guests', 12, 1, 5000),
      field('each', 'Slices per person', 3, 0.5, 20),
      intField('perPizza', 'Slices per pizza', 8, 1, 30),
    ],
    outputs: [
      { name: 'pizzas', label: 'Pizzas to order', format: 'text', highlight: true },
      { name: 'needed', label: 'Slices needed', format: 'text' },
      { name: 'spare', label: 'Spare slices', format: 'text' },
    ],
    calculate: (i) => {
      const needed = toD(i.guests).mul(toD(i.each));
      const pizzas = needed.div(toD(i.perPizza)).ceil();
      return {
        pizzas: `${fmtNumber(pizzas, 0)} pizzas`,
        needed: `${fmtNumber(needed, 1)} slices`,
        spare: `${fmtNumber(pizzas.mul(toD(i.perPizza)).minus(needed), 1)} slices`,
      };
    },
    formulaDescription:
      'Slices needed = guests × slices each. Pizzas = slices needed ÷ slices per pizza, rounded up. Spare slices = pizzas × slices per pizza − slices needed.',
    workedExample: '12 guests at 3 slices each need 36 slices. At 8 slices a pizza that is 4.5, so order 5 pizzas, which leaves 4 spare slices.',
    faq: [
      {
        question: 'How many slices should I plan per person?',
        answer: 'Two to three for adults with other food on offer, three to four if pizza is the only meal.',
      },
      {
        question: 'Should I mix toppings?',
        answer: 'Order at least one plain cheese pizza for every four or five pizzas, since it suits the widest range of guests.',
      },
      {
        question: 'What if the pizzas are different sizes?',
        answer: 'Work out the slices of each size and add them, or use the slice count of the most common size.',
      },
    ],
    scenarios: rows(
      ['guests', 'each', 'perPizza'],
      [
        [8, 2, 8],
        [25, 3, 10],
        [40, 2.5, 8],
        [15, 3, 12],
        [60, 2, 8],
        [6, 4, 6],
      ],
      (v) => `${v[0]} guests at ${v[1]} slices, ${v[2]} per pizza`,
    ),
    introOutputs: ['pizzas', 'spare'],
    relatedSlugs: ['pizza-size-comparison-calculator', 'party-drink-calculator'],
    checks: [
      { inputs: {}, expect: { pizzas: '5 pizzas', needed: '36 slices', spare: '4 slices' } },
      { inputs: { guests: 8, each: 2 }, expect: { pizzas: '2 pizzas', spare: '0 slices' } },
      { inputs: { guests: 25, perPizza: 10 }, expect: { pizzas: '8 pizzas', spare: '5 slices' } },
    ],
  },
  {
    slug: 'turkey-size-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Thanksgiving',
    title: 'Turkey Size Calculator: Pounds of Turkey per Guest',
    h1: 'Turkey Size Calculator',
    metaDescription: 'Find the size of turkey to buy from the number of guests and the pounds per person, in pounds and kilograms.',
    about:
      'The usual guide is one pound of whole turkey per guest, which covers the bones and the cooking loss, and one and a half pounds per guest if you want generous leftovers. A whole bird is mostly bone, so the meat yield is only about half its weight. Enter the number of guests and the pounds per person and the calculator returns the size to look for, in pounds and kilograms, and the whole-pound size to buy. Add a second, smaller bird for very large gatherings rather than one that will not fit your oven.',
    inputs: [intField('guests', 'Number of guests', 10, 1, 500), field('each', 'Pounds per person', 1.25, 0.5, 3)],
    outputs: [
      { name: 'lb', label: 'Turkey weight needed', format: 'text', highlight: true },
      { name: 'kg', label: 'In kilograms', format: 'text' },
      { name: 'buy', label: 'Size to buy', format: 'text' },
    ],
    calculate: (i) => {
      const lb = toD(i.guests).mul(toD(i.each));
      return { lb: `${fmtNumber(lb, 2)} lb`, kg: `${fmtNumber(lb.mul('0.45359237'), 2)} kg`, buy: `${fmtNumber(lb.ceil(), 0)} lb` };
    },
    formulaDescription: 'Weight = guests × pounds per person. Kilograms = pounds × 0.45359237. Size to buy = weight rounded up to the next whole pound.',
    workedExample: '10 guests at 1.25 lb each need 12.5 lb, which is 5.67 kg, so buy a 13 lb turkey.',
    faq: [
      { question: 'How much turkey per person is enough?', answer: 'One pound each covers a meal; one and a half pounds leaves leftovers for sandwiches.' },
      {
        question: 'Is a bigger bird better?',
        answer: 'Not above about 20 to 22 pounds. Big birds cook unevenly and may not fit your oven, so two smaller ones work better.',
      },
      { question: 'What about boneless turkey breast?', answer: 'You need far less, around a third to half a pound per person, since there are no bones.' },
    ],
    scenarios: rows(
      ['guests', 'each'],
      [
        [6, 1.5],
        [20, 1],
        [14, 1.25],
        [4, 1.5],
        [30, 1],
        [9, 1.1],
      ],
      (v) => `${v[0]} guests at ${v[1]} lb`,
    ),
    introOutputs: ['lb', 'buy'],
    relatedSlugs: ['turkey-thawing-calculator', 'turkey-cooking-time-calculator'],
    checks: [
      { inputs: {}, expect: { lb: '12.5 lb', kg: '5.67 kg', buy: '13 lb' } },
      { inputs: { guests: 6, each: 1.5 }, expect: { lb: '9 lb', kg: '4.08 kg', buy: '9 lb' } },
      { inputs: { guests: 20, each: 1 }, expect: { lb: '20 lb', kg: '9.07 kg' } },
    ],
  },
  {
    slug: 'turkey-thawing-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Thanksgiving',
    title: 'Turkey Thawing Calculator: Fridge and Cold Water Times',
    h1: 'Turkey Thawing Calculator',
    metaDescription: 'Estimate how long to thaw a frozen turkey in the refrigerator or in cold water from its weight, following USDA guidance.',
    about:
      'A frozen turkey must thaw in the refrigerator, in cold water or in a microwave, never on the counter, because the outside warms into the range where bacteria multiply while the middle is still frozen. The USDA allows about 24 hours in the refrigerator for every four to five pounds, and 30 minutes per pound in cold water that is changed every half hour. This tool uses the cautious four pound figure. Enter the weight and plan the thaw days ahead of the meal, with a day in hand. Keep the turkey in its original wrapper on a tray to catch drips, on the bottom shelf below ready-to-eat food, and for the water method use a leak-proof bag in a sink or bucket. A bird that is still icy inside on the day can finish thawing under cold running water.',
    inputs: [field('weight', 'Frozen turkey weight (lb)', 14, 1, 60)],
    outputs: [
      { name: 'fridge', label: 'Refrigerator thaw', format: 'text', highlight: true },
      { name: 'water', label: 'Cold water thaw', format: 'text' },
    ],
    calculate: (i) => {
      const w = toD(i.weight);
      return { fridge: `${fmtNumber(w.div(4), 1)} days`, water: `${fmtNumber(w.div(2), 1)} hours` };
    },
    formulaDescription:
      'Refrigerator: 24 hours for each 4 lb, so days = weight ÷ 4. Cold water: 30 minutes per pound, so hours = weight ÷ 2, changing the water every 30 minutes. Cook at once after cold-water thawing.',
    workedExample: 'A 14 lb turkey needs up to 14 ÷ 4 = 3.5 days in the refrigerator, or 14 ÷ 2 = 7 hours in cold water.',
    faq: [
      { question: 'Can I thaw it on the counter?', answer: 'No. The USDA advises against it because the surface spends hours in the temperature danger zone.' },
      {
        question: 'How long can a thawed turkey stay in the fridge?',
        answer: 'A turkey thawed in the refrigerator can be kept one to two days before cooking.',
      },
      {
        question: 'Can I cook a turkey from frozen?',
        answer: 'Yes, it is safe, but it takes about 50 percent longer. Use a thermometer and make sure the giblets are removed once loose.',
      },
    ],
    scenarios: [8, 10, 12, 16, 20, 24].map((weight) => ({ label: `A ${weight} lb turkey`, inputs: { weight } })),
    relatedSlugs: ['turkey-cooking-time-calculator', 'turkey-size-calculator'],
    checks: [
      { inputs: {}, expect: { fridge: '3.5 days', water: '7 hours' } },
      { inputs: { weight: 20 }, expect: { fridge: '5 days', water: '10 hours' } },
      { inputs: { weight: 8 }, expect: { fridge: '2 days', water: '4 hours' } },
    ],
  },
  {
    slug: 'turkey-cooking-time-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Thanksgiving',
    title: 'Turkey Cooking Time Calculator: USDA Roasting Chart at 325 °F',
    h1: 'Turkey Cooking Time Calculator',
    metaDescription: 'Look up the roasting time range for an unstuffed whole turkey at 325 °F from its weight, using the USDA chart.',
    about:
      'Roasting time depends on the weight of the bird, and the USDA publishes a chart for an unstuffed whole turkey in a 325 degree Fahrenheit oven. The time is a range, because ovens, pans and birds vary, so start checking at the low end. The only reliable test of doneness is temperature: the thickest part of the thigh, the breast and the wing joint must each reach 165 degrees Fahrenheit. Enter the weight, between 8 and 24 pounds, to see which band applies. Place the thermometer probe in the meatiest part of the thigh without touching bone, tent the breast with foil if it browns too quickly, and let the bird rest for twenty to thirty minutes before carving so the juices settle. Roasting on the lowest rack leaves room for the legs to cook through.',
    inputs: [field('weight', 'Turkey weight (lb)', 14, 1, 60)],
    outputs: [
      { name: 'time', label: 'Roasting time', format: 'text', highlight: true },
      { name: 'target', label: 'Safe internal temperature', format: 'text' },
    ],
    calculate: (i) => {
      const w = toD(i.weight);
      const band = TURKEY_BANDS.find(([, hi]) => w.lte(hi));
      if (w.lt(8) || !band) return { time: 'Outside the USDA chart (8 to 24 lb)', target: '165 °F (74 °C)' };
      return { time: `${hm(band[2])} to ${hm(band[3])}`, target: '165 °F (74 °C)' };
    },
    formulaDescription:
      'USDA unstuffed turkey at 325 °F: 8 to 12 lb takes 2¾ to 3 hours, 12 to 14 lb 3 to 3¾, 14 to 18 lb 3¾ to 4¼, 18 to 20 lb 4¼ to 4½, 20 to 24 lb 4½ to 5. A weight on a boundary uses the lower band.',
    workedExample: 'A 14 lb turkey falls in the 12 to 14 lb band: 3 h 0 min to 3 h 45 min. It is done when the thigh, breast and wing joint all read 165 °F.',
    faq: [
      {
        question: 'Does stuffing change the time?',
        answer: 'Yes, a stuffed bird takes longer, and the stuffing itself must also reach 165 °F. Cooking it separately is simpler and safer.',
      },
      {
        question: 'Should I rely on the pop-up timer?',
        answer: 'Use a food thermometer instead. Pop-up timers can be inaccurate, and only a thermometer confirms 165 °F in all three spots.',
      },
      { question: 'How long should it rest?', answer: 'About 20 to 30 minutes under foil, which also lets the juices settle and makes carving easier.' },
    ],
    scenarios: [8, 10, 12, 13, 16, 19, 22, 24].map((weight) => ({ label: `A ${weight} lb turkey`, inputs: { weight } })),
    introOutputs: ['time'],
    relatedSlugs: ['turkey-thawing-calculator', 'turkey-size-calculator'],
    checks: [
      { inputs: {}, expect: { time: '3 h 0 min to 3 h 45 min', target: '165 °F (74 °C)' } },
      { inputs: { weight: 10 }, expect: { time: '2 h 45 min to 3 h 0 min' } },
      { inputs: { weight: 22 }, expect: { time: '4 h 30 min to 5 h 0 min' } },
      { inputs: { weight: 5 }, expect: { time: 'Outside the USDA chart (8 to 24 lb)' } },
    ],
  },
  {
    slug: 'rice-to-water-ratio-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Cooking converters',
    title: 'Rice to Water Ratio Calculator by Rice Type',
    h1: 'Rice to Water Ratio Calculator',
    metaDescription: 'Find how much water to use for a given amount of rice by variety: white, jasmine, basmati, brown or sushi, plus the cooked yield.',
    about:
      'The right amount of water depends on the rice. Long-grain white rice usually takes about two parts water to one of rice by volume, aromatic jasmine and basmati about one and a half, short-grain sushi rice closer to one and a quarter, and brown rice more than two because its bran slows absorption. These are stovetop figures for a covered pot. Pick the variety, enter the cups of dry rice, and the calculator gives the water and roughly how much cooked rice you will have.',
    inputs: [
      field('rice', 'Dry rice (US cups)', 1.5, 0.125, 100),
      select('type', 'Rice type', 'white', [
        ['white', 'White long-grain (1 : 2)'],
        ['jasmine', 'Jasmine (1 : 1.5)'],
        ['basmati', 'Basmati (1 : 1.5)'],
        ['brown', 'Brown (1 : 2.25)'],
        ['sushi', 'Sushi, short-grain (1 : 1.25)'],
      ]),
    ],
    outputs: [
      { name: 'water', label: 'Water to use', format: 'text', highlight: true },
      { name: 'cooked', label: 'Cooked rice, about', format: 'text' },
    ],
    calculate: (i) => {
      const rice = toD(i.rice);
      return { water: `${fmtNumber(rice.mul(RICE_WATER[String(i.type)] ?? 2), 3)} cups`, cooked: `${fmtNumber(rice.mul(3), 2)} cups` };
    },
    formulaDescription: 'Water = dry rice × ratio, with white 2, jasmine 1.5, basmati 1.5, brown 2.25 and sushi 1.25. Cooked yield ≈ 3 × the dry volume.',
    workedExample: '1.5 cups of white rice takes 1.5 × 2 = 3 cups of water and makes about 4.5 cups cooked. 1 cup of brown rice takes 2.25 cups.',
    faq: [
      {
        question: 'Should I rinse the rice?',
        answer: 'Rinsing removes surface starch, which gives separate grains for basmati and jasmine. Sushi rice is rinsed until the water runs clear.',
      },
      {
        question: 'Why does my pot differ from the ratio?',
        answer: 'Lid fit, heat and pot width change evaporation. Treat the ratio as a start and adjust by a few tablespoons next time.',
      },
      {
        question: 'Does the ratio work in a rice cooker?',
        answer: "Often less water is needed because little steam escapes. Follow the cooker's own marks if it has them.",
      },
    ],
    scenarios: [
      ['white', 2],
      ['jasmine', 1],
      ['basmati', 3],
      ['brown', 1],
      ['sushi', 2],
      ['white', 0.75],
      ['brown', 2.5],
    ].map(([type, rice]) => ({ label: `${rice} cups of ${type} rice`, inputs: { rice, type } })),
    introOutputs: ['water'],
    relatedSlugs: ['grams-to-cups-calculator', 'brine-calculator'],
    checks: [
      { inputs: {}, expect: { water: '3 cups', cooked: '4.5 cups' } },
      { inputs: { rice: 2, type: 'jasmine' }, expect: { water: '3 cups' } },
      { inputs: { rice: 1, type: 'brown' }, expect: { water: '2.25 cups', cooked: '3 cups' } },
    ],
  },
  {
    slug: 'fresh-to-dried-herb-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Cooking converters',
    title: 'Fresh to Dried Herb Converter: The 3 to 1 Rule',
    h1: 'Fresh to Dried Herb Converter',
    metaDescription: 'Convert a fresh herb amount to the dried equivalent using the usual three to one rule, in tablespoons and teaspoons.',
    about:
      'Drying removes the water from herbs and concentrates their flavour, so you need less of a dried herb than a fresh one. A common kitchen rule is three parts fresh to one part dried, which is why a tablespoon of dried basil replaces three tablespoons of fresh. The rule suits leafy herbs like oregano, thyme and rosemary. Delicate herbs such as parsley and cilantro lose their character when dried, so substitute with care and add dried herbs early in cooking.',
    inputs: [field('fresh', 'Fresh herb (tablespoons)', 3, 0, 1000)],
    outputs: [
      { name: 'tbsp', label: 'Dried herb in tablespoons', format: 'text', highlight: true },
      { name: 'tsp', label: 'Dried herb in teaspoons', format: 'text' },
    ],
    calculate: (i) => {
      const dried = toD(i.fresh).div(3);
      return { tbsp: `${fmtNumber(dried, 2)} tbsp`, tsp: `${fmtNumber(dried.mul(3), 2)} tsp` };
    },
    formulaDescription: 'Dried amount = fresh amount ÷ 3. One tablespoon is three teaspoons.',
    workedExample: '3 tablespoons of fresh oregano is 3 ÷ 3 = 1 tablespoon of dried, which is 3 teaspoons. 1 tablespoon of fresh is about 1 teaspoon dried.',
    faq: [
      {
        question: 'Is the rule the same for every herb?',
        answer: 'It is a guide. Strong herbs like rosemary can be closer to four to one; mild ones nearer two to one.',
      },
      { question: 'When should I add dried herbs?', answer: 'Early, so they have time to rehydrate and release flavour. Fresh herbs go in near the end.' },
      { question: 'How do I convert dried back to fresh?', answer: 'Multiply by three, the reverse of this calculator.' },
    ],
    scenarios: [0.5, 1, 2, 4, 6, 8].map((fresh) => ({ label: `${fresh} tbsp of fresh herb`, inputs: { fresh } })),
    relatedSlugs: ['grams-to-cups-calculator', 'self-rising-flour-calculator'],
    checks: [
      { inputs: {}, expect: { tbsp: '1 tbsp', tsp: '3 tsp' } },
      { inputs: { fresh: 6 }, expect: { tbsp: '2 tbsp', tsp: '6 tsp' } },
      { inputs: { fresh: 1 }, expect: { tbsp: '0.33 tbsp', tsp: '1 tsp' } },
    ],
  },
  {
    slug: 'butter-oil-conversion-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Cooking converters',
    title: 'Butter to Oil Conversion Calculator for Baking',
    h1: 'Butter to Oil Conversion Calculator',
    metaDescription: 'Swap butter for oil or oil for butter in a recipe: butter is about 80 percent fat, so use three quarters as much oil by volume.',
    about:
      'Butter is roughly 80 percent fat, with the rest water and milk solids, while oil is pure fat. That is why a recipe that calls for a cup of butter needs only about three quarters of a cup of oil, and why swapping the other way needs a third more butter than oil. The swap works well in cakes, muffins and quick breads, which turn out moister with oil, but not where butter is creamed with sugar for lift or flavour. Choose the direction, then enter the amount in cups.',
    inputs: [
      select('direction', 'Swap', 'toOil', [
        ['toOil', 'Butter to oil'],
        ['toButter', 'Oil to butter'],
      ]),
      field('amount', 'Amount to replace (US cups)', 1, 0.0625, 100),
    ],
    outputs: [
      { name: 'result', label: 'Amount to use', format: 'text', highlight: true },
      { name: 'tbsp', label: 'In tablespoons', format: 'text' },
    ],
    calculate: (i) => {
      const result = String(i.direction) === 'toButter' ? toD(i.amount).mul(4).div(3) : toD(i.amount).mul(3).div(4);
      return { result: `${fmtNumber(result, 3)} ${result.eq(1) ? 'cup' : 'cups'}`, tbsp: `${fmtNumber(result.mul(16), 2)} tbsp` };
    },
    formulaDescription: 'Butter to oil: oil = butter × 3/4. Oil to butter: butter = oil × 4/3. Both come from butter being about 80% fat by weight.',
    workedExample: '1 cup of butter becomes 0.75 cups, or 12 tablespoons, of oil. 0.75 cups of oil becomes 1 cup of butter, or 16 tablespoons.',
    faq: [
      {
        question: 'Will the texture change?',
        answer: 'Oil gives a moister, denser crumb and no browned-butter flavour. Cookies may spread more and be less crisp.',
      },
      {
        question: 'Can I swap in melted butter for oil?',
        answer: "Yes, in the same volume ratio, and it keeps butter's flavour. Cool it slightly before mixing with eggs.",
      },
      { question: 'Does it work for frying?', answer: 'For frying, choose by smoke point instead. Butter burns at a lower temperature than most oils.' },
    ],
    scenarios: [
      ['toOil', 0.5],
      ['toOil', 2],
      ['toOil', 0.25],
      ['toButter', 0.5],
      ['toButter', 1.5],
      ['toButter', 0.75],
    ].map(([direction, amount]) => ({ label: `${amount} cups, ${direction === 'toOil' ? 'butter to oil' : 'oil to butter'}`, inputs: { direction, amount } })),
    introOutputs: ['result'],
    relatedSlugs: ['grams-to-cups-calculator', 'self-rising-flour-calculator'],
    checks: [
      { inputs: {}, expect: { result: '0.75 cups', tbsp: '12 tbsp' } },
      { inputs: { direction: 'toButter', amount: 0.75 }, expect: { result: '1 cup', tbsp: '16 tbsp' } },
      { inputs: { amount: 2 }, expect: { result: '1.5 cups' } },
    ],
  },
  {
    slug: 'self-rising-flour-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Desserts and baking',
    title: 'Self-Rising Flour Calculator: Make It from All-Purpose Flour',
    h1: 'Self-Rising Flour Calculator',
    metaDescription: 'Make self-rising flour from all-purpose flour by adding baking powder and salt, scaled to the number of cups you need.',
    about:
      'Self-rising flour is plain flour that already contains a raising agent and a little salt, and it is easy to mix yourself if the recipe calls for it and the pantry does not have it. The standard recipe adds one and a half teaspoons of baking powder and a quarter teaspoon of salt to each cup of all-purpose flour. Whisk them together well so the powder is spread evenly. Enter the cups of self-rising flour the recipe needs and read off the amounts to add.',
    inputs: [field('cups', 'Self-rising flour needed (US cups)', 2, 0.125, 100)],
    outputs: [
      { name: 'bp', label: 'Baking powder', format: 'text', highlight: true },
      { name: 'salt', label: 'Salt', format: 'text' },
      { name: 'flour', label: 'All-purpose flour', format: 'text' },
    ],
    calculate: (i) => {
      const cups = toD(i.cups);
      return { bp: `${fmtNumber(cups.mul('1.5'), 2)} tsp`, salt: `${fmtNumber(cups.mul('0.25'), 2)} tsp`, flour: `${fmtNumber(cups, 2)} cups` };
    },
    formulaDescription: 'For each cup of self-rising flour: 1 cup all-purpose flour + 1½ tsp baking powder + ¼ tsp salt. Quantities scale in proportion.',
    workedExample: '2 cups of self-rising flour: 2 cups all-purpose flour, 3 teaspoons baking powder and 0.5 teaspoon salt.',
    faq: [
      {
        question: 'Can I use baking soda instead?',
        answer: 'Not as a direct swap. Baking soda is stronger and needs an acid in the recipe, so use baking powder here.',
      },
      { question: 'Does the baking powder lose strength?', answer: 'Yes, after about six months once opened. Test it in hot water: it should fizz at once.' },
      { question: 'Should I sift?', answer: 'Whisking is enough, as long as the powder and salt are evenly spread through the flour.' },
    ],
    scenarios: [0.5, 1, 1.5, 3, 3.5, 4].map((cups) => ({ label: `${cups} cups of self-rising flour`, inputs: { cups } })),
    introOutputs: ['bp'],
    relatedSlugs: ['bakers-percentage-calculator', 'grams-to-cups-calculator'],
    checks: [
      { inputs: {}, expect: { bp: '3 tsp', salt: '0.5 tsp', flour: '2 cups' } },
      { inputs: { cups: 1 }, expect: { bp: '1.5 tsp', salt: '0.25 tsp' } },
      { inputs: { cups: 3.5 }, expect: { bp: '5.25 tsp', salt: '0.88 tsp' } },
    ],
  },
  {
    slug: 'cake-pan-converter-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Desserts and baking',
    title: 'Cake Pan Converter: Scale a Recipe to a Different Pan',
    h1: 'Cake Pan Converter',
    metaDescription: 'Compare the area of two cake pans, round, square or rectangular, and get the factor to scale the batter when you change pans.',
    about:
      'A recipe written for one pan will overflow or bake thin in another unless the batter is scaled to match. The simplest guide is the area of the two pans, assuming the sides are the same height. Pick the shape of each pan, round, square or rectangular, enter its size in inches, and the calculator finds both areas and the factor by which to multiply the recipe. Round pans are measured by diameter, squares by one side and rectangles by length and width.',
    inputs: [
      select('s1', 'Recipe pan shape', 'round', PAN_SHAPES),
      field('a1', 'Recipe pan size A (in)', 9, 1, 60),
      field('b1', 'Recipe pan size B (in, rectangle only)', 9, 1, 60),
      select('s2', 'New pan shape', 'rect', PAN_SHAPES),
      field('a2', 'New pan size A (in)', 9, 1, 60),
      field('b2', 'New pan size B (in, rectangle only)', 13, 1, 60),
    ],
    outputs: [
      { name: 'factor', label: 'Batter factor', format: 'text', highlight: true },
      { name: 'area1', label: 'Recipe pan area', format: 'text' },
      { name: 'area2', label: 'New pan area', format: 'text' },
    ],
    calculate: (i) => {
      const a1 = panArea(String(i.s1), i.a1, i.b1);
      const a2 = panArea(String(i.s2), i.a2, i.b2);
      return { factor: `${fmtNumber(a2.div(a1), 2)}×`, area1: `${fmtNumber(a1, 2)} sq in`, area2: `${fmtNumber(a2, 2)} sq in` };
    },
    formulaDescription:
      'Round area = π × (diameter ÷ 2)². Square area = side². Rectangle area = length × width. Batter factor = new pan area ÷ recipe pan area, for pans of equal depth.',
    workedExample: 'A recipe for a 9 inch round pan (63.62 sq in) moved to a 9 × 13 inch pan (117 sq in) needs 117 ÷ 63.62 = 1.84 times the batter.',
    faq: [
      {
        question: 'What if the new pan is deeper?',
        answer: 'Then volume matters more than area. Fill pans no more than two thirds full and check the cake earlier.',
      },
      {
        question: 'Do baking times change?',
        answer: 'Yes. A larger, shallower cake bakes faster and a deeper one slower, so start testing early and use a skewer.',
      },
      {
        question: 'How do I scale eggs by the factor?',
        answer: 'Multiply and round to the nearest whole egg, or beat one egg and weigh out the fraction you need.',
      },
    ],
    scenarios: [
      ['round', 8, 8, 'round', 10, 10],
      ['round', 9, 9, 'square', 8, 8],
      ['square', 8, 8, 'rect', 9, 13],
      ['rect', 9, 13, 'round', 9, 9],
      ['round', 6, 6, 'round', 9, 9],
      ['square', 9, 9, 'round', 10, 10],
    ].map(([s1, a1, b1, s2, a2, b2]) => ({ label: `${s1} ${a1} to ${s2} ${a2}${s2 === 'rect' ? ` × ${b2}` : ''}`, inputs: { s1, a1, b1, s2, a2, b2 } })),
    introOutputs: ['factor'],
    relatedSlugs: ['pizza-size-comparison-calculator', 'self-rising-flour-calculator'],
    checks: [
      { inputs: {}, expect: { factor: '1.84×', area1: '63.62 sq in', area2: '117 sq in' } },
      { inputs: { s1: 'round', a1: 8, s2: 'round', a2: 10 }, expect: { factor: '1.56×', area1: '50.27 sq in', area2: '78.54 sq in' } },
      { inputs: { s1: 'square', a1: 8, s2: 'square', a2: 8 }, expect: { factor: '1×', area1: '64 sq in' } },
    ],
  },
  {
    slug: 'party-drink-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Party',
    title: 'Party Drink Calculator: How Many Drinks per Guest',
    h1: 'Party Drink Calculator',
    metaDescription: 'Estimate how many drinks to buy for a party from the guest count and the length of the event, and how many wine bottles that equals.',
    about:
      'Party planners use a simple rule of thumb: guests drink about two drinks in the first hour and one drink every hour after that. Multiply by the number of guests and round up when in doubt, since running out is worse than a few leftovers. A standard 750 millilitre bottle of wine pours about five glasses, which helps convert the total into bottles. Adjust upward for hot weather, a younger crowd or a long evening, and always offer water and non-alcoholic choices.',
    inputs: [intField('guests', 'Number of guests', 20, 1, 5000), field('hours', 'Length of the party (hours)', 4, 1, 24)],
    outputs: [
      { name: 'drinks', label: 'Total drinks', format: 'text', highlight: true },
      { name: 'perGuest', label: 'Drinks per guest', format: 'text' },
      { name: 'wine', label: 'If all wine, 750 mL bottles', format: 'text' },
    ],
    calculate: (i) => {
      const perGuest = toD(i.hours).minus(1).plus(2);
      const drinks = perGuest.mul(toD(i.guests));
      return { drinks: fmtNumber(drinks, 0), perGuest: fmtNumber(perGuest, 1), wine: `${fmtNumber(drinks.div(5).ceil(), 0)} bottles` };
    },
    formulaDescription:
      'Drinks per guest = 2 for the first hour + 1 for each further hour. Total = guests × drinks per guest. A 750 mL wine bottle pours about 5 glasses, rounded up to whole bottles.',
    workedExample: '20 guests for 4 hours: each has 2 + 3 = 5 drinks, so 100 in total. If all wine, that is 100 ÷ 5 = 20 bottles.',
    faq: [
      {
        question: 'Is this a recommendation to drink that much?',
        answer:
          'No. It is a buying guide for hosts. Drink responsibly, provide food and water, and never serve guests who are driving more than they should have.',
      },
      { question: 'How should I split the types?', answer: 'A common split is about half beer, a third wine and the rest spirits, adjusted to your guests.' },
      { question: 'What about ice?', answer: 'Plan roughly one to two pounds of ice per guest for chilled drinks, more in hot weather.' },
    ],
    scenarios: rows(
      ['guests', 'hours'],
      [
        [30, 2],
        [50, 5],
        [12, 3],
        [80, 4],
        [25, 1],
        [100, 6],
      ],
      (v) => `${v[0]} guests for ${v[1]} hours`,
    ),
    introOutputs: ['drinks'],
    relatedSlugs: ['pizza-party-calculator', 'alcohol-dilution-calculator'],
    checks: [
      { inputs: {}, expect: { drinks: '100', perGuest: '5', wine: '20 bottles' } },
      { inputs: { guests: 30, hours: 2 }, expect: { drinks: '90', wine: '18 bottles' } },
      { inputs: { hours: 1 }, expect: { drinks: '40', wine: '8 bottles' } },
    ],
  },
  {
    slug: 'brine-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Other',
    title: 'Brine Calculator: Salt Needed for a Percentage Brine',
    h1: 'Brine Calculator',
    metaDescription: 'Work out the grams of salt for a brine of a chosen percentage strength from the litres of water, plus the grams of salt per litre.',
    about:
      'A brine is salt dissolved in water, and its strength is stated as a percentage of the weight of the water. A 5 percent brine holds 50 grams of salt in each litre, since a litre of water weighs a kilogram. Poultry and pork are often brined at 5 to 8 percent for a few hours, while lighter brines of 2 to 3.5 percent suit vegetables and fermenting. Weigh the salt, because a spoonful of fine salt holds much more than a spoonful of flaky kosher salt. Dissolve it in a little hot water first, top up with cold and chill the brine completely before the meat goes in. Sugar, herbs and peppercorns add flavour without changing the salt arithmetic.',
    inputs: [field('water', 'Water (litres)', 4, 0.1, 1000), field('pct', 'Brine strength (% salt by weight)', 5, 0.5, 26)],
    outputs: [
      { name: 'salt', label: 'Salt to weigh', format: 'text', highlight: true },
      { name: 'perL', label: 'Salt per litre', format: 'text' },
    ],
    calculate: (i) => {
      const perL = toD(i.pct).mul(10);
      return { salt: `${fmtNumber(perL.mul(toD(i.water)), 1)} g`, perL: `${fmtNumber(perL, 1)} g/L` };
    },
    formulaDescription: 'Salt (g) = water (kg) × strength % × 10, taking 1 litre of water as 1 kg. Salt per litre = strength % × 10 g.',
    workedExample: '4 L of water at 5% needs 4 × 5 × 10 = 200 g of salt, which is 50 g per litre.',
    faq: [
      {
        question: 'Why weigh salt instead of using spoons?',
        answer:
          'Different salts have different crystal sizes, so a tablespoon of table salt can hold nearly twice the weight of a tablespoon of flaky kosher salt.',
      },
      {
        question: 'How long should I brine?',
        answer: 'It depends on thickness. Whole birds take 8 to 24 hours; chops and fish only 30 minutes to a few hours. Keep everything cold.',
      },
      { question: 'Can I reuse a brine?', answer: 'No. Once raw meat has been in it, discard it for food safety.' },
    ],
    scenarios: rows(
      ['water', 'pct'],
      [
        [2, 8],
        [1, 3.5],
        [5, 6],
        [3, 2.5],
        [10, 4],
        [1.5, 10],
      ],
      (v) => `${v[0]} L at ${v[1]}%`,
    ),
    introOutputs: ['salt'],
    relatedSlugs: ['rice-to-water-ratio-calculator', 'turkey-size-calculator'],
    checks: [
      { inputs: {}, expect: { salt: '200 g', perL: '50 g/L' } },
      { inputs: { water: 2, pct: 8 }, expect: { salt: '160 g', perL: '80 g/L' } },
      { inputs: { water: 1, pct: 3.5 }, expect: { salt: '35 g', perL: '35 g/L' } },
    ],
  },
  {
    slug: 'alcohol-dilution-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Drinks',
    title: 'Alcohol Dilution Calculator: Water to Reach a Lower ABV',
    h1: 'Alcohol Dilution Calculator',
    metaDescription: 'Find how much water to add to a spirit to bring it down to a target alcohol percentage, and the final volume.',
    about:
      'Home distillers, bottlers of liqueur and people infusing spirits often need to bring a high-strength spirit down to a lower percentage. Since the amount of pure alcohol stays the same while the volume grows, the final volume equals the starting volume times the starting strength divided by the target strength. The difference is the water to add. Alcohol and water contract slightly when mixed, so the real volume is a little under the sum, and the strength is a hair higher than calculated.',
    inputs: [
      field('volume', 'Starting volume (mL)', 500, 1, 1000000),
      field('abv1', 'Starting strength (% ABV)', 40, 1, 100),
      field('abv2', 'Target strength (% ABV)', 25, 0.5, 100),
    ],
    outputs: [
      { name: 'final', label: 'Final volume', format: 'text', highlight: true },
      { name: 'water', label: 'Water to add', format: 'text' },
    ],
    calculate: (i) => {
      const abv1 = toD(i.abv1);
      const abv2 = toD(i.abv2);
      if (abv2.gt(abv1)) return { final: 'The target cannot be stronger than the start', water: '-' };
      const final = toD(i.volume).mul(abv1).div(abv2);
      return { final: `${fmtNumber(final, 2)} mL`, water: `${fmtNumber(final.minus(toD(i.volume)), 2)} mL` };
    },
    formulaDescription:
      'Final volume = starting volume × starting ABV ÷ target ABV. Water to add = final volume − starting volume. Volume contraction on mixing is ignored.',
    workedExample: '500 mL at 40% diluted to 25%: 500 × 40 ÷ 25 = 800 mL, so add 300 mL of water.',
    faq: [
      {
        question: 'Why is the result a little off?',
        answer:
          'Alcohol and water occupy slightly less than their combined volume, about three percent at the strongest mix, so the true strength comes out a little higher.',
      },
      {
        question: 'Is this legal to do at home?',
        answer: 'Diluting a purchased spirit is fine. Distilling alcohol at home is illegal in many places, so check your local law.',
      },
      { question: 'Can I use it for proof?', answer: 'Yes. In the United States, proof is twice the ABV, so use ABV values of 40 for 80 proof.' },
    ],
    scenarios: rows(
      ['volume', 'abv1', 'abv2'],
      [
        [750, 57, 40],
        [1000, 95, 40],
        [250, 60, 35],
        [500, 50, 20],
        [700, 70, 40],
        [100, 40, 4],
      ],
      (v) => `${v[0]} mL from ${v[1]}% to ${v[2]}%`,
    ),
    introOutputs: ['final'],
    relatedSlugs: ['abv-calculator', 'party-drink-calculator', 'wine-so2-calculator'],
    checks: [
      { inputs: {}, expect: { final: '800 mL', water: '300 mL' } },
      { inputs: { volume: 750, abv1: 57, abv2: 40 }, expect: { final: '1,068.75 mL', water: '318.75 mL' } },
      { inputs: { abv2: 60 }, expect: { final: 'The target cannot be stronger than the start' } },
    ],
  },
  {
    slug: 'wine-so2-calculator',
    category: 'food',
    tier: 3,
    subCluster: 'Drinks',
    title: 'Wine SO2 Calculator: Potassium Metabisulfite to Add',
    h1: 'Wine SO2 Calculator',
    metaDescription: 'Calculate the grams of potassium metabisulfite to add to a batch of wine to raise free sulfur dioxide to a target in mg/L.',
    about:
      'Winemakers add sulfur dioxide to protect wine from oxidation and spoilage microbes. The usual source is potassium metabisulfite, which releases about 57.6 percent of its weight as sulfur dioxide. To raise the free level, work out the milligrams of sulfur dioxide needed per litre of wine, multiply by the volume, and divide by the yield. Enter the volume, the current free level from a test, and your target. Levels are regulated and affect people with sulfite sensitivity, so stay within the limits that apply to you.',
    inputs: [
      field('volume', 'Wine volume (L)', 20, 1, 100000),
      field('current', 'Current free SO2 (mg/L)', 0, 0, 500),
      field('target', 'Target free SO2 (mg/L)', 50, 0, 500),
    ],
    outputs: [
      { name: 'kmeta', label: 'Potassium metabisulfite to add', format: 'text', highlight: true },
      { name: 'so2', label: 'SO2 to be added', format: 'text' },
    ],
    calculate: (i) => {
      const gap = toD(i.target).minus(toD(i.current));
      if (gap.lt(0)) return { kmeta: 'Already above the target', so2: '-' };
      const mg = gap.mul(toD(i.volume));
      return { kmeta: `${fmtNumber(mg.div('576'), 2)} g`, so2: `${fmtNumber(mg, 0)} mg` };
    },
    formulaDescription:
      'SO2 needed (mg) = (target − current) × volume in litres. Potassium metabisulfite (g) = SO2 mg ÷ 1,000 ÷ 0.576, since the salt is 57.6% SO2 by weight.',
    workedExample: '20 L of wine from 0 to 50 mg/L needs 1,000 mg of SO2, which is 1,000 ÷ 576 = 1.74 g of potassium metabisulfite.',
    faq: [
      {
        question: 'Why is the free level different from the total?',
        answer: 'Some SO2 binds to compounds in the wine. Only the free portion protects, and it falls over time, so it is tested and topped up.',
      },
      {
        question: 'What target should I choose?',
        answer: 'It depends on pH: higher pH needs more free SO2 for the same protection. Winemaking references give a table by pH.',
      },
      {
        question: 'Does the result include the sulfite already present?',
        answer: 'Only through the current level you enter. Test the free SO2 first rather than guessing.',
      },
    ],
    scenarios: rows(
      ['volume', 'current', 'target'],
      [
        [23, 20, 40],
        [200, 10, 35],
        [10, 0, 30],
        [50, 15, 45],
        [5, 5, 30],
        [100, 0, 25],
      ],
      (v) => `${v[0]} L from ${v[1]} to ${v[2]} mg/L`,
    ),
    introOutputs: ['kmeta'],
    relatedSlugs: ['abv-calculator', 'alcohol-dilution-calculator'],
    checks: [
      { inputs: {}, expect: { kmeta: '1.74 g', so2: '1,000 mg' } },
      { inputs: { volume: 23, current: 20, target: 40 }, expect: { kmeta: '0.8 g', so2: '460 mg' } },
      { inputs: { current: 60 }, expect: { kmeta: 'Already above the target' } },
    ],
  },
  {
    slug: 'air-fryer-conversion-calculator',
    category: 'food',
    tier: 2,
    subCluster: 'Cooking converters',
    title: 'Air Fryer Conversion Calculator: Oven Temperature and Time',
    h1: 'Air Fryer Conversion Calculator',
    metaDescription: 'Convert an oven recipe to an air fryer by lowering the temperature 25 °F and shortening the time by 20 percent.',
    about:
      'An air fryer is a small convection oven with a powerful fan, so food cooks faster than in a conventional oven. The common rule is to lower the temperature by about 25 degrees Fahrenheit and cut the time by about a fifth. It is a starting point, not a law: models differ, a crowded basket cooks slower and thin foods brown quickly. Enter the oven temperature in Fahrenheit and the time in minutes, check food early, and use a thermometer for meat and poultry.',
    inputs: [field('temp', 'Oven temperature (°F)', 400, 200, 550), field('time', 'Oven time (minutes)', 30, 1, 600)],
    outputs: [
      { name: 'airTemp', label: 'Air fryer temperature', format: 'text', highlight: true },
      { name: 'airTime', label: 'Air fryer time', format: 'text' },
      { name: 'celsius', label: 'In Celsius', format: 'text' },
    ],
    calculate: (i) => {
      const t = toD(i.temp).minus(25);
      return {
        airTemp: `${fmtNumber(t, 0)} °F`,
        airTime: `${fmtNumber(toD(i.time).mul('0.8'), 1)} min`,
        celsius: `${fmtNumber(t.minus(32).mul(5).div(9), 0)} °C`,
      };
    },
    formulaDescription: 'Air fryer temperature = oven temperature − 25 °F. Time = oven time × 0.8. Celsius = (°F − 32) × 5 ÷ 9.',
    workedExample: 'A 400 °F, 30 minute oven recipe becomes 375 °F for 24 minutes in an air fryer, which is 191 °C.',
    faq: [
      {
        question: 'Does the rule work for every food?',
        answer: 'It suits roasted vegetables, wings and frozen snacks. Baked goods with batters and very large cuts need extra care and earlier checks.',
      },
      {
        question: 'Why is my food drier than in the oven?',
        answer: 'The fan removes surface moisture quickly. Lightly oil the food and shorten the time a little more.',
      },
      { question: 'How full should the basket be?', answer: 'One layer with gaps for the air to flow. Overcrowding lengthens the time and cooks unevenly.' },
    ],
    scenarios: rows(
      ['temp', 'time'],
      [
        [350, 20],
        [425, 45],
        [375, 12],
        [450, 25],
        [400, 60],
        [325, 90],
      ],
      (v) => `${v[0]} °F for ${v[1]} minutes in the oven`,
    ),
    introOutputs: ['airTemp', 'airTime'],
    relatedSlugs: ['turkey-cooking-time-calculator', 'butter-oil-conversion-calculator'],
    checks: [
      { inputs: {}, expect: { airTemp: '375 °F', airTime: '24 min', celsius: '191 °C' } },
      { inputs: { temp: 350, time: 20 }, expect: { airTemp: '325 °F', airTime: '16 min', celsius: '163 °C' } },
      { inputs: { temp: 425, time: 45 }, expect: { airTemp: '400 °F', airTime: '36 min', celsius: '204 °C' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
