import { selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { field, rows } from '../lib/spec-helpers';
import type { CalculatorConfig, Scenario } from '../lib/types';

/**
 * Catalog batch 6 (biology): gardening, crops, lawns and trees. Seeding rates, coverage per bale, growth factors and
 * soil weights are typical figures and are labelled as such in the page copy. No money outputs. Tier 2 or 3, so none
 * is live until the cohort gate opens.
 */

const PI = new D('3.14159265358979323846264338327950288');
const SQRT3_OVER_2 = new D(3).sqrt().div(2);
const SQ_FT_PER_ACRE = new D(43560);
const HECTARES_PER_ACRE = new D('0.40468564224');
const KG_PER_LB = new D('0.45359237');
const M_PER_FT = new D('0.3048');
const CM_PER_IN = new D('2.54');
const LITRES_PER_CU_FT = new D('28.316846592');
const LITRES_PER_CU_IN = new D('0.016387064');
const CU_M_PER_CU_YD = new D('0.764554857984');
const CU_FT_PER_CU_YD = new D(27);
const GALLON_LITRES = new D('3.785411784');
const GRAMS_PER_OZ = new D('28.349523125');

const select = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});

const withInputs = (label: string, inputs: Scenario['inputs']): Scenario => ({ label, inputs });

const clip = (x: Dec, lo: Dec, hi: Dec) => (x.lt(lo) ? lo : x.gt(hi) ? hi : x);

/** Saturation vapour pressure in kPa at a temperature in Celsius (Tetens). */
const svp = (t: Dec) => new D('0.6108').mul(new D('17.27').mul(t).div(t.add('237.3')).exp());

/** Basal area of one stem, in square feet, from its diameter in inches: pi / 576 x d^2. */
const stemBasalArea = (dbh: Dec) => PI.div(576).mul(dbh.pow(2));

