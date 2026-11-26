import { selectField } from '../lib/calc-utils';
import { D, ZERO, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, mixed, type Spec } from '../lib/spec';
import { field, sci, varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 13 (physics): mechanics, gravity, heat, electricity, waves and a little modern physics. Textbook
 * idealisations apply and each page says so (no air resistance, ideal components, uniform materials). Constants
 * are the 2018 CODATA values or exact SI definitions: G = 6.6743e-11, c = 299 792 458 m/s, h = 6.62607015e-34 J s.
 * Physics shows no disclaimer. Tier 2 or 3, so none is live until the cohort gate opens.
 */

const G = new D('9.80665');
const PI = D.acos(-1);
const RAD = PI.div(180);
const GN = new D('6.6743e-11');
const C = new D('299792458');
const H = new D('6.62607015e-34');
const QE = new D('1.602176634e-19');
const KE = new D('8.9875517923e9');
const AU = new D('149597870700');
const GM_SUN = new D('1.32712440018e20');

const pos = (name: string, label: string, def: number, max = 1e12) => field(name, label, def, 0.000001, max);
const real = (name: string, label: string, def: number, min = -1e12, max = 1e12) => field(name, label, def, min, max);
const sel = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});
const out = (name: string, label: string, highlight = false) => ({ name, label, format: 'text' as const, ...(highlight ? { highlight: true } : {}) });
const u = (x: Dec, dp: number, unit: string): string => `${fmtNumber(x, dp)} ${unit}`;
const sinD = (deg: Dec): Dec => deg.mul(RAD).sin();
const cosD = (deg: Dec): Dec => deg.mul(RAD).cos();
const e10 = (x: number, p: number): number => Number(`${x}e${p}`);

const BODIES: Record<string, { name: string; mass: string; radius: string }> = {
  earth: { name: 'Earth', mass: '5.972e24', radius: '6.371e6' },
  moon: { name: 'Moon', mass: '7.342e22', radius: '1.7374e6' },
  mars: { name: 'Mars', mass: '6.4171e23', radius: '3.3895e6' },
  jupiter: { name: 'Jupiter', mass: '1.8982e27', radius: '6.9911e7' },
  sun: { name: 'Sun', mass: '1.9885e30', radius: '6.957e8' },
};
const GRAV: Record<string, string> = { earth: '9.80665', moon: '1.62', mars: '3.71', jupiter: '24.79' };
const MU: Record<string, string> = { dry: '0.7', wet: '0.4', snow: '0.2', ice: '0.1' };
const CP: Record<string, string> = { water: '4184', ice: '2090', aluminium: '897', iron: '449', copper: '385', air: '1005' };
const KCOND: Record<string, string> = { copper: '401', aluminium: '237', steel: '50', glass: '1', brick: '0.72', concrete: '1.4', wood: '0.12', wool: '0.04' };
const RHO: Record<string, string> = { fresh: '1000', sea: '1025', oil: '920', mercury: '13534' };

