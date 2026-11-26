import { numberField, unitOf } from '../lib/calc-utils';
import { D, toD } from '../lib/decimal';
import { fmtFixed, fmtNumber } from '../lib/format';
import { CM_PER_IN } from '../lib/units';
import type { CalculatorConfig } from '../lib/types';

const FT_PER_M = new D(1).div('0.3048');
const FT3_PER_M3 = new D(1).div('0.028316846592');
// Yield of one bag of dry mix, cubic feet: 60 lb and 80 lb bags.
const YIELD_60 = new D('0.45');
const YIELD_80 = new D('0.6');

const feet = (v: unknown, unit: string) => (unit === 'm' ? toD(v).mul(FT_PER_M) : toD(v));
const inches = (v: unknown, unit: string) => (unit === 'cm' ? toD(v).div(CM_PER_IN) : toD(v));

const config: CalculatorConfig = {
  slug: 'concrete-calculator',
  category: 'construction',
  tier: 2,
  publish: false,
  title: 'Concrete Calculator: Cubic Yards and Bags for a Slab',
  h1: 'Concrete Calculator',
  metaDescription: 'Work out how much concrete a slab, patio or footing needs in cubic yards, cubic meters and 60 or 80 lb bags, with an allowance for waste.',
  intro:
    'A 10 ft by 10 ft slab poured 4 inches thick needs about 1.36 cubic yards of concrete once 10 percent is added for waste and spillage, which is roughly 62 bags of 80-pound dry mix or 82 bags of 60-pound mix. Enter the length, width and thickness of a rectangular slab, patio, pad or walkway, choose feet and inches or meters and centimeters, and set a waste allowance, and the calculator returns the volume in cubic yards, cubic feet and cubic meters along with the number of bags to buy. Ready-mix trucks are ordered in cubic yards, so use that figure for a delivery, and use the bag count for small jobs you will mix by hand or in a barrow. Concrete cannot be un-poured, and running short in the middle of a pour creates a weak cold joint, so it pays to add 5 to 10 percent for uneven ground, over-excavation and spills. This tool covers flat rectangular shapes; for round footings or stairs, split the job into rectangles or calculate each shape separately.',
  inputs: [
    {
      name: 'length',
      label: 'Length',
      type: 'unit',
      unitOptions: [
        { value: 'ft', label: 'ft', factor: '0.3048' },
        { value: 'm', label: 'm', factor: '1' },
      ],
      min: 0.1,
      max: 1000,
      default: 10,
      validator: numberField({ min: 0.01, max: 10000 }),
    },
    {
      name: 'width',
      label: 'Width',
      type: 'unit',
      unitOptions: [
        { value: 'ft', label: 'ft', factor: '0.3048' },
        { value: 'm', label: 'm', factor: '1' },
      ],
      min: 0.1,
      max: 1000,
      default: 10,
      validator: numberField({ min: 0.01, max: 10000 }),
    },
    {
      name: 'thickness',
      label: 'Thickness',
      type: 'unit',
      unitOptions: [
        { value: 'in', label: 'in', factor: '2.54' },
        { value: 'cm', label: 'cm', factor: '1' },
      ],
      min: 1,
      max: 100,
      default: 4,
      validator: numberField({ min: 0.1, max: 1000 }),
    },
    { name: 'waste', label: 'Waste allowance (%)', type: 'number', min: 0, max: 50, default: 10, validator: numberField({ min: 0, max: 50 }) },
  ],
  outputs: [
    { name: 'cubicYards', label: 'Concrete needed (cubic yards)', format: 'number', highlight: true },
    { name: 'cubicFeet', label: 'Cubic feet', format: 'number' },
    { name: 'cubicMeters', label: 'Cubic meters', format: 'number' },
    { name: 'bags80', label: '80 lb bags', format: 'number', highlight: true },
    { name: 'bags60', label: '60 lb bags', format: 'number' },
  ],
  calculate: (i) => {
    const volumeFt3 = feet(i.length, unitOf(i, 'length', 'ft'))
      .mul(feet(i.width, unitOf(i, 'width', 'ft')))
      .mul(inches(i.thickness, unitOf(i, 'thickness', 'in')).div(12))
      .mul(new D(1).plus(toD(i.waste).div(100)));
    return {
      cubicYards: fmtNumber(volumeFt3.div(27), 2),
      cubicFeet: fmtNumber(volumeFt3, 2),
      cubicMeters: fmtNumber(volumeFt3.div(FT3_PER_M3), 2),
      bags80: fmtFixed(volumeFt3.div(YIELD_80).ceil(), 0),
      bags60: fmtFixed(volumeFt3.div(YIELD_60).ceil(), 0),
    };
  },
  formulaDescription:
    'Volume in cubic feet = length (ft) × width (ft) × thickness (in) ÷ 12, then multiplied by (1 + waste % ÷ 100). Cubic yards = cubic feet ÷ 27; cubic meters = cubic feet × 0.028316847. An 80 lb bag yields about 0.6 cubic feet and a 60 lb bag about 0.45 cubic feet, so bags = volume ÷ yield, rounded up to a whole bag.',
  workedExample:
    '10 ft × 10 ft × 4 in: 10 × 10 × (4 ÷ 12) = 33.33 cubic feet. With 10% waste: 33.33 × 1.10 = 36.67 cubic feet = 36.67 ÷ 27 = 1.36 cubic yards. 80 lb bags: 36.67 ÷ 0.6 = 61.1, rounded up to 62 bags. 60 lb bags: 36.67 ÷ 0.45 = 81.5, rounded up to 82 bags.',
  faq: [
    {
      question: 'How many cubic yards of concrete do I need for a 10 x 10 slab?',
      answer:
        'A 4-inch-thick 10 by 10 foot slab is 33.3 cubic feet, or about 1.23 cubic yards. Adding 10 percent for waste brings the order to about 1.36 cubic yards.',
    },
    {
      question: 'How much waste allowance should I add?',
      answer:
        'Five to ten percent is typical. Use the higher end for uneven ground, small forms or hand mixing, where spillage and over-excavation are most likely.',
    },
    {
      question: 'How much does one bag of concrete cover?',
      answer:
        'An 80 pound bag makes about 0.6 cubic feet, enough for roughly 1.8 square feet at 4 inches thick. A 60 pound bag makes about 0.45 cubic feet. Check the yield printed on your brand, since it varies slightly.',
    },
    {
      question: 'Should I order ready-mix concrete or buy bags?',
      answer:
        'Bags suit small jobs of up to roughly a third of a cubic yard. Beyond that, mixing by hand is tiring and hard to keep consistent, so a delivered load is usually the better choice.',
    },
  ],
  relatedSlugs: ['paint-calculator', 'cm-to-inches', 'percentage-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
