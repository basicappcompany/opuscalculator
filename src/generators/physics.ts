import { numberField, selectField } from '../lib/calc-utils';
import { D, ONE, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, mixed, spread, type Spec } from '../lib/spec';
import type { CalculatorConfig } from '../lib/types';

/**
 * Prompt 5, physics.ts (item 5.6): kinematics, forces, energy and work, electricity and waves. Sixteen calculators.
 * Standard gravity is the exact conventional value 9.80665 m/s². Textbook idealisations apply (no air resistance,
 * constant acceleration, ideal components); each page says so. Tier 2 or 3, so unpublished until their cohort is on.
 */

const G = new D('9.80665');
const PI = D.acos(-1);
const pos = (name: string, label: string, def: number, max = 1e12) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min: 0.000001,
  max,
  validator: numberField({ min: 0.000001, max }),
});
const real = (name: string, label: string, def: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min: -1e12,
  max: 1e12,
  validator: numberField({ min: -1e12, max: 1e12 }),
});

const PLANETS = [
  { value: 'earth', label: 'Earth (9.80665 m/s²)', g: '9.80665' },
  { value: 'moon', label: 'Moon (1.62 m/s²)', g: '1.62' },
  { value: 'mars', label: 'Mars (3.71 m/s²)', g: '3.71' },
  { value: 'jupiter', label: 'Jupiter (24.79 m/s²)', g: '24.79' },
];
const gOf = (body: unknown): Dec => new D(PLANETS.find((p) => p.value === String(body))?.g ?? '9.80665');

