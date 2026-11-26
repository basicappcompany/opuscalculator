import { z } from 'zod';
import { numberListField, parseNumberList, selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { ATOMIC_MASS, hillFormula, parseFormula, wholeNumberRatio } from '../lib/formula';
import { fmtSig } from '../lib/gen-utils';
import { defineCalculator, mixed, type Spec } from '../lib/spec';
import { field, intField, sci, varied } from '../lib/spec-helpers';
import type { CalculatorConfig, Scenario } from '../lib/types';

/**
 * Catalog batch 10 (chemistry): thermodynamics and physical chemistry, organic and biochemical routines, process
 * times and a chemical equation balancer. Every formula, sentence and number is written for this site. Constants:
 * k_B = 1.380649e-23 J/K (exact), R = 8.314462618 J/(mol K). Heats of combustion are standard enthalpies at 298 K.
 * Pages are tier 2 or 3, so none is live until the cohort gate opens. Chemistry shows the category disclaimer.
 */

const KB = new D('1.380649e-23');
const R_GAS = new D('8.314462618');
const PI = new D('3.14159265358979323846264338327950288');
const LN2 = new D(2).ln();
const ZERO = BigInt(0);
const ONE = BigInt(1);

const select = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});
const text = (name: string, label: string, def: string, max = 200) => ({
  name,
  label,
  type: 'text' as const,
  default: def,
  validator: z.string().trim().min(1).max(max),
});
const list = (name: string, label: string, def: string) => ({ name, label, type: 'text' as const, default: def, validator: numberListField(2, 60) });

const sig4 = (x: Dec): string => fmtSig(x, 4, false);
const withInputs = (label: string, inputs: Scenario['inputs']): Scenario => ({ label, inputs });

/** Water boiling point and vapour pressure by the Antoine equation (valid from 1 to 100 °C, pressure in mmHg). */
const ANTOINE_A = new D('8.07131');
const ANTOINE_B = new D('1730.63');
const ANTOINE_C = new D('233.426');
const MMHG_PER_KPA = new D('7.50062');

function boilingPointAt(altitudeM: Dec): { kpa: Dec; celsius: Dec } {
  const kpa = new D('101.325').mul(new D(1).minus(altitudeM.mul('2.25577e-5')).pow('5.25588'));
  const celsius = ANTOINE_B.div(ANTOINE_A.minus(kpa.mul(MMHG_PER_KPA).log(10))).minus(ANTOINE_C);
  return { kpa, celsius };
}

const FUELS: Record<string, { label: string; kj: string; mm: string }> = {
  methane: { label: 'Methane CH4', kj: '890.3', mm: '16.043' },
  ethane: { label: 'Ethane C2H6', kj: '1560.7', mm: '30.07' },
  propane: { label: 'Propane C3H8', kj: '2219.2', mm: '44.097' },
  butane: { label: 'Butane C4H10', kj: '2877.5', mm: '58.123' },
  octane: { label: 'Octane C8H18', kj: '5470.5', mm: '114.23' },
  methanol: { label: 'Methanol CH3OH', kj: '726.1', mm: '32.042' },
  ethanol: { label: 'Ethanol C2H5OH', kj: '1366.8', mm: '46.069' },
  hydrogen: { label: 'Hydrogen H2', kj: '285.8', mm: '2.016' },
  glucose: { label: 'Glucose C6H12O6', kj: '2803', mm: '180.16' },
  carbon: { label: 'Carbon (graphite)', kj: '393.5', mm: '12.011' },
};
const FUEL_OPTIONS: [string, string][] = Object.entries(FUELS).map(([k, v]) => [k, v.label]);

const AFR_FUELS: Record<string, { label: string; afr: string }> = {
  gasoline: { label: 'Gasoline (14.7)', afr: '14.7' },
  diesel: { label: 'Diesel (14.5)', afr: '14.5' },
  ethanol: { label: 'Ethanol (9.0)', afr: '9.0' },
  methanol: { label: 'Methanol (6.45)', afr: '6.45' },
  methane: { label: 'Methane (17.2)', afr: '17.2' },
  propane: { label: 'Propane (15.7)', afr: '15.7' },
  hydrogen: { label: 'Hydrogen (34.3)', afr: '34.3' },
};
const AFR_OPTIONS: [string, string][] = Object.entries(AFR_FUELS).map(([k, v]) => [k, v.label]);

const N_FACTORS: [string, string][] = [
  ['6.25', 'General foods and meat (6.25)'],
  ['5.7', 'Wheat flour (5.70)'],
  ['5.95', 'Rice (5.95)'],
  ['5.71', 'Soybean (5.71)'],
  ['6.38', 'Milk and dairy (6.38)'],
];

// ---- chemical equation balancing with exact fractions ----
type Frac = [bigint, bigint];
const babs = (a: bigint): bigint => (a < ZERO ? -a : a);
const bgcd = (a: bigint, b: bigint): bigint => (b === ZERO ? babs(a) : bgcd(b, a % b));
const frac = (n: bigint, d: bigint = ONE): Frac => {
  const g = bgcd(n, d) || ONE;
  const sign = d < ZERO ? -ONE : ONE;
  return [(sign * n) / g, (sign * d) / g];
};
const fsub = (a: Frac, b: Frac): Frac => frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const fmul = (a: Frac, b: Frac): Frac => frac(a[0] * b[0], a[1] * b[1]);
const fdiv = (a: Frac, b: Frac): Frac => frac(a[0] * b[1], a[1] * b[0]);

function balance(source: string): string {
  const cleaned = source.replace(/→|⟶|=>|-->|->|==|=/g, '->');
  const sides = cleaned.split('->');
  if (sides.length !== 2) return 'Write the equation with one arrow, for example H2 + O2 -> H2O';
  const terms = sides.map((side) =>
    side
      .split('+')
      .map((t) => t.trim().replace(/^\d+\s*/, ''))
      .filter((t) => t !== ''),
  );
  if (terms[0].length === 0 || terms[1].length === 0) return 'Both sides need at least one substance';
  const species = [...terms[0], ...terms[1]];
  const columns = species.map((t) => parseFormula(t));
  for (let k = 0; k < columns.length; k++) {
    const c = columns[k];
    if ('error' in c) return `${species[k]}: ${c.error}`;
  }
  const parsed = columns.map((c) => (c as { counts: Map<string, number> }).counts);
  const elements = [...new Set(parsed.flatMap((m) => [...m.keys()]))];
  const matrix: Frac[][] = elements.map((el) => parsed.map((m, k) => frac(BigInt(m.get(el) ?? 0) * (k < terms[0].length ? ONE : -ONE))));
  // reduced row echelon form
  const pivots: number[] = [];
  let row = 0;
  for (let col = 0; col < species.length && row < matrix.length; col++) {
    let p = row;
    while (p < matrix.length && matrix[p][col][0] === ZERO) p++;
    if (p === matrix.length) continue;
    [matrix[row], matrix[p]] = [matrix[p], matrix[row]];
    const lead = matrix[row][col];
    matrix[row] = matrix[row].map((v) => fdiv(v, lead));
    for (let r = 0; r < matrix.length; r++) {
      if (r === row || matrix[r][col][0] === ZERO) continue;
      const factor = matrix[r][col];
      matrix[r] = matrix[r].map((v, c) => fsub(v, fmul(factor, matrix[row][c])));
    }
    pivots.push(col);
    row++;
  }
  const free = species.map((_, c) => c).filter((c) => !pivots.includes(c));
  if (free.length !== 1)
    return free.length === 0
      ? 'These substances cannot be balanced: check the formulas'
      : 'More than one balanced answer exists: check that every substance belongs in the equation';
  const solution: Frac[] = species.map(() => frac(ZERO));
  solution[free[0]] = frac(ONE);
  pivots.forEach((col, r) => {
    solution[col] = fsub(frac(ZERO), matrix[r][free[0]]);
  });
  const lcm = solution.reduce((acc, [, d]) => (acc * d) / bgcd(acc, d), ONE);
  let ints = solution.map(([n, d]) => (n * lcm) / d);
  const g = ints.reduce((acc, v) => bgcd(acc, v), ZERO);
  ints = ints.map((v) => v / (g === ZERO ? ONE : g));
  if (ints.some((v) => v <= ZERO)) return 'No balanced answer with positive coefficients: check the formulas and which side each belongs on';
  const write = (from: number, to: number) =>
    species
      .slice(from, to)
      .map((s, k) => `${ints[from + k] === ONE ? '' : `${ints[from + k]} `}${s}`)
      .join(' + ');
  return `${write(0, terms[0].length)} → ${write(terms[0].length, species.length)}`;
}

