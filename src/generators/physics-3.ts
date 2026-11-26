import { selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, mixed, type Spec } from '../lib/spec';
import { field, intField, sci, varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 14 (physics): rotation and machines, fluids, gases and heat transfer. Textbook idealisations apply
 * and each page says so (rigid bodies, ideal gas, steady flow, ideal machines unless an efficiency is entered).
 * Constants: g = 9.80665 m/s², Stefan-Boltzmann 5.670374419e-8, Wien 2.897771955e-3 m K, R = 8.314462618, all
 * exact SI values or CODATA 2018. Physics shows no disclaimer. Tier 2 or 3, so none is live until the cohort gate opens.
 */

const G = new D('9.80665');
const PI = D.acos(-1);
const SIGMA = new D('5.670374419e-8');
const WIEN = new D('2.897771955e-3');
const NA = new D('6.02214076e23');
const RGAS = new D('8.314462618');
const HP = new D('745.69987158227022');
const PS = new D('735.49875');
const PSI = new D('6894.757293168');

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
const hm = (hours: Dec): string => {
  const total = BigInt(hours.mul(60).toFixed(0, D.ROUND_HALF_UP));
  return `${total / 60n} h ${total % 60n} min`;
};
const band = (nm: Dec): string =>
  nm.lt('0.01')
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

const AIR: Record<string, string> = { sea: '1.225', alt3: '0.909', alt5: '0.736', alt10: '0.4135' };
const AIR_OPTIONS: [string, string][] = [
  ['sea', 'Sea level (1.225 kg/m³)'],
  ['alt3', '3,000 m (0.909)'],
  ['alt5', '5,000 m (0.736)'],
  ['alt10', '10,000 m (0.4135)'],
];
const LIQUID: Record<string, string> = { fresh: '1000', sea: '1025', oil: '920', mercury: '13534' };
const SHAPES: Record<string, { k: Dec; text: string }> = {
  cylinder: { k: new D(1).div(2), text: '½ m r²' },
  hoop: { k: new D(1), text: 'm r²' },
  sphere: { k: new D(2).div(5), text: '⅖ m r²' },
  shell: { k: new D(2).div(3), text: '⅔ m r²' },
  rodc: { k: new D(1).div(12), text: '1/12 m L²' },
  rode: { k: new D(1).div(3), text: '⅓ m L²' },
};
const FLUIDS: Record<string, { rho: string; mu: string }> = {
  water: { rho: '998.2', mu: '0.001002' },
  air: { rho: '1.204', mu: '0.00001825' },
  oil: { rho: '891', mu: '0.29' },
  glycerin: { rho: '1261', mu: '1.412' },
};
const ALPHA: Record<string, string> = { aluminium: '23', copper: '17', steel: '12', glass: '9', concrete: '12', pvc: '52', brass: '19' };
const LATENT: Record<string, string> = { ice: '334', boil: '2257', ethanol: '841', lead: '23', aluminium: '397', iron: '247' };

export const SPECS: Spec[] = [
  {
    slug: 'speed-distance-time-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Kinematics',
    title: 'Speed, Distance and Time Calculator: Solve for Any One',
    h1: 'Speed, Distance and Time Calculator',
    metaDescription:
      'Find the speed, the distance or the time of a journey from the other two, with the answer in hours and minutes, metres per second or miles.',
    about:
      'Speed, distance and time are bound by one relationship: distance equals speed multiplied by time. Know any two and the third follows. Choose what to solve for, then fill in the other two values: speed in kilometres per hour, distance in kilometres and time in hours. A time answer is shown in hours and minutes, a speed answer also in metres per second, and a distance also in miles. It is the quick way to plan a drive, a train trip or a long training run.',
    inputs: [
      sel('mode', 'Solve for', 'time', [
        ['time', 'Time'],
        ['speed', 'Speed'],
        ['distance', 'Distance'],
      ]),
      pos('v', 'Speed (km/h)', 80, 1e7),
      pos('d', 'Distance (km)', 200, 1e9),
      pos('t', 'Time (hours)', 2.5, 1e6),
    ],
    outputs: [out('result', 'Answer', true), out('detail', 'In other units')],
    calculate: (i) => {
      const mode = String(i.mode);
      if (mode === 'speed') {
        const s = toD(i.d).div(toD(i.t));
        return { result: u(s, 2, 'km/h'), detail: u(s.div('3.6'), 2, 'm/s') };
      }
      if (mode === 'distance') {
        const x = toD(i.v).mul(toD(i.t));
        return { result: u(x, 2, 'km'), detail: u(x.div('1.609344'), 2, 'miles') };
      }
      const t = toD(i.d).div(toD(i.v));
      return { result: hm(t), detail: u(t, 3, 'hours') };
    },
    formulaDescription:
      'distance = speed × time, so speed = distance ÷ time and time = distance ÷ speed. One mile is exactly 1.609344 km. The speed field is ignored when solving for speed, and likewise for the others.',
    formulaLatex: 'd = v\\,t',
    workedExample: '200 km at 80 km/h takes 200 ÷ 80 = 2.5 hours, which is 2 h 30 min. Solving for speed with 42.195 km in 3.5 h gives 12.05 km/h.',
    faq: [
      { question: 'What units must I use?', answer: 'Kilometres, hours and kilometres per hour here. Convert minutes to hours first by dividing by 60.' },
      {
        question: 'Is this the same as average speed?',
        answer: 'It treats the speed as constant. For a trip with stops, use the total distance and total time to get the average speed.',
      },
      { question: 'How do I enter 45 minutes?', answer: 'As 0.75 hours. The answer for a time is shown back as hours and minutes.' },
    ],
    scenarios: varied(
      'speed-distance-time-calculator',
      12,
      [
        { name: 'v', lo: 5, hi: 140, step: 5 },
        { name: 'd', lo: 10, hi: 900, step: 10 },
        { name: 't', lo: 0.25, hi: 12, step: 0.25 },
      ],
      [{ name: 'mode', options: ['time', 'speed', 'distance'] }],
      (v) => `${v.mode}: ${v.v} km/h, ${v.d} km, ${v.t} h`,
    ),
    introOutputs: ['result'],
    relatedSlugs: ['average-speed-calculator', 'acceleration-calculator', 'final-velocity-calculator'],
    checks: [
      { inputs: {}, expect: { result: '2 h 30 min', detail: '2.5 hours' } },
      { inputs: { mode: 'speed', d: 42.195, t: 3.5 }, expect: { result: '12.06 km/h', detail: '3.35 m/s' } },
      { inputs: { mode: 'distance', v: 110, t: 4.25 }, expect: { result: '467.5 km', detail: '290.49 miles' } },
    ],
  },
  {
    slug: 'relative-velocity-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Kinematics',
    title: 'Relative Velocity Calculator: Overtaking and Closing Speed',
    h1: 'Relative Velocity Calculator',
    metaDescription:
      'Work out the relative speed of two vehicles moving in the same or opposite directions and how long until one catches up with or meets the other.',
    about:
      'How fast two moving things approach each other depends on the direction they travel. When they move the same way, the gap closes at the difference of their speeds; when they move toward each other, the speeds add. Enter two speeds, choose same or opposite direction and the distance between them to see the relative speed and how long until the faster one overtakes the slower one, or the two meet. Equal speeds in the same direction never close the gap.',
    inputs: [
      pos('v1', 'Speed of object 1 (km/h)', 90, 1e7),
      pos('v2', 'Speed of object 2 (km/h)', 60, 1e7),
      sel('dir', 'Directions', 'same', [
        ['same', 'Same direction (1 catches 2)'],
        ['opposite', 'Toward each other'],
      ]),
      pos('gap', 'Distance between them (km)', 30, 1e9),
    ],
    outputs: [out('rel', 'Relative speed', true), out('ms', 'In metres per second'), out('time', 'Time until they meet or pass')],
    calculate: (i) => {
      const v1 = toD(i.v1);
      const v2 = toD(i.v2);
      const rel = String(i.dir) === 'same' ? v1.minus(v2).abs() : v1.plus(v2);
      return { rel: u(rel, 2, 'km/h'), ms: u(rel.div('3.6'), 2, 'm/s'), time: rel.isZero() ? 'Never (equal speeds)' : hm(toD(i.gap).div(rel)) };
    },
    formulaDescription:
      'Same direction: v_rel = |v₁ − v₂|. Opposite directions: v_rel = v₁ + v₂. Time to meet = gap ÷ v_rel. Straight-line motion at constant speeds; in the same-direction case the faster object starts behind.',
    formulaLatex: 'v_{rel} = |v_{1} \\mp v_{2}|',
    workedExample: 'A car at 90 km/h chasing a lorry at 60 km/h, 30 km ahead: the gap closes at 30 km/h (8.33 m/s), so it takes 1 hour to catch up.',
    faq: [
      {
        question: 'Why do speeds add head on?',
        answer: 'Each object closes part of the gap, so the distance between them shrinks at the sum of their speeds.',
      },
      { question: 'What if the faster object is ahead?', answer: 'Then the gap grows and they never meet; this page assumes the faster one starts behind.' },
      {
        question: 'Does it work for boats and rivers?',
        answer: "The same idea applies: a boat's speed over the ground is its speed in the water plus or minus the current.",
      },
    ],
    scenarios: varied(
      'relative-velocity-calculator',
      12,
      [
        { name: 'v1', lo: 20, hi: 150, step: 5 },
        { name: 'v2', lo: 10, hi: 120, step: 5 },
        { name: 'gap', lo: 1, hi: 300, step: 1 },
      ],
      [{ name: 'dir', options: ['same', 'opposite'] }],
      (v) => `${v.v1} and ${v.v2} km/h, ${v.dir}, ${v.gap} km`,
    ),
    introOutputs: ['rel', 'time'],
    relatedSlugs: ['speed-distance-time-calculator', 'average-speed-calculator', 'elastic-collision-calculator'],
    checks: [
      { inputs: {}, expect: { rel: '30 km/h', ms: '8.33 m/s', time: '1 h 0 min' } },
      { inputs: { v1: 60, v2: 80, dir: 'opposite', gap: 140 }, expect: { rel: '140 km/h', ms: '38.89 m/s', time: '1 h 0 min' } },
      { inputs: { v1: 50, v2: 50 }, expect: { rel: '0 km/h', time: 'Never (equal speeds)' } },
    ],
  },
  {
    slug: 'impulse-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: 'Impulse Calculator: Force, Contact Time and Velocity Change',
    h1: 'Impulse Calculator',
    metaDescription:
      'Calculate the impulse of a force acting for a short time, the resulting change in velocity of a mass, and the kinetic energy it gains from rest.',
    about:
      "An impulse is a force applied for a length of time, and it equals the change in momentum it causes. A footballer's boot, a bat on a ball and a seat belt during a crash are all impulses: a larger force or a longer contact time gives a bigger change in motion. Enter the force in newtons, the contact time in milliseconds and the mass to get the impulse, the speed change and the kinetic energy the mass gains starting from rest.",
    inputs: [pos('F', 'Average force (N)', 600, 1e9), pos('t', 'Contact time (ms)', 15, 1e9), pos('m', 'Mass (kg)', 0.45, 1e9)],
    outputs: [out('j', 'Impulse', true), out('dv', 'Change in velocity'), out('ke', 'Kinetic energy gained from rest')],
    calculate: (i) => {
      const j = toD(i.F).mul(toD(i.t)).div(1000);
      const dv = j.div(toD(i.m));
      return { j: u(j, 3, 'N·s'), dv: u(dv, 2, 'm/s'), ke: u(toD(i.m).mul(dv.pow(2)).div(2), 2, 'J') };
    },
    formulaDescription: 'J = F Δt = Δp = m Δv, so Δv = F Δt ÷ m, and E = ½ m Δv² when starting from rest. The force is the average over the contact time.',
    formulaLatex: 'J = F\\,\\Delta t = m\\,\\Delta v',
    workedExample: 'A 600 N average force acting for 15 ms on a 0.45 kg ball: J = 600 × 0.015 = 9 N·s, so Δv = 9 ÷ 0.45 = 20 m/s and the ball gains 90 J.',
    faq: [
      { question: 'Why do airbags help?', answer: 'They lengthen the stopping time, so the same change in momentum needs a smaller average force.' },
      { question: 'What is the unit of impulse?', answer: 'Newton seconds, which are the same as kilogram metres per second, the unit of momentum.' },
      { question: 'Is the force constant?', answer: 'Usually not; the page uses its average. The exact impulse is the area under the force-time curve.' },
    ],
    scenarios: mixed(
      'impulse-calculator',
      12,
      (r) => ({ F: r(20, 9000), t: r(1, 300), m: r(0.02, 90) }),
      (v) => `${v.F} N for ${v.t} ms on ${v.m} kg`,
    ),
    introOutputs: ['j', 'dv'],
    relatedSlugs: ['momentum-calculator', 'force-calculator', 'elastic-collision-calculator'],
    checks: [
      { inputs: {}, expect: { j: '9 N·s', dv: '20 m/s', ke: '90 J' } },
      { inputs: { F: 2000, t: 5, m: 0.058 }, expect: { j: '10 N·s', dv: '172.41 m/s' } },
      { inputs: { F: 50, t: 200, m: 70 }, expect: { j: '10 N·s', dv: '0.14 m/s', ke: '0.71 J' } },
    ],
  },
  {
    slug: 'center-of-mass-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: 'Center of Mass Calculator: Three Masses on a Line',
    h1: 'Center of Mass Calculator',
    metaDescription: 'Find the center of mass of up to three point masses placed along a line from their masses and positions, with the total mass.',
    about:
      'Hang a plank from a single point and it stays level only when that point sits exactly under its balance point, the center of mass. Put a heavy barbell plate near one end and the balance point slides toward it. Type up to three loads with their positions along a straight beam (negative means left of the pivot origin) and the page returns where the fulcrum must go to keep the beam level, plus the combined load. Leave the third load at zero to balance just two, like a seesaw with two riders.',
    inputs: [
      pos('m1', 'Mass 1 (kg)', 2, 1e9),
      real('x1', 'Position 1 (m)', 0),
      pos('m2', 'Mass 2 (kg)', 3, 1e9),
      real('x2', 'Position 2 (m)', 4),
      field('m3', 'Mass 3 (kg, 0 to skip)', 5, 0, 1e9),
      real('x3', 'Position 3 (m)', 10),
    ],
    outputs: [out('x', 'Center of mass', true), out('m', 'Total mass')],
    calculate: (i) => {
      const m1 = toD(i.m1);
      const m2 = toD(i.m2);
      const m3 = toD(i.m3);
      const tot = m1.plus(m2).plus(m3);
      return {
        x: u(
          m1
            .mul(toD(i.x1))
            .plus(m2.mul(toD(i.x2)))
            .plus(m3.mul(toD(i.x3)))
            .div(tot),
          3,
          'm',
        ),
        m: u(tot, 3, 'kg'),
      };
    },
    formulaDescription: 'x_cm = (m₁x₁ + m₂x₂ + m₃x₃) ÷ (m₁ + m₂ + m₃), points on a straight line. The result always lies between the outermost masses.',
    formulaLatex: 'x_{cm} = \\dfrac{\\sum m_{i}x_{i}}{\\sum m_{i}}',
    workedExample: '2 kg at 0 m, 3 kg at 4 m and 5 kg at 10 m: x = (0 + 12 + 50) ÷ 10 = 6.2 m, for a total mass of 10 kg.',
    faq: [
      {
        question: 'Is it the same as the center of gravity?',
        answer: 'In a uniform gravitational field, yes. They differ only for very large objects in a changing field.',
      },
      { question: 'Can it lie outside the objects?', answer: 'Yes, for a ring or a boomerang; with point masses on a line it lies between the outer two.' },
      { question: 'What about two dimensions?', answer: 'Do the same average for the x and y coordinates separately.' },
    ],
    scenarios: mixed(
      'center-of-mass-calculator',
      12,
      (r) => ({ m1: r(12, 980), x1: r(-300, 900), m2: r(12, 980), x2: r(-300, 900), m3: r(12, 980), x3: r(-300, 900) }),
      (v) => `loads ${v.m1}, ${v.m2}, ${v.m3} placed ${v.x1}, ${v.x2}, ${v.x3}`,
    ),
    introOutputs: ['x'],
    relatedSlugs: ['lever-calculator', 'torque-calculator', 'momentum-calculator'],
    checks: [
      { inputs: {}, expect: { x: '6.2 m', m: '10 kg' } },
      { inputs: { m1: 1, x1: 0, m2: 1, x2: 10, m3: 0, x3: 3 }, expect: { x: '5 m', m: '2 kg' } },
      { inputs: { m1: 5, x1: -2, m2: 2, x2: 3, m3: 3, x3: 8 }, expect: { x: '2 m' } },
    ],
  },
  {
    slug: 'terminal-velocity-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: 'Terminal Velocity Calculator: Falling Through Air',
    h1: 'Terminal Velocity Calculator',
    metaDescription:
      'Estimate the terminal velocity of a falling object from its mass, frontal area, drag coefficient and the air density at sea level or altitude.',
    about:
      'A falling object speeds up until the drag from the air equals its weight, and then it stops accelerating. That steady top speed is the terminal velocity. It is higher for heavy, compact objects and lower in dense air or for large areas, which is why a parachute works. Enter the mass, the frontal area, the drag coefficient and the air density to estimate it in metres per second, kilometres per hour and miles per hour. A belly-down skydiver reaches roughly 150 km/h.',
    inputs: [
      pos('m', 'Mass (kg)', 80, 1e9),
      pos('A', 'Frontal area (m²)', 0.7, 1e6),
      pos('cd', 'Drag coefficient', 1, 10),
      sel('air', 'Air density', 'sea', AIR_OPTIONS),
    ],
    outputs: [out('ms', 'Terminal velocity', true), out('kmh', 'In kilometres per hour'), out('mph', 'In miles per hour')],
    calculate: (i) => {
      const rho = new D(AIR[String(i.air)] ?? '1.225');
      const v = toD(i.m)
        .mul(G)
        .mul(2)
        .div(rho.mul(toD(i.cd)).mul(toD(i.A)))
        .sqrt();
      return { ms: u(v, 2, 'm/s'), kmh: u(v.mul('3.6'), 1, 'km/h'), mph: u(v.div('0.44704'), 1, 'mph') };
    },
    formulaDescription:
      'v_t = √(2 m g ÷ (ρ C_d A)). At this speed the drag force ½ ρ C_d A v² equals the weight m g. Quadratic drag, constant density, steady fall.',
    formulaLatex: 'v_t = \\sqrt{\\dfrac{2mg}{\\rho C_d A}}',
    workedExample: 'An 80 kg skydiver, 0.7 m² and C_d = 1.0 in air of 1.225 kg/m³: v = √(1569.06 ÷ 0.8575) = 42.78 m/s, which is 154 km/h.',
    faq: [
      {
        question: 'Why do parachutes slow you down?',
        answer: 'They multiply the area and the drag coefficient, so the weight is balanced by drag at a much lower speed.',
      },
      {
        question: 'Does a heavier object fall faster?',
        answer: 'In air, yes, up to its own terminal velocity: more mass needs more drag to balance, which means more speed.',
      },
      {
        question: 'What drag coefficient should I use?',
        answer: 'About 1.0 for a person face down, 0.5 for a sphere and 1.3 or more for a flat plate; streamlined shapes are far lower.',
      },
    ],
    scenarios: varied(
      'terminal-velocity-calculator',
      12,
      [
        { name: 'm', lo: 0.5, hi: 160, step: 0.5 },
        { name: 'A', lo: 0.05, hi: 1.6, step: 0.05 },
        { name: 'cd', lo: 0.3, hi: 1.4, step: 0.05 },
      ],
      [{ name: 'air', options: ['sea', 'alt3', 'alt5', 'alt10'] }],
      (v) => `${v.m} kg, ${v.A} m², cd ${v.cd}, ${v.air}`,
    ),
    introOutputs: ['ms'],
    relatedSlugs: ['drag-force-calculator', 'free-fall-calculator', 'weight-calculator'],
    checks: [
      { inputs: {}, expect: { ms: '42.78 m/s', kmh: '154 km/h', mph: '95.7 mph' } },
      { inputs: { m: 0.0033, A: 0.0003, cd: 0.5 }, expect: { ms: '18.77 m/s' } },
      { inputs: { air: 'alt5', m: 90, A: 0.1, cd: 0.7 }, expect: { ms: '185.1 m/s', kmh: '666.4 km/h', mph: '414.1 mph' } },
    ],
  },
  {
    slug: 'drag-force-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: 'Drag Force Calculator: Air Resistance and Power',
    h1: 'Drag Force Calculator',
    metaDescription:
      'Calculate the aerodynamic drag on a vehicle or object from speed, frontal area, drag coefficient and air density, with the power needed to overcome it.',
    about:
      'Air resistance grows with the square of the speed, so doubling the speed quadruples the drag and multiplies the power needed to hold it eightfold. That is why a car at motorway speed uses so much more fuel than in town. Enter the speed, the frontal area, the drag coefficient of the shape and the air density to see the drag force in newtons and the power the engine must deliver, in kilowatts and mechanical horsepower, just to push through the air.',
    inputs: [
      pos('kmh', 'Speed (km/h)', 100, 5000),
      pos('A', 'Frontal area (m²)', 2.2, 1e6),
      pos('cd', 'Drag coefficient', 0.3, 10),
      sel('air', 'Air density', 'sea', AIR_OPTIONS),
    ],
    outputs: [out('f', 'Drag force', true), out('kw', 'Power to overcome it'), out('hp', 'In horsepower')],
    calculate: (i) => {
      const v = toD(i.kmh).div('3.6');
      const f = new D(AIR[String(i.air)] ?? '1.225').mul(toD(i.cd)).mul(toD(i.A)).mul(v.pow(2)).div(2);
      return { f: u(f, 1, 'N'), kw: u(f.mul(v).div(1000), 2, 'kW'), hp: u(f.mul(v).div(HP), 2, 'hp') };
    },
    formulaDescription:
      'F_d = ½ ρ C_d A v² and the power is P = F_d × v. Horsepower is mechanical (745.69987 W). Rolling resistance and drivetrain losses are not included.',
    formulaLatex: 'F_d = \\tfrac{1}{2}\\rho C_d A v^{2}',
    workedExample:
      'A car with C_d 0.30 and 2.2 m² at 100 km/h (27.78 m/s) in sea-level air: F = ½ × 1.225 × 0.30 × 2.2 × 771.6 = 311.9 N. Overcoming it takes 8.66 kW, or 11.62 hp.',
    faq: [
      {
        question: 'Why does speed matter so much?',
        answer: 'Drag goes with the square of the speed and the power with its cube, so a modest speed increase costs a lot of energy.',
      },
      {
        question: 'What is a typical drag coefficient?',
        answer: 'About 0.25 to 0.35 for a modern car, 0.7 to 1.0 for a cyclist, and over 1 for a bluff shape such as a truck.',
      },
      { question: 'Does a headwind count?', answer: 'Yes. Use the speed relative to the air, which is your speed plus the headwind.' },
    ],
    scenarios: varied(
      'drag-force-calculator',
      12,
      [
        { name: 'kmh', lo: 10, hi: 280, step: 5 },
        { name: 'A', lo: 0.4, hi: 8, step: 0.1 },
        { name: 'cd', lo: 0.2, hi: 1.2, step: 0.05 },
      ],
      [{ name: 'air', options: ['sea', 'alt3', 'alt5', 'alt10'] }],
      (v) => `${v.kmh} km/h, ${v.A} m², cd ${v.cd}, ${v.air}`,
    ),
    introOutputs: ['f', 'kw'],
    relatedSlugs: ['terminal-velocity-calculator', 'friction-force-calculator', 'power-calculator'],
    checks: [
      { inputs: {}, expect: { f: '311.9 N', kw: '8.66 kW', hp: '11.62 hp' } },
      { inputs: { kmh: 50, A: 2.5, cd: 0.35 }, expect: { f: '103.4 N', kw: '1.44 kW' } },
      { inputs: { kmh: 200, air: 'alt3' }, expect: { f: '925.8 N', kw: '51.44 kW', hp: '68.98 hp' } },
    ],
  },
  {
    slug: 'moment-of-inertia-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Rotation',
    title: 'Moment of Inertia Calculator: Common Shapes',
    h1: 'Moment of Inertia Calculator',
    metaDescription: 'Calculate the moment of inertia of a solid cylinder, hoop, sphere, spherical shell or a rod about its centre or end from mass and size.',
    about:
      'The moment of inertia is the rotational counterpart of mass: it tells you how hard it is to change how fast something spins. It depends on both the mass and how far that mass sits from the axis, so a hoop is harder to spin than a solid disc of the same mass and size. Choose a standard shape, enter the mass and the radius, or the length for a rod, and read the moment of inertia in kilogram square metres along with the formula used.',
    inputs: [
      sel('shape', 'Shape and axis', 'cylinder', [
        ['cylinder', 'Solid cylinder or disc, about its axis'],
        ['hoop', 'Thin hoop or hollow cylinder'],
        ['sphere', 'Solid sphere, about a diameter'],
        ['shell', 'Hollow spherical shell'],
        ['rodc', 'Thin rod about its centre'],
        ['rode', 'Thin rod about one end'],
      ]),
      pos('m', 'Mass (kg)', 10, 1e9),
      pos('s', 'Radius or rod length (m)', 0.5, 1e6),
    ],
    outputs: [out('i', 'Moment of inertia', true), out('f', 'Formula used')],
    calculate: (i) => {
      const shape = SHAPES[String(i.shape)] ?? SHAPES.cylinder;
      return { i: u(shape.k.mul(toD(i.m)).mul(toD(i.s).pow(2)), 4, 'kg·m²'), f: shape.text };
    },
    formulaDescription:
      'I = k m s² with k = ½ (solid cylinder), 1 (hoop), ⅖ (solid sphere), ⅔ (hollow sphere), 1/12 (rod about centre) or ⅓ (rod about an end). s is the radius, or the rod length L.',
    formulaLatex: 'I = k\\,m\\,s^{2}',
    workedExample: 'A 10 kg solid cylinder of radius 0.5 m: I = ½ × 10 × 0.25 = 1.25 kg·m². As a hoop the same mass and radius would give 2.5.',
    faq: [
      {
        question: 'Why does the axis matter?',
        answer: 'The moment of inertia depends on the distances from the axis, so the same body has different values about different axes.',
      },
      {
        question: 'What is the parallel axis theorem?',
        answer: 'I about any axis equals I about a parallel axis through the centre plus m d², where d is the distance between them.',
      },
      {
        question: 'Which shape is easiest to spin?',
        answer: 'For equal mass and radius, the solid sphere (⅖) and the solid cylinder (½) beat the hoop (1) because their mass lies closer to the axis.',
      },
    ],
    scenarios: varied(
      'moment-of-inertia-calculator',
      12,
      [
        { name: 'm', lo: 0.1, hi: 400, step: 0.1 },
        { name: 's', lo: 0.05, hi: 3, step: 0.05 },
      ],
      [{ name: 'shape', options: ['cylinder', 'hoop', 'sphere', 'shell', 'rodc', 'rode'] }],
      (v) => `${v.shape}, ${v.m} kg, size ${v.s} m`,
    ),
    introOutputs: ['i'],
    relatedSlugs: ['rotational-kinetic-energy-calculator', 'torque-calculator', 'angular-velocity-calculator'],
    checks: [
      { inputs: {}, expect: { i: '1.25 kg·m²', f: '½ m r²' } },
      { inputs: { shape: 'sphere', m: 6, s: 0.2 }, expect: { i: '0.096 kg·m²', f: '⅖ m r²' } },
      { inputs: { shape: 'rodc', m: 2, s: 1.5 }, expect: { i: '0.375 kg·m²', f: '1/12 m L²' } },
      { inputs: { shape: 'rode', m: 2, s: 1.5 }, expect: { i: '1.5 kg·m²' } },
    ],
  },
  {
    slug: 'angular-velocity-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Rotation',
    title: 'Angular Velocity Calculator: RPM to rad/s and Rim Speed',
    h1: 'Angular Velocity Calculator',
    metaDescription:
      'Convert revolutions per minute to angular velocity in radians per second and frequency in hertz, and find the speed of a point on the rim at a given radius.',
    about:
      'Angular velocity measures how fast something spins, in radians per second, where one full turn is two pi radians. Engines, discs and wheels are usually rated in revolutions per minute, so the first job is converting. Enter the rotational speed and the radius of a point on the wheel to get the angular velocity, the frequency in hertz and the straight-line speed of that point on the rim, which grows in proportion to the radius.',
    inputs: [pos('rpm', 'Rotational speed (rpm)', 3000, 1e9), pos('r', 'Radius of the point (cm)', 15, 1e7)],
    outputs: [out('w', 'Angular velocity', true), out('hz', 'Frequency'), out('v', 'Speed of the rim')],
    calculate: (i) => {
      const w = toD(i.rpm).mul(PI).mul(2).div(60);
      return { w: u(w, 2, 'rad/s'), hz: u(toD(i.rpm).div(60), 3, 'Hz'), v: u(w.mul(toD(i.r).div(100)), 2, 'm/s') };
    },
    formulaDescription: 'ω = 2π × rpm ÷ 60, f = rpm ÷ 60 and the rim speed is v = ω r.',
    formulaLatex: '\\omega = \\dfrac{2\\pi \\cdot rpm}{60}, \\quad v = \\omega r',
    workedExample: '3,000 rpm: ω = 314.16 rad/s and f = 50 Hz. At a 15 cm radius the rim moves at 47.12 m/s.',
    faq: [
      { question: 'How many radians in a turn?', answer: 'Two pi, about 6.2832. So one revolution per second is 6.2832 rad/s.' },
      {
        question: 'Why does the rim move faster than the centre?',
        answer: 'All points turn at the same angular velocity, but farther points cover a larger circle in the same time.',
      },
      { question: 'What is a record at 33⅓ rpm?', answer: '3.49 rad/s, a frequency of 0.556 Hz.' },
    ],
    scenarios: mixed(
      'angular-velocity-calculator',
      12,
      (r) => ({ rpm: Math.round(r(10, 12000)), r: r(1, 80) }),
      (v) => `${v.rpm} rpm at radius ${v.r} cm`,
    ),
    introOutputs: ['w', 'v'],
    relatedSlugs: ['rotational-kinetic-energy-calculator', 'frequency-period-calculator', 'centripetal-force-calculator'],
    checks: [
      { inputs: {}, expect: { w: '314.16 rad/s', hz: '50 Hz', v: '47.12 m/s' } },
      { inputs: { rpm: 33.3333, r: 15 }, expect: { w: '3.49 rad/s', hz: '0.556 Hz' } },
      { inputs: { rpm: 7200, r: 4.5 }, expect: { w: '753.98 rad/s', hz: '120 Hz', v: '33.93 m/s' } },
    ],
  },
  {
    slug: 'rotational-kinetic-energy-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Rotation',
    title: 'Rotational Kinetic Energy Calculator: Flywheels',
    h1: 'Rotational Kinetic Energy Calculator',
    metaDescription:
      'Calculate the kinetic energy stored in a spinning flywheel or wheel from its moment of inertia and rotational speed, in joules, kilojoules and watt-hours.',
    about:
      "A spinning object stores kinetic energy that depends on how its mass is distributed and on the square of its rotational speed. Flywheels use this to smooth an engine's output or to store energy for later. Enter the moment of inertia and the speed in revolutions per minute to get the stored energy in joules, kilojoules and watt-hours. Doubling the speed quadruples the energy, so a fast flywheel can hold a surprising amount.",
    inputs: [pos('I', 'Moment of inertia (kg·m²)', 1.25, 1e9), pos('rpm', 'Rotational speed (rpm)', 3000, 1e9)],
    outputs: [out('j', 'Rotational energy', true), out('kj', 'In kilojoules'), out('wh', 'In watt-hours')],
    calculate: (i) => {
      const w = toD(i.rpm).mul(PI).mul(2).div(60);
      const e = toD(i.I).mul(w.pow(2)).div(2);
      return { j: u(e, 1, 'J'), kj: u(e.div(1000), 2, 'kJ'), wh: u(e.div(3600), 2, 'Wh') };
    },
    formulaDescription: 'E = ½ I ω², with ω = 2π × rpm ÷ 60 in radians per second and I the moment of inertia about the axis of rotation.',
    formulaLatex: 'E = \\tfrac{1}{2}I\\omega^{2}',
    workedExample: 'I = 1.25 kg·m² at 3,000 rpm (ω = 314.16 rad/s): E = ½ × 1.25 × 98,696 = 61,685 J, which is 61.69 kJ or 17.13 Wh.',
    faq: [
      {
        question: 'How does a flywheel store energy?',
        answer: 'Speeding it up puts energy in; slowing it down takes it back out, with the amount set by I and ω².',
      },
      { question: 'Where do I find I?', answer: "Use the moment of inertia calculator for a standard shape, or the manufacturer's figure for a real part." },
      {
        question: 'Does a rolling wheel have both kinds?',
        answer: 'Yes: translational energy from moving along and rotational energy from spinning, and the total is their sum.',
      },
    ],
    scenarios: mixed(
      'rotational-kinetic-energy-calculator',
      12,
      (r) => ({ I: r(0.005, 300), rpm: Math.round(r(60, 20000)) }),
      (v) => `I ${v.I} kg·m² at ${v.rpm} rpm`,
    ),
    introOutputs: ['j', 'wh'],
    relatedSlugs: ['moment-of-inertia-calculator', 'kinetic-energy-calculator', 'angular-velocity-calculator'],
    checks: [
      { inputs: {}, expect: { j: '61,685 J', kj: '61.69 kJ', wh: '17.13 Wh' } },
      { inputs: { I: 0.02, rpm: 10000 }, expect: { j: '10,966.2 J', wh: '3.05 Wh' } },
      { inputs: { I: 200, rpm: 600 }, expect: { j: '394,784.2 J', kj: '394.78 kJ', wh: '109.66 Wh' } },
    ],
  },
  {
    slug: 'gear-ratio-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Machines',
    title: 'Gear Ratio Calculator: Speed and Torque',
    h1: 'Gear Ratio Calculator',
    metaDescription:
      'Calculate a gear ratio from the tooth counts of the driver and driven gears, with the output speed in rpm and the output torque including efficiency.',
    about:
      'A pair of meshing gears trades speed for turning force. The gear ratio is the number of teeth on the driven gear divided by the number on the driver. A ratio above one slows the output down and multiplies the torque; below one it speeds it up and cuts the torque. Enter the two tooth counts, the input speed and torque and the efficiency of the mesh to get the ratio, the output speed in rpm and the output torque in newton metres.',
    inputs: [
      pos('a', 'Driver gear teeth', 20, 10000),
      pos('b', 'Driven gear teeth', 60, 10000),
      pos('rpm', 'Input speed (rpm)', 1500, 1e9),
      pos('T', 'Input torque (N·m)', 10, 1e9),
      field('eff', 'Efficiency (%)', 95, 1, 100),
    ],
    outputs: [out('ratio', 'Gear ratio', true), out('rpm', 'Output speed'), out('tq', 'Output torque')],
    calculate: (i) => {
      const r = toD(i.b).div(toD(i.a));
      return { ratio: u(r, 3, ': 1'), rpm: u(toD(i.rpm).div(r), 1, 'rpm'), tq: u(toD(i.T).mul(r).mul(toD(i.eff)).div(100), 2, 'N·m') };
    },
    formulaDescription:
      'Ratio = driven teeth ÷ driver teeth. Output speed = input speed ÷ ratio. Output torque = input torque × ratio × efficiency. A single pair of external gears reverses the direction of rotation.',
    formulaLatex: 'i = \\dfrac{N_{driven}}{N_{driver}}',
    workedExample:
      'A 20-tooth driver turning a 60-tooth gear has a ratio of 3 : 1. At 1,500 rpm in, the output turns at 500 rpm; 10 N·m in becomes 28.5 N·m at 95% efficiency.',
    faq: [
      { question: 'What does a 3 : 1 ratio mean?', answer: 'The driver turns three times for every one turn of the driven gear.' },
      {
        question: 'Why does torque rise as speed falls?',
        answer: 'Power is torque times speed and is conserved apart from losses, so slowing the output raises its torque.',
      },
      { question: 'How do I chain several gear pairs?', answer: 'Multiply the individual ratios to get the overall ratio.' },
    ],
    scenarios: mixed(
      'gear-ratio-calculator',
      12,
      (r) => ({ a: Math.round(r(8, 60)), b: Math.round(r(8, 140)), rpm: Math.round(r(50, 6000)), T: r(1, 200), eff: Math.round(r(70, 99)) }),
      (v) => `${v.a} to ${v.b} teeth, ${v.rpm} rpm, ${v.T} N·m`,
    ),
    introOutputs: ['ratio', 'tq'],
    relatedSlugs: ['torque-calculator', 'engine-power-calculator', 'angular-velocity-calculator'],
    checks: [
      { inputs: {}, expect: { ratio: '3 : 1', rpm: '500 rpm', tq: '28.5 N·m' } },
      { inputs: { a: 60, b: 20, rpm: 300, T: 90, eff: 100 }, expect: { ratio: '0.333 : 1', rpm: '900 rpm', tq: '30 N·m' } },
      { inputs: { a: 15, b: 45, rpm: 3000, T: 4, eff: 80 }, expect: { ratio: '3 : 1', tq: '9.6 N·m' } },
    ],
  },
  {
    slug: 'lever-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Machines',
    title: 'Lever Calculator: Effort Force and Mechanical Advantage',
    h1: 'Lever Calculator',
    metaDescription:
      'Find the effort force needed to balance a load on a lever from the load and the two arm lengths, with the mechanical advantage and distance moved.',
    about:
      'A lever balances when the load times its distance from the pivot equals the effort times its distance from the pivot. A long effort arm lets a small push lift a heavy load, at the price of moving the effort a longer distance. Enter the load, the length of the load arm and the length of the effort arm, measured from the pivot, to get the effort needed, the mechanical advantage and how far the effort must travel for each centimetre of lift.',
    inputs: [pos('load', 'Load (N)', 500, 1e9), pos('la', 'Load arm (m)', 0.2, 1e4), pos('ea', 'Effort arm (m)', 1, 1e4)],
    outputs: [out('effort', 'Effort force needed', true), out('ma', 'Mechanical advantage'), out('travel', 'Effort travel per 1 cm of lift')],
    calculate: (i) => {
      const ma = toD(i.ea).div(toD(i.la));
      return { effort: u(toD(i.load).div(ma), 2, 'N'), ma: fmtNumber(ma, 3), travel: u(ma, 2, 'cm') };
    },
    formulaDescription:
      'Load × load arm = effort × effort arm, so effort = load × load arm ÷ effort arm. Mechanical advantage = effort arm ÷ load arm. Ideal lever, no friction, in balance.',
    formulaLatex: 'F_e \\, d_e = F_l \\, d_l',
    workedExample:
      'A 500 N load 0.2 m from the pivot and an effort applied 1 m from it: effort = 500 × 0.2 ÷ 1 = 100 N, a mechanical advantage of 5, with the effort moving 5 cm for each 1 cm of lift.',
    faq: [
      {
        question: 'Does a lever save work?',
        answer: 'No. It trades force for distance: you push less hard but over a longer distance, so the work is the same.',
      },
      {
        question: 'What are the three classes?',
        answer: 'They differ in where the pivot, load and effort sit: a seesaw, a wheelbarrow and a pair of tweezers are one of each.',
      },
      { question: 'Why use a longer bar?', answer: 'A longer effort arm raises the mechanical advantage, so the same push lifts or turns a larger load.' },
    ],
    scenarios: mixed(
      'lever-calculator',
      12,
      (r) => ({ load: r(10, 5000), la: r(0.05, 1.5), ea: r(0.2, 4) }),
      (v) => `${v.load} N, arms ${v.la} and ${v.ea} m`,
    ),
    introOutputs: ['effort', 'ma'],
    relatedSlugs: ['torque-calculator', 'pulley-system-calculator', 'center-of-mass-calculator'],
    checks: [
      { inputs: {}, expect: { effort: '100 N', ma: '5', travel: '5 cm' } },
      { inputs: { load: 1200, la: 0.1, ea: 0.6 }, expect: { effort: '200 N', ma: '6', travel: '6 cm' } },
      { inputs: { load: 80, la: 1.5, ea: 0.5 }, expect: { effort: '240 N', ma: '0.333' } },
    ],
  },
  {
    slug: 'efficiency-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Machines',
    title: 'Efficiency Calculator: Useful Output Over Input',
    h1: 'Efficiency Calculator',
    metaDescription:
      'Calculate the efficiency of a machine or process from its energy input and useful output, with the energy wasted and the input needed per 100 J of useful work.',
    about:
      'Efficiency is the share of the energy put into a machine that comes out as something useful. A filament bulb wastes most of its input as heat, a good electric motor wastes only a little. Enter the energy supplied and the useful energy delivered, in the same unit, to get the efficiency as a percentage, the energy lost and how much input you must supply for every 100 joules of useful output. Efficiency can never exceed 100 percent.',
    inputs: [pos('ein', 'Energy input (J)', 1000, 1e15), field('eout', 'Useful energy output (J)', 650, 0, 1e15)],
    outputs: [out('eff', 'Efficiency', true), out('waste', 'Energy wasted'), out('need', 'Input needed per 100 J of output')],
    calculate: (i) => {
      const ein = toD(i.ein);
      const eout = toD(i.eout);
      if (eout.gt(ein)) return { eff: 'Useful output cannot exceed the input', waste: '', need: '' };
      const eff = eout.div(ein).mul(100);
      return { eff: `${fmtNumber(eff, 2)}%`, waste: u(ein.minus(eout), 2, 'J'), need: eff.isZero() ? 'No useful output' : u(new D(10000).div(eff), 2, 'J') };
    },
    formulaDescription: 'Efficiency = useful output ÷ total input × 100%. Energy wasted = input − output. The same ratio works for power if both are in watts.',
    formulaLatex: '\\eta = \\dfrac{E_{out}}{E_{in}} \\times 100\\%',
    workedExample: '1,000 J in and 650 J of useful work out: efficiency 65%, 350 J wasted, and 153.85 J of input are needed for every 100 J of useful output.',
    faq: [
      { question: 'Where does the wasted energy go?', answer: 'Mostly into heat from friction and electrical resistance, spread into the surroundings.' },
      {
        question: 'Can efficiency exceed 100 percent?',
        answer: 'No, that would create energy. Heat pumps quote a coefficient of performance above 1, which is a different measure.',
      },
      { question: 'What is a typical value?', answer: 'Petrol engines about 25 to 35 percent, electric motors 85 to 95, LED lamps about 40 as light.' },
    ],
    scenarios: mixed(
      'efficiency-calculator',
      12,
      (r) => ({ ein: r(50, 90000), eout: r(5, 40000) }),
      (v) => `${v.ein} J in, ${v.eout} J useful`,
    ),
    introOutputs: ['eff', 'waste'],
    relatedSlugs: ['carnot-efficiency-calculator', 'power-calculator', 'work-calculator'],
    checks: [
      { inputs: {}, expect: { eff: '65%', waste: '350 J', need: '153.85 J' } },
      { inputs: { ein: 500, eout: 500 }, expect: { eff: '100%', waste: '0 J', need: '100 J' } },
      { inputs: { ein: 100, eout: 130 }, expect: { eff: 'Useful output cannot exceed the input' } },
    ],
  },
  {
    slug: 'engine-power-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Machines',
    title: 'Engine Power Calculator: Torque and RPM to kW and hp',
    h1: 'Engine Power Calculator',
    metaDescription: 'Convert engine torque and speed in rpm into power in kilowatts, mechanical horsepower and metric horsepower.',
    about:
      "An engine's power is its torque multiplied by how fast it turns. That is why an engine can quote a high torque at low revs and a high power at higher revs: power is the product of the two. Enter the torque in newton metres and the engine speed in revolutions per minute to get the power in kilowatts, in mechanical horsepower (the British and American unit) and in metric horsepower, called PS or CV on many European data sheets.",
    inputs: [pos('T', 'Torque (N·m)', 250, 1e9), pos('rpm', 'Engine speed (rpm)', 4500, 1e9)],
    outputs: [out('kw', 'Power', true), out('hp', 'Mechanical horsepower'), out('ps', 'Metric horsepower')],
    calculate: (i) => {
      const p = toD(i.T).mul(toD(i.rpm)).mul(PI).mul(2).div(60);
      return { kw: u(p.div(1000), 2, 'kW'), hp: u(p.div(HP), 2, 'hp'), ps: u(p.div(PS), 2, 'PS') };
    },
    formulaDescription: 'P = τ ω with ω = 2π × rpm ÷ 60. One mechanical horsepower is 745.69987 W; one metric horsepower (PS) is 735.49875 W.',
    formulaLatex: 'P = \\tau\\,\\omega = \\dfrac{2\\pi\\,\\tau\\,\\text{rpm}}{60}',
    workedExample: '250 N·m at 4,500 rpm: ω = 471.24 rad/s, so P = 117.81 kW, which is 157.99 hp or 160.18 PS.',
    faq: [
      {
        question: 'Why do horsepower figures differ?',
        answer: 'The mechanical horsepower and the metric PS are slightly different units, about 1.4 percent apart.',
      },
      {
        question: 'Is this power at the wheels?',
        answer: 'No. It is the shaft power at the engine; transmission and tyre losses reduce what reaches the road.',
      },
      {
        question: 'Why does peak power come at higher rpm?',
        answer: 'Torque stays similar over a range of speeds, and power rises with speed until torque falls away.',
      },
    ],
    scenarios: mixed(
      'engine-power-calculator',
      12,
      (r) => ({ T: r(20, 900), rpm: Math.round(r(800, 9000)) }),
      (v) => `${v.T} N·m at ${v.rpm} rpm`,
    ),
    introOutputs: ['kw', 'hp'],
    relatedSlugs: ['torque-calculator', 'power-calculator', 'gear-ratio-calculator'],
    checks: [
      { inputs: {}, expect: { kw: '117.81 kW', hp: '157.99 hp', ps: '160.18 PS' } },
      { inputs: { T: 400, rpm: 2000 }, expect: { kw: '83.78 kW', hp: '112.35 hp', ps: '113.9 PS' } },
      { inputs: { T: 150, rpm: 6500 }, expect: { kw: '102.1 kW', hp: '136.92 hp' } },
    ],
  },
  {
    slug: 'hydrostatic-pressure-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Fluids',
    title: 'Hydrostatic Pressure Calculator: Pressure at Depth',
    h1: 'Hydrostatic Pressure Calculator',
    metaDescription:
      'Calculate the pressure of a liquid at a given depth, gauge and absolute, in kilopascals, atmospheres and psi, for water, sea water, oil or mercury.',
    about:
      'Pressure in a still liquid grows steadily with depth, because each layer carries the weight of all the liquid above it. Gauge pressure is the extra pressure from the liquid alone; absolute pressure adds the atmosphere on top. Choose a liquid and a depth to see both in kilopascals, the absolute pressure in atmospheres and the gauge pressure in pounds per square inch. Every ten metres of fresh water adds roughly one atmosphere.',
    inputs: [
      pos('h', 'Depth (m)', 10, 1e5),
      sel('fluid', 'Liquid', 'fresh', [
        ['fresh', 'Fresh water (1,000 kg/m³)'],
        ['sea', 'Sea water (1,025)'],
        ['oil', 'Olive oil (920)'],
        ['mercury', 'Mercury (13,534)'],
      ]),
    ],
    outputs: [out('gauge', 'Gauge pressure', true), out('abs', 'Absolute pressure'), out('atm', 'Absolute, in atmospheres'), out('psi', 'Gauge, in psi')],
    calculate: (i) => {
      const gauge = new D(LIQUID[String(i.fluid)] ?? '1000').mul(G).mul(toD(i.h)).div(1000);
      const abs = gauge.plus('101.325');
      return { gauge: u(gauge, 2, 'kPa'), abs: u(abs, 2, 'kPa'), atm: u(abs.div('101.325'), 3, 'atm'), psi: u(gauge.mul(1000).div(PSI), 2, 'psi') };
    },
    formulaDescription:
      'p = ρ g h (gauge). Absolute pressure adds one standard atmosphere, 101.325 kPa. 1 psi = 6,894.757 Pa. Constant density, still liquid, surface at atmospheric pressure.',
    formulaLatex: 'p = \\rho g h',
    workedExample: 'At 10 m depth in fresh water: gauge = 1,000 × 9.80665 × 10 = 98.07 kPa, absolute 199.39 kPa (1.968 atm), 14.22 psi gauge.',
    faq: [
      { question: 'Why does width not matter?', answer: 'Hydrostatic pressure depends only on depth and density, not on the shape or size of the container.' },
      {
        question: 'What is the pressure at the bottom of the ocean?',
        answer: 'At 4,000 m it is about 40.2 MPa of gauge pressure, around 400 atmospheres, using the sea-water density.',
      },
      { question: 'Why mercury for barometers?', answer: 'Its density is so high that atmospheric pressure supports a column only about 760 mm tall.' },
    ],
    scenarios: varied(
      'hydrostatic-pressure-calculator',
      12,
      [{ name: 'h', lo: 0.1, hi: 11000, step: 0.1 }],
      [{ name: 'fluid', options: ['fresh', 'sea', 'oil', 'mercury'] }],
      (v) => `${v.h} m of ${v.fluid}`,
    ),
    introOutputs: ['gauge', 'atm'],
    relatedSlugs: ['pressure-calculator', 'buoyancy-calculator', 'hydraulic-press-calculator'],
    checks: [
      { inputs: {}, expect: { gauge: '98.07 kPa', abs: '199.39 kPa', atm: '1.968 atm', psi: '14.22 psi' } },
      { inputs: { h: 4000, fluid: 'sea' }, expect: { gauge: '40,207.27 kPa', abs: '40,308.59 kPa', atm: '397.815 atm', psi: '5,831.57 psi' } },
      { inputs: { h: 0.76, fluid: 'mercury' }, expect: { gauge: '100.87 kPa', atm: '1.996 atm' } },
    ],
  },
  {
    slug: 'hydraulic-press-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Fluids',
    title: "Hydraulic Press Calculator: Pascal's Principle",
    h1: 'Hydraulic Press Calculator',
    metaDescription:
      'Calculate the output force of a hydraulic press or jack from the input force and the two piston diameters, with the force multiplication and stroke needed.',
    about:
      'In a hydraulic press, pressure applied to a trapped liquid is transmitted equally everywhere, so a small piston pushing on the fluid creates a large force on a bigger piston. The force is multiplied by the ratio of the piston areas, which is the square of the diameter ratio. Enter the input force and the two piston diameters to get the output force, the multiplication and the input stroke needed to move the large piston by one centimetre.',
    inputs: [pos('F', 'Input force (N)', 100, 1e9), pos('d1', 'Input piston diameter (cm)', 2, 1e4), pos('d2', 'Output piston diameter (cm)', 10, 1e4)],
    outputs: [out('fout', 'Output force', true), out('ma', 'Force multiplication'), out('stroke', 'Input stroke per 1 cm of output')],
    calculate: (i) => {
      const k = toD(i.d2).div(toD(i.d1)).pow(2);
      return { fout: u(toD(i.F).mul(k), 2, 'N'), ma: fmtNumber(k, 3), stroke: u(k, 2, 'cm') };
    },
    formulaDescription:
      'p = F₁ ÷ A₁ = F₂ ÷ A₂, so F₂ = F₁ × (d₂ ÷ d₁)². The fluid is incompressible and friction is ignored, so the strokes scale inversely with the forces.',
    formulaLatex: 'F_{2} = F_{1}\\left(\\dfrac{d_{2}}{d_{1}}\\right)^{2}',
    workedExample:
      'A 100 N push on a 2 cm piston driving a 10 cm piston: the area ratio is 25, so the output is 2,500 N, and the small piston must move 25 cm to raise the large one by 1 cm.',
    faq: [
      {
        question: 'Does it break energy conservation?',
        answer: 'No. The force is multiplied but the distance is divided by the same factor, so the work in and out are equal.',
      },
      {
        question: 'Why use oil rather than air?',
        answer: 'Liquids are almost incompressible, so the pressure passes on at once; air would compress and soften the response.',
      },
      { question: 'Where is this used?', answer: 'In car brakes, jacks, excavators and presses.' },
    ],
    scenarios: mixed(
      'hydraulic-press-calculator',
      12,
      (r) => ({ F: r(10, 2000), d1: r(0.5, 6), d2: r(4, 40) }),
      (v) => `${v.F} N on ${v.d1} cm, output ${v.d2} cm`,
    ),
    introOutputs: ['fout', 'ma'],
    relatedSlugs: ['pressure-calculator', 'hydrostatic-pressure-calculator', 'lever-calculator'],
    checks: [
      { inputs: {}, expect: { fout: '2,500 N', ma: '25', stroke: '25 cm' } },
      { inputs: { F: 250, d1: 3, d2: 12 }, expect: { fout: '4,000 N', ma: '16', stroke: '16 cm' } },
      { inputs: { F: 40, d1: 1.5, d2: 20 }, expect: { fout: '7,111.11 N', ma: '177.778' } },
    ],
  },
  {
    slug: 'flow-rate-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Fluids',
    title: 'Flow Rate Calculator: Pipe Diameter and Velocity',
    h1: 'Flow Rate Calculator',
    metaDescription:
      'Calculate the volume flow rate through a pipe from its inner diameter and the fluid velocity, in litres per second, litres per minute, cubic metres per hour and US gallons per minute.',
    about:
      'The volume flow rate through a pipe is the cross-sectional area times the average speed of the fluid. A wider pipe or a faster flow carries more. Enter the inner diameter of the pipe in millimetres and the average fluid velocity in metres per second to get the flow in litres per second and per minute, in cubic metres per hour, the unit used for pumps and ventilation, and in US gallons per minute, common for plumbing in the United States.',
    inputs: [pos('d', 'Inner pipe diameter (mm)', 25, 1e5), pos('v', 'Average velocity (m/s)', 2, 1e4)],
    outputs: [out('ls', 'Flow rate', true), out('lmin', 'Per minute'), out('m3h', 'Per hour'), out('gpm', 'US gallons per minute')],
    calculate: (i) => {
      const d = toD(i.d).div(1000);
      const q = PI.mul(d.pow(2)).div(4).mul(toD(i.v));
      return {
        ls: u(q.mul(1000), 3, 'L/s'),
        lmin: u(q.mul(60000), 1, 'L/min'),
        m3h: u(q.mul(3600), 3, 'm³/h'),
        gpm: u(q.mul(60000).div('3.785411784'), 2, 'US gal/min'),
      };
    },
    formulaDescription:
      'Q = A v with A = π d² ÷ 4. One US gallon is exactly 3.785411784 litres. For an incompressible fluid the flow rate is the same everywhere along a pipe, so a narrower section flows faster.',
    formulaLatex: 'Q = A\\,v = \\dfrac{\\pi d^{2}}{4}v',
    workedExample: 'A 25 mm pipe with water at 2 m/s: A = 4.909×10⁻⁴ m², Q = 9.817×10⁻⁴ m³/s = 0.982 L/s = 58.9 L/min = 3.534 m³/h = 15.56 US gal/min.',
    faq: [
      {
        question: 'Why does water speed up in a narrow section?',
        answer: 'The same volume must pass each second, so a smaller area needs a higher speed. This is the continuity equation.',
      },
      { question: 'What speed is typical in pipes?', answer: 'Around 1 to 3 m/s for water in building services; faster speeds cause noise and wear.' },
      { question: 'Is the diameter inside or outside?', answer: 'Inner diameter, because only the bore carries the flow.' },
    ],
    scenarios: mixed(
      'flow-rate-calculator',
      12,
      (r) => ({ d: r(6, 600), v: r(0.2, 6) }),
      (v) => `${v.d} mm at ${v.v} m/s`,
    ),
    introOutputs: ['ls', 'gpm'],
    relatedSlugs: ['reynolds-number-calculator', 'pressure-calculator', 'hydrostatic-pressure-calculator'],
    checks: [
      { inputs: {}, expect: { ls: '0.982 L/s', lmin: '58.9 L/min', m3h: '3.534 m³/h', gpm: '15.56 US gal/min' } },
      { inputs: { d: 100, v: 1.2 }, expect: { ls: '9.425 L/s', lmin: '565.5 L/min', m3h: '33.929 m³/h', gpm: '149.39 US gal/min' } },
      { inputs: { d: 15, v: 3 }, expect: { ls: '0.53 L/s', gpm: '8.4 US gal/min' } },
    ],
  },
  {
    slug: 'reynolds-number-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Fluids',
    title: 'Reynolds Number Calculator: Laminar or Turbulent Flow',
    h1: 'Reynolds Number Calculator',
    metaDescription:
      'Calculate the Reynolds number of flow in a pipe from velocity, diameter and the fluid, and see whether the flow is laminar, transitional or turbulent.',
    about:
      'The Reynolds number compares inertial forces with viscous forces in a flowing fluid and predicts whether the flow is smooth or chaotic. Low values mean orderly laminar layers; high values mean turbulence. For flow in a pipe the change happens roughly between 2,300 and 4,000. Choose a fluid, enter the average speed and the pipe diameter to get the dimensionless number and the regime. Thick fluids such as glycerin stay laminar at speeds where water is already turbulent.',
    inputs: [
      pos('v', 'Average velocity (m/s)', 1.5, 1e4),
      pos('d', 'Pipe diameter (mm)', 50, 1e5),
      sel('fluid', 'Fluid at 20 °C', 'water', [
        ['water', 'Water (998.2 kg/m³, 1.002 mPa·s)'],
        ['air', 'Air (1.204 kg/m³, 0.01825 mPa·s)'],
        ['oil', 'Engine oil, SAE 30 (891, 290 mPa·s)'],
        ['glycerin', 'Glycerin (1,261, 1,412 mPa·s)'],
      ]),
    ],
    outputs: [out('re', 'Reynolds number', true), out('regime', 'Flow regime')],
    calculate: (i) => {
      const f = FLUIDS[String(i.fluid)] ?? FLUIDS.water;
      const re = new D(f.rho).mul(toD(i.v)).mul(toD(i.d).div(1000)).div(new D(f.mu));
      return { re: fmtNumber(re, 0), regime: re.lt(2300) ? 'Laminar' : re.lt(4000) ? 'Transitional' : 'Turbulent' };
    },
    formulaDescription:
      'Re = ρ v D ÷ μ, with density ρ in kg/m³, velocity v in m/s, pipe diameter D in m and dynamic viscosity μ in Pa·s. Pipe-flow thresholds: laminar below 2,300, turbulent above 4,000.',
    formulaLatex: '\\mathrm{Re} = \\dfrac{\\rho v D}{\\mu}',
    workedExample: 'Water at 1.5 m/s in a 50 mm pipe: Re = 998.2 × 1.5 × 0.05 ÷ 0.001002 = 74,716, which is turbulent.',
    faq: [
      { question: 'Why does it matter?', answer: 'Turbulent flow mixes more, loses more energy to friction and needs a different formula for pressure drop.' },
      {
        question: 'Do the thresholds apply to every shape?',
        answer: 'The 2,300 and 4,000 figures are for round pipes; flow over a plate or around a sphere transitions at other values.',
      },
      {
        question: 'Why is it dimensionless?',
        answer: 'The units cancel, so the same number describes a small pipe in the lab and a large one if the ratio matches.',
      },
    ],
    scenarios: varied(
      'reynolds-number-calculator',
      12,
      [
        { name: 'v', lo: 0.01, hi: 12, step: 0.01 },
        { name: 'd', lo: 2, hi: 600, step: 1 },
      ],
      [{ name: 'fluid', options: ['water', 'air', 'oil', 'glycerin'] }],
      (v) => `${v.v} m/s, ${v.d} mm, ${v.fluid}`,
    ),
    introOutputs: ['re', 'regime'],
    relatedSlugs: ['flow-rate-calculator', 'drag-force-calculator', 'terminal-velocity-calculator'],
    checks: [
      { inputs: {}, expect: { re: '74,716', regime: 'Turbulent' } },
      { inputs: { v: 0.05, d: 10, fluid: 'glycerin' }, expect: { re: '0', regime: 'Laminar' } },
      { inputs: { v: 10, d: 300, fluid: 'air' }, expect: { re: '197,918', regime: 'Turbulent' } },
      { inputs: { v: 0.2, d: 20, fluid: 'water' }, expect: { re: '3,985', regime: 'Transitional' } },
    ],
  },
  {
    slug: 'ideal-gas-law-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Thermodynamics',
    title: 'Ideal Gas Law Calculator: Solve for P, V, n or T',
    h1: 'Ideal Gas Law Calculator',
    metaDescription:
      'Use PV = nRT to solve for the pressure, volume, amount of gas or temperature of an ideal gas, with the answer also in atmospheres, cubic metres, molecules or degrees Celsius.',
    about:
      'The ideal gas law ties together the four quantities that describe a gas: pressure, volume, amount in moles and absolute temperature. Know three and the fourth follows. Choose what to solve for and fill in the other three, with pressure in kilopascals, volume in litres, moles and temperature in kelvin. The result also appears in a second unit: atmospheres, cubic metres, number of molecules or degrees Celsius. It works well for gases that are far from condensing.',
    inputs: [
      sel('mode', 'Solve for', 'v', [
        ['v', 'Volume'],
        ['p', 'Pressure'],
        ['n', 'Amount of gas'],
        ['t', 'Temperature'],
      ]),
      pos('p', 'Pressure (kPa)', 101.325, 1e9),
      pos('v', 'Volume (L)', 22.414, 1e12),
      pos('n', 'Amount (mol)', 1, 1e12),
      pos('t', 'Temperature (K)', 273.15, 1e9),
    ],
    outputs: [out('value', 'Answer', true), out('detail', 'In other units')],
    calculate: (i) => {
      const mode = String(i.mode);
      const p = toD(i.p);
      const v = toD(i.v);
      const n = toD(i.n);
      const t = toD(i.t);
      if (mode === 'p') {
        const x = n.mul(RGAS).mul(t).div(v);
        return { value: u(x, 3, 'kPa'), detail: u(x.div('101.325'), 4, 'atm') };
      }
      if (mode === 'n') {
        const x = p.mul(v).div(RGAS.mul(t));
        return { value: u(x, 4, 'mol'), detail: `${sci(x.mul(NA))} molecules` };
      }
      if (mode === 't') {
        const x = p.mul(v).div(n.mul(RGAS));
        return { value: u(x, 2, 'K'), detail: u(x.minus('273.15'), 2, '°C') };
      }
      const x = n.mul(RGAS).mul(t).div(p);
      return { value: u(x, 3, 'L'), detail: u(x.div(1000), 5, 'm³') };
    },
    formulaDescription:
      'P V = n R T with R = 8.314462618 J/(mol·K), which is the same as kPa·L/(mol·K). Temperature must be absolute (K = °C + 273.15). The field you solve for is ignored.',
    formulaLatex: 'PV = nRT',
    workedExample:
      'One mole at 101.325 kPa and 273.15 K: V = 1 × 8.314 × 273.15 ÷ 101.325 = 22.414 L, or 0.02241 m³, the molar volume at standard temperature and pressure.',
    faq: [
      {
        question: 'Why kelvin?',
        answer: 'The law needs an absolute scale in which zero means no thermal motion; Celsius would give nonsense such as negative volumes.',
      },
      {
        question: 'When does the ideal gas model fail?',
        answer: 'At high pressure or low temperature, where molecules attract each other or take up real space, and near the boiling point.',
      },
      {
        question: "How is it linked to Avogadro's number?",
        answer: 'The amount in moles times 6.02214076×10²³ gives the number of molecules, shown when you solve for the amount.',
      },
    ],
    scenarios: varied(
      'ideal-gas-law-calculator',
      12,
      [
        { name: 'p', lo: 20, hi: 900, step: 5 },
        { name: 'v', lo: 0.5, hi: 200, step: 0.5 },
        { name: 'n', lo: 0.05, hi: 30, step: 0.05 },
        { name: 't', lo: 150, hi: 900, step: 5 },
      ],
      [{ name: 'mode', options: ['v', 'p', 'n', 't'] }],
      (v) => `solve ${v.mode}: ${v.p} kPa, ${v.v} L, ${v.n} mol, ${v.t} K`,
    ),
    introOutputs: ['value'],
    relatedSlugs: ['specific-heat-calculator', 'carnot-efficiency-calculator', 'pressure-calculator'],
    checks: [
      { inputs: {}, expect: { value: '22.414 L', detail: '0.02241 m³' } },
      { inputs: { mode: 'p', v: 10, n: 0.5, t: 300 }, expect: { value: '124.717 kPa', detail: '1.2309 atm' } },
      { inputs: { mode: 'n', p: 200, v: 5, t: 293.15 }, expect: { value: '0.4103 mol', detail: '2.471 × 10^23 molecules' } },
      { inputs: { mode: 't', p: 150, v: 20, n: 1.2 }, expect: { value: '300.68 K', detail: '27.53 °C' } },
    ],
  },
  {
    slug: 'thermal-expansion-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: 'Thermal Expansion Calculator: Change in Length',
    h1: 'Thermal Expansion Calculator',
    metaDescription:
      'Calculate how much a rod, rail, pipe or beam changes in length with temperature, from the material, original length and temperature change.',
    about:
      'Most solids expand when heated and shrink when cooled, by a small fraction of their length for each degree. Bridges carry expansion joints and railway lines are laid with gaps for this reason. Choose a material, enter the original length in metres and the temperature change, and the calculator returns the change in length in millimetres and the new length. A negative temperature change gives a shorter result. Plastic pipe moves several times more than steel.',
    inputs: [
      sel('material', 'Material', 'steel', [
        ['aluminium', 'Aluminium (23 ×10⁻⁶ /K)'],
        ['copper', 'Copper (17)'],
        ['steel', 'Steel (12)'],
        ['glass', 'Glass (9)'],
        ['concrete', 'Concrete (12)'],
        ['pvc', 'PVC (52)'],
        ['brass', 'Brass (19)'],
      ]),
      pos('L', 'Original length (m)', 10, 1e7),
      real('dT', 'Temperature change (°C or K)', 40, -500, 2000),
    ],
    outputs: [out('dl', 'Change in length', true), out('new', 'New length')],
    calculate: (i) => {
      const dl = new D(ALPHA[String(i.material)] ?? '12').mul('1e-6').mul(toD(i.L)).mul(toD(i.dT));
      return { dl: u(dl.mul(1000), 3, 'mm'), new: u(toD(i.L).plus(dl), 4, 'm') };
    },
    formulaDescription:
      'ΔL = α L ΔT, with α the linear expansion coefficient per kelvin. Valid for modest temperature changes; α varies slightly with temperature.',
    formulaLatex: '\\Delta L = \\alpha L \\,\\Delta T',
    workedExample: 'A 10 m steel beam (α = 12×10⁻⁶ per K) warmed by 40 K grows by 12×10⁻⁶ × 10 × 40 = 4.8 mm, to 10.0048 m.',
    faq: [
      { question: 'Why are gaps left in rails and bridges?', answer: 'Without room to expand, the thermal stress can buckle the rail or crack the structure.' },
      {
        question: 'Does it apply to area and volume?',
        answer: 'Approximately, with the area coefficient about 2α and the volume coefficient about 3α for solids.',
      },
      {
        question: 'Why does glass crack in a sudden heat?',
        answer: 'Different parts expand by different amounts at once, and the resulting stress exceeds the strength of the glass.',
      },
    ],
    scenarios: varied(
      'thermal-expansion-calculator',
      12,
      [
        { name: 'L', lo: 0.5, hi: 400, step: 0.5 },
        { name: 'dT', lo: -40, hi: 120, step: 1 },
      ],
      [{ name: 'material', options: ['aluminium', 'copper', 'steel', 'glass', 'concrete', 'pvc', 'brass'] }],
      (v) => `${v.material}, ${v.L} m, ${v.dT} K`,
    ),
    introOutputs: ['dl'],
    relatedSlugs: ['specific-heat-calculator', 'heat-conduction-calculator', 'density-calculator'],
    checks: [
      { inputs: {}, expect: { dl: '4.8 mm', new: '10.0048 m' } },
      { inputs: { material: 'pvc', L: 3, dT: 25 }, expect: { dl: '3.9 mm', new: '3.0039 m' } },
      { inputs: { material: 'aluminium', L: 50, dT: -30 }, expect: { dl: '-34.5 mm', new: '49.9655 m' } },
    ],
  },
  {
    slug: 'latent-heat-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: 'Latent Heat Calculator: Energy to Melt or Boil',
    h1: 'Latent Heat Calculator',
    metaDescription:
      'Calculate the energy needed to melt or boil a mass of ice, water, ethanol, lead, aluminium or iron from its latent heat, in kilojoules, kilowatt-hours and kilocalories.',
    about:
      'When a substance melts or boils it absorbs energy without changing temperature; that energy is the latent heat. Boiling a kilogram of water takes about seven times more energy than melting a kilogram of ice, and more than five times the energy needed to heat it from freezing to boiling. Choose the process, enter the mass and read the energy in kilojoules, kilowatt-hours and kilocalories. Values are typical figures at the normal melting or boiling point.',
    inputs: [
      pos('m', 'Mass (kg)', 1, 1e9),
      sel('process', 'Process', 'ice', [
        ['ice', 'Melting ice (334 kJ/kg)'],
        ['boil', 'Boiling water (2,257)'],
        ['ethanol', 'Boiling ethanol (841)'],
        ['lead', 'Melting lead (23)'],
        ['aluminium', 'Melting aluminium (397)'],
        ['iron', 'Melting iron (247)'],
      ]),
    ],
    outputs: [out('kj', 'Energy needed', true), out('kwh', 'In kilowatt-hours'), out('kcal', 'In kilocalories')],
    calculate: (i) => {
      const e = toD(i.m).mul(new D(LATENT[String(i.process)] ?? '334'));
      return { kj: u(e, 2, 'kJ'), kwh: u(e.div(3600), 4, 'kWh'), kcal: u(e.div('4.184'), 2, 'kcal') };
    },
    formulaDescription:
      'Q = m L, with L the specific latent heat in kJ/kg. The same energy is released when the substance freezes or condenses. The temperature stays constant during the change.',
    formulaLatex: 'Q = mL',
    workedExample: 'Melting 1 kg of ice at 0 °C needs 334 kJ, which is 0.0928 kWh or 79.83 kcal. Boiling 1 kg of water at 100 °C needs 2,257 kJ.',
    faq: [
      {
        question: 'Why does the temperature not rise while melting?',
        answer: 'The energy goes into breaking the bonds that hold the solid together rather than into faster motion of the molecules.',
      },
      {
        question: 'Why does steam burn so badly?',
        answer: 'Condensing steam releases its large latent heat onto the skin on top of the heat from the temperature.',
      },
      {
        question: 'Do I add the heating separately?',
        answer: 'Yes. Add m c ΔT for each stretch of heating, from the specific heat calculator, to the latent heat.',
      },
    ],
    scenarios: varied(
      'latent-heat-calculator',
      12,
      [{ name: 'm', lo: 0.05, hi: 400, step: 0.05 }],
      [{ name: 'process', options: ['ice', 'boil', 'ethanol', 'lead', 'aluminium', 'iron'] }],
      (v) => `${v.m} kg, ${v.process}`,
    ),
    introOutputs: ['kj'],
    relatedSlugs: ['specific-heat-calculator', 'time-to-heat-water-calculator', 'mixing-temperature-calculator'],
    checks: [
      { inputs: {}, expect: { kj: '334 kJ', kwh: '0.0928 kWh', kcal: '79.83 kcal' } },
      { inputs: { m: 0.25, process: 'boil' }, expect: { kj: '564.25 kJ', kwh: '0.1567 kWh', kcal: '134.86 kcal' } },
      { inputs: { m: 3, process: 'lead' }, expect: { kj: '69 kJ', kwh: '0.0192 kWh' } },
    ],
  },
  {
    slug: 'mixing-temperature-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: 'Mixing Temperature Calculator: Final Temperature of Two Water Masses',
    h1: 'Mixing Temperature Calculator',
    metaDescription: 'Find the final temperature when two amounts of water at different temperatures are mixed, with the heat transferred between them.',
    about:
      'Run hot water into a bath already holding cool water and the tub drifts to a single temperature, reached when heat has finished flowing from the hotter portion into the cooler one, the idea behind every calorimeter experiment. A small hot kettle barely warms a large cold basin. Enter the quantity and starting temperature of two portions of water; the page gives the temperature at thermal equilibrium and the heat that travelled between them, assuming a perfectly insulated vessel.',
    inputs: [
      pos('m1', 'Mass of water 1 (kg)', 1, 1e9),
      real('t1', 'Temperature of water 1 (°C)', 80, 0, 100),
      pos('m2', 'Mass of water 2 (kg)', 3, 1e9),
      real('t2', 'Temperature of water 2 (°C)', 20, 0, 100),
    ],
    outputs: [out('tf', 'Final temperature', true), out('heat', 'Heat transferred')],
    calculate: (i) => {
      const m1 = toD(i.m1);
      const m2 = toD(i.m2);
      const t1 = toD(i.t1);
      const tf = m1
        .mul(t1)
        .plus(m2.mul(toD(i.t2)))
        .div(m1.plus(m2));
      return { tf: u(tf, 2, '°C'), heat: u(m1.mul('4186').mul(t1.minus(tf).abs()).div(1000), 2, 'kJ') };
    },
    formulaDescription:
      'T_f = (m₁T₁ + m₂T₂) ÷ (m₁ + m₂), valid when both portions are the same liquid and no heat escapes. The heat moved is Q = m₁ c |T₁ − T_f| with c = 4,186 J/(kg·K).',
    formulaLatex: 'T_f = \\dfrac{m_{1}T_{1} + m_{2}T_{2}}{m_{1}+m_{2}}',
    workedExample: '1 kg at 80 °C mixed with 3 kg at 20 °C settles at (80 + 60) ÷ 4 = 35 °C. The hot water gives up 1 × 4,186 × 45 = 188.37 kJ.',
    faq: [
      {
        question: 'Does it matter which is poured first?',
        answer: 'Not for the final temperature in an ideal mix; in real life the container and the air take some heat.',
      },
      { question: 'Why is the result nearer the larger amount?', answer: 'It is a weighted average, so the larger mass counts for more.' },
      { question: 'Can I mix different liquids?', answer: 'Not with this page; their different specific heats would change the weighting.' },
    ],
    scenarios: mixed(
      'mixing-temperature-calculator',
      12,
      (r) => ({ m1: r(11, 940), t1: r(30.1, 99.9), m2: r(11, 940), t2: r(0.1, 24.9) }),
      (v) => `portions ${v.m1} and ${v.m2} starting ${v.t1} and ${v.t2}`,
    ),
    introOutputs: ['tf'],
    relatedSlugs: ['specific-heat-calculator', 'latent-heat-calculator', 'time-to-heat-water-calculator'],
    checks: [
      { inputs: {}, expect: { tf: '35 °C', heat: '188.37 kJ' } },
      { inputs: { m1: 2, t1: 90, m2: 2, t2: 10 }, expect: { tf: '50 °C', heat: '334.88 kJ' } },
      { inputs: { m1: 0.5, t1: 5, m2: 4, t2: 60 }, expect: { tf: '53.89 °C', heat: '102.32 kJ' } },
    ],
  },
  {
    slug: 'stefan-boltzmann-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: 'Stefan-Boltzmann Calculator: Thermal Radiation Power',
    h1: 'Stefan-Boltzmann Calculator',
    metaDescription:
      'Calculate the power radiated by a hot surface from its temperature, area and emissivity, and the net radiation exchanged with the surroundings.',
    about:
      'Every object glows in infrared according to its temperature, and the radiated power grows with the fourth power of the absolute temperature. That steep dependence is why a red-hot stove radiates so much more than a warm radiator. Enter the surface temperature, the surroundings, the area and the emissivity, where 1 is a perfect black body, to get the power emitted and the net power lost to the surroundings, which is what really cools the object.',
    inputs: [
      real('T', 'Surface temperature (°C)', 33, -272, 100000),
      real('Ts', 'Surroundings (°C)', 20, -272, 100000),
      pos('A', 'Surface area (m²)', 1.8, 1e12),
      field('e', 'Emissivity (0 to 1)', 0.97, 0.001, 1),
    ],
    outputs: [out('emit', 'Power emitted', true), out('net', 'Net power lost to surroundings')],
    calculate: (i) => {
      const t = toD(i.T).plus('273.15');
      const ts = toD(i.Ts).plus('273.15');
      const k = SIGMA.mul(toD(i.e)).mul(toD(i.A));
      return { emit: u(k.mul(t.pow(4)), 1, 'W'), net: u(k.mul(t.pow(4).minus(ts.pow(4))), 1, 'W') };
    },
    formulaDescription: 'P = ε σ A T⁴ with σ = 5.670374419×10⁻⁸ W m⁻² K⁻⁴ and T in kelvin. Net exchange = ε σ A (T⁴ − T_s⁴). Grey body, uniform temperature.',
    formulaLatex: 'P = \\varepsilon\\sigma A T^{4}',
    workedExample: 'Skin at 33 °C (306.15 K), 1.8 m², emissivity 0.97: emitted = 869.7 W. With surroundings at 20 °C the net loss is 138.6 W.',
    faq: [
      { question: 'Why does the body not lose 870 W?', answer: 'The surroundings radiate back at it. Only the net difference, here about 139 W, is lost.' },
      {
        question: 'What is emissivity?',
        answer: 'How well a surface radiates compared with a perfect black body. Dull surfaces are near 1, polished metal is much lower.',
      },
      {
        question: 'Why kelvin?',
        answer: 'Radiated power depends on the absolute temperature raised to the fourth power, so it has to be on the kelvin scale.',
      },
    ],
    scenarios: mixed(
      'stefan-boltzmann-calculator',
      12,
      (r) => ({ T: Math.round(r(10, 1500)), Ts: Math.round(r(-20, 25)), A: r(0.05, 40), e: r(0.05, 1) }),
      (v) => `${v.T} °C surface, ${v.A} m², ε ${v.e}`,
    ),
    introOutputs: ['emit'],
    relatedSlugs: ['wiens-law-calculator', 'heat-conduction-calculator', 'carnot-efficiency-calculator'],
    checks: [
      { inputs: {}, expect: { emit: '869.7 W', net: '138.6 W' } },
      { inputs: { T: 1000, Ts: 20, A: 0.5, e: 0.8 }, expect: { emit: '59,592.3 W', net: '59,424.8 W' } },
      { inputs: { T: 5500, Ts: -270, A: 1000, e: 1 }, expect: { emit: '62,988,766,422 W' } },
    ],
  },
  {
    slug: 'wiens-law-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: "Wien's Law Calculator: Peak Wavelength of a Hot Body",
    h1: "Wien's Law Calculator",
    metaDescription:
      "Find the peak emission wavelength of a black body from its temperature in kelvin with Wien's displacement law, and the part of the spectrum it falls in.",
    about:
      "A hot object radiates over a range of wavelengths, but the brightest part shifts to shorter wavelengths as it gets hotter. Wien's displacement law gives the peak: a constant divided by the temperature. Enter the temperature in kelvin to get the peak wavelength in nanometres and micrometres and the band it belongs to. The Sun, at 5,778 K, peaks near 500 nm in visible light, while a person at 310 K peaks in the infrared, around 9.3 micrometres.",
    inputs: [pos('T', 'Temperature (K)', 5778, 1e9)],
    outputs: [out('nm', 'Peak wavelength', true), out('um', 'In micrometres'), out('band', 'Spectrum band')],
    calculate: (i) => {
      const nm = WIEN.div(toD(i.T)).mul('1e9');
      return { nm: u(nm, 2, 'nm'), um: u(nm.div(1000), 4, 'µm'), band: band(nm) };
    },
    formulaDescription: 'λ_max = b ÷ T with b = 2.897771955×10⁻³ m·K and T in kelvin. Black-body radiation; real surfaces deviate by their emissivity.',
    formulaLatex: '\\lambda_{max} = \\dfrac{b}{T}',
    workedExample: "The Sun's surface at 5,778 K: λ = 2.897771955×10⁻³ ÷ 5,778 = 501.52 nm, which is 0.5015 µm, in the visible band.",
    faq: [
      {
        question: 'Why does a heated metal glow red then white?',
        answer: 'As the temperature rises the peak moves toward shorter wavelengths and more of the output falls in the visible range.',
      },
      { question: 'What about the human body?', answer: 'At about 310 K the peak is near 9.3 µm, in the infrared, which is what thermal cameras detect.' },
      {
        question: 'Is this the only wavelength emitted?',
        answer: 'No. It is where the spectrum peaks; a black body emits a broad range of wavelengths around it.',
      },
    ],
    scenarios: mixed(
      'wiens-law-calculator',
      12,
      (r) => ({ T: Math.round(r(3, 40000)) }),
      (v) => `temperature ${v.T} K`,
    ),
    introOutputs: ['nm', 'band'],
    relatedSlugs: ['stefan-boltzmann-calculator', 'photon-energy-calculator', 'wave-speed-calculator'],
    checks: [
      { inputs: {}, expect: { nm: '501.52 nm', um: '0.5015 µm', band: 'Visible light' } },
      { inputs: { T: 310 }, expect: { nm: '9,347.65 nm', um: '9.3477 µm', band: 'Infrared' } },
      { inputs: { T: 3000 }, expect: { nm: '965.92 nm', band: 'Infrared' } },
      { inputs: { T: 30000 }, expect: { nm: '96.59 nm', band: 'Ultraviolet' } },
    ],
  },
  {
    slug: 'inverse-square-law-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'Inverse Square Law Calculator: Intensity With Distance',
    h1: 'Inverse Square Law Calculator',
    metaDescription:
      'Use the inverse square law to find the intensity of light, sound or radiation at a new distance from a point source, and the factor and percentage it changes by.',
    about:
      'Light, sound and radiation from a point source spread over the surface of an ever-larger sphere, so the intensity falls with the square of the distance. Double the distance and you get a quarter of the intensity; move three times farther and you get a ninth. Enter the intensity at a known distance and the new distance to get the new intensity, the factor by which it changed and the percentage change. It works for any quantity that spreads out evenly from a point.',
    inputs: [pos('I1', 'Intensity at the first distance (W/m²)', 100, 1e15), pos('d1', 'First distance (m)', 1, 1e12), pos('d2', 'New distance (m)', 4, 1e12)],
    outputs: [out('i2', 'Intensity at the new distance', true), out('fac', 'Change factor'), out('chg', 'Percentage change')],
    calculate: (i) => {
      const fac = toD(i.d1).div(toD(i.d2)).pow(2);
      return { i2: u(toD(i.I1).mul(fac), 4, 'W/m²'), fac: `${fmtNumber(fac, 4)}×`, chg: `${fmtNumber(fac.minus(1).mul(100), 2)}%` };
    },
    formulaDescription: 'I₂ = I₁ × (d₁ ÷ d₂)². Valid for a point source in open space with no absorption; indoors, reflections add to it.',
    formulaLatex: 'I_{2} = I_{1}\\left(\\dfrac{d_{1}}{d_{2}}\\right)^{2}',
    workedExample: 'A source gives 100 W/m² at 1 m. At 4 m the factor is (1 ÷ 4)² = 0.0625, so the intensity is 6.25 W/m², a drop of 93.75%.',
    faq: [
      { question: 'Why a square?', answer: 'The area of a sphere grows with the square of its radius, so the same power is spread over that much more area.' },
      { question: 'Does it apply to a laser?', answer: 'Not well. A laser beam barely spreads, so its intensity falls far more slowly than a point source.' },
      { question: 'How is this used in photography?', answer: 'Doubling the distance from a flash cuts the light to a quarter, two stops of exposure.' },
    ],
    scenarios: mixed(
      'inverse-square-law-calculator',
      12,
      (r) => ({ I1: r(0.5, 4000), d1: r(0.2, 12), d2: r(0.1, 80) }),
      (v) => `${v.I1} at ${v.d1} m, then ${v.d2} m`,
    ),
    introOutputs: ['i2', 'chg'],
    relatedSlugs: ['speed-of-sound-calculator', 'photon-energy-calculator', 'gravitational-force-calculator'],
    checks: [
      { inputs: {}, expect: { i2: '6.25 W/m²', fac: '0.0625×', chg: '-93.75%' } },
      { inputs: { I1: 80, d1: 2, d2: 0.5 }, expect: { i2: '1,280 W/m²', fac: '16×', chg: '1,500%' } },
      { inputs: { I1: 1000, d1: 1, d2: 10 }, expect: { i2: '10 W/m²', fac: '0.01×' } },
    ],
  },
  {
    slug: 'pressure-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Properties of matter',
    title: 'Pressure Calculator: Force Over Area',
    h1: 'Pressure Calculator',
    metaDescription: 'Calculate pressure from a force and the area it acts on, in pascals, bar, psi and atmospheres.',
    about:
      "Pressure is force spread over an area: the same push is harmless on a wide surface and cutting on a narrow one. That is why a knife is sharpened and snowshoes are wide. Enter the force in newtons and the contact area in square centimetres to get the pressure in pascals, in bar, in pounds per square inch and in standard atmospheres. It is the starting point for tyre loads, hydraulics and why a high heel presses harder than an elephant's foot.",
    inputs: [pos('F', 'Force (N)', 500, 1e12), pos('A', 'Area (cm²)', 25, 1e9)],
    outputs: [out('pa', 'Pressure', true), out('bar', 'In bar'), out('psi', 'In psi'), out('atm', 'In atmospheres')],
    calculate: (i) => {
      const p = toD(i.F).div(toD(i.A).div(10000));
      return { pa: u(p, 1, 'Pa'), bar: u(p.div(100000), 4, 'bar'), psi: u(p.div(PSI), 2, 'psi'), atm: u(p.div(101325), 4, 'atm') };
    },
    formulaDescription: 'p = F ÷ A, with A in m² (1 cm² = 10⁻⁴ m²). 1 bar = 100,000 Pa, 1 atm = 101,325 Pa, 1 psi = 6,894.757 Pa.',
    formulaLatex: 'p = \\dfrac{F}{A}',
    workedExample: '500 N on 25 cm² (0.0025 m²): p = 200,000 Pa = 2 bar = 29.01 psi = 1.9738 atm.',
    faq: [
      { question: 'What is a pascal?', answer: 'One newton per square metre, a small pressure. Atmospheric pressure is about 101,000 pascals.' },
      {
        question: 'Why does a smaller area give more pressure?',
        answer: 'The same force is concentrated onto less surface, so each square centimetre carries more.',
      },
      { question: 'Is tyre pressure gauge or absolute?', answer: 'Gauge: it reads the pressure above the atmosphere around it.' },
    ],
    scenarios: mixed(
      'pressure-calculator',
      12,
      (r) => ({ F: r(1, 40000), A: r(0.1, 2500) }),
      (v) => `${v.F} N on ${v.A} cm²`,
    ),
    introOutputs: ['pa', 'psi'],
    relatedSlugs: ['hydrostatic-pressure-calculator', 'hydraulic-press-calculator', 'force-calculator'],
    checks: [
      { inputs: {}, expect: { pa: '200,000 Pa', bar: '2 bar', psi: '29.01 psi', atm: '1.9738 atm' } },
      { inputs: { F: 700, A: 2 }, expect: { pa: '3,500,000 Pa', bar: '35 bar', psi: '507.63 psi', atm: '34.5423 atm' } },
      { inputs: { F: 20, A: 0.5 }, expect: { pa: '400,000 Pa', psi: '58.02 psi' } },
    ],
  },
  {
    slug: 'pulley-system-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Machines',
    title: 'Pulley System Calculator: Effort and Rope Pulled',
    h1: 'Pulley System Calculator',
    metaDescription:
      'Work out the effort needed to lift a load with a pulley system from its mass, the number of supporting rope segments and the efficiency, and how much rope you must pull.',
    about:
      'A block and tackle spreads a load over several rope segments, so the pull needed is the weight divided by the number of segments that carry it. More segments mean a smaller pull, but you must haul proportionally more rope for each metre the load rises. Enter the load mass, count the rope segments supporting the movable block and set the efficiency of the pulleys to get the ideal effort, the real effort and the rope length per metre lifted.',
    inputs: [pos('m', 'Load mass (kg)', 100, 1e9), intField('n', 'Rope segments supporting the load', 4, 1, 100), field('eff', 'Efficiency (%)', 90, 1, 100)],
    outputs: [out('effort', 'Effort force needed', true), out('ideal', 'Ideal effort (no friction)'), out('rope', 'Rope pulled per 1 m of lift')],
    calculate: (i) => {
      const w = toD(i.m).mul(G);
      const n = toD(i.n);
      return { effort: u(w.div(n.mul(toD(i.eff)).div(100)), 2, 'N'), ideal: u(w.div(n), 2, 'N'), rope: u(n, 0, 'm') };
    },
    formulaDescription:
      'Ideal effort = m g ÷ n, with n the rope segments holding the movable block. Real effort = m g ÷ (n × efficiency). The rope pulled per metre of lift is n metres.',
    formulaLatex: 'F = \\dfrac{mg}{n\\,\\eta}',
    workedExample:
      'A 100 kg load on 4 supporting segments: weight 980.67 N, ideal pull 245.17 N. At 90% efficiency you pull 272.41 N and haul 4 m of rope for each metre of lift.',
    faq: [
      {
        question: 'How do I count the segments?',
        answer: 'Count the rope sections attached to the movable block. A fixed pulley that only changes direction adds none.',
      },
      {
        question: 'Why is real effort higher?',
        answer: 'Friction in the pulleys and rope stiffness waste some of the force, which the efficiency accounts for.',
      },
      { question: 'Does it save work?', answer: 'No. You pull with less force but over a longer distance, so the work done is the same or a little more.' },
    ],
    scenarios: mixed(
      'pulley-system-calculator',
      12,
      (r) => ({ m: r(5, 900), n: Math.round(r(1, 9)), eff: Math.round(r(55, 99)) }),
      (v) => `${v.m} kg on ${v.n} segments at ${v.eff}%`,
    ),
    introOutputs: ['effort', 'rope'],
    relatedSlugs: ['lever-calculator', 'weight-calculator', 'work-calculator'],
    checks: [
      { inputs: {}, expect: { effort: '272.41 N', ideal: '245.17 N', rope: '4 m' } },
      { inputs: { m: 250, n: 6, eff: 80 }, expect: { effort: '510.76 N', ideal: '408.61 N', rope: '6 m' } },
      { inputs: { m: 20, n: 1, eff: 100 }, expect: { effort: '196.13 N', rope: '1 m' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