export const SPECS: Spec[] = [
  {
    slug: 'final-velocity-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Kinematics',
    title: 'Final Velocity Calculator: v = u + at',
    h1: 'Final Velocity Calculator',
    metaDescription: 'Find final velocity and displacement for constant acceleration from the initial velocity, acceleration and time.',
    about:
      'When an object accelerates at a constant rate, its velocity changes by the acceleration times the time, and the distance it covers grows with the square of the time. Enter the starting velocity, the acceleration and the time to get the final velocity and the displacement. A negative acceleration slows the object down, and the answer can become negative if it has turned round. These equations of uniformly accelerated motion cover braking cars, falling objects and anything pushed by a steady force.',
    inputs: [real('u', 'Initial velocity (m/s)', 5), real('a', 'Acceleration (m/s²)', 2), pos('t', 'Time (s)', 10)],
    outputs: [
      { name: 'v', label: 'Final velocity', format: 'text', highlight: true },
      { name: 's', label: 'Displacement', format: 'text' },
    ],
    calculate: (i) => {
      const u = toD(i.u);
      const a = toD(i.a);
      const t = toD(i.t);
      return { v: `${fmtNumber(u.plus(a.mul(t)), 2)} m/s`, s: `${fmtNumber(u.mul(t).plus(a.mul(t).mul(t).div(2)), 2)} m` };
    },
    formulaDescription: 'v = u + a t and s = u t + ½ a t², valid for constant acceleration along a straight line.',
    formulaLatex: 'v = u + at, \\quad s = ut + \\tfrac{1}{2}at^{2}',
    workedExample: 'Starting at 5 m/s with an acceleration of 2 m/s² for 10 s: v = 5 + 20 = 25 m/s, and s = 50 + 100 = 150 m.',
    faq: [
      { question: 'What does a negative final velocity mean?', answer: 'The object is moving in the opposite direction from the one you took as positive.' },
      { question: 'Does it work if acceleration changes?', answer: 'No. These equations need constant acceleration; otherwise split the motion into stages.' },
      { question: 'What units should I use?', answer: 'Metres, seconds and metres per second squared, giving velocity in m/s and displacement in m.' },
    ],
    scenarios: mixed(
      'final-velocity-calculator',
      12,
      (r) => ({ u: r(0, 40), a: r(-9, 15), t: r(1, 60) }),
      (v) => `u ${v.u}, a ${v.a}, t ${v.t}`,
    ),
    relatedSlugs: ['free-fall-calculator', 'projectile-motion-calculator', 'kinetic-energy-calculator'],
    checks: [
      { inputs: {}, expect: { v: '25 m/s', s: '150 m' } },
      { inputs: { u: 0, a: 9.80665, t: 3 }, expect: { v: '29.42 m/s', s: '44.13 m' } },
      { inputs: { u: 10, a: -2, t: 5 }, expect: { v: '0 m/s', s: '25 m' } },
    ],
  },
  {
    slug: 'free-fall-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Kinematics',
    title: 'Free Fall Calculator: Fall Time and Impact Speed',
    h1: 'Free Fall Calculator',
    metaDescription: 'Calculate how long an object takes to fall from a height and its speed on impact, ignoring air resistance, on Earth or other bodies.',
    about:
      'An object dropped from rest accelerates downward at the local gravitational acceleration, 9.80665 metres per second squared on Earth by international convention. Ignoring air resistance, the time to fall a given height is the square root of twice the height over g, and the speed on impact is g times that time. Choose a different body to see how the same drop plays out on the Moon or Mars. Real objects, especially light or flat ones, fall slower because of air drag.',
    inputs: [
      pos('h', 'Drop height (m)', 20),
      {
        name: 'body',
        label: 'Where',
        type: 'select',
        default: 'earth',
        unitOptions: PLANETS.map((p) => ({ value: p.value, label: p.label })),
        validator: selectField(['earth', 'moon', 'mars', 'jupiter']),
      },
    ],
    outputs: [
      { name: 't', label: 'Fall time', format: 'text', highlight: true },
      { name: 'v', label: 'Impact speed', format: 'text' },
    ],
    calculate: (i) => {
      const g = gOf(i.body);
      const t = D.sqrt(toD(i.h).mul(2).div(g));
      return { t: `${fmtNumber(t, 2)} s`, v: `${fmtNumber(g.mul(t), 2)} m/s` };
    },
    formulaDescription: 't = √(2h ÷ g), v = g t, with g the local acceleration of gravity.',
    workedExample: 'Dropping from 20 m on Earth: t = √(40 ÷ 9.80665) = 2.02 s, and v = 9.80665 × 2.02 = 19.81 m/s.',
    faq: [
      { question: 'Does mass change the fall time?', answer: 'Not without air resistance. A feather and a hammer fall together on the Moon.' },
      { question: 'Why is the real fall slower?', answer: 'Air drag opposes the motion and grows with speed, so objects reach a terminal velocity.' },
      { question: 'What value of g is used?', answer: 'The standard 9.80665 m/s² for Earth; the other bodies use their mean surface gravity.' },
    ],
    scenarios: spread('free-fall-calculator', [{ name: 'h', label: 'height' }]),
    relatedSlugs: ['final-velocity-calculator', 'weight-calculator'],
    checks: [
      { inputs: {}, expect: { t: '2.02 s', v: '19.81 m/s' } },
      { inputs: { h: 5 }, expect: { t: '1.01 s', v: '9.9 m/s' } },
      { inputs: { h: 100 }, expect: { t: '4.52 s', v: '44.29 m/s' } },
    ],
  },
  {
    slug: 'projectile-motion-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Kinematics',
    title: 'Projectile Motion Calculator: Range, Height and Flight Time',
    h1: 'Projectile Motion Calculator',
    metaDescription:
      'Find the range, maximum height and time of flight of a projectile launched at a speed and angle from level ground, without air resistance.',
    about:
      'A projectile launched with a speed and an angle follows a parabola: its horizontal speed stays constant while gravity steadily changes the vertical speed. From level ground, the time of flight depends on the vertical component of the launch speed, the maximum height on that component squared, and the range on the sine of twice the angle, which is why 45 degrees gives the longest range. This calculator assumes no air resistance and launch and landing at the same height, which suits a thrown ball, a water jet, an arrow or a cannon shot on a flat field.',
    inputs: [
      pos('v', 'Launch speed (m/s)', 20),
      { name: 'angle', label: 'Launch angle (degrees)', type: 'number', default: 45, min: 0, max: 90, validator: numberField({ min: 0, max: 90 }) },
    ],
    outputs: [
      { name: 'range', label: 'Range', format: 'text', highlight: true },
      { name: 'height', label: 'Maximum height', format: 'text' },
      { name: 'time', label: 'Time of flight', format: 'text' },
    ],
    calculate: (i) => {
      const v = toD(i.v);
      const th = toD(i.angle).mul(PI).div(180);
      const vy = v.mul(D.sin(th));
      return {
        range: `${fmtNumber(
          v
            .mul(v)
            .mul(D.sin(th.mul(2)))
            .div(G),
          2,
        )} m`,
        height: `${fmtNumber(vy.mul(vy).div(G.mul(2)), 2)} m`,
        time: `${fmtNumber(vy.mul(2).div(G), 2)} s`,
      };
    },
    formulaDescription: 'Range R = v² sin 2θ ÷ g. Maximum height H = v² sin²θ ÷ 2g. Time of flight T = 2 v sin θ ÷ g, with g = 9.80665 m/s².',
    workedExample: 'Launched at 20 m/s and 45°: range = 400 × 1 ÷ 9.80665 = 40.79 m; height = 10.20 m; flight time = 2.88 s.',
    faq: [
      { question: 'Why is 45° the best angle?', answer: 'sin 2θ is largest, equal to 1, at θ = 45°, giving the maximum range on level ground.' },
      { question: 'Is air resistance included?', answer: 'No. Real range is shorter, especially for light or fast projectiles.' },
      {
        question: 'What if the launch and landing heights differ?',
        answer: 'These formulas then do not apply; solve the vertical motion with the height difference.',
      },
    ],
    scenarios: mixed(
      'projectile-motion-calculator',
      12,
      (r) => ({ v: r(55, 950), angle: r(5, 85) }),
      (v) => `speed ${v.v}, angle ${v.angle}`,
    ),
    relatedSlugs: ['final-velocity-calculator', 'free-fall-calculator'],
    checks: [
      { inputs: {}, expect: { range: '40.79 m', height: '10.2 m', time: '2.88 s' } },
      { inputs: { v: 30, angle: 30 }, expect: { range: '79.48 m', height: '11.47 m', time: '3.06 s' } },
      { inputs: { v: 10, angle: 90 }, expect: { range: '0 m', height: '5.1 m', time: '2.04 s' } },
    ],
  },
  {
    slug: 'force-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Forces',
    title: 'Force Calculator: F = ma',
    h1: "Force Calculator (Newton's Second Law)",
    metaDescription: "Calculate force in newtons from mass and acceleration using Newton's second law, and see it in kilonewtons and pounds-force.",
    about:
      "Newton's second law says that the net force on an object equals its mass times its acceleration. One newton is the force that accelerates one kilogram at one metre per second squared. Enter the mass and the acceleration to get the net force; the calculator also shows it in kilonewtons and in pounds-force for comparison with US units. It gives the net force, the total after all pushes and pulls such as friction and gravity have been combined.",
    inputs: [pos('m', 'Mass (kg)', 10), real('a', 'Acceleration (m/s²)', 2.5)],
    outputs: [
      { name: 'f', label: 'Net force', format: 'text', highlight: true },
      { name: 'kn', label: 'In kilonewtons', format: 'text' },
      { name: 'lbf', label: 'In pounds-force', format: 'text' },
    ],
    calculate: (i) => {
      const f = toD(i.m).mul(toD(i.a));
      return { f: `${fmtNumber(f, 3)} N`, kn: `${fmtNumber(f.div(1000), 4)} kN`, lbf: `${fmtNumber(f.div('4.4482216152605'), 3)} lbf` };
    },
    formulaDescription: 'F = m a. One pound-force is 4.4482216152605 newtons.',
    formulaLatex: 'F = m a',
    workedExample: 'A 10 kg mass accelerating at 2.5 m/s² needs a net force of 25 N, which is 0.025 kN or 5.62 lbf.',
    faq: [
      { question: 'What is net force?', answer: 'The vector sum of all forces on the object; only it determines acceleration.' },
      { question: 'Is weight a force?', answer: 'Yes, mass times gravitational acceleration. Use the weight calculator for that.' },
      { question: 'What is a newton in everyday terms?', answer: 'About the weight of a small apple.' },
    ],
    scenarios: mixed(
      'force-calculator',
      12,
      (r) => ({ m: r(1, 2500), a: r(0.1, 40) }),
      (v) => `${v.m} kg at ${v.a} m/s²`,
    ),
    relatedSlugs: ['weight-calculator', 'momentum-calculator'],
    checks: [
      { inputs: {}, expect: { f: '25 N', kn: '0.025 kN', lbf: '5.62 lbf' } },
      { inputs: { m: 1, a: 1 }, expect: { f: '1 N' } },
      { inputs: { m: 1000, a: -3 }, expect: { f: '-3,000 N' } },
    ],
  },
  {
    slug: 'weight-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Forces',
    title: 'Weight Calculator: Your Weight on Earth, Moon, Mars and Jupiter',
    h1: 'Weight Calculator',
    metaDescription: "Convert a mass into weight in newtons and pounds-force on Earth, the Moon, Mars or Jupiter using each body's surface gravity.",
    about:
      'Mass is the amount of matter in an object and stays the same everywhere, while weight is the force of gravity on that mass, which changes with the local gravitational acceleration. This calculator multiplies your mass by the surface gravity of Earth, the Moon, Mars or Jupiter to give the weight in newtons and in pounds-force. A person of 70 kilograms weighs about 686 newtons on Earth but only about 113 on the Moon, even though their mass is unchanged.',
    inputs: [
      pos('m', 'Mass (kg)', 70),
      {
        name: 'body',
        label: 'Where',
        type: 'select',
        default: 'earth',
        unitOptions: PLANETS.map((p) => ({ value: p.value, label: p.label })),
        validator: selectField(['earth', 'moon', 'mars', 'jupiter']),
      },
    ],
    outputs: [
      { name: 'n', label: 'Weight', format: 'text', highlight: true },
      { name: 'lbf', label: 'In pounds-force', format: 'text' },
    ],
    calculate: (i) => {
      const w = toD(i.m).mul(gOf(i.body));
      return { n: `${fmtNumber(w, 2)} N`, lbf: `${fmtNumber(w.div('4.4482216152605'), 2)} lbf` };
    },
    formulaDescription:
      'Weight W = m g, with g the local gravitational acceleration: Earth 9.80665, Moon 1.62, Mars 3.71, Jupiter 24.79 m/s² (mean surface values; Jupiter at the 1-bar level).',
    workedExample: '70 kg: Earth 686.47 N; Moon 113.4 N; Mars 259.7 N; Jupiter 1,735.3 N.',
    faq: [
      { question: 'Is weight the same as mass?', answer: 'No. Mass is constant; weight is a force that depends on gravity.' },
      {
        question: 'Why do bathroom scales show kilograms?',
        answer: 'They measure force but are calibrated to display the mass that would give that force on Earth.',
      },
      { question: 'Are the gravities exact?', answer: "Earth's is the standard value; the others are rounded mean values and vary with location." },
    ],
    scenarios: [
      [50, 'earth'],
      [50, 'moon'],
      [62.5, 'mars'],
      [80, 'jupiter'],
      [95.3, 'earth'],
      [35.7, 'moon'],
      [120, 'mars'],
      [7.2, 'jupiter'],
      [68, 'earth'],
      [150, 'moon'],
    ].map(([m, body]) => ({ label: `${m} kg on ${body}`, inputs: { m, body } })),
    relatedSlugs: ['force-calculator', 'free-fall-calculator'],
    checks: [
      { inputs: {}, expect: { n: '686.47 N' } },
      { inputs: { body: 'moon' }, expect: { n: '113.4 N' } },
      { inputs: { body: 'mars' }, expect: { n: '259.7 N' } },
      { inputs: { body: 'jupiter' }, expect: { n: '1,735.3 N' } },
    ],
  },
  {
    slug: 'momentum-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: 'Momentum Calculator: p = mv and Impulse',
    h1: 'Momentum Calculator',
    metaDescription: 'Calculate linear momentum from mass and velocity, and the impulse needed to change it, with the average force over a time.',
    about:
      "Momentum is the quantity of motion of an object, its mass times its velocity, measured in kilogram metres per second. A heavy slow object and a light fast one can have the same momentum. Newton's second law can be written as force equal to the rate of change of momentum, so the impulse, force multiplied by time, equals the change in momentum. Enter mass, velocity and the time over which you stop the object to see the momentum and the average force required.",
    inputs: [pos('m', 'Mass (kg)', 1200), real('v', 'Velocity (m/s)', 25), pos('t', 'Time to stop (s)', 4)],
    outputs: [
      { name: 'p', label: 'Momentum', format: 'text', highlight: true },
      { name: 'f', label: 'Average force to stop it', format: 'text' },
    ],
    calculate: (i) => {
      const p = toD(i.m).mul(toD(i.v));
      return { p: `${fmtNumber(p, 2)} kg·m/s`, f: `${fmtNumber(p.div(toD(i.t)).abs(), 2)} N` };
    },
    formulaDescription: 'p = m v. Impulse J = F Δt = Δp, so the average force to bring an object to rest is F = p ÷ t.',
    workedExample: 'A 1,200 kg car at 25 m/s has p = 30,000 kg·m/s; stopping it in 4 s needs an average force of 7,500 N.',
    faq: [
      { question: 'Is momentum conserved?', answer: 'Yes, in a closed system with no external forces, total momentum is unchanged in collisions.' },
      { question: 'Why do crumple zones help?', answer: 'They lengthen the stopping time, lowering the average force for the same change in momentum.' },
      { question: 'Can momentum be negative?', answer: 'Yes, its sign gives direction; a negative velocity means motion in the opposite direction.' },
    ],
    scenarios: mixed(
      'momentum-calculator',
      12,
      (r) => ({ m: r(0.5, 3000), v: r(1, 80), t: r(0.05, 20) }),
      (v) => `${v.m} kg at ${v.v} m/s over ${v.t} s`,
    ),
    relatedSlugs: ['force-calculator', 'kinetic-energy-calculator'],
    checks: [
      { inputs: {}, expect: { p: '30,000 kg·m/s', f: '7,500 N' } },
      { inputs: { m: 2, v: 3, t: 1 }, expect: { p: '6 kg·m/s', f: '6 N' } },
      { inputs: { m: 5, v: -4, t: 2 }, expect: { p: '-20 kg·m/s', f: '10 N' } },
    ],
  },
  {
    slug: 'friction-force-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: 'Friction Force Calculator: F = μN',
    h1: 'Friction Force Calculator',
    metaDescription: 'Calculate the friction force on a flat surface from the mass and the coefficient of friction, including the normal force.',
    about:
      'The friction between two dry surfaces is roughly proportional to the force pressing them together. The constant of proportionality is the coefficient of friction, which depends on the pair of materials and on whether the object is already sliding. On a horizontal surface the normal force equals the weight, mass times gravity, so the friction is the coefficient times mass times g. The result is the force you need to overcome to start or keep an object moving, in an idealised model of a flat, level surface.',
    inputs: [
      pos('m', 'Mass (kg)', 50),
      { name: 'mu', label: 'Coefficient of friction (μ)', type: 'number', default: 0.4, min: 0, max: 5, validator: numberField({ min: 0, max: 5 }) },
    ],
    outputs: [
      { name: 'f', label: 'Friction force', format: 'text', highlight: true },
      { name: 'n', label: 'Normal force', format: 'text' },
    ],
    calculate: (i) => {
      const n = toD(i.m).mul(G);
      return { f: `${fmtNumber(n.mul(toD(i.mu)), 2)} N`, n: `${fmtNumber(n, 2)} N` };
    },
    formulaDescription: 'Friction F = μ N, with N = m g on a horizontal surface and g = 9.80665 m/s².',
    workedExample: 'A 50 kg crate with μ = 0.4: N = 490.33 N, so F = 196.13 N.',
    faq: [
      {
        question: 'Is static friction the same as kinetic friction?',
        answer: 'No. Static friction, before sliding, is usually higher than kinetic friction while sliding.',
      },
      { question: 'Where do I find μ?', answer: 'In engineering tables for material pairs; values vary with surface condition.' },
      { question: 'What about slopes?', answer: 'On an incline the normal force is m g cos θ, so multiply accordingly.' },
    ],
    scenarios: mixed(
      'friction-force-calculator',
      12,
      (r) => ({ m: r(1, 900), mu: r(0.05, 1.2) }),
      (v) => `${v.m} kg with μ ${v.mu}`,
    ),
    relatedSlugs: ['force-calculator', 'weight-calculator'],
    checks: [
      { inputs: {}, expect: { f: '196.13 N', n: '490.33 N' } },
      { inputs: { m: 20, mu: 0.25 }, expect: { f: '49.03 N' } },
      { inputs: { mu: 0 }, expect: { f: '0 N' } },
    ],
  },
  {
    slug: 'kinetic-energy-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Energy and work',
    title: 'Kinetic Energy Calculator: KE = ½mv²',
    h1: 'Kinetic Energy Calculator',
    metaDescription: 'Calculate the kinetic energy of a moving object in joules from its mass and speed, and in kilojoules and calories.',
    about:
      'Kinetic energy is the energy an object has because it is moving. It grows in proportion to mass but with the square of speed, so doubling the speed quadruples the energy, which is why high-speed crashes are so destructive and why braking distances lengthen quickly. Enter the mass in kilograms and the speed in metres per second to get the energy in joules, kilojoules and food calories. It is the starting point for work, impact and braking calculations.',
    inputs: [pos('m', 'Mass (kg)', 1000), pos('v', 'Speed (m/s)', 20)],
    outputs: [
      { name: 'j', label: 'Kinetic energy', format: 'text', highlight: true },
      { name: 'kj', label: 'In kilojoules', format: 'text' },
      { name: 'kcal', label: 'In kilocalories', format: 'text' },
    ],
    calculate: (i) => {
      const e = toD(i.m).mul(toD(i.v)).mul(toD(i.v)).div(2);
      return { j: `${fmtNumber(e, 2)} J`, kj: `${fmtNumber(e.div(1000), 3)} kJ`, kcal: `${fmtNumber(e.div(4184), 4)} kcal` };
    },
    formulaDescription: 'KE = ½ m v². One kilocalorie is 4,184 joules.',
    formulaLatex: 'KE = \\tfrac{1}{2} m v^{2}',
    workedExample: 'A 1,000 kg car at 20 m/s (72 km/h): KE = 0.5 × 1,000 × 400 = 200,000 J, or 200 kJ.',
    faq: [
      { question: 'Why does speed matter more than mass?', answer: 'Energy depends on speed squared, so a 10% increase in speed gives 21% more energy.' },
      { question: 'Is kinetic energy conserved?', answer: 'Total energy is; in an inelastic collision some kinetic energy becomes heat and deformation.' },
      { question: 'What are the units?', answer: 'Joules, where one joule is one newton metre.' },
    ],
    scenarios: mixed(
      'kinetic-energy-calculator',
      12,
      (r) => ({ m: r(0.05, 5000), v: r(0.5, 90) }),
      (v) => `${v.m} kg at ${v.v} m/s`,
    ),
    relatedSlugs: ['potential-energy-calculator', 'momentum-calculator', 'final-velocity-calculator'],
    checks: [
      { inputs: {}, expect: { j: '200,000 J', kj: '200 kJ' } },
      { inputs: { m: 2, v: 3 }, expect: { j: '9 J' } },
      { inputs: { m: 0.145, v: 40 }, expect: { j: '116 J' } },
    ],
  },
  {
    slug: 'potential-energy-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Energy and work',
    title: 'Potential Energy Calculator: PE = mgh',
    h1: 'Gravitational Potential Energy Calculator',
    metaDescription: 'Find the gravitational potential energy of a mass raised to a height, on Earth, the Moon, Mars or Jupiter.',
    about:
      'Gravitational potential energy is the energy stored in an object because of its height in a gravitational field. Lifting a mass takes work against gravity, and that work is stored and can be released as the object falls. The energy equals mass times gravitational acceleration times height, measured from a reference level you choose. This calculator works for small heights where gravity is nearly constant, on Earth or other bodies, and shows the answer in joules and watt-hours.',
    inputs: [
      pos('m', 'Mass (kg)', 10),
      pos('h', 'Height (m)', 5),
      {
        name: 'body',
        label: 'Where',
        type: 'select',
        default: 'earth',
        unitOptions: PLANETS.map((p) => ({ value: p.value, label: p.label })),
        validator: selectField(['earth', 'moon', 'mars', 'jupiter']),
      },
    ],
    outputs: [
      { name: 'j', label: 'Potential energy', format: 'text', highlight: true },
      { name: 'wh', label: 'In watt-hours', format: 'text' },
    ],
    calculate: (i) => {
      const e = toD(i.m).mul(gOf(i.body)).mul(toD(i.h));
      return { j: `${fmtNumber(e, 2)} J`, wh: `${fmtNumber(e.div(3600), 4)} Wh` };
    },
    formulaDescription: 'PE = m g h, with g the local gravitational acceleration and h measured from the chosen reference height.',
    workedExample: '10 kg raised 5 m on Earth: 10 × 9.80665 × 5 = 490.33 J, which is 0.1362 Wh.',
    faq: [
      { question: 'Why is there a reference level?', answer: 'Only differences in height matter physically, so you can set the zero wherever is convenient.' },
      { question: 'Does it work for large heights?', answer: "For heights comparable to the planet's radius, g changes and a different formula is needed." },
      { question: 'How does it relate to kinetic energy?', answer: 'Falling converts potential energy into kinetic energy, ignoring air resistance.' },
    ],
    scenarios: mixed(
      'potential-energy-calculator',
      12,
      (r) => ({ m: r(0.2, 900), h: r(0.5, 300) }),
      (v) => `${v.m} kg raised ${v.h} m`,
    ),
    relatedSlugs: ['kinetic-energy-calculator', 'free-fall-calculator', 'work-calculator'],
    checks: [
      { inputs: {}, expect: { j: '490.33 J' } },
      { inputs: { m: 2, h: 10 }, expect: { j: '196.13 J' } },
      { inputs: { body: 'moon' }, expect: { j: '81 J' } },
    ],
  },
  {
    slug: 'work-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Energy and work',
    title: 'Work Calculator: W = Fd cos θ',
    h1: 'Work Done by a Force Calculator',
    metaDescription: 'Calculate the work done by a constant force over a distance at an angle to the motion, in joules.',
    about:
      'In physics, a force does work when it moves something, and only the part of the force that points along the motion counts. Work is the force times the distance times the cosine of the angle between them. Pushing straight along the direction of travel gives the full force times distance, pushing at right angles does no work at all, and pulling at an angle gives a fraction. Enter the force, the distance and the angle to see the work in joules, which equals the energy transferred.',
    inputs: [
      pos('f', 'Force (N)', 50),
      pos('d', 'Distance (m)', 10),
      { name: 'angle', label: 'Angle to the motion (degrees)', type: 'number', default: 0, min: 0, max: 180, validator: numberField({ min: 0, max: 180 }) },
    ],
    outputs: [
      { name: 'w', label: 'Work done', format: 'text', highlight: true },
      { name: 'kj', label: 'In kilojoules', format: 'text' },
    ],
    calculate: (i) => {
      const w = toD(i.f)
        .mul(toD(i.d))
        .mul(D.cos(toD(i.angle).mul(PI).div(180)));
      return { w: `${fmtNumber(w, 2)} J`, kj: `${fmtNumber(w.div(1000), 4)} kJ` };
    },
    formulaDescription: 'W = F d cos θ, with θ the angle between the force and the displacement.',
    workedExample: 'A 50 N force along a 10 m path: W = 500 J. At 60° to the path it is 250 J, and at 90° it is zero.',
    faq: [
      { question: 'Can work be negative?', answer: 'Yes, when the force opposes the motion (angle over 90°), such as friction slowing an object.' },
      {
        question: 'Is carrying a bag work?',
        answer: 'In the physics sense, carrying it level does no work on the bag because the force is perpendicular to the motion.',
      },
      { question: 'How is work related to energy?', answer: 'Work done on an object equals its change in energy.' },
    ],
    scenarios: mixed(
      'work-calculator',
      12,
      (r) => ({ f: r(1, 900), d: r(0.5, 400), angle: r(0, 150) }),
      (v) => `${v.f} N over ${v.d} m at ${v.angle}°`,
    ),
    relatedSlugs: ['power-calculator', 'kinetic-energy-calculator'],
    checks: [
      { inputs: {}, expect: { w: '500 J', kj: '0.5 kJ' } },
      { inputs: { angle: 60 }, expect: { w: '250 J' } },
      { inputs: { angle: 90 }, expect: { w: '0 J' } },
    ],
  },
  {
    slug: 'power-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Energy and work',
    title: 'Power Calculator: Work Over Time in Watts and Horsepower',
    h1: 'Power Calculator (Work and Time)',
    metaDescription: 'Calculate power in watts from work done and the time taken, and convert it to kilowatts and mechanical horsepower.',
    about:
      'Power is the rate of doing work or transferring energy, measured in watts, where one watt is one joule per second. Two machines can do the same job, but the more powerful one does it faster. Divide the work by the time to get the average power, which the calculator also shows in kilowatts and in mechanical horsepower, the unit still used for engines in some countries. It is the same quantity whether the energy is mechanical, electrical or thermal.',
    inputs: [pos('w', 'Work or energy (J)', 5000), pos('t', 'Time (s)', 20)],
    outputs: [
      { name: 'p', label: 'Power', format: 'text', highlight: true },
      { name: 'kw', label: 'In kilowatts', format: 'text' },
      { name: 'hp', label: 'In horsepower', format: 'text' },
    ],
    calculate: (i) => {
      const p = toD(i.w).div(toD(i.t));
      return { p: `${fmtNumber(p, 2)} W`, kw: `${fmtNumber(p.div(1000), 4)} kW`, hp: `${fmtNumber(p.div('745.69987158227022'), 4)} hp` };
    },
    formulaDescription: 'P = W ÷ t. One mechanical horsepower is 745.69987158227 watts.',
    workedExample: '5,000 J in 20 s is 250 W, which is 0.25 kW or 0.3353 hp.',
    faq: [
      { question: 'Is a watt the same as a joule?', answer: 'No. A watt is a joule per second, a rate.' },
      { question: 'What is a kilowatt-hour?', answer: 'A unit of energy: the energy used by 1 kW running for an hour, 3.6 million joules.' },
      { question: 'Why are there different horsepowers?', answer: 'Mechanical, metric and electrical horsepower differ slightly; this tool uses mechanical.' },
    ],
    scenarios: mixed(
      'power-calculator',
      12,
      (r) => ({ w: r(10, 900000), t: r(0.5, 3600) }),
      (v) => `${v.w} J in ${v.t} s`,
    ),
    relatedSlugs: ['work-calculator', 'electrical-power-calculator'],
    checks: [
      { inputs: {}, expect: { p: '250 W', kw: '0.25 kW', hp: '0.3353 hp' } },
      { inputs: { w: 746, t: 1 }, expect: { hp: '1.0004 hp' } },
      { inputs: { w: 3600, t: 3600 }, expect: { p: '1 W' } },
    ],
  },
  {
    slug: 'electrical-power-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Electricity',
    title: 'Electrical Power Calculator: P = VI and Resistance',
    h1: 'Electrical Power Calculator',
    metaDescription: "Calculate electrical power in watts from voltage and current, and the resistance of the load, using P = VI and Ohm's law.",
    about:
      "The power used by an electrical device is the voltage across it multiplied by the current through it. With Ohm's law the same power can be written from resistance and current or from voltage and resistance. Enter the voltage and the current to get the power in watts and the resistance of the load, assuming a steady direct current or the RMS values of alternating current into a resistive load. It is useful for checking whether a circuit, fuse or supply can carry a device.",
    inputs: [pos('v', 'Voltage (V)', 12), pos('i', 'Current (A)', 2)],
    outputs: [
      { name: 'p', label: 'Power', format: 'text', highlight: true },
      { name: 'r', label: 'Resistance of the load', format: 'text' },
    ],
    calculate: (i) => {
      const v = toD(i.v);
      const a = toD(i.i);
      return { p: `${fmtNumber(v.mul(a), 3)} W`, r: `${fmtNumber(v.div(a), 3)} Ω` };
    },
    formulaDescription: "P = V I. By Ohm's law R = V ÷ I, so P = I²R = V² ÷ R.",
    formulaLatex: 'P = VI = I^{2}R = \\frac{V^{2}}{R}',
    workedExample: '12 V at 2 A is 24 W, from a load of 6 Ω. A 230 V device drawing 10 A uses 2,300 W.',
    faq: [
      {
        question: 'Does it work for AC?',
        answer: 'For resistive loads with RMS values, yes. Motors and electronics have a power factor that lowers real power.',
      },
      {
        question: 'What is a safe current?',
        answer: 'It depends on the wiring and fuse rating; follow local electrical codes and use a qualified electrician.',
      },
      { question: 'How is power related to heat?', answer: 'In a resistor all the electrical power becomes heat.' },
    ],
    scenarios: mixed(
      'electrical-power-calculator',
      12,
      (r) => ({ v: r(1.5, 600), i: r(0.05, 90) }),
      (v) => `${v.v} V at ${v.i} A`,
    ),
    relatedSlugs: ['ohms-law-calculator', 'electricity-cost-calculator', 'resistor-network-calculator'],
    checks: [
      { inputs: {}, expect: { p: '24 W', r: '6 Ω' } },
      { inputs: { v: 230, i: 10 }, expect: { p: '2,300 W', r: '23 Ω' } },
      { inputs: { v: 5, i: 0.5 }, expect: { p: '2.5 W', r: '10 Ω' } },
    ],
  },
  {
    slug: 'resistor-network-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Electricity',
    title: 'Resistors in Series and Parallel Calculator',
    h1: 'Resistors in Series and Parallel Calculator',
    metaDescription: 'Find the total resistance of up to three resistors connected in series and in parallel.',
    about:
      'Resistors connected in series share the same current, and their resistances simply add. Resistors connected in parallel share the same voltage, and it is their conductances, the reciprocals of the resistances, that add, so the total is always smaller than the smallest resistor. Enter up to three resistor values in ohms to see both totals side by side. Real circuits often mix the two, in which case you solve one group at a time and then combine the results.',
    inputs: [pos('r1', 'Resistor 1 (Ω)', 100), pos('r2', 'Resistor 2 (Ω)', 220), pos('r3', 'Resistor 3 (Ω)', 330)],
    outputs: [
      { name: 'series', label: 'Series total', format: 'text', highlight: true },
      { name: 'parallel', label: 'Parallel total', format: 'text' },
    ],
    calculate: (i) => {
      const r = [toD(i.r1), toD(i.r2), toD(i.r3)];
      return {
        series: `${fmtNumber(r[0].plus(r[1]).plus(r[2]), 3)} Ω`,
        parallel: `${fmtNumber(ONE.div(ONE.div(r[0]).plus(ONE.div(r[1])).plus(ONE.div(r[2]))), 3)} Ω`,
      };
    },
    formulaDescription: 'Series: R = R1 + R2 + R3. Parallel: 1 ÷ R = 1 ÷ R1 + 1 ÷ R2 + 1 ÷ R3.',
    workedExample: '100, 220 and 330 Ω: series 650 Ω; parallel 1 ÷ (0.01 + 0.004545 + 0.003030) = 56.897 Ω.',
    faq: [
      { question: 'Why is the parallel total smaller?', answer: 'Each added path gives the current another way to flow, lowering the overall resistance.' },
      { question: 'What about two resistors only?', answer: 'Enter a very large value, or the same value twice, for the third; or use R1 R2 ÷ (R1 + R2).' },
      { question: 'Do tolerances matter?', answer: 'Yes: real resistors vary, often by 1% to 5%, so totals are approximate.' },
    ],
    scenarios: mixed(
      'resistor-network-calculator',
      12,
      (r) => ({ r1: r(1, 9000), r2: r(1, 9000), r3: r(1, 9000) }),
      (v) => `${v.r1}, ${v.r2} and ${v.r3} ohms`,
    ),
    relatedSlugs: ['ohms-law-calculator', 'electrical-power-calculator'],
    checks: [
      { inputs: {}, expect: { series: '650 Ω', parallel: '56.897 Ω' } },
      { inputs: { r1: 10, r2: 10, r3: 10 }, expect: { series: '30 Ω', parallel: '3.333 Ω' } },
      { inputs: { r1: 1000, r2: 1000, r3: 1000 }, expect: { parallel: '333.333 Ω' } },
    ],
  },
  {
    slug: 'electricity-cost-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Electricity',
    title: 'Electricity Cost Calculator: Appliance Energy Use and Bill',
    h1: 'Electricity Cost Calculator',
    metaDescription: 'Estimate how much energy an appliance uses and what it costs from its wattage, hours of use and your price per kilowatt-hour.',
    about:
      'The cost of running an appliance depends on its power rating, how long you use it and the price your supplier charges for each kilowatt-hour. Multiply the power in kilowatts by the hours to get the energy in kilowatt-hours, then multiply by the price. The wattage is usually on a label on the device, and your tariff is on your bill. Appliances that cycle on and off, such as fridges and heaters with thermostats, use less than their rated power on average, so the result is an upper estimate for them.',
    inputs: [pos('w', 'Power rating (watts)', 1500), pos('h', 'Hours of use per day', 3), pos('d', 'Days', 30), pos('price', 'Price per kWh', 0.15, 100)],
    outputs: [
      { name: 'cost', label: 'Cost over the period', format: 'text', highlight: true },
      { name: 'kwh', label: 'Energy used', format: 'text' },
      { name: 'daily', label: 'Cost per day', format: 'text' },
    ],
    calculate: (i) => {
      const kwh = toD(i.w).div(1000).mul(toD(i.h)).mul(toD(i.d));
      const cost = kwh.mul(toD(i.price));
      return { cost: fmtNumber(cost, 2), kwh: `${fmtNumber(kwh, 2)} kWh`, daily: fmtNumber(cost.div(toD(i.d)), 2) };
    },
    formulaDescription:
      'Energy (kWh) = watts ÷ 1,000 × hours per day × days. Cost = energy × price per kWh. The figures are in whatever currency your price is in.',
    workedExample: 'A 1,500 W heater for 3 hours a day over 30 days uses 135 kWh; at 0.15 per kWh it costs 20.25.',
    faq: [
      { question: 'Where do I find the wattage?', answer: 'On the appliance label or in its manual; if it only lists volts and amps, multiply them.' },
      { question: 'What currency is the result?', answer: 'Whatever your price per kWh is in; the calculator does not convert.' },
      { question: 'Why does my bill differ?', answer: 'Standing charges, tiered tariffs, taxes and appliances that cycle all change the real total.' },
    ],
    scenarios: mixed(
      'electricity-cost-calculator',
      12,
      (r) => ({ w: r(5, 3000), h: r(0.2, 24), d: r(1, 365), price: r(0.05, 0.6) }),
      (v) => `${v.w} W for ${v.h} h a day, ${v.d} days at ${v.price}`,
    ),
    relatedSlugs: ['electrical-power-calculator', 'power-calculator'],
    checks: [
      { inputs: {}, expect: { cost: '20.25', kwh: '135 kWh', daily: '0.68' } },
      { inputs: { w: 100, h: 10, d: 10, price: 0.2 }, expect: { cost: '2', kwh: '10 kWh' } },
      { inputs: { w: 60, h: 5, d: 365, price: 0.1 }, expect: { kwh: '109.5 kWh', cost: '10.95' } },
    ],
  },
  {
    slug: 'wave-speed-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves',
    title: 'Wave Speed Calculator: v = fλ',
    h1: 'Wave Speed Calculator',
    metaDescription: 'Calculate the speed of a wave from its frequency and wavelength, with the period, for sound, light and water waves.',
    about:
      'Every wave obeys a simple relation: its speed equals its frequency times its wavelength. Frequency is how many cycles pass a point each second, in hertz, and wavelength is the distance between successive crests. Enter both to find the speed in metres per second, plus the period, the time for one cycle. The relation holds for sound in air, for water ripples and for light, where the speed is fixed by the medium and a higher frequency means a shorter wavelength.',
    inputs: [pos('f', 'Frequency (Hz)', 440), pos('l', 'Wavelength (m)', 0.78)],
    outputs: [
      { name: 'v', label: 'Wave speed', format: 'text', highlight: true },
      { name: 'period', label: 'Period', format: 'text' },
    ],
    calculate: (i) => {
      const f = toD(i.f);
      return { v: `${fmtNumber(f.mul(toD(i.l)), 3)} m/s`, period: `${fmtNumber(ONE.div(f), 6)} s` };
    },
    formulaDescription: 'v = f λ and T = 1 ÷ f, with v in metres per second, f in hertz and λ in metres.',
    formulaLatex: 'v = f \\lambda',
    workedExample: 'A 440 Hz note with a wavelength of 0.78 m travels at 343.2 m/s, close to the speed of sound in air at 20 °C; the period is 0.002273 s.',
    faq: [
      { question: 'What is the speed of sound?', answer: 'About 343 m/s in air at 20 °C; it rises with temperature and is much higher in water and solids.' },
      {
        question: 'Does frequency change the speed?',
        answer: 'In a given medium the speed is set by the medium, so higher frequency means shorter wavelength.',
      },
      { question: 'What about light?', answer: 'Use a wavelength in metres; light in a vacuum travels at 299,792,458 m/s.' },
    ],
    scenarios: mixed(
      'wave-speed-calculator',
      12,
      (r) => ({ f: r(1, 9000), l: r(0.01, 300) }),
      (v) => `${v.f} Hz, wavelength ${v.l} m`,
    ),
    relatedSlugs: ['frequency-period-calculator', 'final-velocity-calculator'],
    checks: [
      { inputs: {}, expect: { v: '343.2 m/s' } },
      { inputs: { f: 1000, l: 0.34 }, expect: { v: '340 m/s', period: '0.001 s' } },
      { inputs: { f: 50, l: 6 }, expect: { v: '300 m/s', period: '0.02 s' } },
    ],
  },
  {
    slug: 'frequency-period-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves',
    title: 'Frequency and Period Calculator: f = 1/T',
    h1: 'Frequency and Period Calculator',
    metaDescription: 'Convert between frequency in hertz and period in seconds, with the angular frequency in radians per second.',
    about:
      'Frequency and period are two ways of describing how fast something repeats. Frequency counts cycles per second in hertz, and the period is the time one cycle takes, so each is the reciprocal of the other. A 50 Hz mains supply has a period of 20 milliseconds, and a 4 second pendulum swing is 0.25 Hz. Choose which you know, enter it, and the calculator returns the other along with the angular frequency, which is 2 pi times the frequency and is used in oscillation and AC circuit equations.',
    inputs: [
      pos('x', 'Value', 50),
      {
        name: 'mode',
        label: 'The value I know is',
        type: 'select',
        default: 'f',
        unitOptions: [
          { value: 'f', label: 'Frequency (Hz)' },
          { value: 't', label: 'Period (s)' },
        ],
        validator: selectField(['f', 't']),
      },
    ],
    outputs: [
      { name: 'f', label: 'Frequency', format: 'text', highlight: true },
      { name: 't', label: 'Period', format: 'text' },
      { name: 'w', label: 'Angular frequency', format: 'text' },
    ],
    calculate: (i) => {
      const x = toD(i.x);
      const f = String(i.mode) === 't' ? ONE.div(x) : x;
      return { f: `${fmtNumber(f, 6)} Hz`, t: `${fmtNumber(ONE.div(f), 6)} s`, w: `${fmtNumber(f.mul(PI).mul(2), 4)} rad/s` };
    },
    formulaDescription: 'f = 1 ÷ T and T = 1 ÷ f. Angular frequency ω = 2π f.',
    workedExample: '50 Hz: period 0.02 s (20 ms) and ω = 314.1593 rad/s. A period of 0.25 s is 4 Hz.',
    faq: [
      { question: 'What is angular frequency?', answer: 'The rate of rotation in radians per second; one full cycle is 2π radians.' },
      { question: 'What is one hertz?', answer: 'One cycle per second.' },
      { question: 'Where is it used?', answer: 'In AC power, sound, radio, pendulums and any oscillation.' },
    ],
    scenarios: [
      [50, 'f'],
      [60, 'f'],
      [0.25, 't'],
      [440, 'f'],
      [2.5, 't'],
      [1000, 'f'],
      [0.001, 't'],
      [7.83, 'f'],
      [12, 't'],
      [2400000000, 'f'],
    ].map(([x, mode]) => ({ label: `${x} ${mode === 'f' ? 'Hz' : 's period'}`, inputs: { x, mode } })),
    relatedSlugs: ['wave-speed-calculator', 'electrical-power-calculator'],
    checks: [
      { inputs: {}, expect: { f: '50 Hz', t: '0.02 s', w: '314.1593 rad/s' } },
      { inputs: { x: 0.25, mode: 't' }, expect: { f: '4 Hz' } },
      { inputs: { x: 1000 }, expect: { t: '0.001 s' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
