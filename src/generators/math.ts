import { numberField, numberListField, parseNumberList, selectField } from '../lib/calc-utils';
import { D, ONE, ZERO, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, mixed, spread, type Spec } from '../lib/spec';
import type { CalculatorConfig } from '../lib/types';

/**
 * Prompt 5, math.ts (item 5.5): geometry (area and perimeter for ten shapes), triangle solvers, percentage variants,
 * fractions, logarithms and powers, descriptive statistics and number theory. Built: 28 calculators. Not built:
 * the SSA ambiguous-case triangle and the AAS solver (they need a two-solution output the widget does not show yet).
 * All results are Tier 2 or 3 and so unpublished until their cohort is switched on.
 */

const PI = D.acos(-1);
const deg = (radians: Dec): Dec => radians.mul(180).div(PI);
const rad = (degrees: Dec): Dec => degrees.mul(PI).div(180);
const n2 = (x: Dec): string => fmtNumber(x, 2);

const pos = (name: string, label: string, def: number, max = 1e9) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min: 0.000001,
  max,
  validator: numberField({ min: 0.000001, max }),
});
const any = (name: string, label: string, def: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min: -1e12,
  max: 1e12,
  validator: numberField({ min: -1e12, max: 1e12 }),
});

const GEOMETRY_FAQ = (shape: string, formula: string): Spec['faq'] => [
  {
    question: `How do I find the area and perimeter of a ${shape}?`,
    answer: `Use ${formula}. Enter the measurements and the calculator applies it with exact decimal arithmetic.`,
  },
  {
    question: `What units does the ${shape} calculator use?`,
    answer: 'Any consistent unit. Lengths come out in the unit you enter, and the area in that unit squared.',
  },
  { question: `Why are the ${shape} results rounded?`, answer: 'They are shown to two decimal places; the calculation itself keeps 40 digits.' },
];

// ---------------------------------------------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------------------------------------------