export const SPECS: Spec[] = [
  {
    slug: 'boiling-point-at-altitude-calculator',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Thermodynamics',
    title: 'Boiling Point of Water at Altitude Calculator',
    h1: 'Boiling Point at Altitude Calculator',
    metaDescription: 'Find the air pressure and the boiling point of water at any altitude up to 9,000 metres, in degrees Celsius and Fahrenheit.',
    about:
      'Water boils when its vapour pressure equals the pressure of the air above it, and air pressure falls as you climb. At sea level the boiling point is 100 degrees Celsius, but on a mountain pass it is lower, and that is why pasta, eggs and beans take longer to cook at height. This calculator estimates the air pressure from the altitude using the standard atmosphere, then solves the Antoine equation for the temperature at which water has that vapour pressure. Enter the altitude in metres and read the boiling point and how many degrees below sea level it falls.',
    inputs: [field('alt', 'Altitude above sea level (m)', 1500, 0, 9000)],
    outputs: [
      { name: 'kpa', label: 'Air pressure', format: 'text' },
      { name: 'bp', label: 'Boiling point of water', format: 'text', highlight: true },
      { name: 'bpf', label: 'In degrees Fahrenheit', format: 'text' },
      { name: 'drop', label: 'Below the sea-level boiling point', format: 'text' },
    ],
    calculate: (i) => {
      const { kpa, celsius } = boilingPointAt(toD(i.alt));
      return {
        kpa: `${fmtNumber(kpa, 2)} kPa`,
        bp: `${fmtNumber(celsius, 1)} °C`,
        bpf: `${fmtNumber(celsius.mul('1.8').plus(32), 1)} °F`,
        drop: `${fmtNumber(boilingPointAt(new D(0)).celsius.minus(celsius), 1)} °C`,
      };
    },
    formulaDescription:
      'Pressure (kPa) = 101.325 × (1 − 2.25577 × 10^-5 × altitude)^5.25588. Boiling point (°C) = 1730.63 ÷ (8.07131 − log10(pressure in mmHg)) − 233.426, with 1 kPa = 7.50062 mmHg.',
    workedExample:
      'At 1,500 m the pressure is 84.56 kPa and water boils at 95 °C, 5 °C below the sea-level value. On the summit of Everest, 8,848 m, it is 31.44 kPa and 70.3 °C.',
    faq: [
      {
        question: 'Rule of thumb for the drop?',
        answer: 'About 1 °C for every 300 metres of altitude. The calculation here is more exact, since the drop grows slightly with height.',
      },
      {
        question: 'Does weather change the answer?',
        answer: 'Yes. Pressure varies by a few percent with weather, which shifts the boiling point by about a degree, so treat the result as typical.',
      },
      {
        question: 'Why does food cook slowly at altitude?',
        answer:
          'Cooking speed depends on the water temperature, and boiling water cannot get hotter than its boiling point, so a lower boiling point means longer cooking. A pressure cooker raises it.',
      },
    ],
    scenarios: mixed(
      'boiling-point-at-altitude-calculator',
      8,
      (r) => ({ alt: Math.round(r(0, 8800)) }),
      (v) => `${v.alt} metres up`,
    ),
    introOutputs: ['bp'],
    relatedSlugs: ['vapor-pressure-of-water-calculator', 'boiling-point-elevation-calculator'],
    checks: [
      { inputs: {}, expect: { kpa: '84.56 kPa', bp: '95 °C', bpf: '203 °F' } },
      { inputs: { alt: 0 }, expect: { kpa: '101.33 kPa', bp: '100 °C', drop: '0 °C' } },
      { inputs: { alt: 8848 }, expect: { kpa: '31.44 kPa', bp: '70.3 °C', bpf: '158.5 °F' } },
      { inputs: { alt: 3000 }, expect: { kpa: '70.11 kPa', bp: '90 °C' } },
    ],
  },
  {
    slug: 'vapor-pressure-of-water-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: 'Vapor Pressure of Water Calculator (Antoine Equation)',
    h1: 'Vapor Pressure of Water Calculator',
    metaDescription: 'Calculate the saturated vapour pressure of water between 1 and 100 degrees Celsius in mmHg and kPa with the Antoine equation.',
    about:
      'The vapour pressure of water is the pressure its vapour exerts when in balance with the liquid, and it climbs steeply with temperature, from about 0.65 kilopascals near the freezing point to 101.3 at the boiling point. It matters for humidity, drying, distillation, gas collected over water and anything that boils. The Antoine equation fits this curve with three constants and works between 1 and 100 degrees Celsius. Enter the temperature and the page returns the pressure in millimetres of mercury and in kilopascals. Within this range the fit is accurate to a fraction of a percent.',
    inputs: [field('t', 'Temperature (°C)', 25, 1, 100)],
    outputs: [
      { name: 'mmhg', label: 'Vapor pressure', format: 'text', highlight: true },
      { name: 'kpa', label: 'In kilopascals', format: 'text' },
    ],
    calculate: (i) => {
      const mm = new D(10).pow(ANTOINE_A.minus(ANTOINE_B.div(ANTOINE_C.plus(toD(i.t)))));
      return { mmhg: `${fmtNumber(mm, 2)} mmHg`, kpa: `${fmtNumber(mm.div(MMHG_PER_KPA), 3)} kPa` };
    },
    formulaDescription: 'log10(P in mmHg) = 8.07131 − 1730.63 ÷ (233.426 + T), with T in °C, valid from 1 to 100 °C. kPa = mmHg ÷ 7.50062.',
    workedExample:
      'At 25 °C: log10 P = 8.07131 − 1730.63 ÷ 258.426 = 1.3745, so P = 23.69 mmHg, which is 3.158 kPa. At 100 °C it is 760.09 mmHg, one atmosphere.',
    faq: [
      {
        question: 'Why does pressure rise so quickly?',
        answer: 'Evaporation needs a certain energy per molecule, so the fraction of molecules with enough energy grows exponentially with temperature.',
      },
      {
        question: 'How does this relate to humidity?',
        answer: 'Relative humidity is the actual water vapour pressure divided by this saturated value at the same temperature.',
      },
      { question: 'What about below 1 degree?', answer: 'The constants here are for 1 to 100 °C. Ice and very cold water need other constants.' },
    ],
    scenarios: mixed(
      'vapor-pressure-of-water-calculator',
      8,
      (r) => ({ t: Math.round(r(2, 99)) }),
      (v) => `${v.t} °C`,
    ),
    introOutputs: ['mmhg'],
    relatedSlugs: ['vapor-pressure-calculator', 'boiling-point-at-altitude-calculator'],
    checks: [
      { inputs: {}, expect: { mmhg: '23.69 mmHg', kpa: '3.158 kPa' } },
      { inputs: { t: 100 }, expect: { mmhg: '760.09 mmHg', kpa: '101.336 kPa' } },
      { inputs: { t: 60 }, expect: { mmhg: '149.04 mmHg', kpa: '19.87 kPa' } },
      { inputs: { t: 1 }, expect: { mmhg: '4.89 mmHg', kpa: '0.651 kPa' } },
    ],
  },
  {
    slug: 'entropy-change-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: 'Entropy Change Calculator: Phase Changes and Heating',
    h1: 'Entropy Change Calculator',
    metaDescription:
      'Calculate the entropy change of a phase transition from the enthalpy and temperature, or of heating from the heat capacity and two temperatures.',
    about:
      'Entropy measures how many ways energy can be spread among the particles of a system, and it rises when a solid melts, a liquid boils or a substance is heated. For a phase change at constant temperature, the entropy change is the heat absorbed divided by the temperature. For heating, it is the amount times the molar heat capacity times the natural logarithm of the ratio of final to initial temperature. Choose the case, enter the values, and the page returns the change in joules per kelvin and per mole. Heat capacity is assumed constant over the range.',
    inputs: [
      select('mode', 'Process', 'phase', [
        ['phase', 'Phase change at a fixed temperature'],
        ['heating', 'Heating from T1 to T2'],
      ]),
      field('n', 'Amount (mol)', 1, 0, 1e6),
      field('dh', 'Enthalpy of the change (kJ/mol)', 6.01, 0, 1000),
      field('tk', 'Temperature of the change (K)', 273.15, 1, 6000),
      field('cp', 'Molar heat capacity (J/(mol·K))', 75.3, 0.1, 500),
      field('t1', 'Starting temperature (K)', 298.15, 1, 6000),
      field('t2', 'Final temperature (K)', 348.15, 1, 6000),
    ],
    outputs: [
      { name: 'ds', label: 'Entropy change', format: 'text', highlight: true },
      { name: 'molar', label: 'Per mole', format: 'text' },
    ],
    calculate: (i) => {
      const n = toD(i.n);
      const perMole = String(i.mode) === 'heating' ? toD(i.cp).mul(toD(i.t2).div(toD(i.t1)).ln()) : toD(i.dh).mul(1000).div(toD(i.tk));
      return { ds: `${fmtNumber(perMole.mul(n), 2)} J/K`, molar: `${fmtNumber(perMole, 2)} J/(mol·K)` };
    },
    formulaDescription: 'Phase change: ΔS = n × ΔH × 1,000 ÷ T. Heating: ΔS = n × Cp × ln(T2 ÷ T1). ΔH in kJ/mol, Cp in J/(mol·K), temperatures in kelvin.',
    workedExample:
      'Melting 1 mol of ice, ΔH = 6.01 kJ/mol at 273.15 K: ΔS = 6,010 ÷ 273.15 = 22.0 J/K. Heating 1 mol of liquid water from 298.15 K to 348.15 K with Cp 75.3: 75.3 × ln(1.1677) = 11.67 J/K.',
    faq: [
      {
        question: 'Why is the change at fixed T equal to q over T?',
        answer:
          'At constant temperature a reversible heat transfer changes entropy by exactly q ÷ T, and at a phase change the heat is the enthalpy of the transition.',
      },
      {
        question: 'Is the sign always positive?',
        answer:
          'Melting, boiling and heating raise entropy. Freezing, condensing and cooling lower it, which you get by entering the final temperature below the initial.',
      },
      {
        question: 'What about the surroundings?',
        answer: 'Only the entropy of the substance is given. The second law is about the total, including whatever supplies the heat.',
      },
    ],
    scenarios: varied(
      'entropy-change-calculator',
      8,
      [
        { name: 'n', lo: 0.5, hi: 6, step: 0.5 },
        { name: 'dh', lo: 2, hi: 60, step: 0.1 },
        { name: 'tk', lo: 120, hi: 900 },
        { name: 'cp', lo: 20, hi: 150, step: 0.5 },
        { name: 't1', lo: 200, hi: 400 },
        { name: 't2', lo: 410, hi: 700 },
      ],
      [{ name: 'mode', options: ['phase', 'heating'] }],
      (v) => `${v.mode}: ${v.n} mol, ${v.dh} kJ/mol at ${v.tk} K, Cp ${v.cp}, ${v.t1} K to ${v.t2} K`,
    ),
    introOutputs: ['ds'],
    relatedSlugs: ['gibbs-free-energy-calculator', 'heat-of-combustion-calculator'],
    checks: [
      { inputs: {}, expect: { ds: '22 J/K', molar: '22 J/(mol·K)' } },
      { inputs: { mode: 'heating' }, expect: { ds: '11.67 J/K' } },
      { inputs: { mode: 'heating', n: 2, t1: 300, t2: 350 }, expect: { ds: '23.22 J/K' } },
      { inputs: { n: 2, dh: 40.65, tk: 373.15 }, expect: { ds: '217.87 J/K' } },
    ],
  },
  {
    slug: 'gibbs-phase-rule-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: 'Gibbs Phase Rule Calculator: Degrees of Freedom',
    h1: 'Gibbs Phase Rule Calculator',
    metaDescription: 'Find the degrees of freedom of a system from the number of components and phases with the Gibbs phase rule F = C - P + 2.',
    about:
      'The phase rule tells how many intensive variables, such as temperature, pressure or composition, can be changed independently without changing the number of phases in equilibrium. With C components and P phases, the number of degrees of freedom F is C minus P plus 2 when both temperature and pressure are free to vary. If one is held fixed, as in a condensed system under constant pressure, the 2 becomes 1. Enter the numbers and the page returns F and what it means: zero means a single fixed point, such as the triple point of water.',
    inputs: [
      intField('c', 'Components (C)', 1, 1, 10),
      intField('p', 'Phases in equilibrium (P)', 1, 1, 12),
      select('cond', 'Variables free to change', 'both', [
        ['both', 'Temperature and pressure (F = C − P + 2)'],
        ['fixed', 'One of them held fixed (F = C − P + 1)'],
      ]),
    ],
    outputs: [
      { name: 'f', label: 'Degrees of freedom', format: 'text', highlight: true },
      { name: 'meaning', label: 'What it means', format: 'text' },
    ],
    calculate: (i) => {
      const f = Number(i.c) - Number(i.p) + (String(i.cond) === 'fixed' ? 1 : 2);
      if (f < 0) return { f: 'Not possible', meaning: 'More phases than the rule allows can never coexist at equilibrium' };
      const meaning =
        f === 0
          ? 'Invariant: a single point, like the triple point of water'
          : f === 1
            ? 'Univariant: a line, change one variable and the other follows'
            : f === 2
              ? 'Divariant: an area, two variables can change independently'
              : 'Several variables can change independently';
      return { f: String(f), meaning };
    },
    formulaDescription: 'F = C − P + 2 when temperature and pressure both vary. F = C − P + 1 when one is held fixed. F cannot be negative.',
    workedExample:
      'Pure water (C = 1) with one phase has F = 1 − 1 + 2 = 2. With ice, liquid and vapour together, P = 3 and F = 0, the triple point. A two-component system with two phases at constant pressure has F = 2 − 2 + 1 = 1.',
    faq: [
      {
        question: 'What counts as a component?',
        answer: 'The smallest number of independent chemical species needed to describe every phase. Water and ice have one component.',
      },
      {
        question: 'What is a phase?',
        answer: 'A region of uniform composition and properties: ice, liquid water and water vapour are three phases of one component.',
      },
      { question: 'Why can F be zero?', answer: 'At a triple point or eutectic everything is fixed. Changing either variable makes a phase vanish.' },
    ],
    scenarios: varied(
      'gibbs-phase-rule-calculator',
      8,
      [
        { name: 'c', lo: 1, hi: 5 },
        { name: 'p', lo: 1, hi: 5 },
      ],
      [{ name: 'cond', options: ['both', 'fixed'] }],
      (v) => `${v.c} components, ${v.p} phases, ${v.cond}`,
    ),
    introOutputs: ['f'],
    relatedSlugs: ['gibbs-free-energy-calculator', 'vapor-pressure-calculator'],
    checks: [
      { inputs: {}, expect: { f: '2' } },
      { inputs: { c: 1, p: 3 }, expect: { f: '0', meaning: 'Invariant: a single point, like the triple point of water' } },
      { inputs: { c: 2, p: 2, cond: 'fixed' }, expect: { f: '1' } },
      { inputs: { c: 1, p: 4 }, expect: { f: 'Not possible' } },
    ],
  },
  {
    slug: 'heat-of-combustion-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: 'Heat of Combustion Calculator for Common Fuels',
    h1: 'Heat of Combustion Calculator',
    metaDescription:
      'Find the heat released by burning a mass of methane, propane, ethanol, hydrogen, glucose or other fuels from their standard enthalpies of combustion.',
    about:
      'The heat of combustion is the energy released when a substance burns completely in oxygen, and it is the basis of fuel values and food energy. Chemists tabulate it as the standard enthalpy of combustion in kilojoules per mole. Choose a fuel, enter the mass, and the page divides by the molar mass to get moles, then multiplies by the enthalpy. It also shows the energy per gram, which is how fuels are compared: hydrogen releases about 142 kilojoules per gram and methane 55, while glucose gives only 15.6. Values are higher heating values at 298 kelvin with liquid water as a product.',
    inputs: [select('fuel', 'Fuel', 'methane', FUEL_OPTIONS), field('grams', 'Mass burned (g)', 100, 0, 1e9)],
    outputs: [
      { name: 'moles', label: 'Moles burned', format: 'text' },
      { name: 'kj', label: 'Heat released', format: 'text', highlight: true },
      { name: 'mj', label: 'In megajoules', format: 'text' },
      { name: 'perg', label: 'Per gram', format: 'text' },
    ],
    calculate: (i) => {
      const fuel = FUELS[String(i.fuel)] ?? FUELS.methane;
      const moles = toD(i.grams).div(fuel.mm);
      const kj = moles.mul(fuel.kj);
      return {
        moles: fmtNumber(moles, 4),
        kj: `${fmtNumber(kj, 1)} kJ`,
        mj: `${fmtNumber(kj.div(1000), 3)} MJ`,
        perg: `${fmtNumber(new D(fuel.kj).div(fuel.mm), 2)} kJ/g`,
      };
    },
    formulaDescription:
      'Moles = mass ÷ molar mass. Heat released = moles × standard enthalpy of combustion (positive here: energy given out). Per gram = enthalpy ÷ molar mass.',
    workedExample:
      '100 g of methane (16.043 g/mol) is 6.2332 mol; at 890.3 kJ/mol that releases 5,549.5 kJ, or 55.49 kJ per gram. 100 g of hydrogen releases 14,176.6 kJ.',
    faq: [
      {
        question: 'Why do values differ between sources?',
        answer: 'Some give the higher heating value (liquid water formed) and others the lower value (steam). These are higher heating values.',
      },
      {
        question: 'Is this the energy a stove delivers?',
        answer: 'No. A real burner loses heat to the air, and incomplete combustion releases less. The values are the ideal complete-burning figure.',
      },
      {
        question: 'Why is hydrogen so high per gram?',
        answer: 'Hydrogen atoms are very light, so a gram holds many moles, and each releases a lot of energy.',
      },
    ],
    scenarios: varied(
      'heat-of-combustion-calculator',
      8,
      [{ name: 'grams', lo: 5, hi: 2400 }],
      [{ name: 'fuel', options: ['methane', 'ethane', 'propane', 'butane', 'octane', 'methanol', 'ethanol', 'hydrogen', 'glucose', 'carbon'] }],
      (v) => `${v.grams} g of ${v.fuel}`,
    ),
    introOutputs: ['kj'],
    relatedSlugs: ['combustion-reaction-calculator', 'entropy-change-calculator'],
    checks: [
      { inputs: {}, expect: { moles: '6.2332', kj: '5,549.5 kJ', mj: '5.549 MJ', perg: '55.49 kJ/g' } },
      { inputs: { fuel: 'ethanol' }, expect: { moles: '2.1707', kj: '2,966.9 kJ' } },
      { inputs: { fuel: 'hydrogen' }, expect: { kj: '14,176.6 kJ', perg: '141.77 kJ/g' } },
      { inputs: { fuel: 'glucose' }, expect: { kj: '1,555.8 kJ', perg: '15.56 kJ/g' } },
    ],
  },
  {
    slug: 'q10-temperature-coefficient-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Kinetics',
    title: 'Q10 Temperature Coefficient Calculator',
    h1: 'Q10 Temperature Coefficient Calculator',
    metaDescription: 'Calculate the Q10 temperature coefficient from two reaction rates measured at two temperatures, and the rate change per degree.',
    about:
      'The Q10 coefficient states how much a rate increases when the temperature rises by ten degrees. Biological and chemical rates often roughly double or triple for every ten degrees, so Q10 is typically between 2 and 3. It is found from two rates measured at two temperatures: the rate ratio is raised to the power of ten divided by the temperature difference. Enter both rates and both temperatures in degrees Celsius, in any consistent rate unit, and the page returns Q10 and the factor per single degree. It applies to modest ranges where the response is smooth.',
    inputs: [
      field('r1', 'Rate at T1', 2, 0.0001, 1e9),
      field('r2', 'Rate at T2', 4, 0.0001, 1e9),
      field('t1', 'Temperature T1 (°C)', 20, -50, 200),
      field('t2', 'Temperature T2 (°C)', 30, -50, 200),
    ],
    outputs: [
      { name: 'q10', label: 'Q10', format: 'text', highlight: true },
      { name: 'perdeg', label: 'Rate factor per °C', format: 'text' },
    ],
    calculate: (i) => {
      const dt = toD(i.t2).minus(toD(i.t1));
      if (dt.isZero()) return { q10: 'The two temperatures must differ', perdeg: '-' };
      const ratio = toD(i.r2).div(toD(i.r1));
      return { q10: fmtNumber(ratio.pow(new D(10).div(dt)), 3), perdeg: fmtNumber(ratio.pow(new D(1).div(dt)), 4) };
    },
    formulaDescription: 'Q10 = (R2 ÷ R1)^(10 ÷ (T2 − T1)). The factor per degree is (R2 ÷ R1)^(1 ÷ (T2 − T1)).',
    workedExample:
      'A rate of 2 at 20 °C and 4 at 30 °C gives Q10 = 2^(10 ÷ 10) = 2, a factor of 1.0718 per degree. Rates 2.5 at 10 °C and 7.1 at 25 °C give Q10 = 2.84^(10 ÷ 15) = 2.005.',
    faq: [
      { question: 'What is a typical Q10?', answer: 'Most enzyme reactions have a Q10 of 2 to 3. Physical processes such as diffusion are close to 1.3.' },
      {
        question: 'How is it linked to activation energy?',
        answer: 'Both come from the Arrhenius equation. A higher activation energy gives a larger Q10, and Q10 falls as temperature rises.',
      },
      {
        question: 'Can it be below 1?',
        answer: 'Yes. If the rate falls with temperature, for example when an enzyme begins to denature, the ratio is under 1.',
      },
    ],
    scenarios: mixed(
      'q10-temperature-coefficient-calculator',
      8,
      (r) => ({ r1: r(0.5, 20), r2: r(1, 90), t1: Math.round(r(0, 20)), t2: Math.round(r(24, 45)) }),
      (v) => `rates ${v.r1} and ${v.r2} at ${v.t1} and ${v.t2} °C`,
    ),
    introOutputs: ['q10'],
    relatedSlugs: ['arrhenius-equation-calculator', 'activation-energy-calculator'],
    checks: [
      { inputs: {}, expect: { q10: '2', perdeg: '1.0718' } },
      { inputs: { r1: 1, r2: 3, t1: 15, t2: 25 }, expect: { q10: '3', perdeg: '1.1161' } },
      { inputs: { r1: 2.5, r2: 7.1, t1: 10, t2: 25 }, expect: { q10: '2.005' } },
      { inputs: { t1: 20, t2: 20 }, expect: { q10: 'The two temperatures must differ' } },
    ],
  },
  {
    slug: 'diffusion-coefficient-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Physical chemistry',
    title: 'Diffusion Coefficient Calculator (Stokes-Einstein)',
    h1: 'Diffusion Coefficient Calculator',
    metaDescription: 'Estimate the diffusion coefficient of a spherical particle from temperature, viscosity and radius with the Stokes-Einstein equation.',
    about:
      'Small particles in a liquid jiggle randomly because of collisions with the solvent, and they spread out at a rate set by the diffusion coefficient. The Stokes-Einstein equation estimates it for a sphere moving through a viscous liquid: it grows with temperature and falls with viscosity and with the radius of the particle. Enter the temperature in degrees Celsius, the viscosity in millipascal-seconds (water at 25 degrees is 0.89) and the radius in nanometres. The page returns the coefficient in square metres per second and square micrometres per second, and the typical distance a particle wanders in one second.',
    inputs: [
      field('t', 'Temperature (°C)', 25, -20, 150),
      field('eta', 'Viscosity (mPa·s)', 0.89, 0.01, 10000),
      field('r', 'Particle radius (nm)', 1, 0.01, 100000),
    ],
    outputs: [
      { name: 'd', label: 'Diffusion coefficient', format: 'text', highlight: true },
      { name: 'um', label: 'In µm²/s', format: 'text' },
      { name: 'walk', label: 'Typical distance in 1 s', format: 'text' },
    ],
    calculate: (i) => {
      const d = KB.mul(toD(i.t).plus('273.15')).div(PI.mul(6).mul(toD(i.eta).mul('1e-3')).mul(toD(i.r).mul('1e-9')));
      return { d: `${sci(d, 3)} m²/s`, um: `${fmtNumber(d.mul('1e12'), 1)} µm²/s`, walk: `${fmtNumber(d.mul(2).sqrt().mul('1e6'), 2)} µm` };
    },
    formulaDescription:
      'D = k_B × T ÷ (6π × η × r), with k_B = 1.380649 × 10^-23 J/K, T in kelvin, η in Pa·s and r in metres. Distance in one second = √(2 D t).',
    workedExample:
      'A 1 nm sphere in water at 25 °C (0.89 mPa·s): D = 4.116 × 10^-21 ÷ (6π × 8.9 × 10^-4 × 10^-9) = 2.454 × 10^-10 m²/s, or 245.4 µm²/s, wandering about 22 µm in a second.',
    faq: [
      {
        question: 'Does it work for molecules?',
        answer: 'It is a good estimate for large particles and a rough one for small molecules, where the continuum picture of the solvent fails.',
      },
      {
        question: 'Why does a bigger particle diffuse more slowly?',
        answer: 'Drag grows with the radius, so a particle ten times wider diffuses ten times more slowly in the same liquid.',
      },
      { question: 'What viscosity should I use?', answer: 'Water is 1.0 mPa·s at 20 °C and 0.89 at 25 °C. Blood plasma is about 1.5 and glycerol over 1,000.' },
    ],
    scenarios: mixed(
      'diffusion-coefficient-calculator',
      8,
      (r) => ({ t: Math.round(r(4, 60)), eta: r(0.3, 12), r: r(0.2, 400) }),
      (v) => `${v.t} °C, ${v.eta} mPa·s, radius ${v.r} nm`,
    ),
    introOutputs: ['d'],
    relatedSlugs: ['rate-of-effusion-calculator', 'langmuir-isotherm-calculator'],
    checks: [
      { inputs: {}, expect: { d: '2.454 × 10^-10 m²/s', um: '245.4 µm²/s', walk: '22.15 µm' } },
      { inputs: { t: 37, eta: 0.69, r: 5 }, expect: { d: '6.585 × 10^-11 m²/s' } },
      { inputs: { r: 2 }, expect: { um: '122.7 µm²/s' } },
    ],
  },
  {
    slug: 'radioactive-decay-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Kinetics',
    title: 'Radioactive Decay Calculator: Amount Left After Time',
    h1: 'Radioactive Decay Calculator',
    metaDescription:
      'Find how much of a radioactive sample remains after a time from its starting amount and half-life, with the fraction left and the decay constant.',
    about:
      'Radioactive nuclei decay at random, but a large sample follows a steady pattern: after each half-life, half of the remaining atoms are gone. The amount left after any time is the starting amount multiplied by one half raised to the number of half-lives that have passed. Enter the starting amount in any unit, the half-life and the elapsed time in the same time unit, and the page returns the amount remaining, the fraction left, the amount that has decayed and the decay constant. This is the same exponential law that governs carbon dating and the dose decay of medical tracers.',
    inputs: [
      field('n0', 'Starting amount', 100, 0, 1e15),
      field('half', 'Half-life', 5730, 1e-9, 1e15),
      field('time', 'Elapsed time (same unit)', 5730, 0, 1e15),
    ],
    outputs: [
      { name: 'left', label: 'Amount remaining', format: 'text', highlight: true },
      { name: 'fraction', label: 'Fraction remaining', format: 'text' },
      { name: 'decayed', label: 'Amount decayed', format: 'text' },
      { name: 'lambda', label: 'Decay constant λ', format: 'text' },
    ],
    calculate: (i) => {
      const fraction = new D(2).pow(toD(i.time).div(toD(i.half)).neg());
      const left = toD(i.n0).mul(fraction);
      return {
        left: fmtNumber(left, 3),
        fraction: `${fmtNumber(fraction.mul(100), 3)}%`,
        decayed: fmtNumber(toD(i.n0).minus(left), 3),
        lambda: `${sci(LN2.div(toD(i.half)), 3)} per time unit`,
      };
    },
    formulaDescription: 'N = N0 × (1/2)^(t ÷ half-life). Decay constant λ = ln 2 ÷ half-life, and N = N0 × e^(−λt).',
    workedExample:
      '100 g of carbon-14 (half-life 5,730 years) after 5,730 years is 50 g. 80 units with a half-life of 10 after 25 is 80 × 2^-2.5 = 14.142, and 100 with a half-life of 8 after 24 is 12.5.',
    faq: [
      {
        question: 'Does the sample ever reach zero?',
        answer: 'In the equation it never does, but a real sample has a finite number of atoms, so eventually none is left.',
      },
      {
        question: 'How is it different from the half-life calculator?',
        answer: 'That page finds a half-life from measured data. This one goes forward from a known half-life to the amount left.',
      },
      { question: 'What units can I use?', answer: 'Any amount unit, and any time unit as long as the half-life and elapsed time match.' },
    ],
    scenarios: mixed(
      'radioactive-decay-calculator',
      8,
      (r) => ({ n0: r(5, 800), half: r(0.5, 480), time: r(0.2, 900) }),
      (v) => `${v.n0} units with half-life ${v.half} after ${v.time}`,
    ),
    introOutputs: ['left'],
    relatedSlugs: ['half-life-calculator', 'radiocarbon-dating-calculator'],
    checks: [
      { inputs: {}, expect: { left: '50', fraction: '50%', decayed: '50', lambda: '1.210 × 10^-4 per time unit' } },
      { inputs: { half: 8, time: 24 }, expect: { left: '12.5', fraction: '12.5%' } },
      { inputs: { n0: 80, half: 10, time: 25 }, expect: { left: '14.142' } },
    ],
  },
  {
    slug: 'young-laplace-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Physical chemistry',
    title: 'Young-Laplace Equation Calculator: Pressure Across a Curved Surface',
    h1: 'Young-Laplace Equation Calculator',
    metaDescription:
      'Calculate the pressure difference across a curved liquid surface from the surface tension and radius for a droplet, a soap bubble or a cylinder.',
    about:
      'A curved liquid surface behaves like a stretched skin, and surface tension makes the pressure inside a droplet or bubble higher than outside. The Young-Laplace equation gives the difference. For a spherical drop it is two times the surface tension divided by the radius. A soap bubble has two surfaces, inside and outside, so the pressure difference is twice as large. For a long cylinder such as a jet, it is the surface tension divided by the radius. Enter the shape, the surface tension in millinewtons per metre and the radius in millimetres. Smaller radii give larger pressures.',
    inputs: [
      select('shape', 'Shape', 'sphere', [
        ['sphere', 'Droplet or gas bubble in liquid (one surface)'],
        ['bubble', 'Soap bubble (two surfaces)'],
        ['cylinder', 'Cylinder or jet'],
      ]),
      field('gamma', 'Surface tension (mN/m)', 72, 0.1, 1000),
      field('r', 'Radius (mm)', 1, 0.0001, 1000),
    ],
    outputs: [
      { name: 'dp', label: 'Pressure difference', format: 'text', highlight: true },
      { name: 'kpa', label: 'In kilopascals', format: 'text' },
    ],
    calculate: (i) => {
      const k = { sphere: '2', bubble: '4', cylinder: '1' }[String(i.shape)] ?? '2';
      const dp = new D(k).mul(toD(i.gamma).div(1000)).div(toD(i.r).div(1000));
      return { dp: `${fmtNumber(dp, 1)} Pa`, kpa: `${fmtNumber(dp.div(1000), 4)} kPa` };
    },
    formulaDescription:
      'Droplet or single-surface bubble: ΔP = 2γ ÷ r. Soap bubble (two surfaces): ΔP = 4γ ÷ r. Cylinder: ΔP = γ ÷ r. γ in N/m and r in metres.',
    workedExample:
      'A water droplet (72 mN/m) of radius 1 mm has ΔP = 2 × 0.072 ÷ 0.001 = 144 Pa. A soap bubble of the same size gives 288 Pa and a 1 mm cylinder 72 Pa.',
    faq: [
      {
        question: 'Why does a small bubble have a higher pressure?',
        answer: 'The pressure difference is inversely proportional to the radius, so the smaller the bubble, the more strongly the skin squeezes the gas.',
      },
      { question: 'Why does a soap bubble need 4?', answer: 'A film has an inner and an outer surface, each contributing 2γ ÷ r.' },
      { question: 'What is typical surface tension?', answer: 'Water is 72 mN/m at 25 °C, ethanol 22 and mercury about 485.' },
    ],
    scenarios: varied(
      'young-laplace-calculator',
      8,
      [
        { name: 'gamma', lo: 18, hi: 480 },
        { name: 'r', lo: 0.01, hi: 40, step: 0.01 },
      ],
      [{ name: 'shape', options: ['sphere', 'bubble', 'cylinder'] }],
      (v) => `${v.shape} with ${v.gamma} mN/m and radius ${v.r} mm`,
    ),
    introOutputs: ['dp'],
    relatedSlugs: ['osmotic-pressure-calculator', 'partial-pressure-calculator'],
    checks: [
      { inputs: {}, expect: { dp: '144 Pa', kpa: '0.144 kPa' } },
      { inputs: { shape: 'bubble' }, expect: { dp: '288 Pa' } },
      { inputs: { shape: 'cylinder' }, expect: { dp: '72 Pa' } },
      { inputs: { gamma: 25, r: 0.05 }, expect: { dp: '1,000 Pa', kpa: '1 kPa' } },
    ],
  },
  {
    slug: 'chemical-oxygen-demand-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Environmental chemistry',
    title: 'Chemical Oxygen Demand (COD) Calculator from Titration',
    h1: 'Chemical Oxygen Demand Calculator',
    metaDescription:
      'Calculate chemical oxygen demand in mg O2 per litre from the blank and sample titration volumes, the titrant molarity and the sample volume.',
    about:
      'Chemical oxygen demand measures how much oxygen is needed to oxidise everything oxidisable in a water sample, and it is a standard indicator of organic pollution in wastewater and rivers. In the dichromate method, the sample is refluxed with an excess of potassium dichromate and the leftover dichromate is titrated with ferrous ammonium sulfate. A blank without sample shows how much dichromate there was, and the difference between the blank and the sample titrations measures what the sample consumed. Enter the two titration volumes, the molarity of the titrant and the volume of sample, and read the result in milligrams of oxygen per litre.',
    inputs: [
      field('blank', 'Titrant for the blank (mL)', 25, 0, 200),
      field('sample', 'Titrant for the sample (mL)', 12, 0, 200),
      field('m', 'Titrant molarity (mol/L)', 0.25, 0.001, 2),
      field('v', 'Sample volume (mL)', 20, 1, 1000),
    ],
    outputs: [
      { name: 'cod', label: 'Chemical oxygen demand', format: 'text', highlight: true },
      { name: 'kg', label: 'Kilograms of O2 per cubic metre', format: 'text' },
    ],
    calculate: (i) => {
      const cod = toD(i.blank).minus(toD(i.sample)).mul(toD(i.m)).mul(8000).div(toD(i.v));
      return { cod: `${fmtNumber(cod, 1)} mg O2/L`, kg: `${fmtNumber(cod.div(1000), 4)} kg/m³` };
    },
    formulaDescription:
      'COD (mg O2/L) = (A − B) × M × 8,000 ÷ V, where A and B are mL of titrant for blank and sample, M the molarity of the titrant and V the sample volume in mL. 8,000 is the milligrams of oxygen equivalent to one mole of electrons.',
    workedExample: 'Blank 25.0 mL, sample 12.0 mL, 0.25 M titrant, 20 mL of sample: (25 − 12) × 0.25 × 8,000 ÷ 20 = 1,300 mg O2/L.',
    faq: [
      {
        question: 'How does COD differ from BOD?',
        answer:
          'BOD is the oxygen microbes use in five days. COD uses a chemical oxidant and takes hours, so it is faster and also counts things microbes cannot digest.',
      },
      {
        question: 'What is a high COD?',
        answer: 'Clean surface water is under 20 mg/L, treated effluent may be under 100, and raw sewage is several hundred.',
      },
      {
        question: 'What goes wrong in the test?',
        answer: 'Chloride interferes and is masked with mercuric sulfate; a small sample volume increases errors, so dilute strong samples first.',
      },
    ],
    scenarios: mixed(
      'chemical-oxygen-demand-calculator',
      8,
      (r) => ({ blank: r(20, 30), sample: r(4, 19), m: r(0.04, 0.3), v: Math.round(r(5, 50)) }),
      (v) => `blank ${v.blank} mL, sample ${v.sample} mL, ${v.m} M, ${v.v} mL`,
    ),
    introOutputs: ['cod'],
    relatedSlugs: ['water-hardness-calculator', 'hydraulic-retention-time-calculator'],
    checks: [
      { inputs: {}, expect: { cod: '1,300 mg O2/L', kg: '1.3 kg/m³' } },
      { inputs: { blank: 10, sample: 4.5, m: 0.1, v: 50 }, expect: { cod: '88 mg O2/L' } },
      { inputs: { blank: 25, sample: 25 }, expect: { cod: '0 mg O2/L' } },
    ],
  },
  {
    slug: 'combustion-analysis-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Organic chemistry',
    title: 'Combustion Analysis Calculator: Empirical Formula from CO2 and H2O',
    h1: 'Combustion Analysis Calculator',
    metaDescription:
      'Find the percent carbon, hydrogen and oxygen and the empirical formula of an organic compound from the masses of CO2 and H2O produced on burning.',
    about:
      'In combustion analysis a weighed sample of an organic compound is burned in oxygen, and the carbon dioxide and water produced are collected and weighed. All the carbon of the sample ends up in the carbon dioxide and all the hydrogen in the water, so their masses tell how much of each element the sample held. Oxygen is found by difference. Enter the sample mass and the masses of carbon dioxide and water, and the page gives the percentages and the empirical formula. If you add the molar mass it also gives the molecular formula. It assumes a compound of carbon, hydrogen and possibly oxygen.',
    inputs: [
      field('sample', 'Sample mass (g)', 1, 0.0001, 1000),
      field('co2', 'CO2 collected (g)', 1.911, 0, 5000),
      field('h2o', 'H2O collected (g)', 1.173, 0, 5000),
      field('molar', 'Molar mass (g/mol, 0 if unknown)', 0, 0, 100000),
    ],
    outputs: [
      { name: 'c', label: 'Carbon', format: 'text' },
      { name: 'h', label: 'Hydrogen', format: 'text' },
      { name: 'o', label: 'Oxygen (by difference)', format: 'text' },
      { name: 'empirical', label: 'Empirical formula', format: 'text', highlight: true },
      { name: 'molecular', label: 'Molecular formula', format: 'text' },
    ],
    calculate: (i) => {
      const sample = toD(i.sample);
      const mC = toD(i.co2).mul(ATOMIC_MASS.C).div('44.009');
      const mH = toD(i.h2o).mul(2).mul(ATOMIC_MASS.H).div('18.015');
      const mO = sample.minus(mC).minus(mH);
      if (mO.lt(sample.mul('-0.01')))
        return { c: '-', h: '-', o: '-', empirical: 'The CO2 and H2O weigh more carbon and hydrogen than the sample: check the masses', molecular: '-' };
      const hasO = mO.gt(sample.mul('0.005'));
      const pct = (m: Dec) => `${fmtNumber(m.div(sample).mul(100), 2)}%`;
      if (mC.isZero() || mH.isZero()) return { c: pct(mC), h: pct(mH), o: pct(mO), empirical: 'Both CO2 and H2O must be present', molecular: '-' };
      const symbols = hasO ? ['C', 'H', 'O'] : ['C', 'H'];
      const moles = [mC.div(ATOMIC_MASS.C), mH.div(ATOMIC_MASS.H), ...(hasO ? [mO.div(ATOMIC_MASS.O)] : [])];
      const smallest = moles.reduce((a, b) => (a.lt(b) ? a : b));
      const counts = wholeNumberRatio(moles.map((m) => m.div(smallest)));
      if (!counts) return { c: pct(mC), h: pct(mH), o: hasO ? pct(mO) : '0%', empirical: 'No simple whole-number ratio found: check the data', molecular: '-' };
      const formulaMass = counts.reduce((sum, n, k) => sum.plus(new D(ATOMIC_MASS[symbols[k]]).mul(n)), new D(0));
      let molecular = 'Enter the molar mass to find it';
      if (toD(i.molar).gt(0)) {
        const factor = toD(i.molar).div(formulaMass).toDecimalPlaces(0);
        molecular = factor.gte(1)
          ? hillFormula(
              symbols,
              counts.map((n) => n.mul(factor)),
            )
          : 'The molar mass is below the empirical formula mass';
      }
      return { c: pct(mC), h: pct(mH), o: hasO ? pct(mO) : '0%', empirical: hillFormula(symbols, counts), molecular };
    },
    formulaDescription:
      'Carbon mass = CO2 mass × 12.011 ÷ 44.009. Hydrogen mass = H2O mass × 2.016 ÷ 18.015. Oxygen = sample − carbon − hydrogen. Then moles of each, divide by the smallest, and scale to whole numbers.',
    workedExample:
      '1.000 g gives 1.911 g CO2 and 1.173 g H2O: C 0.5216 g (52.16%), H 0.1313 g (13.13%), O by difference 0.3472 g (34.72%). The mole ratio is 2.001 : 6.001 : 1, so C2H6O.',
    faq: [
      {
        question: 'Why is oxygen found by difference?',
        answer:
          'The oxygen in the products comes partly from the air, so it cannot show how much the sample held. Whatever mass is left over is assumed to be oxygen.',
      },
      {
        question: 'What if there is no oxygen?',
        answer: 'If the leftover mass is within half a percent of the sample, the page treats it as a hydrocarbon and omits oxygen.',
      },
      { question: 'Can it find nitrogen or sulfur?', answer: 'Not here. Those need separate measurements, such as the Kjeldahl method for nitrogen.' },
    ],
    scenarios: [
      withInputs('1.000 g with 1.911 g CO2 and 1.173 g H2O', { sample: 1, co2: 1.911, h2o: 1.173, molar: 0 }),
      withInputs('0.100 g with 0.2994 g CO2 and 0.1634 g H2O', { sample: 0.1, co2: 0.2994, h2o: 0.1634, molar: 0 }),
      withInputs('0.500 g with 0.733 g CO2 and 0.300 g H2O', { sample: 0.5, co2: 0.733, h2o: 0.3, molar: 0 }),
      withInputs('0.2500 g with 0.3664 g CO2 and 0.1501 g H2O', { sample: 0.25, co2: 0.3664, h2o: 0.1501, molar: 0 }),
      withInputs('0.8000 g with 1.1737 g CO2 and 0.4806 g H2O, molar mass 60.05', { sample: 0.8, co2: 1.1737, h2o: 0.4806, molar: 60.05 }),
      withInputs('2.000 g with 5.953 g CO2 and 2.436 g H2O, molar mass 92.14', { sample: 2, co2: 5.953, h2o: 2.436, molar: 92.14 }),
    ],
    introOutputs: ['empirical'],
    relatedSlugs: ['empirical-formula-calculator', 'percent-composition-calculator'],
    checks: [
      { inputs: {}, expect: { c: '52.16%', h: '13.13%', o: '34.72%', empirical: 'C2H6O', molecular: 'Enter the molar mass to find it' } },
      { inputs: { sample: 0.1, co2: 0.2994, h2o: 0.1634 }, expect: { empirical: 'C3H8', o: '0%' } },
      { inputs: { sample: 0.8, co2: 1.1737, h2o: 0.4806, molar: 60.05 }, expect: { empirical: 'CH2O', molecular: 'C2H4O2' } },
    ],
  },
  {
    slug: 'combustion-reaction-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Organic chemistry',
    title: 'Combustion Reaction Calculator for Hydrocarbons',
    h1: 'Combustion Reaction Calculator',
    metaDescription: 'Balance the complete combustion of a hydrocarbon CxHy and find the oxygen needed and the CO2 and water produced from a mass of fuel.',
    about:
      'A hydrocarbon burns completely in oxygen to give carbon dioxide and water. For a molecule with x carbon atoms and y hydrogen atoms, each mole needs x plus y over four moles of oxygen and makes x moles of carbon dioxide and y over two moles of water. Enter the numbers of carbon and hydrogen atoms and the mass of fuel, and the page writes the balanced equation with whole-number coefficients, then converts to the mass of oxygen consumed and of carbon dioxide and water produced. The masses of reactants and products match, which is a good way to check the answer.',
    inputs: [intField('x', 'Carbon atoms (x)', 3, 1, 30), intField('y', 'Hydrogen atoms (y)', 8, 1, 62), field('grams', 'Mass of fuel (g)', 100, 0, 1e9)],
    outputs: [
      { name: 'equation', label: 'Balanced equation', format: 'text', highlight: true },
      { name: 'moles', label: 'Moles of fuel', format: 'text' },
      { name: 'o2', label: 'Oxygen needed', format: 'text' },
      { name: 'co2', label: 'CO2 produced', format: 'text' },
      { name: 'h2o', label: 'Water produced', format: 'text' },
    ],
    calculate: (i) => {
      const x = Number(i.x);
      const y = Number(i.y);
      if (y > 2 * x + 2) return { equation: 'Too many hydrogens for a hydrocarbon with that many carbons', moles: '-', o2: '-', co2: '-', h2o: '-' };
      const fuelMass = new D(ATOMIC_MASS.C).mul(x).plus(new D(ATOMIC_MASS.H).mul(y));
      const moles = toD(i.grams).div(fuelMass);
      let coefficients = [BigInt(4), BigInt(4 * x + y), BigInt(4 * x), BigInt(2 * y)];
      const g = coefficients.reduce((a, b) => {
        let p = a;
        let q = b;
        while (q !== ZERO) [p, q] = [q, p % q];
        return p;
      }, ZERO);
      coefficients = coefficients.map((c) => c / g);
      const co = (c: bigint) => (c === ONE ? '' : `${c} `);
      const fuel = `C${x === 1 ? '' : x}H${y === 1 ? '' : y}`;
      return {
        equation: `${co(coefficients[0])}${fuel} + ${co(coefficients[1])}O2 → ${co(coefficients[2])}CO2 + ${co(coefficients[3])}H2O`,
        moles: fmtNumber(moles, 4),
        o2: `${fmtNumber(moles.mul(new D(x).plus(new D(y).div(4))).mul('31.998'), 1)} g`,
        co2: `${fmtNumber(moles.mul(x).mul('44.009'), 1)} g`,
        h2o: `${fmtNumber(moles.mul(y).div(2).mul('18.015'), 1)} g`,
      };
    },
    formulaDescription:
      'CxHy + (x + y/4) O2 → x CO2 + (y/2) H2O. Multiply through by 4 and divide out the common factor for whole numbers. Masses use 12.011, 1.008, 31.998 (O2), 44.009 (CO2) and 18.015 (H2O) g/mol.',
    workedExample:
      '100 g of propane C3H8 (44.097 g/mol) is 2.2677 mol. C3H8 + 5 O2 → 3 CO2 + 4 H2O needs 362.8 g of oxygen and makes 299.4 g of CO2 and 163.4 g of water. 100 + 362.8 = 462.8 = 299.4 + 163.4.',
    faq: [
      {
        question: 'Why are coefficients sometimes fractions?',
        answer: 'Oxygen needs x + y/4, which can be a fraction. Multiplying every coefficient by 4 and simplifying gives whole numbers.',
      },
      {
        question: 'What about incomplete combustion?',
        answer: 'With too little oxygen, carbon monoxide or soot forms instead of carbon dioxide. This page assumes complete burning.',
      },
      {
        question: 'Does it work for alcohols?',
        answer:
          'Only for hydrocarbons. Alcohols contain oxygen, so the oxygen demand is lower; use the heat of combustion page for ethanol and methanol energy.',
      },
    ],
    scenarios: mixed(
      'combustion-reaction-calculator',
      8,
      (r) => {
        const x = Math.round(r(1, 12));
        return { x, y: 2 * x + 2 - 2 * Math.round(r(0, Math.min(3, x))), grams: Math.round(r(5, 900)) };
      },
      (v) => `C${v.x}H${v.y}, ${v.grams} g`,
    ),
    introOutputs: ['equation'],
    relatedSlugs: ['heat-of-combustion-calculator', 'chemical-equation-balancer'],
    checks: [
      { inputs: {}, expect: { equation: 'C3H8 + 5 O2 → 3 CO2 + 4 H2O', moles: '2.2677', o2: '362.8 g', co2: '299.4 g', h2o: '163.4 g' } },
      {
        inputs: { x: 2, y: 6, grams: 50 },
        expect: { equation: '2 C2H6 + 7 O2 → 4 CO2 + 6 H2O', moles: '1.6628', o2: '186.2 g', co2: '146.4 g', h2o: '89.9 g' },
      },
      { inputs: { x: 1, y: 4 }, expect: { equation: 'CH4 + 2 O2 → CO2 + 2 H2O' } },
      { inputs: { x: 1, y: 5 }, expect: { equation: 'Too many hydrogens for a hydrocarbon with that many carbons' } },
    ],
  },
  {
    slug: 'crude-protein-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Analytical chemistry',
    title: 'Crude Protein Calculator from Nitrogen (Kjeldahl Factor)',
    h1: 'Crude Protein Calculator',
    metaDescription: 'Convert the nitrogen content found by Kjeldahl or Dumas analysis into crude protein with the standard factor for the food type.',
    about:
      'Protein is not measured directly in routine food analysis. Instead the nitrogen content is determined, by the Kjeldahl digestion or by combustion, and multiplied by a factor that assumes proteins contain about 16 percent nitrogen, which is the familiar 6.25. Some foods have a different average nitrogen share in their protein, so specific factors are used for wheat, rice, soybeans and dairy. The result is called crude protein because it counts all nitrogen, including non-protein sources. Enter the nitrogen percentage, choose the factor and give the sample mass for the grams of protein.',
    inputs: [
      field('n', 'Nitrogen (% of sample)', 2.4, 0, 20),
      select('factor', 'Conversion factor', '6.25', N_FACTORS),
      field('mass', 'Sample mass (g)', 50, 0, 1e6),
    ],
    outputs: [
      { name: 'pct', label: 'Crude protein', format: 'text', highlight: true },
      { name: 'grams', label: 'Protein in the sample', format: 'text' },
    ],
    calculate: (i) => {
      const pct = toD(i.n).mul(String(i.factor));
      return { pct: `${fmtNumber(pct, 2)}%`, grams: `${fmtNumber(pct.mul(toD(i.mass)).div(100), 2)} g` };
    },
    formulaDescription: 'Crude protein % = nitrogen % × factor. Protein mass = protein % × sample mass ÷ 100. The default factor 6.25 is 100 ÷ 16.',
    workedExample: '2.4% nitrogen × 6.25 = 15% crude protein; in a 50 g sample that is 7.5 g. Milk at 3.3% nitrogen with the 6.38 factor is 21.05%.',
    faq: [
      {
        question: 'Why is it called crude?',
        answer: 'Because the method counts nitrogen from every source, such as urea and nucleic acids, not just amino acids in protein.',
      },
      { question: 'Why 6.25?', answer: 'Proteins are about 16 percent nitrogen by weight, and 100 ÷ 16 = 6.25.' },
      {
        question: 'Does it work for feed and food labels?',
        answer: 'Yes, it is the common basis of labels and feed tables, though it can overstate protein in products with added nitrogen compounds.',
      },
    ],
    scenarios: varied(
      'crude-protein-calculator',
      8,
      [
        { name: 'n', lo: 0.4, hi: 8, step: 0.05 },
        { name: 'mass', lo: 5, hi: 900 },
      ],
      [{ name: 'factor', options: ['6.25', '5.7', '5.95', '5.71', '6.38'] }],
      (v) => `${v.n}% nitrogen, factor ${v.factor}, ${v.mass} g`,
    ),
    introOutputs: ['pct'],
    relatedSlugs: ['percent-composition-calculator', 'protein-concentration-calculator'],
    checks: [
      { inputs: {}, expect: { pct: '15%', grams: '7.5 g' } },
      { inputs: { n: 3.3, factor: '6.38' }, expect: { pct: '21.05%' } },
      { inputs: { factor: '5.7' }, expect: { pct: '13.68%' } },
    ],
  },
  {
    slug: 'calibration-curve-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Analytical chemistry',
    title: 'Calibration Curve Calculator: Linear Fit and Unknown Concentration',
    h1: 'Calibration Curve Calculator',
    metaDescription: 'Fit a straight line to standards and read the concentration of an unknown from its measured signal, with slope, intercept and R squared.',
    about:
      'A calibration curve links an instrument signal, such as absorbance or peak area, to the concentration of standards. A straight line fitted by least squares gives a slope and an intercept, and an unknown sample is read off by inverting the line. Enter the concentrations of your standards and the signals they produced in the same order, then the signal of the unknown. The page returns the slope, the intercept, the coefficient of determination R squared as a check on linearity, and the unknown concentration. It also warns when the unknown lies outside the range of the standards, because a line should not be extended without testing.',
    inputs: [
      list('x', 'Standard concentrations (comma separated)', '0, 2, 4, 6, 8, 10'),
      list('y', 'Signals of the standards, same order', '0.002, 0.151, 0.298, 0.449, 0.601, 0.748'),
      field('unknown', 'Signal of the unknown', 0.375, -1e9, 1e9),
    ],
    outputs: [
      { name: 'slope', label: 'Slope', format: 'text' },
      { name: 'intercept', label: 'Intercept', format: 'text' },
      { name: 'r2', label: 'R squared', format: 'text' },
      { name: 'conc', label: 'Concentration of the unknown', format: 'text', highlight: true },
      { name: 'range', label: 'Range check', format: 'text' },
    ],
    calculate: (i) => {
      const xs = parseNumberList(i.x);
      const ys = parseNumberList(i.y);
      const none = { slope: '-', intercept: '-', r2: '-', conc: '-', range: '-' };
      if (xs.length !== ys.length) return { ...none, conc: 'Enter the same number of concentrations and signals' };
      const n = new D(xs.length);
      const sum = (a: Dec[]) => a.reduce((s, v) => s.plus(v), new D(0));
      const sx = sum(xs);
      const sy = sum(ys);
      const sxx = sum(xs.map((v) => v.mul(v)));
      const syy = sum(ys.map((v) => v.mul(v)));
      const sxy = sum(xs.map((v, k) => v.mul(ys[k])));
      const denom = n.mul(sxx).minus(sx.mul(sx));
      if (denom.isZero()) return { ...none, conc: 'The standards need at least two different concentrations' };
      const slope = n.mul(sxy).minus(sx.mul(sy)).div(denom);
      if (slope.isZero()) return { ...none, conc: 'The signal does not change with concentration' };
      const intercept = sy.minus(slope.mul(sx)).div(n);
      const syyDenom = n.mul(syy).minus(sy.mul(sy));
      const r2 = syyDenom.isZero() ? new D(1) : n.mul(sxy).minus(sx.mul(sy)).pow(2).div(denom.mul(syyDenom));
      const unknown = toD(i.unknown);
      const x0 = unknown.minus(intercept).div(slope);
      const inside = x0.gte(xs.reduce((a, b) => (a.lt(b) ? a : b))) && x0.lte(xs.reduce((a, b) => (a.gt(b) ? a : b)));
      return {
        slope: fmtNumber(slope, 5),
        intercept: fmtNumber(intercept, 5),
        r2: fmtNumber(r2, 5),
        conc: fmtNumber(x0, 3),
        range: inside ? 'Inside the range of the standards' : 'Outside the range: this is an extrapolation',
      };
    },
    formulaDescription:
      'Least squares: slope = (nΣxy − ΣxΣy) ÷ (nΣx² − (Σx)²), intercept = (Σy − slope × Σx) ÷ n, R² = (nΣxy − ΣxΣy)² ÷ ((nΣx² − (Σx)²)(nΣy² − (Σy)²)). Unknown concentration = (signal − intercept) ÷ slope.',
    workedExample:
      'Standards 0, 2, 4, 6, 8, 10 give signals 0.002 to 0.748: slope 0.07473, intercept 0.00119, R² 0.99998. A signal of 0.375 corresponds to (0.375 − 0.00119) ÷ 0.07473 = 5.002.',
    faq: [
      {
        question: 'What is a good R squared?',
        answer: 'Above 0.995 is typical for a good analytical calibration, but a high value does not prove the data are linear. Look at the residuals as well.',
      },
      { question: 'Can I use a blank?', answer: 'Yes. Include a blank as a standard at zero concentration, or subtract its signal from every point.' },
      {
        question: 'What if the points curve?',
        answer: 'Use a narrower range, a transformation or a curved fit. A straight line through curved data biases the unknowns.',
      },
    ],
    scenarios: [
      withInputs('six standards, unknown 0.375', { x: '0, 2, 4, 6, 8, 10', y: '0.002, 0.151, 0.298, 0.449, 0.601, 0.748', unknown: 0.375 }),
      withInputs('the same standards, unknown 0.5', { x: '0, 2, 4, 6, 8, 10', y: '0.002, 0.151, 0.298, 0.449, 0.601, 0.748', unknown: 0.5 }),
      withInputs('five standards of a dye, unknown 1.2', { x: '0, 5, 10, 20, 40', y: '0.01, 0.31, 0.62, 1.22, 2.45', unknown: 1.2 }),
      withInputs('four phosphate standards, unknown 0.42', { x: '0.5, 1, 2, 4', y: '0.11, 0.22, 0.45, 0.89', unknown: 0.42 }),
      withInputs('three standards, signal outside the range', { x: '10, 20, 30', y: '105, 198, 305', unknown: 450 }),
      withInputs('seven peak areas, unknown 3500', { x: '1, 2, 5, 10, 25, 50, 100', y: '410, 830, 2080, 4160, 10400, 20800, 41700', unknown: 3500 }),
    ],
    introOutputs: ['conc'],
    relatedSlugs: ['beer-lambert-law-calculator', 'ppm-to-molarity-calculator'],
    checks: [
      { inputs: {}, expect: { slope: '0.07473', intercept: '0.00119', r2: '0.99998', conc: '5.002', range: 'Inside the range of the standards' } },
      { inputs: { unknown: 0.5 }, expect: { conc: '6.675' } },
      { inputs: { unknown: 2 }, expect: { range: 'Outside the range: this is an extrapolation' } },
      { inputs: { y: '1, 2, 3' }, expect: { conc: 'Enter the same number of concentrations and signals' } },
    ],
  },
  {
    slug: 'enzyme-activity-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Biochemistry',
    title: 'Enzyme Activity Calculator: Units per mL and Specific Activity',
    h1: 'Enzyme Activity Calculator',
    metaDescription:
      'Calculate enzyme activity in units per millilitre and specific activity per milligram from the change in absorbance per minute and the extinction coefficient.',
    about:
      'Enzyme activity is the rate at which an enzyme converts substrate, and it is reported in units, where one unit converts one micromole of substrate per minute under defined conditions. In a spectrophotometric assay the rate is followed as a change in absorbance per minute, and the Beer-Lambert law turns that into a concentration change using the extinction coefficient and path length. Enter the slope of the absorbance, the assay and enzyme volumes, the extinction coefficient and any dilution, and the page returns units per millilitre. If you give the protein concentration, it also returns the specific activity, the standard measure of purity.',
    inputs: [
      field('da', 'Change in absorbance per minute', 0.15, 0, 100),
      field('vt', 'Total assay volume (mL)', 3, 0.01, 1000),
      field('ve', 'Enzyme volume added (mL)', 0.05, 0.0001, 1000),
      field('eps', 'Extinction coefficient (mM⁻¹ cm⁻¹)', 6.22, 0.01, 1000),
      field('path', 'Path length (cm)', 1, 0.01, 10),
      field('df', 'Dilution factor of the enzyme', 1, 1, 1e9),
      field('protein', 'Protein concentration (mg/mL, 0 if unknown)', 0.5, 0, 1000),
    ],
    outputs: [
      { name: 'activity', label: 'Enzyme activity', format: 'text', highlight: true },
      { name: 'specific', label: 'Specific activity', format: 'text' },
    ],
    calculate: (i) => {
      const activity = toD(i.da)
        .mul(toD(i.vt))
        .mul(toD(i.df))
        .div(toD(i.eps).mul(toD(i.path)).mul(toD(i.ve)));
      return {
        activity: `${fmtNumber(activity, 3)} U/mL`,
        specific: toD(i.protein).gt(0) ? `${fmtNumber(activity.div(toD(i.protein)), 3)} U/mg` : 'Enter the protein concentration',
      };
    },
    formulaDescription:
      'Activity (U/mL) = (ΔA per min × total volume × dilution factor) ÷ (ε × path length × enzyme volume). Specific activity (U/mg) = activity ÷ protein concentration. With ε in mM⁻¹ cm⁻¹ the result is in µmol per minute.',
    workedExample:
      'ΔA = 0.15 per min in 3.0 mL with 0.05 mL of enzyme and NADH (ε = 6.22): 0.15 × 3 ÷ (6.22 × 1 × 0.05) = 1.447 U/mL. At 0.5 mg/mL protein that is 2.894 U/mg.',
    faq: [
      {
        question: 'What is the extinction coefficient of NADH?',
        answer: '6.22 mM⁻¹ cm⁻¹ at 340 nm, which is why many dehydrogenase assays follow that wavelength.',
      },
      {
        question: 'What is one unit?',
        answer: 'One micromole of substrate converted per minute at a stated temperature and pH. The katal, one mole per second, is the SI equivalent.',
      },
      {
        question: 'Should the rate be linear?',
        answer: 'Yes. Use the initial linear part of the absorbance curve, before substrate runs out or product slows the reaction.',
      },
    ],
    scenarios: mixed(
      'enzyme-activity-calculator',
      8,
      (r) => ({ da: r(0.02, 0.9), vt: r(1, 3.2), ve: r(0.01, 0.2), eps: r(1.5, 20), path: 1, df: Math.round(r(1, 200)), protein: r(0.05, 12) }),
      (v) => `ΔA ${v.da} per min, ${v.vt} mL assay, ${v.ve} mL enzyme, ε ${v.eps}, dilution ${v.df}, protein ${v.protein}`,
    ),
    introOutputs: ['activity'],
    relatedSlugs: ['michaelis-menten-calculator', 'beer-lambert-law-calculator'],
    checks: [
      { inputs: {}, expect: { activity: '1.447 U/mL', specific: '2.894 U/mg' } },
      { inputs: { da: 0.2, vt: 1, ve: 0.1, eps: 6, df: 10, protein: 0 }, expect: { activity: '3.333 U/mL', specific: 'Enter the protein concentration' } },
      { inputs: { da: 0 }, expect: { activity: '0 U/mL' } },
    ],
  },
  {
    slug: 'isoelectric-point-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Biochemistry',
    title: 'Isoelectric Point Calculator: pI from Two pKa Values',
    h1: 'Isoelectric Point Calculator',
    metaDescription:
      'Find the isoelectric point of an amino acid from the two pKa values on either side of its neutral form, and the sign of its net charge at a given pH.',
    about:
      'The isoelectric point, pI, is the pH at which a molecule such as an amino acid carries no net electric charge. It is found as the average of the two pKa values that surround the neutral form. For an amino acid with a side chain that does not ionise, these are the carboxyl and the amino group; for an acidic one, the two acid groups; for a basic one, the two basic groups. Enter those two pKa values and a working pH, and the page returns the pI and tells whether the molecule is positive, negative or neutral at that pH. Below the pI it is positive and above it negative.',
    inputs: [field('pk1', 'Lower pKa', 2.34, -5, 20), field('pk2', 'Upper pKa', 9.6, -5, 20), field('ph', 'Working pH', 7, 0, 14)],
    outputs: [
      { name: 'pi', label: 'Isoelectric point (pI)', format: 'text', highlight: true },
      { name: 'charge', label: 'Net charge at that pH', format: 'text' },
    ],
    calculate: (i) => {
      const pi = toD(i.pk1).plus(toD(i.pk2)).div(2);
      const ph = toD(i.ph);
      return { pi: fmtNumber(pi, 2), charge: ph.lt(pi) ? 'Positive (pH below pI)' : ph.gt(pi) ? 'Negative (pH above pI)' : 'Neutral overall (pH equals pI)' };
    },
    formulaDescription:
      'pI = (pKa1 + pKa2) ÷ 2, using the two pKa values that bracket the neutral (zwitterion) form. Net charge is positive below the pI and negative above it.',
    workedExample:
      'Glycine: pKa values 2.34 and 9.60 give pI = 5.97, so at pH 7 it is negative. Aspartic acid uses its two acid pKa values, 1.88 and 3.65, for pI = 2.77. Lysine uses 8.95 and 10.53 for 9.74.',
    faq: [
      {
        question: 'Which two values do I use?',
        answer:
          'Those on either side of the neutral form: for acidic residues the two lowest, for basic residues the two highest, otherwise the first and last.',
      },
      {
        question: 'Why does pI matter?',
        answer: 'Proteins are least soluble at their pI, and electrophoresis and ion exchange separate molecules by charge at a chosen pH.',
      },
      {
        question: 'Does it work for proteins?',
        answer: 'Not simply. A protein has many ionising groups, so its pI comes from a full titration or a sequence-based program.',
      },
    ],
    scenarios: mixed(
      'isoelectric-point-calculator',
      8,
      (r) => ({ pk1: r(1.5, 5), pk2: r(6.5, 12.5), ph: r(2, 12) }),
      (v) => `pKa ${v.pk1} and ${v.pk2} at pH ${v.ph}`,
    ),
    introOutputs: ['pi'],
    relatedSlugs: ['pka-calculator', 'henderson-hasselbalch-calculator'],
    checks: [
      { inputs: {}, expect: { pi: '5.97', charge: 'Negative (pH above pI)' } },
      { inputs: { pk1: 1.88, pk2: 3.65 }, expect: { pi: '2.77' } },
      { inputs: { pk1: 8.95, pk2: 10.53, ph: 7 }, expect: { pi: '9.74', charge: 'Positive (pH below pI)' } },
      { inputs: { ph: 5.97 }, expect: { charge: 'Neutral overall (pH equals pI)' } },
    ],
  },
  {
    slug: 'reaction-quotient-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Equilibrium',
    title: 'Reaction Quotient Calculator: Q, Direction and Gibbs Energy',
    h1: 'Reaction Quotient Calculator',
    metaDescription:
      'Calculate the reaction quotient Q for aA + bB to cC + dD, compare it with K to see the direction of shift, and find the Gibbs energy change.',
    about:
      'The reaction quotient Q has the same form as the equilibrium constant K but uses the concentrations present right now. Comparing the two shows which way a reaction mixture will move. If Q is smaller than K there are too few products, so the reaction proceeds forward. If Q is larger, it runs in reverse, and if they are equal the mixture is at equilibrium. Enter the concentrations and coefficients of up to two reactants and two products, set a coefficient to zero to leave a species out, then K and the temperature. The page also gives the Gibbs energy change of the reaction from R T ln(Q/K).',
    inputs: [
      field('a', 'Reactant A (mol/L)', 0.5, 0, 1e6),
      intField('na', 'Coefficient of A', 2, 0, 9),
      field('b', 'Reactant B (mol/L)', 1, 0, 1e6),
      intField('nb', 'Coefficient of B', 0, 0, 9),
      field('c', 'Product C (mol/L)', 0.2, 0, 1e6),
      intField('nc', 'Coefficient of C', 1, 0, 9),
      field('d', 'Product D (mol/L)', 1, 0, 1e6),
      intField('nd', 'Coefficient of D', 0, 0, 9),
      field('k', 'Equilibrium constant K', 2, 1e-12, 1e12),
      field('t', 'Temperature (K)', 298.15, 1, 3000),
    ],
    outputs: [
      { name: 'q', label: 'Reaction quotient Q', format: 'text', highlight: true },
      { name: 'direction', label: 'Direction', format: 'text' },
      { name: 'dg', label: 'ΔG = RT ln(Q/K)', format: 'text' },
    ],
    calculate: (i) => {
      const species: [Dec, number][] = [
        [toD(i.a), Number(i.na)],
        [toD(i.b), Number(i.nb)],
        [toD(i.c), Number(i.nc)],
        [toD(i.d), Number(i.nd)],
      ];
      if (species.some(([conc, coef]) => coef > 0 && conc.lte(0)))
        return { q: '-', direction: 'Every species with a coefficient needs a concentration above zero', dg: '-' };
      const reactants = species.slice(0, 2).reduce((p, [conc, coef]) => p.mul(conc.pow(coef)), new D(1));
      const products = species.slice(2).reduce((p, [conc, coef]) => p.mul(conc.pow(coef)), new D(1));
      if (species.slice(0, 2).every(([, coef]) => coef === 0) || species.slice(2).every(([, coef]) => coef === 0))
        return { q: '-', direction: 'Give at least one reactant and one product a coefficient', dg: '-' };
      const q = products.div(reactants);
      const k = toD(i.k);
      const dg = R_GAS.mul(toD(i.t)).mul(q.div(k).ln()).div(1000);
      const direction = q.lt(k) ? 'Shifts toward products (Q < K)' : q.gt(k) ? 'Shifts toward reactants (Q > K)' : 'At equilibrium (Q = K)';
      return { q: sig4(q), direction, dg: `${fmtNumber(dg, 3)} kJ/mol` };
    },
    formulaDescription:
      'Q = ([C]^c × [D]^d) ÷ ([A]^a × [B]^b), with a coefficient of 0 leaving a species out. If Q < K the reaction goes forward; if Q > K it goes in reverse. ΔG = R T ln(Q ÷ K), with R = 8.314 J/(mol·K).',
    workedExample:
      '2 A ⇌ C with [A] = 0.5, [C] = 0.2 and K = 2: Q = 0.2 ÷ 0.5² = 0.8, below K, so products form, and ΔG = 8.314 × 298.15 × ln(0.4) ÷ 1,000 = −2.271 kJ/mol.',
    faq: [
      { question: 'What if Q equals K?', answer: 'The mixture is at equilibrium. There is no net change and ΔG is zero.' },
      { question: 'Do solids and pure liquids go in Q?', answer: 'No. Their activities are 1, so leave them out by giving them a coefficient of zero.' },
      {
        question: 'Is ΔG here the standard value?',
        answer: 'No. It is the actual Gibbs energy change at the current composition. A negative value means the forward reaction is spontaneous.',
      },
    ],
    scenarios: mixed(
      'reaction-quotient-calculator',
      8,
      (r) => ({
        a: r(0.05, 2),
        na: Math.round(r(1, 3)),
        b: r(0.05, 2),
        nb: Math.round(r(0, 2)),
        c: r(0.05, 2),
        nc: Math.round(r(1, 3)),
        d: r(0.05, 2),
        nd: Math.round(r(0, 2)),
        k: r(0.1, 60),
        t: Math.round(r(280, 500)),
      }),
      (v) => `A ${v.a}×${v.na}, B ${v.b}×${v.nb} to C ${v.c}×${v.nc}, D ${v.d}×${v.nd}, K ${v.k}, ${v.t} K`,
    ),
    introOutputs: ['q'],
    relatedSlugs: ['equilibrium-constant-calculator', 'gibbs-free-energy-calculator'],
    checks: [
      { inputs: {}, expect: { q: '0.8', direction: 'Shifts toward products (Q < K)', dg: '-2.271 kJ/mol' } },
      { inputs: { c: 0.8 }, expect: { q: '3.2', direction: 'Shifts toward reactants (Q > K)', dg: '1.165 kJ/mol' } },
      { inputs: { k: 0.8 }, expect: { direction: 'At equilibrium (Q = K)', dg: '0 kJ/mol' } },
      { inputs: { nc: 0 }, expect: { direction: 'Give at least one reactant and one product a coefficient' } },
    ],
  },
  {
    slug: 'air-fuel-ratio-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Combustion',
    title: 'Air-Fuel Ratio Calculator: AFR, Lambda and Equivalence Ratio',
    h1: 'Air-Fuel Ratio Calculator',
    metaDescription:
      'Calculate the air-fuel ratio of a mixture, its lambda and equivalence ratio and whether it is lean, rich or stoichiometric for common fuels.',
    about:
      'The air-fuel ratio is the mass of air divided by the mass of fuel in a combustion mixture. Each fuel has a chemically correct, or stoichiometric, ratio at which there is exactly enough oxygen to burn all of it, about 14.7 to 1 for petrol. Lambda is the actual ratio divided by that value, so a lambda above 1 means a lean mixture with spare air and below 1 a rich one with spare fuel. The equivalence ratio is the inverse. Choose the fuel, enter the masses of air and fuel, and the page returns the ratio, lambda, equivalence ratio and the state of the mixture.',
    inputs: [
      select('fuel', 'Fuel (stoichiometric AFR)', 'gasoline', AFR_OPTIONS),
      field('air', 'Mass of air', 15.5, 0.001, 1e9),
      field('fuelMass', 'Mass of fuel (same unit)', 1, 0.0001, 1e9),
    ],
    outputs: [
      { name: 'afr', label: 'Air-fuel ratio', format: 'text', highlight: true },
      { name: 'lambda', label: 'Lambda', format: 'text' },
      { name: 'phi', label: 'Equivalence ratio', format: 'text' },
      { name: 'state', label: 'Mixture', format: 'text' },
    ],
    calculate: (i) => {
      const stoich = AFR_FUELS[String(i.fuel)]?.afr ?? '14.7';
      const afr = toD(i.air).div(toD(i.fuelMass));
      const lambda = afr.div(stoich);
      const state = lambda.minus(1).abs().lt('0.005') ? 'Stoichiometric' : lambda.gt(1) ? 'Lean (spare air)' : 'Rich (spare fuel)';
      return { afr: `${fmtNumber(afr, 2)} : 1`, lambda: fmtNumber(lambda, 3), phi: fmtNumber(new D(1).div(lambda), 3), state };
    },
    formulaDescription:
      'AFR = mass of air ÷ mass of fuel. Lambda = AFR ÷ stoichiometric AFR. Equivalence ratio φ = 1 ÷ lambda. Lambda above 1 is lean, below 1 is rich.',
    workedExample:
      '15.5 kg of air with 1 kg of petrol (stoichiometric 14.7) is AFR 15.5, lambda 1.054, equivalence ratio 0.948: slightly lean. 12.5 to 1 is lambda 0.850, a rich mixture with φ = 1.176.',
    faq: [
      {
        question: 'Why are engines run rich sometimes?',
        answer: 'A rich mixture gives more power and cools the cylinder under load and during cold starts. A lean mixture saves fuel but burns hotter.',
      },
      {
        question: 'What does a lambda sensor read?',
        answer: 'The oxygen left in the exhaust, which it converts into lambda, so a petrol engine can hold the mixture close to 1.',
      },
      { question: 'Why is hydrogen 34.3?', answer: 'Hydrogen is so light that a kilogram needs a great mass of air to supply the oxygen it burns with.' },
    ],
    scenarios: varied(
      'air-fuel-ratio-calculator',
      8,
      [
        { name: 'air', lo: 5, hi: 40, step: 0.1 },
        { name: 'fuelMass', lo: 0.5, hi: 3, step: 0.1 },
      ],
      [{ name: 'fuel', options: ['gasoline', 'diesel', 'ethanol', 'methanol', 'methane', 'propane', 'hydrogen'] }],
      (v) => `${v.air} of air with ${v.fuelMass} of ${v.fuel}`,
    ),
    introOutputs: ['lambda'],
    relatedSlugs: ['combustion-reaction-calculator', 'heat-of-combustion-calculator'],
    checks: [
      { inputs: {}, expect: { afr: '15.5 : 1', lambda: '1.054', phi: '0.948', state: 'Lean (spare air)' } },
      { inputs: { air: 14.7 }, expect: { lambda: '1', state: 'Stoichiometric' } },
      { inputs: { air: 12.5 }, expect: { lambda: '0.85', phi: '1.176', state: 'Rich (spare fuel)' } },
    ],
  },
  {
    slug: 'residence-time-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Process chemistry',
    title: 'Residence Time Calculator for Reactors and Tanks',
    h1: 'Residence Time Calculator',
    metaDescription:
      'Find the mean residence time of a fluid in a stirred tank or reactor from its volume and flow rate, with turnovers per hour and the washout time.',
    about:
      'The mean residence time is how long, on average, a fluid stays in a vessel, and it equals the volume divided by the volumetric flow rate. It is a basic design number for flow reactors, mixing tanks and chemostats, because a reaction needs a residence time at least as long as it takes to finish. Enter the working volume in litres and the flow in litres per minute, and the page gives the time in minutes and hours, the number of times the volume is replaced each hour, and the time for a well-mixed tank to flush 95 percent of its original contents.',
    inputs: [field('v', 'Working volume (L)', 500, 0.001, 1e9), field('q', 'Flow rate (L/min)', 25, 0.0001, 1e9)],
    outputs: [
      { name: 'tau', label: 'Mean residence time', format: 'text', highlight: true },
      { name: 'hours', label: 'In hours', format: 'text' },
      { name: 'turn', label: 'Volume replaced per hour', format: 'text' },
      { name: 'wash', label: 'Time to flush 95%', format: 'text' },
    ],
    calculate: (i) => {
      const tau = toD(i.v).div(toD(i.q));
      return {
        tau: `${fmtNumber(tau, 2)} min`,
        hours: `${fmtNumber(tau.div(60), 3)} h`,
        turn: fmtNumber(new D(60).div(tau), 3),
        wash: `${fmtNumber(tau.mul(new D(20).ln()), 2)} min`,
      };
    },
    formulaDescription:
      'τ = V ÷ Q. Turnovers per hour = 60 ÷ τ (τ in minutes). For a perfectly mixed tank the fraction left falls as e^(−t ÷ τ), so 95% is flushed at t = τ × ln 20 ≈ 3τ.',
    workedExample: 'A 500 L tank with 25 L/min through it has τ = 20 min, 0.333 h, 3 turnovers per hour, and flushes 95% of its contents in 59.91 min.',
    faq: [
      {
        question: 'Is it the same for every molecule?',
        answer:
          'No. The mean is an average. In a stirred tank some fluid leaves quickly and some stays much longer, which a residence time distribution describes.',
      },
      {
        question: 'How is it different from hydraulic retention time?',
        answer:
          'They are the same idea. Wastewater engineers call it hydraulic retention time, use cubic metres and days, and often say detention time for settling basins.',
      },
      { question: 'What if the density changes?', answer: 'Use volumetric flow measured at the conditions inside the vessel, not at the inlet.' },
    ],
    scenarios: mixed(
      'residence-time-calculator',
      8,
      (r) => ({ v: Math.round(r(20, 9000)), q: r(0.5, 480) }),
      (v) => `${v.v} L at ${v.q} L/min`,
    ),
    introOutputs: ['tau'],
    relatedSlugs: ['hydraulic-retention-time-calculator', 'detention-time-calculator'],
    checks: [
      { inputs: {}, expect: { tau: '20 min', hours: '0.333 h', turn: '3', wash: '59.91 min' } },
      { inputs: { v: 1000, q: 50 }, expect: { tau: '20 min' } },
      { inputs: { v: 60, q: 120 }, expect: { tau: '0.5 min', turn: '120' } },
    ],
  },
  {
    slug: 'hydraulic-retention-time-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Process chemistry',
    title: 'Hydraulic Retention Time Calculator for Wastewater Tanks',
    h1: 'Hydraulic Retention Time Calculator',
    metaDescription:
      'Calculate the hydraulic retention time of a wastewater tank or digester from the volume and daily flow, and the organic loading rate from the influent BOD.',
    about:
      'Hydraulic retention time, or HRT, is how long wastewater stays in a treatment tank, digester or lagoon. It is the tank volume divided by the daily flow, and it must be long enough for microorganisms to break down the pollutants. Typical values are a few hours for activated sludge basins, days for anaerobic digesters and weeks for lagoons. Enter the volume in cubic metres, the flow in cubic metres per day and the influent biochemical oxygen demand, and the page returns the HRT in days and hours and the organic loading rate in kilograms of BOD per cubic metre of tank per day.',
    inputs: [field('v', 'Tank volume (m³)', 1200, 0.01, 1e9), field('q', 'Flow (m³/day)', 300, 0.001, 1e9), field('bod', 'Influent BOD (mg/L)', 250, 0, 1e6)],
    outputs: [
      { name: 'days', label: 'Hydraulic retention time', format: 'text', highlight: true },
      { name: 'hours', label: 'In hours', format: 'text' },
      { name: 'olr', label: 'Organic loading rate', format: 'text' },
    ],
    calculate: (i) => {
      const days = toD(i.v).div(toD(i.q));
      return {
        days: `${fmtNumber(days, 2)} days`,
        hours: `${fmtNumber(days.mul(24), 1)} h`,
        olr: `${fmtNumber(toD(i.bod).mul(toD(i.q)).div(toD(i.v)).div(1000), 4)} kg BOD/(m³·day)`,
      };
    },
    formulaDescription:
      'HRT (days) = V ÷ Q. Hours = HRT × 24. Organic loading rate = BOD (mg/L) × Q (m³/day) ÷ V ÷ 1,000, in kg per cubic metre of tank per day, since 1 mg/L is 1 g/m³.',
    workedExample:
      'A 1,200 m³ tank treating 300 m³ a day has an HRT of 4 days, which is 96 hours. At 250 mg/L BOD the loading is 250 × 300 ÷ 1,200 ÷ 1,000 = 0.0625 kg BOD per m³ per day.',
    faq: [
      {
        question: 'How long should HRT be?',
        answer: 'It depends on the process: a few hours for activated sludge, 15 to 30 days for anaerobic digestion, and weeks for waste stabilisation ponds.',
      },
      {
        question: 'What is the difference from sludge age?',
        answer:
          'HRT is how long the water stays. Sludge retention time is how long the microorganisms stay, and they can be held in the tank longer than the water.',
      },
      {
        question: 'Why do I need BOD?',
        answer: 'The loading rate shows whether the tank is overloaded. Too high a rate leaves too little oxygen for the microorganisms.',
      },
    ],
    scenarios: mixed(
      'hydraulic-retention-time-calculator',
      8,
      (r) => ({ v: Math.round(r(80, 18000)), q: Math.round(r(20, 4000)), bod: Math.round(r(60, 900)) }),
      (v) => `${v.v} m³ tank, ${v.q} m³ a day, BOD ${v.bod}`,
    ),
    introOutputs: ['days'],
    relatedSlugs: ['residence-time-calculator', 'chemical-oxygen-demand-calculator'],
    checks: [
      { inputs: {}, expect: { days: '4 days', hours: '96 h', olr: '0.0625 kg BOD/(m³·day)' } },
      { inputs: { v: 500, q: 1000 }, expect: { days: '0.5 days', hours: '12 h' } },
      { inputs: { bod: 0 }, expect: { olr: '0 kg BOD/(m³·day)' } },
    ],
  },
  {
    slug: 'detention-time-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Process chemistry',
    title: 'Detention Time Calculator for Settling Basins and Clarifiers',
    h1: 'Detention Time Calculator',
    metaDescription: 'Find the detention time of a rectangular settling basin from its length, width, depth and flow, plus its surface overflow rate.',
    about:
      'Detention time is how long water takes, on average, to pass through a settling basin, clarifier or contact tank. A long detention time gives particles time to settle or a disinfectant time to act. For a rectangular basin the volume is length times width times depth, and the time is that volume divided by the flow. The surface overflow rate, the flow per unit of surface area, is the other design number for settling, because it is the velocity of the slowest particle that is fully removed. Enter the dimensions in metres and the flow in cubic metres per hour.',
    inputs: [
      field('l', 'Length (m)', 30, 0.1, 1000),
      field('w', 'Width (m)', 10, 0.1, 1000),
      field('depth', 'Water depth (m)', 3, 0.1, 50),
      field('q', 'Flow (m³/h)', 150, 0.001, 1e9),
    ],
    outputs: [
      { name: 'hours', label: 'Detention time', format: 'text', highlight: true },
      { name: 'minutes', label: 'In minutes', format: 'text' },
      { name: 'sor', label: 'Surface overflow rate', format: 'text' },
    ],
    calculate: (i) => {
      const volume = toD(i.l).mul(toD(i.w)).mul(toD(i.depth));
      const hours = volume.div(toD(i.q));
      return {
        hours: `${fmtNumber(hours, 2)} h`,
        minutes: `${fmtNumber(hours.mul(60), 0)} min`,
        sor: `${fmtNumber(toD(i.q).div(toD(i.l).mul(toD(i.w))), 3)} m/h`,
      };
    },
    formulaDescription:
      'Volume = length × width × depth. Detention time = volume ÷ flow. Surface overflow rate = flow ÷ (length × width), in m³ per m² per hour, which is m/h.',
    workedExample:
      'A 30 m × 10 m basin 3 m deep holds 900 m³. At 150 m³/h the detention time is 6 hours, or 360 minutes, and the surface overflow rate is 150 ÷ 300 = 0.5 m/h.',
    faq: [
      {
        question: 'What detention time do settling basins use?',
        answer: 'Primary clarifiers commonly use 1.5 to 2.5 hours and drinking water sedimentation basins 2 to 4 hours, but design standards vary by country.',
      },
      {
        question: 'Is the real time shorter?',
        answer: 'Yes. Short-circuiting sends part of the flow through faster than the mean, so actual contact time is less than the calculated value.',
      },
      {
        question: 'What about circular tanks?',
        answer: 'Use volume = π × radius² × depth in place of length × width × depth. The same flow divided by volume holds.',
      },
    ],
    scenarios: mixed(
      'detention-time-calculator',
      8,
      (r) => ({ l: Math.round(r(8, 90)), w: Math.round(r(3, 30)), depth: r(1.5, 5), q: Math.round(r(20, 900)) }),
      (v) => `${v.l} × ${v.w} m basin, ${v.depth} m deep, ${v.q} m³/h`,
    ),
    introOutputs: ['hours'],
    relatedSlugs: ['residence-time-calculator', 'hydraulic-retention-time-calculator'],
    checks: [
      { inputs: {}, expect: { hours: '6 h', minutes: '360 min', sor: '0.5 m/h' } },
      { inputs: { l: 20, w: 5, depth: 2, q: 100 }, expect: { hours: '2 h', sor: '1 m/h' } },
      { inputs: { q: 900 }, expect: { minutes: '60 min' } },
    ],
  },
  {
    slug: 'saponification-value-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Organic chemistry',
    title: 'Saponification Value Calculator and Lye Amount for Soap',
    h1: 'Saponification Value Calculator',
    metaDescription:
      'Calculate the saponification value of a triglyceride from its molar mass and the potassium or sodium hydroxide needed to saponify a mass of oil.',
    about:
      'The saponification value is the number of milligrams of potassium hydroxide needed to turn one gram of fat or oil into soap and glycerol. Each triglyceride molecule reacts with three hydroxide ions, so the value is three times the molar mass of KOH divided by the molar mass of the fat. Soap makers use it to work out how much lye a recipe needs, with a superfat percentage left unreacted so the soap is gentle. Enter the molar mass of the fat, the mass of oil and the superfat. The page returns the value, the KOH and the NaOH. Lye is caustic: handle it with gloves, eye protection and ventilation.',
    inputs: [
      field('mm', 'Molar mass of the triglyceride (g/mol)', 885.4, 200, 2000),
      field('oil', 'Mass of oil (g)', 500, 0, 1e8),
      field('sf', 'Superfat (%)', 5, 0, 50),
    ],
    outputs: [
      { name: 'sv', label: 'Saponification value', format: 'text', highlight: true },
      { name: 'koh', label: 'Potassium hydroxide needed', format: 'text' },
      { name: 'naoh', label: 'Sodium hydroxide needed', format: 'text' },
    ],
    calculate: (i) => {
      const sv = new D(3).mul('56.106').mul(1000).div(toD(i.mm));
      const koh = toD(i.oil)
        .mul(sv)
        .div(1000)
        .mul(new D(1).minus(toD(i.sf).div(100)));
      return { sv: `${fmtNumber(sv, 1)} mg KOH/g`, koh: `${fmtNumber(koh, 2)} g`, naoh: `${fmtNumber(koh.mul('39.997').div('56.106'), 2)} g` };
    },
    formulaDescription:
      'Saponification value (mg KOH/g) = 3 × 56.106 × 1,000 ÷ molar mass of the triglyceride. KOH (g) = oil mass × value ÷ 1,000 × (1 − superfat). NaOH = KOH × 39.997 ÷ 56.106.',
    workedExample:
      'Triolein, 885.4 g/mol, has a value of 190.1 mg KOH/g. For 500 g at 5% superfat: 500 × 190.1 ÷ 1,000 × 0.95 = 90.3 g of KOH, or 64.37 g of NaOH. Trilaurin, 638.96 g/mol, gives 263.4.',
    faq: [
      {
        question: 'What is superfat?',
        answer: 'A share of oil deliberately left unreacted by using less lye than the full amount, so the finished soap is milder. 5 to 8 percent is common.',
      },
      {
        question: 'Why is NaOH less than KOH?',
        answer: 'NaOH is lighter per mole, so the same number of moles weighs 39.997 ÷ 56.106 = 71.3 percent as much.',
      },
      {
        question: 'Is this safe to use as is?',
        answer:
          'It is only the arithmetic. Lye causes severe burns; follow a trusted recipe, add lye to water and never the reverse, and keep it away from children.',
      },
    ],
    scenarios: mixed(
      'saponification-value-calculator',
      8,
      (r) => ({ mm: Math.round(r(550, 930)), oil: Math.round(r(100, 3000)), sf: Math.round(r(0, 12)) }),
      (v) => `${v.mm} g/mol, ${v.oil} g of oil, ${v.sf}% superfat`,
    ),
    introOutputs: ['sv'],
    relatedSlugs: ['molar-mass-calculator', 'titration-calculator'],
    checks: [
      { inputs: {}, expect: { sv: '190.1 mg KOH/g', koh: '90.3 g', naoh: '64.37 g' } },
      { inputs: { mm: 638.96 }, expect: { sv: '263.4 mg KOH/g' } },
      { inputs: { sf: 0, oil: 100 }, expect: { koh: '19.01 g' } },
    ],
  },
  {
    slug: 'chemical-equation-balancer',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Reactions',
    title: 'Chemical Equation Balancer: Balance Any Reaction Online',
    h1: 'Chemical Equation Balancer',
    metaDescription: 'Balance a chemical equation by typing the reactants and products. Handles brackets and returns the smallest whole-number coefficients.',
    about:
      'A balanced chemical equation has the same number of atoms of each element on both sides, because matter is conserved. Balancing by trial works for small cases but gets awkward with many substances. This balancer builds a table of atom counts, one row per element and one column per substance with products counted as negative, and solves it exactly with fractions to find the smallest whole numbers that make every row add to zero. Type the equation with an arrow, as in H2 + O2 -> H2O, using element symbols with capital letters and brackets such as Ca(OH)2. Charges and states are not supported.',
    inputs: [text('equation', 'Unbalanced equation', 'C3H8 + O2 -> CO2 + H2O', 200)],
    outputs: [{ name: 'balanced', label: 'Balanced equation', format: 'text', highlight: true }],
    calculate: (i) => ({ balanced: balance(String(i.equation)) }),
    formulaDescription:
      'Each element gives one equation: the sum over reactants of coefficient × atoms minus the same over products is zero. Solving the system exactly with fractions and clearing denominators gives the smallest whole-number coefficients.',
    workedExample:
      'C3H8 + O2 -> CO2 + H2O: carbon gives 3a = c, hydrogen 8a = 2d, oxygen 2b = 2c + d. With a = 1: c = 3, d = 4, b = 5, so C3H8 + 5 O2 → 3 CO2 + 4 H2O.',
    faq: [
      {
        question: 'What formats are accepted?',
        answer:
          'Use -> or → between the sides and + between substances. Element symbols start with a capital letter, and round brackets such as Ca(OH)2 are fine. Hydrate dots, charges and state symbols are not read.',
      },
      {
        question: 'Why does it say more than one answer exists?',
        answer:
          'If a substance is listed that does not take part, or two reactions are combined, the system has several independent solutions. Remove the extra substance.',
      },
      {
        question: 'Does it check that the reaction really happens?',
        answer: 'No. It only balances the atoms. Whether the reaction occurs depends on chemistry, not arithmetic.',
      },
    ],
    scenarios: [
      withInputs('propane burning', { equation: 'C3H8 + O2 -> CO2 + H2O' }),
      withInputs('hydrogen and oxygen', { equation: 'H2 + O2 -> H2O' }),
      withInputs('rusting of iron', { equation: 'Fe + O2 -> Fe2O3' }),
      withInputs('neutralising lime with phosphoric acid', { equation: 'Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O' }),
      withInputs('potassium permanganate with hydrochloric acid', { equation: 'KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2' }),
      withInputs('glucose burning', { equation: 'C6H12O6 + O2 -> CO2 + H2O' }),
    ],
    introOutputs: ['balanced'],
    relatedSlugs: ['combustion-reaction-calculator', 'molar-ratio-calculator'],
    checks: [
      { inputs: {}, expect: { balanced: 'C3H8 + 5 O2 → 3 CO2 + 4 H2O' } },
      { inputs: { equation: 'H2 + O2 -> H2O' }, expect: { balanced: '2 H2 + O2 → 2 H2O' } },
      { inputs: { equation: 'Fe + O2 -> Fe2O3' }, expect: { balanced: '4 Fe + 3 O2 → 2 Fe2O3' } },
      { inputs: { equation: 'Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O' }, expect: { balanced: '3 Ca(OH)2 + 2 H3PO4 → Ca3(PO4)2 + 6 H2O' } },
      { inputs: { equation: 'KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2' }, expect: { balanced: '2 KMnO4 + 16 HCl → 2 KCl + 2 MnCl2 + 8 H2O + 5 Cl2' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