export const SPECS: Spec[] = [
  {
    slug: 'average-speed-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Kinematics',
    title: 'Average Speed Calculator: Distance Over Time',
    h1: 'Average Speed Calculator',
    metaDescription: 'Work out average speed from the distance and the time taken, in km/h, m/s and mph, plus the running pace in minutes per kilometre.',
    about:
      'Average speed is the whole distance travelled divided by the whole time it took, however uneven the journey. A drive with traffic lights, a hill and a lunch stop still has a single average. Type the distance in kilometres and the elapsed time in hours and minutes, and the calculator gives the speed in kilometres per hour, in metres per second and in miles per hour. Average speed differs from average velocity, which depends on displacement: a round trip has a positive speed but a zero velocity.',
    inputs: [pos('dist', 'Distance (km)', 150), field('h', 'Time: hours', 2, 0, 100000), field('m', 'Time: minutes', 30, 0, 100000)],
    outputs: [out('kmh', 'Average speed', true), out('ms', 'In metres per second'), out('mph', 'In miles per hour'), out('pace', 'Pace')],
    calculate: (i) => {
      const dist = toD(i.dist);
      const t = toD(i.h).plus(toD(i.m).div(60));
      if (t.lte(0)) return { kmh: 'Enter a time above zero', ms: '', mph: '', pace: '' };
      const kmh = dist.div(t);
      return { kmh: u(kmh, 2, 'km/h'), ms: u(kmh.div('3.6'), 2, 'm/s'), mph: u(kmh.div('1.609344'), 2, 'mph'), pace: u(t.mul(60).div(dist), 2, 'min per km') };
    },
    formulaDescription: 'Average speed = total distance ÷ total time. One mile is exactly 1.609344 km, and 1 m/s is 3.6 km/h.',
    formulaLatex: '\\bar{v} = \\dfrac{d}{t}',
    workedExample: '150 km in 2 h 30 min is 150 ÷ 2.5 = 60 km/h, which is 16.67 m/s or 37.28 mph, at a pace of 1 minute per kilometre.',
    faq: [
      {
        question: 'Is average speed the same as average velocity?',
        answer: 'No. Velocity has a direction and displacement, so a lap that ends where it began has zero average velocity but a positive average speed.',
      },
      {
        question: 'Why is my average lower than my cruising speed?',
        answer: 'Stops, queues and slow sections add time without adding much distance, which pulls the average down.',
      },
      {
        question: 'How do I average two legs at different speeds?',
        answer: 'Divide the total distance by the total time. Averaging the two speeds only works when both legs last the same time.',
      },
    ],
    scenarios: mixed(
      'average-speed-calculator',
      12,
      (r) => ({ dist: r(5, 900), h: Math.floor(r(0, 11)), m: Math.floor(r(0, 59)) + 1 }),
      (v) => `a ${v.dist} km trip lasting ${v.h} h ${v.m} min`,
    ),
    introOutputs: ['kmh', 'mph'],
    relatedSlugs: ['acceleration-calculator', 'final-velocity-calculator', 'stopping-distance-calculator'],
    checks: [
      { inputs: {}, expect: { kmh: '60 km/h', ms: '16.67 m/s', mph: '37.28 mph', pace: '1 min per km' } },
      { inputs: { dist: 42.195, h: 3, m: 45 }, expect: { kmh: '11.25 km/h', pace: '5.33 min per km' } },
      { inputs: { dist: 800, h: 9, m: 0 }, expect: { kmh: '88.89 km/h', mph: '55.23 mph' } },
    ],
  },
  {
    slug: 'acceleration-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Kinematics',
    title: 'Acceleration Calculator: Change in Velocity Over Time',
    h1: 'Acceleration Calculator',
    metaDescription: 'Find acceleration from the starting velocity, final velocity and time, with the result in m/s² and in g-forces.',
    about:
      'Acceleration says how sharply a speed is rising or falling. Divide the gain in speed by the seconds it took: a hatchback reaching 27.78 m/s (100 km/h) from a standstill in eight seconds is picking up about 3.5 metres per second, every second. A minus sign marks braking. To make the figure tangible the page also converts it to g, the yardstick drivers and pilots use, where one g is standard gravity, 9.80665 m/s², and shows the speed gained in total.',
    inputs: [real('u', 'Initial velocity (m/s)', 0), real('v', 'Final velocity (m/s)', 27.78), pos('t', 'Time (s)', 8)],
    outputs: [out('a', 'Acceleration', true), out('g', 'In g-forces'), out('dv', 'Change in velocity')],
    calculate: (i) => {
      const dv = toD(i.v).minus(toD(i.u));
      const a = dv.div(toD(i.t));
      return { a: u(a, 3, 'm/s²'), g: u(a.div(G), 3, 'g'), dv: u(dv, 2, 'm/s') };
    },
    formulaDescription: 'a = (v − u) ÷ t, where u is the initial and v the final velocity. One g is 9.80665 m/s².',
    formulaLatex: 'a = \\dfrac{v - u}{t}',
    workedExample: 'From 0 to 27.78 m/s in 8 s: a = 27.78 ÷ 8 = 3.473 m/s², or 0.354 g.',
    faq: [
      {
        question: 'What does negative acceleration mean?',
        answer: 'The velocity is falling in the direction you chose as positive: the object is braking, or speeding up the other way.',
      },
      { question: 'How do I convert km/h to m/s?', answer: 'Divide by 3.6. So 100 km/h is 27.78 m/s.' },
      {
        question: 'How many g can a person take?',
        answer: 'Untrained people black out at a few g sustained; the page only converts, it gives no safety limit.',
      },
    ],
    scenarios: mixed(
      'acceleration-calculator',
      12,
      (r) => ({ u: r(0, 30), v: r(31, 90), t: r(2, 25) }),
      (v) => `speeds ${v.u} then ${v.v} over ${v.t} s`,
    ),
    introOutputs: ['g'],
    relatedSlugs: ['final-velocity-calculator', 'average-speed-calculator', 'force-calculator'],
    checks: [
      { inputs: {}, expect: { a: '3.473 m/s²', g: '0.354 g', dv: '27.78 m/s' } },
      { inputs: { u: 20, v: 0, t: 4 }, expect: { a: '-5 m/s²', g: '-0.51 g' } },
      { inputs: { u: 5, v: 35, t: 6 }, expect: { a: '5 m/s²', dv: '30 m/s' } },
    ],
  },
  {
    slug: 'stopping-distance-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Kinematics',
    title: 'Stopping Distance Calculator: Reaction and Braking',
    h1: 'Stopping Distance Calculator',
    metaDescription:
      'Estimate the total stopping distance of a vehicle from its speed, the driver reaction time and the road surface, split into reaction and braking distance.',
    about:
      'A vehicle does not stop the instant the driver sees a hazard. It first travels the reaction distance at full speed, then the braking distance, which grows with the square of the speed. Double the speed and the braking distance quadruples. Pick the road surface to set the friction coefficient and enter your reaction time to see why wet roads and higher speeds matter so much. This is a physics model of an ideal stop, not driving advice.',
    inputs: [
      pos('kmh', 'Speed (km/h)', 100, 400),
      field('t', 'Reaction time (s)', 1.5, 0, 10),
      sel('surface', 'Road surface', 'dry', [
        ['dry', 'Dry asphalt (μ 0.7)'],
        ['wet', 'Wet asphalt (μ 0.4)'],
        ['snow', 'Packed snow (μ 0.2)'],
        ['ice', 'Ice (μ 0.1)'],
      ]),
    ],
    outputs: [out('total', 'Total stopping distance', true), out('react', 'Reaction distance'), out('brake', 'Braking distance')],
    calculate: (i) => {
      const v = toD(i.kmh).div('3.6');
      const mu = new D(MU[String(i.surface)] ?? '0.7');
      const react = v.mul(toD(i.t));
      const brake = v.mul(v).div(mu.mul(G).mul(2));
      return { total: u(react.plus(brake), 1, 'm'), react: u(react, 1, 'm'), brake: u(brake, 1, 'm') };
    },
    formulaDescription:
      'Reaction distance = v × t. Braking distance = v² ÷ (2 μ g), with v in m/s, μ the tyre-road friction coefficient and g = 9.80665 m/s². Constant braking, level road.',
    formulaLatex: 'd = vt + \\dfrac{v^{2}}{2\\mu g}',
    workedExample: 'At 100 km/h (27.78 m/s) on dry asphalt with a 1.5 s reaction: 41.7 m of reaction plus 56.2 m of braking is 97.9 m.',
    faq: [
      {
        question: 'Why does speed matter so much?',
        answer: 'Braking distance depends on v², so 100 km/h needs about four times the braking distance of 50 km/h.',
      },
      { question: 'What reaction time is typical?', answer: 'Often about 1 to 1.5 seconds for an alert driver, longer when tired or distracted.' },
      {
        question: 'Does this include ABS or tyre type?',
        answer: 'No. A single friction coefficient stands in for all of that, so treat the numbers as an idealised estimate.',
      },
    ],
    scenarios: varied(
      'stopping-distance-calculator',
      12,
      [
        { name: 'kmh', lo: 20, hi: 160, step: 5 },
        { name: 't', lo: 0.5, hi: 2.5, step: 0.1 },
      ],
      [{ name: 'surface', options: ['dry', 'wet', 'snow', 'ice'] }],
      (v) => `${v.kmh} km/h, ${v.t} s, ${v.surface}`,
    ),
    introOutputs: ['total'],
    relatedSlugs: ['acceleration-calculator', 'friction-force-calculator', 'kinetic-energy-calculator'],
    checks: [
      { inputs: {}, expect: { total: '97.9 m', react: '41.7 m', brake: '56.2 m' } },
      { inputs: { kmh: 50, surface: 'wet' }, expect: { total: '45.4 m', react: '20.8 m', brake: '24.6 m' } },
      { inputs: { kmh: 120, t: 1, surface: 'ice' }, expect: { total: '599.8 m' } },
    ],
  },
  {
    slug: 'centripetal-force-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: 'Centripetal Force Calculator: Circular Motion',
    h1: 'Centripetal Force Calculator',
    metaDescription: 'Calculate the centripetal acceleration and force on a mass moving in a circle from its mass, speed and the radius of the path.',
    about:
      'An object moving in a circle is constantly accelerating toward the centre, even at a steady speed, because its direction keeps changing. The force that supplies this is the centripetal force, mass times speed squared over radius. For a car it is tyre friction, for a satellite it is gravity, for a ball on a string it is the tension. Enter the mass, speed and radius to get the acceleration, the force and the acceleration in g.',
    inputs: [pos('m', 'Mass (kg)', 1200), pos('v', 'Speed (m/s)', 20), pos('r', 'Radius of the circle (m)', 50)],
    outputs: [out('f', 'Centripetal force', true), out('a', 'Centripetal acceleration'), out('g', 'In g-forces')],
    calculate: (i) => {
      const a = toD(i.v).pow(2).div(toD(i.r));
      return { f: u(toD(i.m).mul(a), 2, 'N'), a: u(a, 3, 'm/s²'), g: u(a.div(G), 3, 'g') };
    },
    formulaDescription: 'a = v² ÷ r and F = m v² ÷ r. The force points toward the centre of the circle.',
    formulaLatex: 'F_c = \\dfrac{mv^{2}}{r}',
    workedExample: 'A 1,200 kg car at 20 m/s on a 50 m radius bend: a = 400 ÷ 50 = 8 m/s², so F = 9,600 N, about 0.82 g.',
    faq: [
      {
        question: 'Is centripetal force a new kind of force?',
        answer: 'No. It is the name for whatever real force, such as friction or tension, points toward the centre.',
      },
      {
        question: 'What about centrifugal force?',
        answer: 'It is the apparent outward force felt in the rotating frame, not a force acting in the ground frame.',
      },
      { question: 'What if the speed doubles?', answer: 'The force quadruples for the same radius, because it depends on the speed squared.' },
    ],
    scenarios: mixed(
      'centripetal-force-calculator',
      12,
      (r) => ({ m: r(0.2, 2400), v: r(1, 60), r: r(0.5, 400) }),
      (v) => `${v.m} kg, ${v.v} m/s, ${v.r} m radius`,
    ),
    introOutputs: ['f', 'a'],
    relatedSlugs: ['force-calculator', 'stopping-distance-calculator', 'gravitational-force-calculator'],
    checks: [
      { inputs: {}, expect: { f: '9,600 N', a: '8 m/s²', g: '0.816 g' } },
      { inputs: { m: 70, v: 10, r: 25 }, expect: { f: '280 N', a: '4 m/s²' } },
      { inputs: { m: 0.5, v: 6, r: 0.8 }, expect: { f: '22.5 N', g: '4.589 g' } },
    ],
  },
  {
    slug: 'escape-velocity-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Gravity',
    title: 'Escape Velocity Calculator: Planets, Moon and Sun',
    h1: 'Escape Velocity Calculator',
    metaDescription: 'Find the escape velocity, the circular orbital speed and the surface gravity of the Earth, Moon, Mars, Jupiter or Sun, at any altitude.',
    about:
      'Escape velocity is the speed an object needs to leave a body for good with no further push, ignoring air drag. It is the square root of twice the gravitational parameter divided by the distance from the centre. Choose a world and an altitude above its surface: the calculator gives the escape speed, the slower speed of a circular orbit there and the local gravity. Earth needs about 11.19 km/s at the surface, the Moon only 2.38.',
    inputs: [
      sel(
        'body',
        'Body',
        'earth',
        Object.entries(BODIES).map(([k, b]) => [k, b.name] as [string, string]),
      ),
      field('alt', 'Altitude above the surface (km)', 0, 0, 1e7),
    ],
    outputs: [out('esc', 'Escape velocity', true), out('orb', 'Circular orbital speed'), out('g', 'Gravity at that height')],
    calculate: (i) => {
      const b = BODIES[String(i.body)] ?? BODIES.earth;
      const r = new D(b.radius).plus(toD(i.alt).mul(1000));
      const gm = GN.mul(new D(b.mass));
      return { esc: u(gm.mul(2).div(r).sqrt().div(1000), 2, 'km/s'), orb: u(gm.div(r).sqrt().div(1000), 2, 'km/s'), g: u(gm.div(r.pow(2)), 2, 'm/s²') };
    },
    formulaDescription:
      'v_esc = √(2GM ÷ r) and v_orbit = √(GM ÷ r), with r the distance from the centre of the body and G = 6.6743×10⁻¹¹. The escape speed is √2 times the circular orbital speed.',
    formulaLatex: 'v_{esc} = \\sqrt{\\dfrac{2GM}{r}}',
    workedExample:
      'At the surface of the Earth (M = 5.972×10²⁴ kg, r = 6,371 km): GM = 3.986×10¹⁴, so v_esc = 11.19 km/s, a circular orbit is 7.91 km/s, and g = 9.82 m/s².',
    faq: [
      {
        question: 'Does escape velocity depend on the mass of the object?',
        answer: 'No. It depends only on the body and the distance, so a bolt and a rocket need the same speed.',
      },
      {
        question: 'Why is the orbital speed lower?',
        answer: 'A circular orbit only balances gravity; escaping needs enough kinetic energy to climb out of the gravity well, which is √2 times more speed.',
      },
      { question: 'Do rockets reach this speed?', answer: 'Not at once. They burn fuel gradually, and the figure is what a ballistic launch would need.' },
    ],
    scenarios: varied(
      'escape-velocity-calculator',
      12,
      [{ name: 'alt', lo: 0, hi: 36000, step: 100 }],
      [{ name: 'body', options: ['earth', 'moon', 'mars', 'jupiter', 'sun'] }],
      (v) => `${v.body} at ${v.alt} km`,
    ),
    introOutputs: ['esc'],
    relatedSlugs: ['gravitational-force-calculator', 'orbital-period-calculator', 'kinetic-energy-calculator'],
    checks: [
      { inputs: {}, expect: { esc: '11.19 km/s', orb: '7.91 km/s', g: '9.82 m/s²' } },
      { inputs: { body: 'moon' }, expect: { esc: '2.38 km/s', orb: '1.68 km/s', g: '1.62 m/s²' } },
      { inputs: { body: 'sun' }, expect: { esc: '617.69 km/s', orb: '436.77 km/s' } },
      { inputs: { body: 'earth', alt: 400 }, expect: { esc: '10.85 km/s', orb: '7.67 km/s' } },
    ],
  },
  {
    slug: 'gravitational-force-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Gravity',
    title: "Gravitational Force Calculator: Newton's Law",
    h1: 'Gravitational Force Calculator',
    metaDescription: "Compute the gravitational attraction between two masses at a given distance with Newton's law of universal gravitation, in newtons.",
    about:
      'Every pair of masses attracts with a force proportional to the product of the masses and inversely proportional to the square of the distance between their centres. The constant G is tiny, 6.6743×10⁻¹¹, so the force only becomes noticeable when one mass is a planet. Enter two masses in kilograms (scientific notation such as 5.972e24 works) and their separation to get the force and the acceleration the second mass feels. The defaults are the Earth and the Moon.',
    inputs: [
      pos('m1', 'Mass 1 (kg, e.g. 5.972e24 for the Earth)', 5.972e24, 1e45),
      pos('m2', 'Mass 2 (kg)', 7.342e22, 1e45),
      pos('r', 'Distance between centres (m)', 3.844e8, 1e45),
    ],
    outputs: [out('f', 'Gravitational force', true), out('a', 'Acceleration of mass 2')],
    calculate: (i) => {
      const f = GN.mul(toD(i.m1)).mul(toD(i.m2)).div(toD(i.r).pow(2));
      return { f: `${sci(f)} N`, a: `${sci(f.div(toD(i.m2)))} m/s²` };
    },
    formulaDescription: 'F = G m₁ m₂ ÷ r², with G = 6.6743×10⁻¹¹ N m² kg⁻². The acceleration of mass 2 is F ÷ m₂ = G m₁ ÷ r².',
    formulaLatex: 'F = G\\dfrac{m_{1}m_{2}}{r^{2}}',
    workedExample:
      'Earth (5.972×10²⁴ kg) and Moon (7.342×10²² kg), 3.844×10⁸ m apart: F = 1.980×10²⁰ N, so the Moon accelerates toward Earth at 2.697×10⁻³ m/s².',
    faq: [
      {
        question: 'Why do I not feel the pull of nearby objects?',
        answer: 'Because G is so small. Two 1,000 kg masses one metre apart attract with only about 6.7×10⁻⁵ newtons.',
      },
      {
        question: 'Is the distance from the surface or the centre?',
        answer: "From centre to centre. For a person on the ground, use the Earth's radius, 6.371×10⁶ m.",
      },
      {
        question: 'Is the pull equal on both bodies?',
        answer: 'Yes, the forces are equal and opposite; only the accelerations differ, because the masses differ.',
      },
    ],
    scenarios: mixed(
      'gravitational-force-calculator',
      12,
      (r) => ({ m1: e10(r(1, 900), 20), m2: e10(r(1, 900), 18), r: e10(r(1, 900), 5) }),
      (v) => `${v.m1} kg and ${v.m2} kg at ${v.r} m`,
    ),
    introOutputs: ['f'],
    relatedSlugs: ['weight-calculator', 'escape-velocity-calculator', 'orbital-period-calculator'],
    checks: [
      { inputs: {}, expect: { f: '1.980 × 10^20 N', a: '2.697 × 10^-3 m/s²' } },
      { inputs: { m1: 70, m2: 5.972e24, r: 6371000.0 }, expect: { f: '6.874 × 10^2 N' } },
      { inputs: { m1: 1000, m2: 1000, r: 1 }, expect: { f: '6.674 × 10^-5 N', a: '6.674 × 10^-8 m/s²' } },
    ],
  },
  {
    slug: 'orbital-period-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Gravity',
    title: "Orbital Period Calculator: Kepler's Third Law",
    h1: 'Orbital Period Calculator',
    metaDescription: "Use Kepler's third law to find how long a planet takes to orbit the Sun from its distance in astronomical units, with its orbital speed.",
    about:
      "Kepler's third law links how far a planet is from the Sun to the time it needs for one lap: the square of the period grows with the cube of the orbital radius. Enter the distance in astronomical units, where one unit is the Earth-Sun distance of 149,597,870.7 km, and the calculator returns the period in years and days and the circular orbital speed. Mars at 1.5236 AU takes 1.881 years, while Jupiter at 5.2 AU needs almost twelve.",
    inputs: [field('a', 'Orbital radius or semi-major axis (AU)', 1.5236, 0.01, 1000)],
    outputs: [out('years', 'Orbital period', true), out('days', 'In days'), out('v', 'Orbital speed')],
    calculate: (i) => {
      const r = toD(i.a).mul(AU);
      const days = PI.mul(2).mul(r.pow(3).div(GM_SUN).sqrt()).div(86400);
      return { years: u(days.div('365.25'), 3, 'years'), days: u(days, 2, 'days'), v: u(GM_SUN.div(r).sqrt().div(1000), 2, 'km/s') };
    },
    formulaDescription:
      'T = 2π √(a³ ÷ GM) with GM = 1.32712440018×10²⁰ m³/s² for the Sun and 1 AU = 149,597,870,700 m. Years are Julian years of 365.25 days. Circular orbit.',
    formulaLatex: 'T = 2\\pi\\sqrt{\\dfrac{a^{3}}{GM}}',
    workedExample: 'For Mars, a = 1.5236 AU: T = 686.92 days (1.881 years) and the speed is 24.13 km/s.',
    faq: [
      {
        question: 'What does the third law say in simple terms?',
        answer: 'The farther a planet orbits, the longer its year, and faster than a straight proportion: T² is proportional to a³.',
      },
      {
        question: 'Why do outer planets move slower?',
        answer: "The Sun's gravity weakens with distance, so less speed is needed to hold a circular orbit there.",
      },
      { question: 'Does it work for a satellite around Earth?', answer: "Only with Earth's GM instead of the Sun's; this page uses the Sun." },
    ],
    scenarios: mixed(
      'orbital-period-calculator',
      12,
      (r) => ({ a: r(0.3, 45) }),
      (v) => `orbit at ${v.a} AU`,
    ),
    relatedSlugs: ['escape-velocity-calculator', 'gravitational-force-calculator', 'pendulum-period-calculator'],
    checks: [
      { inputs: {}, expect: { years: '1.881 years', days: '686.92 days', v: '24.13 km/s' } },
      { inputs: { a: 1 }, expect: { years: '1 years', days: '365.26 days' } },
      { inputs: { a: 5.2044 }, expect: { years: '11.873 years', v: '13.06 km/s' } },
    ],
  },
  {
    slug: 'pendulum-period-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and oscillations',
    title: 'Pendulum Period Calculator: Length and Gravity',
    h1: 'Pendulum Period Calculator',
    metaDescription:
      'Find the period and frequency of a simple pendulum from its length on Earth, the Moon, Mars or Jupiter, plus the length of a 2 second pendulum.',
    about:
      "For small swings, a pendulum's period depends only on its length and the local gravity, not on the mass of the bob or how far it swings. The period is two pi times the square root of length over g. Enter the string length, choose the world, and read the time for one full swing, the swing frequency and the length that would give the famous two-second pendulum on that body. A long clock pendulum on the Moon swings far more slowly than on Earth.",
    inputs: [
      field('L', 'Length (m)', 1, 0.01, 1000),
      sel('body', 'Where', 'earth', [
        ['earth', 'Earth (9.80665 m/s²)'],
        ['moon', 'Moon (1.62)'],
        ['mars', 'Mars (3.71)'],
        ['jupiter', 'Jupiter (24.79)'],
      ]),
    ],
    outputs: [out('t', 'Period', true), out('f', 'Frequency'), out('l2', 'Length for a 2 s period')],
    calculate: (i) => {
      const g = new D(GRAV[String(i.body)] ?? '9.80665');
      const t = PI.mul(2).mul(toD(i.L).div(g).sqrt());
      return { t: u(t, 3, 's'), f: u(new D(1).div(t), 4, 'Hz'), l2: u(g.div(PI.pow(2)), 3, 'm') };
    },
    formulaDescription: 'T = 2π √(L ÷ g) for small angles (under about 15°). The length that gives a 2 s period is g ÷ π².',
    formulaLatex: 'T = 2\\pi\\sqrt{\\dfrac{L}{g}}',
    workedExample: 'A 1 m pendulum on Earth: T = 2π√(1 ÷ 9.80665) = 2.006 s, a frequency of 0.4984 Hz. A 2 s period needs 0.994 m.',
    faq: [
      { question: 'Does the mass of the bob matter?', answer: 'No. A heavier bob swings with the same period, as long as the string length is the same.' },
      { question: 'Why only small angles?', answer: 'The simple formula assumes sin θ ≈ θ. Big swings take slightly longer than the formula says.' },
      { question: 'How do I double the period?', answer: 'Make the pendulum four times as long, since the period grows with the square root of the length.' },
    ],
    scenarios: varied(
      'pendulum-period-calculator',
      12,
      [{ name: 'L', lo: 0.05, hi: 60, step: 0.05 }],
      [{ name: 'body', options: ['earth', 'moon', 'mars', 'jupiter'] }],
      (v) => `${v.L} m on ${v.body}`,
    ),
    introOutputs: ['t'],
    relatedSlugs: ['frequency-period-calculator', 'hookes-law-calculator', 'wave-speed-calculator'],
    checks: [
      { inputs: {}, expect: { t: '2.006 s', f: '0.4984 Hz', l2: '0.994 m' } },
      { inputs: { L: 0.25, body: 'moon' }, expect: { t: '2.468 s', f: '0.4051 Hz' } },
      { inputs: { L: 10, body: 'earth' }, expect: { t: '6.345 s' } },
    ],
  },
  {
    slug: 'hookes-law-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: "Hooke's Law Calculator: Spring Force and Energy",
    h1: "Hooke's Law Calculator",
    metaDescription: 'Calculate spring force and stored elastic energy from the spring constant and the stretch, plus the mass that would stretch it that far.',
    about:
      "A spring pulls back with a force proportional to how far it is stretched or compressed: double the stretch and the force doubles. The constant of proportionality is the spring constant in newtons per metre, a measure of stiffness. Enter it with the stretch in centimetres to get the restoring force, the elastic energy stored in the spring and the hanging mass that would produce that stretch under gravity. Hooke's law holds only until the spring reaches its elastic limit.",
    inputs: [pos('k', 'Spring constant (N/m)', 200, 1e9), pos('x', 'Stretch or compression (cm)', 5, 1e5)],
    outputs: [out('f', 'Spring force', true), out('e', 'Stored energy'), out('m', 'Equivalent hanging mass')],
    calculate: (i) => {
      const k = toD(i.k);
      const x = toD(i.x).div(100);
      const f = k.mul(x);
      return { f: u(f, 2, 'N'), e: u(k.mul(x).mul(x).div(2), 3, 'J'), m: u(f.div(G), 2, 'kg') };
    },
    formulaDescription: 'F = k x and the stored energy is E = ½ k x², with x in metres. The hanging mass is F ÷ g.',
    formulaLatex: 'F = kx, \\quad E = \\tfrac{1}{2}kx^{2}',
    workedExample: 'A 200 N/m spring stretched 5 cm: F = 200 × 0.05 = 10 N, E = ½ × 200 × 0.0025 = 0.25 J, which equals the weight of 1.02 kg.',
    faq: [
      {
        question: 'What is the elastic limit?',
        answer: 'The stretch beyond which the spring no longer returns to its original length; the law stops applying there.',
      },
      {
        question: 'Why is the energy not just force times stretch?',
        answer: 'The force grows as the spring stretches, so the average force is half the final value, giving ½ k x².',
      },
      { question: 'How do two springs combine?', answer: 'In parallel their constants add; in series the reciprocals add, so the combination is softer.' },
    ],
    scenarios: mixed(
      'hookes-law-calculator',
      12,
      (r) => ({ k: r(5, 4000), x: r(0.5, 40) }),
      (v) => `k ${v.k} N/m, ${v.x} cm`,
    ),
    introOutputs: ['f', 'e'],
    relatedSlugs: ['force-calculator', 'potential-energy-calculator', 'pendulum-period-calculator'],
    checks: [
      { inputs: {}, expect: { f: '10 N', e: '0.25 J', m: '1.02 kg' } },
      { inputs: { k: 1500, x: 12 }, expect: { f: '180 N', e: '10.8 J' } },
      { inputs: { k: 40, x: 30 }, expect: { f: '12 N', m: '1.22 kg' } },
    ],
  },
  {
    slug: 'torque-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: 'Torque Calculator: Force, Lever Arm and Angle',
    h1: 'Torque Calculator',
    metaDescription:
      'Calculate torque in newton metres and pound-feet from the applied force, the length of the lever arm and the angle at which the force is applied.',
    about:
      'Torque is the turning effect of a force: the force times its distance from the pivot times the sine of the angle between them. A longer wrench or a push at right angles gives more turning power from the same effort. Enter the force, the lever arm length in metres and the angle, where 90 degrees is a perpendicular push, to get the torque in newton metres and pound-feet, the unit usually printed on wheel nut and engine specifications.',
    inputs: [pos('F', 'Force (N)', 50), pos('r', 'Lever arm length (m)', 0.3), field('ang', 'Angle between force and lever (°)', 90, 0, 180)],
    outputs: [out('tq', 'Torque', true), out('lbf', 'In pound-feet')],
    calculate: (i) => {
      const tq = toD(i.F)
        .mul(toD(i.r))
        .mul(sinD(toD(i.ang)));
      return { tq: u(tq, 2, 'N·m'), lbf: u(tq.div('1.3558179483314004'), 2, 'lbf·ft') };
    },
    formulaDescription: 'τ = r F sin θ. One pound-foot is 1.3558179483314004 newton metres.',
    formulaLatex: '\\tau = rF\\sin\\theta',
    workedExample: 'A 50 N push at the end of a 0.3 m wrench, perpendicular: τ = 0.3 × 50 × 1 = 15 N·m, which is 11.06 lbf·ft.',
    faq: [
      { question: 'Why does a longer wrench help?', answer: 'The same force acts over a longer lever arm, so the torque grows in proportion to the length.' },
      { question: 'What does the angle do?', answer: 'Only the part of the force perpendicular to the lever turns it. At 0° or 180° the torque is zero.' },
      {
        question: 'Is torque the same as energy?',
        answer: 'It has the same units (N·m) but is a different quantity; torque is a turning effect, not work done.',
      },
    ],
    scenarios: mixed(
      'torque-calculator',
      12,
      (r) => ({ F: r(5, 900), r: r(0.05, 2.4), ang: r(20, 90) }),
      (v) => `${v.F} N at ${v.r} m, ${v.ang}°`,
    ),
    introOutputs: ['tq'],
    relatedSlugs: ['force-calculator', 'work-calculator', 'power-calculator'],
    checks: [
      { inputs: {}, expect: { tq: '15 N·m', lbf: '11.06 lbf·ft' } },
      { inputs: { F: 120, r: 0.25, ang: 45 }, expect: { tq: '21.21 N·m' } },
      { inputs: { F: 10, r: 2, ang: 0 }, expect: { tq: '0 N·m', lbf: '0 lbf·ft' } },
    ],
  },
  {
    slug: 'density-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Properties of matter',
    title: 'Density Calculator: Mass Over Volume',
    h1: 'Density Calculator',
    metaDescription: 'Calculate density from mass and volume in g/cm³, kg/m³ and lb/ft³, and see whether the material floats or sinks in fresh water.',
    about:
      'Density is how much mass fits in a given volume: mass divided by volume. Water is the benchmark at 1 gram per cubic centimetre (1,000 kg per cubic metre), so anything denser sinks in it and anything lighter floats. Enter a mass in grams and a volume in cubic centimetres to read the density in three common units and a quick floating verdict. It works for a metal sample, a block of wood, or a liquid measured in a cup.',
    inputs: [pos('m', 'Mass (g)', 500), pos('v', 'Volume (cm³)', 250)],
    outputs: [
      out('gcc', 'Density', true),
      out('kgm3', 'In kilograms per cubic metre'),
      out('lbft', 'In pounds per cubic foot'),
      out('floats', 'In fresh water'),
    ],
    calculate: (i) => {
      const gcc = toD(i.m).div(toD(i.v));
      const lbft = gcc.mul(1000).mul('0.028316846592').div('0.45359237');
      return {
        gcc: u(gcc, 4, 'g/cm³'),
        kgm3: u(gcc.mul(1000), 1, 'kg/m³'),
        lbft: u(lbft, 2, 'lb/ft³'),
        floats: gcc.lt(1) ? 'Floats in fresh water' : gcc.eq(1) ? 'Neutral buoyancy in fresh water' : 'Sinks in fresh water',
      };
    },
    formulaDescription: 'ρ = m ÷ V. 1 g/cm³ = 1,000 kg/m³ and 1 lb/ft³ = 16.0185 kg/m³ (pound 0.45359237 kg, foot 0.3048 m).',
    formulaLatex: '\\rho = \\dfrac{m}{V}',
    workedExample: '500 g occupying 250 cm³ has a density of 2 g/cm³ = 2,000 kg/m³ = 124.86 lb/ft³, so it sinks in fresh water.',
    faq: [
      {
        question: 'Does a bigger sample change the density?',
        answer: 'No. Density is a property of the material (at a given temperature); a larger sample has more mass and more volume in the same ratio.',
      },
      {
        question: 'Why does steel float as a ship?',
        answer: 'The hull encloses a lot of air, so the whole ship is less dense than the water it displaces even though steel is not.',
      },
      { question: 'What is the density of water?', answer: 'About 1 g/cm³ near 4 °C, slightly less when warmer, and a little higher for sea water.' },
    ],
    scenarios: mixed(
      'density-calculator',
      12,
      (r) => ({ m: r(5, 9000), v: r(5, 3000) }),
      (v) => `${v.m} g in ${v.v} cm³`,
    ),
    introOutputs: ['gcc', 'floats'],
    relatedSlugs: ['buoyancy-calculator', 'weight-calculator', 'specific-heat-calculator'],
    checks: [
      { inputs: {}, expect: { gcc: '2 g/cm³', kgm3: '2,000 kg/m³', lbft: '124.86 lb/ft³', floats: 'Sinks in fresh water' } },
      { inputs: { m: 120, v: 150 }, expect: { gcc: '0.8 g/cm³', kgm3: '800 kg/m³', lbft: '49.94 lb/ft³', floats: 'Floats in fresh water' } },
      { inputs: { m: 19300, v: 1000 }, expect: { gcc: '19.3 g/cm³', kgm3: '19,300 kg/m³' } },
    ],
  },
  {
    slug: 'buoyancy-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Properties of matter',
    title: "Buoyancy Calculator: Archimedes' Principle",
    h1: 'Buoyancy Calculator',
    metaDescription:
      'Find the buoyant force on a fully submerged object, compare it with its weight, and see whether the object floats or sinks in water, sea water, oil or mercury.',
    about:
      "Archimedes' principle says an object in a fluid feels an upward force equal to the weight of the fluid it pushes aside. Enter the object's volume and mass and pick a fluid: the calculator gives the buoyant force if the object is fully submerged, its weight, and a verdict. If the object is less dense than the fluid it floats, with a fraction of its volume below the surface equal to the density ratio. Otherwise it sinks.",
    inputs: [
      pos('V', 'Object volume (litres)', 20),
      pos('m', 'Object mass (kg)', 5),
      sel('fluid', 'Fluid', 'fresh', [
        ['fresh', 'Fresh water (1,000 kg/m³)'],
        ['sea', 'Sea water (1,025)'],
        ['oil', 'Olive oil (920)'],
        ['mercury', 'Mercury (13,534)'],
      ]),
    ],
    outputs: [out('fb', 'Buoyant force (fully submerged)', true), out('w', 'Weight'), out('verdict', 'Result')],
    calculate: (i) => {
      const rho = new D(RHO[String(i.fluid)] ?? '1000');
      const vol = toD(i.V).div(1000);
      const m = toD(i.m);
      const robj = m.div(vol);
      return {
        fb: u(rho.mul(G).mul(vol), 2, 'N'),
        w: u(m.mul(G), 2, 'N'),
        verdict: robj.lt(rho) ? `Floats, ${fmtNumber(robj.div(rho).mul(100), 1)}% underwater` : 'Sinks',
      };
    },
    formulaDescription:
      "F = ρ_fluid g V. The object floats if its density m ÷ V is below the fluid's, with the fraction submerged equal to ρ_object ÷ ρ_fluid.",
    formulaLatex: 'F_b = \\rho_{fluid}\\, g\\, V',
    workedExample:
      'A 5 kg object of 20 litres in fresh water: F = 1,000 × 9.80665 × 0.02 = 196.13 N against a weight of 49.03 N. Its density is 250 kg/m³, so it floats with 25% underwater.',
    faq: [
      {
        question: 'Why do some heavy things float?',
        answer: 'Floating depends on the average density. A hollow or air-filled object can be less dense than water even when its material is not.',
      },
      {
        question: 'Why is it easier to float in the sea?',
        answer: 'Salt water is denser, so the same volume pushed aside weighs more and gives a bigger upward force.',
      },
      {
        question: 'Does the shape matter?',
        answer: 'Not for the force on a fully submerged body; it matters for stability and for how much volume a floating one displaces.',
      },
    ],
    scenarios: varied(
      'buoyancy-calculator',
      12,
      [
        { name: 'V', lo: 1, hi: 400, step: 1 },
        { name: 'm', lo: 0.5, hi: 450, step: 0.5 },
      ],
      [{ name: 'fluid', options: ['fresh', 'sea', 'oil', 'mercury'] }],
      (v) => `${v.V} L, ${v.m} kg in ${v.fluid}`,
    ),
    introOutputs: ['fb', 'verdict'],
    relatedSlugs: ['density-calculator', 'weight-calculator', 'force-calculator'],
    checks: [
      { inputs: {}, expect: { fb: '196.13 N', w: '49.03 N', verdict: 'Floats, 25% underwater' } },
      { inputs: { V: 5, m: 12, fluid: 'sea' }, expect: { verdict: 'Sinks' } },
      { inputs: { V: 100, m: 30, fluid: 'oil' }, expect: { fb: '902.21 N', w: '294.2 N', verdict: 'Floats, 32.6% underwater' } },
    ],
  },
  {
    slug: 'specific-heat-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: 'Specific Heat Calculator: Heat Needed for a Temperature Change',
    h1: 'Specific Heat Calculator',
    metaDescription:
      'Calculate the heat energy needed to change the temperature of a mass of water, ice, aluminium, iron, copper or air, in joules, kilojoules and kilocalories.',
    about:
      'The specific heat capacity of a material is the energy needed to warm one kilogram by one degree. Water is unusually high at 4,184 joules per kilogram per kelvin, which is why it heats slowly and stores so much heat, while copper needs only 385. Enter a mass, choose the material and the temperature change; a negative change gives a negative result, meaning heat is released. The answer is in joules, kilojoules and kilocalories.',
    inputs: [
      pos('m', 'Mass (kg)', 2),
      sel('material', 'Material', 'water', [
        ['water', 'Water (4,184 J/kg·K)'],
        ['ice', 'Ice (2,090)'],
        ['aluminium', 'Aluminium (897)'],
        ['iron', 'Iron (449)'],
        ['copper', 'Copper (385)'],
        ['air', 'Air (1,005)'],
      ]),
      real('dt', 'Temperature change (°C or K)', 40, -1000, 1000),
    ],
    outputs: [out('kj', 'Heat energy', true), out('j', 'In joules'), out('kcal', 'In kilocalories')],
    calculate: (i) => {
      const q = toD(i.m)
        .mul(new D(CP[String(i.material)] ?? '4184'))
        .mul(toD(i.dt));
      return { kj: u(q.div(1000), 2, 'kJ'), j: u(q, 0, 'J'), kcal: u(q.div(4184), 2, 'kcal') };
    },
    formulaDescription: 'Q = m c ΔT, with c the specific heat capacity in J/(kg·K). One kilocalorie (thermochemical) is 4,184 J. No phase change is included.',
    formulaLatex: 'Q = mc\\,\\Delta T',
    workedExample: '2 kg of water warmed by 40 °C: Q = 2 × 4,184 × 40 = 334,720 J = 334.72 kJ = 80 kcal.',
    faq: [
      {
        question: 'Why does water have such a high specific heat?',
        answer: 'Hydrogen bonds between its molecules absorb energy, so it takes a lot to raise the temperature and it releases a lot when cooling.',
      },
      {
        question: 'Does this cover melting or boiling?',
        answer: 'No. Phase changes need extra latent heat; this covers only warming or cooling within one phase.',
      },
      { question: 'Why is the answer negative?', answer: 'You entered a drop in temperature, so heat leaves the material.' },
    ],
    scenarios: varied(
      'specific-heat-calculator',
      12,
      [
        { name: 'm', lo: 0.1, hi: 80, step: 0.1 },
        { name: 'dt', lo: -40, hi: 180, step: 1 },
      ],
      [{ name: 'material', options: ['water', 'ice', 'aluminium', 'iron', 'copper', 'air'] }],
      (v) => `${v.m} kg of ${v.material}, ${v.dt} °C`,
    ),
    introOutputs: ['kj'],
    relatedSlugs: ['time-to-heat-water-calculator', 'heat-conduction-calculator', 'carnot-efficiency-calculator'],
    checks: [
      { inputs: {}, expect: { kj: '334.72 kJ', j: '334,720 J', kcal: '80 kcal' } },
      { inputs: { m: 0.5, material: 'copper', dt: 100 }, expect: { kj: '19.25 kJ', j: '19,250 J' } },
      { inputs: { m: 10, material: 'iron', dt: -20 }, expect: { kj: '-89.8 kJ' } },
    ],
  },
  {
    slug: 'time-to-heat-water-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Thermodynamics',
    title: 'Time to Heat Water Calculator: Kettle and Heater',
    h1: 'Time to Heat Water Calculator',
    metaDescription:
      'Estimate how long it takes to heat or boil a volume of water with a heater of a given power and efficiency, with the energy used in kilojoules and kilowatt-hours.',
    about:
      "How long a kettle, immersion heater or camping stove takes depends on three things: how much water, how many degrees it must rise, and how much of the heater's power actually reaches the water. The calculator multiplies the mass by water's specific heat of 4,186 joules per kilogram per kelvin and divides by the effective power. Enter the litres, start and target temperatures, the heater rating in watts and its efficiency to get the time and the energy.",
    inputs: [
      pos('V', 'Water (litres)', 1.5, 100000),
      field('start', 'Start temperature (°C)', 20, 0, 99),
      field('target', 'Target temperature (°C)', 100, 1, 100),
      pos('P', 'Heater power (W)', 2000, 1e8),
      field('eff', 'Efficiency (%)', 85, 1, 100),
    ],
    outputs: [out('time', 'Time needed', true), out('kj', 'Energy into the water'), out('kwh', 'In kilowatt-hours')],
    calculate: (i) => {
      const e = D.max(
        ZERO,
        toD(i.V)
          .mul('4186')
          .mul(toD(i.target).minus(toD(i.start))),
      );
      const s = e.div(toD(i.P).mul(toD(i.eff).div(100)));
      const total = BigInt(s.toFixed(0, D.ROUND_HALF_UP));
      return { time: `${total / 60n} min ${total % 60n} s`, kj: u(e.div(1000), 2, 'kJ'), kwh: u(e.div('3600000'), 4, 'kWh') };
    },
    formulaDescription:
      'Energy = m c ΔT with c = 4,186 J/(kg·K) and 1 litre of water = 1 kg. Time = energy ÷ (power × efficiency). Heat losses while heating are folded into the efficiency.',
    formulaLatex: 't = \\dfrac{m c\\,\\Delta T}{\\eta P}',
    workedExample:
      '1.5 litres from 20 °C to 100 °C: 1.5 × 4,186 × 80 = 502,320 J. A 2,000 W kettle at 85% efficiency delivers 1,700 W, so it takes 295 s, about 4 min 55 s.',
    faq: [
      {
        question: 'Does a bigger kettle boil faster?',
        answer: 'Only if it has more power. More water needs proportionally more energy, so with the same wattage it takes longer.',
      },
      { question: 'What efficiency should I use?', answer: 'Electric kettles are often 80 to 95%; an open pan on a hob is much lower, perhaps 30 to 60%.' },
      {
        question: 'Does this work above 100 °C?',
        answer: 'No. At 100 °C water boils at sea level, and turning it to steam needs far more energy that this page does not count.',
      },
    ],
    scenarios: mixed(
      'time-to-heat-water-calculator',
      12,
      (r) => ({
        V: r(0.2, 80),
        start: Math.round(r(2, 60)),
        target: Math.round(r(65, 100)),
        P: Math.round(r(300, 6000) / 50) * 50,
        eff: Math.round(r(35, 98)),
      }),
      (v) => `${v.V} L, ${v.start} to ${v.target} °C, ${v.P} W`,
    ),
    introOutputs: ['time'],
    relatedSlugs: ['specific-heat-calculator', 'electricity-cost-calculator', 'power-calculator'],
    checks: [
      { inputs: {}, expect: { time: '4 min 55 s', kj: '502.32 kJ', kwh: '0.1395 kWh' } },
      { inputs: { V: 0.25, start: 15, target: 90, P: 1000, eff: 100 }, expect: { time: '1 min 18 s', kj: '78.49 kJ', kwh: '0.0218 kWh' } },
      { inputs: { V: 50, start: 10, target: 60, P: 3000, eff: 90 }, expect: { time: '64 min 36 s', kwh: '2.9069 kWh' } },
    ],
  },
  {
    slug: 'heat-conduction-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: "Heat Conduction Calculator: Fourier's Law",
    h1: 'Heat Conduction Calculator',
    metaDescription:
      'Calculate the rate of heat flow through a wall or slab from the material, area, thickness and temperature difference, with the daily energy loss and thermal resistance.',
    about:
      "Heat flows through a solid in proportion to the area, the temperature difference across it and the material's thermal conductivity, and in inverse proportion to its thickness. Copper conducts 401 watts per metre per kelvin while mineral wool manages 0.04, which is why one is a pan and the other insulation. Enter the material, area, thickness in centimetres and the temperature difference to see the heat loss in watts, the energy per day and the thermal resistance of the layer.",
    inputs: [
      sel('material', 'Material', 'brick', [
        ['copper', 'Copper (401 W/m·K)'],
        ['aluminium', 'Aluminium (237)'],
        ['steel', 'Steel (50)'],
        ['glass', 'Glass (1.0)'],
        ['brick', 'Brick (0.72)'],
        ['concrete', 'Concrete (1.4)'],
        ['wood', 'Wood (0.12)'],
        ['wool', 'Mineral wool (0.04)'],
      ]),
      pos('A', 'Area (m²)', 10, 1e6),
      pos('th', 'Thickness (cm)', 30, 1e5),
      real('dt', 'Temperature difference (K)', 20, 0, 2000),
    ],
    outputs: [out('w', 'Heat flow', true), out('kwh', 'Energy per day'), out('r', 'Thermal resistance')],
    calculate: (i) => {
      const k = new D(KCOND[String(i.material)] ?? '0.72');
      const d = toD(i.th).div(100);
      const p = k.mul(toD(i.A)).mul(toD(i.dt)).div(d);
      return { w: u(p, 1, 'W'), kwh: u(p.mul(24).div(1000), 2, 'kWh'), r: u(d.div(k), 4, 'm²·K/W') };
    },
    formulaDescription: 'Q̇ = k A ΔT ÷ d, steady one-dimensional conduction. The thermal resistance per square metre is R = d ÷ k.',
    formulaLatex: '\\dot{Q} = \\dfrac{kA\\,\\Delta T}{d}',
    workedExample: 'A 10 m² brick wall 30 cm thick with 20 K across it: Q̇ = 0.72 × 10 × 20 ÷ 0.3 = 480 W, or 11.52 kWh a day, and R = 0.4167 m²·K/W.',
    faq: [
      {
        question: 'Does this include convection and radiation?',
        answer: 'No. It is conduction through one solid layer only; real walls also lose heat from their surfaces and through air gaps.',
      },
      {
        question: 'How do I add layers?',
        answer: 'Add the resistances d ÷ k of each layer, then divide the temperature difference by the total resistance per unit area.',
      },
      {
        question: 'What is a good insulator?',
        answer: 'One with a low conductivity: mineral wool and foam are around 0.03 to 0.05, thousands of times lower than metal.',
      },
    ],
    scenarios: varied(
      'heat-conduction-calculator',
      12,
      [
        { name: 'A', lo: 1, hi: 120, step: 1 },
        { name: 'th', lo: 0.5, hi: 40, step: 0.5 },
        { name: 'dt', lo: 2, hi: 60, step: 1 },
      ],
      [{ name: 'material', options: ['copper', 'aluminium', 'steel', 'glass', 'brick', 'concrete', 'wood', 'wool'] }],
      (v) => `${v.material} ${v.A} m², ${v.th} cm, ${v.dt} K`,
    ),
    introOutputs: ['w'],
    relatedSlugs: ['specific-heat-calculator', 'carnot-efficiency-calculator', 'electricity-cost-calculator'],
    checks: [
      { inputs: {}, expect: { w: '480 W', kwh: '11.52 kWh', r: '0.4167 m²·K/W' } },
      { inputs: { material: 'glass', A: 2, th: 0.4, dt: 25 }, expect: { w: '12,500 W' } },
      { inputs: { material: 'wool', A: 80, th: 20, dt: 18 }, expect: { w: '288 W', kwh: '6.91 kWh', r: '5 m²·K/W' } },
    ],
  },
  {
    slug: 'carnot-efficiency-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: 'Carnot Efficiency Calculator: Heat Engine Limit',
    h1: 'Carnot Efficiency Calculator',
    metaDescription:
      'Find the maximum possible efficiency of a heat engine between a hot and a cold temperature, with the ideal heat-pump and refrigerator coefficients of performance.',
    about:
      'No heat engine can turn heat into work more efficiently than a Carnot engine running between the same hot and cold temperatures. The limit depends only on those two temperatures on the absolute scale, so a bigger gap means a higher ceiling. Enter the hot and cold temperatures in degrees Celsius to get the best possible efficiency, plus the ideal coefficient of performance of a heat pump and a refrigerator working across the same gap. Real machines always fall short.',
    inputs: [real('hot', 'Hot side (°C)', 500, -200, 5000), real('cold', 'Cold side (°C)', 25, -250, 4999)],
    outputs: [out('eff', 'Maximum efficiency', true), out('hp', 'Heat pump COP (heating)'), out('fr', 'Refrigerator COP (cooling)')],
    calculate: (i) => {
      const th = toD(i.hot).plus('273.15');
      const tc = toD(i.cold).plus('273.15');
      if (th.lte(tc) || tc.lte(0)) return { eff: 'The hot side must be hotter than the cold side', hp: '', fr: '' };
      return {
        eff: u(new D(1).minus(tc.div(th)).mul(100), 2, '%').replace(' %', '%'),
        hp: fmtNumber(th.div(th.minus(tc)), 2),
        fr: fmtNumber(tc.div(th.minus(tc)), 2),
      };
    },
    formulaDescription:
      'η = 1 − T_c ÷ T_h with temperatures in kelvin (K = °C + 273.15). Ideal heat pump COP = T_h ÷ (T_h − T_c); refrigerator COP = T_c ÷ (T_h − T_c).',
    formulaLatex: '\\eta_{max} = 1 - \\dfrac{T_c}{T_h}',
    workedExample:
      'Between 500 °C (773.15 K) and 25 °C (298.15 K): η = 1 − 298.15 ÷ 773.15 = 61.44%. A heat pump over the same gap could in theory deliver 1.63 units of heat per unit of work.',
    faq: [
      {
        question: 'Why use kelvin?',
        answer: 'The formula needs an absolute scale. Using Celsius would give a wrong answer, and one equal to 100% would be impossible.',
      },
      {
        question: 'Can efficiency reach 100%?',
        answer: 'Only if the cold side were at absolute zero, which cannot be reached, so no real engine converts all heat to work.',
      },
      {
        question: 'Why do real engines do worse?',
        answer: 'Friction, heat leaks and non-ideal cycles; a car engine achieves roughly a third of its Carnot limit.',
      },
    ],
    scenarios: mixed(
      'carnot-efficiency-calculator',
      12,
      (r) => ({ hot: Math.round(r(60, 1500)), cold: Math.round(r(-20, 50)) }),
      (v) => `${v.hot} °C to ${v.cold} °C`,
    ),
    introOutputs: ['eff'],
    relatedSlugs: ['specific-heat-calculator', 'heat-conduction-calculator', 'power-calculator'],
    checks: [
      { inputs: {}, expect: { eff: '61.44%', hp: '1.63', fr: '0.63' } },
      { inputs: { hot: 100, cold: 20 }, expect: { eff: '21.44%', hp: '4.66', fr: '3.66' } },
      { inputs: { hot: 1200, cold: 100 }, expect: { eff: '74.67%' } },
    ],
  },
  {
    slug: 'coulombs-law-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Electricity',
    title: "Coulomb's Law Calculator: Force Between Charges",
    h1: "Coulomb's Law Calculator",
    metaDescription:
      'Compute the electric force between two point charges from their charges in microcoulombs and the distance, with the electric field of the first charge.',
    about:
      'Two electric charges push or pull on each other with a force proportional to the product of the charges and inversely proportional to the square of the distance. Like charges repel and opposite charges attract. Enter each charge in microcoulombs (a negative sign marks a negative charge) and the separation in centimetres to get the force in newtons, whether it attracts or repels, and the electric field the first charge makes at the position of the second.',
    inputs: [real('q1', 'Charge 1 (µC)', 5, -1e6, 1e6), real('q2', 'Charge 2 (µC)', -3, -1e6, 1e6), pos('r', 'Distance (cm)', 20, 1e7)],
    outputs: [out('f', 'Force', true), out('nature', 'Nature'), out('field', 'Field of charge 1 at that point')],
    calculate: (i) => {
      const q1 = toD(i.q1).mul('1e-6');
      const q2 = toD(i.q2).mul('1e-6');
      const r2 = toD(i.r).div(100).pow(2);
      const prod = q1.mul(q2);
      return {
        f: u(KE.mul(prod.abs()).div(r2), 3, 'N'),
        nature: prod.isZero() ? 'No force' : prod.isNeg() ? 'Attractive (opposite charges)' : 'Repulsive (like charges)',
        field: `${sci(KE.mul(q1.abs()).div(r2))} N/C`,
      };
    },
    formulaDescription: 'F = k |q₁ q₂| ÷ r² with k = 8.9875517923×10⁹ N m² C⁻² (1 ÷ 4πε₀). The field of a point charge is E = k |q| ÷ r².',
    formulaLatex: 'F = k\\dfrac{|q_{1}q_{2}|}{r^{2}}',
    workedExample: '+5 µC and −3 µC, 20 cm apart: F = 8.99×10⁹ × 15×10⁻¹² ÷ 0.04 = 3.370 N, attractive. The field of the 5 µC charge there is 1.123×10⁶ N/C.',
    faq: [
      {
        question: 'What is a microcoulomb?',
        answer: 'One millionth of a coulomb. A static shock involves charges of a nanocoulomb or less; a coulomb is a very large charge.',
      },
      {
        question: 'How does it compare with gravity?',
        answer:
          'The electric force between charged particles is vastly stronger than their gravitational pull, which is why gravity only matters for huge neutral masses.',
      },
      { question: 'Does the medium matter?', answer: 'Yes. The formula is for vacuum or air; in water or other dielectrics the force is much smaller.' },
    ],
    scenarios: mixed(
      'coulombs-law-calculator',
      12,
      (r) => ({ q1: r(-80, 80) || 1, q2: r(-80, 80) || 1, r: r(2, 150) }),
      (v) => `${v.q1} µC and ${v.q2} µC at ${v.r} cm`,
    ),
    introOutputs: ['f', 'nature'],
    relatedSlugs: ['gravitational-force-calculator', 'ohms-law-calculator', 'electrical-power-calculator'],
    checks: [
      { inputs: {}, expect: { f: '3.37 N', nature: 'Attractive (opposite charges)', field: '1.123 × 10^6 N/C' } },
      { inputs: { q1: 2, q2: 2, r: 10 }, expect: { f: '3.595 N', nature: 'Repulsive (like charges)' } },
      { inputs: { q1: 1000, q2: -500, r: 100 }, expect: { f: '4,493.776 N' } },
    ],
  },
  {
    slug: 'rc-time-constant-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Electricity',
    title: 'RC Time Constant Calculator: Charging and Cutoff',
    h1: 'RC Time Constant Calculator',
    metaDescription:
      'Calculate the time constant of a resistor-capacitor circuit from the resistance in kilohms and capacitance in microfarads, with the full charge time and cutoff frequency.',
    about:
      'A capacitor charging through a resistor does not fill at a steady rate: it climbs quickly at first and slows as it nears the supply voltage. The time constant, resistance times capacitance, is how long it takes to reach about 63 percent. After five time constants it is within a percent of full. The same product sets the cutoff frequency of a simple RC filter. Enter kilohms and microfarads: their product is conveniently the time in milliseconds.',
    inputs: [pos('R', 'Resistance (kΩ)', 10, 1e9), pos('C', 'Capacitance (µF)', 100, 1e9)],
    outputs: [out('tau', 'Time constant τ', true), out('full', 'Five time constants (99.3% charged)'), out('fc', 'Cutoff frequency')],
    calculate: (i) => {
      const tau = toD(i.R).mul(toD(i.C));
      return { tau: u(tau, 3, 'ms'), full: u(tau.mul(5), 3, 'ms'), fc: u(new D(1000).div(PI.mul(2).mul(tau)), 2, 'Hz') };
    },
    formulaDescription:
      'τ = R C. The capacitor reaches 1 − e⁻ᵗ/τ of the supply: 63.2% at one τ, 99.3% at five τ. Cutoff frequency f = 1 ÷ (2π R C). With R in kΩ and C in µF the product is in ms.',
    formulaLatex: '\\tau = RC, \\quad f_c = \\dfrac{1}{2\\pi RC}',
    workedExample: '10 kΩ with 100 µF: τ = 1,000 ms = 1 s. It is 99.3% charged after 5 s, and the cutoff frequency is 0.16 Hz.',
    faq: [
      { question: 'Why 63 percent?', answer: 'The charge follows 1 − e⁻¹ after one time constant, which is about 0.632.' },
      { question: 'How long to discharge?', answer: 'The same time constant applies: after one τ the voltage has fallen to about 37% of its starting value.' },
      {
        question: 'What is the cutoff frequency?',
        answer: 'For a low-pass RC filter, the frequency where the output has fallen to 70.7% of the input, f = 1 ÷ 2πRC.',
      },
    ],
    scenarios: mixed(
      'rc-time-constant-calculator',
      12,
      (r) => ({ R: r(0.1, 900), C: r(0.01, 4700) }),
      (v) => `${v.R} kΩ and ${v.C} µF`,
    ),
    introOutputs: ['tau', 'fc'],
    relatedSlugs: ['voltage-divider-calculator', 'rlc-impedance-calculator', 'ohms-law-calculator'],
    checks: [
      { inputs: {}, expect: { tau: '1,000 ms', full: '5,000 ms', fc: '0.16 Hz' } },
      { inputs: { R: 1, C: 1 }, expect: { tau: '1 ms', full: '5 ms', fc: '159.15 Hz' } },
      { inputs: { R: 4.7, C: 0.01 }, expect: { tau: '0.047 ms', fc: '3,386.28 Hz' } },
    ],
  },
  {
    slug: 'voltage-divider-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Electricity',
    title: 'Voltage Divider Calculator: Two Resistors',
    h1: 'Voltage Divider Calculator',
    metaDescription:
      'Find the output voltage of a two-resistor voltage divider from the input voltage and both resistances, with the current and total power drawn.',
    about:
      'A voltage divider is two resistors in series across a supply, with the output taken from the point between them. The output is the input scaled by the lower resistor over the total. It is how a sensor signal is scaled down to a safe range and how bias voltages are set. Enter the input voltage and the two resistances in kilohms to get the output voltage, the current flowing and the power the divider wastes as heat, assuming nothing loads the output.',
    inputs: [pos('vin', 'Input voltage (V)', 12, 1e6), pos('r1', 'Upper resistor R1 (kΩ)', 10, 1e9), pos('r2', 'Lower resistor R2 (kΩ)', 5, 1e9)],
    outputs: [out('vout', 'Output voltage', true), out('i', 'Current'), out('p', 'Total power')],
    calculate: (i) => {
      const vin = toD(i.vin);
      const r1 = toD(i.r1);
      const r2 = toD(i.r2);
      const cur = vin.div(r1.plus(r2));
      return { vout: u(vin.mul(r2).div(r1.plus(r2)), 3, 'V'), i: u(cur, 3, 'mA'), p: u(vin.mul(cur), 3, 'mW') };
    },
    formulaDescription:
      'V_out = V_in × R₂ ÷ (R₁ + R₂). With resistances in kΩ the current I = V_in ÷ (R₁ + R₂) is in mA and the power P = V_in × I is in mW. The output is unloaded.',
    formulaLatex: 'V_{out} = V_{in}\\dfrac{R_{2}}{R_{1}+R_{2}}',
    workedExample: '12 V across 10 kΩ and 5 kΩ: V_out = 12 × 5 ÷ 15 = 4 V, the current is 0.8 mA and the divider draws 9.6 mW.',
    faq: [
      {
        question: 'What happens when I connect a load?',
        answer: 'The load in parallel with R₂ lowers its effective resistance and the output drops. Keep the load much larger than R₂.',
      },
      {
        question: 'Can a divider power something?',
        answer: 'Poorly. It wastes current and its output sags under load, so it suits signals, not power supply.',
      },
      { question: 'Why use kilohms?', answer: 'It keeps the current in milliamps and the power in milliwatts, the scale of most signal circuits.' },
    ],
    scenarios: mixed(
      'voltage-divider-calculator',
      12,
      (r) => ({ vin: r(1.8, 48), r1: r(0.5, 220), r2: r(0.5, 220) }),
      (v) => `${v.vin} V, ${v.r1} kΩ over ${v.r2} kΩ`,
    ),
    introOutputs: ['vout'],
    relatedSlugs: ['ohms-law-calculator', 'resistor-network-calculator', 'rc-time-constant-calculator'],
    checks: [
      { inputs: {}, expect: { vout: '4 V', i: '0.8 mA', p: '9.6 mW' } },
      { inputs: { vin: 5, r1: 2.2, r2: 4.7 }, expect: { vout: '3.406 V', i: '0.725 mA', p: '3.623 mW' } },
      { inputs: { vin: 3.3, r1: 100, r2: 100 }, expect: { vout: '1.65 V' } },
    ],
  },
  {
    slug: 'rlc-impedance-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Electricity',
    title: 'RLC Impedance Calculator: Series Circuit and Resonance',
    h1: 'RLC Impedance Calculator',
    metaDescription:
      'Calculate the impedance, phase angle and resonant frequency of a series RLC circuit from the resistance, inductance, capacitance and frequency.',
    about:
      'In an alternating-current circuit a coil and a capacitor oppose the current by amounts that depend on frequency: inductive reactance rises with frequency and capacitive reactance falls. In series with a resistor they combine into one impedance, and the current leads or lags the voltage by a phase angle. At the resonant frequency the two reactances cancel and only the resistance is left. Enter resistance, inductance in millihenries, capacitance in microfarads and frequency.',
    inputs: [
      pos('R', 'Resistance (Ω)', 100, 1e9),
      pos('L', 'Inductance (mH)', 50, 1e9),
      pos('C', 'Capacitance (µF)', 10, 1e9),
      pos('f', 'Frequency (Hz)', 60, 1e12),
    ],
    outputs: [out('z', 'Impedance', true), out('phase', 'Phase angle'), out('f0', 'Resonant frequency')],
    calculate: (i) => {
      const r = toD(i.R);
      const l = toD(i.L).div(1000);
      const c = toD(i.C).div('1e6');
      const w = PI.mul(2).mul(toD(i.f));
      const x = w.mul(l).minus(new D(1).div(w.mul(c)));
      const phase = D.atan2(x, r).div(RAD);
      const kind = x.isNeg() ? 'current leads' : x.isZero() ? 'in phase' : 'current lags';
      return {
        z: u(r.pow(2).plus(x.pow(2)).sqrt(), 2, 'Ω'),
        phase: `${fmtNumber(phase, 1)}° (${kind})`,
        f0: u(new D(1).div(PI.mul(2).mul(l.mul(c).sqrt())), 2, 'Hz'),
      };
    },
    formulaDescription:
      'X_L = 2π f L, X_C = 1 ÷ (2π f C), Z = √(R² + (X_L − X_C)²), φ = atan((X_L − X_C) ÷ R), resonance f₀ = 1 ÷ (2π √(LC)). A negative phase means the capacitor dominates and the current leads.',
    formulaLatex: 'Z = \\sqrt{R^{2} + \\left(\\omega L - \\dfrac{1}{\\omega C}\\right)^{2}}',
    workedExample:
      '100 Ω, 50 mH and 10 µF at 60 Hz: X_L = 18.85 Ω, X_C = 265.26 Ω, so Z = 265.93 Ω with a phase of −67.9° (current leads). Resonance would be at 225.08 Hz.',
    faq: [
      {
        question: 'What is resonance?',
        answer: 'The frequency where inductive and capacitive reactance are equal and cancel, leaving the impedance at its minimum, equal to R.',
      },
      {
        question: 'What does the phase angle tell me?',
        answer: 'How far the current is shifted from the voltage: negative when capacitive, positive when inductive.',
      },
      { question: 'Does it work for parallel circuits?', answer: 'No, only the series arrangement.' },
    ],
    scenarios: mixed(
      'rlc-impedance-calculator',
      12,
      (r) => ({ R: r(5, 900), L: r(1, 900), C: r(0.1, 400), f: Math.round(r(20, 20000)) }),
      (v) => `${v.R} Ω, ${v.L} mH, ${v.C} µF at ${v.f} Hz`,
    ),
    introOutputs: ['z', 'f0'],
    relatedSlugs: ['rc-time-constant-calculator', 'ohms-law-calculator', 'frequency-period-calculator'],
    checks: [
      { inputs: {}, expect: { z: '265.93 Ω', phase: '-67.9° (current leads)', f0: '225.08 Hz' } },
      { inputs: { R: 50, L: 10, C: 1, f: 5000 }, expect: { z: '286.72 Ω', phase: '80° (current lags)', f0: '1,591.55 Hz' } },
      { inputs: { R: 10, L: 100, C: 10, f: 1000 }, expect: { z: '612.48 Ω', f0: '159.15 Hz' } },
    ],
  },
  {
    slug: 'photon-energy-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'Photon Energy Calculator: Wavelength to Electronvolts',
    h1: 'Photon Energy Calculator',
    metaDescription:
      'Convert a wavelength in nanometres to photon energy in electronvolts and joules and to frequency in terahertz, with the part of the spectrum it belongs to.',
    about:
      'Light comes in packets called photons, and each carries energy inversely proportional to its wavelength: short wavelengths such as X-rays carry far more energy than long radio waves. Enter a wavelength in nanometres to get the energy of one photon in electronvolts and joules, its frequency in terahertz and the band of the electromagnetic spectrum it falls in. Green light at 550 nm carries about 2.25 eV, enough to trigger vision but not to ionise atoms.',
    inputs: [field('nm', 'Wavelength (nm)', 550, 0.0001, 1e12)],
    outputs: [out('ev', 'Photon energy', true), out('thz', 'Frequency'), out('j', 'Energy in joules'), out('band', 'Spectrum band')],
    calculate: (i) => {
      const nm = toD(i.nm);
      const lam = nm.mul('1e-9');
      const e = H.mul(C).div(lam);
      const band = nm.lt('0.01')
        ? 'Gamma ray'
        : nm.lt(10)
          ? 'X-ray'
          : nm.lt(400)
            ? 'Ultraviolet'
            : nm.lt(700)
              ? 'Visible light'
              : nm.lt('1e6')
                ? 'Infrared'
                : 'Microwave or radio';
      return { ev: u(e.div(QE), 4, 'eV'), thz: u(C.div(lam).div('1e12'), 2, 'THz'), j: `${sci(e)} J`, band };
    },
    formulaDescription: 'E = h c ÷ λ = h f, with h = 6.62607015×10⁻³⁴ J s, c = 299,792,458 m/s and 1 eV = 1.602176634×10⁻¹⁹ J. Band edges are conventional.',
    formulaLatex: 'E = \\dfrac{hc}{\\lambda} = hf',
    workedExample: 'Green light at 550 nm: E = 3.612×10⁻¹⁹ J = 2.254 eV, and f = 545.08 THz, in the visible band.',
    faq: [
      {
        question: 'Why do short wavelengths carry more energy?',
        answer: 'Energy is proportional to frequency, and frequency is inversely proportional to wavelength.',
      },
      { question: 'What is an electronvolt?', answer: 'The energy an electron gains crossing one volt, 1.602×10⁻¹⁹ J, a convenient unit for atomic scales.' },
      {
        question: 'Where does visible light end?',
        answer: "Conventionally near 400 nm (violet) and 700 nm (red); the eye's limits are a little wider and vary.",
      },
    ],
    scenarios: mixed(
      'photon-energy-calculator',
      12,
      (r) => ({ nm: Math.round(r(0.05, 1500) * 10) / 10 }),
      (v) => `wavelength ${v.nm} nm`,
    ),
    introOutputs: ['ev', 'band'],
    relatedSlugs: ['wave-speed-calculator', 'frequency-period-calculator', 'snells-law-calculator'],
    checks: [
      { inputs: {}, expect: { ev: '2.2543 eV', thz: '545.08 THz', j: '3.612 × 10^-19 J', band: 'Visible light' } },
      { inputs: { nm: 10600 }, expect: { ev: '0.117 eV', thz: '28.28 THz', j: '1.874 × 10^-20 J', band: 'Infrared' } },
      { inputs: { nm: 100 }, expect: { ev: '12.3984 eV', band: 'Ultraviolet' } },
    ],
  },
  {
    slug: 'snells-law-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: "Snell's Law Calculator: Refraction and Critical Angle",
    h1: "Snell's Law Calculator",
    metaDescription:
      'Find the refracted angle of light passing between two media from their refractive indices and the angle of incidence, with the critical angle and light speed.',
    about:
      "When light crosses from one transparent material into another it bends, because it travels at a different speed in each. Snell's law relates the angles to the refractive indices of the two media. Enter both indices (air is about 1.00, water 1.33, glass about 1.5) and the angle of incidence measured from the normal. The calculator returns the refracted angle, or total internal reflection if none exists, the critical angle when going into a less dense medium and the speed of light in the second medium.",
    inputs: [
      field('n1', 'Refractive index n₁ (air 1.00)', 1, 1, 4),
      field('n2', 'Refractive index n₂ (water 1.33)', 1.33, 1, 4),
      field('ang', 'Angle of incidence (°)', 30, 0, 90),
    ],
    outputs: [out('ref', 'Refracted angle', true), out('crit', 'Critical angle'), out('v', 'Speed of light in medium 2')],
    calculate: (i) => {
      const n1 = toD(i.n1);
      const n2 = toD(i.n2);
      const s = n1.mul(sinD(toD(i.ang))).div(n2);
      return {
        ref: s.gt(1) ? 'Total internal reflection' : u(D.asin(s).div(RAD), 2, '°').replace(' °', '°'),
        crit: n1.gt(n2) ? `${fmtNumber(D.asin(n2.div(n1)).div(RAD), 2)}°` : 'None (light enters a denser medium)',
        v: u(C.div(1000).div(n2), 2, 'km/s'),
      };
    },
    formulaDescription:
      'n₁ sin θ₁ = n₂ sin θ₂. The critical angle is θ_c = asin(n₂ ÷ n₁), defined only when n₁ > n₂. The speed in a medium is c ÷ n, and angles are measured from the normal.',
    formulaLatex: 'n_{1}\\sin\\theta_{1} = n_{2}\\sin\\theta_{2}',
    workedExample: 'Light from air (1.00) into water (1.33) at 30°: sin θ₂ = 0.5 ÷ 1.33, so θ₂ = 22.08°. In water light travels at 225,407.86 km/s.',
    faq: [
      {
        question: 'What is total internal reflection?',
        answer:
          'Past the critical angle, going from a denser to a less dense medium, no light is refracted and all of it reflects back. Optical fibres rely on it.',
      },
      { question: 'Is the angle from the surface?', answer: 'No. Both angles are measured from the normal, the line perpendicular to the surface.' },
      {
        question: 'Why does light slow down?',
        answer: 'In a material it interacts with the atoms, so its effective speed is c ÷ n, where n is the refractive index.',
      },
    ],
    scenarios: mixed(
      'snells-law-calculator',
      12,
      (r) => ({ n1: r(1, 2.4), n2: r(1, 2.4), ang: r(5, 85) }),
      (v) => `n ${v.n1} to ${v.n2} at ${v.ang}°`,
    ),
    introOutputs: ['ref'],
    relatedSlugs: ['thin-lens-calculator', 'photon-energy-calculator', 'wave-speed-calculator'],
    checks: [
      { inputs: {}, expect: { ref: '22.08°', crit: 'None (light enters a denser medium)', v: '225,407.86 km/s' } },
      { inputs: { n1: 1.5, n2: 1, ang: 60 }, expect: { ref: 'Total internal reflection', crit: '41.81°', v: '299,792.46 km/s' } },
      { inputs: { n1: 1.33, n2: 1, ang: 30 }, expect: { ref: '41.68°', crit: '48.75°' } },
    ],
  },
  {
    slug: 'thin-lens-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'Thin Lens Calculator: Image Distance and Magnification',
    h1: 'Thin Lens Calculator',
    metaDescription:
      'Use the thin lens equation to find the image distance, magnification and image type of a converging lens from its focal length and the object distance.',
    about:
      'A converging lens focuses light from an object to form an image whose position depends on the focal length and how far away the object is. Beyond the focal length the image is real and inverted and can be caught on a screen; inside it, the lens acts as a magnifier and the image is virtual and upright. Enter the focal length and object distance in centimetres to get the image distance, the magnification and a description of the image.',
    inputs: [pos('f', 'Focal length (cm)', 10, 1e6), pos('do', 'Object distance (cm)', 25, 1e6)],
    outputs: [out('di', 'Image distance', true), out('m', 'Magnification'), out('kind', 'Image')],
    calculate: (i) => {
      const f = toD(i.f);
      const dobj = toD(i.do);
      if (dobj.eq(f)) return { di: 'At infinity (parallel rays)', m: 'Not defined', kind: 'No image forms' };
      const di = new D(1).div(new D(1).div(f).minus(new D(1).div(dobj)));
      const m = di.neg().div(dobj);
      return {
        di: u(di, 2, 'cm'),
        m: `${fmtNumber(m, 3)}×`,
        kind: `${di.gt(0) ? 'Real, inverted, ' : 'Virtual, upright, '}${m.abs().gt(1) ? 'magnified' : m.abs().lt(1) ? 'reduced' : 'same size'}`,
      };
    },
    formulaDescription:
      '1 ÷ f = 1 ÷ d_o + 1 ÷ d_i and m = −d_i ÷ d_o, for a thin converging lens. A negative image distance means a virtual image on the same side as the object.',
    formulaLatex: '\\dfrac{1}{f} = \\dfrac{1}{d_o} + \\dfrac{1}{d_i}',
    workedExample: 'f = 10 cm and an object at 25 cm: d_i = 1 ÷ (1/10 − 1/25) = 16.67 cm, m = −0.667. The image is real, inverted and reduced.',
    faq: [
      { question: 'What happens at exactly the focal length?', answer: 'The rays leave the lens parallel, so no image forms, or one at infinity.' },
      { question: 'What does a negative magnification mean?', answer: 'The image is inverted. A positive value means it is upright.' },
      { question: 'How does a magnifying glass work?', answer: 'The object sits inside the focal length, giving a virtual, upright, enlarged image.' },
    ],
    scenarios: mixed(
      'thin-lens-calculator',
      12,
      (r) => ({ f: r(2, 60), do: r(1, 150) }),
      (v) => `f ${v.f} cm, object at ${v.do} cm`,
    ),
    introOutputs: ['di', 'm'],
    relatedSlugs: ['snells-law-calculator', 'photon-energy-calculator', 'wave-speed-calculator'],
    checks: [
      { inputs: {}, expect: { di: '16.67 cm', m: '-0.667×', kind: 'Real, inverted, reduced' } },
      { inputs: { f: 10, do: 5 }, expect: { di: '-10 cm', m: '2×', kind: 'Virtual, upright, magnified' } },
      { inputs: { f: 15, do: 15 }, expect: { di: 'At infinity (parallel rays)', m: 'Not defined', kind: 'No image forms' } },
      { inputs: { f: 5, do: 8 }, expect: { di: '13.33 cm', m: '-1.667×' } },
    ],
  },
  {
    slug: 'speed-of-sound-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'Speed of Sound Calculator: Temperature and Thunder',
    h1: 'Speed of Sound Calculator',
    metaDescription:
      'Calculate the speed of sound in air from the temperature, and find how far away lightning struck from the delay between the flash and the thunder.',
    about:
      'Sound travels through air faster when the air is warmer, from about 331 metres per second at freezing to 343 at 20 degrees Celsius. Enter the air temperature to get the speed in metres per second and kilometres per hour. The second input turns it into a storm tool: count the seconds between a lightning flash and its thunder, and the calculator gives the distance to the strike, since the light arrives almost instantly and the sound crawls in behind it.',
    inputs: [real('T', 'Air temperature (°C)', 20, -80, 100), field('delay', 'Seconds from flash to thunder', 6, 0, 300)],
    outputs: [out('c', 'Speed of sound', true), out('kmh', 'In kilometres per hour'), out('km', 'Distance to the lightning')],
    calculate: (i) => {
      const c = new D('331.3').mul(new D(1).plus(toD(i.T).div('273.15')).sqrt());
      return { c: u(c, 2, 'm/s'), kmh: u(c.mul('3.6'), 2, 'km/h'), km: u(c.mul(toD(i.delay)).div(1000), 2, 'km') };
    },
    formulaDescription: 'c = 331.3 √(1 + T ÷ 273.15) m/s for dry air, with T in °C. Distance = c × delay; the flash is treated as instantaneous.',
    formulaLatex: 'c = 331.3\\sqrt{1 + \\dfrac{T}{273.15}}',
    workedExample: 'At 20 °C: c = 331.3 × √1.0732 = 343.21 m/s (1,235.57 km/h). A 6 s gap puts the lightning 2.06 km away.',
    faq: [
      {
        question: 'Why does temperature change the speed?',
        answer:
          'Warmer air molecules move faster and pass the pressure wave along more quickly. Pressure and altitude matter little in air at a given temperature.',
      },
      { question: 'What is a rough rule for thunder?', answer: 'About three seconds per kilometre, or five seconds per mile.' },
      { question: 'Is sound faster in water?', answer: 'Yes, about 1,480 m/s, and faster still in steel; this page covers air.' },
    ],
    scenarios: mixed(
      'speed-of-sound-calculator',
      12,
      (r) => ({ T: Math.round(r(-40, 45)), delay: Math.round(r(1, 40)) }),
      (v) => `${v.T} °C, ${v.delay} s of delay`,
    ),
    introOutputs: ['c', 'km'],
    relatedSlugs: ['doppler-effect-calculator', 'wave-speed-calculator', 'frequency-period-calculator'],
    checks: [
      { inputs: {}, expect: { c: '343.21 m/s', kmh: '1,235.57 km/h', km: '2.06 km' } },
      { inputs: { T: 0, delay: 3 }, expect: { c: '331.3 m/s', kmh: '1,192.68 km/h', km: '0.99 km' } },
      { inputs: { T: -40, delay: 10 }, expect: { c: '306.08 m/s', km: '3.06 km' } },
    ],
  },
  {
    slug: 'doppler-effect-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'Doppler Effect Calculator: Moving Sound Source',
    h1: 'Doppler Effect Calculator',
    metaDescription:
      'Calculate the pitch you hear from a sound source moving toward you and away from you, from the emitted frequency and the speed of the source.',
    about:
      'A siren sounds higher as it comes toward you and drops in pitch the moment it passes, because the moving source squeezes the sound waves ahead of it and stretches those behind. Enter the frequency the source emits and its speed, and the calculator returns the frequency a stationary listener hears as it approaches and as it recedes, plus the size of the drop. It uses 343 m/s for the speed of sound in air at 20 degrees Celsius.',
    inputs: [pos('f', 'Source frequency (Hz)', 440, 1e6), field('vs', 'Source speed (m/s)', 30, 0, 300)],
    outputs: [out('app', 'Heard while approaching', true), out('rec', 'Heard while receding'), out('diff', 'Drop in pitch as it passes')],
    calculate: (i) => {
      const f = toD(i.f);
      const vs = toD(i.vs);
      const c = new D(343);
      const a = f.mul(c).div(c.minus(vs));
      const r = f.mul(c).div(c.plus(vs));
      return { app: u(a, 2, 'Hz'), rec: u(r, 2, 'Hz'), diff: u(a.minus(r), 2, 'Hz') };
    },
    formulaDescription:
      'Approaching: f′ = f × c ÷ (c − v_s). Receding: f′ = f × c ÷ (c + v_s). Stationary listener, c = 343 m/s, source speed below the speed of sound.',
    formulaLatex: "f' = f\\,\\dfrac{c}{c \\mp v_{s}}",
    workedExample: 'A 440 Hz source moving at 30 m/s: approaching you hear 482.17 Hz, receding 404.61 Hz, a drop of 77.56 Hz.',
    faq: [
      {
        question: 'Does the pitch change while it approaches?',
        answer: 'No. The pitch stays at a steady higher value while the source approaches, then steps down to a steady lower value after it passes.',
      },
      {
        question: 'Does it work for light?',
        answer: 'Light shows a similar shift, but the formula differs because light needs no medium and relativity applies.',
      },
      { question: 'What if the source is supersonic?', answer: 'The formula breaks down; waves pile up into a shock wave, which this page does not model.' },
    ],
    scenarios: mixed(
      'doppler-effect-calculator',
      12,
      (r) => ({ f: Math.round(r(120, 4000)), vs: Math.round(r(2, 120)) }),
      (v) => `${v.f} Hz at ${v.vs} m/s`,
    ),
    introOutputs: ['app', 'rec'],
    relatedSlugs: ['speed-of-sound-calculator', 'frequency-period-calculator', 'wave-speed-calculator'],
    checks: [
      { inputs: {}, expect: { app: '482.17 Hz', rec: '404.61 Hz', diff: '77.56 Hz' } },
      { inputs: { f: 1000, vs: 20 }, expect: { app: '1,061.92 Hz', rec: '944.9 Hz' } },
      { inputs: { f: 500, vs: 0 }, expect: { app: '500 Hz', diff: '0 Hz' } },
    ],
  },
  {
    slug: 'elastic-collision-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: 'Elastic Collision Calculator: Velocities After Impact',
    h1: 'Elastic Collision Calculator',
    metaDescription:
      'Calculate the velocities of two masses after a head-on elastic collision, or after a perfectly inelastic one, and the kinetic energy lost when they stick.',
    about:
      'In a collision, momentum is always conserved. In a perfectly elastic collision kinetic energy is conserved too, so the bodies bounce apart; in a perfectly inelastic one they stick together and some kinetic energy turns to heat and deformation. Enter two masses and their velocities along a line (negative means the opposite direction) to get both final velocities for the elastic case, the shared velocity if they stick, and the energy lost in that sticking case.',
    inputs: [pos('m1', 'Mass 1 (kg)', 2, 1e9), real('v1', 'Velocity 1 (m/s)', 5), pos('m2', 'Mass 2 (kg)', 3, 1e9), real('v2', 'Velocity 2 (m/s)', -1)],
    outputs: [
      out('u1', 'Mass 1 after (elastic)', true),
      out('u2', 'Mass 2 after (elastic)'),
      out('vc', 'Together after sticking'),
      out('lost', 'Kinetic energy lost if they stick'),
    ],
    calculate: (i) => {
      const m1 = toD(i.m1);
      const m2 = toD(i.m2);
      const v1 = toD(i.v1);
      const v2 = toD(i.v2);
      const mt = m1.plus(m2);
      const u1 = m1.minus(m2).mul(v1).plus(m2.mul(2).mul(v2)).div(mt);
      const u2 = m2.minus(m1).mul(v2).plus(m1.mul(2).mul(v1)).div(mt);
      const vc = m1.mul(v1).plus(m2.mul(v2)).div(mt);
      const ke0 = m1
        .mul(v1.pow(2))
        .plus(m2.mul(v2.pow(2)))
        .div(2);
      return { u1: u(u1, 3, 'm/s'), u2: u(u2, 3, 'm/s'), vc: u(vc, 3, 'm/s'), lost: u(ke0.minus(mt.mul(vc.pow(2)).div(2)), 2, 'J') };
    },
    formulaDescription:
      'Elastic, one dimension: v₁′ = ((m₁ − m₂) v₁ + 2 m₂ v₂) ÷ (m₁ + m₂) and v₂′ = ((m₂ − m₁) v₂ + 2 m₁ v₁) ÷ (m₁ + m₂). Perfectly inelastic: v′ = (m₁ v₁ + m₂ v₂) ÷ (m₁ + m₂).',
    formulaLatex: "v_{1}' = \\dfrac{(m_{1}-m_{2})v_{1} + 2m_{2}v_{2}}{m_{1}+m_{2}}",
    workedExample:
      '2 kg at 5 m/s meets 3 kg at −1 m/s. Elastic: 2 kg goes to −2.2 m/s and 3 kg to 3.8 m/s. Sticking: both move at 1.4 m/s and 21.6 J of kinetic energy is lost.',
    faq: [
      { question: 'What stays the same in every collision?', answer: 'Total momentum, as long as no outside force acts during the impact.' },
      { question: 'Are real collisions elastic?', answer: 'Almost never. Billiard balls are close; car crashes lose a lot of energy to deformation.' },
      { question: 'What if the masses are equal?', answer: 'In an elastic collision they simply swap velocities.' },
    ],
    scenarios: mixed(
      'elastic-collision-calculator',
      12,
      (r) => ({ m1: r(0.2, 60), v1: r(-12, 25), m2: r(0.2, 60), v2: r(-12, 12) }),
      (v) => `${v.m1} kg at ${v.v1} and ${v.m2} kg at ${v.v2} m/s`,
    ),
    introOutputs: ['u1', 'vc'],
    relatedSlugs: ['momentum-calculator', 'kinetic-energy-calculator', 'force-calculator'],
    checks: [
      { inputs: {}, expect: { u1: '-2.2 m/s', u2: '3.8 m/s', vc: '1.4 m/s', lost: '21.6 J' } },
      { inputs: { m1: 1, v1: 4, m2: 1, v2: 0 }, expect: { u1: '0 m/s', u2: '4 m/s', vc: '2 m/s', lost: '4 J' } },
      { inputs: { m1: 5, v1: 3, m2: 1, v2: 0 }, expect: { u1: '2 m/s', u2: '5 m/s' } },
    ],
  },
  {
    slug: 'inclined-plane-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: 'Inclined Plane Calculator: Slope Force and Acceleration',
    h1: 'Inclined Plane Calculator',
    metaDescription: 'Work out the force along a slope, the normal force and the acceleration of a mass sliding down an inclined plane with friction.',
    about:
      'On a slope, gravity splits into a part pulling the object down the incline and a part pressing it into the surface. The first is the weight times the sine of the angle, the second the weight times the cosine. Friction opposes sliding with a force proportional to the normal force. Enter the mass, the slope angle and the friction coefficient to get both components, the acceleration down the slope, or confirmation that friction holds it, and the critical coefficient at which it starts to slide.',
    inputs: [pos('m', 'Mass (kg)', 20, 1e9), field('ang', 'Slope angle (°)', 30, 0, 89.9), field('mu', 'Friction coefficient μ', 0.2, 0, 5)],
    outputs: [
      out('along', 'Force down the slope', true),
      out('normal', 'Normal force'),
      out('acc', 'Acceleration down the slope'),
      out('crit', 'Critical friction coefficient'),
    ],
    calculate: (i) => {
      const ang = toD(i.ang);
      const s = sinD(ang);
      const c = cosD(ang);
      const m = toD(i.m);
      const acc = G.mul(s.minus(toD(i.mu).mul(c)));
      return {
        along: u(m.mul(G).mul(s), 2, 'N'),
        normal: u(m.mul(G).mul(c), 2, 'N'),
        acc: acc.gt(0) ? u(acc, 3, 'm/s²') : 'Stays put (friction holds it)',
        crit: fmtNumber(s.div(c), 3),
      };
    },
    formulaDescription:
      'Along the slope: m g sin θ. Normal: m g cos θ. Acceleration: a = g (sin θ − μ cos θ) when positive. The object starts to slide once μ is below tan θ.',
    formulaLatex: 'a = g(\\sin\\theta - \\mu\\cos\\theta)',
    workedExample:
      'A 20 kg crate on a 30° slope with μ = 0.2: 98.07 N pulls it down, the normal force is 169.86 N, and it accelerates at 3.205 m/s². It would stay put if μ were above 0.577.',
    faq: [
      {
        question: 'Does the mass change the acceleration?',
        answer: 'No. It cancels out, so a heavy and a light object slide with the same acceleration for the same μ and angle.',
      },
      { question: 'What is the critical coefficient?', answer: 'tan θ. Below it the object slides; above it, static friction can hold it.' },
      {
        question: 'Why use a ramp at all?',
        answer: 'Pushing up a gentle slope needs a smaller force than lifting straight, at the cost of a longer distance.',
      },
    ],
    scenarios: mixed(
      'inclined-plane-calculator',
      12,
      (r) => ({ m: r(1, 400), ang: r(5, 75), mu: r(0.02, 0.9) }),
      (v) => `${v.m} kg, ${v.ang}°, μ ${v.mu}`,
    ),
    introOutputs: ['along', 'acc'],
    relatedSlugs: ['friction-force-calculator', 'force-calculator', 'potential-energy-calculator'],
    checks: [
      { inputs: {}, expect: { along: '98.07 N', normal: '169.86 N', acc: '3.205 m/s²', crit: '0.577' } },
      { inputs: { m: 10, ang: 45, mu: 0.5 }, expect: { along: '69.34 N', normal: '69.34 N', acc: '3.467 m/s²', crit: '1' } },
      { inputs: { m: 50, ang: 10, mu: 0.3 }, expect: { acc: 'Stays put (friction holds it)', crit: '0.176' } },
    ],
  },
  {
    slug: 'time-dilation-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Modern physics',
    title: 'Time Dilation Calculator: Special Relativity',
    h1: 'Time Dilation Calculator',
    metaDescription:
      'Calculate the Lorentz factor, the time that passes for a stationary observer and the length contraction for a traveller moving at a fraction of the speed of light.',
    about:
      "Special relativity says moving clocks run slow as seen by a stationary observer, by the Lorentz factor, which grows without limit as the speed approaches that of light. Enter the speed as a percentage of the speed of light and the time that passes on the traveller's clock in years. The calculator returns the Lorentz factor, the time elapsed on Earth and the length contraction along the direction of travel. At 80 percent of light speed a year on board is 1.667 years at home.",
    inputs: [field('pct', 'Speed (% of the speed of light)', 80, 0, 99.999), pos('tau', "Time on the traveller's clock (years)", 1, 1e9)],
    outputs: [out('gamma', 'Lorentz factor γ', true), out('elapsed', 'Time for the stationary observer'), out('len', 'Length as measured by the observer')],
    calculate: (i) => {
      const b = toD(i.pct).div(100);
      const gamma = new D(1).div(new D(1).minus(b.pow(2)).sqrt());
      return { gamma: fmtNumber(gamma, 4), elapsed: u(gamma.mul(toD(i.tau)), 3, 'years'), len: `${fmtNumber(new D(100).div(gamma), 2)}%` };
    },
    formulaDescription: 'γ = 1 ÷ √(1 − v²/c²). Time for the observer = γ × proper time; the length along the motion is the rest length ÷ γ.',
    formulaLatex: '\\gamma = \\dfrac{1}{\\sqrt{1 - v^{2}/c^{2}}}',
    workedExample:
      'At 80% of c, γ = 1 ÷ √0.36 = 1.6667. One year on the ship is 1.667 years on Earth, and a ruler along the motion measures 60% of its rest length.',
    faq: [
      {
        question: 'Has time dilation been measured?',
        answer: 'Yes: atomic clocks on aircraft, fast-moving muons that outlive their expected lifetime, and GPS corrections all confirm it.',
      },
      {
        question: 'Why can nothing reach the speed of light?',
        answer: 'γ grows without bound, so the energy needed to accelerate a massive object becomes infinite.',
      },
      {
        question: 'Who is right, the ship or Earth?',
        answer: "Each sees the other's clock run slow; the asymmetry in a round trip comes from the traveller turning around.",
      },
    ],
    scenarios: mixed(
      'time-dilation-calculator',
      12,
      (r) => ({ pct: r(5, 99.9), tau: r(0.1, 40) }),
      (v) => `${v.pct}% of c for ${v.tau} years`,
    ),
    introOutputs: ['gamma', 'elapsed'],
    relatedSlugs: ['mass-energy-calculator', 'photon-energy-calculator', 'kinetic-energy-calculator'],
    checks: [
      { inputs: {}, expect: { gamma: '1.6667', elapsed: '1.667 years', len: '60%' } },
      { inputs: { pct: 99, tau: 5 }, expect: { gamma: '7.0888', elapsed: '35.444 years', len: '14.11%' } },
      { inputs: { pct: 50, tau: 10 }, expect: { gamma: '1.1547', elapsed: '11.547 years' } },
    ],
  },
  {
    slug: 'mass-energy-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Modern physics',
    title: 'Mass-Energy Calculator: E = mc²',
    h1: 'Mass-Energy Calculator',
    metaDescription: 'Convert a mass to its rest energy with E = mc², in joules, kilowatt-hours and tons of TNT.',
    about:
      "Einstein's most famous equation says a mass at rest holds energy equal to its mass times the speed of light squared. Because the speed of light squared is enormous, a tiny mass corresponds to a huge energy. Enter a mass in grams to see its rest energy in joules, in kilowatt-hours, the unit on an electricity bill, and in tons of TNT. One gram is about 89.9 trillion joules, roughly the yield of a small nuclear weapon, though no ordinary process releases all of it.",
    inputs: [pos('m', 'Mass (g)', 1, 1e12)],
    outputs: [out('j', 'Rest energy', true), out('kwh', 'In kilowatt-hours'), out('tnt', 'In tons of TNT')],
    calculate: (i) => {
      const e = toD(i.m).div(1000).mul(C.pow(2));
      return { j: `${sci(e)} J`, kwh: u(e.div('3600000'), 0, 'kWh'), tnt: u(e.div('4184000000'), 1, 'tons of TNT') };
    },
    formulaDescription: 'E = m c² with c = 299,792,458 m/s. One kilowatt-hour is 3.6×10⁶ J and one ton of TNT is defined as 4.184×10⁹ J.',
    formulaLatex: 'E = mc^{2}',
    workedExample: '1 g = 0.001 kg: E = 0.001 × (299,792,458)² = 8.988×10¹³ J, which is 24,965,422 kWh or 21,480.8 tons of TNT.',
    faq: [
      {
        question: 'Can we convert all mass to energy?',
        answer: 'Only by annihilating it with antimatter. Fission and fusion convert a small fraction, well under one percent.',
      },
      {
        question: 'Does mass really turn into energy?',
        answer: 'The rest energy is part of every mass. Nuclear reactions release some of it, and the products weigh slightly less.',
      },
      {
        question: 'Why is c squared so large?',
        answer: 'The speed of light is about 3×10⁸ m/s, so its square, about 9×10¹⁶, multiplies even a gram into trillions of joules.',
      },
    ],
    scenarios: mixed(
      'mass-energy-calculator',
      12,
      (r) => ({ m: r(0.001, 900) }),
      (v) => `mass of ${v.m} g`,
    ),
    introOutputs: ['j', 'tnt'],
    relatedSlugs: ['time-dilation-calculator', 'kinetic-energy-calculator', 'photon-energy-calculator'],
    checks: [
      { inputs: {}, expect: { j: '8.988 × 10^13 J', kwh: '24,965,422 kWh', tnt: '21,480.8 tons of TNT' } },
      { inputs: { m: 0.001 }, expect: { j: '8.988 × 10^10 J', kwh: '24,965 kWh', tnt: '21.5 tons of TNT' } },
      { inputs: { m: 70000 }, expect: { j: '6.291 × 10^18 J', tnt: '1,503,653,501.7 tons of TNT' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