const geometry: Spec[] = [
  {
    slug: 'square-area-perimeter-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Geometry',
    title: 'Square Area and Perimeter Calculator',
    h1: 'Square Area and Perimeter Calculator',
    metaDescription: 'Find the area, perimeter and diagonal of a square from the length of one side.',
    about:
      'A square has four equal sides and four right angles, so one measurement is enough to describe it completely. Its area is the side multiplied by itself, which is why numbers like 25 or 49 are called squares, and its perimeter is four times the side. The diagonal, which runs corner to corner, is the side times the square root of two. Use it for tiles, plots, picture frames or any square panel.',
    inputs: [pos('side', 'Side length', 12)],
    outputs: [
      { name: 'area', label: 'Area', format: 'text', highlight: true },
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
      { name: 'diagonal', label: 'Diagonal', format: 'text' },
    ],
    calculate: (i) => {
      const s = toD(i.side);
      return { area: n2(s.mul(s)), perimeter: n2(s.mul(4)), diagonal: n2(s.mul(D.sqrt(2))) };
    },
    formulaDescription: 'Area = s². Perimeter = 4s. Diagonal = s√2, from the Pythagorean theorem.',
    workedExample: 'A square with side 7: area 49, perimeter 28, diagonal 7 × 1.4142 = 9.90.',
    faq: GEOMETRY_FAQ('square', 'area = side × side and perimeter = 4 × side'),
    scenarios: spread('square-area-perimeter-calculator', [{ name: 'side', label: 'side' }]),
    relatedSlugs: ['rectangle-area-perimeter-calculator', 'circle-area-circumference-calculator'],
    checks: [
      { inputs: { side: 7 }, expect: { area: '49', perimeter: '28', diagonal: '9.9' } },
      { inputs: { side: 12.5 }, expect: { area: '156.25', perimeter: '50' } },
      { inputs: { side: 1 }, expect: { area: '1', diagonal: '1.41' } },
    ],
  },
  {
    slug: 'rectangle-area-perimeter-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Geometry',
    title: 'Rectangle Area and Perimeter Calculator',
    h1: 'Rectangle Area and Perimeter Calculator',
    metaDescription: 'Calculate the area, perimeter and diagonal of a rectangle from its length and width.',
    about:
      'A rectangle has opposite sides equal and four right angles. Multiply length by width for the area, which tells you how much surface it covers, and add the length and width and double it for the perimeter, the distance around the edge. The diagonal follows from the Pythagorean theorem. Floors, rooms, screens, fields and sheets of paper are all rectangles, so this is one of the most used geometry tools for estimating materials.',
    inputs: [pos('length', 'Length', 8), pos('width', 'Width', 5)],
    outputs: [
      { name: 'area', label: 'Area', format: 'text', highlight: true },
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
      { name: 'diagonal', label: 'Diagonal', format: 'text' },
    ],
    calculate: (i) => {
      const l = toD(i.length);
      const w = toD(i.width);
      return { area: n2(l.mul(w)), perimeter: n2(l.plus(w).mul(2)), diagonal: n2(D.sqrt(l.mul(l).plus(w.mul(w)))) };
    },
    formulaDescription: 'Area = length × width. Perimeter = 2 × (length + width). Diagonal = √(length² + width²).',
    workedExample: 'A rectangle 8 by 5: area 40, perimeter 26, diagonal √89 = 9.43.',
    faq: GEOMETRY_FAQ('rectangle', 'area = length × width and perimeter = 2 × (length + width)'),
    scenarios: spread('rectangle-area-perimeter-calculator', [
      { name: 'length', label: 'length' },
      { name: 'width', label: 'width' },
    ]),
    relatedSlugs: ['square-area-perimeter-calculator', 'paint-calculator'],
    checks: [
      { inputs: {}, expect: { area: '40', perimeter: '26', diagonal: '9.43' } },
      { inputs: { length: 12.5, width: 4 }, expect: { area: '50', perimeter: '33' } },
      { inputs: { length: 3, width: 4 }, expect: { diagonal: '5' } },
    ],
  },
  {
    slug: 'triangle-area-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Geometry',
    title: 'Triangle Area Calculator from Three Sides (Heron)',
    h1: 'Triangle Area Calculator',
    metaDescription: "Find the area and perimeter of a triangle from its three side lengths using Heron's formula. Rejects sides that cannot form a triangle.",
    about:
      "When you know all three sides of a triangle but not its height, Heron's formula gives the area directly. Add the sides to get the perimeter, halve it to get the semi-perimeter, then multiply the semi-perimeter by its differences from each side and take the square root. The sides must satisfy the triangle inequality: each side has to be shorter than the other two combined. The calculator checks this and tells you when the lengths cannot make a triangle.",
    inputs: [pos('a', 'Side a', 7), pos('b', 'Side b', 8), pos('c', 'Side c', 9)],
    outputs: [
      { name: 'area', label: 'Area', format: 'text', highlight: true },
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
      { name: 'semi', label: 'Semi-perimeter', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      const c = toD(i.c);
      if (a.plus(b).lte(c) || a.plus(c).lte(b) || b.plus(c).lte(a)) return { area: 'These sides cannot form a triangle', perimeter: '-', semi: '-' };
      const s = a.plus(b).plus(c).div(2);
      return { area: n2(D.sqrt(s.mul(s.minus(a)).mul(s.minus(b)).mul(s.minus(c)))), perimeter: n2(s.mul(2)), semi: n2(s) };
    },
    formulaDescription:
      'Heron: s = (a + b + c) ÷ 2; area = √(s(s − a)(s − b)(s − c)). Perimeter = a + b + c. Valid only if the sum of any two sides exceeds the third.',
    workedExample: 'Sides 3, 4, 5: s = 6; area = √(6 × 3 × 2 × 1) = √36 = 6; perimeter 12.',
    faq: GEOMETRY_FAQ('triangle', "Heron's formula with the three sides"),
    scenarios: spread(
      'triangle-area-calculator',
      [
        { name: 'a', label: 'a' },
        { name: 'b', label: 'b' },
        { name: 'c', label: 'c' },
      ],
      12,
      200,
      300,
    ),
    relatedSlugs: ['triangle-sss-calculator', 'right-triangle-calculator'],
    checks: [
      { inputs: { a: 3, b: 4, c: 5 }, expect: { area: '6', perimeter: '12' } },
      { inputs: {}, expect: { area: '26.83', perimeter: '24' } },
      { inputs: { a: 1, b: 2, c: 3 }, expect: { area: 'These sides cannot form a triangle' } },
    ],
  },
  {
    slug: 'circle-area-circumference-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Geometry',
    title: 'Circle Area and Circumference Calculator',
    h1: 'Circle Area and Circumference Calculator',
    metaDescription: 'Calculate the area, circumference and diameter of a circle from its radius using π to 40 digits.',
    about:
      "Every measurement of a circle follows from its radius, the distance from the centre to the edge. The circumference, the length of the boundary, is two pi times the radius, and the area is pi times the radius squared. Pi, about 3.14159, is the constant ratio of any circle's circumference to its diameter. This calculator uses pi to 40 digits so results stay exact to the displayed precision. Use it for wheels, pipes, round tables, pizzas and pond sizes.",
    inputs: [pos('radius', 'Radius', 5)],
    outputs: [
      { name: 'area', label: 'Area', format: 'text', highlight: true },
      { name: 'circumference', label: 'Circumference', format: 'text' },
      { name: 'diameter', label: 'Diameter', format: 'text' },
    ],
    calculate: (i) => {
      const r = toD(i.radius);
      return { area: n2(PI.mul(r).mul(r)), circumference: n2(PI.mul(r).mul(2)), diameter: n2(r.mul(2)) };
    },
    formulaDescription: 'Area = πr². Circumference = 2πr. Diameter = 2r.',
    formulaLatex: 'A = \\pi r^{2}, \\quad C = 2\\pi r',
    workedExample: 'Radius 5: area = π × 25 = 78.54; circumference = 2π × 5 = 31.42; diameter 10.',
    faq: GEOMETRY_FAQ('circle', 'area = πr² and circumference = 2πr'),
    scenarios: spread('circle-area-circumference-calculator', [{ name: 'radius', label: 'radius' }]),
    relatedSlugs: ['ellipse-area-perimeter-calculator', 'sector-area-arc-length-calculator'],
    checks: [
      { inputs: {}, expect: { area: '78.54', circumference: '31.42', diameter: '10' } },
      { inputs: { radius: 1 }, expect: { area: '3.14', circumference: '6.28' } },
      { inputs: { radius: 10 }, expect: { area: '314.16', circumference: '62.83' } },
    ],
  },
  {
    slug: 'trapezoid-area-perimeter-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Geometry',
    title: 'Trapezoid Area and Perimeter Calculator',
    h1: 'Trapezoid Area and Perimeter Calculator',
    metaDescription: 'Find the area and perimeter of a trapezoid from its two parallel bases, its height and its two slanted legs.',
    about:
      'A trapezoid, called a trapezium in British English, has one pair of parallel sides called the bases. Its area is the average of the two bases multiplied by the perpendicular height between them, and its perimeter adds all four sides, including the slanted legs. The height is not the length of a leg unless the leg is perpendicular. Roof sections, embankments, bridge supports and cross-sections of channels are often trapezoids.',
    inputs: [pos('a', 'Base a', 6), pos('b', 'Base b', 10), pos('h', 'Height', 4), pos('c', 'Leg c', 5), pos('d', 'Leg d', 5)],
    outputs: [
      { name: 'area', label: 'Area', format: 'text', highlight: true },
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
      { name: 'median', label: 'Median (mean of the bases)', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      return { area: n2(a.plus(b).div(2).mul(toD(i.h))), perimeter: n2(a.plus(b).plus(toD(i.c)).plus(toD(i.d))), median: n2(a.plus(b).div(2)) };
    },
    formulaDescription: 'Area = (a + b) ÷ 2 × h. Perimeter = a + b + c + d. The median is (a + b) ÷ 2.',
    workedExample: 'Bases 6 and 10, height 4, legs 5 and 5: area = 8 × 4 = 32; perimeter = 26.',
    faq: GEOMETRY_FAQ('trapezoid', 'area = (a + b) ÷ 2 × height and perimeter = a + b + c + d'),
    scenarios: spread('trapezoid-area-perimeter-calculator', [
      { name: 'a', label: 'base a' },
      { name: 'b', label: 'base b' },
      { name: 'h', label: 'height' },
    ]),
    relatedSlugs: ['parallelogram-area-perimeter-calculator', 'rectangle-area-perimeter-calculator'],
    checks: [
      { inputs: {}, expect: { area: '32', perimeter: '26', median: '8' } },
      { inputs: { a: 8, b: 12, h: 5 }, expect: { area: '50' } },
      { inputs: { a: 3, b: 3, h: 2, c: 2, d: 2 }, expect: { area: '6', perimeter: '10' } },
    ],
  },
  {
    slug: 'parallelogram-area-perimeter-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Geometry',
    title: 'Parallelogram Area and Perimeter Calculator',
    h1: 'Parallelogram Area and Perimeter Calculator',
    metaDescription: 'Compute the area and perimeter of a parallelogram from its base, slanted side and perpendicular height.',
    about:
      'A parallelogram has two pairs of parallel sides, and a rectangle is the special case with right angles. Its area is the base times the perpendicular height, not the base times the slanted side, because the height is measured straight up from the base. The perimeter is twice the sum of the base and the slanted side. If you know the slanted side and the angle instead, the height is the side times the sine of that angle.',
    inputs: [pos('base', 'Base', 10), pos('side', 'Slanted side', 6), pos('height', 'Height', 5)],
    outputs: [
      { name: 'area', label: 'Area', format: 'text', highlight: true },
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
    ],
    calculate: (i) => ({ area: n2(toD(i.base).mul(toD(i.height))), perimeter: n2(toD(i.base).plus(toD(i.side)).mul(2)) }),
    formulaDescription: 'Area = base × height (perpendicular). Perimeter = 2 × (base + slanted side).',
    workedExample: 'Base 10, slanted side 6, height 5: area 50, perimeter 32.',
    faq: GEOMETRY_FAQ('parallelogram', 'area = base × perpendicular height and perimeter = 2 × (base + side)'),
    scenarios: spread('parallelogram-area-perimeter-calculator', [
      { name: 'base', label: 'base' },
      { name: 'side', label: 'side' },
      { name: 'height', label: 'height' },
    ]),
    relatedSlugs: ['rhombus-area-perimeter-calculator', 'trapezoid-area-perimeter-calculator'],
    checks: [
      { inputs: {}, expect: { area: '50', perimeter: '32' } },
      { inputs: { base: 7.5, side: 4, height: 3 }, expect: { area: '22.5', perimeter: '23' } },
      { inputs: { base: 1, side: 1, height: 1 }, expect: { area: '1', perimeter: '4' } },
    ],
  },
  {
    slug: 'rhombus-area-perimeter-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Geometry',
    title: 'Rhombus Area and Perimeter Calculator',
    h1: 'Rhombus Area and Perimeter Calculator',
    metaDescription: "Calculate a rhombus's area from its two diagonals and its perimeter from its side length.",
    about:
      'A rhombus is a four-sided shape with all sides equal, like a square pushed sideways. Its diagonals cross at right angles and bisect each other, which gives the neat area formula of half the product of the two diagonals. The perimeter is four times the side. Kites, diamond-patterned floors and some jewellery cuts are rhombuses. If the side and one diagonal are known, the other diagonal follows from the Pythagorean theorem applied to one quarter of the shape.',
    inputs: [pos('side', 'Side', 5), pos('p', 'Diagonal p', 6), pos('q', 'Diagonal q', 8)],
    outputs: [
      { name: 'area', label: 'Area', format: 'text', highlight: true },
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
    ],
    calculate: (i) => ({ area: n2(toD(i.p).mul(toD(i.q)).div(2)), perimeter: n2(toD(i.side).mul(4)) }),
    formulaDescription: 'Area = (p × q) ÷ 2, with p and q the diagonals. Perimeter = 4 × side.',
    workedExample: 'Side 5 with diagonals 6 and 8: area = 24, perimeter = 20.',
    faq: GEOMETRY_FAQ('rhombus', 'area = (p × q) ÷ 2 and perimeter = 4 × side'),
    scenarios: spread('rhombus-area-perimeter-calculator', [
      { name: 'side', label: 'side' },
      { name: 'p', label: 'p' },
      { name: 'q', label: 'q' },
    ]),
    relatedSlugs: ['parallelogram-area-perimeter-calculator', 'square-area-perimeter-calculator'],
    checks: [
      { inputs: {}, expect: { area: '24', perimeter: '20' } },
      { inputs: { side: 13, p: 10, q: 24 }, expect: { area: '120', perimeter: '52' } },
      { inputs: { side: 2, p: 2, q: 2 }, expect: { area: '2' } },
    ],
  },
  {
    slug: 'ellipse-area-perimeter-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Geometry',
    title: 'Ellipse Area and Perimeter Calculator (Ramanujan)',
    h1: 'Ellipse Area and Perimeter Calculator',
    metaDescription: "Find the area of an ellipse exactly and its perimeter with Ramanujan's approximation, from the two semi-axes.",
    about:
      'An ellipse is a stretched circle described by a long and a short semi-axis. Its area has a simple exact formula, pi times the two semi-axes, but its perimeter has no closed form and needs an elliptic integral. Ramanujan found a compact approximation that is accurate to many digits for most shapes, and that is what this calculator uses. When the two semi-axes are equal the shape is a circle and the result matches the circle formula. Orbits, running tracks and oval windows are ellipses.',
    inputs: [pos('a', 'Semi-axis a', 5), pos('b', 'Semi-axis b', 3)],
    outputs: [
      { name: 'area', label: 'Area', format: 'text', highlight: true },
      { name: 'perimeter', label: 'Perimeter (approximate)', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      return {
        area: n2(PI.mul(a).mul(b)),
        perimeter: n2(
          PI.mul(
            a
              .plus(b)
              .mul(3)
              .minus(
                D.sqrt(
                  a
                    .mul(3)
                    .plus(b)
                    .mul(a.plus(b.mul(3))),
                ),
              ),
          ),
        ),
      };
    },
    formulaDescription: 'Area = π a b. Perimeter ≈ π [3(a + b) − √((3a + b)(a + 3b))] (Ramanujan, 1914), exact for a circle and very close otherwise.',
    workedExample: 'Semi-axes 5 and 3: area = 15π = 47.12; perimeter ≈ π(24 − √(18 × 14)) = 25.53.',
    faq: GEOMETRY_FAQ('ellipse', 'area = π × a × b and the Ramanujan approximation for the perimeter'),
    scenarios: spread('ellipse-area-perimeter-calculator', [
      { name: 'a', label: 'a' },
      { name: 'b', label: 'b' },
    ]),
    relatedSlugs: ['circle-area-circumference-calculator', 'sector-area-arc-length-calculator'],
    checks: [
      { inputs: {}, expect: { area: '47.12', perimeter: '25.53' } },
      { inputs: { a: 4, b: 4 }, expect: { area: '50.27', perimeter: '25.13' } },
      { inputs: { a: 1, b: 1 }, expect: { area: '3.14', perimeter: '6.28' } },
    ],
  },
  {
    slug: 'regular-polygon-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Geometry',
    title: 'Regular Polygon Calculator: Area, Perimeter and Apothem',
    h1: 'Regular Polygon Calculator',
    metaDescription: 'Calculate the area, perimeter and apothem of a regular polygon from the number of sides and the side length.',
    about:
      'A regular polygon has equal sides and equal angles: a triangle, square, pentagon, hexagon and so on. Given the number of sides and the length of one side, the perimeter is simply their product, while the area uses the apothem, the distance from the centre to the middle of a side, which comes from the tangent of pi divided by the number of sides. As the sides increase the shape approaches a circle. Honeycomb cells, nuts and bolts, and floor tiles are regular polygons.',
    inputs: [
      { name: 'n', label: 'Number of sides', type: 'number', default: 6, min: 3, max: 1000, validator: numberField({ min: 3, max: 1000, integer: true }) },
      pos('side', 'Side length', 10),
    ],
    outputs: [
      { name: 'area', label: 'Area', format: 'text', highlight: true },
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
      { name: 'apothem', label: 'Apothem', format: 'text' },
    ],
    calculate: (i) => {
      const n = toD(i.n);
      const s = toD(i.side);
      const apothem = s.div(twoTan(n));
      return { area: n2(n.mul(s).mul(apothem).div(2)), perimeter: n2(n.mul(s)), apothem: n2(apothem) };
    },
    formulaDescription: 'Perimeter = n × s. Apothem = s ÷ (2 tan(π ÷ n)). Area = ½ × perimeter × apothem = n s² ÷ (4 tan(π ÷ n)).',
    workedExample: 'A regular hexagon with side 10: apothem = 10 ÷ (2 tan 30°) = 8.66; area = ½ × 60 × 8.66 = 259.81; perimeter 60.',
    faq: GEOMETRY_FAQ('regular polygon', 'area = n × s² ÷ (4 tan(π ÷ n)) and perimeter = n × s'),
    scenarios: [
      [3, 41.25],
      [4, 96.5],
      [5, 10.8],
      [6, 73.4],
      [7, 62.9],
      [8, 35.6],
      [10, 144.2],
      [12, 25.7],
      [9, 88.3],
      [11, 52.1],
    ].map(([n, s]) => ({ label: `${n} sides of ${s}`, inputs: { n, side: s } })),
    relatedSlugs: ['square-area-perimeter-calculator', 'circle-area-circumference-calculator'],
    checks: [
      { inputs: {}, expect: { area: '259.81', perimeter: '60', apothem: '8.66' } },
      { inputs: { n: 5 }, expect: { area: '172.05', apothem: '6.88' } },
      { inputs: { n: 3, side: 4 }, expect: { area: '6.93', perimeter: '12', apothem: '1.15' } },
    ],
  },
  {
    slug: 'sector-area-arc-length-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Geometry',
    title: 'Sector Area and Arc Length Calculator',
    h1: 'Sector Area and Arc Length Calculator',
    metaDescription: 'Find the area and arc length of a circular sector from the radius and the central angle in degrees.',
    about:
      "A sector is a slice of a circle between two radii, like a piece of pizza. Its area and the length of its curved edge, the arc, are the same fractions of the whole circle's area and circumference as the central angle is of 360 degrees. Enter the radius and the angle in degrees; the calculator also gives the chord, the straight line joining the ends of the arc. Fan shapes, pie charts, pizza slices and clock-face segments are sectors.",
    inputs: [
      pos('radius', 'Radius', 6),
      { name: 'angle', label: 'Central angle (degrees)', type: 'number', default: 60, min: 0.01, max: 360, validator: numberField({ min: 0.01, max: 360 }) },
    ],
    outputs: [
      { name: 'area', label: 'Sector area', format: 'text', highlight: true },
      { name: 'arc', label: 'Arc length', format: 'text' },
      { name: 'chord', label: 'Chord length', format: 'text' },
    ],
    calculate: (i) => {
      const r = toD(i.radius);
      const t = toD(i.angle);
      return { area: n2(PI.mul(r).mul(r).mul(t).div(360)), arc: n2(PI.mul(r).mul(2).mul(t).div(360)), chord: n2(r.mul(2).mul(D.sin(rad(t).div(2)))) };
    },
    formulaDescription: 'Area = π r² × θ ÷ 360. Arc length = 2π r × θ ÷ 360. Chord = 2 r sin(θ ÷ 2), with θ in degrees.',
    workedExample: 'Radius 6 and angle 60°: area = 36π ÷ 6 = 18.85; arc = 12π ÷ 6 = 6.28; chord = 12 sin 30° = 6.',
    faq: GEOMETRY_FAQ('sector', 'area = πr² × angle ÷ 360 and arc = 2πr × angle ÷ 360'),
    scenarios: spread(
      'sector-area-arc-length-calculator',
      [
        { name: 'radius', label: 'radius' },
        { name: 'angle', label: 'angle' },
      ],
      12,
      5,
      180,
    ),
    relatedSlugs: ['circle-area-circumference-calculator', 'ellipse-area-perimeter-calculator'],
    checks: [
      { inputs: {}, expect: { area: '18.85', arc: '6.28', chord: '6' } },
      { inputs: { radius: 10, angle: 90 }, expect: { area: '78.54', arc: '15.71' } },
      { inputs: { radius: 5, angle: 360 }, expect: { area: '78.54', arc: '31.42' } },
    ],
  },
];

/** 2 tan(π ÷ n) for n sides: the divisor in the apothem formula, kept outside the spec so calculate() stays readable. */
function twoTan(n: Dec): Dec {
  return D.tan(PI.div(n)).mul(2);
}

// ---------------------------------------------------------------------------------------------------------------
// Triangle solvers
// ---------------------------------------------------------------------------------------------------------------

const degText = (x: Dec): string => `${n2(x)}°`;
const angleOf = (opposite: Dec, b: Dec, c: Dec): Dec => deg(D.acos(b.mul(b).plus(c.mul(c)).minus(opposite.mul(opposite)).div(b.mul(c).mul(2))));

const triangles: Spec[] = [
  {
    slug: 'right-triangle-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Triangle solvers',
    title: 'Right Triangle Calculator: Hypotenuse, Angles and Area',
    h1: 'Right Triangle Calculator',
    metaDescription: 'Solve a right triangle from its two legs: the hypotenuse by the Pythagorean theorem, both acute angles, the area and the perimeter.',
    about:
      'A right triangle has one 90-degree angle, and its two shorter sides are the legs. Given both legs, the hypotenuse follows from the Pythagorean theorem and the two acute angles from the inverse tangent. The area is half the product of the legs. Carpenters check square corners with the 3-4-5 triangle, surveyors measure slopes, and anyone laying a ladder against a wall solves a right triangle without knowing it.',
    inputs: [pos('a', 'Leg a', 3), pos('b', 'Leg b', 4)],
    outputs: [
      { name: 'hyp', label: 'Hypotenuse', format: 'text', highlight: true },
      { name: 'angleA', label: 'Angle opposite leg a', format: 'text' },
      { name: 'angleB', label: 'Angle opposite leg b', format: 'text' },
      { name: 'area', label: 'Area', format: 'text' },
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      const c = D.sqrt(a.mul(a).plus(b.mul(b)));
      return {
        hyp: n2(c),
        angleA: degText(deg(D.atan(a.div(b)))),
        angleB: degText(deg(D.atan(b.div(a)))),
        area: n2(a.mul(b).div(2)),
        perimeter: n2(a.plus(b).plus(c)),
      };
    },
    formulaDescription: 'c = √(a² + b²). Angle A = arctan(a ÷ b), angle B = arctan(b ÷ a). Area = ½ a b. Perimeter = a + b + c.',
    formulaLatex: 'c = \\sqrt{a^{2} + b^{2}}',
    workedExample: 'Legs 3 and 4: hypotenuse 5, angles 36.87° and 53.13°, area 6, perimeter 12.',
    faq: [
      {
        question: 'What is the Pythagorean theorem?',
        answer: 'In a right triangle the square of the hypotenuse equals the sum of the squares of the other two sides.',
      },
      {
        question: 'How do I find a leg if I know the hypotenuse?',
        answer: 'Subtract the square of the known leg from the square of the hypotenuse and take the square root.',
      },
      { question: 'Which angles are shown?', answer: 'The two acute angles, in degrees; the third angle is 90°.' },
    ],
    scenarios: spread('right-triangle-calculator', [
      { name: 'a', label: 'a' },
      { name: 'b', label: 'b' },
    ]),
    relatedSlugs: ['triangle-area-calculator', 'triangle-sss-calculator'],
    checks: [
      { inputs: {}, expect: { hyp: '5', angleA: '36.87°', angleB: '53.13°', area: '6', perimeter: '12' } },
      { inputs: { a: 5, b: 12 }, expect: { hyp: '13', angleA: '22.62°' } },
      { inputs: { a: 1, b: 1 }, expect: { hyp: '1.41', angleA: '45°' } },
    ],
  },
  {
    slug: 'triangle-sss-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Triangle solvers',
    title: 'SSS Triangle Calculator: Angles from Three Sides',
    h1: 'SSS Triangle Calculator (Side-Side-Side)',
    metaDescription: 'Find all three angles and the area of a triangle when you know its three sides, using the law of cosines.',
    about:
      "When all three sides of a triangle are known, its shape is completely fixed, and the law of cosines recovers each angle: the cosine of an angle equals the sum of the squares of the two adjacent sides minus the square of the opposite side, divided by twice the product of the adjacent sides. The area follows from Heron's formula. The three angles always add up to 180 degrees, which the calculator uses as a check. Land surveying and truss design often start from three measured lengths.",
    inputs: [pos('a', 'Side a', 7), pos('b', 'Side b', 8), pos('c', 'Side c', 9)],
    outputs: [
      { name: 'A', label: 'Angle A', format: 'text', highlight: true },
      { name: 'B', label: 'Angle B', format: 'text' },
      { name: 'C', label: 'Angle C', format: 'text' },
      { name: 'area', label: 'Area', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      const c = toD(i.c);
      if (a.plus(b).lte(c) || a.plus(c).lte(b) || b.plus(c).lte(a)) return { A: 'These sides cannot form a triangle', B: '-', C: '-', area: '-' };
      const s = a.plus(b).plus(c).div(2);
      return {
        A: degText(angleOf(a, b, c)),
        B: degText(angleOf(b, a, c)),
        C: degText(angleOf(c, a, b)),
        area: n2(D.sqrt(s.mul(s.minus(a)).mul(s.minus(b)).mul(s.minus(c)))),
      };
    },
    formulaDescription: "cos A = (b² + c² − a²) ÷ 2bc, and likewise for B and C. Area by Heron's formula. The three angles sum to 180°.",
    workedExample: 'Sides 7, 8, 9: A = 48.19°, B = 58.41°, C = 73.40°; area 26.83.',
    faq: [
      { question: 'When can three lengths form a triangle?', answer: 'When the sum of any two is greater than the third.' },
      { question: 'Why is the answer in degrees?', answer: 'Degrees are the usual unit for angles in practical work; the calculation converts from radians.' },
      { question: 'What is the law of cosines?', answer: 'A generalisation of the Pythagorean theorem that works for any triangle.' },
    ],
    scenarios: spread(
      'triangle-sss-calculator',
      [
        { name: 'a', label: 'a' },
        { name: 'b', label: 'b' },
        { name: 'c', label: 'c' },
      ],
      12,
      200,
      300,
    ),
    relatedSlugs: ['triangle-area-calculator', 'right-triangle-calculator'],
    checks: [
      { inputs: {}, expect: { A: '48.19°', B: '58.41°', C: '73.4°', area: '26.83' } },
      { inputs: { a: 3, b: 4, c: 5 }, expect: { C: '90°', A: '36.87°' } },
      { inputs: { a: 1, b: 1, c: 5 }, expect: { A: 'These sides cannot form a triangle' } },
    ],
  },
  {
    slug: 'triangle-sas-calculator',
    introOutputs: ['c'],
    category: 'math',
    tier: 3,
    subCluster: 'Triangle solvers',
    title: 'SAS Triangle Calculator: Third Side and Area',
    h1: 'SAS Triangle Calculator (Side-Angle-Side)',
    metaDescription: 'Solve a triangle from two sides and the angle between them: the third side by the law of cosines, plus the area.',
    about:
      'Two sides and the angle between them pin down a triangle uniquely, a case called side-angle-side. The law of cosines gives the third side from the two known sides and the included angle, and the area is half the product of the two sides times the sine of the angle between them. If the angle is 90 degrees the formula reduces to the Pythagorean theorem. This setup arises when a surveyor measures two distances from a point and the angle between the lines of sight, or when you know two fence lengths meeting at a corner and want the missing boundary, the brace on a gate frame, or the gap between the positions of two ships.',
    inputs: [
      pos('a', 'Side a', 7),
      pos('b', 'Side b', 10),
      {
        name: 'angle',
        label: 'Included angle C (degrees)',
        type: 'number',
        default: 60,
        min: 0.01,
        max: 179.99,
        validator: numberField({ min: 0.01, max: 179.99 }),
      },
    ],
    outputs: [
      { name: 'c', label: 'Third side c', format: 'text', highlight: true },
      { name: 'area', label: 'Area', format: 'text' },
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      const t = rad(toD(i.angle));
      const c = D.sqrt(
        a
          .mul(a)
          .plus(b.mul(b))
          .minus(a.mul(b).mul(2).mul(D.cos(t))),
      );
      return { c: n2(c), area: n2(a.mul(b).mul(D.sin(t)).div(2)), perimeter: n2(a.plus(b).plus(c)) };
    },
    formulaDescription: 'c² = a² + b² − 2ab cos C. Area = ½ a b sin C. Perimeter = a + b + c.',
    workedExample: 'Sides 7 and 10 with 60° between them: c = √(49 + 100 − 70) = 8.89; area = ½ × 70 × sin 60° = 30.31.',
    faq: [
      {
        question: 'Why must the angle be between the two sides?',
        answer: 'The formula uses the included angle. A different angle needs the law of sines instead.',
      },
      { question: 'What if the angle is 90°?', answer: 'The third side is the hypotenuse and the law of cosines becomes the Pythagorean theorem.' },
      { question: 'What angle range is allowed?', answer: 'Greater than 0° and less than 180°.' },
    ],
    scenarios: mixed(
      'triangle-sas-calculator',
      12,
      (r) => ({ a: r(12, 990), b: r(12, 990), angle: r(10, 170) }),
      (v) => `a ${v.a}, b ${v.b}, angle ${v.angle}`,
    ),
    relatedSlugs: ['triangle-sss-calculator', 'triangle-asa-calculator'],
    checks: [
      { inputs: {}, expect: { c: '8.89', area: '30.31' } },
      { inputs: { a: 6, b: 8, angle: 90 }, expect: { c: '10', area: '24', perimeter: '24' } },
      { inputs: { a: 5, b: 5, angle: 60 }, expect: { c: '5' } },
    ],
  },
  {
    slug: 'triangle-asa-calculator',
    introOutputs: ['a', 'b'],
    category: 'math',
    tier: 3,
    subCluster: 'Triangle solvers',
    title: 'ASA Triangle Calculator: Sides from Two Angles and a Side',
    h1: 'ASA Triangle Calculator (Angle-Side-Angle)',
    metaDescription: 'Solve a triangle from two angles and the side between them: the third angle, the other two sides by the law of sines, and the area.',
    about:
      'If you know two angles and the side that lies between them, the triangle is fully determined. The third angle is whatever remains of 180 degrees, and the law of sines, which says each side is proportional to the sine of its opposite angle, gives the remaining two sides. The area follows from the known side and the two adjacent sides. This is how a surveyor finds the distance to an object: measure a baseline, then the angles to the target from each end. The same method gives the width of a river from two bearings, or the height of a tower from sightings at two known spots.',
    inputs: [
      { name: 'A', label: 'Angle A (degrees)', type: 'number', default: 40, min: 0.01, max: 178, validator: numberField({ min: 0.01, max: 178 }) },
      { name: 'B', label: 'Angle B (degrees)', type: 'number', default: 60, min: 0.01, max: 178, validator: numberField({ min: 0.01, max: 178 }) },
      pos('c', 'Side c between them', 12),
    ],
    outputs: [
      { name: 'C', label: 'Third angle C', format: 'text', highlight: true },
      { name: 'a', label: 'Side a', format: 'text' },
      { name: 'b', label: 'Side b', format: 'text' },
      { name: 'area', label: 'Area', format: 'text' },
    ],
    calculate: (i) => {
      const A = toD(i.A);
      const B = toD(i.B);
      const c = toD(i.c);
      const C = new D(180).minus(A).minus(B);
      if (C.lte(0)) return { C: 'The two angles must add up to less than 180°', a: '-', b: '-', area: '-' };
      const k = c.div(D.sin(rad(C)));
      const a = k.mul(D.sin(rad(A)));
      const b = k.mul(D.sin(rad(B)));
      return {
        C: degText(C),
        a: n2(a),
        b: n2(b),
        area: n2(
          c
            .mul(a)
            .mul(D.sin(rad(B)))
            .div(2),
        ),
      };
    },
    formulaDescription: 'C = 180° − A − B. Law of sines: a ÷ sin A = b ÷ sin B = c ÷ sin C. Area = ½ c a sin B.',
    workedExample: 'A = 40°, B = 60°, c = 12: C = 80°; a = 12 sin 40° ÷ sin 80° = 7.83; b = 10.55; area = 40.70.',
    faq: [
      {
        question: 'Why must the two angles add to less than 180°?',
        answer: 'The three angles of a triangle add to exactly 180°, so the third would be zero or negative.',
      },
      { question: 'What is the law of sines?', answer: 'The ratio of a side to the sine of its opposite angle is the same for all three sides.' },
      {
        question: 'What if I know a side that is not between the angles?',
        answer: 'That is the AAS case; find the third angle first, then use the law of sines in the same way.',
      },
    ],
    scenarios: mixed(
      'triangle-asa-calculator',
      12,
      (r) => {
        const A = r(10, 80);
        return { A, B: r(10, 170 - A - 5), c: r(12, 990) };
      },
      (v) => `A ${v.A}°, B ${v.B}°, c ${v.c}`,
    ),
    relatedSlugs: ['triangle-sas-calculator', 'triangle-sss-calculator'],
    checks: [
      { inputs: {}, expect: { C: '80°', a: '7.83', b: '10.55', area: '40.7' } },
      { inputs: { A: 45, B: 45, c: 10 }, expect: { C: '90°', a: '7.07' } },
      { inputs: { A: 100, B: 80 }, expect: { C: 'The two angles must add up to less than 180°' } },
    ],
  },
  {
    slug: 'equilateral-triangle-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Triangle solvers',
    title: 'Equilateral Triangle Calculator: Area, Height and Perimeter',
    h1: 'Equilateral Triangle Calculator',
    metaDescription: 'Calculate the height, area, perimeter and inscribed circle radius of an equilateral triangle from its side length.',
    about:
      'An equilateral triangle has three equal sides and three 60-degree angles, so one number describes it. Its height splits it into two right triangles, giving a height of the side times the square root of three over two, and its area is the side squared times the square root of three over four. The centre where the medians meet is also the centre of the inscribed and circumscribed circles. Warning signs, truss members and the faces of tetrahedra are equilateral triangles.',
    inputs: [pos('side', 'Side length', 6)],
    outputs: [
      { name: 'area', label: 'Area', format: 'text', highlight: true },
      { name: 'height', label: 'Height', format: 'text' },
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
      { name: 'inradius', label: 'Inscribed circle radius', format: 'text' },
    ],
    calculate: (i) => {
      const s = toD(i.side);
      const r3 = D.sqrt(3);
      return { area: n2(s.mul(s).mul(r3).div(4)), height: n2(s.mul(r3).div(2)), perimeter: n2(s.mul(3)), inradius: n2(s.mul(r3).div(6)) };
    },
    formulaDescription: 'Height = s√3 ÷ 2. Area = s²√3 ÷ 4. Perimeter = 3s. Inscribed radius = s√3 ÷ 6.',
    workedExample: 'Side 6: height 5.20, area 15.59, perimeter 18, inscribed radius 1.73.',
    faq: [
      {
        question: 'Why is the height s√3 ÷ 2?',
        answer: 'Dropping a perpendicular splits the triangle into two 30-60-90 right triangles with hypotenuse s and short leg s ÷ 2.',
      },
      { question: 'What are the angles?', answer: 'All three are 60 degrees.' },
      {
        question: 'Is an equilateral triangle also isosceles?',
        answer: 'Yes, since it has at least two equal sides, though the term isosceles is usually kept for triangles with exactly two.',
      },
    ],
    scenarios: spread('equilateral-triangle-calculator', [{ name: 'side', label: 'side' }]),
    relatedSlugs: ['isosceles-triangle-calculator', 'regular-polygon-calculator'],
    checks: [
      { inputs: {}, expect: { area: '15.59', height: '5.2', perimeter: '18', inradius: '1.73' } },
      { inputs: { side: 10 }, expect: { area: '43.3', height: '8.66' } },
      { inputs: { side: 2 }, expect: { height: '1.73', perimeter: '6' } },
    ],
  },
  {
    slug: 'isosceles-triangle-calculator',
    introOutputs: ['height', 'apex'],
    category: 'math',
    tier: 3,
    subCluster: 'Triangle solvers',
    title: 'Isosceles Triangle Calculator: Height, Area and Angles',
    h1: 'Isosceles Triangle Calculator',
    metaDescription: 'Solve an isosceles triangle from its two equal sides and its base: height, area, perimeter and the base and apex angles.',
    about:
      'An isosceles triangle has two equal sides, called legs, and a third side called the base. The height drawn to the base bisects it and creates two matching right triangles, so the height is found with the Pythagorean theorem and the angles with inverse trigonometry. The two base angles are equal, and the angle at the top, the apex, is what remains of 180 degrees. Gables, roof trusses, tents, kite panels, pennant flags and many logos are isosceles triangles, which is why a quick height and angle check is handy for cutting symmetrical pieces.',
    inputs: [pos('leg', 'Equal side (leg)', 5), pos('base', 'Base', 6)],
    outputs: [
      { name: 'height', label: 'Height to the base', format: 'text', highlight: true },
      { name: 'area', label: 'Area', format: 'text' },
      { name: 'perimeter', label: 'Perimeter', format: 'text' },
      { name: 'baseAngle', label: 'Base angles', format: 'text' },
      { name: 'apex', label: 'Apex angle', format: 'text' },
    ],
    calculate: (i) => {
      const leg = toD(i.leg);
      const base = toD(i.base);
      if (base.gte(leg.mul(2))) return { height: 'The base must be shorter than twice the leg', area: '-', perimeter: '-', baseAngle: '-', apex: '-' };
      const h = D.sqrt(leg.mul(leg).minus(base.mul(base).div(4)));
      const baseAngle = deg(D.acos(base.div(2).div(leg)));
      return {
        height: n2(h),
        area: n2(base.mul(h).div(2)),
        perimeter: n2(leg.mul(2).plus(base)),
        baseAngle: degText(baseAngle),
        apex: degText(new D(180).minus(baseAngle.mul(2))),
      };
    },
    formulaDescription: 'Height = √(leg² − (base ÷ 2)²). Area = ½ × base × height. Base angle = arccos(base ÷ 2 ÷ leg). Apex = 180° − 2 × base angle.',
    workedExample: 'Legs 5 and base 6: height = √(25 − 9) = 4; area 12; perimeter 16; base angles 53.13°; apex 73.74°.',
    faq: [
      { question: 'Why must the base be less than twice the leg?', answer: 'Otherwise the two legs cannot meet above the base.' },
      { question: 'Are the base angles equal?', answer: 'Yes, in every isosceles triangle the angles opposite the equal sides are equal.' },
      { question: 'What if the base equals the leg?', answer: 'The triangle is equilateral, with all angles 60°.' },
    ],
    scenarios: [
      [52.5, 60],
      [107.4, 125.2],
      [75, 40.5],
      [130, 101.3],
      [91.7, 160.4],
      [200, 35.5],
      [42.2, 50.6],
      [150.8, 240],
      [18.9, 22.4],
      [64.3, 90.1],
    ].map(([leg, base]) => ({ label: `legs ${leg}, base ${base}`, inputs: { leg, base } })),
    relatedSlugs: ['equilateral-triangle-calculator', 'right-triangle-calculator'],
    checks: [
      { inputs: {}, expect: { height: '4', area: '12', perimeter: '16', baseAngle: '53.13°', apex: '73.74°' } },
      { inputs: { leg: 10, base: 12 }, expect: { height: '8', area: '48', perimeter: '32' } },
      { inputs: { leg: 3, base: 6 }, expect: { height: 'The base must be shorter than twice the leg' } },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Percentages, fractions, powers, statistics, number theory
// ---------------------------------------------------------------------------------------------------------------

const pct = (n: Dec): string => `${fmtNumber(n, 4)}%`;

function gcdBig(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
}

const others: Spec[] = [
  {
    slug: 'percentage-increase-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Percentages',
    title: 'Percentage Increase Calculator: From One Value to Another',
    h1: 'Percentage Increase Calculator',
    metaDescription: 'Work out the percentage increase (or decrease) from an old value to a new one, and the absolute change.',
    about:
      'Percentage increase measures how much a quantity has grown relative to where it started. Subtract the old value from the new one, divide by the old value and multiply by 100. The old value is always the base, which is why a rise from 50 to 75 is 50% but the fall back from 75 to 50 is only 33.3%. A negative result means the value fell. Use it for price changes, salary rises, growth in visitors or sales, and changes in any measurement.',
    inputs: [any('from', 'Old value', 80), any('to', 'New value', 100)],
    outputs: [
      { name: 'change', label: 'Percentage change', format: 'text', highlight: true },
      { name: 'diff', label: 'Absolute change', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.from);
      const b = toD(i.to);
      if (a.isZero()) return { change: 'Undefined when the old value is 0', diff: fmtNumber(b, 4) };
      return { change: pct(b.minus(a).div(a.abs()).mul(100)), diff: fmtNumber(b.minus(a), 4) };
    },
    formulaDescription: 'Change % = (new − old) ÷ |old| × 100. A positive result is an increase and a negative one a decrease.',
    workedExample: 'From 80 to 100: (100 − 80) ÷ 80 × 100 = 25%. From 100 to 80: −20%.',
    faq: [
      {
        question: 'Why is the percentage fall different from the percentage rise?',
        answer: 'Each is measured against its own starting value, so going up 25% and then down 25% does not return to the start.',
      },
      { question: 'What if the old value is zero?', answer: 'The percentage change is undefined because you cannot divide by zero.' },
      {
        question: 'Is a percentage point the same as a percent?',
        answer: 'No. Going from 4% to 5% is a rise of one percentage point but 25% in relative terms.',
      },
    ],
    scenarios: [
      [80, 100],
      [250, 310],
      [1200, 960],
      [45.5, 52],
      [0.8, 1.6],
      [3600, 3420],
      [15, 90],
      [700, 705],
    ].map(([from, to]) => ({ label: `${from} to ${to}`, inputs: { from, to } })),
    relatedSlugs: ['percentage-calculator', 'percentage-difference-calculator'],
    checks: [
      { inputs: {}, expect: { change: '25%', diff: '20' } },
      { inputs: { from: 100, to: 80 }, expect: { change: '-20%' } },
      { inputs: { from: 0, to: 5 }, expect: { change: 'Undefined when the old value is 0' } },
    ],
  },
  {
    slug: 'percentage-difference-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Percentages',
    title: 'Percentage Difference Calculator: Between Two Values',
    h1: 'Percentage Difference Calculator',
    metaDescription: 'Find the percentage difference between two numbers, measured against their average, when neither is the starting value.',
    about:
      'Percentage difference compares two values when neither one is the reference, for example two measurements of the same thing or the results from two methods. Instead of dividing by one of the values, it divides the gap by their average, so the answer is the same whichever you list first. It is not the same as percentage change, which has a definite starting value. Scientists use it to compare readings and shoppers to compare two prices.',
    inputs: [any('a', 'First value', 50), any('b', 'Second value', 70)],
    outputs: [
      { name: 'diff', label: 'Percentage difference', format: 'text', highlight: true },
      { name: 'gap', label: 'Absolute difference', format: 'text' },
      { name: 'mean', label: 'Average of the two', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      const mean = a.plus(b).div(2);
      if (mean.isZero()) return { diff: 'Undefined when the average is 0', gap: fmtNumber(a.minus(b).abs(), 4), mean: '0' };
      return { diff: pct(a.minus(b).abs().div(mean.abs()).mul(100)), gap: fmtNumber(a.minus(b).abs(), 4), mean: fmtNumber(mean, 4) };
    },
    formulaDescription: 'Percentage difference = |a − b| ÷ ((a + b) ÷ 2) × 100.',
    workedExample: '50 and 70: the gap is 20, the average 60, and 20 ÷ 60 × 100 = 33.3333%.',
    faq: [
      {
        question: 'How does this differ from percentage change?',
        answer: 'Change measures from a starting value; difference is symmetric and uses the average, so order does not matter.',
      },
      { question: 'Can it exceed 100%?', answer: 'Yes, if one value is much larger than the other.' },
      { question: 'What if the values have opposite signs?', answer: 'The average can be near zero and the result very large; interpret with care.' },
    ],
    scenarios: [
      [50, 70],
      [12.5, 15],
      [900, 1100],
      [3.2, 3.8],
      [250, 180],
      [64, 66],
      [1000, 10],
      [48.5, 52.1],
    ].map(([a, b]) => ({ label: `${a} and ${b}`, inputs: { a, b } })),
    relatedSlugs: ['percentage-increase-calculator', 'percentage-calculator'],
    checks: [
      { inputs: {}, expect: { diff: '33.3333%', gap: '20', mean: '60' } },
      { inputs: { a: 10, b: 10 }, expect: { diff: '0%' } },
      { inputs: { a: 5, b: -5 }, expect: { diff: 'Undefined when the average is 0' } },
    ],
  },
  {
    slug: 'reverse-percentage-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Percentages',
    title: 'Reverse Percentage Calculator: Find the Original Value',
    h1: 'Reverse Percentage Calculator',
    metaDescription: 'Find the original number before a percentage increase or decrease was applied, from the final value and the percentage.',
    about:
      'A reverse percentage calculation recovers the starting figure when you only know the result of a percentage change. If a coat costs 80 after a 20% discount, the original price was not 80 plus 20%; the sale price is 80% of the original, so you divide by 0.8. The same idea undoes a price rise or a tax added on top. Choose whether the percentage was added or taken off, enter the final value and the rate, and the original value follows.',
    inputs: [
      any('final', 'Final value', 80),
      { name: 'rate', label: 'Percentage applied (%)', type: 'number', default: 20, min: 0, max: 99.99, validator: numberField({ min: 0, max: 99.99 }) },
      {
        name: 'direction',
        label: 'The percentage was',
        type: 'select',
        default: 'off',
        unitOptions: [
          { value: 'off', label: 'Taken off (decrease)' },
          { value: 'on', label: 'Added on (increase)' },
        ],
        validator: selectField(['off', 'on']),
      },
    ],
    outputs: [
      { name: 'original', label: 'Original value', format: 'text', highlight: true },
      { name: 'change', label: 'Amount that was added or removed', format: 'text' },
    ],
    calculate: (i) => {
      const f = toD(i.final);
      const r = toD(i.rate).div(100);
      const factor = String(i.direction) === 'on' ? ONE.plus(r) : ONE.minus(r);
      const original = f.div(factor);
      return { original: fmtNumber(original, 4), change: fmtNumber(f.minus(original).abs(), 4) };
    },
    formulaDescription: 'Original = final ÷ (1 − rate) if the percentage was taken off, or final ÷ (1 + rate) if it was added, with rate as a decimal.',
    workedExample: '80 after a 20% discount: 80 ÷ 0.8 = 100. 120 after a 20% increase: 120 ÷ 1.2 = 100.',
    faq: [
      {
        question: 'Why not just add the percentage back?',
        answer: 'The percentage was calculated on the original value, not the final one, so adding it to the final value overshoots or undershoots.',
      },
      { question: 'Does it work for tax?', answer: 'Yes: choose added on, enter the price including tax and the tax rate to find the price before tax.' },
      { question: 'Why limit the rate below 100%?', answer: 'A 100% decrease leaves zero, from which the original cannot be recovered.' },
    ],
    scenarios: [
      [80, 20, 'off'],
      [120, 20, 'on'],
      [45, 10, 'off'],
      [231, 5, 'on'],
      [17.5, 30, 'off'],
      [1050, 8, 'on'],
      [66, 12.5, 'off'],
      [9.9, 10, 'on'],
    ].map(([final, rate, direction]) => ({ label: `${final} after ${rate}% ${direction === 'off' ? 'off' : 'on'}`, inputs: { final, rate, direction } })),
    relatedSlugs: ['percentage-calculator', 'discount-calculator'],
    checks: [
      { inputs: {}, expect: { original: '100', change: '20' } },
      { inputs: { final: 120, rate: 20, direction: 'on' }, expect: { original: '100', change: '20' } },
      { inputs: { final: 45, rate: 10 }, expect: { original: '50', change: '5' } },
    ],
  },
  {
    slug: 'fraction-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Fractions',
    title: 'Fraction Calculator: Add, Subtract, Multiply and Divide',
    h1: 'Fraction Calculator',
    metaDescription: 'Add, subtract, multiply or divide two fractions and get the answer in lowest terms, as a mixed number and as a decimal.',
    about:
      'Fractions are added and subtracted over a common denominator, multiplied by multiplying tops and bottoms, and divided by flipping the second fraction and multiplying. This calculator does all four operations with exact integer arithmetic, so there is no rounding, then reduces the result by the greatest common divisor to lowest terms. It also shows the answer as a mixed number and as a decimal. Use it for recipes, measurements, carpentry and homework.',
    inputs: [
      {
        name: 'n1',
        label: 'First numerator',
        type: 'number',
        default: 1,
        min: -1000000,
        max: 1000000,
        validator: numberField({ min: -1000000, max: 1000000, integer: true }),
      },
      {
        name: 'd1',
        label: 'First denominator',
        type: 'number',
        default: 2,
        min: 1,
        max: 1000000,
        validator: numberField({ min: 1, max: 1000000, integer: true }),
      },
      {
        name: 'op',
        label: 'Operation',
        type: 'select',
        default: 'add',
        unitOptions: [
          { value: 'add', label: 'Add (+)' },
          { value: 'sub', label: 'Subtract (−)' },
          { value: 'mul', label: 'Multiply (×)' },
          { value: 'div', label: 'Divide (÷)' },
        ],
        validator: selectField(['add', 'sub', 'mul', 'div']),
      },
      {
        name: 'n2',
        label: 'Second numerator',
        type: 'number',
        default: 1,
        min: -1000000,
        max: 1000000,
        validator: numberField({ min: -1000000, max: 1000000, integer: true }),
      },
      {
        name: 'd2',
        label: 'Second denominator',
        type: 'number',
        default: 3,
        min: 1,
        max: 1000000,
        validator: numberField({ min: 1, max: 1000000, integer: true }),
      },
    ],
    outputs: [
      { name: 'result', label: 'Result in lowest terms', format: 'text', highlight: true },
      { name: 'mixed', label: 'Mixed number', format: 'text' },
      { name: 'decimal', label: 'Decimal', format: 'text' },
    ],
    calculate: (i) => {
      const n1 = BigInt(String(toD(i.n1).toFixed(0)));
      const d1 = BigInt(String(toD(i.d1).toFixed(0)));
      const n2v = BigInt(String(toD(i.n2).toFixed(0)));
      const d2 = BigInt(String(toD(i.d2).toFixed(0)));
      let num: bigint;
      let den: bigint;
      switch (String(i.op)) {
        case 'sub':
          num = n1 * d2 - n2v * d1;
          den = d1 * d2;
          break;
        case 'mul':
          num = n1 * n2v;
          den = d1 * d2;
          break;
        case 'div':
          if (n2v === 0n) return { result: 'Cannot divide by zero', mixed: '-', decimal: '-' };
          num = n1 * d2;
          den = d1 * n2v;
          break;
        default:
          num = n1 * d2 + n2v * d1;
          den = d1 * d2;
      }
      if (den < 0n) {
        num = -num;
        den = -den;
      }
      const g = gcdBig(num, den) || 1n;
      num /= g;
      den /= g;
      const whole = num / den;
      const rest = (num < 0n ? -num : num) % den;
      const mixed = rest === 0n ? String(whole) : whole === 0n ? `${num}/${den}` : `${whole} ${rest}/${den}`;
      return { result: den === 1n ? String(num) : `${num}/${den}`, mixed, decimal: fmtNumber(new D(String(num)).div(new D(String(den))), 6) };
    },
    formulaDescription:
      'a/b + c/d = (ad + bc) ÷ bd; a/b − c/d = (ad − bc) ÷ bd; a/b × c/d = ac ÷ bd; a/b ÷ c/d = ad ÷ bc. The result is divided by the greatest common divisor of numerator and denominator.',
    workedExample: '1/2 + 1/3 = (3 + 2)/6 = 5/6, which is 0.833333 as a decimal.',
    faq: [
      { question: 'How do I enter a mixed number?', answer: 'Convert it to an improper fraction first, for example 1 1/2 is 3/2.' },
      { question: 'Why does the calculator reduce the answer?', answer: 'Lowest terms is the standard form of a fraction and makes answers easy to compare.' },
      { question: 'What about dividing by zero?', answer: 'Dividing by a fraction whose numerator is zero is undefined and reported as such.' },
    ],
    scenarios: [
      [1, 2, 'add', 1, 3],
      [3, 4, 'sub', 1, 6],
      [2, 3, 'mul', 3, 5],
      [3, 4, 'div', 9, 16],
      [5, 8, 'add', 7, 12],
      [7, 10, 'sub', 11, 15],
      [9, 14, 'mul', 7, 3],
      [4, 9, 'div', 2, 27],
    ].map(([n1, d1, op, n2v, d2]) => ({ label: `${n1}/${d1} ${op} ${n2v}/${d2}`, inputs: { n1, d1, op, n2: n2v, d2 } })),
    relatedSlugs: ['percentage-calculator', 'gcd-lcm-calculator'],
    checks: [
      { inputs: {}, expect: { result: '5/6', mixed: '5/6', decimal: '0.833333' } },
      { inputs: { n1: 3, d1: 4, op: 'div', n2: 9, d2: 16 }, expect: { result: '4/3', mixed: '1 1/3' } },
      { inputs: { n1: 3, d1: 4, op: 'sub', n2: 1, d2: 6 }, expect: { result: '7/12' } },
      { inputs: { op: 'div', n2: 0 }, expect: { result: 'Cannot divide by zero' } },
    ],
  },
  {
    slug: 'logarithm-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Logarithms and powers',
    title: 'Logarithm Calculator: Log of Any Base',
    h1: 'Logarithm Calculator',
    metaDescription: 'Calculate the logarithm of a number to any base, plus the natural logarithm and the base 10 logarithm.',
    about:
      'A logarithm answers the question: what power must the base be raised to in order to get this number. Because 2 to the power 3 is 8, the base 2 logarithm of 8 is 3. Logarithms turn multiplication into addition, which is why they appear in decibels, earthquake magnitudes, pH, compound growth and information theory. Enter a positive number and a positive base other than 1; the calculator also shows the natural logarithm, which uses the constant e, and the base 10 logarithm.',
    inputs: [
      pos('x', 'Number', 1000),
      { name: 'base', label: 'Base', type: 'number', default: 10, min: 0.000001, max: 1e9, validator: numberField({ min: 0.000001, max: 1e9 }) },
    ],
    outputs: [
      { name: 'log', label: 'Logarithm to your base', format: 'text', highlight: true },
      { name: 'ln', label: 'Natural logarithm (ln)', format: 'text' },
      { name: 'log10', label: 'Base 10 logarithm', format: 'text' },
    ],
    calculate: (i) => {
      const x = toD(i.x);
      const b = toD(i.base);
      if (b.eq(1)) return { log: 'The base cannot be 1', ln: fmtNumber(D.ln(x), 6), log10: fmtNumber(D.log10(x), 6) };
      return { log: fmtNumber(D.ln(x).div(D.ln(b)), 6), ln: fmtNumber(D.ln(x), 6), log10: fmtNumber(D.log10(x), 6) };
    },
    formulaDescription: 'log_b(x) = ln(x) ÷ ln(b), the change-of-base rule. ln is the logarithm to base e (2.71828…); log10 is the logarithm to base 10.',
    formulaLatex: '\\log_b x = \\frac{\\ln x}{\\ln b}',
    workedExample: 'log base 2 of 8: ln 8 ÷ ln 2 = 3. log base 10 of 1,000 = 3. ln 10 = 2.302585.',
    faq: [
      { question: 'Why can the number not be zero or negative?', answer: 'No real power of a positive base gives zero or a negative number.' },
      { question: 'Why can the base not be 1?', answer: 'One raised to any power is 1, so it cannot produce other numbers.' },
      {
        question: 'What is the natural logarithm?',
        answer: 'The logarithm to base e, an irrational constant about 2.71828 that appears in continuous growth.',
      },
    ],
    scenarios: [
      [8, 2],
      [1000, 10],
      [125, 5],
      [2, 2],
      [0.5, 2],
      [81, 3],
      [1e6, 10],
      [50, 7],
    ].map(([x, base]) => ({ label: `log base ${base} of ${x}`, inputs: { x, base } })),
    relatedSlugs: ['exponent-calculator', 'compound-interest-calculator'],
    checks: [
      { inputs: {}, expect: { log: '3', log10: '3' } },
      { inputs: { x: 8, base: 2 }, expect: { log: '3' } },
      { inputs: { x: 10, base: 10 }, expect: { ln: '2.302585' } },
      { inputs: { base: 1 }, expect: { log: 'The base cannot be 1' } },
    ],
  },
  {
    slug: 'exponent-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Logarithms and powers',
    title: 'Exponent Calculator: Powers and Roots',
    h1: 'Exponent Calculator',
    metaDescription: 'Raise a number to any power, including negative and fractional exponents, and see the square root and nth root.',
    about:
      'An exponent says how many times to multiply a number by itself: 2 to the power 10 is 1,024. Negative exponents give reciprocals, so 2 to the power minus 3 is one eighth, and fractional exponents give roots, so a power of one half is the square root. This calculator evaluates any base to any exponent using high-precision decimal arithmetic. It also shows the square root of the base. Powers describe compound interest, population growth, scientific notation and the sizes of computer memory.',
    inputs: [any('base', 'Base', 2), any('exp', 'Exponent', 10)],
    outputs: [
      { name: 'power', label: 'Result', format: 'text', highlight: true },
      { name: 'root', label: 'Square root of the base', format: 'text' },
    ],
    calculate: (i) => {
      const b = toD(i.base);
      const e = toD(i.exp);
      if (b.isZero() && e.lte(0)) return { power: 'Undefined: zero to a non-positive power', root: '0' };
      if (b.isNeg() && !e.isInteger()) return { power: 'No real result: a negative base needs a whole-number exponent', root: 'No real result' };
      return { power: fmtNumber(b.pow(e), 6), root: b.isNeg() ? 'No real result' : fmtNumber(D.sqrt(b), 6) };
    },
    formulaDescription: 'x^n = x × x × … (n times) for whole n; x^(−n) = 1 ÷ x^n; x^(1/n) is the nth root of x.',
    workedExample: '2 to the power 10 = 1,024. 1.05 to the power 10 = 1.628895, the growth factor of 5% for ten years.',
    faq: [
      { question: 'What is zero to the power zero?', answer: 'It is left undefined here; some fields define it as 1 by convention.' },
      { question: 'Can I raise a negative number to a fraction?', answer: 'Not within the real numbers, so the calculator says there is no real result.' },
      { question: 'How do I get a cube root?', answer: 'Use the exponent 1/3, entered as 0.3333333333, or use the nth root calculator.' },
    ],
    scenarios: [
      [2, 10],
      [1.05, 10],
      [10, -3],
      [9, 0.5],
      [3.7, 5],
      [7.5, 2.4],
      [0.5, 8],
      [-2, 5],
      [12.25, 3],
      [1.0825, 30],
      [256, 0.25],
      [6.4, -2],
    ].map(([base, exp]) => ({ label: `${base} to the power ${exp}`, inputs: { base, exp } })),
    relatedSlugs: ['logarithm-calculator', 'nth-root-calculator'],
    checks: [
      { inputs: {}, expect: { power: '1,024' } },
      { inputs: { base: 1.05, exp: 10 }, expect: { power: '1.628895' } },
      { inputs: { base: 2, exp: -3 }, expect: { power: '0.125' } },
      { inputs: { base: -2, exp: 0.5 }, expect: { power: 'No real result: a negative base needs a whole-number exponent' } },
    ],
  },
  {
    slug: 'nth-root-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Logarithms and powers',
    title: 'Nth Root Calculator: Square, Cube and Higher Roots',
    h1: 'Nth Root Calculator',
    metaDescription: 'Find the square root, cube root or any nth root of a number to six decimal places, with a check that raises the root back to the power.',
    about:
      'The nth root of a number is the value that, multiplied by itself n times, gives the number back. The square root is the second root and the cube root the third; the fourth, fifth and higher roots work the same way. The calculator accepts any positive degree and a non-negative number, or a negative number with an odd whole degree, and returns the root to six decimal places along with a check that raises the root to the power n to recover the original. Roots appear in geometry, finance and statistics.',
    inputs: [
      any('x', 'Number', 50),
      { name: 'n', label: 'Root degree (n)', type: 'number', default: 2, min: 1, max: 1000, validator: numberField({ min: 1, max: 1000 }) },
    ],
    outputs: [
      { name: 'root', label: 'Nth root', format: 'text', highlight: true },
      { name: 'check', label: 'Root raised to the power n', format: 'text' },
    ],
    calculate: (i) => {
      const x = toD(i.x);
      const n = toD(i.n);
      if (x.isNeg() && !(n.isInteger() && n.mod(2).eq(1))) return { root: 'No real root: a negative number needs an odd whole degree', check: '-' };
      const root = x.isNeg() ? D.pow(x.abs(), ONE.div(n)).neg() : D.pow(x, ONE.div(n));
      return { root: fmtNumber(root, 6), check: fmtNumber(root.pow(n), 4) };
    },
    formulaDescription: 'The nth root of x is x^(1/n). For a negative x it exists in the real numbers only when n is an odd whole number.',
    workedExample: 'The square root of 50 is 7.071068 (7.071068² = 50). The cube root of 27 is 3.',
    faq: [
      { question: 'What is the difference between root and exponent?', answer: 'A root undoes a power: the cube root of 8 is 2 because 2 cubed is 8.' },
      {
        question: 'Why can a negative number have a cube root but not a square root?',
        answer: 'A negative number cubed is negative, but squaring any real number gives a non-negative result.',
      },
      { question: 'How accurate is the result?', answer: 'Computed to 40 digits and shown to six decimal places.' },
    ],
    scenarios: [
      [50, 2],
      [27, 3],
      [32, 5],
      [1000, 3],
      [2, 2],
      [-8, 3],
      [10, 4],
      [0.001, 3],
      [1771.561, 3],
      [65536, 16],
      [7.29, 2],
      [390625, 4],
    ].map(([x, n]) => ({ label: `root ${n} of ${x}`, inputs: { x, n } })),
    relatedSlugs: ['exponent-calculator', 'logarithm-calculator'],
    checks: [
      { inputs: {}, expect: { root: '7.071068' } },
      { inputs: { x: 27, n: 3 }, expect: { root: '3', check: '27' } },
      { inputs: { x: -8, n: 3 }, expect: { root: '-2' } },
      { inputs: { x: -4, n: 2 }, expect: { root: 'No real root: a negative number needs an odd whole degree' } },
    ],
  },
  {
    slug: 'mean-median-mode-calculator',
    category: 'statistics',
    tier: 2,
    subCluster: 'Describing data',
    title: 'Mean, Median, Mode and Range Calculator',
    h1: 'Mean, Median, Mode and Range Calculator',
    metaDescription: 'Enter a list of numbers and get the mean, median, mode, range, count and sum, with the sorted list shown.',
    about:
      'The mean, median and mode are three ways of describing the centre of a set of numbers. The mean is the sum divided by the count, the median is the middle value when sorted, and the mode is the value that occurs most often. The range, the largest minus the smallest, describes spread. They can disagree: a few very large values pull the mean up while barely moving the median, which is why reported typical incomes use the median. Paste your numbers separated by commas, spaces or new lines.',
    inputs: [
      { name: 'data', label: 'Numbers (separated by commas, spaces or new lines)', type: 'text', default: '4, 8, 6, 5, 3, 8, 9, 5, 8', validator: dataField() },
    ],
    outputs: [
      { name: 'mean', label: 'Mean', format: 'text', highlight: true },
      { name: 'median', label: 'Median', format: 'text' },
      { name: 'mode', label: 'Mode', format: 'text' },
      { name: 'range', label: 'Range', format: 'text' },
      { name: 'count', label: 'Count', format: 'text' },
      { name: 'sum', label: 'Sum', format: 'text' },
    ],
    calculate: (i) => {
      const values = parseList(i.data).sort((a, b) => a.cmp(b));
      const n = values.length;
      const sum = values.reduce((a, b) => a.plus(b), ZERO);
      const mid = Math.floor(n / 2);
      const median = n % 2 ? values[mid] : values[mid - 1].plus(values[mid]).div(2);
      const counts = new Map<string, number>();
      for (const v of values) counts.set(v.toString(), (counts.get(v.toString()) ?? 0) + 1);
      const top = Math.max(...counts.values());
      const modes = [...counts].filter(([, c]) => c === top).map(([v]) => v);
      return {
        mean: fmtNumber(sum.div(n), 4),
        median: fmtNumber(median, 4),
        mode: top === 1 ? 'No value repeats' : modes.join(', '),
        range: fmtNumber(values[n - 1].minus(values[0]), 4),
        count: String(n),
        sum: fmtNumber(sum, 4),
      };
    },
    formulaDescription:
      'Mean = sum ÷ count. Median = the middle value of the sorted list, or the average of the two middle values if the count is even. Mode = the most frequent value(s). Range = maximum − minimum.',
    workedExample: '4, 8, 6, 5, 3, 8, 9, 5, 8: sum 56, count 9, mean 6.2222; sorted 3, 4, 5, 5, 6, 8, 8, 8, 9 so the median is 6 and the mode is 8; range 6.',
    faq: [
      {
        question: 'Which average should I use?',
        answer: 'The mean uses every value but is pulled by outliers; the median resists them; the mode suits categories.',
      },
      { question: 'What if two values tie for most common?', answer: 'Both are listed, and the data is called bimodal.' },
      {
        question: 'Why does the median average two numbers?',
        answer: 'With an even count there is no single middle value, so the two middle ones are averaged.',
      },
    ],
    scenarios: [
      '2, 4, 4, 4, 5, 5, 7, 9',
      '10, 20, 30, 40',
      '1.5, 2.5, 2.5, 3.5, 9.5',
      '100, 102, 98, 101, 99, 100',
      '7, 7, 7, 7',
      '12, 15, 11, 19, 15, 23, 15, 8',
      '0, 0, 1, 2, 3, 5, 8, 13, 21',
      '45, 52, 38, 61, 47',
    ].map((d) => ({ label: `Data ${d}`, inputs: { data: d } })),
    relatedSlugs: ['standard-deviation-calculator', 'z-score-calculator'],
    checks: [
      { inputs: {}, expect: { mean: '6.2222', median: '6', mode: '8', range: '6', count: '9', sum: '56' } },
      { inputs: { data: '1, 2, 3, 4' }, expect: { mean: '2.5', median: '2.5', mode: 'No value repeats' } },
      { inputs: { data: '2 2 3 3' }, expect: { mode: '2, 3' } },
    ],
  },
  {
    slug: 'z-score-calculator',
    category: 'statistics',
    tier: 3,
    subCluster: 'Describing data',
    title: 'Z-Score Calculator: Standard Score and Percentile',
    h1: 'Z-Score Calculator',
    metaDescription: 'Convert a value to a z-score from the mean and standard deviation, and see the approximate percentile under a normal distribution.',
    about:
      'A z-score tells you how many standard deviations a value lies above or below the mean, which lets you compare numbers measured on different scales, such as an exam mark and a height. A score of zero is exactly average, positive scores are above it and negative ones below. If the data follow a normal distribution, the z-score also gives the percentage of values below it, the percentile. Enter the value, the mean and the standard deviation of the group it comes from.',
    inputs: [
      any('x', 'Value', 85),
      any('mean', 'Mean', 70),
      { name: 'sd', label: 'Standard deviation', type: 'number', default: 10, min: 0.000001, max: 1e12, validator: numberField({ min: 0.000001, max: 1e12 }) },
    ],
    outputs: [
      { name: 'z', label: 'Z-score', format: 'text', highlight: true },
      { name: 'percentile', label: 'Percentile (normal distribution)', format: 'text' },
    ],
    calculate: (i) => {
      const z = toD(i.x).minus(toD(i.mean)).div(toD(i.sd));
      // Phi(z) via the Abramowitz and Stegun 7.1.26 approximation of erf (error under 1.5e-7).
      const t = ONE.div(ONE.plus(z.abs().div(D.sqrt(2)).mul('0.3275911')));
      const poly = t.mul(
        new D('0.254829592').plus(t.mul(new D('-0.284496736').plus(t.mul(new D('1.421413741').plus(t.mul(new D('-1.453152027').plus(t.mul('1.061405429')))))))),
      );
      const erf = ONE.minus(poly.mul(D.exp(z.mul(z).div(-2))));
      const phi = z.isNeg() ? ONE.minus(erf).div(2) : ONE.plus(erf).div(2);
      return { z: fmtNumber(z, 3), percentile: `${fmtNumber(phi.mul(100), 2)}th percentile` };
    },
    formulaDescription:
      'z = (x − mean) ÷ standard deviation. The percentile is the normal cumulative probability Φ(z), computed with the Abramowitz and Stegun erf approximation (error below 0.0000002).',
    workedExample: 'A mark of 85 where the mean is 70 and the standard deviation 10: z = 1.5, about the 93.32nd percentile.',
    faq: [
      { question: 'Does the percentile need normal data?', answer: 'Yes. The percentile assumes a normal distribution; the z-score itself does not.' },
      { question: 'What is a typical range for z?', answer: 'About 95% of values in a normal distribution have a z-score between −2 and +2.' },
      { question: 'Can the standard deviation be zero?', answer: 'No, a zero spread would make every value equal to the mean, and the z-score undefined.' },
    ],
    scenarios: [
      [85, 70, 10],
      [60, 72, 8],
      [100, 100, 15],
      [130, 100, 15],
      [4.2, 5, 0.5],
      [172, 165, 7],
      [540, 500, 100],
      [22, 31, 4.5],
    ].map(([x, mean, sd]) => ({ label: `${x} against mean ${mean}, SD ${sd}`, inputs: { x, mean, sd } })),
    relatedSlugs: ['standard-deviation-calculator', 'mean-median-mode-calculator'],
    checks: [
      { inputs: {}, expect: { z: '1.5', percentile: '93.32th percentile' } },
      { inputs: { x: 60, mean: 72, sd: 8 }, expect: { z: '-1.5', percentile: '6.68th percentile' } },
      { inputs: { x: 100, mean: 100, sd: 15 }, expect: { z: '0', percentile: '50th percentile' } },
    ],
  },
  {
    slug: 'gcd-lcm-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Number theory',
    title: 'GCD and LCM Calculator: Greatest Common Divisor and Least Common Multiple',
    h1: 'GCD and LCM Calculator',
    metaDescription: 'Find the greatest common divisor (GCF) and least common multiple of two whole numbers, with the Euclidean algorithm steps counted.',
    about:
      'The greatest common divisor of two whole numbers is the largest number that divides both exactly, and the least common multiple is the smallest number that both divide into. They are linked: multiplying the two numbers gives the product of their GCD and LCM. The GCD reduces fractions to lowest terms, and the LCM finds a common denominator or the time when two repeating cycles line up again. The calculator uses the Euclidean algorithm, which repeatedly replaces the larger number by the remainder.',
    inputs: [
      { name: 'a', label: 'First number', type: 'number', default: 48, min: 1, max: 1e15, validator: numberField({ min: 1, max: 1e15, integer: true }) },
      { name: 'b', label: 'Second number', type: 'number', default: 18, min: 1, max: 1e15, validator: numberField({ min: 1, max: 1e15, integer: true }) },
    ],
    outputs: [
      { name: 'gcd', label: 'Greatest common divisor', format: 'text', highlight: true },
      { name: 'lcm', label: 'Least common multiple', format: 'text' },
      { name: 'steps', label: 'Euclidean steps', format: 'text' },
    ],
    calculate: (i) => {
      const a = BigInt(String(toD(i.a).toFixed(0)));
      const b = BigInt(String(toD(i.b).toFixed(0)));
      let x = a;
      let y = b;
      let steps = 0;
      while (y) {
        [x, y] = [y, x % y];
        steps++;
      }
      return { gcd: x.toString(), lcm: ((a / x) * b).toString(), steps: String(steps) };
    },
    formulaDescription: 'Euclid: gcd(a, b) = gcd(b, a mod b) until the remainder is zero. lcm(a, b) = a × b ÷ gcd(a, b).',
    workedExample: 'gcd(48, 18): 48 = 2 × 18 + 12; 18 = 1 × 12 + 6; 12 = 2 × 6 + 0, so the gcd is 6 and the lcm is 48 × 18 ÷ 6 = 144.',
    faq: [
      {
        question: 'Is GCD the same as GCF or HCF?',
        answer: 'Yes. Greatest common factor and highest common factor are other names for the greatest common divisor.',
      },
      { question: 'What if the numbers share no factors?', answer: 'The GCD is 1 and they are called coprime; the LCM is their product.' },
      { question: 'How do I find the GCD of three numbers?', answer: 'Take the GCD of the first two, then the GCD of that result with the third.' },
    ],
    scenarios: [
      [48, 18],
      [17, 5],
      [84, 126],
      [1071, 462],
      [100, 75],
      [221, 91],
      [360, 252],
      [13, 169],
    ].map(([a, b]) => ({ label: `${a} and ${b}`, inputs: { a, b } })),
    relatedSlugs: ['fraction-calculator', 'prime-factorization-calculator'],
    checks: [
      { inputs: {}, expect: { gcd: '6', lcm: '144', steps: '3' } },
      { inputs: { a: 17, b: 5 }, expect: { gcd: '1', lcm: '85' } },
      { inputs: { a: 4, b: 6 }, expect: { gcd: '2', lcm: '12' } },
    ],
  },
  {
    slug: 'prime-factorization-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Number theory',
    title: 'Prime Factorization Calculator: Is It Prime and Its Prime Factors',
    h1: 'Prime Factorization Calculator',
    metaDescription: 'Break a whole number into its prime factors and check whether it is prime, with the divisor count.',
    about:
      'Every whole number above 1 is either prime, divisible only by 1 and itself, or a unique product of primes, a fact called the fundamental theorem of arithmetic. This calculator finds that product by trial division and tells you whether the number is prime. It also counts the divisors, which follows from the exponents in the factorization. Prime factorization is used to reduce fractions, find greatest common divisors and understand why some numbers, like 360, have so many factors. Numbers up to one trillion are accepted.',
    inputs: [
      { name: 'n', label: 'Whole number', type: 'number', default: 360, min: 2, max: 1e12, validator: numberField({ min: 2, max: 1e12, integer: true }) },
    ],
    outputs: [
      { name: 'factors', label: 'Prime factorization', format: 'text', highlight: true },
      { name: 'prime', label: 'Is it prime?', format: 'text' },
      { name: 'divisors', label: 'Number of divisors', format: 'text' },
    ],
    calculate: (i) => {
      let n = Number(toD(i.n).toFixed(0));
      const original = n;
      const parts: string[] = [];
      let divisors = 1;
      for (let p = 2; p * p <= n; p += p === 2 ? 1 : 2) {
        let e = 0;
        while (n % p === 0) {
          n /= p;
          e++;
        }
        if (e) {
          parts.push(e === 1 ? String(p) : `${p}^${e}`);
          divisors *= e + 1;
        }
      }
      if (n > 1) {
        parts.push(String(n));
        divisors *= 2;
      }
      return {
        factors: parts.join(' × '),
        prime: parts.length === 1 && !parts[0].includes('^') ? `Yes, ${original} is prime` : 'No',
        divisors: String(divisors),
      };
    },
    formulaDescription:
      'Trial division by 2, then odd numbers up to the square root of the remaining number. The divisor count is the product of (exponent + 1) over the prime factors.',
    workedExample: '360 = 2³ × 3² × 5, so it has (3 + 1)(2 + 1)(1 + 1) = 24 divisors. 97 has no factors other than itself, so it is prime.',
    faq: [
      { question: 'Is 1 a prime number?', answer: 'No. A prime has exactly two distinct divisors, and 1 has only one.' },
      {
        question: 'Why check only up to the square root?',
        answer: 'If a number has a factor larger than its square root, the matching cofactor is smaller than it, so it would already have been found.',
      },
      { question: 'How large a number can I enter?', answer: 'Up to one trillion, which trial division handles instantly.' },
    ],
    scenarios: [360, 97, 1001, 65536, 123456, 999983, 1000000007, 4294967296].map((n) => ({ label: `Number ${n}`, inputs: { n } })),
    relatedSlugs: ['gcd-lcm-calculator', 'factorial-calculator'],
    checks: [
      { inputs: {}, expect: { factors: '2^3 × 3^2 × 5', prime: 'No', divisors: '24' } },
      { inputs: { n: 97 }, expect: { factors: '97', prime: 'Yes, 97 is prime', divisors: '2' } },
      { inputs: { n: 1001 }, expect: { factors: '7 × 11 × 13' } },
    ],
  },
  {
    slug: 'factorial-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Number theory',
    title: 'Factorial Calculator: n! Exactly',
    h1: 'Factorial Calculator',
    metaDescription: 'Calculate n factorial exactly for any whole number up to 170, with the number of digits and trailing zeros.',
    about:
      'The factorial of a whole number n, written n!, is the product of all the whole numbers from 1 up to n. It counts the ways to arrange n distinct objects in a line, which makes it central to permutations, combinations and probability. Factorials grow astonishingly fast: 10! is already 3,628,800 and 20! exceeds two quintillion. This calculator computes the exact value with big-integer arithmetic, so no digits are lost, and reports how many digits it has and how many zeros it ends with.',
    inputs: [
      { name: 'n', label: 'Whole number n', type: 'number', default: 10, min: 0, max: 170, validator: numberField({ min: 0, max: 170, integer: true }) },
    ],
    outputs: [
      { name: 'value', label: 'n factorial', format: 'text', highlight: true },
      { name: 'digits', label: 'Digits', format: 'text' },
      { name: 'zeros', label: 'Trailing zeros', format: 'text' },
    ],
    calculate: (i) => {
      const n = Number(toD(i.n).toFixed(0));
      let f = 1n;
      for (let k = 2n; k <= BigInt(n); k++) f *= k;
      const text = f.toString();
      const zeros = text.length - text.replace(/0+$/, '').length;
      return {
        value: text.length > 40 ? `${text.slice(0, 20)}… (${text.length} digits)` : text.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
        digits: String(text.length),
        zeros: String(zeros),
      };
    },
    formulaDescription: 'n! = n × (n − 1) × … × 2 × 1, with 0! = 1. Trailing zeros equal the exponent of 5 in n!, the sum of ⌊n/5⌋ + ⌊n/25⌋ + …',
    workedExample: '10! = 10 × 9 × … × 1 = 3,628,800, which has 7 digits and 2 trailing zeros.',
    faq: [
      { question: 'Why is 0! equal to 1?', answer: 'There is exactly one way to arrange zero objects, and it keeps formulas such as combinations consistent.' },
      {
        question: 'Why stop at 170?',
        answer: '171! exceeds the largest number standard floating-point can hold (about 1.8 × 10^308); the exact value is still computed up to 170.',
      },
      { question: 'How is factorial used?', answer: 'To count arrangements: 5 people can be seated in a row in 5! = 120 ways.' },
    ],
    scenarios: [0, 5, 10, 12, 15, 20, 25, 52].map((n) => ({ label: `${n}!`, inputs: { n } })),
    relatedSlugs: ['prime-factorization-calculator', 'gcd-lcm-calculator'],
    checks: [
      { inputs: {}, expect: { value: '3,628,800', digits: '7', zeros: '2' } },
      { inputs: { n: 0 }, expect: { value: '1', digits: '1' } },
      { inputs: { n: 20 }, expect: { value: '2,432,902,008,176,640,000', zeros: '4' } },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------------

function dataField() {
  return numberListField(1, 5000);
}
function parseList(text: unknown): Dec[] {
  return parseNumberList(text);
}

export const SPECS: Spec[] = [...geometry, ...triangles, ...others];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
