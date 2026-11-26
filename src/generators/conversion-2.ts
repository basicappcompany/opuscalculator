import { z } from 'zod';
import { numberField, selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 22a (conversion): flexible converters where the visitor picks both units (distance, area, speed),
 * a height converter between metric and feet and inches, a number-base converter and cubic yards to tons. These sit
 * beside the fixed unit-pair pages: they answer the general searches ("distance converter") the pairs do not.
 * All factors are exact definitions; density figures are typical and stated. Conversion shows no disclaimer.
 * Tier 2 or 3, so none is live until the cohort gate opens.
 */

const num = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max }),
});
const sel = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});
const out = (name: string, label: string, highlight = false) => ({ name, label, format: 'text' as const, ...(highlight ? { highlight: true } : {}) });

const DIST: Record<string, { f: string; s: string }> = {
  mm: { f: '0.001', s: 'mm' },
  cm: { f: '0.01', s: 'cm' },
  m: { f: '1', s: 'm' },
  km: { f: '1000', s: 'km' },
  in: { f: '0.0254', s: 'in' },
  ft: { f: '0.3048', s: 'ft' },
  yd: { f: '0.9144', s: 'yd' },
  mi: { f: '1609.344', s: 'mi' },
  nmi: { f: '1852', s: 'nmi' },
};
const DIST_OPTIONS: [string, string][] = [
  ['mm', 'Millimetres'],
  ['cm', 'Centimetres'],
  ['m', 'Metres'],
  ['km', 'Kilometres'],
  ['in', 'Inches'],
  ['ft', 'Feet'],
  ['yd', 'Yards'],
  ['mi', 'Miles'],
  ['nmi', 'Nautical miles'],
];
const AREA: Record<string, { f: string; s: string }> = {
  sqmm: { f: '0.000001', s: 'mm²' },
  sqcm: { f: '0.0001', s: 'cm²' },
  sqm: { f: '1', s: 'm²' },
  ha: { f: '10000', s: 'ha' },
  sqkm: { f: '1000000', s: 'km²' },
  sqin: { f: '0.00064516', s: 'in²' },
  sqft: { f: '0.09290304', s: 'ft²' },
  sqyd: { f: '0.83612736', s: 'yd²' },
  acre: { f: '4046.8564224', s: 'acres' },
  sqmi: { f: '2589988.110336', s: 'mi²' },
};
const AREA_OPTIONS: [string, string][] = [
  ['sqmm', 'Square millimetres'],
  ['sqcm', 'Square centimetres'],
  ['sqm', 'Square metres'],
  ['ha', 'Hectares'],
  ['sqkm', 'Square kilometres'],
  ['sqin', 'Square inches'],
  ['sqft', 'Square feet'],
  ['sqyd', 'Square yards'],
  ['acre', 'Acres'],
  ['sqmi', 'Square miles'],
];
const SPEED: Record<string, { f: Dec; s: string }> = {
  ms: { f: new D(1), s: 'm/s' },
  kmh: { f: new D(1).div('3.6'), s: 'km/h' },
  mph: { f: new D('0.44704'), s: 'mph' },
  kn: { f: new D(1852).div(3600), s: 'knots' },
  fps: { f: new D('0.3048'), s: 'ft/s' },
};
const SPEED_OPTIONS: [string, string][] = [
  ['ms', 'Metres per second'],
  ['kmh', 'Kilometres per hour'],
  ['mph', 'Miles per hour'],
  ['kn', 'Knots'],
  ['fps', 'Feet per second'],
];
const DENSITY: Record<string, string> = { gravel: '1.4', crushed: '1.5', sand: '1.35', topsoil: '1.1', mulch: '0.4', concrete: '2' };
const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const BASE_PREFIX: Record<string, string> = { '2': '0b', '8': '0o', '16': '0x', '10': '' };
const BASE_PATTERN: Record<string, RegExp> = { '2': /^[01]+$/, '8': /^[0-7]+$/, '10': /^[0-9]+$/, '16': /^[0-9a-fA-F]+$/ };

