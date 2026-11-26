import { z } from 'zod';
import { numberField, selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtCurrency, fmtNumber, plural } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 20b (construction): measuring and ordering for home projects: floor area, wall area with paint,
 * gravel and soil, roofing, tank volume and tile. Every coverage rate, density and waste figure is a typical
 * default that is also an input or is stated on the page; real products vary, so the pages say to check the
 * supplier. Construction pages render the category disclaimer. Tier 2 or 3, so none is live until the cohort gate opens.
 */

const PI = D.acos(-1);
const num = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max }),
});
const pos = (name: string, label: string, def: number, max = 1e9) => num(name, label, def, 0.000001, max);
const sel = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});
const out = (name: string, label: string, highlight = false) => ({ name, label, format: 'text' as const, ...(highlight ? { highlight: true } : {}) });
const SQM_PER_SQFT = '10.76391041670972';
const AREA_LIST = /^\s*\d+(\.\d+)?\s*[x×]\s*\d+(\.\d+)?\s*([,;\n]\s*\d+(\.\d+)?\s*[x×]\s*\d+(\.\d+)?\s*)*$/;
const DENSITY: Record<string, string> = { gravel: '1.4', sand: '1.35', topsoil: '1.1', crushed: '1.5', mulch: '0.4' };
const GAL_M3 = '0.003785411784';
const ceilInt = (x: Dec): number => Number(x.toFixed(0, D.ROUND_CEIL));