export const SPECS: Spec[] = [
  {
    slug: 'vpd-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Gardening and crops',
    title: 'VPD Calculator: Vapor Pressure Deficit for Plants',
    h1: 'VPD Calculator',
    metaDescription: 'Work out vapor pressure deficit in kPa from air temperature, relative humidity and leaf temperature, with the growth stage it suits.',
    about:
      'Vapor pressure deficit, usually shortened to VPD, measures how thirsty the air is. It is the gap between the water vapor the air could hold at its temperature and the vapor it actually holds. Growers in greenhouses, grow tents and indoor farms watch it more closely than relative humidity, because the same humidity feels very different at 18 and at 30 degrees. A low VPD means saturated air: leaves transpire slowly, calcium moves poorly and mould thrives. A high VPD pulls water out of the plant faster than roots can supply it, so stomata shut and growth stalls. Enter the air temperature, the relative humidity and how much cooler the leaf surface is than the air, which is about 2 degrees under bright light, and you will receive the VPD in kilopascals with a growth stage that matches. Seedlings and cuttings prefer gentle air near 0.4 to 0.8 kPa, while leafy growth tolerates 0.8 to 1.2 and flowering crops 1.2 to 1.6.',
    inputs: [
      field('temp', 'Air temperature (°C)', 25, 5, 45),
      field('rh', 'Relative humidity (%)', 60, 10, 100),
      field('offset', 'Leaf temperature minus air (°C)', -2, -6, 4),
    ],
    outputs: [
      { name: 'vpd', label: 'Vapor pressure deficit', format: 'text', highlight: true },
      { name: 'stage', label: 'Suits', format: 'text' },
      { name: 'actual', label: 'Vapor pressure of the air', format: 'text' },
    ],
    calculate: (i) => {
      const t = toD(i.temp);
      const actual = svp(t).mul(toD(i.rh)).div(100);
      const vpd = svp(t.add(toD(i.offset))).sub(actual);
      const stage = vpd.lt('0.4')
        ? 'Too humid: transpiration is weak'
        : vpd.lt('0.8')
          ? 'Seedlings and cuttings (0.4 to 0.8 kPa)'
          : vpd.lt('1.2')
            ? 'Vegetative growth (0.8 to 1.2 kPa)'
            : vpd.lte('1.6')
              ? 'Flowering and fruiting (1.2 to 1.6 kPa)'
              : 'Too dry: stomata will close';
      return { vpd: `${fmtNumber(vpd, 2)} kPa`, stage, actual: `${fmtNumber(actual, 2)} kPa` };
    },
    formulaDescription: 'Saturation pressure SVP(T) = 0.6108 × e^(17.27 T ÷ (T + 237.3)) kPa. VPD = SVP(leaf temperature) − SVP(air temperature) × RH ÷ 100.',
    workedExample:
      'Air at 25 °C and 60 % humidity holds 3.168 × 0.60 = 1.90 kPa. A leaf at 23 °C could hold 2.81 kPa, so VPD = 2.81 − 1.90 = 0.91 kPa, a good value for leafy growth.',
    faq: [
      {
        question: 'What leaf offset should I use?',
        answer: 'About −2 °C under bright light, because transpiration cools the leaf. Use 0 if you only know the air and want a simple air-based figure.',
      },
      {
        question: 'Are the stage bands exact?',
        answer: 'No. They are typical grower guidance for many crops. Check the figure for your own species and cultivar, and watch the plants.',
      },
      {
        question: 'Why use VPD instead of humidity?',
        answer: 'Humidity ignores temperature. VPD combines both, so one number tells you how hard the plant is pulling water.',
      },
    ],
    scenarios: rows(
      ['temp', 'rh', 'offset'],
      [
        [25, 60, -2],
        [25, 60, 0],
        [22, 70, -1],
        [28, 50, 0],
        [24, 80, 0],
        [30, 40, -2],
      ],
      (v) => `Air at ${v[0]} °C and ${v[1]} % humidity, leaf offset ${v[2]} °C`,
    ),
    introOutputs: ['vpd', 'stage'],
    relatedSlugs: ['daily-light-integral-calculator', 'co2-grow-room-calculator'],
    checks: [
      { inputs: {}, expect: { vpd: '0.91 kPa', actual: '1.9 kPa', stage: 'Vegetative growth (0.8 to 1.2 kPa)' } },
      { inputs: { offset: 0 }, expect: { vpd: '1.27 kPa', stage: 'Flowering and fruiting (1.2 to 1.6 kPa)' } },
      { inputs: { temp: 28, rh: 50, offset: 0 }, expect: { vpd: '1.89 kPa', stage: 'Too dry: stomata will close' } },
      { inputs: { rh: 90, offset: 0 }, expect: { vpd: '0.32 kPa', stage: 'Too humid: transpiration is weak' } },
    ],
  },
  {
    slug: 'daily-light-integral-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Gardening and crops',
    title: 'Daily Light Integral Calculator: DLI from PPFD and Hours',
    h1: 'Daily Light Integral Calculator',
    metaDescription: 'Convert light intensity (PPFD) and photoperiod into the daily light integral in mol per square metre per day.',
    about:
      'The daily light integral, or DLI, is the total amount of photosynthetically active light a plant receives on one square metre of canopy over a day. Where PPFD tells you how bright the light is at one moment, in micromoles per square metre per second, DLI adds up the whole day and is counted in moles. It is the number that best predicts growth for greenhouse crops, grow lights and houseplants, because a modest light left on for sixteen hours can deliver the same total as a strong light left on for eight. Multiply the PPFD by the hours of light and by 3,600 seconds, then divide by a million. As a guide, shade plants are content with 2 to 6 mol, lettuce and herbs with 12 to 17, and fruiting crops such as tomatoes and peppers with 20 to 30 or more. Measure PPFD with a quantum sensor at canopy height, and remember that dimmers and distance change the number.',
    inputs: [field('ppfd', 'Light intensity (µmol/m²/s)', 400, 10, 2500), field('hours', 'Hours of light per day', 14, 1, 24)],
    outputs: [
      { name: 'dli', label: 'Daily light integral', format: 'text', highlight: true },
      { name: 'class', label: 'Light level', format: 'text' },
    ],
    calculate: (i) => {
      const dli = toD(i.ppfd).mul(toD(i.hours)).mul(3600).div(1000000);
      const level = dli.lt(6)
        ? 'Very low (shade plants)'
        : dli.lt(12)
          ? 'Low (foliage plants)'
          : dli.lt(20)
            ? 'Medium (lettuce and herbs)'
            : dli.lte(30)
              ? 'High (most fruiting crops)'
              : 'Very high (full-sun crops)';
      return { dli: `${fmtNumber(dli, 2)} mol/m²/day`, class: level };
    },
    formulaDescription: 'DLI (mol/m²/day) = PPFD (µmol/m²/s) × hours of light × 3,600 ÷ 1,000,000.',
    workedExample: 'A light delivering 400 µmol/m²/s for 14 hours gives 400 × 14 × 3,600 ÷ 1,000,000 = 20.16 mol/m²/day, a high level that suits tomatoes.',
    faq: [
      {
        question: 'What PPFD should I enter?',
        answer: 'The average at canopy height, measured with a quantum sensor or app. Light is stronger in the centre than at the edges.',
      },
      {
        question: 'Can I raise DLI by lengthening the day?',
        answer: 'Yes, up to the limit of the crop. Many plants need a dark period, so lengthening past 18 to 20 hours rarely helps.',
      },
      { question: 'Does a window count?', answer: 'Yes, but sunlight varies with season and weather, so use a measured average over several days.' },
    ],
    scenarios: rows(
      ['ppfd', 'hours'],
      [
        [400, 14],
        [200, 16],
        [1000, 12],
        [100, 12],
        [600, 18],
        [150, 10],
      ],
      (v) => `${v[0]} µmol/m²/s for ${v[1]} hours a day`,
    ),
    introOutputs: ['dli', 'class'],
    relatedSlugs: ['vpd-calculator', 'plant-spacing-calculator'],
    checks: [
      { inputs: {}, expect: { dli: '20.16 mol/m²/day', class: 'High (most fruiting crops)' } },
      { inputs: { ppfd: 200, hours: 16 }, expect: { dli: '11.52 mol/m²/day', class: 'Low (foliage plants)' } },
      { inputs: { ppfd: 1000, hours: 12 }, expect: { dli: '43.2 mol/m²/day', class: 'Very high (full-sun crops)' } },
      { inputs: { ppfd: 100, hours: 12 }, expect: { dli: '4.32 mol/m²/day', class: 'Very low (shade plants)' } },
    ],
  },
  {
    slug: 'gdu-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'GDU Calculator: Growing Degree Units for Corn and Crops',
    h1: 'GDU Calculator',
    metaDescription: 'Add up growing degree units from daily highs and lows, with the usual 86 °F cap and 50 °F floor, and see progress towards maturity.',
    about:
      'Growing degree units, or GDU, are a way of counting heat instead of days. Crops develop when it is warm, so two seasons with the same number of days can bring a hybrid to maturity at very different times. Farmers use GDU to pick a corn hybrid for their season, to time sprays and to forecast the date of silking and black layer. The corn method clips the daily high at 86 degrees Fahrenheit, because growth stops being faster beyond that, and raises a low reading to 50, because plants do not grow in the cold. The two clipped temperatures are averaged and 50 is subtracted. Enter a typical day and how many days you want to add up, and you will see the units for one day, the total, and the share of a hybrid that needs, for instance, 2,700 units to reach maturity. Use the same method each season to compare years, and keep a running tally from planting.',
    inputs: [
      field('high', 'Daily high (°F)', 82, 0, 120),
      field('low', 'Daily low (°F)', 60, -20, 100),
      field('days', 'Number of such days', 10, 1, 200),
      field('need', 'Units to maturity (hybrid rating)', 2700, 500, 4000),
    ],
    outputs: [
      { name: 'daily', label: 'Units per day', format: 'text' },
      { name: 'total', label: 'Total over the period', format: 'text', highlight: true },
      { name: 'share', label: 'Share of hybrid requirement', format: 'text' },
    ],
    calculate: (i) => {
      const lo = new D(50);
      const hi = new D(86);
      const daily = clip(toD(i.high), lo, hi)
        .add(clip(toD(i.low), lo, hi))
        .div(2)
        .sub(50);
      const total = daily.mul(toD(i.days));
      return { daily: `${fmtNumber(daily, 1)} GDU`, total: `${fmtNumber(total, 1)} GDU`, share: `${fmtNumber(total.div(toD(i.need)).mul(100), 1)} %` };
    },
    formulaDescription:
      'GDU = (high + low) ÷ 2 − 50, with both temperatures first held between 50 °F and 86 °F. Total = daily GDU × days. Share = total ÷ hybrid rating × 100.',
    workedExample:
      'A day with a high of 82 °F and a low of 60 °F gives (82 + 60) ÷ 2 − 50 = 21 GDU. Ten such days give 210 GDU, which is 7.8 % of a 2,700 GDU hybrid.',
    faq: [
      { question: 'Why cap the high at 86 °F?', answer: 'Corn development does not speed up above about 86 °F, so heat beyond it adds nothing.' },
      { question: 'Can I use Celsius?', answer: 'Convert to Fahrenheit first (multiply by 1.8 and add 32). The 50 and 86 limits are in Fahrenheit.' },
      {
        question: 'Do other crops use the same limits?',
        answer: 'No. Each crop has its own base and cap. These are the standard figures for corn; change the method for cool-season crops.',
      },
    ],
    scenarios: rows(
      ['high', 'low', 'days', 'need'],
      [
        [82, 60, 10, 2700],
        [95, 70, 10, 2700],
        [60, 40, 20, 2500],
        [70, 45, 30, 2600],
        [88, 66, 60, 2800],
        [75, 55, 90, 2700],
      ],
      (v) => `${v[2]} days of ${v[0]} °F highs and ${v[1]} °F lows`,
    ),
    introOutputs: ['daily', 'total'],
    relatedSlugs: ['corn-yield-calculator', 'plant-population-calculator'],
    checks: [
      { inputs: {}, expect: { daily: '21 GDU', total: '210 GDU', share: '7.8 %' } },
      { inputs: { high: 95, low: 70 }, expect: { daily: '28 GDU', total: '280 GDU' } },
      { inputs: { high: 60, low: 40 }, expect: { daily: '5 GDU', total: '50 GDU' } },
      { inputs: { high: 40, low: 30 }, expect: { daily: '0 GDU' } },
    ],
  },
  {
    slug: 'plant-spacing-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Gardening and crops',
    title: 'Plant Spacing Calculator: How Many Plants Fit in a Bed',
    h1: 'Plant Spacing Calculator',
    metaDescription: 'Count how many plants fit in a rectangular bed for a given spacing, in a square grid or a staggered triangular pattern.',
    about:
      'Spacing decides how much each plant gets of light, water and root room, and how many plants one bed can carry. Crowd them and they compete, shade each other and invite disease; space them too wide and the soil goes to weeds. Enter the length and width of the bed in feet and the centre-to-centre spacing in inches that the seed packet or plant tag recommends. In a square grid every plant has a square of its own, so the count is the bed area divided by the spacing squared. A staggered, or triangular, layout offsets alternate rows so the plants nest together. It fits about 15 percent more into the same bed at the same spacing, which is why it is used for intensive vegetable beds and flower drifts. The result is an area-based estimate, and the edge rows in a narrow bed may need adjusting by hand. Round down, and leave the paths out of the length and width.',
    inputs: [
      field('length', 'Bed length (ft)', 8, 1, 200),
      field('width', 'Bed width (ft)', 4, 1, 100),
      field('spacing', 'Spacing, centre to centre (in)', 12, 1, 120),
      select('layout', 'Layout', 'square', [
        ['square', 'Square grid'],
        ['triangular', 'Staggered (triangular)'],
      ]),
    ],
    outputs: [
      { name: 'plants', label: 'Plants that fit', format: 'text', highlight: true },
      { name: 'density', label: 'Plants per square foot', format: 'text' },
    ],
    calculate: (i) => {
      const area = toD(i.length).mul(toD(i.width));
      const cell = toD(i.spacing).pow(2).div(144);
      const each = String(i.layout) === 'triangular' ? cell.mul(SQRT3_OVER_2) : cell;
      const plants = area.div(each).floor();
      return { plants: `${fmtNumber(plants, 0)} plants`, density: `${fmtNumber(plants.div(area), 2)} per sq ft` };
    },
    formulaDescription:
      'Square grid: plants = bed area ÷ spacing². Staggered: plants = bed area ÷ (spacing² × 0.866). Spacing is converted from inches to feet and the result is rounded down.',
    workedExample:
      'A bed 8 ft by 4 ft is 32 sq ft. At 12 in spacing each plant needs 1 sq ft, so a square grid holds 32 plants. Staggered, each needs 0.866 sq ft, so 36 plants fit.',
    faq: [
      {
        question: 'Should the spacing be centre to centre?',
        answer: 'Yes. Use the distance between the middles of neighbouring plants, as given on seed packets.',
      },
      {
        question: 'Why does staggering fit more?',
        answer: 'Offset rows let each plant sit in the gap of the row before, so every plant uses a hexagon instead of a square.',
      },
      { question: 'Do I need to leave an edge?', answer: 'Keep half the spacing clear of the bed edge, or measure the planting area only.' },
    ],
    scenarios: [
      withInputs('A raised bed 8 ft by 4 ft at 12 in', { length: 8, width: 4, spacing: 12, layout: 'square' }),
      withInputs('The same bed, staggered', { length: 8, width: 4, spacing: 12, layout: 'triangular' }),
      withInputs('Lettuce 6 in apart in a 10 ft by 3 ft row', { length: 10, width: 3, spacing: 6, layout: 'triangular' }),
      withInputs('Tomatoes 24 in apart in a 12 ft by 4 ft plot', { length: 12, width: 4, spacing: 24, layout: 'square' }),
      withInputs('Carrots 3 in apart in a 6 ft by 4 ft bed', { length: 6, width: 4, spacing: 3, layout: 'square' }),
    ],
    introOutputs: ['plants', 'density'],
    relatedSlugs: ['plant-population-calculator', 'bulb-spacing-calculator'],
    checks: [
      { inputs: {}, expect: { plants: '32 plants', density: '1 per sq ft' } },
      { inputs: { layout: 'triangular' }, expect: { plants: '36 plants', density: '1.13 per sq ft' } },
      { inputs: { spacing: 6 }, expect: { plants: '128 plants', density: '4 per sq ft' } },
    ],
  },
  {
    slug: 'plant-population-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Plant Population Calculator: Plants and Seeds per Acre',
    h1: 'Plant Population Calculator',
    metaDescription: 'Turn row spacing and in-row seed spacing into plants per acre and per hectare, with the seeds to plant after germination loss.',
    about:
      'Crop planners talk about population, meaning the number of plants standing on an acre or hectare, since yield depends on it as much as on the variety. Row crops such as corn, soybeans and sunflowers are sown in rows a fixed distance apart, with seeds dropped at a set spacing along each row. Multiply the two spacings to find the ground area each plant gets, then divide the 6,272,640 square inches in an acre by that area. Enter the row width and the in-row spacing in inches, the area of the field and the germination rate printed on the seed tag. The calculator returns the plants per acre and per hectare, the plants in your whole field and the seeds to buy per acre once the seeds that will not come up are counted. Use the stand count after emergence to check that the drill or planter delivered what you set it to, since worn plates and a fast tractor can shave the population by several percent.',
    inputs: [
      field('row', 'Row spacing (in)', 30, 5, 80),
      field('inrow', 'Spacing in the row (in)', 6, 1, 60),
      field('acres', 'Field size (acres)', 10, 0.1, 5000),
      field('germ', 'Germination (%)', 95, 40, 100),
    ],
    outputs: [
      { name: 'perAcre', label: 'Plants per acre', format: 'text', highlight: true },
      { name: 'perHa', label: 'Plants per hectare', format: 'text' },
      { name: 'seeds', label: 'Seeds to plant per acre', format: 'text' },
      { name: 'field', label: 'Plants in the whole field', format: 'text' },
    ],
    calculate: (i) => {
      const perAcre = SQ_FT_PER_ACRE.mul(144).div(toD(i.row).mul(toD(i.inrow)));
      const seeds = perAcre.div(toD(i.germ).div(100));
      return {
        perAcre: fmtNumber(perAcre.floor(), 0),
        perHa: fmtNumber(perAcre.div(HECTARES_PER_ACRE).floor(), 0),
        seeds: fmtNumber(seeds.ceil(), 0),
        field: fmtNumber(perAcre.mul(toD(i.acres)).floor(), 0),
      };
    },
    formulaDescription:
      'Plants per acre = 6,272,640 ÷ (row spacing × in-row spacing), with both in inches. Per hectare = per acre ÷ 0.4047. Seeds per acre = plants per acre ÷ germination.',
    workedExample:
      'Rows 30 in apart with seeds 6 in apart in the row: 6,272,640 ÷ 180 = 34,848 plants per acre. With 95 % germination you plant 34,848 ÷ 0.95 = 36,683 seeds per acre.',
    faq: [
      {
        question: 'Why is seed needed higher than the plant population?',
        answer: 'Some seeds fail to germinate and some seedlings die. The germination rate on the tag shows the first loss; field losses come on top.',
      },
      { question: 'Are twin rows handled?', answer: 'Enter the average row width, so for twin rows use the spacing between the pairs of rows.' },
      {
        question: 'Does a higher population always raise yield?',
        answer: 'No. Beyond an optimum, plants compete and yield falls, and the optimum depends on soil, water and hybrid.',
      },
    ],
    scenarios: rows(
      ['row', 'inrow', 'acres', 'germ'],
      [
        [30, 6, 10, 95],
        [15, 3, 40, 90],
        [36, 8, 25, 92],
        [20, 4, 80, 96],
        [30, 4, 5, 98],
        [22, 5, 12, 94],
      ],
      (v) => `${v[0]} in rows, ${v[1]} in apart, ${v[2]} acres at ${v[3]} % germination`,
    ),
    introOutputs: ['perAcre', 'seeds'],
    relatedSlugs: ['plant-spacing-calculator', 'corn-yield-calculator'],
    checks: [
      { inputs: {}, expect: { perAcre: '34,848', perHa: '86,111', seeds: '36,683', field: '348,480' } },
      { inputs: { row: 15, inrow: 3, acres: 40, germ: 90 }, expect: { perAcre: '139,392', seeds: '154,880', field: '5,575,680' } },
      { inputs: { germ: 100 }, expect: { seeds: '34,848' } },
    ],
  },
  {
    slug: 'bulb-spacing-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Bulb Spacing Calculator: How Many Bulbs and How Deep',
    h1: 'Bulb Spacing Calculator',
    metaDescription: 'Work out how many spring bulbs to buy for a border and how deep to plant them, from spacing and bulb height.',
    about:
      'Spring bulbs such as tulips, daffodils, crocuses and alliums look best when planted thickly, but each needs room for roots and for the flower stem to reach the light. This calculator helps you buy the right number for a border or a lawn patch. Enter the length and width of the planting area in feet and the spacing between bulbs, which for large bulbs is about three bulb widths and for small ones about two. It returns the count for a square grid and for a staggered planting, where alternate rows are offset to give the natural drift that gardeners prefer. The planting depth follows an old rule: dig a hole three times as deep as the bulb is tall, measured from the base to the tip. Tulips of 2 inches go in at 6 inches, while a crocus of half an inch needs 1.5 inches. In heavy clay, plant a little shallower, and in sandy soil, a little deeper.',
    inputs: [
      field('length', 'Planting area length (ft)', 10, 1, 100),
      field('width', 'Planting area width (ft)', 3, 1, 50),
      field('spacing', 'Spacing between bulbs (in)', 4, 1, 24),
      field('height', 'Bulb height, base to tip (in)', 1.5, 0.25, 6),
    ],
    outputs: [
      { name: 'stagger', label: 'Bulbs, staggered planting', format: 'text', highlight: true },
      { name: 'grid', label: 'Bulbs, square grid', format: 'text' },
      { name: 'depth', label: 'Planting depth', format: 'text' },
    ],
    calculate: (i) => {
      const area = toD(i.length).mul(toD(i.width)).mul(144);
      const cell = toD(i.spacing).pow(2);
      return {
        stagger: `${fmtNumber(area.div(cell.mul(SQRT3_OVER_2)).floor(), 0)} bulbs`,
        grid: `${fmtNumber(area.div(cell).floor(), 0)} bulbs`,
        depth: `${fmtNumber(toD(i.height).mul(3), 2)} in`,
      };
    },
    formulaDescription: 'Grid count = area ÷ spacing². Staggered count = area ÷ (spacing² × 0.866). Depth = 3 × bulb height. Counts are rounded down.',
    workedExample:
      'A border of 10 ft by 3 ft is 4,320 sq in. At 4 in spacing a grid holds 4,320 ÷ 16 = 270 bulbs and a staggered pattern 311. A bulb 1.5 in tall goes 4.5 in deep.',
    faq: [
      {
        question: 'How far apart do tulips go?',
        answer: 'About 4 to 6 inches centre to centre, and daffodils 6 inches; tiny bulbs like crocus can go 2 to 3 inches.',
      },
      {
        question: 'Should I plant in rows or clumps?',
        answer: 'Clumps and staggered drifts look natural. Use the staggered count for a drift and the grid count for a formal row.',
      },
      { question: 'What if the bulb is pointed at both ends?', answer: 'Measure from the base to the tip and plant with the pointed end up.' },
    ],
    scenarios: rows(
      ['length', 'width', 'spacing', 'height'],
      [
        [10, 3, 4, 1.5],
        [6, 2, 6, 2],
        [20, 4, 3, 1],
        [8, 8, 5, 2],
        [4, 2, 2, 0.5],
        [15, 3, 6, 2.5],
      ],
      (v) => `A ${v[0]} ft by ${v[1]} ft bed, bulbs ${v[2]} in apart and ${v[3]} in tall`,
    ),
    introOutputs: ['stagger', 'depth'],
    relatedSlugs: ['plant-spacing-calculator', 'mulch-calculator'],
    checks: [
      { inputs: {}, expect: { stagger: '311 bulbs', grid: '270 bulbs', depth: '4.5 in' } },
      { inputs: { spacing: 6, height: 2 }, expect: { grid: '120 bulbs', depth: '6 in' } },
      { inputs: { length: 4, width: 2, spacing: 2, height: 0.5 }, expect: { grid: '288 bulbs', depth: '1.5 in' } },
    ],
  },
  {
    slug: 'tree-spacing-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Trees and forestry',
    title: 'Tree Spacing Calculator: Trees per Acre for Planting',
    h1: 'Tree Spacing Calculator',
    metaDescription: 'Find how many seedlings a planting site takes from the spacing between rows and between trees, per acre and per hectare.',
    about:
      'Foresters, orchardists and landowners planting windbreaks or woodlots need to know how many seedlings to order before the planting day, and spacing is the number that drives it. Closer spacing closes the canopy sooner, which shades out weeds and forces trees to grow straight with fewer low branches, but it costs more in stock and needs earlier thinning. Wider spacing saves on planting and gives each tree room to build a large crown, which suits nut trees and wildlife plantings. Enter the distance between rows and the distance between trees in a row, both in feet, and the size of the site in acres. The calculator divides the 43,560 square feet of an acre by the ground area per tree and reports the density per acre and per hectare and the total order for the site. A typical conifer plantation uses 8 by 8 to 10 by 10 feet, giving 435 to 680 trees per acre, and hardwood plantings often go 12 by 12 feet or wider.',
    inputs: [
      field('rows', 'Distance between rows (ft)', 10, 2, 60),
      field('trees', 'Distance between trees in a row (ft)', 10, 2, 60),
      field('acres', 'Planting area (acres)', 5, 0.1, 10000),
    ],
    outputs: [
      { name: 'perAcre', label: 'Trees per acre', format: 'text', highlight: true },
      { name: 'perHa', label: 'Trees per hectare', format: 'text' },
      { name: 'order', label: 'Trees for the whole site', format: 'text' },
      { name: 'ground', label: 'Ground per tree', format: 'text' },
    ],
    calculate: (i) => {
      const each = toD(i.rows).mul(toD(i.trees));
      const perAcre = SQ_FT_PER_ACRE.div(each);
      return {
        perAcre: fmtNumber(perAcre, 1),
        perHa: fmtNumber(perAcre.div(HECTARES_PER_ACRE), 1),
        order: fmtNumber(perAcre.mul(toD(i.acres)).floor(), 0),
        ground: `${fmtNumber(each, 0)} sq ft`,
      };
    },
    formulaDescription:
      'Ground per tree = row spacing × tree spacing. Trees per acre = 43,560 ÷ ground per tree. Per hectare = per acre ÷ 0.4047. Site total = per acre × acres, rounded down.',
    workedExample:
      'Rows 10 ft apart with trees 10 ft apart in the row give each tree 100 sq ft, so 43,560 ÷ 100 = 435.6 trees per acre. A 5-acre site takes 2,178 trees.',
    faq: [
      {
        question: 'Should I order extra seedlings?',
        answer: 'Yes. Plan for 10 to 20 percent more to replace deaths, since survival varies with site, stock and weather.',
      },
      {
        question: 'What spacing should I choose?',
        answer: 'Use local forestry guidance for your species. Timber plantings are usually denser than orchards or wildlife plantings.',
      },
      {
        question: 'Does the pattern change the answer?',
        answer: 'A square grid is assumed. A staggered pattern fits about 15 percent more trees at the same minimum distance.',
      },
    ],
    scenarios: rows(
      ['rows', 'trees', 'acres'],
      [
        [10, 10, 5],
        [8, 8, 10],
        [12, 12, 3],
        [6, 6, 2],
        [15, 12, 20],
        [20, 20, 8],
      ],
      (v) => `Trees ${v[1]} ft apart in rows ${v[0]} ft apart on ${v[2]} acres`,
    ),
    introOutputs: ['perAcre', 'order'],
    relatedSlugs: ['basal-area-calculator', 'plant-population-calculator'],
    checks: [
      { inputs: {}, expect: { perAcre: '435.6', perHa: '1,076.4', order: '2,178', ground: '100 sq ft' } },
      { inputs: { rows: 8, trees: 8, acres: 10 }, expect: { perAcre: '680.6', order: '6,806' } },
      { inputs: { rows: 20, trees: 20 }, expect: { perAcre: '108.9', order: '544' } },
    ],
  },
  {
    slug: 'mulch-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Gardening and crops',
    title: 'Mulch Calculator: Cubic Yards and Bags for a Bed',
    h1: 'Mulch Calculator',
    metaDescription: 'Work out cubic yards, cubic feet and bags of mulch for a garden bed from its length, width and the depth you want to spread.',
    about:
      'A layer of mulch keeps soil moist, suppresses weeds and moderates the soil temperature, but only if you spread enough. Two to four inches is the usual depth: less than two will let weed seeds through, and more than four can smother the roots, hold too much water and invite pests. Bulk mulch is sold by the cubic yard, which is a cube three feet on each side or 27 cubic feet, and bagged mulch by the cubic foot, most often in 2-cubic-foot bags. Enter the length and width of the bed in feet, the depth in inches and the bag size, and the calculator gives the volume in cubic yards, cubic feet and cubic metres, and the number of bags to buy rounded up. For irregular beds, split the shape into rectangles and add them, or use an average width. Keep mulch a few inches away from tree trunks and plant stems, since a volcano pile rots the bark, and top up each spring as the old layer breaks down.',
    inputs: [
      field('length', 'Bed length (ft)', 20, 1, 500),
      field('width', 'Bed width (ft)', 10, 1, 500),
      field('depth', 'Depth (in)', 3, 0.5, 12),
      field('bag', 'Bag size (cu ft)', 2, 0.5, 3),
    ],
    outputs: [
      { name: 'yd', label: 'Cubic yards', format: 'text', highlight: true },
      { name: 'ft', label: 'Cubic feet', format: 'text' },
      { name: 'm', label: 'Cubic metres', format: 'text' },
      { name: 'bags', label: 'Bags to buy', format: 'text' },
    ],
    calculate: (i) => {
      const ft3 = toD(i.length).mul(toD(i.width)).mul(toD(i.depth)).div(12);
      const yd3 = ft3.div(CU_FT_PER_CU_YD);
      return {
        yd: `${fmtNumber(yd3, 2)} yd³`,
        ft: `${fmtNumber(ft3, 1)} ft³`,
        m: `${fmtNumber(yd3.mul(CU_M_PER_CU_YD), 2)} m³`,
        bags: `${fmtNumber(ft3.div(toD(i.bag)).ceil(), 0)} bags`,
      };
    },
    formulaDescription: 'Volume (ft³) = length × width × depth ÷ 12. Cubic yards = ft³ ÷ 27. Cubic metres = yards × 0.7646. Bags = ft³ ÷ bag size, rounded up.',
    workedExample: 'A bed 20 ft by 10 ft at 3 in deep holds 20 × 10 × 3 ÷ 12 = 50 ft³, which is 1.85 yd³ or 1.42 m³. In 2 ft³ bags that is 25 bags.',
    faq: [
      {
        question: 'How deep should mulch be?',
        answer: 'Two to four inches for most beds. Use about 2 inches for fine mulches and up to 4 for coarse bark or wood chips.',
      },
      {
        question: 'Should I add extra for settling?',
        answer: 'Mulch settles a little. Rounding the bags up usually covers it; for a large job add 5 to 10 percent.',
      },
      {
        question: 'Is bulk cheaper than bags?',
        answer: 'Often yes above about 2 cubic yards, because a yard equals 13 bags of 2 cubic feet. Check the delivery fee.',
      },
    ],
    scenarios: rows(
      ['length', 'width', 'depth', 'bag'],
      [
        [20, 10, 3, 2],
        [20, 10, 2, 2],
        [12, 4, 3, 3],
        [40, 8, 4, 2],
        [15, 15, 2, 2],
        [6, 3, 3, 1.5],
      ],
      (v) => `A ${v[0]} ft by ${v[1]} ft bed, ${v[2]} in deep, ${v[3]} cu ft bags`,
    ),
    introOutputs: ['yd', 'bags'],
    relatedSlugs: ['raised-bed-soil-calculator', 'pine-straw-calculator'],
    checks: [
      { inputs: {}, expect: { yd: '1.85 yd³', ft: '50 ft³', m: '1.42 m³', bags: '25 bags' } },
      { inputs: { depth: 2 }, expect: { yd: '1.23 yd³', ft: '33.3 ft³', bags: '17 bags' } },
      { inputs: { bag: 3 }, expect: { bags: '17 bags' } },
    ],
  },
  {
    slug: 'pine-straw-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Pine Straw Calculator: Bales Needed for Your Beds',
    h1: 'Pine Straw Calculator',
    metaDescription: 'Estimate how many bales of pine straw cover a landscape bed from its area, the depth you spread and the coverage printed on the bale.',
    about:
      'Pine needles, sold as pine straw, are a favourite mulch in the southern United States. They knit together so they stay on slopes, let water through, break down slowly and leave the soil gently acidic, which azaleas, camellias and blueberries enjoy. The material comes in compressed bales and the coverage per bale is quoted at a standard depth, commonly about 50 square feet at 3 inches, although local suppliers vary and their figures come in from 35 to 60. Enter the area to cover, the depth you plan to spread and the coverage the supplier states at 3 inches. Because the volume in a bale is fixed, a thinner layer stretches further, and a deeper layer needs proportionally more bales. The calculator scales the coverage by 3 divided by your chosen depth, divides the area by it and rounds up to whole bales. A fresh layer of 2 to 3 inches is enough, and later top-ups of an inch will do, since the straw stays fluffy.',
    inputs: [
      field('area', 'Area to cover (sq ft)', 400, 10, 50000),
      field('depth', 'Depth to spread (in)', 3, 1, 6),
      field('cover', 'Coverage per bale at 3 in (sq ft)', 50, 20, 100),
    ],
    outputs: [
      { name: 'bales', label: 'Bales to buy', format: 'text', highlight: true },
      { name: 'each', label: 'One bale covers at this depth', format: 'text' },
    ],
    calculate: (i) => {
      const each = toD(i.cover).mul(3).div(toD(i.depth));
      return { bales: `${fmtNumber(toD(i.area).div(each).ceil(), 0)} bales`, each: `${fmtNumber(each, 1)} sq ft` };
    },
    formulaDescription: 'Coverage per bale at your depth = coverage at 3 in × 3 ÷ depth. Bales = area ÷ that coverage, rounded up.',
    workedExample:
      'A 400 sq ft bed at 3 in deep with a bale covering 50 sq ft needs 400 ÷ 50 = 8 bales. At 2 in deep each bale covers 75 sq ft, so 400 ÷ 75 = 5.3, which rounds to 6 bales.',
    faq: [
      {
        question: 'Why does the bale size vary?',
        answer:
          'Suppliers press and tie the straw differently. Use the coverage on the label or ask the supplier, and keep the default only as a starting guess.',
      },
      {
        question: 'Is pine straw better than bark mulch?',
        answer: 'Neither is better in every case. Straw is light and stays on slopes, while bark lasts longer in flat beds.',
      },
      { question: 'How often do I top it up?', answer: 'Roughly once a year, with a layer of about an inch, as the needles settle and decay.' },
    ],
    scenarios: rows(
      ['area', 'depth', 'cover'],
      [
        [400, 3, 50],
        [400, 2, 50],
        [1000, 4, 45],
        [150, 3, 60],
        [2500, 3, 50],
        [800, 2, 40],
      ],
      (v) => `${v[0]} sq ft spread ${v[1]} in deep, bales covering ${v[2]} sq ft at 3 in`,
    ),
    introOutputs: ['bales', 'each'],
    relatedSlugs: ['mulch-calculator', 'raised-bed-soil-calculator'],
    checks: [
      { inputs: {}, expect: { bales: '8 bales', each: '50 sq ft' } },
      { inputs: { depth: 2 }, expect: { bales: '6 bales', each: '75 sq ft' } },
      { inputs: { area: 1000, depth: 4, cover: 45 }, expect: { bales: '30 bales', each: '33.8 sq ft' } },
    ],
  },
  {
    slug: 'sod-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Gardening and crops',
    title: 'Sod Calculator: Rolls, Squares and Pallets for a Lawn',
    h1: 'Sod Calculator',
    metaDescription: 'Work out the square feet of sod to order for a lawn including waste, the number of rolls or slabs, and the pallets needed.',
    about:
      'Sod gives an instant lawn, but it is sold fresh and cut to order, so an exact order matters: too little leaves a bare strip that will not match later, and too much wilts in the sun within a day. Measure the length and width of the lawn in feet, or split an odd-shaped yard into rectangles and add them. Add an allowance for cutting around beds, paths and curves, which is about 5 percent on a plain rectangle and 10 percent or more on curved edges. Enter the size of one piece, which is often 10 square feet for a roll of 2 by 5 feet, or about 2.7 for a slab of 16 by 24 inches, and the area of a pallet, usually 400 to 500 square feet, as the grower states. The calculator gives you the area to order, the count of rolls or slabs and the number of pallets. Prepare the soil before delivery, lay sod on the day it arrives, and water it within half an hour of laying.',
    inputs: [
      field('length', 'Lawn length (ft)', 40, 1, 1000),
      field('width', 'Lawn width (ft)', 30, 1, 1000),
      field('waste', 'Waste allowance (%)', 5, 0, 30),
      field('piece', 'Area of one roll or slab (sq ft)', 10, 1, 50),
      field('pallet', 'Area on one pallet (sq ft)', 450, 100, 1000),
    ],
    outputs: [
      { name: 'order', label: 'Area to order', format: 'text', highlight: true },
      { name: 'pieces', label: 'Rolls or slabs', format: 'text' },
      { name: 'pallets', label: 'Pallets', format: 'text' },
    ],
    calculate: (i) => {
      const order = toD(i.length)
        .mul(toD(i.width))
        .mul(new D(1).add(toD(i.waste).div(100)));
      return { order: `${fmtNumber(order, 0)} sq ft`, pieces: fmtNumber(order.div(toD(i.piece)).ceil(), 0), pallets: fmtNumber(order.div(toD(i.pallet)), 1) };
    },
    formulaDescription: 'Area to order = length × width × (1 + waste ÷ 100). Pieces = area ÷ piece size, rounded up. Pallets = area ÷ pallet coverage.',
    workedExample:
      'A lawn 40 ft by 30 ft is 1,200 sq ft. With 5 % waste you order 1,260 sq ft. In rolls of 10 sq ft that is 126 rolls, which is 2.8 pallets of 450 sq ft.',
    faq: [
      {
        question: 'How much waste should I allow?',
        answer: 'About 5 percent for a plain rectangle and up to 10 or 15 percent for curves, islands or many corners.',
      },
      { question: 'How soon must sod be laid?', answer: 'Within 24 hours of delivery in warm weather. Keep it shaded and moist until it goes down.' },
      { question: 'Do pallet sizes vary?', answer: 'Yes. Grasses and growers differ, so enter the figure from your supplier.' },
    ],
    scenarios: rows(
      ['length', 'width', 'waste', 'piece', 'pallet'],
      [
        [40, 30, 5, 10, 450],
        [30, 20, 10, 2.67, 450],
        [60, 50, 5, 10, 500],
        [25, 15, 15, 10, 400],
        [100, 80, 7, 10, 450],
        [18, 12, 10, 2, 400],
      ],
      (v) => `A lawn ${v[0]} ft by ${v[1]} ft with ${v[2]} % waste and ${v[3]} sq ft pieces`,
    ),
    introOutputs: ['order', 'pallets'],
    relatedSlugs: ['grass-seed-calculator', 'soil-calculator'],
    checks: [
      { inputs: {}, expect: { order: '1,260 sq ft', pieces: '126', pallets: '2.8' } },
      { inputs: { length: 30, width: 20, waste: 10, piece: 2 }, expect: { order: '660 sq ft', pieces: '330', pallets: '1.5' } },
      { inputs: { waste: 0 }, expect: { order: '1,200 sq ft', pieces: '120', pallets: '2.7' } },
    ],
  },
  {
    slug: 'grass-seed-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Gardening and crops',
    title: 'Grass Seed Calculator: Pounds of Seed for a Lawn',
    h1: 'Grass Seed Calculator',
    metaDescription: 'Find how many pounds of grass seed a new lawn or an overseeding needs from its area and the type of grass.',
    about:
      'The right amount of grass seed gives a dense lawn that crowds out weeds. Too little leaves bare gaps, while too much makes seedlings fight each other and invites damping off disease. Seeding rates are written as pounds per 1,000 square feet and depend on the species, since seeds differ enormously in size: there are about 2 million Kentucky bluegrass seeds in a pound but only a quarter of a million tall fescue seeds. Pick the grass, say whether the job is a new lawn or an overseeding of an existing one, and enter the area in square feet. The calculator uses typical new-lawn rates, which are 2 pounds for bluegrass, 8 for tall fescue, 7 for perennial ryegrass, 4 for fine fescue and about 1.5 for hulled Bermudagrass, and halves them for overseeding. Use the bag label if it states a rate, since coated and mixed seed differ. Spread half the seed in one direction and half at right angles for an even coat, and keep the top inch moist until germination.',
    inputs: [
      field('area', 'Lawn area (sq ft)', 5000, 100, 500000),
      select('grass', 'Grass type', 'tall-fescue', [
        ['bluegrass', 'Kentucky bluegrass (2 lb per 1,000)'],
        ['tall-fescue', 'Tall fescue (8 lb per 1,000)'],
        ['ryegrass', 'Perennial ryegrass (7 lb per 1,000)'],
        ['fine-fescue', 'Fine fescue (4 lb per 1,000)'],
        ['bermuda', 'Hulled Bermudagrass (1.5 lb per 1,000)'],
      ]),
      select('job', 'Job', 'new', [
        ['new', 'New lawn'],
        ['overseed', 'Overseeding (half rate)'],
      ]),
    ],
    outputs: [
      { name: 'lb', label: 'Seed needed', format: 'text', highlight: true },
      { name: 'kg', label: 'In kilograms', format: 'text' },
      { name: 'rate', label: 'Rate used', format: 'text' },
    ],
    calculate: (i) => {
      const base = new D({ bluegrass: '2', 'tall-fescue': '8', ryegrass: '7', 'fine-fescue': '4', bermuda: '1.5' }[String(i.grass)] ?? '8');
      const rate = String(i.job) === 'overseed' ? base.div(2) : base;
      const lb = toD(i.area).div(1000).mul(rate);
      return { lb: `${fmtNumber(lb, 1)} lb`, kg: `${fmtNumber(lb.mul(KG_PER_LB), 1)} kg`, rate: `${fmtNumber(rate, 2)} lb per 1,000 sq ft` };
    },
    formulaDescription: 'Seed (lb) = area ÷ 1,000 × rate. The rate is the new-lawn figure for the grass, halved for overseeding. Kilograms = pounds × 0.4536.',
    workedExample:
      'A tall fescue lawn of 5,000 sq ft at 8 lb per 1,000 sq ft needs 5 × 8 = 40 lb of seed, about 18.1 kg. Overseeding the same lawn takes 20 lb.',
    faq: [
      {
        question: 'Are the rates exact?',
        answer: 'They are typical figures. Where the bag gives a rate, follow it, since coated, blended and pelleted seeds differ.',
      },
      {
        question: 'Can I use more to be safe?',
        answer: 'Not usefully. Overcrowded seedlings are weak and prone to disease. A thin patch is better fixed with a second pass.',
      },
      { question: 'When should I sow?', answer: 'Cool-season grasses in early autumn or spring and warm-season grasses in late spring, when soil is warm.' },
    ],
    scenarios: [
      withInputs('A tall fescue lawn of 5,000 sq ft, new', { area: 5000, grass: 'tall-fescue', job: 'new' }),
      withInputs('Overseeding the same fescue lawn', { area: 5000, grass: 'tall-fescue', job: 'overseed' }),
      withInputs('A 5,000 sq ft bluegrass lawn, new', { area: 5000, grass: 'bluegrass', job: 'new' }),
      withInputs('A Bermudagrass lawn of 10,000 sq ft', { area: 10000, grass: 'bermuda', job: 'new' }),
      withInputs('A ryegrass patch of 800 sq ft for winter', { area: 800, grass: 'ryegrass', job: 'overseed' }),
    ],
    introOutputs: ['lb', 'rate'],
    relatedSlugs: ['sod-calculator', 'fertilizer-calculator'],
    checks: [
      { inputs: {}, expect: { lb: '40 lb', kg: '18.1 kg', rate: '8 lb per 1,000 sq ft' } },
      { inputs: { job: 'overseed' }, expect: { lb: '20 lb', rate: '4 lb per 1,000 sq ft' } },
      { inputs: { grass: 'bluegrass' }, expect: { lb: '10 lb', kg: '4.5 kg' } },
      { inputs: { area: 10000, grass: 'bermuda' }, expect: { lb: '15 lb' } },
    ],
  },
  {
    slug: 'raised-bed-soil-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Gardening and crops',
    title: 'Raised Bed Soil Calculator: Cubic Feet, Yards and Bags',
    h1: 'Raised Bed Soil Calculator',
    metaDescription: 'Calculate the soil to fill one or several raised garden beds, in cubic feet, cubic yards and bags, with an allowance for settling.',
    about:
      'Filling a raised bed is the biggest expense of building one, so it pays to measure before ordering. A bed 8 feet by 4 feet and 12 inches deep holds 32 cubic feet, which is more than a dozen bags of 2 cubic feet and more than a cubic yard of loose soil once you add the settling that follows the first watering. Enter the inside length and width of the bed in feet, the fill depth in inches, the number of identical beds and the bag size. Fill depth matters: leafy greens root in 6 inches, most vegetables are happy with 10 to 12, and tomatoes, carrots and parsnips do better in 18 or more. The calculator adds an allowance for settling of 10 percent by default and returns the volume in cubic feet, cubic yards and litres, and the bags to buy. A popular blend is equal parts compost, coarse vermiculite and peat moss or coir, and a cheaper one fills the lower half with logs, branches and rough compost, which is called hugelkultur, before topping with soil.',
    inputs: [
      field('length', 'Bed length (ft)', 8, 1, 100),
      field('width', 'Bed width (ft)', 4, 1, 20),
      field('depth', 'Fill depth (in)', 12, 3, 48),
      field('beds', 'Number of beds', 1, 1, 50),
      field('settle', 'Settling allowance (%)', 10, 0, 30),
      field('bag', 'Bag size (cu ft)', 1.5, 0.5, 3),
    ],
    outputs: [
      { name: 'ft3', label: 'Soil to order', format: 'text', highlight: true },
      { name: 'yd3', label: 'Cubic yards', format: 'text' },
      { name: 'litres', label: 'Litres', format: 'text' },
      { name: 'bags', label: 'Bags to buy', format: 'text' },
    ],
    calculate: (i) => {
      const ft3 = toD(i.length)
        .mul(toD(i.width))
        .mul(toD(i.depth))
        .div(12)
        .mul(toD(i.beds))
        .mul(new D(1).add(toD(i.settle).div(100)));
      return {
        ft3: `${fmtNumber(ft3, 1)} ft³`,
        yd3: `${fmtNumber(ft3.div(CU_FT_PER_CU_YD), 2)} yd³`,
        litres: `${fmtNumber(ft3.mul(LITRES_PER_CU_FT), 0)} L`,
        bags: `${fmtNumber(ft3.div(toD(i.bag)).ceil(), 0)} bags`,
      };
    },
    formulaDescription:
      'Volume (ft³) = length × width × depth ÷ 12 × beds × (1 + settling ÷ 100). Cubic yards = ft³ ÷ 27. Litres = ft³ × 28.32. Bags = ft³ ÷ bag size, rounded up.',
    workedExample: 'A bed of 8 ft by 4 ft filled 12 in deep is 32 ft³. With 10 % for settling that is 35.2 ft³, or 1.30 yd³, and in 1.5 ft³ bags you buy 24.',
    faq: [
      {
        question: 'How deep should a raised bed be?',
        answer: 'Six inches is enough for lettuce and herbs, 10 to 12 for most vegetables and 18 or more for deep roots like carrots.',
      },
      {
        question: 'Do I fill it all with bagged soil?',
        answer: 'No. Bagged mix is costly. Many gardeners buy bulk topsoil and compost, and fill the lower layer with branches or logs.',
      },
      {
        question: 'Why add for settling?',
        answer: 'Loose soil settles by 10 percent or more after watering, so the bed ends up lower than planned if you fill it exactly.',
      },
    ],
    scenarios: rows(
      ['length', 'width', 'depth', 'beds', 'settle', 'bag'],
      [
        [8, 4, 12, 1, 10, 1.5],
        [8, 4, 12, 2, 10, 1.5],
        [4, 4, 6, 1, 10, 1.5],
        [10, 3, 18, 3, 15, 2],
        [6, 3, 10, 4, 5, 1.5],
        [12, 4, 12, 1, 0, 3],
      ],
      (v) => `${v[3]} bed${v[3] === 1 ? '' : 's'} of ${v[0]} ft by ${v[1]} ft filled ${v[2]} in deep`,
    ),
    introOutputs: ['ft3', 'bags'],
    relatedSlugs: ['mulch-calculator', 'potting-soil-calculator'],
    checks: [
      { inputs: {}, expect: { ft3: '35.2 ft³', yd3: '1.3 yd³', litres: '997 L', bags: '24 bags' } },
      { inputs: { beds: 2 }, expect: { ft3: '70.4 ft³', bags: '47 bags' } },
      { inputs: { depth: 6 }, expect: { ft3: '17.6 ft³', bags: '12 bags' } },
    ],
  },
  {
    slug: 'potting-soil-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Potting Soil Calculator: Mix Needed for Round Pots',
    h1: 'Potting Soil Calculator',
    metaDescription: 'Calculate how much potting mix a round container holds in litres and cubic feet, and how many bags you need for several pots.',
    about:
      'Containers swallow more potting mix than most people expect. A pot 12 inches across and 10 inches deep holds nearly 17 litres, more than half a cubic foot, and a patio full of pots adds up to several bags. Enter the inside diameter and the depth of the pot, how many pots you have and how full you intend to fill them. Fill to within about an inch of the rim, which is roughly 90 percent of the height, so that watering does not wash soil over the edge. The calculator treats the pot as a cylinder, which suits straight-sided containers and slightly overstates the volume of tapered ones, where you can use the average of the top and bottom diameters. The answer comes in litres, which is how many European bags are labelled, and in cubic feet, with the number of bags for the size you choose. Cover the drainage hole with a coarse crock rather than filler, since a deep layer of gravel at the bottom does not improve drainage.',
    inputs: [
      field('diameter', 'Inside diameter (in)', 12, 2, 60),
      field('depth', 'Inside depth (in)', 10, 2, 48),
      field('pots', 'Number of pots', 1, 1, 500),
      field('fill', 'Fill level (%)', 90, 50, 100),
      field('bag', 'Bag size (cu ft)', 1, 0.25, 3),
    ],
    outputs: [
      { name: 'perPot', label: 'Mix per pot', format: 'text' },
      { name: 'total', label: 'Total mix', format: 'text', highlight: true },
      { name: 'ft3', label: 'Total in cubic feet', format: 'text' },
      { name: 'bags', label: 'Bags to buy', format: 'text' },
    ],
    calculate: (i) => {
      const inch3 = PI.div(4).mul(toD(i.diameter).pow(2)).mul(toD(i.depth)).mul(toD(i.fill).div(100));
      const litres = inch3.mul(LITRES_PER_CU_IN);
      const ft3 = inch3.mul(toD(i.pots)).div(1728);
      return {
        perPot: `${fmtNumber(litres, 2)} L`,
        total: `${fmtNumber(litres.mul(toD(i.pots)), 1)} L`,
        ft3: `${fmtNumber(ft3, 2)} ft³`,
        bags: `${fmtNumber(ft3.div(toD(i.bag)).ceil(), 0)} bags`,
      };
    },
    formulaDescription:
      'Volume per pot (in³) = π ÷ 4 × diameter² × depth × fill. Litres = in³ × 0.016387. Cubic feet = in³ × pots ÷ 1,728. Bags = ft³ ÷ bag size, rounded up.',
    workedExample:
      'A pot 12 in across and 10 in deep filled to 90 % holds π ÷ 4 × 144 × 10 × 0.9 = 1,017.9 in³, which is 16.68 litres or 0.59 ft³. One 1 ft³ bag is enough.',
    faq: [
      { question: 'How full should a pot be?', answer: 'About an inch below the rim, so that water has room to soak in and not run over the edge.' },
      { question: 'What about tapered pots?', answer: 'Enter the average of the top and bottom diameters for a good estimate.' },
      {
        question: 'Should I put gravel in the bottom?',
        answer: 'No. A layer of gravel raises the wet zone and does not improve drainage. Use a drainage hole and a good mix.',
      },
    ],
    scenarios: rows(
      ['diameter', 'depth', 'pots', 'fill', 'bag'],
      [
        [12, 10, 1, 90, 1],
        [12, 10, 5, 90, 1],
        [8, 7, 6, 90, 0.75],
        [16, 14, 2, 90, 2],
        [24, 20, 1, 85, 2],
        [6, 6, 20, 100, 1],
      ],
      (v) => `${v[2]} pot${v[2] === 1 ? '' : 's'} ${v[0]} in wide and ${v[1]} in deep, filled ${v[3]} %`,
    ),
    introOutputs: ['perPot', 'total'],
    relatedSlugs: ['raised-bed-soil-calculator', 'soil-calculator'],
    checks: [
      { inputs: {}, expect: { perPot: '16.68 L', total: '16.7 L', ft3: '0.59 ft³', bags: '1 bags' } },
      { inputs: { pots: 5 }, expect: { total: '83.4 L', ft3: '2.95 ft³', bags: '3 bags' } },
      { inputs: { diameter: 6, depth: 6, fill: 100 }, expect: { perPot: '2.78 L' } },
    ],
  },
  {
    slug: 'soil-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Soil Calculator: Volume and Weight of Topsoil or Fill',
    h1: 'Soil Calculator',
    metaDescription: 'Convert a bed or lawn area and depth into cubic yards and tons of topsoil, compost, sand or clay.',
    about:
      'Soil is sold by the cubic yard but delivered and priced by the ton, and the two differ because a cubic yard of dry compost weighs about half a ton while a cubic yard of wet clay can weigh a ton and a half. Enter the length and width of the area in feet, the depth you plan to spread in inches and the material, and the calculator gives the volume in cubic yards and the weight in short tons and kilograms. Typical weights are about 2,200 pounds per cubic yard for topsoil, 1,000 for compost, 2,700 for sand and 2,900 for clay, and they are guides only, because moisture changes the weight a great deal. Order by volume when the supplier allows, and ask for a weight ticket when you cannot. Spreading 4 inches of topsoil over a lawn of 20 by 10 feet takes about 2.5 cubic yards, which is what a small truck can carry. Rake it level and press it lightly so settling does not leave dips.',
    inputs: [
      field('length', 'Length (ft)', 20, 1, 1000),
      field('width', 'Width (ft)', 10, 1, 1000),
      field('depth', 'Depth (in)', 4, 0.5, 48),
      select('material', 'Material', 'topsoil', [
        ['topsoil', 'Topsoil (about 2,200 lb per yd³)'],
        ['compost', 'Compost (about 1,000 lb per yd³)'],
        ['sand', 'Sand (about 2,700 lb per yd³)'],
        ['clay', 'Clay (about 2,900 lb per yd³)'],
      ]),
    ],
    outputs: [
      { name: 'yd3', label: 'Volume', format: 'text', highlight: true },
      { name: 'tons', label: 'Weight in short tons', format: 'text' },
      { name: 'kg', label: 'Weight in kilograms', format: 'text' },
    ],
    calculate: (i) => {
      const yd3 = toD(i.length).mul(toD(i.width)).mul(toD(i.depth)).div(12).div(CU_FT_PER_CU_YD);
      const density = new D({ topsoil: '2200', compost: '1000', sand: '2700', clay: '2900' }[String(i.material)] ?? '2200');
      const lb = yd3.mul(density);
      return { yd3: `${fmtNumber(yd3, 2)} yd³`, tons: `${fmtNumber(lb.div(2000), 2)} tons`, kg: `${fmtNumber(lb.mul(KG_PER_LB), 0)} kg` };
    },
    formulaDescription: 'Volume (yd³) = length × width × depth ÷ 12 ÷ 27. Weight (lb) = volume × density. Tons = lb ÷ 2,000. Kilograms = lb × 0.4536.',
    workedExample:
      'A patch of 20 ft by 10 ft covered 4 in deep is 66.7 ft³, which is 2.47 yd³. As topsoil at 2,200 lb per yd³ it weighs 5,432 lb, which is 2.72 tons or 2,464 kg.',
    faq: [
      {
        question: 'Why does soil weight vary?',
        answer: 'Moisture and compaction change it. Wet topsoil can weigh 30 percent more than dry. Ask the supplier for the weight they use.',
      },
      {
        question: 'Do these tons mean metric tons?',
        answer: 'No. The tons are short tons of 2,000 pounds. The kilogram line gives the metric figure, and 1,000 kg is a metric ton.',
      },
      { question: 'How much will it settle?', answer: 'Loose soil settles about 10 to 15 percent. Order a little extra when levelling or filling a hole.' },
    ],
    scenarios: [
      withInputs('4 inches of topsoil over 20 ft by 10 ft', { length: 20, width: 10, depth: 4, material: 'topsoil' }),
      withInputs('2 inches of compost on a 30 ft by 15 ft bed', { length: 30, width: 15, depth: 2, material: 'compost' }),
      withInputs('A sand base of 12 ft by 12 ft, 3 inches deep', { length: 12, width: 12, depth: 3, material: 'sand' }),
      withInputs('Clay fill for a pit 8 ft by 6 ft and 10 inches deep', { length: 8, width: 6, depth: 10, material: 'clay' }),
      withInputs('6 inches of topsoil over a 50 ft by 40 ft lawn', { length: 50, width: 40, depth: 6, material: 'topsoil' }),
    ],
    introOutputs: ['yd3', 'tons'],
    relatedSlugs: ['raised-bed-soil-calculator', 'sod-calculator'],
    checks: [
      { inputs: {}, expect: { yd3: '2.47 yd³', tons: '2.72 tons', kg: '2,464 kg' } },
      { inputs: { material: 'sand' }, expect: { tons: '3.33 tons' } },
      { inputs: { material: 'compost' }, expect: { tons: '1.23 tons' } },
    ],
  },
  {
    slug: 'compost-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Compost Calculator: Carbon to Nitrogen Ratio of a Pile',
    h1: 'Compost Calculator',
    metaDescription: 'Mix two ingredients, such as dry leaves and grass clippings, and see the carbon to nitrogen ratio of the pile and whether it will heat.',
    about:
      'A compost pile heats and breaks down quickly when microbes get a diet of about 25 to 35 parts of carbon to one part of nitrogen. Too much carbon, from leaves, straw or sawdust, and the pile stays cold and slow. Too much nitrogen, from grass clippings, food scraps or manure, and it turns wet and smells of ammonia. This calculator blends two ingredients, one carbon-rich and one nitrogen-rich, and works out the ratio of the mix. For each, enter the weight, the percentage of nitrogen in the dry matter, the ratio of carbon to nitrogen in that ingredient and its moisture, since water adds weight but no food. Typical dry leaves are 0.9 percent nitrogen at a ratio of about 60 to 1 and 10 percent moisture, while fresh grass clippings are 3 percent at 17 to 1 and 80 percent moisture. Check the result against the target, then adjust the proportions, keep the pile as damp as a wrung sponge and turn it as it cools.',
    inputs: [
      field('w1', 'Carbon-rich material weight (lb)', 10, 0.1, 10000),
      field('n1', 'Its nitrogen (% of dry weight)', 0.9, 0.05, 10),
      field('r1', 'Its carbon to nitrogen ratio', 60, 20, 600),
      field('m1', 'Its moisture (%)', 10, 0, 95),
      field('w2', 'Nitrogen-rich material weight (lb)', 30, 0.1, 10000),
      field('n2', 'Its nitrogen (% of dry weight)', 3, 0.05, 10),
      field('r2', 'Its carbon to nitrogen ratio', 17, 5, 100),
      field('m2', 'Its moisture (%)', 80, 0, 95),
    ],
    outputs: [
      { name: 'ratio', label: 'Carbon to nitrogen ratio of the pile', format: 'text', highlight: true },
      { name: 'verdict', label: 'Reading', format: 'text' },
    ],
    calculate: (i) => {
      const n1 = toD(i.w1)
        .mul(new D(1).sub(toD(i.m1).div(100)))
        .mul(toD(i.n1))
        .div(100);
      const n2 = toD(i.w2)
        .mul(new D(1).sub(toD(i.m2).div(100)))
        .mul(toD(i.n2))
        .div(100);
      const ratio = n1
        .mul(toD(i.r1))
        .add(n2.mul(toD(i.r2)))
        .div(n1.add(n2));
      const verdict = ratio.lt(20)
        ? 'Too much nitrogen: add dry browns'
        : ratio.lt(25)
          ? 'Slightly nitrogen-rich: it will heat fast'
          : ratio.lte(35)
            ? 'In the target range of 25 to 35'
            : ratio.lte(50)
              ? 'Carbon-rich: it will rot slowly'
              : 'Far too much carbon: add greens';
      return { ratio: `${fmtNumber(ratio, 1)} : 1`, verdict };
    },
    formulaDescription:
      'Nitrogen in each material = weight × (1 − moisture) × nitrogen %. Carbon = nitrogen × its C:N ratio. Pile ratio = total carbon ÷ total nitrogen.',
    workedExample:
      '10 lb of dry leaves hold 0.081 lb of nitrogen and 4.86 lb of carbon. 30 lb of wet clippings hold 0.18 lb of nitrogen and 3.06 lb of carbon. The mix is 7.92 ÷ 0.261 = 30.3 to 1.',
    faq: [
      {
        question: 'Where do I find the figures?',
        answer: 'Extension services publish tables of nitrogen and C:N ratio for common materials. The defaults are typical values for leaves and clippings.',
      },
      { question: 'Why include moisture?', answer: 'Water adds weight but no nutrient. Wet materials carry less nitrogen per pound than dry ones.' },
      {
        question: 'Is the ratio the only thing that matters?',
        answer: 'No. Moisture, air and particle size matter as much. A pile that is wet and compacted rots without heat whatever its ratio.',
      },
    ],
    scenarios: [
      withInputs('Dry leaves with fresh grass clippings, 1 to 3 by weight', {}),
      withInputs('Mostly leaves with a little clippings', { w1: 30, w2: 10 }),
      withInputs('Mostly clippings with a few leaves', { w1: 5, w2: 40 }),
      withInputs('Equal weights of leaves and clippings', { w1: 10, w2: 10 }),
      withInputs('Wood chips with kitchen scraps', { w1: 20, n1: 0.5, r1: 100, m1: 10, w2: 10, n2: 2.5, r2: 15, m2: 70 }),
    ],
    introOutputs: ['ratio', 'verdict'],
    relatedSlugs: ['raised-bed-soil-calculator', 'mulch-calculator'],
    checks: [
      { inputs: {}, expect: { ratio: '30.3 : 1', verdict: 'In the target range of 25 to 35' } },
      { inputs: { w1: 5, w2: 40 }, expect: { ratio: '23.2 : 1', verdict: 'Slightly nitrogen-rich: it will heat fast' } },
      { inputs: { w1: 30, w2: 10 }, expect: { ratio: '51.5 : 1', verdict: 'Far too much carbon: add greens' } },
      { inputs: { w1: 20, n1: 0.5, r1: 100, m1: 10, w2: 10, n2: 2.5, r2: 15, m2: 70 }, expect: { ratio: '61.4 : 1' } },
    ],
  },
  {
    slug: 'fertilizer-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Gardening and crops',
    title: 'Fertilizer Calculator: Pounds of Product per Lawn or Bed',
    h1: 'Fertilizer Calculator',
    metaDescription: 'Work out how much fertilizer to spread from the area, the nitrogen rate you want and the nitrogen percentage on the bag.',
    about:
      'The big numbers on a fertilizer bag, such as 20-10-10, are the percentages of nitrogen, phosphate and potash, in that order. To feed a lawn or bed correctly you start from the amount of nitrogen you want to apply, which is normally between half a pound and one pound per 1,000 square feet in one application, and work back to the weight of product that supplies it. Enter the area, the nitrogen rate and the first number on the bag. The calculator multiplies the area, in thousands of square feet, by the rate to find the pounds of nitrogen, then divides by the nitrogen fraction to find the pounds of product, and counts the bags. Too much fertilizer burns turf and runs off into streams, so keep the rate at or under one pound per application, spread evenly with a calibrated spreader, sweep granules off paving and water them in. Soil tests tell you whether phosphorus is needed at all, since many lawns already hold plenty. Quick-release sources such as urea and ammonium sulfate colour turf within days but are spent in about a month, whereas polymer-coated and organic products release over two or three months, so a feeding calendar with slow-release granules may need only three passes a year, compared with five or six using quick-release.',
    inputs: [
      field('area', 'Area to feed (sq ft)', 5000, 100, 1000000),
      field('rate', 'Nitrogen rate (lb N per 1,000 sq ft)', 1, 0.1, 4),
      field('npct', 'Nitrogen on the bag (%)', 20, 1, 46),
      field('bag', 'Bag size (lb)', 25, 1, 100),
    ],
    outputs: [
      { name: 'n', label: 'Nitrogen to apply', format: 'text' },
      { name: 'product', label: 'Fertilizer to spread', format: 'text', highlight: true },
      { name: 'kg', label: 'In kilograms', format: 'text' },
      { name: 'bags', label: 'Bags to buy', format: 'text' },
    ],
    calculate: (i) => {
      const n = toD(i.area).div(1000).mul(toD(i.rate));
      const product = n.div(toD(i.npct).div(100));
      return {
        n: `${fmtNumber(n, 2)} lb`,
        product: `${fmtNumber(product, 1)} lb`,
        kg: `${fmtNumber(product.mul(KG_PER_LB), 1)} kg`,
        bags: `${fmtNumber(product.div(toD(i.bag)).ceil(), 0)} bags`,
      };
    },
    formulaDescription: 'Nitrogen (lb) = area ÷ 1,000 × rate. Product (lb) = nitrogen ÷ (nitrogen % ÷ 100). Bags = product ÷ bag size, rounded up.',
    workedExample:
      'A lawn of 5,000 sq ft at 1 lb of nitrogen per 1,000 sq ft needs 5 lb of nitrogen. A 20-10-10 fertilizer is 20 % nitrogen, so 5 ÷ 0.20 = 25 lb, which is 11.3 kg or one 25 lb bag.',
    faq: [
      {
        question: 'What are the three numbers on the bag?',
        answer: 'The percentages by weight of nitrogen (N), phosphate (P2O5) and potash (K2O), in that order.',
      },
      {
        question: 'How much nitrogen is safe at once?',
        answer: 'Up to about 1 lb per 1,000 sq ft for quick-release products, and a little more for slow-release. More burns the grass.',
      },
      {
        question: 'Does this tell me how much phosphorus to add?',
        answer: 'No. It sizes the nitrogen only. Use a soil test before adding phosphorus, since many soils need none.',
      },
    ],
    scenarios: rows(
      ['area', 'rate', 'npct', 'bag'],
      [
        [5000, 1, 20, 25],
        [12000, 1, 32, 25],
        [2000, 0.75, 10, 40],
        [800, 0.5, 12, 20],
        [20000, 1, 28, 50],
        [3000, 0.8, 16, 25],
      ],
      (v) => `${v[0]} sq ft at ${v[1]} lb N per 1,000 sq ft with a ${v[2]} % N fertilizer`,
    ),
    introOutputs: ['n', 'product'],
    relatedSlugs: ['water-soluble-fertilizer-calculator', 'grass-seed-calculator'],
    checks: [
      { inputs: {}, expect: { n: '5 lb', product: '25 lb', kg: '11.3 kg', bags: '1 bags' } },
      { inputs: { area: 12000, npct: 32 }, expect: { n: '12 lb', product: '37.5 lb', bags: '2 bags' } },
      { inputs: { area: 2000, rate: 0.75, npct: 10 }, expect: { product: '15 lb' } },
    ],
  },
  {
    slug: 'water-soluble-fertilizer-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Water Soluble Fertilizer Calculator: ppm and Grams per Litre',
    h1: 'Water Soluble Fertilizer Calculator',
    metaDescription: 'Find the grams of soluble fertilizer to dissolve in a tank to reach a target nitrogen concentration in ppm.',
    about:
      'Greenhouse growers, hydroponic gardeners and nursery managers feed plants through the irrigation water, and they set the strength in parts per million, or ppm, of nitrogen. A feed of 100 ppm is mild and used for seedlings and houseplants, 150 to 200 ppm suits most crops in active growth, and 250 or more is for heavy feeders in a fast-draining mix. Water-soluble fertilizer is labelled with its analysis, such as 20-10-20, whose first number is the percentage of nitrogen by weight. Since one gram of a 20 percent product dissolved in one litre gives 200 ppm of nitrogen, the grams per litre are the target ppm divided by 10 times the nitrogen percentage. Enter the target, the nitrogen percentage on the bag and the volume of the tank in litres. You will receive the grams per litre, the grams to weigh out for the tank and the ounces per US gallon. Measure the electrical conductivity of the solution as a check, and flush the pots now and again to remove accumulated salts.',
    inputs: [
      field('ppm', 'Target nitrogen (ppm)', 150, 10, 500),
      field('npct', 'Nitrogen on the bag (%)', 20, 1, 46),
      field('litres', 'Tank volume (litres)', 20, 0.5, 5000),
    ],
    outputs: [
      { name: 'perL', label: 'Fertilizer per litre', format: 'text', highlight: true },
      { name: 'total', label: 'Fertilizer for the tank', format: 'text' },
      { name: 'oz', label: 'Per US gallon', format: 'text' },
    ],
    calculate: (i) => {
      const perL = toD(i.ppm).div(toD(i.npct).mul(10));
      return {
        perL: `${fmtNumber(perL, 2)} g/L`,
        total: `${fmtNumber(perL.mul(toD(i.litres)), 1)} g`,
        oz: `${fmtNumber(perL.mul(GALLON_LITRES).div(GRAMS_PER_OZ), 3)} oz`,
      };
    },
    formulaDescription:
      'Grams per litre = target ppm of N ÷ (N % × 10). Grams for the tank = grams per litre × litres. Ounces per US gallon = g/L × 3.785 ÷ 28.35.',
    workedExample: 'To reach 150 ppm N with a 20-10-20 fertilizer: 150 ÷ (20 × 10) = 0.75 g/L. A 20 litre tank takes 15 g, which is 0.1 oz per US gallon.',
    faq: [
      {
        question: 'What does ppm of nitrogen mean?',
        answer: 'It is milligrams of nitrogen per litre of water. A 150 ppm feed carries 150 mg of nitrogen in each litre.',
      },
      {
        question: 'Does the other nutrient content matter?',
        answer: 'It rises in proportion. A 20-10-20 at 150 ppm N also gives 75 ppm of phosphate and 150 ppm of potash.',
      },
      {
        question: 'Should I measure electrical conductivity?',
        answer: 'Yes. It confirms the strength of the solution and shows when salts accumulate in the pots.',
      },
    ],
    scenarios: rows(
      ['ppm', 'npct', 'litres'],
      [
        [150, 20, 20],
        [100, 15, 50],
        [200, 20, 10],
        [75, 24, 100],
        [250, 15, 5],
        [125, 10, 200],
      ],
      (v) => `${v[0]} ppm N from a ${v[1]} % N fertilizer in ${v[2]} litres`,
    ),
    introOutputs: ['perL', 'total'],
    relatedSlugs: ['fertilizer-calculator', 'vpd-calculator'],
    checks: [
      { inputs: {}, expect: { perL: '0.75 g/L', total: '15 g', oz: '0.1 oz' } },
      { inputs: { ppm: 100, npct: 15, litres: 50 }, expect: { perL: '0.67 g/L', total: '33.3 g' } },
      { inputs: { ppm: 200, litres: 10 }, expect: { perL: '1 g/L', total: '10 g' } },
    ],
  },
  {
    slug: 'co2-grow-room-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'CO2 Grow Room Calculator: Carbon Dioxide to Enrich a Room',
    h1: 'CO2 Grow Room Calculator',
    metaDescription: 'Work out the carbon dioxide needed to raise a sealed grow room from ambient to a target ppm, and the amount to hold it per hour.',
    about:
      'Plants under strong light can use more carbon dioxide than ordinary air provides, which is about 420 parts per million. Growers of tomatoes, cucumbers, peppers and other greenhouse and indoor crops therefore raise the level to 800 to 1,500 ppm in a sealed room and gain faster growth, provided light, water and nutrients are not limiting. This calculator sizes the dose. Enter the room length, width and height in feet, the ambient level, the target level and the number of times per hour that the room air is exchanged with outside, through leaks, vents or fans. It reports the room volume, the carbon dioxide gas to add to reach the target from a standing start, and the amount needed each hour to hold it against the air exchange, in cubic feet and in grams. The gas density used is 1.842 kilograms per cubic metre at room temperature. Enrich only while the lights are on, never in a space where people sleep, and use a monitor with an alarm, since CO2 above 5,000 ppm is unsafe for long exposure.',
    inputs: [
      field('length', 'Room length (ft)', 10, 2, 200),
      field('width', 'Room width (ft)', 10, 2, 200),
      field('height', 'Room height (ft)', 8, 4, 30),
      field('ambient', 'Ambient CO2 (ppm)', 400, 300, 600),
      field('target', 'Target CO2 (ppm)', 1200, 500, 2000),
      field('exchange', 'Air exchanges per hour', 2, 0, 60),
    ],
    outputs: [
      { name: 'volume', label: 'Room volume', format: 'text' },
      { name: 'dose', label: 'CO2 to reach the target', format: 'text', highlight: true },
      { name: 'hold', label: 'CO2 per hour to hold it', format: 'text' },
    ],
    calculate: (i) => {
      const volume = toD(i.length).mul(toD(i.width)).mul(toD(i.height));
      const rise = toD(i.target).sub(toD(i.ambient)).div(1000000);
      const dose = rise.lt(0) ? new D(0) : volume.mul(rise);
      const hold = dose.mul(toD(i.exchange));
      const grams = (ft3: Dec) => ft3.mul(LITRES_PER_CU_FT).div(1000).mul('1842');
      return {
        volume: `${fmtNumber(volume, 0)} ft³`,
        dose: `${fmtNumber(dose, 2)} ft³ (${fmtNumber(grams(dose), 1)} g)`,
        hold: `${fmtNumber(hold, 2)} ft³ (${fmtNumber(grams(hold), 1)} g)`,
      };
    },
    formulaDescription:
      'Volume = length × width × height. CO2 gas (ft³) = volume × (target − ambient) ÷ 1,000,000. Hourly hold = dose × air exchanges per hour. Mass = volume × 1.842 kg per m³.',
    workedExample:
      'A room of 10 × 10 × 8 ft is 800 ft³. Raising it by 800 ppm needs 800 × 800 ÷ 1,000,000 = 0.64 ft³ of CO2, about 33.4 g. With 2 air changes an hour, holding it takes 1.28 ft³, or 66.8 g.',
    faq: [
      {
        question: 'Is a higher level always better?',
        answer: 'No. Gains flatten near 1,200 to 1,500 ppm, and the cost and the safety risk rise. Light and nutrients must keep up.',
      },
      {
        question: 'Why is the hourly figure larger for a leaky room?',
        answer: 'Each air exchange swaps enriched air for ambient air, so the dose must be replaced every time.',
      },
      {
        question: 'Is it safe to work in an enriched room?',
        answer: 'Brief entry at 1,500 ppm is tolerated, but use a monitor with an alarm and ventilate the room before staying.',
      },
    ],
    scenarios: rows(
      ['length', 'width', 'height', 'ambient', 'target', 'exchange'],
      [
        [10, 10, 8, 400, 1200, 2],
        [4, 4, 7, 400, 1000, 1],
        [20, 12, 9, 420, 1300, 3],
        [8, 8, 8, 400, 1500, 0.5],
        [30, 20, 10, 400, 1000, 4],
        [5, 5, 8, 450, 900, 2],
      ],
      (v) => `A room ${v[0]} × ${v[1]} × ${v[2]} ft raised from ${v[3]} to ${v[4]} ppm`,
    ),
    introOutputs: ['dose', 'hold'],
    relatedSlugs: ['vpd-calculator', 'daily-light-integral-calculator'],
    checks: [
      { inputs: {}, expect: { volume: '800 ft³', dose: '0.64 ft³ (33.4 g)', hold: '1.28 ft³ (66.8 g)' } },
      { inputs: { exchange: 0 }, expect: { hold: '0 ft³ (0 g)' } },
      { inputs: { target: 300 }, expect: { dose: '0 ft³ (0 g)' } },
    ],
  },
  {
    slug: 'water-potential-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Water Potential Calculator: Solute and Pressure Potential',
    h1: 'Water Potential Calculator',
    metaDescription: 'Calculate the solute potential and the total water potential of a plant cell or solution from concentration, temperature and pressure.',
    about:
      'Water potential, written with the Greek letter psi, is the quantity that tells you which way water will move through a plant or between a cell and its surroundings. Water always flows from a higher potential to a lower one, and pure water at atmospheric pressure is defined as zero. Dissolved solutes lower the potential, which is why a salty soil can pull water out of a root, and pressure in a firm, swollen cell raises it. Biology courses split the total into two parts: the solute potential, equal to minus the ionisation constant times the molar concentration times the gas constant and the absolute temperature, and the pressure potential, which is zero in an open beaker but positive in a turgid plant cell and negative in a stressed xylem. Enter the molar concentration, the ionisation constant, which is 1 for sucrose and 2 for sodium chloride, the temperature and the pressure potential in megapascals. The result is also given in bars, where one megapascal equals ten bars. Use it to predict whether a cell will gain or lose water when placed in a solution.',
    inputs: [
      field('conc', 'Solute concentration (mol/L)', 0.3, 0, 5),
      field('ion', 'Ionisation constant (i)', 1, 1, 3),
      field('temp', 'Temperature (°C)', 25, 0, 60),
      field('pressure', 'Pressure potential (MPa)', 0, -3, 3),
    ],
    outputs: [
      { name: 'solute', label: 'Solute potential', format: 'text' },
      { name: 'total', label: 'Water potential', format: 'text', highlight: true },
      { name: 'bar', label: 'Water potential in bars', format: 'text' },
    ],
    calculate: (i) => {
      const r = new D('0.008314462618');
      const solute = toD(i.ion).mul(toD(i.conc)).mul(r).mul(toD(i.temp).add('273.15')).neg();
      const total = solute.add(toD(i.pressure));
      return { solute: `${fmtNumber(solute, 3)} MPa`, total: `${fmtNumber(total, 3)} MPa`, bar: `${fmtNumber(total.mul(10), 2)} bar` };
    },
    formulaDescription:
      'Solute potential Ψs = −i × C × R × T, with R = 0.008314 L·MPa per mol per K and T in kelvin. Water potential Ψ = Ψs + Ψp. One MPa = 10 bar.',
    workedExample:
      'A 0.3 mol/L sucrose solution at 25 °C (298.15 K) with i = 1: Ψs = −1 × 0.3 × 0.008314 × 298.15 = −0.744 MPa. In an open beaker Ψp = 0, so Ψ = −0.744 MPa, or −7.44 bar.',
    faq: [
      {
        question: 'What is the ionisation constant?',
        answer: 'The number of particles a solute splits into. It is 1 for sucrose or glucose and about 2 for sodium chloride, which gives Na and Cl ions.',
      },
      {
        question: 'Which way does water move?',
        answer: 'From the higher (less negative) water potential to the lower (more negative). A cell at −0.5 MPa loses water to a solution at −1 MPa.',
      },
      {
        question: 'What is pressure potential in a plant cell?',
        answer: 'The turgor pressure pushing on the cell wall. It is positive in a firm cell and falls to zero when the cell wilts.',
      },
    ],
    scenarios: rows(
      ['conc', 'ion', 'temp', 'pressure'],
      [
        [0.3, 1, 25, 0],
        [0.1, 2, 20, 0],
        [0.1, 2, 20, 0.5],
        [0.5, 1, 25, 0.4],
        [0.2, 1, 30, 0],
        [0.15, 2, 15, 0.2],
      ],
      (v) => `${v[0]} mol/L with i = ${v[1]} at ${v[2]} °C and Ψp ${v[3]} MPa`,
    ),
    introOutputs: ['solute', 'total'],
    relatedSlugs: ['vpd-calculator', 'daily-light-integral-calculator'],
    checks: [
      { inputs: {}, expect: { solute: '-0.744 MPa', total: '-0.744 MPa', bar: '-7.44 bar' } },
      { inputs: { conc: 0.1, ion: 2, temp: 20 }, expect: { solute: '-0.487 MPa' } },
      { inputs: { conc: 0.1, ion: 2, temp: 20, pressure: 0.5 }, expect: { total: '0.013 MPa' } },
    ],
  },
  {
    slug: 'corn-yield-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Corn Yield Calculator: Bushels per Acre from Ear Counts',
    h1: 'Corn Yield Calculator',
    metaDescription: 'Estimate corn yield in bushels per acre from the plants, kernel rows and kernels per row, with the field total and tonnes per hectare.',
    about:
      'Weeks before the combine rolls, a farmer can estimate how well a crop will do by counting. This is the yield component method that extension services teach: the number of ears per acre multiplied by the kernels on each ear, divided by the number of kernels in a bushel. Count the harvestable ears in a length of row equal to one thousandth of an acre, which is 17 feet 5 inches for 30-inch rows, convert to ears per acre, then shell a few typical ears to count the kernel rows around the cob and the kernels along one row. Multiply the two to get kernels per ear. Enter those figures and the kernel count per bushel, which is taken as 90,000 for an average kernel and as 80,000 for large kernels in a good year. The calculator gives bushels per acre, the total for the field and the equivalent in tonnes per hectare. Take counts in several places and average them, since a single spot can mislead, and expect the real yield to differ by 10 to 15 percent, because kernel size changes with weather late in grain fill.',
    inputs: [
      field('ears', 'Harvestable ears per acre', 34000, 5000, 60000),
      field('rowsCount', 'Kernel rows per ear', 16, 8, 24),
      field('perRow', 'Kernels per row', 36, 10, 50),
      field('perBushel', 'Kernels per bushel', 90000, 60000, 120000),
      field('acres', 'Field size (acres)', 80, 1, 10000),
    ],
    outputs: [
      { name: 'yield', label: 'Estimated yield', format: 'text', highlight: true },
      { name: 'total', label: 'Total for the field', format: 'text' },
      { name: 'tha', label: 'In tonnes per hectare', format: 'text' },
    ],
    calculate: (i) => {
      const yieldBu = toD(i.ears).mul(toD(i.rowsCount)).mul(toD(i.perRow)).div(toD(i.perBushel));
      const tonnesPerHa = yieldBu.mul(56).mul(KG_PER_LB).div(HECTARES_PER_ACRE).div(1000);
      return { yield: `${fmtNumber(yieldBu, 1)} bu/acre`, total: `${fmtNumber(yieldBu.mul(toD(i.acres)), 0)} bu`, tha: `${fmtNumber(tonnesPerHa, 2)} t/ha` };
    },
    formulaDescription:
      'Yield (bu/acre) = ears per acre × kernel rows × kernels per row ÷ kernels per bushel. Tonnes per hectare = bu/acre × 56 lb × 0.4536 ÷ 0.4047 ÷ 1,000.',
    workedExample:
      '34,000 ears per acre with 16 rows of 36 kernels have 576 kernels per ear. 34,000 × 576 ÷ 90,000 = 217.6 bu/acre. An 80-acre field gives 17,408 bushels, or 13.66 t/ha.',
    faq: [
      {
        question: 'Which kernel count per bushel should I use?',
        answer: 'Use 90,000 as a default, 80,000 for a year with large kernels and 100,000 for a year with small kernels after drought.',
      },
      {
        question: 'How do I count ears per acre?',
        answer: 'Count the ears in one thousandth of an acre of row, 17 ft 5 in at 30-inch rows, and multiply by 1,000. Repeat in several places.',
      },
      {
        question: 'How close is the estimate?',
        answer: 'Typically within 10 to 15 percent of the harvested yield. Weather after the count changes kernel weight.',
      },
    ],
    scenarios: rows(
      ['ears', 'rowsCount', 'perRow', 'perBushel', 'acres'],
      [
        [34000, 16, 36, 90000, 80],
        [32000, 18, 38, 85000, 120],
        [28000, 14, 30, 90000, 50],
        [36000, 16, 40, 80000, 160],
        [30000, 16, 32, 100000, 40],
        [35000, 18, 34, 90000, 200],
      ],
      (v) => `${v[0]} ears per acre, ${v[1]} rows of ${v[2]} kernels, ${v[3]} kernels per bushel`,
    ),
    introOutputs: ['yield', 'tha'],
    relatedSlugs: ['gdu-calculator', 'plant-population-calculator'],
    checks: [
      { inputs: {}, expect: { yield: '217.6 bu/acre', total: '17,408 bu', tha: '13.66 t/ha' } },
      { inputs: { perBushel: 80000 }, expect: { yield: '244.8 bu/acre' } },
      { inputs: { ears: 28000, rowsCount: 14, perRow: 30, acres: 50 }, expect: { yield: '130.7 bu/acre', total: '6,533 bu' } },
    ],
  },
  {
    slug: 'vegetable-yield-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Vegetable Yield Calculator: Harvest per Plant and per Bed',
    h1: 'Vegetable Yield Calculator',
    metaDescription: 'Estimate the total harvest of a vegetable bed from plant count and yield per plant, and how many plants you need for a target.',
    about:
      'Home gardeners and market growers often ask two questions: how much will this bed give me, and how many plants do I need to grow what the family eats. Both come from the average yield per plant, which depends on the crop and on your growing conditions. Typical figures are 5 to 10 pounds for a tomato plant, 3 to 5 for a pepper, 1 to 2 for a zucchini plant that is not at its peak, and about 1 pound per plant for a head of lettuce or cabbage. Enter the number of plants, the yield per plant you expect and an allowance for losses to pests, disease, weather and culls. The calculator returns the harvest in pounds and kilograms and the yield per square foot of bed. Enter a target and it also works out the plants you need once losses are counted, rounded up. Keep a record of what each crop gave you over two or three seasons and replace the default figure with your own average for better planning.',
    inputs: [
      field('plants', 'Number of plants', 24, 1, 10000),
      field('each', 'Expected yield per plant (lb)', 6, 0.1, 100),
      field('loss', 'Losses and culls (%)', 10, 0, 90),
      field('area', 'Bed area (sq ft)', 32, 1, 100000),
      field('target', 'Target harvest (lb)', 100, 1, 100000),
    ],
    outputs: [
      { name: 'lb', label: 'Expected harvest', format: 'text', highlight: true },
      { name: 'kg', label: 'In kilograms', format: 'text' },
      { name: 'perSqFt', label: 'Yield per square foot', format: 'text' },
      { name: 'need', label: 'Plants needed for the target', format: 'text' },
    ],
    calculate: (i) => {
      const keep = new D(1).sub(toD(i.loss).div(100));
      const perPlant = toD(i.each).mul(keep);
      const lb = toD(i.plants).mul(perPlant);
      return {
        lb: `${fmtNumber(lb, 1)} lb`,
        kg: `${fmtNumber(lb.mul(KG_PER_LB), 1)} kg`,
        perSqFt: `${fmtNumber(lb.div(toD(i.area)), 2)} lb/sq ft`,
        need: `${fmtNumber(toD(i.target).div(perPlant).ceil(), 0)} plants`,
      };
    },
    formulaDescription:
      'Harvest = plants × yield per plant × (1 − losses ÷ 100). Yield per sq ft = harvest ÷ area. Plants needed = target ÷ (yield per plant × (1 − losses ÷ 100)), rounded up.',
    workedExample:
      '24 plants giving 6 lb each with 10 % losses harvest 24 × 6 × 0.9 = 129.6 lb, which is 58.8 kg, or 4.05 lb per sq ft on 32 sq ft. To reach 100 lb you need 100 ÷ 5.4 = 18.5, so 19 plants.',
    faq: [
      {
        question: 'What yield per plant is realistic?',
        answer: 'It varies widely. Use your own records, or ask your local extension service for typical yields in your region.',
      },
      { question: 'Why include losses?', answer: 'Not everything that grows reaches the table. Pests, splits, rot and small fruit reduce the usable harvest.' },
      {
        question: 'Does succession planting change the answer?',
        answer: 'Yes. Count each planting as plants, and the area as the bed area used in the season, to get a seasonal yield per square foot.',
      },
    ],
    scenarios: rows(
      ['plants', 'each', 'loss', 'area', 'target'],
      [
        [24, 6, 10, 32, 100],
        [10, 8, 15, 40, 60],
        [12, 4, 20, 24, 30],
        [48, 1, 5, 24, 40],
        [6, 2, 0, 16, 20],
        [30, 7, 12, 64, 150],
      ],
      (v) => `${v[0]} plants at ${v[1]} lb each with ${v[2]} % lost`,
    ),
    introOutputs: ['lb', 'need'],
    relatedSlugs: ['plant-spacing-calculator', 'vegetable-seed-calculator'],
    checks: [
      { inputs: {}, expect: { lb: '129.6 lb', kg: '58.8 kg', perSqFt: '4.05 lb/sq ft', need: '19 plants' } },
      { inputs: { plants: 10, each: 2, loss: 0, target: 50 }, expect: { lb: '20 lb', need: '25 plants' } },
      { inputs: { loss: 50 }, expect: { lb: '72 lb', need: '34 plants' } },
    ],
  },
  {
    slug: 'grain-conversion-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Gardening and crops',
    title: 'Grain Conversion Calculator: Bushels to Pounds and Tonnes',
    h1: 'Grain Conversion Calculator',
    metaDescription: 'Convert bushels of corn, wheat, soybeans, barley, oats or rye into pounds, short tons and metric tonnes using standard test weights.',
    about:
      'A bushel is a measure of volume that grain buyers have turned into a weight, and the weight depends on the crop. A bushel of corn is 56 pounds, wheat and soybeans 60, barley 48 and oats 32, because the grains pack differently, and prices, yields and export figures in the United States are all quoted in bushels while shipping, storage and trade elsewhere use tonnes. Pick the crop, enter the bushels, and the calculator gives the weight in pounds, in short tons of 2,000 pounds and in metric tonnes of 1,000 kilograms, and the number of bushels in a metric tonne, which is the figure used to convert a world price. The standard weights apply to grain at its standard moisture, such as 15 percent for corn, and to a clean sample; wetter or dirtier grain weighs more per bushel, so the elevator will adjust the figure. Use the page to turn a yield per acre into tonnes per acre, to check a truck load against the scale ticket, or to convert export statistics.',
    inputs: [
      select('crop', 'Crop', 'corn', [
        ['corn', 'Corn (56 lb per bushel)'],
        ['wheat', 'Wheat (60 lb)'],
        ['soybeans', 'Soybeans (60 lb)'],
        ['barley', 'Barley (48 lb)'],
        ['oats', 'Oats (32 lb)'],
        ['rye', 'Rye (56 lb)'],
      ]),
      field('bushels', 'Amount (bushels)', 1000, 1, 100000000),
    ],
    outputs: [
      { name: 'lb', label: 'Weight in pounds', format: 'text' },
      { name: 'tons', label: 'Short tons', format: 'text' },
      { name: 'tonnes', label: 'Metric tonnes', format: 'text', highlight: true },
      { name: 'perTonne', label: 'Bushels in one tonne', format: 'text' },
    ],
    calculate: (i) => {
      const lbPerBu = new D({ corn: '56', wheat: '60', soybeans: '60', barley: '48', oats: '32', rye: '56' }[String(i.crop)] ?? '56');
      const lb = toD(i.bushels).mul(lbPerBu);
      return {
        lb: `${fmtNumber(lb, 0)} lb`,
        tons: `${fmtNumber(lb.div(2000), 2)} tons`,
        tonnes: `${fmtNumber(lb.mul(KG_PER_LB).div(1000), 2)} t`,
        perTonne: `${fmtNumber(new D(1000).div(lbPerBu.mul(KG_PER_LB)), 2)} bu`,
      };
    },
    formulaDescription:
      'Pounds = bushels × test weight (corn 56, wheat 60, soybeans 60, barley 48, oats 32, rye 56). Short tons = lb ÷ 2,000. Tonnes = lb × 0.4536 ÷ 1,000.',
    workedExample:
      '1,000 bushels of corn weigh 1,000 × 56 = 56,000 lb, which is 28 short tons or 25.4 metric tonnes. One metric tonne of corn is 39.37 bushels.',
    faq: [
      {
        question: 'Are these test weights fixed?',
        answer: 'They are the legal standard weights in the United States for dry, clean grain. Moisture and foreign matter change the real weight.',
      },
      {
        question: 'What is the difference between a ton and a tonne?',
        answer: 'A short ton is 2,000 pounds and a metric tonne is 1,000 kg, about 2,204.6 pounds. World grain trade uses tonnes.',
      },
      { question: 'Can I convert a yield per acre?', answer: 'Yes. Enter the bu/acre figure as the amount to get lb or tonnes per acre.' },
    ],
    scenarios: [
      withInputs('1,000 bushels of corn', { crop: 'corn', bushels: 1000 }),
      withInputs('1,000 bushels of wheat', { crop: 'wheat', bushels: 1000 }),
      withInputs('5,000 bushels of oats', { crop: 'oats', bushels: 5000 }),
      withInputs('A soybean yield of 55 bushels per acre', { crop: 'soybeans', bushels: 55 }),
      withInputs('A 40,000 bushel bin of barley', { crop: 'barley', bushels: 40000 }),
    ],
    introOutputs: ['lb', 'tonnes'],
    relatedSlugs: ['corn-yield-calculator', 'grain-bin-calculator'],
    checks: [
      { inputs: {}, expect: { lb: '56,000 lb', tons: '28 tons', tonnes: '25.4 t', perTonne: '39.37 bu' } },
      { inputs: { crop: 'wheat' }, expect: { lb: '60,000 lb', tons: '30 tons', tonnes: '27.22 t' } },
      { inputs: { crop: 'oats', bushels: 5000 }, expect: { lb: '160,000 lb', tonnes: '72.57 t' } },
    ],
  },
  {
    slug: 'acres-per-hour-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Acres per Hour Calculator: Field Capacity of Farm Machines',
    h1: 'Acres per Hour Calculator',
    metaDescription:
      'Work out how many acres per hour a planter, sprayer or mower covers from its working width, speed and field efficiency, and the hours for a field.',
    about:
      'Field capacity is how much ground a machine covers in an hour, and it decides how many days a job such as planting, spraying or baling takes and whether a bigger machine would pay. The theoretical capacity is the working width in feet times the speed in miles per hour, divided by 8.25, because 8.25 is how many of those units fit in one acre per hour. No machine works at that rate, since time goes to turning on the headlands, refilling the tank or hopper, overlap and unloading. The ratio of the real rate to the theoretical rate is the field efficiency, which is 80 to 90 percent for a sprayer or planter on big square fields, near 70 for tillage and lower for small, oddly shaped fields. Enter the working width, the speed, the efficiency and the area of the field. You will see the acres per hour, the hectares per hour and the hours to finish, so that you can set against the weather window you expect.',
    inputs: [
      field('width', 'Working width (ft)', 40, 1, 200),
      field('speed', 'Speed (mph)', 6, 0.5, 25),
      field('eff', 'Field efficiency (%)', 80, 30, 100),
      field('acres', 'Field size (acres)', 160, 1, 100000),
    ],
    outputs: [
      { name: 'ac', label: 'Acres per hour', format: 'text', highlight: true },
      { name: 'ha', label: 'Hectares per hour', format: 'text' },
      { name: 'hours', label: 'Hours to cover the field', format: 'text' },
    ],
    calculate: (i) => {
      const ac = toD(i.width).mul(toD(i.speed)).mul(toD(i.eff).div(100)).div('8.25');
      return { ac: `${fmtNumber(ac, 2)} ac/h`, ha: `${fmtNumber(ac.mul(HECTARES_PER_ACRE), 2)} ha/h`, hours: `${fmtNumber(toD(i.acres).div(ac), 1)} h` };
    },
    formulaDescription:
      'Acres per hour = width (ft) × speed (mph) × efficiency ÷ 8.25. Hectares per hour = acres per hour × 0.4047. Hours = field acres ÷ acres per hour.',
    workedExample:
      'A 40 ft implement at 6 mph and 80 % efficiency covers 40 × 6 × 0.8 ÷ 8.25 = 23.27 acres an hour, or 9.42 ha/h. A 160-acre field takes 6.9 hours.',
    faq: [
      {
        question: 'What efficiency should I use?',
        answer: 'About 85 percent for a sprayer on a large square field, 75 to 80 for a planter or drill, 65 to 75 for tillage, less for small fields.',
      },
      {
        question: 'Why 8.25?',
        answer: 'One acre is 43,560 sq ft and a mile is 5,280 ft, so 1 ft of width at 1 mph covers 5,280 sq ft an hour, which is 1 ÷ 8.25 of an acre.',
      },
      { question: 'Does it include refilling time?', answer: 'Yes, through the efficiency figure. Lower it if you stop often to refill or empty the tank.' },
    ],
    scenarios: rows(
      ['width', 'speed', 'eff', 'acres'],
      [
        [40, 6, 80, 160],
        [60, 5, 85, 320],
        [12, 5, 75, 40],
        [90, 12, 85, 640],
        [30, 4, 70, 80],
        [20, 7, 80, 100],
      ],
      (v) => `A ${v[0]} ft machine at ${v[1]} mph and ${v[2]} % efficiency on ${v[3]} acres`,
    ),
    introOutputs: ['ac', 'hours'],
    relatedSlugs: ['cattle-per-acre-calculator', 'corn-yield-calculator'],
    checks: [
      { inputs: {}, expect: { ac: '23.27 ac/h', ha: '9.42 ha/h', hours: '6.9 h' } },
      { inputs: { width: 60, speed: 5, eff: 85 }, expect: { ac: '30.91 ac/h' } },
      { inputs: { width: 12, speed: 5, eff: 75, acres: 40 }, expect: { ac: '5.45 ac/h', hours: '7.3 h' } },
    ],
  },
  {
    slug: 'vegetable-seed-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Gardening and crops',
    title: 'Vegetable Seed Calculator: Seeds and Packets for a Row',
    h1: 'Vegetable Seed Calculator',
    metaDescription: 'Find how many seeds to sow along a garden row, how many seedlings to expect from the germination rate, and how many packets to buy.',
    about:
      'Seed packets list the number of seeds they contain, and gardeners usually buy either too few or far too many. To order sensibly, work from the length of the row and the spacing at which you want the plants to stand. Enter the row length in feet, the spacing between plants in inches and the number of seeds you sow in each spot. Sowing two or three seeds per spot, and thinning to the strongest, is a safe habit for slow or patchy crops like carrots, parsnips and beets, while large seeds such as beans and peas are usually sown singly. Also enter the germination rate, which is on the packet or found by sprouting ten seeds on a damp paper towel, and the number of seeds in a packet. The calculator returns the number of planting spots, the seeds you will sow, the seedlings you should expect, and the packets to buy, rounded up. Old seed loses vigour, so enter a lower germination rate for seed more than two years old.',
    inputs: [
      field('length', 'Row length (ft)', 100, 1, 5000),
      field('spacing', 'Plant spacing (in)', 6, 1, 60),
      field('perSpot', 'Seeds per spot', 2, 1, 5),
      field('germ', 'Germination (%)', 85, 20, 100),
      field('packet', 'Seeds per packet', 200, 5, 10000),
    ],
    outputs: [
      { name: 'spots', label: 'Plant spots in the row', format: 'text' },
      { name: 'seeds', label: 'Seeds to sow', format: 'text', highlight: true },
      { name: 'seedlings', label: 'Seedlings to expect', format: 'text' },
      { name: 'packets', label: 'Packets to buy', format: 'text' },
    ],
    calculate: (i) => {
      const spots = toD(i.length).mul(12).div(toD(i.spacing)).floor();
      const seeds = spots.mul(toD(i.perSpot));
      return {
        spots: fmtNumber(spots, 0),
        seeds: fmtNumber(seeds, 0),
        seedlings: fmtNumber(seeds.mul(toD(i.germ).div(100)).floor(), 0),
        packets: `${fmtNumber(seeds.div(toD(i.packet)).ceil(), 0)} packets`,
      };
    },
    formulaDescription:
      'Spots = row length × 12 ÷ spacing, rounded down. Seeds = spots × seeds per spot. Seedlings = seeds × germination, rounded down. Packets = seeds ÷ seeds per packet, rounded up.',
    workedExample:
      'A row of 100 ft with plants 6 in apart has 100 × 12 ÷ 6 = 200 spots. Two seeds per spot is 400 seeds, of which 85 % (340) should come up, enough to thin to 200. That is 2 packets of 200.',
    faq: [
      {
        question: 'How do I test germination at home?',
        answer: 'Put ten seeds in a damp paper towel in a bag for a week or two and count the sprouts. Seven sprouts mean 70 percent.',
      },
      {
        question: 'Should I always sow more than one seed per spot?',
        answer: 'For small or slow seeds, yes, then thin to one. Large seeds such as beans and peas go in one at a time.',
      },
      {
        question: 'Does old seed still grow?',
        answer: 'Often, but the rate falls with age and poor storage. Use a lower germination figure for seed older than two years.',
      },
    ],
    scenarios: rows(
      ['length', 'spacing', 'perSpot', 'germ', 'packet'],
      [
        [100, 6, 2, 85, 200],
        [50, 3, 3, 70, 500],
        [30, 12, 1, 90, 25],
        [200, 4, 2, 80, 1000],
        [20, 18, 2, 95, 30],
        [40, 2, 3, 75, 300],
      ],
      (v) => `A ${v[0]} ft row, ${v[1]} in apart, ${v[2]} seeds per spot at ${v[3]} % germination`,
    ),
    introOutputs: ['spots', 'seeds'],
    relatedSlugs: ['vegetable-yield-calculator', 'plant-spacing-calculator'],
    checks: [
      { inputs: {}, expect: { spots: '200', seeds: '400', seedlings: '340', packets: '2 packets' } },
      { inputs: { perSpot: 1, packet: 25 }, expect: { seeds: '200', packets: '8 packets' } },
      { inputs: { length: 30, spacing: 12, perSpot: 1, germ: 90, packet: 25 }, expect: { spots: '30', seedlings: '27' } },
    ],
  },
  {
    slug: 'tree-diameter-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Trees and forestry',
    title: 'Tree Diameter Calculator: DBH from Circumference',
    h1: 'Tree Diameter Calculator',
    metaDescription:
      'Convert a tape measurement of a trunk at breast height into the diameter (DBH) in inches and centimetres, with the basal area of the stem.',
    about:
      'Foresters describe the size of a tree by its diameter at breast height, written DBH, which is the width of the trunk measured 4.5 feet, or 1.3 metres, above the ground on the uphill side. It is awkward to hold callipers around a big trunk, so most people wrap a tape measure round it and read the circumference, then divide by pi. Enter the circumference in inches. The calculator returns the diameter in inches and centimetres and the basal area of the stem, which is the cross-section of the trunk in square feet and the standard way of comparing tree sizes for volume tables and stocking. Take the measurement above any root swelling, below the lowest branch fork, and on a leaning tree along the trunk and not vertically. Where the trunk is not round, take two diameters at right angles and average them, or use a diameter tape, whose scale is already divided by pi and reads the diameter straight off. Measure the same height each time if you track growth.',
    inputs: [field('circ', 'Circumference at 4.5 ft (in)', 50, 1, 500)],
    outputs: [
      { name: 'in', label: 'Diameter (DBH)', format: 'text', highlight: true },
      { name: 'cm', label: 'In centimetres', format: 'text' },
      { name: 'ba', label: 'Basal area of the stem', format: 'text' },
    ],
    calculate: (i) => {
      const d = toD(i.circ).div(PI);
      return { in: `${fmtNumber(d, 2)} in`, cm: `${fmtNumber(d.mul(CM_PER_IN), 1)} cm`, ba: `${fmtNumber(stemBasalArea(d), 2)} sq ft` };
    },
    formulaDescription: 'DBH = circumference ÷ π. Basal area (sq ft) = π ÷ 576 × DBH², with the diameter in inches.',
    workedExample: 'A trunk with a circumference of 50 in has DBH = 50 ÷ π = 15.92 in, which is 40.4 cm. Its basal area is π ÷ 576 × 15.92² = 1.38 sq ft.',
    faq: [
      {
        question: 'Where is breast height?',
        answer: '4.5 feet (1.37 m) above the ground in the United States, and 1.3 m in many other countries, on the uphill side of the tree.',
      },
      {
        question: 'What if the tree forks below breast height?',
        answer: 'Measure each stem separately below the fork if it forks lower, or just below the fork if it forks at or above breast height.',
      },
      {
        question: 'What is a diameter tape?',
        answer: 'A tape whose inch marks are spaced at π, so wrapping it round the trunk gives the diameter without any calculation.',
      },
    ],
    scenarios: rows(['circ'], [[50], [31.4], [62.8], [100], [18.9], [150]], (v) => `A trunk with a circumference of ${v[0]} in`),
    introOutputs: ['in', 'ba'],
    relatedSlugs: ['tree-age-calculator', 'basal-area-calculator'],
    checks: [
      { inputs: {}, expect: { in: '15.92 in', cm: '40.4 cm', ba: '1.38 sq ft' } },
      { inputs: { circ: 62.83 }, expect: { in: '20 in', ba: '2.18 sq ft' } },
      { inputs: { circ: 31.42 }, expect: { in: '10 in', ba: '0.55 sq ft' } },
    ],
  },
  {
    slug: 'basal-area-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Trees and forestry',
    title: 'Basal Area Calculator: Stand Basal Area per Acre',
    h1: 'Basal Area Calculator',
    metaDescription:
      'Find the basal area of a forest stand in square feet per acre and square metres per hectare from the average tree diameter and trees per acre.',
    about:
      'Basal area is the most used measure of how crowded a forest is. It adds up the cross-sections of all the trunks at breast height on a unit of land, and is written in square feet per acre in the United States and square metres per hectare elsewhere. Two stands with the same number of trees can differ in basal area several-fold if one has saplings and the other has big trunks, so it says more about competition and stocking than a head count. Foresters use it to decide when to thin: a stand left at 120 square feet per acre or more is overcrowded and growing slowly, while one near 60 to 80 is lightly stocked and has room to grow. Enter the average diameter in inches, which should be the quadratic mean diameter and not the plain mean, and the number of trees per acre. The calculator gives the basal area in both units and a plain reading. For a sample, an angle gauge or prism lets you count the trees in the plot and multiply by the basal area factor.',
    inputs: [field('dbh', 'Average diameter, DBH (in)', 12, 1, 60), field('tpa', 'Trees per acre', 100, 1, 2000)],
    outputs: [
      { name: 'ft', label: 'Basal area per acre', format: 'text', highlight: true },
      { name: 'm', label: 'Basal area per hectare', format: 'text' },
      { name: 'reading', label: 'Reading', format: 'text' },
    ],
    calculate: (i) => {
      const ba = stemBasalArea(toD(i.dbh)).mul(toD(i.tpa));
      const reading = ba.lt(50) ? 'Light stocking' : ba.lte(100) ? 'Moderate stocking' : 'Heavy stocking: a candidate for thinning';
      return { ft: `${fmtNumber(ba, 1)} sq ft/acre`, m: `${fmtNumber(ba.mul('0.09290304').div(HECTARES_PER_ACRE), 1)} m²/ha`, reading };
    },
    formulaDescription:
      'Basal area per tree (sq ft) = π ÷ 576 × DBH². Per acre = per tree × trees per acre. Square metres per hectare = sq ft per acre × 0.0929 ÷ 0.4047.',
    workedExample:
      'A stand of 100 trees per acre with an average DBH of 12 in has π ÷ 576 × 144 × 100 = 78.5 sq ft per acre, which is 18.0 m²/ha. That is moderate stocking.',
    faq: [
      {
        question: 'Why use quadratic mean diameter?',
        answer:
          'Because basal area depends on the diameter squared, the plain mean understates it. The quadratic mean is the diameter of the tree of average basal area.',
      },
      {
        question: 'How do I measure basal area in the field?',
        answer: 'With a prism or an angle gauge: stand at a point, count the trees that look wider than the gauge and multiply by the basal area factor.',
      },
      {
        question: 'What basal area should a stand have?',
        answer: 'It depends on species and goals. Many managed hardwood stands are kept between 60 and 100 sq ft per acre.',
      },
    ],
    scenarios: rows(
      ['dbh', 'tpa'],
      [
        [12, 100],
        [18, 120],
        [8, 300],
        [14, 60],
        [6, 500],
        [22, 40],
      ],
      (v) => `${v[1]} trees per acre averaging ${v[0]} in across`,
    ),
    introOutputs: ['ft', 'reading'],
    relatedSlugs: ['tree-diameter-calculator', 'tree-spacing-calculator'],
    checks: [
      { inputs: {}, expect: { ft: '78.5 sq ft/acre', m: '18 m²/ha', reading: 'Moderate stocking' } },
      { inputs: { dbh: 18, tpa: 120 }, expect: { ft: '212.1 sq ft/acre', reading: 'Heavy stocking: a candidate for thinning' } },
      { inputs: { dbh: 6, tpa: 100 }, expect: { ft: '19.6 sq ft/acre', reading: 'Light stocking' } },
    ],
  },
  {
    slug: 'tree-height-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Trees and forestry',
    title: 'Tree Height Calculator: Clinometer and Distance Method',
    h1: 'Tree Height Calculator',
    metaDescription: 'Estimate a tree height from the distance you stand away, the angle to its top and your eye height, in feet and metres.',
    about:
      'You can measure a tree you cannot climb with nothing more than a tape, an angle reading and a little trigonometry. Stand a known distance from the trunk on level ground, sight the top of the crown through a clinometer, which many phone apps imitate, and read the angle above the horizontal. The height above your eye is the distance times the tangent of that angle, and adding the height of your eye above the ground gives the full height. Choose a distance roughly equal to the height of the tree, so the angle is near 45 degrees and small angle errors matter least, and stand back far enough to see the very top, which on a broad crown is not the part over the trunk. On a slope, measure the angle to the base as well and add the two heights above and below the eye, with signs. Enter the distance, the angle and your eye height. The calculator returns the height in feet and metres, and you can repeat the reading from the opposite side to confirm it.',
    inputs: [
      field('dist', 'Distance from the tree (ft)', 66, 5, 500),
      field('angle', 'Angle to the top (degrees)', 35, 1, 85),
      field('eye', 'Eye height (ft)', 5.5, 0, 7),
    ],
    outputs: [
      { name: 'ft', label: 'Tree height', format: 'text', highlight: true },
      { name: 'm', label: 'In metres', format: 'text' },
      { name: 'above', label: 'Height above your eye', format: 'text' },
    ],
    calculate: (i) => {
      const above = toD(i.dist).mul(toD(i.angle).mul(PI).div(180).tan());
      const total = above.add(toD(i.eye));
      return { ft: `${fmtNumber(total, 1)} ft`, m: `${fmtNumber(total.mul(M_PER_FT), 1)} m`, above: `${fmtNumber(above, 1)} ft` };
    },
    formulaDescription: 'Height above the eye = distance × tan(angle). Tree height = that + eye height. Metres = feet × 0.3048.',
    workedExample:
      'Standing 66 ft away with the top at 35 degrees: 66 × tan 35° = 46.2 ft above the eye. With an eye height of 5.5 ft the tree is 51.7 ft, or 15.8 m, tall.',
    faq: [
      {
        question: 'What distance is best?',
        answer: 'About the height of the tree, so the angle is near 45 degrees. Very steep or very shallow angles magnify any error.',
      },
      {
        question: 'What if the ground slopes?',
        answer: 'Also measure the angle to the base. If the base is below your eye, add the two heights; if above, subtract the lower one.',
      },
      {
        question: 'Can I measure it without an instrument?',
        answer: 'Yes, with the stick method or the shadow method. The clinometer is more accurate and quicker for tall trees.',
      },
    ],
    scenarios: rows(
      ['dist', 'angle', 'eye'],
      [
        [66, 35, 5.5],
        [100, 40, 5],
        [50, 25, 5.5],
        [80, 45, 5.5],
        [120, 30, 5],
        [40, 60, 5.5],
      ],
      (v) => `${v[0]} ft from the trunk, angle ${v[1]} degrees, eye at ${v[2]} ft`,
    ),
    introOutputs: ['ft', 'm'],
    relatedSlugs: ['tree-diameter-calculator', 'tree-age-calculator'],
    checks: [
      { inputs: {}, expect: { ft: '51.7 ft', m: '15.8 m', above: '46.2 ft' } },
      { inputs: { dist: 100, angle: 40, eye: 5 }, expect: { ft: '88.9 ft' } },
      { inputs: { dist: 50, angle: 25 }, expect: { ft: '28.8 ft' } },
    ],
  },
  {
    slug: 'tree-age-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Trees and forestry',
    title: 'Tree Age Calculator: Estimate Age from Trunk Circumference',
    h1: 'Tree Age Calculator',
    metaDescription: 'Estimate the age of a tree from its trunk circumference and species growth factor, without cutting it down.',
    about:
      'Counting rings is the only exact way to find the age of a tree, and it means cutting the tree or boring a core. A rougher estimate comes from the size of the trunk, since a tree grows wider by a fairly steady amount a year in open conditions. Arborists multiply the diameter at breast height, in inches, by a growth factor for the species, which is the number of years it takes to add an inch of diameter. Fast, short-lived trees such as aspen and silver maple have low factors, around 2 to 3, red maple and red oak about 4, and slow ones like white oak, sugar maple and white pine have a factor of about 5. Measure the circumference at 4.5 feet, pick the species and the calculator converts the circumference to a diameter and applies the factor. Treat the answer as an indication to within 20 or 30 percent, because a crowded forest tree grows far more slowly than a lawn tree, and a tree on rich soil faster. Trees on the national register of old trees need a proper dendrochronology.',
    inputs: [
      field('circ', 'Circumference at 4.5 ft (in)', 50, 3, 600),
      select('species', 'Species', 'red-oak', [
        ['aspen', 'Quaking aspen (factor 2.0)'],
        ['silver-maple', 'Silver maple (3.0)'],
        ['red-oak', 'Red oak (4.0)'],
        ['red-maple', 'Red maple (4.5)'],
        ['sugar-maple', 'Sugar maple (5.0)'],
        ['white-oak', 'White oak (5.0)'],
        ['white-pine', 'White pine (5.0)'],
        ['paper-birch', 'Paper birch (5.0)'],
      ]),
    ],
    outputs: [
      { name: 'dbh', label: 'Diameter (DBH)', format: 'text' },
      { name: 'age', label: 'Estimated age', format: 'text', highlight: true },
    ],
    calculate: (i) => {
      const factor = new D(
        { aspen: '2', 'silver-maple': '3', 'red-oak': '4', 'red-maple': '4.5', 'sugar-maple': '5', 'white-oak': '5', 'white-pine': '5', 'paper-birch': '5' }[
          String(i.species)
        ] ?? '4',
      );
      const dbh = toD(i.circ).div(PI);
      return { dbh: `${fmtNumber(dbh, 1)} in`, age: `About ${fmtNumber(dbh.mul(factor).round(), 0)} years` };
    },
    formulaDescription:
      'DBH = circumference ÷ π. Age ≈ DBH (in) × growth factor for the species. Factors: aspen 2, silver maple 3, red oak 4, red maple 4.5, sugar maple, white oak, white pine and paper birch 5.',
    workedExample: 'A red oak with a circumference of 50 in has DBH = 15.9 in. Multiplying by its growth factor of 4 gives about 64 years.',
    faq: [
      {
        question: 'How accurate is this?',
        answer:
          'Within 20 to 30 percent in typical conditions. Open-grown trees grow faster and forest trees slower, so the true age can sit well off the estimate.',
      },
      { question: 'How can I get an exact age?', answer: 'Count rings on a stump or a core taken with an increment borer, or ask a certified arborist.' },
      {
        question: 'Do old trees follow the same factor?',
        answer: 'Not closely. Growth slows with age, so the method tends to overestimate the age of very large trees.',
      },
    ],
    scenarios: [
      withInputs('A red oak with a 50 in trunk', { circ: 50, species: 'red-oak' }),
      withInputs('A white pine with a 50 in trunk', { circ: 50, species: 'white-pine' }),
      withInputs('A silver maple with a 50 in trunk', { circ: 50, species: 'silver-maple' }),
      withInputs('A sugar maple with a 75 in trunk', { circ: 75, species: 'sugar-maple' }),
      withInputs('A young aspen with a 20 in trunk', { circ: 20, species: 'aspen' }),
    ],
    introOutputs: ['dbh', 'age'],
    relatedSlugs: ['tree-diameter-calculator', 'tree-height-calculator'],
    checks: [
      { inputs: {}, expect: { dbh: '15.9 in', age: 'About 64 years' } },
      { inputs: { species: 'white-pine' }, expect: { age: 'About 80 years' } },
      { inputs: { species: 'silver-maple' }, expect: { age: 'About 48 years' } },
    ],
  },
  {
    slug: 'tree-leaves-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Trees and forestry',
    title: 'Tree Leaves Calculator: How Many Leaves on a Tree',
    h1: 'Tree Leaves Calculator',
    metaDescription: 'Estimate the number of leaves on a tree from its crown diameter, leaf area index and the area of an average leaf.',
    about:
      'How many leaves does a tree have? Nobody counts them, but ecologists estimate the total from the leaf area index, or LAI, which is the one-sided area of leaves above each square metre of ground. A closed deciduous forest canopy has an LAI of about 4 to 6, a dense conifer stand 6 to 10 and an open savanna tree under 2. Treat the crown as a disc seen from above, with the area of a circle of its diameter, and multiply by the LAI to get the total leaf area. Then divide by the area of one typical leaf, which you can measure by tracing a few leaves on graph paper, to find the count: a maple leaf covers about 50 to 100 square centimetres, an oak leaf 50, a birch leaf 20 and a beech leaf near 30. A mature oak of 8 metres crown width therefore carries several tens of thousands of leaves, and a large tree hundreds of thousands. The result is an order-of-magnitude figure that is useful for classroom exercises and for estimating the shade and the cooling of a tree.',
    inputs: [
      field('crown', 'Crown diameter (m)', 8, 0.5, 60),
      field('lai', 'Leaf area index', 5, 0.5, 12),
      field('leaf', 'Area of one leaf (cm²)', 30, 1, 1000),
    ],
    outputs: [
      { name: 'crownArea', label: 'Crown area seen from above', format: 'text' },
      { name: 'leafArea', label: 'Total one-sided leaf area', format: 'text' },
      { name: 'leaves', label: 'Number of leaves', format: 'text', highlight: true },
    ],
    calculate: (i) => {
      const crownArea = PI.div(4).mul(toD(i.crown).pow(2));
      const leafArea = crownArea.mul(toD(i.lai));
      const leaves = leafArea.mul(10000).div(toD(i.leaf));
      return { crownArea: `${fmtNumber(crownArea, 2)} m²`, leafArea: `${fmtNumber(leafArea, 1)} m²`, leaves: fmtNumber(leaves.round(), 0) };
    },
    formulaDescription:
      'Crown area = π ÷ 4 × diameter². Leaf area = crown area × LAI. Leaves = leaf area (cm²) ÷ area of one leaf (cm²), where 1 m² = 10,000 cm².',
    workedExample:
      'A crown 8 m across covers π × 16 = 50.27 m². With an LAI of 5 the leaf area is 251.3 m², or 2,513,274 cm². Leaves of 30 cm² each give about 83,776 leaves.',
    faq: [
      {
        question: 'What is leaf area index?',
        answer: 'The one-sided area of leaves above one square metre of ground. An LAI of 5 means five layers of leaf, on average.',
      },
      {
        question: 'How accurate is the count?',
        answer: 'To within a factor of two at best. Crown shape, density and leaf size all vary, so treat it as an order of magnitude.',
      },
      { question: 'Does this work for conifers?', answer: 'Not for needles, which are tiny and counted in shoots. Use it for broadleaved trees.' },
    ],
    scenarios: rows(
      ['crown', 'lai', 'leaf'],
      [
        [8, 5, 30],
        [10, 3, 100],
        [4, 4, 20],
        [12, 6, 50],
        [6, 2, 80],
        [15, 5, 40],
      ],
      (v) => `A crown of ${v[0]} m, LAI ${v[1]}, leaves of ${v[2]} cm²`,
    ),
    introOutputs: ['leaves', 'leafArea'],
    relatedSlugs: ['tree-diameter-calculator', 'basal-area-calculator'],
    checks: [
      { inputs: {}, expect: { crownArea: '50.27 m²', leafArea: '251.3 m²', leaves: '83,776' } },
      { inputs: { crown: 10, lai: 3, leaf: 100 }, expect: { leafArea: '235.6 m²', leaves: '23,562' } },
      { inputs: { crown: 4, lai: 4, leaf: 20 }, expect: { leaves: '25,133' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
