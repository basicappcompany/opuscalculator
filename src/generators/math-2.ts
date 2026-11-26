import { z } from 'zod';
import { selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtFixed, fmtNumber } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { field, intField, varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 16 (math): the everyday school and workplace maths that three or more competitor sites carry and we
 * lacked: Pythagorean theorem, quadratic formula, coordinate geometry, ratios and percentage errors, rounding and
 * significant figures, scientific notation, and the decimal, fraction and mixed-number converters. Exact decimal
 * arithmetic throughout (BigInt for fractions). Math shows no disclaimer. Tier 2 or 3, so none is live until the
 * cohort gate opens.
 */

const PI = D.acos(-1);
const RAD = PI.div(180);
const n4 = (x: Dec): string => fmtNumber(x, 4);

const pos = (name: string, label: string, def: number, max = 1e12) => field(name, label, def, 0.000001, max);
const real = (name: string, label: string, def: number) => field(name, label, def, -1e12, 1e12);
const sel = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});
const NUM_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const numText = (name: string, label: string, def: string) => ({
  name,
  label,
  type: 'text' as const,
  default: def,
  validator: z
    .string()
    .trim()
    .refine((v) => NUM_TEXT.test(v.replace(/,/g, '')), 'Enter a number such as 0.0045 or 6.02e23'),
});
const out = (name: string, label: string, highlight = false) => ({ name, label, format: 'text' as const, ...(highlight ? { highlight: true } : {}) });

const gcdBig = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
};
/** Exact reduced fraction of a decimal number: 0.125 is 1/8. */
const fracOf = (x: Dec): [bigint, bigint] => {
  const s = x.toFixed();
  const neg = s.startsWith('-');
  const [whole, frac = ''] = (neg ? s.slice(1) : s).split('.');
  let num = BigInt(whole + frac);
  let den = 10n ** BigInt(frac.length);
  const g = gcdBig(num, den) || 1n;
  num /= g;
  den /= g;
  return [neg ? -num : num, den];
};
const fracText = (n: bigint, d: bigint): string => (d === 1n ? n.toString() : `${n}/${d}`);
const mixedText = (n: bigint, d: bigint): string => {
  const g = gcdBig(n, d) || 1n;
  const a = (n < 0n ? -n : n) / g;
  const den = d / g;
  const sign = n < 0n ? '-' : '';
  const whole = a / den;
  const rem = a % den;
  if (rem === 0n) return sign + whole.toString();
  if (whole === 0n) return `${sign}${rem}/${den}`;
  return `${sign}${whole} ${rem}/${den}`;
};
const sciText = (x: Dec): string => {
  if (x.isZero()) return '0';
  const [m, e] = x.toExponential().split('e');
  return `${m} × 10^${Number(e)}`;
};
const sigCount = (text: string): number => {
  const mant = text.trim().toLowerCase().replace(/,/g, '').replace(/^[+-]/, '').split('e')[0];
  if (/^[0.]*$/.test(mant)) return 1;
  const digits = mant.includes('.') ? mant.replace('.', '').replace(/^0+/, '') : mant.replace(/^0+/, '').replace(/0+$/, '');
  return digits.length;
};
const expand = (n0: bigint, d0: bigint): { text: string; period: number } => {
  const neg = n0 < 0n !== d0 < 0n && n0 !== 0n;
  const n = n0 < 0n ? -n0 : n0;
  const d = d0 < 0n ? -d0 : d0;
  const sign = neg ? '-' : '';
  const whole = n / d;
  let rem = n % d;
  if (rem === 0n) return { text: sign + whole.toString(), period: 0 };
  const seen = new Map<string, number>();
  const digits: string[] = [];
  while (rem !== 0n && !seen.has(rem.toString()) && digits.length < 2000) {
    seen.set(rem.toString(), digits.length);
    rem *= 10n;
    digits.push((rem / d).toString());
    rem %= d;
  }
  if (rem === 0n) return { text: `${sign}${whole}.${digits.join('')}`, period: 0 };
  const start = seen.get(rem.toString()) ?? 0;
  return { text: `${sign}${whole}.${digits.slice(0, start).join('')}(${digits.slice(start).join('')})`, period: digits.length - start };
};
const ROUNDING: Record<string, 1 | 2 | 3 | 4 | 6> = {
  half_up: D.ROUND_HALF_UP,
  half_even: D.ROUND_HALF_EVEN,
  down: D.ROUND_FLOOR,
  up: D.ROUND_CEIL,
  trunc: D.ROUND_DOWN,
};