export const SPECS: Spec[] = [
  {
    slug: 'square-footage-calculator',
    category: 'construction',
    tier: 2,
    subCluster: 'Measuring',
    title: 'Square Footage Calculator: Total Area of Rooms and Spaces',
    h1: 'Square Footage Calculator',
    metaDescription:
      'Add up the area of several rectangular rooms or spaces in square feet, square metres and square yards, with the cost at a price per square foot.',
    about:
      'Flooring, paint, carpet and even rent are priced by area, so the first job is measuring it. Break the space into rectangles, write each as length by width such as 12x10, and separate them with commas. Say whether you measured in feet or in metres. The calculator multiplies each pair, adds them up and returns the total in square feet, square metres and square yards. Enter a price per square foot to see the cost of covering the whole area.',
    inputs: [
      {
        name: 'rooms',
        label: 'Rectangles as length x width (e.g. 12x10, 8x8)',
        type: 'text' as const,
        default: '12x10, 8x8, 14x9.5',
        validator: z.string().refine((v) => AREA_LIST.test(v), 'Enter rectangles like 12x10, 8x8'),
      },
      sel('unit', 'Measured in', 'ft', [
        ['ft', 'Feet'],
        ['m', 'Metres'],
      ]),
      num('price', 'Price per square foot ($)', 4.5, 0, 1e6),
    ],
    outputs: [
      out('sf', 'Total area', true),
      out('sm', 'In square metres'),
      out('sy', 'In square yards'),
      out('cost', 'Cost at the price per square foot'),
      out('n', 'Number of areas added'),
    ],
    calculate: (i) => {
      const rects = String(i.rooms)
        .split(/[,;\n]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      let area = new D(0);
      for (const t of rects) {
        const [a, b] = t.toLowerCase().replace('×', 'x').split('x');
        area = area.plus(toD(a).mul(toD(b)));
      }
      const sf = String(i.unit) === 'm' ? area.mul(SQM_PER_SQFT) : area;
      const sm = String(i.unit) === 'm' ? area : area.div(SQM_PER_SQFT);
      return {
        sf: `${fmtNumber(sf, 2)} sq ft`,
        sm: `${fmtNumber(sm, 2)} m²`,
        sy: `${fmtNumber(sf.div(9), 2)} sq yd`,
        cost: fmtCurrency(sf.mul(toD(i.price))),
        n: String(rects.length),
      };
    },
    formulaDescription:
      'Area = Σ length × width over the rectangles. One square metre is 10.76391 square feet and one square yard is 9 square feet. Cost = square feet × price. For L-shaped or irregular rooms, split them into rectangles first.',
    formulaLatex: 'A = \\sum_{k} l_{k}\\,w_{k}',
    workedExample:
      'Rooms of 12 × 10, 8 × 8 and 14 × 9.5 feet add up to 120 + 64 + 133 = 317 sq ft, which is 29.45 m² or 35.22 sq yd. At $4.50 a square foot that is $1,426.50.',
    faq: [
      { question: 'How do I measure an L-shaped room?', answer: 'Split it into two rectangles, measure each and list both.' },
      {
        question: 'Should I add extra for waste?',
        answer: 'Yes, flooring and tile are normally bought with 5 to 15 percent extra for cuts and mistakes; the tile calculator includes it.',
      },
      {
        question: 'Does it subtract doors and cupboards?',
        answer: 'No. It adds the rectangles you list; leave out or list separately anything you do not want counted.',
      },
    ],
    scenarios: [
      ['12x10, 8x8, 14x9.5', 'ft', 4.5],
      ['16x12', 'ft', 3.25],
      ['5x4, 3.5x2.5', 'm', 12],
      ['20x15, 6x4', 'ft', 6.75],
      ['9.5x11.25, 7x7', 'ft', 5.1],
      ['4.2x3.6', 'm', 9.5],
      ['30x18, 10x10, 12x8', 'ft', 2.85],
      ['13x11.5', 'ft', 7.2],
      ['6x5, 2.5x2.5, 3x3.5', 'm', 15.5],
      ['24x14', 'ft', 3.9],
      ['8.5x8.5, 10x6', 'ft', 4.15],
      ['15x13, 9x9', 'ft', 8.4],
    ].map(([rooms, unit, price]) => ({ label: `${rooms} ${unit} at ${price}`, inputs: { rooms, unit, price } })),
    introOutputs: ['sf'],
    relatedSlugs: ['wall-square-footage-calculator', 'tile-calculator', 'rectangle-area-perimeter-calculator'],
    checks: [
      { inputs: {}, expect: { sf: '317 sq ft', sm: '29.45 m²', sy: '35.22 sq yd', cost: '$1,426.50', n: '3' } },
      {
        inputs: { rooms: '5x4, 3.5x2.5', unit: 'm', price: 120 },
        expect: { sf: '309.46 sq ft', sm: '28.75 m²', sy: '34.38 sq yd', cost: '$37,135.49', n: '2' },
      },
      { inputs: { rooms: '20x15' }, expect: { sf: '300 sq ft', sm: '27.87 m²', sy: '33.33 sq yd', cost: '$1,350.00', n: '1' } },
    ],
  },
  {
    slug: 'wall-square-footage-calculator',
    category: 'construction',
    tier: 2,
    subCluster: 'Painting and finishing',
    title: 'Wall Square Footage Calculator: Net Wall Area and Paint Needed',
    h1: 'Wall Square Footage Calculator',
    metaDescription:
      'Calculate the wall area to paint or panel from the total length and height, minus doors and windows, with the gallons of paint needed for your number of coats.',
    about:
      'The area you actually paint is the wall area minus the openings. Enter the total length of wall you will cover, the ceiling height, how many doors and windows there are and the area of each. The calculator returns the gross and net wall area and the area of the openings. Add the number of coats and the coverage a gallon of your paint gives, printed on the can, and it works out the paint needed, including the whole gallons to buy.',
    inputs: [
      pos('L', 'Total length of wall (ft)', 40, 100000),
      pos('H', 'Wall height (ft)', 8, 1000),
      num('dn', 'Number of doors', 2, 0, 1000),
      num('da', 'Area of one door (sq ft)', 21, 0, 1000),
      num('wn', 'Number of windows', 4, 0, 1000),
      num('wa', 'Area of one window (sq ft)', 15, 0, 1000),
      num('coats', 'Coats of paint', 2, 1, 10),
      num('cov', 'Coverage per gallon (sq ft)', 350, 50, 1000),
    ],
    outputs: [
      out('net', 'Net wall area', true),
      out('gross', 'Gross wall area'),
      out('open', 'Doors and windows'),
      out('gal', 'Paint needed'),
      out('buy', 'Whole gallons to buy'),
    ],
    calculate: (i) => {
      const gross = toD(i.L).mul(toD(i.H));
      const open = toD(i.dn)
        .mul(toD(i.da))
        .plus(toD(i.wn).mul(toD(i.wa)));
      const net = gross.minus(open);
      const gal = net.mul(toD(i.coats)).div(toD(i.cov));
      return {
        net: `${fmtNumber(net, 2)} sq ft`,
        gross: `${fmtNumber(gross, 2)} sq ft`,
        open: `${fmtNumber(open, 2)} sq ft`,
        gal: `${fmtNumber(gal, 2)} gallons`,
        buy: plural(ceilInt(gal), 'gallon'),
      };
    },
    formulaDescription:
      'Gross area = length × height. Net area = gross − (doors × door area + windows × window area). Paint = net × coats ÷ coverage per gallon, rounded up to whole gallons. A standard door is about 21 sq ft (3 × 7 ft); coverage is printed on the can and is typically 250 to 400 sq ft.',
    formulaLatex: 'A_{net} = L\\,H - \\sum A_{openings}',
    workedExample:
      '40 ft of wall 8 ft high is 320 sq ft. Two doors (21 each) and four windows (15 each) take out 102, leaving 218 sq ft. Two coats at 350 sq ft per gallon need 1.25 gallons, so buy 2.',
    faq: [
      { question: 'How many coats do I need?', answer: 'Usually two over an existing colour; one over fresh primer; more for a dramatic change.' },
      { question: 'Should I paint the ceiling too?', answer: 'This page covers walls; add the ceiling area separately.' },
      { question: 'Where does the coverage figure come from?', answer: 'The paint can. Rough or porous walls take more paint than smooth ones.' },
    ],
    scenarios: varied(
      'wall-square-footage-calculator',
      12,
      [
        { name: 'L', lo: 12, hi: 180, step: 1 },
        { name: 'H', lo: 7.5, hi: 12, step: 0.5 },
        { name: 'dn', lo: 0, hi: 5, step: 1 },
        { name: 'wn', lo: 0, hi: 9, step: 1 },
        { name: 'coats', lo: 1, hi: 3, step: 1 },
      ],
      [],
      (v) => `${v.L} ft by ${v.H} ft, ${v.dn} doors, ${v.wn} windows, ${v.coats} coats`,
    ),
    introOutputs: ['net', 'buy'],
    relatedSlugs: ['square-footage-calculator', 'paint-calculator', 'rectangle-area-perimeter-calculator'],
    checks: [
      { inputs: {}, expect: { net: '218 sq ft', gross: '320 sq ft', open: '102 sq ft', gal: '1.25 gallons', buy: '2 gallons' } },
      {
        inputs: { L: 22, H: 9, dn: 1, wn: 2, coats: 1, cov: 400 },
        expect: { net: '147 sq ft', gross: '198 sq ft', open: '51 sq ft', gal: '0.37 gallons', buy: '1 gallon' },
      },
      { inputs: { L: 60, H: 10, dn: 0, wn: 0 }, expect: { net: '600 sq ft', gross: '600 sq ft', open: '0 sq ft', gal: '3.43 gallons', buy: '4 gallons' } },
    ],
  },
  {
    slug: 'gravel-calculator',
    category: 'construction',
    tier: 2,
    subCluster: 'Bulk materials',
    title: 'Gravel Calculator: Cubic Yards and Tons for a Driveway or Bed',
    h1: 'Gravel Calculator',
    metaDescription:
      'Estimate the cubic yards and tons of gravel, sand, topsoil, crushed stone or mulch needed to cover an area to a given depth, with a waste allowance.',
    about:
      'A driveway, a garden path or a drainage trench gets filled with crushed rock, and the quarry bills by the ton while you pace out the space in feet. The weight hinges on how heavy the stone is, so enter the length, the width and the layer thickness in inches, pick the kind of fill and add a margin for compaction. You get a tonnage to quote at the yard, plus the equivalent cubic yards and cubic feet. Moisture and grade change the weight, so ask the supplier for theirs.',
    inputs: [
      pos('L', 'Length (ft)', 20, 100000),
      pos('W', 'Width (ft)', 10, 100000),
      pos('D', 'Depth (inches)', 3, 1000),
      sel('mat', 'Material', 'gravel', [
        ['gravel', 'Gravel (about 1.4 tons per cubic yard)'],
        ['crushed', 'Crushed stone (about 1.5)'],
        ['sand', 'Sand (about 1.35)'],
        ['topsoil', 'Topsoil (about 1.1)'],
        ['mulch', 'Mulch (about 0.4)'],
      ]),
      num('waste', 'Waste and settling (%)', 5, 0, 100),
    ],
    outputs: [out('cy', 'Volume', true), out('tons', 'Weight'), out('cuft', 'Volume in cubic feet')],
    calculate: (i) => {
      const cuft = toD(i.L).mul(toD(i.W)).mul(toD(i.D)).div(12);
      const k = new D(1).plus(toD(i.waste).div(100));
      const cy = cuft.div(27).mul(k);
      return {
        cy: `${fmtNumber(cy, 2)} cubic yards`,
        tons: `${fmtNumber(cy.mul(new D(DENSITY[String(i.mat)] ?? '1.4')), 2)} tons`,
        cuft: `${fmtNumber(cuft.mul(k), 1)} cubic feet`,
      };
    },
    formulaDescription:
      'Volume = length × width × depth ÷ 12 cubic feet; ÷ 27 for cubic yards; × (1 + waste %). Weight = cubic yards × density. Typical densities in tons per cubic yard: gravel 1.4, crushed stone 1.5, sand 1.35, topsoil 1.1, mulch 0.4. Tons here are US short tons.',
    formulaLatex: 'V_{yd^{3}} = \\dfrac{L \\cdot W \\cdot D / 12}{27}',
    workedExample:
      'A 20 ft by 10 ft bed 3 inches deep is 50 cubic feet. With 5% waste that is 1.94 cubic yards, or 2.72 tons of gravel at 1.4 tons per cubic yard, or 52.5 cubic feet.',
    faq: [
      {
        question: 'How deep should a gravel driveway be?',
        answer: 'Often 4 to 6 inches over a compacted base, but it depends on traffic and soil; ask a local supplier.',
      },
      {
        question: 'Why do suppliers quote different tons per yard?',
        answer: "Density changes with the stone, its size and its moisture, so use the supplier's figure when you have it.",
      },
      { question: 'What about the compaction?', answer: 'Loose material settles, which is why a waste allowance of 5 to 10 percent is sensible.' },
    ],
    scenarios: varied(
      'gravel-calculator',
      12,
      [
        { name: 'L', lo: 6, hi: 140, step: 1 },
        { name: 'W', lo: 3, hi: 60, step: 1 },
        { name: 'D', lo: 1, hi: 9, step: 0.5 },
        { name: 'waste', lo: 0, hi: 15, step: 1 },
      ],
      [{ name: 'mat', options: ['gravel', 'crushed', 'sand', 'topsoil', 'mulch'] }],
      (v) => `${v.mat} fill, strip ${v.L} x ${v.W} ft, layer ${v.D} in, margin ${v.waste}%`,
    ),
    introOutputs: ['tons'],
    relatedSlugs: ['cubic-yards-calculator', 'concrete-calculator', 'volume-calculator'],
    checks: [
      { inputs: {}, expect: { cy: '1.94 cubic yards', tons: '2.72 tons', cuft: '52.5 cubic feet' } },
      { inputs: { L: 30, W: 4, D: 4, mat: 'sand', waste: 10 }, expect: { cy: '1.63 cubic yards', tons: '2.2 tons', cuft: '44 cubic feet' } },
      { inputs: { L: 12, W: 12, D: 2, mat: 'mulch', waste: 0 }, expect: { cy: '0.89 cubic yards', tons: '0.36 tons', cuft: '24 cubic feet' } },
    ],
  },
  {
    slug: 'roofing-calculator',
    category: 'construction',
    tier: 3,
    subCluster: 'Roofing',
    title: 'Roofing Calculator: Roof Area, Squares and Shingle Bundles',
    h1: 'Roofing Calculator',
    metaDescription:
      'Estimate the roof area, the number of roofing squares and the bundles of shingles needed from the building footprint, overhang, pitch and waste allowance.',
    about:
      'A sloped roof is larger than the floor plan beneath it, and the steeper the pitch the bigger the difference. Enter the length and width of the building, the overhang at the eaves and the pitch as inches of rise per 12 inches of run, plus a waste percentage for cuts and starter courses. The calculator works out the roof area using the pitch factor, converts it into roofing squares, each 100 square feet, and gives the bundles of shingles at three bundles a square. It assumes a simple gable roof with two equal sides.',
    inputs: [
      pos('L', 'Building length (ft)', 40, 10000),
      pos('W', 'Building width (ft)', 30, 10000),
      num('ov', 'Overhang on each side (ft)', 1, 0, 20),
      num('pitch', 'Pitch (inches of rise per 12 of run)', 6, 0, 24),
      num('waste', 'Waste allowance (%)', 10, 0, 100),
    ],
    outputs: [
      out('area', 'Roof area', true),
      out('sq', 'Roofing squares (with waste)'),
      out('bundles', 'Shingle bundles (3 per square)'),
      out('factor', 'Pitch factor'),
    ],
    calculate: (i) => {
      const ov = toD(i.ov);
      const flat = toD(i.L)
        .plus(ov.mul(2))
        .mul(toD(i.W).plus(ov.mul(2)));
      const factor = new D(1).plus(toD(i.pitch).div(12).pow(2)).sqrt();
      const area = flat.mul(factor);
      const tot = area.mul(new D(1).plus(toD(i.waste).div(100)));
      return {
        area: `${fmtNumber(area, 1)} sq ft`,
        sq: `${fmtNumber(tot.div(100), 2)} squares`,
        bundles: plural(ceilInt(tot.div(100).mul(3)), 'bundle'),
        factor: fmtNumber(factor, 4),
      };
    },
    formulaDescription:
      'Footprint = (length + 2 × overhang) × (width + 2 × overhang). Roof area = footprint × √(1 + (pitch ÷ 12)²). One square = 100 sq ft; shingles are about 3 bundles per square; the waste percentage is applied to the area. Simple gable roof only: hips, valleys and dormers add area.',
    formulaLatex: 'A = A_{plan}\\sqrt{1 + (p/12)^{2}}',
    workedExample:
      'A 40 × 30 ft building with a 1 ft overhang and a 6/12 pitch: footprint 42 × 32 = 1,344 sq ft, pitch factor 1.118, roof area 1,502.6 sq ft. With 10% waste that is 16.53 squares, so 50 bundles of shingles.',
    faq: [
      { question: 'What is a roofing square?', answer: 'An area of 100 square feet, the unit shingles and roofing labour are priced in.' },
      { question: 'What does a 6/12 pitch mean?', answer: 'The roof rises 6 inches for every 12 inches of horizontal run.' },
      {
        question: 'Is the estimate good enough to order?',
        answer: 'It is a planning estimate for a simple roof. Roofers measure the actual roof and allow for hips, valleys and flashing.',
      },
    ],
    scenarios: varied(
      'roofing-calculator',
      12,
      [
        { name: 'L', lo: 20, hi: 90, step: 1 },
        { name: 'W', lo: 16, hi: 50, step: 1 },
        { name: 'ov', lo: 0, hi: 2, step: 0.5 },
        { name: 'pitch', lo: 2, hi: 12, step: 1 },
        { name: 'waste', lo: 5, hi: 20, step: 1 },
      ],
      [],
      (v) => `${v.L} by ${v.W} ft, ${v.ov} ft overhang, ${v.pitch}/12, ${v.waste}% waste`,
    ),
    introOutputs: ['area', 'bundles'],
    relatedSlugs: ['square-footage-calculator', 'wall-square-footage-calculator', 'right-triangle-calculator'],
    checks: [
      { inputs: {}, expect: { area: '1,502.6 sq ft', sq: '16.53 squares', bundles: '50 bundles', factor: '1.118' } },
      { inputs: { L: 50, W: 28, ov: 1.5, pitch: 9, waste: 15 }, expect: { area: '2,053.8 sq ft', sq: '23.62 squares', bundles: '71 bundles', factor: '1.25' } },
      { inputs: { L: 24, W: 24, ov: 0, pitch: 0, waste: 0 }, expect: { area: '576 sq ft', sq: '5.76 squares', bundles: '18 bundles', factor: '1' } },
    ],
  },
  {
    slug: 'tank-volume-calculator',
    category: 'construction',
    tier: 3,
    subCluster: 'Tanks and containers',
    title: 'Tank Volume Calculator: Vertical, Horizontal and Rectangular Tanks',
    h1: 'Tank Volume Calculator',
    metaDescription:
      'Calculate the capacity of a vertical or horizontal cylindrical tank or a rectangular tank in US gallons and litres, and the volume at a given fill level.',
    about:
      'The capacity of a tank depends on its shape. A vertical cylinder is a circle times the height, a rectangular tank is length times width times height, and a horizontal cylinder is a circle times its length, but the liquid in a partly full horizontal tank forms a circular segment, so volume does not rise in proportion to depth. Choose the shape and units, enter the dimensions and the fill level and read the full capacity and the current volume in US gallons and litres.',
    inputs: [
      sel('shape', 'Tank shape', 'vcyl', [
        ['vcyl', 'Vertical cylinder (a = diameter, b = height)'],
        ['rect', 'Rectangular (a × b × c)'],
        ['hcyl', 'Horizontal cylinder (a = diameter, b = length)'],
      ]),
      pos('a', 'Dimension a', 48, 100000),
      pos('b', 'Dimension b', 72, 100000),
      pos('c', 'Dimension c (rectangular height)', 24, 100000),
      sel('unit', 'Dimensions are in', 'in', [
        ['in', 'Inches'],
        ['ft', 'Feet'],
        ['cm', 'Centimetres'],
        ['m', 'Metres'],
      ]),
      num('fill', 'Fill level (% of height or diameter)', 100, 0, 100),
    ],
    outputs: [out('vol', 'Full capacity', true), out('l', 'In litres'), out('cur', 'Volume at the fill level'), out('m3', 'In cubic metres')],
    calculate: (i) => {
      const k = new D({ in: '0.0254', ft: '0.3048', cm: '0.01', m: '1' }[String(i.unit)] ?? '1');
      const a = toD(i.a).mul(k);
      const b = toD(i.b).mul(k);
      const c = toD(i.c).mul(k);
      const fill = toD(i.fill).div(100);
      const shape = String(i.shape);
      let vol: Dec;
      let cur: Dec;
      if (shape === 'vcyl') {
        vol = PI.mul(a.div(2).pow(2)).mul(b);
        cur = vol.mul(fill);
      } else if (shape === 'rect') {
        vol = a.mul(b).mul(c);
        cur = vol.mul(fill);
      } else {
        const r = a.div(2);
        vol = PI.mul(r.pow(2)).mul(b);
        const h = fill.mul(a);
        const seg = h.gte(a)
          ? PI.mul(r.pow(2))
          : h.lte(0)
            ? new D(0)
            : r
                .pow(2)
                .mul(D.acos(r.minus(h).div(r)))
                .minus(r.minus(h).mul(r.mul(h).mul(2).minus(h.pow(2)).sqrt()));
        cur = seg.mul(b);
      }
      return {
        vol: `${fmtNumber(vol.div(GAL_M3), 1)} US gallons`,
        l: `${fmtNumber(vol.mul(1000), 1)} litres`,
        cur: `${fmtNumber(cur.div(GAL_M3), 1)} US gallons`,
        m3: `${fmtNumber(vol, 3)} m³`,
      };
    },
    formulaDescription:
      'Vertical cylinder π r² h; rectangular a b c; horizontal cylinder π r² L. For a horizontal tank filled to depth h, the liquid cross-section is r² acos((r − h) ÷ r) − (r − h) √(2rh − h²), times the length; the fill level is the depth as a percentage of the diameter. One US gallon is 3.785411784 litres.',
    formulaLatex: 'V = \\pi r^{2} h',
    workedExample:
      'A vertical tank 48 in across and 72 in tall holds 564 US gallons (2,135 litres, 2.135 m³). A horizontal tank 1.2 m across and 3 m long holds 896.3 US gallons, and 175.2 gallons when the liquid is 25% of the way up the diameter.',
    faq: [
      {
        question: 'Why is a horizontal tank at half depth exactly half full?',
        answer: 'By symmetry the liquid fills half the circle; at other depths the volume is not proportional to depth.',
      },
      { question: 'Do the dimensions mean inside or outside?', answer: 'Use inside dimensions: wall thickness reduces the real capacity.' },
      { question: 'What about tanks with domed ends?', answer: "The domes add volume that this page does not include; use the manufacturer's capacity." },
    ],
    scenarios: varied(
      'tank-volume-calculator',
      12,
      [
        { name: 'a', lo: 10, hi: 120, step: 1 },
        { name: 'b', lo: 12, hi: 180, step: 1 },
        { name: 'c', lo: 8, hi: 80, step: 1 },
        { name: 'fill', lo: 10, hi: 100, step: 5 },
      ],
      [
        { name: 'shape', options: ['vcyl', 'rect', 'hcyl'] },
        { name: 'unit', options: ['in'] },
      ],
      (v) => `${v.shape} ${v.a} ${v.b} ${v.c} in, ${v.fill}% full`,
    ),
    introOutputs: ['vol', 'cur'],
    relatedSlugs: ['volume-calculator', 'cylinder-surface-area-calculator', 'hydrostatic-pressure-calculator'],
    checks: [
      { inputs: {}, expect: { vol: '564 US gallons', l: '2,135 litres', cur: '564 US gallons', m3: '2.135 m³' } },
      {
        inputs: { shape: 'rect', a: 10, b: 4, c: 3, unit: 'ft', fill: 50 },
        expect: { vol: '897.7 US gallons', l: '3,398 litres', cur: '448.8 US gallons', m3: '3.398 m³' },
      },
      {
        inputs: { shape: 'hcyl', a: 1.2, b: 3, unit: 'm', fill: 25 },
        expect: { vol: '896.3 US gallons', l: '3,392.9 litres', cur: '175.2 US gallons', m3: '3.393 m³' },
      },
      {
        inputs: { shape: 'hcyl', a: 1.2, b: 3, unit: 'm', fill: 100 },
        expect: { vol: '896.3 US gallons', l: '3,392.9 litres', cur: '896.3 US gallons', m3: '3.393 m³' },
      },
    ],
  },
  {
    slug: 'tile-calculator',
    category: 'construction',
    tier: 2,
    subCluster: 'Flooring and tile',
    title: 'Tile Calculator: How Many Tiles and Boxes for a Floor or Wall',
    h1: 'Tile Calculator',
    metaDescription: 'Calculate how many tiles and boxes you need to cover a floor or wall from the area, tile size, grout joint width and a waste allowance.',
    about:
      'The number of tiles for a job depends on the area, the size of each tile and the grout joint between them, plus extra for cuts, breakage and a few spares. Enter the length and width of the area in feet, the tile size in inches, the grout joint width and the waste percentage, 10 percent for a straight layout and more for diagonal patterns. If you know how many tiles come in a box the page also gives the whole boxes to buy, rounded up, with the area covered.',
    inputs: [
      pos('L', 'Area length (ft)', 12, 10000),
      pos('W', 'Area width (ft)', 10, 10000),
      pos('tl', 'Tile length (inches)', 12, 1000),
      pos('tw', 'Tile width (inches)', 12, 1000),
      num('g', 'Grout joint (inches)', 0.125, 0, 2),
      num('waste', 'Waste allowance (%)', 10, 0, 100),
      pos('box', 'Tiles per box', 10, 1000),
    ],
    outputs: [out('tiles', 'Tiles to buy (with waste)', true), out('base', 'Tiles with no waste'), out('boxes', 'Boxes to buy'), out('area', 'Area covered')],
    calculate: (i) => {
      const area = toD(i.L).mul(toD(i.W));
      const g = toD(i.g);
      const base = area.div(toD(i.tl).plus(g).mul(toD(i.tw).plus(g)).div(144));
      const need = ceilInt(base.mul(new D(1).plus(toD(i.waste).div(100))));
      return {
        tiles: plural(need, 'tile'),
        base: `${plural(ceilInt(base), 'tile')} without waste`,
        boxes: plural(ceilInt(new D(need).div(toD(i.box))), 'box', 'boxes'),
        area: `${fmtNumber(area, 2)} sq ft`,
      };
    },
    formulaDescription:
      'Each tile covers (tile length + joint) × (tile width + joint) ÷ 144 square feet. Tiles = area ÷ that, × (1 + waste %), rounded up. Boxes = tiles ÷ tiles per box, rounded up. Check the layout: a room is rarely an exact number of whole tiles.',
    formulaLatex: 'N = \\dfrac{A}{(t_{l} + j)(t_{w} + j)/144}\\,(1 + w)',
    workedExample: 'A 12 × 10 ft floor (120 sq ft) with 12-inch tiles and a ⅛-inch joint needs 118 tiles, or 130 with 10% waste, which is 13 boxes of 10.',
    faq: [
      {
        question: 'How much waste should I allow?',
        answer: 'About 10 percent for a straight layout, 15 or more for diagonal, herringbone or small awkward rooms.',
      },
      { question: 'Do I need spare tiles?', answer: 'It is wise to keep a box or a few tiles: the same dye lot may not be available later.' },
      { question: 'Does grout width matter?', answer: 'Slightly: a wider joint makes each tile cover a little more area, so you need fewer tiles.' },
    ],
    scenarios: varied(
      'tile-calculator',
      12,
      [
        { name: 'L', lo: 4, hi: 40, step: 0.5 },
        { name: 'W', lo: 3, hi: 30, step: 0.5 },
        { name: 'tl', lo: 4, hi: 48, step: 2 },
        { name: 'tw', lo: 4, hi: 24, step: 2 },
        { name: 'g', lo: 0.0625, hi: 0.25, step: 0.0625 },
        { name: 'waste', lo: 5, hi: 20, step: 1 },
        { name: 'box', lo: 4, hi: 44, step: 2 },
      ],
      [],
      (v) => `${v.L} by ${v.W} ft, ${v.tl} by ${v.tw} in tiles, ${v.waste}% waste`,
    ),
    introOutputs: ['tiles', 'boxes'],
    relatedSlugs: ['square-footage-calculator', 'wall-square-footage-calculator', 'concrete-calculator'],
    checks: [
      { inputs: {}, expect: { tiles: '130 tiles', base: '118 tiles without waste', boxes: '13 boxes', area: '120 sq ft' } },
      {
        inputs: { L: 8, W: 6, tl: 24, tw: 12, g: 0.1875, waste: 15, box: 8 },
        expect: { tiles: '27 tiles', base: '24 tiles without waste', boxes: '4 boxes', area: '48 sq ft' },
      },
      {
        inputs: { L: 10, W: 10, tl: 6, tw: 6, g: 0.125, waste: 0, box: 22 },
        expect: { tiles: '384 tiles', base: '384 tiles without waste', boxes: '18 boxes', area: '100 sq ft' },
      },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