export const SPECS: Spec[] = [
  {
    slug: 'distance-converter',
    category: 'conversion',
    tier: 2,
    subCluster: 'length',
    title: 'Distance Converter: Millimetres, Metres, Kilometres, Miles and More',
    h1: 'Distance Converter',
    metaDescription:
      'Convert a distance between millimetres, centimetres, metres, kilometres, inches, feet, yards, miles and nautical miles, with the value in metres and feet.',
    about:
      'Road signs in Europe show kilometres, those in the United States show miles, sailors count nautical miles, and a carpenter reads inches and feet from a tape. Type a length, say what unit it is written in, then choose the unit you would like instead. The page multiplies by exact definitions, such as 25.4 millimetres to the inch and 1,609.344 metres to the statute mile, and prints the answer to six decimals together with that same length in metres and in feet so you can sanity-check it.',
    inputs: [num('x', 'Distance', 10, -1e15, 1e15), sel('from', 'From', 'km', DIST_OPTIONS), sel('to', 'To', 'mi', DIST_OPTIONS)],
    outputs: [out('res', 'Converted distance', true), out('m', 'In metres'), out('ft', 'In feet')],
    calculate: (i) => {
      const base = toD(i.x).mul(DIST[String(i.from)].f);
      return {
        res: `${fmtNumber(base.div(DIST[String(i.to)].f), 6)} ${DIST[String(i.to)].s}`,
        m: `${fmtNumber(base, 6)} m`,
        ft: `${fmtNumber(base.div('0.3048'), 4)} ft`,
      };
    },
    formulaDescription:
      'Convert to metres, then to the target unit: result = value × factor(from) ÷ factor(to). Exact factors: 1 in = 0.0254 m, 1 ft = 0.3048 m, 1 yd = 0.9144 m, 1 mi = 1,609.344 m, 1 nautical mile = 1,852 m.',
    formulaLatex: 'd_{to} = d_{from}\\,\\dfrac{f_{from}}{f_{to}}',
    workedExample:
      '10 km is 6.213712 miles, which is 10,000 metres or 32,808.399 feet. A 26.2-mile marathon is 42.164813 km, and 5 nautical miles is 9,260 metres.',
    faq: [
      {
        question: 'Is a nautical mile the same as a mile?',
        answer: 'No. A nautical mile is exactly 1,852 metres, about 15 percent longer than the statute mile of 1,609.344 metres.',
      },
      {
        question: 'Why do the answers have so many decimals?',
        answer: 'The factors are exact definitions, so six places shows the true value; round to whatever precision you need.',
      },
      { question: 'Can I enter a negative distance?', answer: 'Yes, for a signed difference; the sign is kept.' },
    ],
    scenarios: [
      [10, 'km', 'mi'],
      [26.2, 'mi', 'km'],
      [5, 'nmi', 'm'],
      [180, 'cm', 'ft'],
      [1, 'yd', 'in'],
      [42.195, 'km', 'mi'],
      [6, 'ft', 'cm'],
      [250, 'mm', 'in'],
      [3.5, 'mi', 'ft'],
      [800, 'm', 'yd'],
      [12, 'in', 'cm'],
      [100, 'nmi', 'km'],
    ].map(([x, from, to]) => ({ label: `length ${x} ${from} expressed in ${to}`, inputs: { x, from, to } })),
    introOutputs: ['res'],
    relatedSlugs: ['area-converter', 'speed-converter', 'height-converter'],
    checks: [
      { inputs: {}, expect: { res: '6.213712 mi', m: '10,000 m', ft: '32,808.399 ft' } },
      { inputs: { x: 26.2, from: 'mi', to: 'km' }, expect: { res: '42.164813 km', m: '42,164.8128 m', ft: '138,336 ft' } },
      { inputs: { x: 5, from: 'nmi', to: 'm' }, expect: { res: '9,260 m', m: '9,260 m', ft: '30,380.5774 ft' } },
      { inputs: { x: 180, from: 'cm', to: 'ft' }, expect: { res: '5.905512 ft', m: '1.8 m', ft: '5.9055 ft' } },
      { inputs: { x: 1, from: 'yd', to: 'in' }, expect: { res: '36 in', m: '0.9144 m', ft: '3 ft' } },
    ],
  },
  {
    slug: 'area-converter',
    category: 'conversion',
    tier: 2,
    subCluster: 'area',
    title: 'Area Converter: Square Metres, Feet, Acres, Hectares and More',
    h1: 'Area Converter',
    metaDescription:
      'Convert an area between square millimetres, centimetres, metres, hectares, square kilometres, square inches, feet, yards, acres and square miles.',
    about:
      'Land, floors and fields are measured in different area units around the world: square metres and hectares in most countries, square feet and acres in the United States and the United Kingdom. Enter the area, pick the unit it is in and the one you need. Square units grow with the square of the length factor, so a square foot is not a twelfth of a square yard but a ninth. The calculator uses exact definitions, such as 1 acre = 4,046.8564224 square metres, and also shows the area in square metres.',
    inputs: [num('x', 'Area', 1, -1e15, 1e15), sel('from', 'From', 'acre', AREA_OPTIONS), sel('to', 'To', 'sqft', AREA_OPTIONS)],
    outputs: [out('res', 'Converted area', true), out('sqm', 'In square metres')],
    calculate: (i) => {
      const base = toD(i.x).mul(AREA[String(i.from)].f);
      return { res: `${fmtNumber(base.div(AREA[String(i.to)].f), 6)} ${AREA[String(i.to)].s}`, sqm: `${fmtNumber(base, 6)} m²` };
    },
    formulaDescription:
      'Convert to square metres, then to the target: result = value × factor(from) ÷ factor(to). Exact: 1 ft² = 0.09290304 m², 1 yd² = 0.83612736 m², 1 acre = 4,046.8564224 m², 1 ha = 10,000 m², 1 mi² = 2,589,988.110336 m².',
    formulaLatex: 'A_{to} = A_{from}\\,\\dfrac{f_{from}}{f_{to}}',
    workedExample:
      '1 acre is 43,560 square feet or 4,046.856422 m². 2.5 hectares is 6.177635 acres, 1,500 ft² is 139.35456 m², and 640 acres make exactly 1 square mile.',
    faq: [
      { question: 'How many square feet in an acre?', answer: '43,560, since an acre is a furlong by a chain: 660 ft × 66 ft.' },
      { question: 'Why is a hectare 10,000 m²?', answer: 'It is a square 100 metres on a side.' },
      {
        question: 'Why are square conversions not the same as length ones?',
        answer: 'Area scales with the square of length: 1 m is 3.28 ft, but 1 m² is 10.76 ft².',
      },
    ],
    scenarios: [
      [1, 'acre', 'sqft'],
      [2.5, 'ha', 'acre'],
      [1500, 'sqft', 'sqm'],
      [1, 'sqmi', 'sqkm'],
      [640, 'acre', 'sqmi'],
      [350, 'sqm', 'sqft'],
      [12, 'sqyd', 'sqm'],
      [0.75, 'acre', 'ha'],
      [25000, 'sqcm', 'sqin'],
      [3, 'sqkm', 'acre'],
      [80, 'sqin', 'sqcm'],
      [9, 'ha', 'sqkm'],
    ].map(([x, from, to]) => ({ label: `${x} ${from} to ${to}`, inputs: { x, from, to } })),
    introOutputs: ['res'],
    relatedSlugs: ['distance-converter', 'square-footage-calculator', 'area-calculator'],
    checks: [
      { inputs: {}, expect: { res: '43,560 ft²', sqm: '4,046.856422 m²' } },
      { inputs: { x: 2.5, from: 'ha', to: 'acre' }, expect: { res: '6.177635 acres', sqm: '25,000 m²' } },
      { inputs: { x: 1500, from: 'sqft', to: 'sqm' }, expect: { res: '139.35456 m²', sqm: '139.35456 m²' } },
      { inputs: { x: 1, from: 'sqmi', to: 'sqkm' }, expect: { res: '2.589988 km²', sqm: '2,589,988.110336 m²' } },
      { inputs: { x: 640, from: 'acre', to: 'sqmi' }, expect: { res: '1 mi²', sqm: '2,589,988.110336 m²' } },
    ],
  },
  {
    slug: 'speed-converter',
    category: 'conversion',
    tier: 2,
    subCluster: 'speed',
    title: 'Speed Converter: km/h, mph, m/s, Knots and Feet per Second',
    h1: 'Speed Converter',
    metaDescription:
      'Convert a speed between metres per second, kilometres per hour, miles per hour, knots and feet per second, with the value in metres per second.',
    about:
      'A car dashboard reads kilometres per hour, an American highway posts miles per hour, a ship logs knots, a physics exercise asks for metres per second and a ballistics sheet quotes feet per second. Key in a rate of travel, name its unit, then pick the unit you need. A knot is exactly one nautical mile in an hour, which makes 1,852 metres across 3,600 seconds, and one mile per hour equals 0.44704 metres per second. The result has six decimals and is shown alongside the rate in metres per second.',
    inputs: [num('x', 'Speed', 100, -1e12, 1e12), sel('from', 'From', 'kmh', SPEED_OPTIONS), sel('to', 'To', 'mph', SPEED_OPTIONS)],
    outputs: [out('res', 'Converted speed', true), out('ms', 'In metres per second')],
    calculate: (i) => {
      const base = toD(i.x).mul(SPEED[String(i.from)].f);
      return { res: `${fmtNumber(base.div(SPEED[String(i.to)].f), 6)} ${SPEED[String(i.to)].s}`, ms: `${fmtNumber(base, 6)} m/s` };
    },
    formulaDescription:
      'Convert to metres per second, then to the target: result = value × factor(from) ÷ factor(to). Exact: 1 km/h = 1 ÷ 3.6 m/s, 1 mph = 0.44704 m/s, 1 knot = 1,852 ÷ 3,600 m/s, 1 ft/s = 0.3048 m/s.',
    formulaLatex: 'v_{to} = v_{from}\\,\\dfrac{f_{from}}{f_{to}}',
    workedExample: '100 km/h is 62.137119 mph or 27.777778 m/s. 30 m/s is 108 km/h, 25 knots is 46.3 km/h, and 60 mph is exactly 88 feet per second.',
    faq: [
      { question: 'How fast is a knot?', answer: 'One nautical mile per hour, about 1.852 km/h or 1.151 mph.' },
      { question: 'How do I convert km/h to m/s quickly?', answer: 'Divide by 3.6: 90 km/h is 25 m/s.' },
      { question: 'Why are there so many decimals?', answer: 'The factors are exact definitions, so six decimals shows the true value; round as you need.' },
    ],
    scenarios: [
      [100, 'kmh', 'mph'],
      [30, 'ms', 'kmh'],
      [25, 'kn', 'kmh'],
      [60, 'mph', 'fps'],
      [1, 'kn', 'ms'],
      [130, 'kmh', 'kn'],
      [55, 'mph', 'ms'],
      [12, 'ms', 'mph'],
      [300, 'kn', 'mph'],
      [88, 'fps', 'kmh'],
      [70, 'mph', 'kmh'],
      [5, 'ms', 'kn'],
    ].map(([x, from, to]) => ({ label: `rate ${x} ${from} becomes ${to}`, inputs: { x, from, to } })),
    introOutputs: ['res'],
    relatedSlugs: ['distance-converter', 'speed-distance-time-calculator', 'average-speed-calculator'],
    checks: [
      { inputs: {}, expect: { res: '62.137119 mph', ms: '27.777778 m/s' } },
      { inputs: { x: 30, from: 'ms', to: 'kmh' }, expect: { res: '108 km/h', ms: '30 m/s' } },
      { inputs: { x: 25, from: 'kn', to: 'kmh' }, expect: { res: '46.3 km/h', ms: '12.861111 m/s' } },
      { inputs: { x: 60, from: 'mph', to: 'fps' }, expect: { res: '88 ft/s', ms: '26.8224 m/s' } },
      { inputs: { x: 1, from: 'kn', to: 'ms' }, expect: { res: '0.514444 m/s', ms: '0.514444 m/s' } },
    ],
  },
  {
    slug: 'height-converter',
    category: 'conversion',
    tier: 2,
    subCluster: 'length',
    title: 'Height Converter: Centimetres to Feet and Inches and Back',
    h1: 'Height Converter',
    metaDescription: 'Convert a height from centimetres to feet and inches, or from feet and inches to centimetres, with the total inches and metres.',
    about:
      'Body height is quoted in centimetres in most of the world and in feet and inches in the United States, Britain and a few other places, which makes forms and profiles awkward. Choose a direction. To go from metric, enter the height in centimetres and read it as whole feet plus inches to one decimal. To go the other way, enter feet and inches and read the centimetres. The page also gives the total in inches and the height in metres, using 1 inch = 2.54 centimetres exactly.',
    inputs: [
      sel('mode', 'Convert', 'cm', [
        ['cm', 'Centimetres to feet and inches'],
        ['ftin', 'Feet and inches to centimetres'],
      ]),
      num('cm', 'Height in centimetres', 170, 0, 300),
      num('ft', 'Feet', 5, 0, 9),
      num('inch', 'Inches', 7, 0, 100),
    ],
    outputs: [out('res', 'Converted height', true), out('in', 'Total in inches'), out('m', 'In metres')],
    calculate: (i) => {
      if (String(i.mode) === 'ftin') {
        const tot = toD(i.ft).mul(12).plus(toD(i.inch));
        const cm = tot.mul('2.54');
        return { res: `${fmtNumber(cm, 1)} cm`, in: `${fmtNumber(tot, 2)} inches in all`, m: `${fmtNumber(cm.div(100), 3)} m` };
      }
      const cm = toD(i.cm);
      const tot = cm.div('2.54');
      let feet = Number(tot.div(12).floor().toFixed(0));
      let ins = tot.minus(feet * 12).toDecimalPlaces(1, D.ROUND_HALF_UP);
      if (ins.gte(12)) {
        feet += 1;
        ins = new D(0);
      }
      return { res: `${feet} ft ${fmtNumber(ins, 1)} in`, in: `${fmtNumber(tot, 2)} inches in all`, m: `${fmtNumber(cm.div(100), 3)} m` };
    },
    formulaDescription:
      'Total inches = centimetres ÷ 2.54; feet = whole part of inches ÷ 12; the remainder is the inches, rounded to one decimal (carrying to a foot if it reaches 12). The other way: centimetres = (feet × 12 + inches) × 2.54.',
    formulaLatex: 'h_{in} = \\dfrac{h_{cm}}{2.54}',
    workedExample: '170 cm is 66.93 inches, which is 5 ft 6.9 in. 6 ft 2 in is 74 inches, which is 188 cm. 182.88 cm is exactly 6 ft 0 in.',
    faq: [
      { question: 'How many centimetres in a foot?', answer: '30.48 exactly, since a foot is 12 inches of 2.54 cm.' },
      { question: 'Why does 152.3 cm show as 5 ft 0 in?', answer: 'It is 4 ft 11.96 in, which rounds to 12.0 inches, so it carries over to 5 ft 0 in.' },
      { question: 'Can I enter inches over 12?', answer: 'Yes in the feet-and-inches direction; they are added to the feet before converting.' },
    ],
    scenarios: [
      ['cm', 170, 5, 7],
      ['ftin', 170, 6, 2],
      ['cm', 182.88, 5, 7],
      ['cm', 152.3, 5, 7],
      ['ftin', 170, 5, 11.5],
      ['cm', 160, 5, 7],
      ['ftin', 170, 5, 4],
      ['cm', 195, 5, 7],
      ['ftin', 170, 6, 6],
      ['cm', 143.5, 5, 7],
      ['ftin', 170, 5, 0],
      ['cm', 177.8, 5, 7],
    ].map(([mode, cm, ft, inch]) => ({ label: `${mode === 'cm' ? `${cm} cm` : `${ft} ft ${inch} in`}`, inputs: { mode, cm, ft, inch } })),
    introOutputs: ['res'],
    relatedSlugs: ['distance-converter', 'bmi-calculator', 'mid-parental-height-calculator'],
    checks: [
      { inputs: {}, expect: { res: '5 ft 6.9 in', in: '66.93 inches in all', m: '1.7 m' } },
      { inputs: { mode: 'ftin', ft: 6, inch: 2 }, expect: { res: '188 cm', in: '74 inches in all', m: '1.88 m' } },
      { inputs: { cm: 182.88 }, expect: { res: '6 ft 0 in', in: '72 inches in all', m: '1.829 m' } },
      { inputs: { cm: 152.3 }, expect: { res: '5 ft 0 in', in: '59.96 inches in all', m: '1.523 m' } },
      { inputs: { mode: 'ftin', ft: 5, inch: 11.5 }, expect: { res: '181.6 cm', in: '71.5 inches in all', m: '1.816 m' } },
    ],
  },
  {
    slug: 'binary-converter',
    category: 'conversion',
    tier: 2,
    subCluster: 'number systems',
    title: 'Binary Converter: Decimal, Binary, Octal and Hexadecimal',
    h1: 'Binary Converter',
    metaDescription: 'Convert a whole number between decimal, binary, octal and hexadecimal, with the number of bits it needs.',
    about:
      'Computers store numbers in binary, programmers read them in hexadecimal and older systems use octal, while people count in decimal. Choose the base your number is written in, type it, and the page shows the same value in all four bases and how many bits it takes. Binary uses the digits 0 and 1, octal 0 to 7, decimal 0 to 9 and hexadecimal 0 to 9 and A to F. The conversion is exact for numbers of any practical length, because it works with arbitrary-precision integers rather than floating point.',
    inputs: [
      sel('base', 'The number is written in', '10', [
        ['10', 'Decimal (base 10)'],
        ['2', 'Binary (base 2)'],
        ['8', 'Octal (base 8)'],
        ['16', 'Hexadecimal (base 16)'],
      ]),
      { name: 'x', label: 'Number (digits only, no prefix)', type: 'text' as const, default: '255', validator: z.string().trim().min(1).max(80) },
    ],
    outputs: [out('dec', 'Decimal', true), out('bin', 'Binary'), out('oct', 'Octal'), out('hex', 'Hexadecimal'), out('bits', 'Bits needed')],
    calculate: (i) => {
      const base = String(i.base);
      const x = String(i.x).trim();
      if (!(BASE_PATTERN[base] ?? BASE_PATTERN['10']).test(x))
        return { dec: 'That is not a valid number in the chosen base', bin: '', oct: '', hex: '', bits: '' };
      const n = BigInt(`${BASE_PREFIX[base] ?? ''}${x}`);
      return { dec: group(n.toString(10)), bin: n.toString(2), oct: n.toString(8), hex: n.toString(16).toUpperCase(), bits: `${n.toString(2).length} bits` };
    },
    formulaDescription:
      'A number in base b with digits dₖ…d₀ has the value Σ dᵢ bⁱ. To convert, the page evaluates that value as an exact integer and rewrites it by repeated division by the target base. Non-negative whole numbers only; hexadecimal letters may be upper or lower case.',
    formulaLatex: 'N = \\sum_{i} d_{i}\\, b^{i}',
    workedExample: '255 in decimal is 11111111 in binary, 377 in octal and FF in hexadecimal, using 8 bits. Binary 101101 is 45 decimal, 55 octal and 2D hex.',
    faq: [
      {
        question: 'Why do programmers like hexadecimal?',
        answer: 'One hex digit is exactly four bits, so a byte is always two hex digits, which is compact and easy to read.',
      },
      { question: 'Why 255?', answer: 'It is the largest value of one byte (8 bits all set to 1), 2⁸ − 1.' },
      { question: 'Does it handle negative or fractional numbers?', answer: 'No. This page converts whole numbers from zero up.' },
    ],
    scenarios: [
      ['10', '255'],
      ['2', '101101'],
      ['16', 'FF'],
      ['8', '777'],
      ['10', '65535'],
      ['16', 'DEADBEEF'],
      ['2', '11110000'],
      ['10', '1024'],
      ['8', '1750'],
      ['16', '7F'],
      ['10', '4294967295'],
      ['2', '1000000000'],
    ].map(([base, x]) => ({ label: `base ${base}: ${x}`, inputs: { base, x } })),
    introOutputs: ['dec', 'bin'],
    relatedSlugs: ['bits-to-bytes', 'exponent-calculator', 'prime-factorization-calculator'],
    checks: [
      { inputs: {}, expect: { dec: '255', bin: '11111111', oct: '377', hex: 'FF', bits: '8 bits' } },
      { inputs: { base: 2, x: '101101' }, expect: { dec: '45', bin: '101101', oct: '55', hex: '2D', bits: '6 bits' } },
      { inputs: { base: 16, x: 'ff' }, expect: { dec: '255', bin: '11111111', oct: '377', hex: 'FF', bits: '8 bits' } },
      { inputs: { base: 8, x: '777' }, expect: { dec: '511', bin: '111111111', oct: '777', hex: '1FF', bits: '9 bits' } },
      {
        inputs: { base: 10, x: '18446744073709551616' },
        expect: {
          dec: '18,446,744,073,709,551,616',
          bin: '10000000000000000000000000000000000000000000000000000000000000000',
          oct: '2000000000000000000000',
          hex: '10000000000000000',
          bits: '65 bits',
        },
      },
      { inputs: { base: 2, x: '1021' }, expect: { dec: 'That is not a valid number in the chosen base' } },
    ],
  },
  {
    slug: 'cubic-yards-to-tons-calculator',
    category: 'conversion',
    tier: 2,
    subCluster: 'volume',
    title: 'Cubic Yards to Tons Calculator: Gravel, Sand, Soil, Mulch and Concrete',
    h1: 'Cubic Yards to Tons Calculator',
    metaDescription:
      'Convert cubic yards of gravel, crushed stone, sand, topsoil, mulch or concrete into US tons, metric tonnes and pounds using typical densities.',
    about:
      'Hauling companies quote a load limit in tons while the landscape plan is drawn in yards, so someone has to translate. The key is bulk density, the heaviness of one yard: loose mulch is feather-light at about 0.4 of a ton, crushed rock tips towards 1.5 and poured concrete reaches about 2. Pick a material, enter the yards and the page returns US tons, metric tonnes and pounds, handy for checking a trailer rating, a dump-truck ticket or a delivery surcharge before you place an order.',
    inputs: [
      num('cy', 'Cubic yards', 10, 0, 1e9),
      sel('mat', 'Material', 'gravel', [
        ['gravel', 'Gravel (about 1.4 tons per cubic yard)'],
        ['crushed', 'Crushed stone (about 1.5)'],
        ['sand', 'Sand (about 1.35)'],
        ['topsoil', 'Topsoil (about 1.1)'],
        ['mulch', 'Mulch (about 0.4)'],
        ['concrete', 'Concrete (about 2)'],
      ]),
    ],
    outputs: [out('tons', 'US tons', true), out('tonnes', 'Metric tonnes'), out('lb', 'Pounds')],
    calculate: (i) => {
      const tons = toD(i.cy).mul(DENSITY[String(i.mat)] ?? '1.4');
      return { tons: `${fmtNumber(tons, 2)} tons`, tonnes: `${fmtNumber(tons.mul('0.90718474'), 2)} tonnes`, lb: `${fmtNumber(tons.mul(2000), 0)} lb` };
    },
    formulaDescription:
      'Tons = cubic yards × density in tons per cubic yard (gravel 1.4, crushed stone 1.5, sand 1.35, topsoil 1.1, mulch 0.4, concrete 2). One US short ton is 2,000 lb and 0.90718474 metric tonnes. Densities are typical figures for loose or placed material.',
    formulaLatex: 'W = V_{yd^{3}} \\times \\rho',
    workedExample:
      '10 cubic yards of gravel weigh about 14 tons, which is 12.7 metric tonnes or 28,000 lb. 3.5 cubic yards of concrete is 7 tons, and 25 cubic yards of mulch only 10 tons.',
    faq: [
      {
        question: 'Why do suppliers give different figures?',
        answer: "Density changes with the stone, its size and its moisture, so use your supplier's figure when you have it.",
      },
      { question: 'Are these short or metric tons?', answer: 'US short tons of 2,000 lb; the metric tonne is shown too.' },
      {
        question: 'How do I get the cubic yards?',
        answer: 'Multiply the length, width and depth in feet and divide by 27; the cubic yards calculator does it with a waste allowance.',
      },
    ],
    scenarios: [
      [10, 'gravel'],
      [3.5, 'concrete'],
      [25, 'mulch'],
      [12, 'topsoil'],
      [8, 'sand'],
      [15, 'crushed'],
      [1, 'gravel'],
      [40, 'mulch'],
      [6.5, 'concrete'],
      [20, 'sand'],
      [2.25, 'topsoil'],
      [30, 'crushed'],
    ].map(([cy, mat]) => ({ label: `haul ${cy} yd³ ${mat}`, inputs: { cy, mat } })),
    introOutputs: ['tons'],
    relatedSlugs: ['cubic-yards-calculator', 'gravel-calculator', 'concrete-calculator'],
    checks: [
      { inputs: {}, expect: { tons: '14 tons', tonnes: '12.7 tonnes', lb: '28,000 lb' } },
      { inputs: { cy: 3.5, mat: 'concrete' }, expect: { tons: '7 tons', tonnes: '6.35 tonnes', lb: '14,000 lb' } },
      { inputs: { cy: 25, mat: 'mulch' }, expect: { tons: '10 tons', tonnes: '9.07 tonnes', lb: '20,000 lb' } },
      { inputs: { cy: 12, mat: 'topsoil' }, expect: { tons: '13.2 tons', tonnes: '11.97 tonnes', lb: '26,400 lb' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