export const SPECS: Spec[] = [
  {
    slug: 'pythagorean-theorem-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Geometry',
    title: 'Pythagorean Theorem Calculator: Find a Side of a Right Triangle',
    h1: 'Pythagorean Theorem Calculator',
    metaDescription: 'Find the hypotenuse or a missing leg of a right triangle with a² + b² = c², plus the area, perimeter and the two acute angles.',
    about:
      'In any right triangle the square on the hypotenuse equals the sum of the squares on the other two sides. Choose which side you want, then enter the two you know: the other field is ignored. The calculator returns the missing length and, since the triangle is now complete, its area, perimeter and the two acute angles. A 3, 4, 5 triangle is the classic example, and so is the 5, 12, 13 triangle that builders use to check a corner is square.',
    inputs: [
      sel('find', 'Find', 'c', [
        ['c', 'Hypotenuse c'],
        ['a', 'Leg a'],
        ['b', 'Leg b'],
      ]),
      pos('a', 'Leg a', 6),
      pos('b', 'Leg b', 8),
      pos('c', 'Hypotenuse c', 10),
    ],
    outputs: [out('side', 'Missing side', true), out('area', 'Area'), out('perim', 'Perimeter'), out('angles', 'Acute angles')],
    calculate: (i) => {
      const find = String(i.find);
      let a = toD(i.a);
      let b = toD(i.b);
      let c = toD(i.c);
      const bad = { side: 'The hypotenuse must be longer than the leg', area: '', perim: '', angles: '' };
      let res: Dec;
      if (find === 'c') {
        c = a.pow(2).plus(b.pow(2)).sqrt();
        res = c;
      } else if (find === 'a') {
        if (c.lte(b)) return bad;
        a = c.pow(2).minus(b.pow(2)).sqrt();
        res = a;
      } else {
        if (c.lte(a)) return bad;
        b = c.pow(2).minus(a.pow(2)).sqrt();
        res = b;
      }
      const alpha = D.atan(a.div(b)).div(RAD);
      return {
        side: n4(res),
        area: n4(a.mul(b).div(2)),
        perim: n4(a.plus(b).plus(c)),
        angles: `${fmtNumber(alpha, 2)}° and ${fmtNumber(new D(90).minus(alpha), 2)}°`,
      };
    },
    formulaDescription:
      'a² + b² = c², with c the hypotenuse opposite the right angle. The legs are a and b. Area = ½ a b, and the angle opposite leg a is atan(a ÷ b).',
    formulaLatex: 'a^{2} + b^{2} = c^{2}',
    workedExample:
      'Legs of 6 and 8: c = √(36 + 64) = 10. The area is 24, the perimeter 24, and the acute angles are 36.87° and 53.13°. Given c = 13 and b = 12, the other leg is √(169 − 144) = 5.',
    faq: [
      {
        question: 'Does it work for any triangle?',
        answer: 'Only right triangles. For other triangles use the law of cosines or one of the triangle solvers.',
      },
      { question: 'What are Pythagorean triples?', answer: 'Sets of whole numbers that fit, such as 3, 4, 5 and 5, 12, 13 and 8, 15, 17.' },
      { question: 'Why must the hypotenuse be the longest side?', answer: 'It sits opposite the largest angle, 90°, so it is always longer than either leg.' },
    ],
    scenarios: varied(
      'pythagorean-theorem-calculator',
      12,
      [
        { name: 'a', lo: 1.5, hi: 90, step: 0.5 },
        { name: 'b', lo: 1.5, hi: 90, step: 0.5 },
      ],
      [],
      (v) => `legs ${v.a} and ${v.b}`,
    ),
    introOutputs: ['side', 'angles'],
    relatedSlugs: ['right-triangle-calculator', 'triangle-area-calculator', 'triangle-sss-calculator'],
    checks: [
      { inputs: {}, expect: { side: '10', area: '24', perim: '24', angles: '36.87° and 53.13°' } },
      { inputs: { find: 'a', b: 12, c: 13 }, expect: { side: '5', area: '30', perim: '30', angles: '22.62° and 67.38°' } },
      { inputs: { find: 'b', a: 7, c: 25 }, expect: { side: '24', area: '84', perim: '56', angles: '16.26° and 73.74°' } },
      { inputs: { a: 1, b: 1 }, expect: { side: '1.4142', angles: '45° and 45°' } },
      { inputs: { find: 'a', b: 9, c: 5 }, expect: { side: 'The hypotenuse must be longer than the leg' } },
    ],
  },
  {
    slug: 'quadratic-formula-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Algebra',
    title: 'Quadratic Formula Calculator: Roots, Discriminant and Vertex',
    h1: 'Quadratic Formula Calculator',
    metaDescription: 'Solve ax² + bx + c = 0 with the quadratic formula: real or complex roots, the discriminant and the vertex of the parabola.',
    about:
      'A quadratic equation has the form ax² + bx + c = 0 with a not equal to zero. Its roots come from the quadratic formula, and the part under the square root, the discriminant, tells you what to expect: positive gives two real roots, zero gives one repeated root and negative gives a pair of complex roots. Enter the three coefficients to get the roots, the discriminant, the type of solution and the vertex of the parabola y = ax² + bx + c.',
    inputs: [real('a', 'Coefficient a', 1), real('b', 'Coefficient b', -5), real('c', 'Coefficient c', 6)],
    outputs: [out('roots', 'Roots', true), out('disc', 'Discriminant'), out('vertex', 'Vertex'), out('kind', 'Type of roots')],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      const c = toD(i.c);
      if (a.isZero()) return { roots: 'Enter a non-zero a, otherwise it is not a quadratic', disc: '', vertex: '', kind: '' };
      const disc = b.pow(2).minus(a.mul(c).mul(4));
      const h = b.neg().div(a.mul(2));
      const k = c.minus(b.pow(2).div(a.mul(4)));
      const vertex = `(${n4(h)}, ${n4(k)})`;
      if (disc.gt(0)) {
        const s = disc.sqrt();
        return {
          roots: `x₁ = ${n4(b.neg().plus(s).div(a.mul(2)))} and x₂ = ${n4(b.neg().minus(s).div(a.mul(2)))}`,
          disc: n4(disc),
          vertex,
          kind: 'Two real roots',
        };
      }
      if (disc.isZero()) return { roots: `x = ${n4(h)} (a double root)`, disc: n4(disc), vertex, kind: 'One repeated real root' };
      return { roots: `x = ${n4(h)} ± ${n4(disc.neg().sqrt().div(a.abs().mul(2)))}i`, disc: n4(disc), vertex, kind: 'Two complex roots' };
    },
    formulaDescription: 'x = (−b ± √(b² − 4ac)) ÷ 2a. The discriminant is Δ = b² − 4ac. The vertex of the parabola is at x = −b ÷ 2a, with y = c − b² ÷ 4a.',
    formulaLatex: 'x = \\dfrac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}',
    workedExample:
      'x² − 5x + 6 = 0: Δ = 25 − 24 = 1, so x = (5 ± 1) ÷ 2 gives x₁ = 3 and x₂ = 2. The vertex is at (2.5, −0.25). For 2x² + 2x + 5 the discriminant is −36, so the roots are −0.5 ± 1.5i.',
    faq: [
      { question: 'What if a is zero?', answer: 'Then the equation is linear, not quadratic, and has one solution x = −c ÷ b.' },
      {
        question: 'What does a negative discriminant mean?',
        answer: 'The parabola never crosses the x-axis, so there are no real roots; the two complex roots are conjugates of each other.',
      },
      { question: 'Can I check the roots?', answer: 'Their sum is −b ÷ a and their product is c ÷ a. Here 3 + 2 = 5 and 3 × 2 = 6.' },
    ],
    scenarios: varied(
      'quadratic-formula-calculator',
      12,
      [
        { name: 'a', lo: 1, hi: 9, step: 1 },
        { name: 'b', lo: -24, hi: 24, step: 1 },
        { name: 'c', lo: -30, hi: 30, step: 1 },
      ],
      [],
      (v) => `${v.a}x² + ${v.b}x + ${v.c}`,
    ),
    introOutputs: ['roots', 'kind'],
    relatedSlugs: ['exponent-calculator', 'nth-root-calculator', 'slope-calculator'],
    checks: [
      { inputs: {}, expect: { roots: 'x₁ = 3 and x₂ = 2', disc: '1', vertex: '(2.5, -0.25)', kind: 'Two real roots' } },
      { inputs: { a: 1, b: 2, c: 1 }, expect: { roots: 'x = -1 (a double root)', disc: '0', vertex: '(-1, 0)', kind: 'One repeated real root' } },
      { inputs: { a: 2, b: 2, c: 5 }, expect: { roots: 'x = -0.5 ± 1.5i', disc: '-36', vertex: '(-0.5, 4.5)', kind: 'Two complex roots' } },
      { inputs: { a: -1, b: 0, c: 9 }, expect: { roots: 'x₁ = -3 and x₂ = 3', disc: '36', vertex: '(0, 9)', kind: 'Two real roots' } },
      { inputs: { a: 0 }, expect: { roots: 'Enter a non-zero a, otherwise it is not a quadratic' } },
    ],
  },
  {
    slug: 'slope-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Coordinate geometry',
    title: 'Slope Calculator: Slope, Angle and Line Equation From Two Points',
    h1: 'Slope Calculator',
    metaDescription: 'Find the slope of the line through two points, its angle of inclination, the equation y = mx + b and the distance between the points.',
    about:
      'Steepness has a number: how many units a line climbs for each unit it travels sideways. Give the calculator any two points on a line and it divides the vertical change by the horizontal change. From that gradient it derives the tilt angle against the x-axis, writes out y = mx + b and measures the gap between your two points. A perfectly upright line has zero run, so no gradient exists; the page then states the line as x equal to a constant, which is how vertical roads on a map plot.',
    inputs: [real('x1', 'x₁', 1), real('y1', 'y₁', 2), real('x2', 'x₂', 4), real('y2', 'y₂', 8)],
    outputs: [out('m', 'Slope m', true), out('angle', 'Angle of inclination'), out('eq', 'Line equation'), out('dist', 'Distance between the points')],
    calculate: (i) => {
      const x1 = toD(i.x1);
      const y1 = toD(i.y1);
      const x2 = toD(i.x2);
      const y2 = toD(i.y2);
      if (x1.eq(x2) && y1.eq(y2)) return { m: 'Choose two different points', angle: '', eq: '', dist: '' };
      const dist = n4(x2.minus(x1).pow(2).plus(y2.minus(y1).pow(2)).sqrt());
      if (x1.eq(x2)) return { m: 'Undefined (vertical line)', angle: '90°', eq: `x = ${n4(x1)}`, dist };
      const m = y2.minus(y1).div(x2.minus(x1));
      const b = y1.minus(m.mul(x1));
      return { m: n4(m), angle: `${fmtNumber(D.atan(m).div(RAD), 2)}°`, eq: `y = ${n4(m)}x ${b.isNeg() ? '−' : '+'} ${n4(b.abs())}`, dist };
    },
    formulaDescription: 'm = (y₂ − y₁) ÷ (x₂ − x₁). The intercept is b = y₁ − m x₁, the angle is atan(m), and the distance is √((x₂ − x₁)² + (y₂ − y₁)²).',
    formulaLatex: 'm = \\dfrac{y_{2} - y_{1}}{x_{2} - x_{1}}',
    workedExample: 'Through (1, 2) and (4, 8): m = 6 ÷ 3 = 2, the angle is 63.43°, the equation is y = 2x + 0, and the points are 6.7082 apart.',
    faq: [
      { question: 'What does a negative slope mean?', answer: 'The line falls as x increases. Through (0, 7) and (3, −2) the slope is −3.' },
      { question: 'What is the slope of a horizontal line?', answer: 'Zero, because y does not change.' },
      { question: 'How do I get the slope as a percentage?', answer: 'Multiply the slope by 100: a slope of 0.08 is an 8% grade.' },
    ],
    scenarios: varied(
      'slope-calculator',
      12,
      [
        { name: 'x1', lo: -20, hi: 20, step: 0.5 },
        { name: 'y1', lo: -20, hi: 20, step: 0.5 },
        { name: 'x2', lo: -20, hi: 20, step: 0.5 },
        { name: 'y2', lo: -20, hi: 20, step: 0.5 },
      ],
      [],
      (v) => `P(${v.x1} ${v.y1}) Q(${v.x2} ${v.y2})`,
    ),
    introOutputs: ['m'],
    relatedSlugs: ['midpoint-calculator', 'distance-between-two-points-calculator', 'pythagorean-theorem-calculator'],
    checks: [
      { inputs: {}, expect: { m: '2', angle: '63.43°', eq: 'y = 2x + 0', dist: '6.7082' } },
      { inputs: { x1: 2, y1: 5, x2: 2, y2: 9 }, expect: { m: 'Undefined (vertical line)', angle: '90°', eq: 'x = 2', dist: '4' } },
      { inputs: { x1: 0, y1: 7, x2: 3, y2: -2 }, expect: { m: '-3', angle: '-71.57°', eq: 'y = -3x + 7', dist: '9.4868' } },
      { inputs: { x1: 1, y1: 1, x2: 1, y2: 1 }, expect: { m: 'Choose two different points' } },
    ],
  },
  {
    slug: 'midpoint-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Coordinate geometry',
    title: 'Midpoint Calculator: Center of a Line Segment',
    h1: 'Midpoint Calculator',
    metaDescription:
      'Find the midpoint of a line segment from the coordinates of its two endpoints, with the segment length and the radius of the circle that has it as a diameter.',
    about:
      'Halfway between two places lies a single spot that is the same distance from each, the centre of the segment joining them. Surveyors use it to place a marker, designers to centre an object between two edges and geometers to bisect a chord. Averaging the horizontal coordinates and averaging the vertical coordinates locates it. Enter both ends, negative or fractional values welcome, and you receive that centre, the full span and half of it, which doubles as the radius of the circle drawn with the segment as its diameter.',
    inputs: [real('x1', 'Endpoint 1, x', 1), real('y1', 'Endpoint 1, y', 2), real('x2', 'Endpoint 2, x', 7), real('y2', 'Endpoint 2, y', 10)],
    outputs: [out('mid', 'Midpoint', true), out('dist', 'Length of the segment'), out('half', 'Half the length (circle radius)')],
    calculate: (i) => {
      const x1 = toD(i.x1);
      const y1 = toD(i.y1);
      const x2 = toD(i.x2);
      const y2 = toD(i.y2);
      const len = x2.minus(x1).pow(2).plus(y2.minus(y1).pow(2)).sqrt();
      return { mid: `(${n4(x1.plus(x2).div(2))}, ${n4(y1.plus(y2).div(2))})`, dist: n4(len), half: n4(len.div(2)) };
    },
    formulaDescription: 'M = ((x₁ + x₂) ÷ 2, (y₁ + y₂) ÷ 2). The length is √((x₂ − x₁)² + (y₂ − y₁)²) and the circle radius is half of it.',
    formulaLatex: 'M = \\left(\\dfrac{x_{1}+x_{2}}{2},\\ \\dfrac{y_{1}+y_{2}}{2}\\right)',
    workedExample:
      'Between (1, 2) and (7, 10): the midpoint is (4, 6), the segment is 10 long and a circle on it as a diameter has radius 5. Between (−3, 4) and (5, −8) the midpoint is (1, −2).',
    faq: [
      {
        question: 'How do I find an endpoint if I know the midpoint?',
        answer: 'Double the midpoint coordinates and subtract the known endpoint: x₂ = 2M_x − x₁.',
      },
      { question: 'Does it work in three dimensions?', answer: 'The same averaging applies to a third coordinate; this page covers two dimensions.' },
      { question: 'Is the midpoint always on the line?', answer: 'Yes, it lies on the segment itself, exactly halfway along it.' },
    ],
    scenarios: varied(
      'midpoint-calculator',
      12,
      [
        { name: 'x1', lo: -40, hi: 40, step: 0.25 },
        { name: 'y1', lo: -40, hi: 40, step: 0.25 },
        { name: 'x2', lo: -40, hi: 40, step: 0.25 },
        { name: 'y2', lo: -40, hi: 40, step: 0.25 },
      ],
      [],
      (v) => `(${v.x1} ${v.y1}) (${v.x2} ${v.y2})`,
    ),
    introOutputs: ['mid'],
    relatedSlugs: ['slope-calculator', 'distance-between-two-points-calculator', 'circle-area-circumference-calculator'],
    checks: [
      { inputs: {}, expect: { mid: '(4, 6)', dist: '10', half: '5' } },
      { inputs: { x1: -3, y1: 4, x2: 5, y2: -8 }, expect: { mid: '(1, -2)', dist: '14.4222', half: '7.2111' } },
      { inputs: { x1: 0.5, y1: 1.5, x2: 2.25, y2: 3 }, expect: { mid: '(1.375, 2.25)', dist: '2.3049' } },
    ],
  },
  {
    slug: 'distance-between-two-points-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Coordinate geometry',
    title: 'Distance Between Two Points Calculator: 2D and 3D',
    h1: 'Distance Between Two Points Calculator',
    metaDescription:
      'Calculate the straight-line distance between two points in two or three dimensions, with the squared distance and the Manhattan (taxicab) distance.',
    about:
      'The straight-line distance between two points comes from the Pythagorean theorem extended to coordinates: square the differences along each axis, add them and take the square root. Enter the x, y and z coordinates of both points; leave z at zero for points on a flat plane. The page also returns the squared distance, which avoids the root when only comparing, and the Manhattan distance, the length of a route that only moves along the axes, like a taxi on a city grid.',
    inputs: [
      real('x1', 'Point 1, x', 1),
      real('y1', 'Point 1, y', 2),
      real('z1', 'Point 1, z (0 for 2D)', 0),
      real('x2', 'Point 2, x', 4),
      real('y2', 'Point 2, y', 6),
      real('z2', 'Point 2, z (0 for 2D)', 0),
    ],
    outputs: [out('dist', 'Straight-line distance', true), out('sq', 'Squared distance'), out('man', 'Manhattan distance')],
    calculate: (i) => {
      const dx = toD(i.x2).minus(toD(i.x1));
      const dy = toD(i.y2).minus(toD(i.y1));
      const dz = toD(i.z2).minus(toD(i.z1));
      const sq = dx.pow(2).plus(dy.pow(2)).plus(dz.pow(2));
      return { dist: n4(sq.sqrt()), sq: n4(sq), man: n4(dx.abs().plus(dy.abs()).plus(dz.abs())) };
    },
    formulaDescription: 'd = √((x₂ − x₁)² + (y₂ − y₁)² + (z₂ − z₁)²). Manhattan distance = |Δx| + |Δy| + |Δz|.',
    formulaLatex: 'd = \\sqrt{(x_{2}-x_{1})^{2} + (y_{2}-y_{1})^{2} + (z_{2}-z_{1})^{2}}',
    workedExample:
      'From (1, 2, 0) to (4, 6, 0): Δ = (3, 4, 0), so d = √25 = 5, the squared distance is 25 and the Manhattan distance is 7. From (1, 2, 3) to (4, 6, 15) the distance is 13.',
    faq: [
      {
        question: 'Is this the shortest distance?',
        answer: 'Yes, the straight line. The Manhattan distance is the length of a route along the grid, which is never shorter.',
      },
      { question: 'Can I use it for map coordinates?', answer: 'Only over short distances on a flat map; latitude and longitude need a great-circle formula.' },
      {
        question: 'Why use the squared distance?',
        answer: 'Comparing squared distances ranks points the same way without computing a square root, which is faster in software.',
      },
    ],
    scenarios: varied(
      'distance-between-two-points-calculator',
      12,
      [
        { name: 'x1', lo: -60, hi: 60, step: 0.5 },
        { name: 'y1', lo: -60, hi: 60, step: 0.5 },
        { name: 'z1', lo: -60, hi: 60, step: 0.5 },
        { name: 'x2', lo: -60, hi: 60, step: 0.5 },
        { name: 'y2', lo: -60, hi: 60, step: 0.5 },
        { name: 'z2', lo: -60, hi: 60, step: 0.5 },
      ],
      [],
      (v) => `from (${v.x1}, ${v.y1}, ${v.z1}) to (${v.x2}, ${v.y2}, ${v.z2})`,
    ),
    introOutputs: ['dist'],
    relatedSlugs: ['pythagorean-theorem-calculator', 'midpoint-calculator', 'slope-calculator'],
    checks: [
      { inputs: {}, expect: { dist: '5', sq: '25', man: '7' } },
      { inputs: { x1: 1, y1: 2, z1: 3, x2: 4, y2: 6, z2: 15 }, expect: { dist: '13', sq: '169', man: '19' } },
      { inputs: { x1: -2.5, y1: 0, z1: 0, x2: 2.5, y2: 0, z2: 0 }, expect: { dist: '5', man: '5' } },
    ],
  },
  {
    slug: 'ratio-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Ratios and proportions',
    title: 'Ratio Calculator: Solve a : b = c : x and Simplify',
    h1: 'Ratio Calculator',
    metaDescription: 'Solve a proportion a : b = c : x for the missing value, simplify the ratio a : b to lowest terms and find the scale factor.',
    about:
      'A ratio compares two quantities, and a proportion says two ratios are equal. Given the first ratio a to b and one term of an equivalent ratio, the missing term follows by cross-multiplying. Enter a, b and c to get x, the ratio a to b reduced to its simplest whole numbers and the factor by which the first ratio was scaled. It answers questions such as how much flour goes with 9 cups of water when 3 cups of flour go with 4, or the height of a 16 : 9 screen that is 1,920 wide.',
    inputs: [pos('a', 'a', 3), pos('b', 'b', 4), pos('c', 'c', 9)],
    outputs: [out('x', 'Missing value x', true), out('simple', 'a : b in lowest terms'), out('factor', 'Scale factor c ÷ a')],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      const c = toD(i.c);
      const k = Math.max(a.decimalPlaces(), b.decimalPlaces());
      const scale = new D(10).pow(k);
      const ia = BigInt(a.mul(scale).toFixed(0));
      const ib = BigInt(b.mul(scale).toFixed(0));
      const g = gcdBig(ia, ib) || 1n;
      return { x: n4(b.mul(c).div(a)), simple: `${ia / g} : ${ib / g}`, factor: `${n4(c.div(a))}×` };
    },
    formulaDescription:
      'a ÷ b = c ÷ x, so x = b × c ÷ a. The ratio is reduced by dividing both terms by their greatest common divisor, after scaling decimals to whole numbers.',
    formulaLatex: 'a : b = c : x \\;\\Rightarrow\\; x = \\dfrac{bc}{a}',
    workedExample:
      '3 : 4 = 9 : x gives x = 4 × 9 ÷ 3 = 12; the ratio is already in lowest terms and the scale factor is 3. For 16 : 9 = 1,920 : x the height is 1,080, a factor of 120.',
    faq: [
      {
        question: 'What is the difference between a ratio and a fraction?',
        answer:
          'A ratio compares two quantities of the same kind or different kinds; a fraction is a part of one whole. The ratio 3 : 4 corresponds to the fraction 3 ÷ 4 only if you compare the first with the second.',
      },
      {
        question: 'How do I scale a recipe?',
        answer: 'Set a and b to the original amounts and c to the new amount of one ingredient; x is the matching new amount of the other.',
      },
      {
        question: 'Why does the page show a ratio in whole numbers?',
        answer: 'Ratios are conventionally written with the smallest whole numbers, so 2.5 : 10 becomes 1 : 4.',
      },
    ],
    scenarios: varied(
      'ratio-calculator',
      12,
      [
        { name: 'a', lo: 1, hi: 40, step: 0.5 },
        { name: 'b', lo: 1, hi: 40, step: 0.5 },
        { name: 'c', lo: 2, hi: 400, step: 0.5 },
      ],
      [],
      (v) => `${v.a} : ${v.b} = ${v.c} : x`,
    ),
    introOutputs: ['x', 'simple'],
    relatedSlugs: ['percentage-calculator', 'fraction-calculator', 'unit-price-calculator'],
    checks: [
      { inputs: {}, expect: { x: '12', simple: '3 : 4', factor: '3×' } },
      { inputs: { a: 2.5, b: 10, c: 7 }, expect: { x: '28', simple: '1 : 4', factor: '2.8×' } },
      { inputs: { a: 16, b: 9, c: 1920 }, expect: { x: '1,080', simple: '16 : 9', factor: '120×' } },
    ],
  },
  {
    slug: 'percent-error-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Percentages',
    title: 'Percent Error Calculator: Measured vs Accepted Value',
    h1: 'Percent Error Calculator',
    metaDescription:
      'Calculate the percent error between a measured (experimental) value and the accepted (theoretical) value, with the absolute error and the sign.',
    about:
      'Percent error tells you how far a measurement is from the value it should have, as a share of that value. It is the standard way to report the accuracy of a lab result: a small percentage means a close match. Enter your measured value and the accepted value to get the percent error, the signed error that shows whether you came out high or low and the absolute error in the original units. The accepted value cannot be zero because the error is measured against it.',
    inputs: [real('e', 'Measured (experimental) value', 9.6), real('t', 'Accepted (theoretical) value', 9.81)],
    outputs: [out('pct', 'Percent error', true), out('signed', 'Signed error'), out('abs', 'Absolute error')],
    calculate: (i) => {
      const e = toD(i.e);
      const t = toD(i.t);
      if (t.isZero()) return { pct: 'The accepted value cannot be zero', signed: '', abs: '' };
      const err = e.minus(t).div(t.abs()).mul(100);
      return { pct: `${fmtNumber(err.abs(), 2)}%`, signed: `${fmtNumber(err, 2)}%`, abs: n4(e.minus(t).abs()) };
    },
    formulaDescription: 'Percent error = |measured − accepted| ÷ |accepted| × 100%. The signed version keeps the sign of (measured − accepted).',
    formulaLatex: '\\text{error} = \\dfrac{|v_{measured} - v_{accepted}|}{|v_{accepted}|} \\times 100\\%',
    workedExample:
      'A student measures g as 9.6 m/s² where the accepted value is 9.81: the absolute error is 0.21, the percent error 2.14% and the signed error −2.14%, so the result was low.',
    faq: [
      {
        question: 'Is percent error the same as percent difference?',
        answer: 'No. Percent error compares a measurement with a known true value; percent difference compares two values neither of which is the reference.',
      },
      {
        question: 'Can percent error be negative?',
        answer: 'It is usually quoted as a positive number. The signed version shows whether the measurement was above or below the accepted value.',
      },
      {
        question: 'What is a good percent error?',
        answer: 'It depends on the experiment; classroom work often aims for under 5%, precision work for far less.',
      },
    ],
    scenarios: varied(
      'percent-error-calculator',
      12,
      [
        { name: 'e', lo: 0.5, hi: 480, step: 0.01 },
        { name: 't', lo: 0.5, hi: 480, step: 0.01 },
      ],
      [],
      (v) => `measured ${v.e} against ${v.t}`,
    ),
    introOutputs: ['pct'],
    relatedSlugs: ['percentage-difference-calculator', 'percentage-increase-calculator', 'percentage-calculator'],
    checks: [
      { inputs: {}, expect: { pct: '2.14%', signed: '-2.14%', abs: '0.21' } },
      { inputs: { e: 102, t: 100 }, expect: { pct: '2%', signed: '2%', abs: '2' } },
      { inputs: { e: 3.2, t: 3.14159 }, expect: { pct: '1.86%', signed: '1.86%' } },
    ],
  },
  {
    slug: 'percentage-decrease-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Percentages',
    title: 'Percentage Decrease Calculator: How Much Did It Fall?',
    h1: 'Percentage Decrease Calculator',
    metaDescription: 'Calculate the percentage decrease from an original value to a new, lower value, with the amount of the drop and the remaining fraction.',
    about:
      'A percentage decrease measures a drop as a share of where you started. A price cut from 80 to 60 is a 25 percent decrease, because 20 is a quarter of 80. Enter the original and the new value to get the percentage, the size of the drop and the multiplier that turns the old value into the new one. If the new value is higher, the answer comes out negative, which is simply a percentage increase of the same size read the other way.',
    inputs: [pos('o', 'Original value', 80), pos('n', 'New value', 60)],
    outputs: [out('pct', 'Percentage decrease', true), out('amount', 'Amount of the decrease'), out('factor', 'New value as a multiple of the old')],
    calculate: (i) => {
      const o = toD(i.o);
      const n = toD(i.n);
      return { pct: `${fmtNumber(o.minus(n).div(o).mul(100), 2)}%`, amount: fmtNumber(o.minus(n), 2), factor: n4(n.div(o)) };
    },
    formulaDescription: 'Percentage decrease = (original − new) ÷ original × 100%. The multiplier is new ÷ original, so a 25% decrease is a factor of 0.75.',
    formulaLatex: '\\dfrac{V_{old} - V_{new}}{V_{old}} \\times 100\\%',
    workedExample:
      'From 80 to 60: the drop is 20, which is 20 ÷ 80 = 25%, and the new value is 0.75 of the old. From 40 to 50 the result is −25%, a 25% increase.',
    faq: [
      {
        question: 'Why is a 50% fall followed by a 50% rise not back at the start?',
        answer: 'The rise is applied to the smaller number, so it adds less than the fall took away.',
      },
      {
        question: 'How do I apply a percentage decrease?',
        answer: 'Multiply by 1 minus the percentage as a decimal: a 20% decrease on 250 gives 250 × 0.8 = 200.',
      },
      {
        question: 'What if the new value is higher?',
        answer: 'The result is negative, meaning an increase. Use the percentage increase calculator for the plain figure.',
      },
    ],
    scenarios: varied(
      'percentage-decrease-calculator',
      12,
      [
        { name: 'o', lo: 12, hi: 940, step: 0.01 },
        { name: 'n', lo: 5, hi: 990, step: 0.01 },
      ],
      [],
      (v) => `fell from ${v.o} to ${v.n}`,
    ),
    introOutputs: ['pct'],
    relatedSlugs: ['percentage-increase-calculator', 'percentage-difference-calculator', 'reverse-percentage-calculator'],
    checks: [
      { inputs: {}, expect: { pct: '25%', amount: '20', factor: '0.75' } },
      { inputs: { o: 250, n: 199.99 }, expect: { pct: '20%', amount: '50.01', factor: '0.8' } },
      { inputs: { o: 40, n: 50 }, expect: { pct: '-25%', amount: '-10' } },
    ],
  },
  {
    slug: 'rounding-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Number sense',
    title: 'Rounding Calculator: Decimal Places, Tens and Rounding Modes',
    h1: 'Rounding Calculator',
    metaDescription:
      'Round a number to a chosen number of decimal places, or to the nearest ten, hundred or thousand, with half up, half even, round up, round down and truncate.',
    about:
      "Rounding replaces a number with a nearby, simpler one, but there is more than one rule for it. Half up sends 2.5 to 3, half even (banker's rounding) sends it to 2 to avoid a bias, round down always goes toward minus infinity, round up toward plus infinity and truncate simply drops the extra digits. Enter a number, the places to keep and the method. Use a negative number of places to round to the nearest ten, hundred or thousand, and read the rounded result and the rounding error.",
    inputs: [
      real('x', 'Number', 3.14159),
      intField('p', 'Decimal places (negative for tens, hundreds)', 2, -9, 15),
      sel('mode', 'Rounding method', 'half_up', [
        ['half_up', 'Half up (the usual rule)'],
        ['half_even', "Half to even (banker's rounding)"],
        ['down', 'Round down (toward −∞)'],
        ['up', 'Round up (toward +∞)'],
        ['trunc', 'Truncate (toward zero)'],
      ]),
    ],
    outputs: [out('r', 'Rounded number', true), out('diff', 'Rounding error (rounded − original)')],
    calculate: (i) => {
      const x = toD(i.x);
      const p = Number(i.p);
      const mode = ROUNDING[String(i.mode)] ?? D.ROUND_HALF_UP;
      const r = p >= 0 ? x.toDecimalPlaces(p, mode) : x.div(new D(10).pow(-p)).toDecimalPlaces(0, mode).mul(new D(10).pow(-p));
      return { r: fmtFixed(r, Math.max(p, 0)), diff: fmtNumber(r.minus(x), 10) };
    },
    formulaDescription:
      'The number is scaled by 10 to the power of the places, rounded to a whole number with the chosen rule, and scaled back. Half up: ties go away from zero for positive numbers; half even: ties go to the even neighbour.',
    formulaLatex: 'r = \\operatorname{round}(x \\cdot 10^{p}) \\cdot 10^{-p}',
    workedExample: '3.14159 to 2 places is 3.14 (error −0.00159). 2.5 to 0 places is 3 half up but 2 half even. 1,234.5678 to −2 places is 1,200.',
    faq: [
      {
        question: 'Which rule does school maths use?',
        answer: "Half up: if the next digit is 5 or more, round up. Banker's rounding is common in finance and programming to avoid drift.",
      },
      { question: 'How do I round to the nearest hundred?', answer: 'Enter −2 for the decimal places: 1,234.5678 becomes 1,200.' },
      { question: 'How does round down treat negatives?', answer: 'It goes toward minus infinity, so −2.5 becomes −3; truncate would give −2.' },
    ],
    scenarios: varied(
      'rounding-calculator',
      12,
      [
        { name: 'x', lo: -9000, hi: 9000, step: 0.0013 },
        { name: 'p', lo: -3, hi: 4, step: 1 },
      ],
      [{ name: 'mode', options: ['half_up', 'half_even', 'down', 'up', 'trunc'] }],
      (v) => `${v.x} to ${v.p} places, ${v.mode}`,
    ),
    introOutputs: ['r'],
    relatedSlugs: ['significant-figures-calculator', 'scientific-notation-calculator', 'percentage-calculator'],
    checks: [
      { inputs: {}, expect: { r: '3.14', diff: '-0.00159' } },
      { inputs: { x: 2.5, p: 0, mode: 'half_even' }, expect: { r: '2', diff: '-0.5' } },
      { inputs: { x: 2.5, p: 0, mode: 'half_up' }, expect: { r: '3', diff: '0.5' } },
      { inputs: { x: -2.5, p: 0, mode: 'down' }, expect: { r: '-3', diff: '-0.5' } },
      { inputs: { x: 1234.5678, p: -2, mode: 'half_up' }, expect: { r: '1,200', diff: '-34.5678' } },
      { inputs: { x: 7.891, p: 1, mode: 'trunc' }, expect: { r: '7.8', diff: '-0.091' } },
      { inputs: { x: 7.891, p: 1, mode: 'up' }, expect: { r: '7.9' } },
    ],
  },
  {
    slug: 'significant-figures-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Number sense',
    title: 'Significant Figures Calculator: Count and Round to Sig Figs',
    h1: 'Significant Figures Calculator',
    metaDescription: 'Count the significant figures in a number, write it in scientific notation and round it to a chosen number of significant figures.',
    about:
      'Significant figures are the digits that carry information about a measurement. Leading zeros do not count, zeros between other digits do, and trailing zeros count only when a decimal point is present, so 0.004500 has four significant figures and 120 has two. Type a number, including scientific notation such as 6.022e23, and the number of significant figures to round to. The page counts the digits, shows the value in scientific notation and gives the rounded number.',
    inputs: [numText('x', 'Number (keep trailing zeros, e.g. 0.004500)', '0.004500'), intField('n', 'Round to this many significant figures', 2, 1, 20)],
    outputs: [out('count', 'Significant figures in the number', true), out('sci', 'Scientific notation'), out('rounded', 'Rounded value')],
    calculate: (i) => {
      const text = String(i.x).trim().replace(/,/g, '');
      const n = Number(i.n);
      const x = new D(text);
      const count = String(sigCount(text));
      if (x.isZero()) return { count, sci: '0', rounded: '0' };
      const e = x.e;
      const s = text.toLowerCase().replace(/^[+-]/, '').split('e')[0];
      let digs = s.replace('.', '').replace(/^0+/, '');
      if (!s.includes('.')) digs = digs.replace(/0+$/, '');
      const mantissa = `${text.startsWith('-') ? '-' : ''}${digs[0]}${digs.length > 1 ? `.${digs.slice(1)}` : ''}`;
      const sci = `${mantissa} × 10^${e}`;
      if (Math.abs(e) >= 15) {
        let mant = x.div(new D(10).pow(e)).toDecimalPlaces(n - 1, D.ROUND_HALF_UP);
        let ee = e;
        if (mant.abs().gte(10)) {
          mant = mant.div(10);
          ee += 1;
        }
        return { count, sci, rounded: `${mant.toFixed(n - 1)} × 10^${ee}` };
      }
      const dp = n - 1 - e;
      const rounded =
        dp >= 0
          ? x.toDecimalPlaces(dp, D.ROUND_HALF_UP).toFixed(dp)
          : x.div(new D(10).pow(-dp)).toDecimalPlaces(0, D.ROUND_HALF_UP).mul(new D(10).pow(-dp)).toFixed(0);
      return { count, sci, rounded };
    },
    formulaDescription:
      'Rules: non-zero digits always count; zeros between them count; leading zeros never count; trailing zeros count only after a decimal point (or with a trailing point as in 1200.). Rounding keeps the first n significant digits, half up.',
    formulaLatex: 'x = d_{1}.d_{2}\\ldots d_{k} \\times 10^{e}',
    workedExample:
      '0.004500 has 4 significant figures and is 4.500 × 10⁻³; to 2 sig figs it is 0.0045. 120 has 2 (the trailing zero is ambiguous), 1200. has 4, and 98,765 to 3 sig figs is 98,800.',
    faq: [
      {
        question: 'Why do trailing zeros sometimes not count?',
        answer: 'In a whole number such as 120 the zero may only be a placeholder, so by convention it is not significant unless a decimal point follows.',
      },
      { question: 'How do I show a trailing zero is significant?', answer: 'Write a decimal point (1200.) or use scientific notation (1.200 × 10³).' },
      {
        question: 'How many sig figs in a calculation result?',
        answer: 'For multiplication and division, as many as the least precise factor; for addition, round to the least precise decimal place.',
      },
    ],
    scenarios: ['0.004500', '120', '1200.', '6.0221e23', '98765', '0.0070', '3.0100', '45000', '0.0000808', '7.200', '1.000e-5', '25.40'].map((x, k) => ({
      label: `${x} to ${(k % 3) + 2} sig figs`,
      inputs: { x, n: (k % 3) + 2 },
    })),
    introOutputs: ['count'],
    relatedSlugs: ['rounding-calculator', 'scientific-notation-calculator', 'scientific-notation-arithmetic-calculator'],
    checks: [
      { inputs: {}, expect: { count: '4', sci: '4.500 × 10^-3', rounded: '0.0045' } },
      { inputs: { x: '120', n: 1 }, expect: { count: '2', sci: '1.2 × 10^2', rounded: '100' } },
      { inputs: { x: '1200.', n: 3 }, expect: { count: '4', sci: '1.200 × 10^3', rounded: '1200' } },
      { inputs: { x: '6.022e23', n: 3 }, expect: { count: '4', sci: '6.022 × 10^23', rounded: '6.02 × 10^23' } },
      { inputs: { x: '0.0070', n: 1 }, expect: { count: '2', sci: '7.0 × 10^-3', rounded: '0.007' } },
      { inputs: { x: '98765', n: 3 }, expect: { count: '5', sci: '9.8765 × 10^4', rounded: '98800' } },
    ],
  },
  {
    slug: 'scientific-notation-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Number sense',
    title: 'Scientific Notation Calculator: Convert Numbers to Powers of Ten',
    h1: 'Scientific Notation Calculator',
    metaDescription:
      'Convert any number to scientific notation and engineering notation, or an e-notation value back to a plain decimal, with the order of magnitude.',
    about:
      'Scientific notation writes a number as a mantissa between 1 and 10 times a power of ten, which keeps very large and very small numbers readable: the speed of light is about 3 × 10⁸ metres per second, and a red blood cell is about 7 × 10⁻⁶ metres across. Type a number in decimal or e-notation (6.022e23) to get its scientific form, the engineering form, which uses exponents that are multiples of three, the plain decimal and the order of magnitude.',
    inputs: [numText('x', 'Number (decimal or e-notation)', '123456.789')],
    outputs: [out('sci', 'Scientific notation', true), out('eng', 'Engineering notation'), out('plain', 'Standard decimal'), out('oom', 'Order of magnitude')],
    calculate: (i) => {
      const x = new D(String(i.x).trim().replace(/,/g, ''));
      if (x.isZero()) return { sci: '0', eng: '0', plain: '0', oom: '0' };
      const e = x.e;
      const eng = Math.floor(e / 3) * 3;
      return { sci: sciText(x), eng: `${x.div(new D(10).pow(eng)).toFixed()} × 10^${eng}`, plain: fmtNumber(x, 12), oom: String(e) };
    },
    formulaDescription:
      'x = m × 10ⁿ with 1 ≤ |m| < 10 and n a whole number. Engineering notation uses an exponent that is a multiple of 3, so the mantissa lies between 1 and 1,000. The order of magnitude is n.',
    formulaLatex: 'x = m \\times 10^{n}, \\quad 1 \\le |m| < 10',
    workedExample:
      '123,456.789 = 1.23456789 × 10⁵ in scientific notation and 123.456789 × 10³ in engineering notation; the order of magnitude is 5. And 0.000042 = 4.2 × 10⁻⁵ = 42 × 10⁻⁶.',
    faq: [
      { question: 'What is e-notation?', answer: 'A way calculators and spreadsheets write × 10ⁿ: 6.022e23 means 6.022 × 10²³.' },
      {
        question: 'Why use engineering notation?',
        answer: 'Its exponents match the SI prefixes (kilo, mega, milli, micro), so 42 × 10⁻⁶ reads at once as 42 micro-units.',
      },
      { question: 'How do I move the decimal point?', answer: 'A positive exponent moves it right by that many places, a negative exponent moves it left.' },
    ],
    scenarios: ['0.000042', '6.022e23', '-5000', '299792458', '0.00000000314', '1.5e-9', '86400', '7.3e22', '0.5', '123456789012', '-0.0072', '4.0e3'].map(
      (x) => ({ label: `number ${x}`, inputs: { x } }),
    ),
    introOutputs: ['sci', 'oom'],
    relatedSlugs: ['scientific-notation-arithmetic-calculator', 'significant-figures-calculator', 'exponent-calculator'],
    checks: [
      { inputs: {}, expect: { sci: '1.23456789 × 10^5', eng: '123.456789 × 10^3', plain: '123,456.789', oom: '5' } },
      { inputs: { x: '0.000042' }, expect: { sci: '4.2 × 10^-5', eng: '42 × 10^-6', plain: '0.000042', oom: '-5' } },
      { inputs: { x: '6.022e23' }, expect: { sci: '6.022 × 10^23', eng: '602.2 × 10^21', plain: '602,200,000,000,000,000,000,000', oom: '23' } },
      { inputs: { x: '-5000' }, expect: { sci: '-5 × 10^3', eng: '-5 × 10^3', plain: '-5,000', oom: '3' } },
    ],
  },
  {
    slug: 'scientific-notation-arithmetic-calculator',
    category: 'math',
    tier: 3,
    subCluster: 'Number sense',
    title: 'Scientific Notation Calculator: Add, Subtract, Multiply and Divide',
    h1: 'Scientific Notation Arithmetic Calculator',
    metaDescription:
      'Add, subtract, multiply or divide two numbers written in scientific notation, with the answer in scientific notation and as a plain decimal.',
    about:
      'Working with numbers in scientific notation follows its own shortcuts: multiply the mantissas and add the exponents, divide the mantissas and subtract the exponents, but to add or subtract you must first bring both numbers to the same power of ten. Enter two numbers in e-notation, such as 3.2e5 and 4.5e-2, and choose an operation. The page does all the bookkeeping with exact decimal arithmetic and gives the answer in scientific notation and in ordinary form.',
    inputs: [
      numText('a', 'First number (e.g. 3.2e5)', '3.2e5'),
      sel('op', 'Operation', 'mul', [
        ['add', 'Add'],
        ['sub', 'Subtract'],
        ['mul', 'Multiply'],
        ['div', 'Divide'],
      ]),
      numText('b', 'Second number (e.g. 4.5e-2)', '4.5e-2'),
    ],
    outputs: [out('sci', 'Result in scientific notation', true), out('plain', 'Result as a decimal')],
    calculate: (i) => {
      const a = new D(String(i.a).trim().replace(/,/g, ''));
      const b = new D(String(i.b).trim().replace(/,/g, ''));
      const op = String(i.op);
      if (op === 'div' && b.isZero()) return { sci: 'Cannot divide by zero', plain: '' };
      const r = op === 'add' ? a.plus(b) : op === 'sub' ? a.minus(b) : op === 'mul' ? a.mul(b) : a.div(b);
      return { sci: sciText(r), plain: fmtNumber(r, 12) };
    },
    formulaDescription:
      '(a × 10ᵐ)(b × 10ⁿ) = ab × 10ᵐ⁺ⁿ and (a × 10ᵐ) ÷ (b × 10ⁿ) = (a ÷ b) × 10ᵐ⁻ⁿ. For sums and differences, rewrite both terms with the same exponent first.',
    formulaLatex: '(a\\times 10^{m})(b\\times 10^{n}) = ab\\times 10^{m+n}',
    workedExample: '3.2 × 10⁵ times 4.5 × 10⁻² is 14.4 × 10³ = 1.44 × 10⁴ = 14,400. And 6 × 10⁸ divided by 2 × 10³ is 3 × 10⁵.',
    faq: [
      {
        question: 'Why must exponents match to add?',
        answer: 'You can only add quantities of the same size unit, just as you cannot add 3 hundreds and 4 thousands without converting first.',
      },
      { question: 'What if the mantissa ends up above 10?', answer: 'It is renormalised: 14.4 × 10³ becomes 1.44 × 10⁴.' },
      {
        question: 'Is the result exact?',
        answer: 'Yes, up to the 12 decimal places shown for the plain form; the calculation itself is exact decimal arithmetic.',
      },
    ],
    scenarios: [
      ['3.2e5', 'mul', '4.5e-2'],
      ['6e8', 'div', '2e3'],
      ['1.5e3', 'add', '2.5e2'],
      ['1e-3', 'sub', '1e-5'],
      ['7.2e12', 'mul', '3.1e-4'],
      ['9.1e-31', 'mul', '2.2e6'],
      ['4.4e7', 'div', '8e-2'],
      ['5.5e4', 'add', '4.5e5'],
      ['3e8', 'mul', '3e8'],
      ['6.67e-11', 'sub', '1.2e-12'],
      ['8.3e-3', 'div', '4.15e-6'],
      ['1.1e9', 'add', '2.2e9'],
    ].map(([a, op, b]) => ({ label: `${a} ${op} ${b}`, inputs: { a, op, b } })),
    introOutputs: ['sci'],
    relatedSlugs: ['scientific-notation-calculator', 'significant-figures-calculator', 'exponent-calculator'],
    checks: [
      { inputs: {}, expect: { sci: '1.44 × 10^4', plain: '14,400' } },
      { inputs: { a: '6e8', b: '2e3', op: 'div' }, expect: { sci: '3 × 10^5', plain: '300,000' } },
      { inputs: { a: '1.5e3', b: '2.5e2', op: 'add' }, expect: { sci: '1.75 × 10^3', plain: '1,750' } },
      { inputs: { a: '1e-3', b: '1e-5', op: 'sub' }, expect: { sci: '9.9 × 10^-4', plain: '0.00099' } },
      { inputs: { a: '5', b: '0', op: 'div' }, expect: { sci: 'Cannot divide by zero' } },
    ],
  },
  {
    slug: 'decimal-to-fraction-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Fractions',
    title: 'Decimal to Fraction Calculator: Exact Fraction in Lowest Terms',
    h1: 'Decimal to Fraction Calculator',
    metaDescription: 'Convert a decimal number to an exact fraction in lowest terms, with the mixed number form and the equivalent percentage.',
    about:
      'Reading a decimal aloud hands you its fraction: 0.125 is one hundred twenty-five thousandths. Write those digits over the matching power of ten, 125 over 1,000, then cancel any factor the top and bottom share until nothing more can be removed. Type a terminating decimal, negative or above one if you like, and you get the cancelled form, the mixed number and the equivalent percentage. A decimal that repeats forever cannot be typed exactly, so 0.333 is treated as three hundred thirty-three thousandths.',
    inputs: [real('x', 'Decimal number', 0.125)],
    outputs: [out('exact', 'Fraction in lowest terms', true), out('mixed', 'As a mixed number'), out('pct', 'As a percentage')],
    calculate: (i) => {
      const x = toD(i.x);
      const [n, d] = fracOf(x);
      return { exact: fracText(n, d), mixed: mixedText(n, d), pct: `${fmtNumber(x.mul(100), 6)}%` };
    },
    formulaDescription:
      'A decimal with k places is the whole number of its digits divided by 10ᵏ; divide numerator and denominator by their greatest common divisor to reach lowest terms. A mixed number is the whole part plus the remaining fraction.',
    formulaLatex: '0.125 = \\dfrac{125}{1000} = \\dfrac{1}{8}',
    workedExample: '0.125 = 125/1,000 = 1/8, which is 12.5%. And 2.375 = 2,375/1,000 = 19/8 = 2 3/8; 0.75 = 3/4.',
    faq: [
      {
        question: 'Why does 0.333 not give 1/3?',
        answer: 'It is exactly 333/1,000. A repeating decimal needs its repeating part named, as in 0.333… = 1/3; the fraction-to-decimal page shows repeats.',
      },
      { question: 'What is lowest terms?', answer: 'A fraction whose numerator and denominator share no common factor other than 1.' },
      { question: 'How do I convert a negative decimal?', answer: 'Convert its absolute value and keep the minus sign: −0.6 = −3/5.' },
    ],
    scenarios: [0.8125, 0.0375, 2.4375, 0.352, 1.0625, 0.0064, 3.875, 0.9375, 5.12, 0.0175, 7.6875, 0.216].map((x) => ({ label: `value ${x}`, inputs: { x } })),
    introOutputs: ['exact'],
    relatedSlugs: ['fraction-to-decimal-calculator', 'decimal-to-percent-calculator', 'fraction-calculator'],
    checks: [
      { inputs: {}, expect: { exact: '1/8', mixed: '1/8', pct: '12.5%' } },
      { inputs: { x: 0.75 }, expect: { exact: '3/4', mixed: '3/4', pct: '75%' } },
      { inputs: { x: 2.375 }, expect: { exact: '19/8', mixed: '2 3/8', pct: '237.5%' } },
      { inputs: { x: -0.6 }, expect: { exact: '-3/5', mixed: '-3/5', pct: '-60%' } },
      { inputs: { x: 3 }, expect: { exact: '3', mixed: '3', pct: '300%' } },
    ],
  },
  {
    slug: 'fraction-to-decimal-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Fractions',
    title: 'Fraction to Decimal Calculator: Terminating and Repeating Decimals',
    h1: 'Fraction to Decimal Calculator',
    metaDescription:
      'Convert a fraction to a decimal by long division, showing repeating decimals with the repeating block in brackets, plus the rounded value and the percentage.',
    about:
      'Dividing the numerator by the denominator turns a fraction into a decimal, which by hand means long division. Some quotients stop, like 7/8 = 0.875; others never do, because a remainder returns and the same digits cycle, as with 1/3 and 22/7. The page performs the division exactly, notes the step where a remainder recurs and writes the cycling digits in brackets, so 1/6 reads 0.1(6). It also gives six rounded places, the percentage and whether the digits end or repeat.',
    inputs: [intField('n', 'Numerator', 1, -1000000000, 1000000000), intField('dn', 'Denominator (1 to 300)', 3, 1, 300)],
    outputs: [out('dec', 'Decimal expansion', true), out('round', 'Rounded to 6 places'), out('pct', 'As a percentage'), out('kind', 'Type')],
    calculate: (i) => {
      const n = BigInt(toD(i.n).toFixed(0));
      const d = BigInt(toD(i.dn).toFixed(0));
      const { text, period } = expand(n, d);
      const value = new D(n.toString()).div(new D(d.toString()));
      return {
        dec: text,
        round: fmtNumber(value, 6),
        pct: `${fmtNumber(value.mul(100), 4)}%`,
        kind: period === 0 ? 'Terminating decimal' : `Repeating decimal, period ${period}`,
      };
    },
    formulaDescription:
      'Long division, remembering each remainder: when a remainder repeats, the digits repeat from there. A fraction in lowest terms terminates only if its denominator has no prime factors other than 2 and 5.',
    formulaLatex: '\\dfrac{p}{q} = p \\div q',
    workedExample:
      '1/3 = 0.(3), a repeating decimal of period 1, rounded 0.333333 and 33.3333%. 7/8 = 0.875 terminates. 22/7 = 3.(142857) has a repeating block of six digits.',
    faq: [
      {
        question: 'How do I know if a fraction repeats?',
        answer: 'Reduce it to lowest terms; if the denominator has any prime factor other than 2 or 5, the decimal repeats.',
      },
      { question: 'What does the bracket mean?', answer: 'The digits inside the brackets repeat forever: 0.1(6) means 0.1666… .' },
      { question: 'What is the longest repeat?', answer: 'For a denominator d the block is at most d − 1 digits long, as for 1/7.' },
    ],
    scenarios: [
      [19, 64],
      [41, 7],
      [13, 48],
      [29, 11],
      [7, 60],
      [53, 16],
      [31, 13],
      [11, 45],
      [37, 24],
      [3, 70],
      [47, 9],
      [61, 22],
    ].map(([n, dn]) => ({ label: `${n}/${dn}`, inputs: { n, dn } })),
    introOutputs: ['dec', 'kind'],
    relatedSlugs: ['decimal-to-fraction-calculator', 'decimal-to-percent-calculator', 'fraction-calculator'],
    checks: [
      { inputs: {}, expect: { dec: '0.(3)', round: '0.333333', pct: '33.3333%', kind: 'Repeating decimal, period 1' } },
      { inputs: { n: 7, dn: 8 }, expect: { dec: '0.875', round: '0.875', pct: '87.5%', kind: 'Terminating decimal' } },
      { inputs: { n: 22, dn: 7 }, expect: { dec: '3.(142857)', round: '3.142857', pct: '314.2857%', kind: 'Repeating decimal, period 6' } },
      { inputs: { n: 1, dn: 6 }, expect: { dec: '0.1(6)', round: '0.166667', pct: '16.6667%', kind: 'Repeating decimal, period 1' } },
      { inputs: { n: -5, dn: 4 }, expect: { dec: '-1.25', round: '-1.25', pct: '-125%', kind: 'Terminating decimal' } },
    ],
  },
  {
    slug: 'decimal-to-percent-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Percentages',
    title: 'Decimal to Percent Calculator: Convert Both Ways',
    h1: 'Decimal to Percent Calculator',
    metaDescription: 'Convert a decimal to a percentage or a percentage back to a decimal, with the matching fraction and the figure out of 100.',
    about:
      'Per cent means per hundred, so moving between a decimal and a percentage is a matter of shifting the point two places. Multiply by 100 to express a proportion such as 0.375 as 37.5 percent; divide by 100 to bring a quoted rate like 12.5 percent back to 0.125 for use in a formula. Pick the direction and enter the number. Values past one are fine, since 1.5 is 150 percent. The page also writes the same amount as a reduced fraction.',
    inputs: [
      sel('mode', 'Convert', 'dp', [
        ['dp', 'Decimal to percent'],
        ['pd', 'Percent to decimal'],
      ]),
      real('x', 'Number', 0.375),
    ],
    outputs: [out('result', 'Result', true), out('frac', 'As a fraction'), out('per', 'Out of 100')],
    calculate: (i) => {
      const x = toD(i.x);
      if (String(i.mode) === 'pd') {
        const dec = x.div(100);
        const [n, d] = fracOf(dec);
        return { result: fmtNumber(dec, 10), frac: fracText(n, d), per: `${fmtNumber(x, 6)} out of 100` };
      }
      const [n, d] = fracOf(x);
      return { result: `${fmtNumber(x.mul(100), 8)}%`, frac: fracText(n, d), per: `${fmtNumber(x.mul(100), 6)} out of 100` };
    },
    formulaDescription:
      'Percent = decimal × 100, and decimal = percent ÷ 100. The fraction is the decimal written over a power of ten and reduced to lowest terms.',
    formulaLatex: 'p\\% = 100 \\times d',
    workedExample: '0.375 = 37.5% = 3/8, or 37.5 out of 100. Going the other way, 12.5% = 0.125 = 1/8, and 1.5 = 150%.',
    faq: [
      { question: 'Can a percentage be more than 100?', answer: 'Yes. 150% means one and a half times the whole; it is a decimal of 1.5.' },
      { question: 'How do I convert in my head?', answer: 'Move the decimal point two places: right to go to a percent, left to come back.' },
      {
        question: 'Is a percent the same as a percentage point?',
        answer: 'No. A percentage point is a difference between two percentages, such as a rate rising from 4% to 6%.',
      },
    ],
    scenarios: varied(
      'decimal-to-percent-calculator',
      12,
      [{ name: 'x', lo: 0.0013, hi: 4.99, step: 0.001 }],
      [{ name: 'mode', options: ['dp', 'pd'] }],
      (v) => `${v.mode} ${v.x}`,
    ),
    introOutputs: ['result'],
    relatedSlugs: ['decimal-to-fraction-calculator', 'percentage-calculator', 'fraction-to-decimal-calculator'],
    checks: [
      { inputs: {}, expect: { result: '37.5%', frac: '3/8', per: '37.5 out of 100' } },
      { inputs: { mode: 'pd', x: 12.5 }, expect: { result: '0.125', frac: '1/8', per: '12.5 out of 100' } },
      { inputs: { x: 1.5 }, expect: { result: '150%', frac: '3/2', per: '150 out of 100' } },
      { inputs: { mode: 'pd', x: 0.05 }, expect: { result: '0.0005', frac: '1/2000', per: '0.05 out of 100' } },
    ],
  },
  {
    slug: 'mixed-number-calculator',
    category: 'math',
    tier: 2,
    subCluster: 'Fractions',
    title: 'Mixed Number Calculator: Improper Fractions and Mixed Numbers',
    h1: 'Mixed Number Calculator',
    metaDescription:
      'Convert a mixed number such as 2 3/4 to an improper fraction, or an improper fraction such as 11/4 to a mixed number, with the decimal value.',
    about:
      'A mixed number combines a whole number and a proper fraction, like 2 3/4, while an improper fraction puts everything over the denominator, like 11/4. Recipes and measurements use the first, arithmetic usually prefers the second. Choose a direction. To turn a mixed number into an improper fraction, multiply the whole by the denominator and add the numerator. To go back, divide the top by the bottom: the quotient is the whole part and the remainder is the new numerator.',
    inputs: [
      sel('mode', 'Convert', 'improper', [
        ['improper', 'Mixed number to improper fraction'],
        ['mixed', 'Improper fraction to mixed number'],
      ]),
      intField('whole', 'Whole part', 2, 0, 1000000),
      intField('num', 'Numerator', 3, 0, 1000000),
      intField('den', 'Denominator', 4, 1, 1000000),
      intField('top', 'Improper numerator', 11, -1000000000, 1000000000),
      intField('bottom', 'Improper denominator', 4, 1, 1000000000),
    ],
    outputs: [out('result', 'Result', true), out('dec', 'As a decimal')],
    calculate: (i) => {
      if (String(i.mode) === 'mixed') {
        const t = BigInt(toD(i.top).toFixed(0));
        const b = BigInt(toD(i.bottom).toFixed(0));
        return { result: mixedText(t, b), dec: fmtNumber(new D(t.toString()).div(new D(b.toString())), 6) };
      }
      const den = BigInt(toD(i.den).toFixed(0));
      const top = BigInt(toD(i.whole).toFixed(0)) * den + BigInt(toD(i.num).toFixed(0));
      return { result: `${top}/${den}`, dec: fmtNumber(new D(top.toString()).div(new D(den.toString())), 6) };
    },
    formulaDescription:
      'Mixed to improper: (whole × denominator + numerator) ÷ denominator. Improper to mixed: whole = top ÷ bottom (integer part), new numerator = remainder, and the fraction is reduced to lowest terms. The fields for the other direction are ignored.',
    formulaLatex: 'w\\,\\dfrac{n}{d} = \\dfrac{wd + n}{d}',
    workedExample: '2 3/4 = (2 × 4 + 3) ÷ 4 = 11/4 = 2.75. In reverse, 17/5 = 3 2/5 = 3.4, and −9/4 = −2 1/4.',
    faq: [
      { question: 'What if the remainder is zero?', answer: 'Then the improper fraction is a whole number: 8/4 = 2.' },
      {
        question: 'Does it reduce the fraction?',
        answer: 'Improper to mixed reduces it (6/4 becomes 1 1/2). Mixed to improper keeps the denominator you typed.',
      },
      { question: 'Why use improper fractions?', answer: 'They are easier to multiply and divide, because there is no whole part to carry.' },
    ],
    scenarios: varied(
      'mixed-number-calculator',
      12,
      [
        { name: 'whole', lo: 1, hi: 60, step: 1 },
        { name: 'num', lo: 1, hi: 40, step: 1 },
        { name: 'den', lo: 2, hi: 60, step: 1 },
        { name: 'top', lo: 7, hi: 900, step: 1 },
        { name: 'bottom', lo: 2, hi: 40, step: 1 },
      ],
      [{ name: 'mode', options: ['improper', 'mixed'] }],
      (v) => `${v.mode}: ${v.whole} ${v.num}/${v.den} or ${v.top}/${v.bottom}`,
    ),
    introOutputs: ['result'],
    relatedSlugs: ['fraction-calculator', 'decimal-to-fraction-calculator', 'fraction-to-decimal-calculator'],
    checks: [
      { inputs: {}, expect: { result: '11/4', dec: '2.75' } },
      { inputs: { mode: 'mixed', top: 17, bottom: 5 }, expect: { result: '3 2/5', dec: '3.4' } },
      { inputs: { mode: 'mixed', top: -9, bottom: 4 }, expect: { result: '-2 1/4', dec: '-2.25' } },
      { inputs: { mode: 'mixed', top: 8, bottom: 4 }, expect: { result: '2', dec: '2' } },
      { inputs: { whole: 5, num: 1, den: 3 }, expect: { result: '16/3', dec: '5.333333' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
