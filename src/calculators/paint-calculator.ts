import { numberField, selectField, unitOf } from '../lib/calc-utils';
import { D, toD } from '../lib/decimal';
import { fmtFixed, fmtNumber } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const FT_PER_M = new D(1).div('0.3048');
const LITRES_PER_GALLON = new D('3.785411784');
const DOOR_FT2 = 20;
const WINDOW_FT2 = 15;

const feet = (v: unknown, unit: string) => (unit === 'm' ? toD(v).mul(FT_PER_M) : toD(v));
const LENGTH_UNITS = [
  { value: 'ft', label: 'ft' },
  { value: 'm', label: 'm' },
];

const config: CalculatorConfig = {
  slug: 'paint-calculator',
  category: 'construction',
  tier: 3,
  publish: false,
  title: 'Paint Calculator: How Much Paint for a Room (Gallons and Liters)',
  h1: 'Paint Calculator',
  metaDescription:
    'Estimate how much paint a room needs from its size, doors, windows and number of coats. Shows paintable area, gallons and liters, and how many gallons to buy.',
  intro:
    'A 12 ft by 14 ft room with 8 ft ceilings, one door and two windows has 366 square feet of wall to paint, and two coats at a coverage of 350 square feet per gallon take about 2.1 gallons, so you would buy 3 gallons. Enter the room length, width and ceiling height, then the number of doors and windows to leave out, the number of coats and the coverage printed on the can, and the calculator works out the paintable wall area and the amount of paint required in gallons and liters. Add the ceiling if you are painting it too. Standard allowances are used for openings: about 20 square feet for a door and 15 for a window. Coverage varies by brand, color and surface, and rough or porous walls and dramatic color changes soak up more paint, so use the figure on the product label and consider a primer when covering a dark color. Buying slightly more than the minimum is sensible because leftover paint is useful for touch-ups, and matching a batch later can be difficult.',
  inputs: [
    {
      name: 'length',
      label: 'Room length',
      type: 'unit',
      unitOptions: LENGTH_UNITS,
      min: 1,
      max: 200,
      default: 12,
      validator: numberField({ min: 0.1, max: 1000 }),
    },
    {
      name: 'width',
      label: 'Room width',
      type: 'unit',
      unitOptions: LENGTH_UNITS,
      min: 1,
      max: 200,
      default: 14,
      validator: numberField({ min: 0.1, max: 1000 }),
    },
    {
      name: 'height',
      label: 'Ceiling height',
      type: 'unit',
      unitOptions: LENGTH_UNITS,
      min: 1,
      max: 50,
      default: 8,
      validator: numberField({ min: 0.1, max: 100 }),
    },
    { name: 'doors', label: 'Doors (not painted)', type: 'number', min: 0, max: 50, default: 1, validator: numberField({ min: 0, max: 50, integer: true }) },
    {
      name: 'windows',
      label: 'Windows (not painted)',
      type: 'number',
      min: 0,
      max: 100,
      default: 2,
      validator: numberField({ min: 0, max: 100, integer: true }),
    },
    { name: 'coats', label: 'Coats of paint', type: 'number', min: 1, max: 5, default: 2, validator: numberField({ min: 1, max: 5, integer: true }) },
    {
      name: 'coverage',
      label: 'Coverage (sq ft per gallon)',
      type: 'number',
      min: 100,
      max: 600,
      default: 350,
      validator: numberField({ min: 50, max: 1000 }),
    },
    {
      name: 'ceiling',
      label: 'Paint the ceiling too?',
      type: 'select',
      default: 'no',
      unitOptions: [
        { value: 'no', label: 'No, walls only' },
        { value: 'yes', label: 'Yes, include the ceiling' },
      ],
      validator: selectField(['no', 'yes']),
    },
  ],
  outputs: [
    { name: 'area', label: 'Paintable area (sq ft)', format: 'number' },
    { name: 'gallons', label: 'Paint needed (gallons)', format: 'number', highlight: true },
    { name: 'liters', label: 'Paint needed (liters)', format: 'number' },
    { name: 'buy', label: 'Gallons to buy', format: 'text', highlight: true },
  ],
  calculate: (i) => {
    const l = feet(i.length, unitOf(i, 'length', 'ft'));
    const w = feet(i.width, unitOf(i, 'width', 'ft'));
    const h = feet(i.height, unitOf(i, 'height', 'ft'));
    const walls = l.plus(w).mul(2).mul(h);
    const ceiling = i.ceiling === 'yes' ? l.mul(w) : new D(0);
    const openings = toD(i.doors).mul(DOOR_FT2).plus(toD(i.windows).mul(WINDOW_FT2));
    const area = D.max(walls.plus(ceiling).minus(openings), 0);
    const gallons = area.mul(toD(i.coats)).div(toD(i.coverage));
    const buy = gallons.ceil();
    return {
      area: fmtNumber(area, 1),
      gallons: fmtNumber(gallons, 2),
      liters: fmtNumber(gallons.mul(LITRES_PER_GALLON), 1),
      buy: `${fmtFixed(buy, 0)} ${buy.eq(1) ? 'gallon' : 'gallons'}`,
    };
  },
  formulaDescription:
    'Wall area = 2 × (length + width) × height. Add length × width if the ceiling is painted. Paintable area = that total − (doors × 20 sq ft) − (windows × 15 sq ft). Paint needed in gallons = paintable area × number of coats ÷ coverage per gallon. Liters = gallons × 3.785. Gallons to buy rounds up to the next whole gallon.',
  workedExample:
    'Room 12 × 14 ft, ceiling 8 ft: walls = 2 × (12 + 14) × 8 = 416 sq ft. Minus 1 door (20) and 2 windows (30) = 366 sq ft. Two coats = 732 sq ft of coverage. At 350 sq ft per gallon: 732 ÷ 350 = 2.09 gallons, which is 7.9 liters. Round up and buy 3 gallons.',
  faq: [
    {
      question: 'How much paint do I need for one room?',
      answer:
        'Find the wall area, subtract doors and windows, multiply by the number of coats and divide by the coverage on the can, usually 350 to 400 square feet per gallon. Round up to a whole gallon.',
    },
    {
      question: 'Do I need two coats of paint?',
      answer:
        'Usually yes. Two coats give an even color and a durable finish, and they are almost essential when changing to a very different color or painting over bare plaster. One coat can be enough when repainting a similar shade with a paint-and-primer product.',
    },
    {
      question: 'Should I include doors and windows?',
      answer:
        'The calculator subtracts them as a standard allowance. If you plan to paint the trim, doors or window frames, buy a little extra, since trim often takes a different paint and a different finish.',
    },
    {
      question: 'How much extra paint should I buy?',
      answer:
        'Round up to the next whole gallon and keep the remainder for touch-ups. If the room is textured or the walls are porous, add an extra 10 percent or prime first.',
    },
  ],
  relatedSlugs: ['concrete-calculator', 'cm-to-inches', 'percentage-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
