import { selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, mixed, type Spec } from '../lib/spec';
import { field, intField, sci, varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 15 (physics): circuits and components, magnetism, sound and light, and a few modern-physics ideas.
 * Ideal components and textbook formulas; each page says so. Constants are exact SI values or CODATA 2018:
 * ε0 = 8.8541878128e-12, μ0 = 1.25663706212e-6, h, c and e exact. Physics shows no disclaimer, and electrical
 * pages are physics exercises, not wiring advice. Tier 2 or 3, so none is live until the cohort gate opens.
 */

const G = new D('9.80665');
const PI = D.acos(-1);
const RAD = PI.div(180);
const C = new D('299792458');
const H = new D('6.62607015e-34');
const QE = new D('1.602176634e-19');
const EPS0 = new D('8.8541878128e-12');
const MU0 = new D('1.25663706212e-6');
const RH = new D('1.0967758341e7');

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
const e10 = (x: number, p: number): number => Number(`${x}e${p}`);
const imageKind = (di: Dec, m: Dec): string =>
  `${di.gt(0) ? 'Real, inverted, ' : 'Virtual, upright, '}${m.abs().gt(1) ? 'magnified' : m.abs().lt(1) ? 'reduced' : 'same size'}`;

const E12 = ['1.0', '1.2', '1.5', '1.8', '2.2', '2.7', '3.3', '3.9', '4.7', '5.6', '6.8', '8.2', '10'];
const EPSR: Record<string, string> = { air: '1.0006', paper: '3.7', glass: '7', poly: '2.3', water: '80' };
const RESISTIVITY: Record<string, string> = {
  copper: '1.68e-8',
  aluminium: '2.65e-8',
  gold: '2.44e-8',
  silver: '1.59e-8',
  iron: '9.71e-8',
  nichrome: '1.10e-6',
};
const PARTICLES: Record<string, { q: string; m: string }> = {
  electron: { q: '1.602176634e-19', m: '9.1093837015e-31' },
  proton: { q: '1.602176634e-19', m: '1.67262192369e-27' },
  alpha: { q: '3.204353268e-19', m: '6.6446573357e-27' },
};
const MUR: Record<string, string> = { air: '1', ferrite: '200', iron: '5000' };
const PHI: Record<string, string> = { cs: '2.1', na: '2.3', zn: '4.3', cu: '4.7', pt: '5.6' };
const SERIES: Record<number, string> = { 1: 'Lyman', 2: 'Balmer', 3: 'Paschen', 4: 'Brackett', 5: 'Pfund' };
const MASSES: Record<string, string> = { sun: '1.98847e30', earth: '5.9722e24', jupiter: '1.89813e27', kg: '1' };
const FRICTION: Record<string, string> = { dry: '0.7', wet: '0.4', ice: '0.1' };

export const SPECS: Spec[] = [
  {
    slug: 'capacitor-energy-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Electricity',
    title: 'Capacitor Energy Calculator: Stored Energy and Charge',
    h1: 'Capacitor Energy Calculator',
    metaDescription: 'Calculate the energy stored in a capacitor and the charge on it from its capacitance in microfarads and the voltage across it.',
    about:
      'A capacitor stores energy in the electric field between its plates. The energy grows with the square of the voltage, so doubling the voltage quadruples what is stored, while the charge grows only in proportion. Enter the capacitance in microfarads and the voltage to get the stored energy in millijoules and the charge in microcoulombs. A 100 microfarad electrolytic at 12 volts holds only 7.2 millijoules, far less than a small battery, but it can release it in an instant.',
    inputs: [pos('c', 'Capacitance (µF)', 100, 1e9), pos('v', 'Voltage (V)', 12, 1e7)],
    outputs: [out('e', 'Stored energy', true), out('q', 'Charge on the plates')],
    calculate: (i) => {
      const c = toD(i.c);
      const v = toD(i.v);
      return { e: u(c.mul(v.pow(2)).div(2).div(1000), 3, 'mJ'), q: u(c.mul(v), 2, 'µC') };
    },
    formulaDescription:
      'E = ½ C V² and Q = C V. With C in microfarads and V in volts the charge comes out in microcoulombs and, after dividing by 1,000, the energy in millijoules.',
    formulaLatex: 'E = \\tfrac{1}{2}CV^{2}, \\quad Q = CV',
    workedExample: '100 µF charged to 12 V: E = ½ × 100 × 144 ÷ 1,000 = 7.2 mJ and Q = 100 × 12 = 1,200 µC.',
    faq: [
      {
        question: 'Why does the energy depend on the square of the voltage?',
        answer: 'Adding charge gets harder as the voltage builds up, so the work done, and the energy stored, grows with V².',
      },
      {
        question: 'Can a big capacitor be dangerous?',
        answer: 'Yes. A capacitor can hold a charge long after the power is off, so large or high-voltage ones must be discharged carefully.',
      },
      {
        question: 'How does it compare with a battery?',
        answer: 'A capacitor holds much less energy for its size but can deliver it very quickly, which suits camera flashes and power smoothing.',
      },
    ],
    scenarios: mixed(
      'capacitor-energy-calculator',
      12,
      (r) => ({ c: r(0.1, 9800), v: r(1.5, 450) }),
      (v) => `${v.c} µF at ${v.v} V`,
    ),
    introOutputs: ['e'],
    relatedSlugs: ['parallel-plate-capacitor-calculator', 'rc-time-constant-calculator', 'electrical-power-calculator'],
    checks: [
      { inputs: {}, expect: { e: '7.2 mJ', q: '1,200 µC' } },
      { inputs: { c: 4700, v: 25 }, expect: { e: '1,468.75 mJ', q: '117,500 µC' } },
      { inputs: { c: 0.1, v: 5 }, expect: { e: '0.001 mJ', q: '0.5 µC' } },
    ],
  },
  {
    slug: 'parallel-plate-capacitor-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Electricity',
    title: 'Parallel Plate Capacitor Calculator: Capacitance From Geometry',
    h1: 'Parallel Plate Capacitor Calculator',
    metaDescription:
      'Calculate the capacitance of a parallel plate capacitor from plate area, gap and dielectric, with the charge and energy at a chosen voltage.',
    about:
      'Two flat conducting plates separated by an insulating gap form the simplest capacitor. Its capacitance grows with the plate area and falls with the gap, and an insulating material between the plates multiplies it by the relative permittivity of the material. Choose a dielectric, enter the plate area in square centimetres and the gap in millimetres, plus a voltage, to get the capacitance in picofarads and the charge and energy stored at that voltage.',
    inputs: [
      pos('a', 'Plate area (cm²)', 100, 1e9),
      pos('d', 'Gap between plates (mm)', 1, 1e6),
      sel('mat', 'Dielectric', 'glass', [
        ['air', 'Air (1.0006)'],
        ['paper', 'Paper (3.7)'],
        ['glass', 'Glass (7)'],
        ['poly', 'Polyethylene (2.3)'],
        ['water', 'Pure water (80)'],
      ]),
      pos('v', 'Voltage (V)', 100, 1e7),
    ],
    outputs: [out('c', 'Capacitance', true), out('q', 'Charge at that voltage'), out('e', 'Energy at that voltage')],
    calculate: (i) => {
      const c = EPS0.mul(new D(EPSR[String(i.mat)] ?? '7'))
        .mul(toD(i.a).div(10000))
        .div(toD(i.d).div(1000));
      const v = toD(i.v);
      return { c: u(c.mul('1e12'), 2, 'pF'), q: u(c.mul(v).mul('1e9'), 2, 'nC'), e: u(c.mul(v.pow(2)).div(2).mul('1e6'), 3, 'µJ') };
    },
    formulaDescription:
      'C = ε₀ ε_r A ÷ d with ε₀ = 8.8541878128×10⁻¹² F/m. Then Q = C V and E = ½ C V². Edge effects are ignored, so the gap must be small compared with the plate size.',
    formulaLatex: 'C = \\dfrac{\\varepsilon_{0}\\varepsilon_{r}A}{d}',
    workedExample:
      'Plates of 100 cm² (0.01 m²) with a 1 mm glass gap (ε_r = 7): C = 8.854×10⁻¹² × 7 × 0.01 ÷ 0.001 = 619.79 pF. At 100 V that holds 61.98 nC and 3.099 µJ.',
    faq: [
      { question: 'How do I get more capacitance?', answer: 'Use bigger plates, a smaller gap or a dielectric with a higher permittivity.' },
      {
        question: 'What does the dielectric do?',
        answer: 'It reduces the field for a given charge, so the plates hold more charge at the same voltage, multiplying the capacitance by ε_r.',
      },
      { question: 'Is the gap in millimetres?', answer: 'Yes, and the area in square centimetres; the page converts both before calculating.' },
    ],
    scenarios: varied(
      'parallel-plate-capacitor-calculator',
      12,
      [
        { name: 'a', lo: 5, hi: 900, step: 5 },
        { name: 'd', lo: 0.1, hi: 6, step: 0.1 },
        { name: 'v', lo: 3, hi: 500, step: 1 },
      ],
      [{ name: 'mat', options: ['air', 'paper', 'glass', 'poly', 'water'] }],
      (v) => `${v.a} cm², ${v.d} mm, ${v.mat}, ${v.v} V`,
    ),
    introOutputs: ['c'],
    relatedSlugs: ['capacitor-energy-calculator', 'capacitor-combination-calculator', 'coulombs-law-calculator'],
    checks: [
      { inputs: {}, expect: { c: '619.79 pF', q: '61.98 nC', e: '3.099 µJ' } },
      { inputs: { a: 400, d: 0.5, mat: 'poly', v: 12 }, expect: { c: '1,629.17 pF', q: '19.55 nC', e: '0.117 µJ' } },
      { inputs: { a: 25, d: 2, mat: 'water', v: 50 }, expect: { c: '885.42 pF' } },
    ],
  },
  {
    slug: 'capacitor-combination-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Electricity',
    title: 'Capacitor Combination Calculator: Series and Parallel',
    h1: 'Capacitor Combination Calculator',
    metaDescription: 'Find the total capacitance of up to three capacitors connected in series or in parallel, in microfarads and nanofarads.',
    about:
      "Capacitors combine in the opposite way to resistors. In parallel their capacitances simply add, because the plate areas add. In series the reciprocals add, so the total is smaller than the smallest capacitor. Choose the connection, enter up to three capacitances in microfarads (set the third to zero to leave it out) and read the total in microfarads and nanofarads. It helps when you need a value that is not in the shop's range.",
    inputs: [
      sel('mode', 'Connection', 'parallel', [
        ['parallel', 'In parallel'],
        ['series', 'In series'],
      ]),
      pos('c1', 'Capacitor 1 (µF)', 10, 1e9),
      pos('c2', 'Capacitor 2 (µF)', 22, 1e9),
      field('c3', 'Capacitor 3 (µF, 0 to skip)', 47, 0, 1e9),
    ],
    outputs: [out('c', 'Total capacitance', true), out('nf', 'In nanofarads')],
    calculate: (i) => {
      const cs = [toD(i.c1), toD(i.c2), toD(i.c3)].filter((c) => c.gt(0));
      const total =
        String(i.mode) === 'series' ? new D(1).div(cs.reduce((a, c) => a.plus(new D(1).div(c)), new D(0))) : cs.reduce((a, c) => a.plus(c), new D(0));
      return { c: u(total, 3, 'µF'), nf: u(total.mul(1000), 1, 'nF') };
    },
    formulaDescription: 'Parallel: C = C₁ + C₂ + C₃. Series: 1 ÷ C = 1 ÷ C₁ + 1 ÷ C₂ + 1 ÷ C₃. A capacitor entered as 0 is left out.',
    formulaLatex: 'C_{series} = \\left(\\sum \\dfrac{1}{C_{i}}\\right)^{-1}',
    workedExample: '10, 22 and 47 µF in parallel add to 79 µF. In series the total is 1 ÷ (0.1 + 0.04545 + 0.02128) = 5.998 µF.',
    faq: [
      {
        question: 'Why is a series total smaller?',
        answer: 'Series capacitors act like one with a larger gap between the outer plates, which lowers the capacitance.',
      },
      { question: 'Why use series at all?', answer: 'To share a high voltage between capacitors, since each sees only part of it.' },
      {
        question: 'Is this the same as resistors?',
        answer: 'It is reversed: for resistors the series values add and the parallel values combine by reciprocals.',
      },
    ],
    scenarios: varied(
      'capacitor-combination-calculator',
      12,
      [
        { name: 'c1', lo: 0.47, hi: 470, step: 0.47 },
        { name: 'c2', lo: 0.47, hi: 470, step: 0.47 },
        { name: 'c3', lo: 0, hi: 470, step: 0.47 },
      ],
      [{ name: 'mode', options: ['parallel', 'series'] }],
      (v) => `${v.mode}: ${v.c1}, ${v.c2}, ${v.c3}`,
    ),
    introOutputs: ['c'],
    relatedSlugs: ['resistor-network-calculator', 'capacitor-energy-calculator', 'parallel-plate-capacitor-calculator'],
    checks: [
      { inputs: {}, expect: { c: '79 µF', nf: '79,000 nF' } },
      { inputs: { mode: 'series' }, expect: { c: '5.998 µF', nf: '5,997.7 nF' } },
      { inputs: { mode: 'series', c1: 100, c2: 100, c3: 0 }, expect: { c: '50 µF', nf: '50,000 nF' } },
    ],
  },
  {
    slug: 'led-resistor-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Electricity',
    title: 'LED Resistor Calculator: Series Resistor Value',
    h1: 'LED Resistor Calculator',
    metaDescription:
      'Calculate the series resistor for an LED from the supply voltage, the LED forward voltage and the current, with the nearest standard E12 value and its power.',
    about:
      "An LED has almost no resistance of its own once it conducts, so without a resistor in series it draws too much current and burns out. The resistor drops the leftover voltage, the supply minus the LED's forward voltage, at the current you choose. Enter the supply voltage, the forward voltage from the datasheet and the current in milliamps. The result is the exact resistance, the next standard E12 value up, which keeps the current slightly below your target, and the power the resistor dissipates.",
    inputs: [pos('vs', 'Supply voltage (V)', 9, 1000), pos('vf', 'LED forward voltage (V)', 2, 100), pos('ma', 'LED current (mA)', 20, 100000)],
    outputs: [out('r', 'Resistor needed', true), out('e12', 'Next standard E12 value'), out('p', 'Power in the resistor')],
    calculate: (i) => {
      const vs = toD(i.vs);
      const vf = toD(i.vf);
      if (vs.lte(vf)) return { r: 'The supply must be above the LED voltage', e12: '', p: '' };
      const amps = toD(i.ma).div(1000);
      const r = vs.minus(vf).div(amps);
      const decade = D.log10(r).floor();
      const norm = r.div(new D(10).pow(decade));
      const pick = E12.find((b) => new D(b).gte(norm)) ?? '10';
      return { r: u(r, 1, 'Ω'), e12: u(new D(pick).mul(new D(10).pow(decade)), 2, 'Ω'), p: u(amps.pow(2).mul(r), 3, 'W') };
    },
    formulaDescription:
      'R = (V_supply − V_f) ÷ I. The E12 series has 12 values per decade (1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2); the page picks the smallest one at or above R. Power P = I² R.',
    formulaLatex: 'R = \\dfrac{V_{s} - V_{f}}{I}',
    workedExample:
      'A 9 V supply, a 2 V LED and 20 mA: R = 7 ÷ 0.02 = 350 Ω. The next standard value is 390 Ω, and the resistor dissipates 0.02² × 350 = 0.14 W.',
    faq: [
      {
        question: 'What forward voltage should I use?',
        answer: 'Check the datasheet. Typically about 2 V for red, 3 V for blue and white, 1.8 to 2.2 V for yellow and green.',
      },
      {
        question: 'Why round up to a standard value?',
        answer: 'Resistors come in standard series, and a slightly higher resistance gives a slightly lower and safer current.',
      },
      {
        question: 'Can I use less current than the maximum?',
        answer: 'Yes. A lower current makes the LED dimmer, with longer life, and needs a larger resistor.',
      },
    ],
    scenarios: mixed(
      'led-resistor-calculator',
      12,
      (r) => ({ vs: r(3.3, 48), vf: r(1.6, 3.4), ma: r(2, 35) }),
      (v) => `${v.vs} V supply, LED ${v.vf} V at ${v.ma} mA`,
    ),
    introOutputs: ['r', 'e12'],
    relatedSlugs: ['ohms-law-calculator', 'voltage-divider-calculator', 'electrical-power-calculator'],
    checks: [
      { inputs: {}, expect: { r: '350 Ω', e12: '390 Ω', p: '0.14 W' } },
      { inputs: { vs: 5, vf: 3.2, ma: 10 }, expect: { r: '180 Ω', e12: '180 Ω', p: '0.018 W' } },
      { inputs: { vs: 12, vf: 2, ma: 20 }, expect: { r: '500 Ω', e12: '560 Ω', p: '0.2 W' } },
      { inputs: { vs: 2, vf: 3 }, expect: { r: 'The supply must be above the LED voltage' } },
    ],
  },
  {
    slug: 'wire-resistance-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Electricity',
    title: 'Wire Resistance Calculator: Length, Diameter and Material',
    h1: 'Wire Resistance Calculator',
    metaDescription:
      'Calculate the electrical resistance of a wire from its material, length and diameter, with the cross-sectional area and the resistance per metre.',
    about:
      'The resistance of a wire is the resistivity of its material times its length, divided by its cross-sectional area. Long, thin wires resist more; copper and silver are the best everyday conductors, while nichrome resists about 65 times more and is used in heating elements. Choose the material, enter the length in metres and the diameter in millimetres, and the calculator returns the resistance in ohms, the area in square millimetres and the resistance per metre.',
    inputs: [
      sel('mat', 'Material', 'copper', [
        ['copper', 'Copper (1.68×10⁻⁸ Ω·m)'],
        ['aluminium', 'Aluminium (2.65×10⁻⁸)'],
        ['gold', 'Gold (2.44×10⁻⁸)'],
        ['silver', 'Silver (1.59×10⁻⁸)'],
        ['iron', 'Iron (9.71×10⁻⁸)'],
        ['nichrome', 'Nichrome (1.10×10⁻⁶)'],
      ]),
      pos('L', 'Length (m)', 100, 1e9),
      pos('dia', 'Diameter (mm)', 1.5, 1e4),
    ],
    outputs: [out('r', 'Resistance', true), out('a', 'Cross-sectional area'), out('per', 'Resistance per metre')],
    calculate: (i) => {
      const dia = toD(i.dia).div(1000);
      const area = PI.mul(dia.pow(2)).div(4);
      const r = new D(RESISTIVITY[String(i.mat)] ?? '1.68e-8').mul(toD(i.L)).div(area);
      return { r: u(r, 3, 'Ω'), a: u(area.mul('1e6'), 3, 'mm²'), per: u(r.div(toD(i.L)).mul(1000), 2, 'mΩ/m') };
    },
    formulaDescription: 'R = ρ L ÷ A with A = π d² ÷ 4. Resistivities are for about 20 °C and rise with temperature.',
    formulaLatex: 'R = \\rho\\dfrac{L}{A}',
    workedExample: '100 m of 1.5 mm copper wire: A = 1.767 mm², R = 1.68×10⁻⁸ × 100 ÷ 1.767×10⁻⁶ = 0.951 Ω, or 9.51 mΩ per metre.',
    faq: [
      { question: 'Why does a thicker wire resist less?', answer: 'It gives the electrons a wider path, like a wider pipe for water.' },
      { question: 'Does temperature matter?', answer: "Yes. A metal's resistance rises as it warms, by roughly 0.4% per degree for copper." },
      { question: 'Is this the wire gauge table?', answer: 'It works from the diameter you enter; convert an AWG size to millimetres first if needed.' },
    ],
    scenarios: varied(
      'wire-resistance-calculator',
      12,
      [
        { name: 'L', lo: 0.5, hi: 900, step: 0.5 },
        { name: 'dia', lo: 0.2, hi: 6, step: 0.1 },
      ],
      [{ name: 'mat', options: ['copper', 'aluminium', 'gold', 'silver', 'iron', 'nichrome'] }],
      (v) => `${v.mat}, ${v.L} m, ${v.dia} mm`,
    ),
    introOutputs: ['r'],
    relatedSlugs: ['voltage-drop-calculator', 'ohms-law-calculator', 'resistor-network-calculator'],
    checks: [
      { inputs: {}, expect: { r: '0.951 Ω', a: '1.767 mm²', per: '9.51 mΩ/m' } },
      { inputs: { mat: 'aluminium', L: 50, dia: 2 }, expect: { r: '0.422 Ω', a: '3.142 mm²', per: '8.44 mΩ/m' } },
      { inputs: { mat: 'nichrome', L: 2, dia: 0.5 }, expect: { r: '11.205 Ω', a: '0.196 mm²' } },
    ],
  },
  {
    slug: 'voltage-drop-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Electricity',
    title: 'Voltage Drop Calculator: Cable Run Loss',
    h1: 'Voltage Drop Calculator',
    metaDescription:
      'Estimate the voltage lost along a two-core copper or aluminium cable from the current, one-way length and cross-section, with the percentage drop and the voltage at the load.',
    about:
      'Current flowing through a cable loses some voltage in the resistance of the conductors, and the loss grows with the current and the length. The current goes out along one conductor and returns along the other, so the resistive path is twice the length of the run. Enter the current, the one-way length, the conductor cross-section in square millimetres and the supply voltage to see the volts lost, the percentage and the voltage left at the load. This is a physics estimate, not an electrical design.',
    inputs: [
      sel('mat', 'Conductor', 'copper', [
        ['copper', 'Copper'],
        ['aluminium', 'Aluminium'],
      ]),
      pos('I', 'Current (A)', 16, 1e6),
      pos('L', 'One-way cable length (m)', 30, 1e7),
      pos('A', 'Conductor cross-section (mm²)', 2.5, 1e5),
      pos('V', 'Supply voltage (V)', 230, 1e7),
    ],
    outputs: [out('drop', 'Voltage drop', true), out('pct', 'As a percentage of the supply'), out('load', 'Voltage at the load')],
    calculate: (i) => {
      const r = new D(RESISTIVITY[String(i.mat)] ?? '1.68e-8').mul(toD(i.L).mul(2)).div(toD(i.A).div('1e6'));
      const drop = toD(i.I).mul(r);
      return { drop: u(drop, 2, 'V'), pct: `${fmtNumber(drop.div(toD(i.V)).mul(100), 2)}%`, load: u(toD(i.V).minus(drop), 2, 'V') };
    },
    formulaDescription:
      'ΔV = I × ρ × (2 L) ÷ A, a DC or low-frequency estimate that ignores temperature, reactance and the power factor. ρ is 1.68×10⁻⁸ Ω·m for copper and 2.65×10⁻⁸ for aluminium.',
    formulaLatex: '\\Delta V = I\\,\\dfrac{2\\rho L}{A}',
    workedExample:
      '16 A over 30 m of 2.5 mm² copper on a 230 V supply: R = 1.68×10⁻⁸ × 60 ÷ 2.5×10⁻⁶ = 0.4032 Ω, so the drop is 6.45 V (2.8%) and 223.55 V arrives at the load.',
    faq: [
      { question: 'Why double the length?', answer: 'The current must go out and come back, so both conductors add resistance.' },
      {
        question: 'How can I reduce the drop?',
        answer: 'Use a thicker cable, a shorter run or a higher voltage for the same power, which lowers the current.',
      },
      { question: 'Does this replace wiring rules?', answer: 'No. Wiring is covered by local regulations; this is a physics calculation only.' },
    ],
    scenarios: varied(
      'voltage-drop-calculator',
      12,
      [
        { name: 'I', lo: 1, hi: 63, step: 1 },
        { name: 'L', lo: 3, hi: 250, step: 1 },
        { name: 'A', lo: 0.75, hi: 35, step: 0.25 },
        { name: 'V', lo: 12, hi: 400, step: 1 },
      ],
      [{ name: 'mat', options: ['copper', 'aluminium'] }],
      (v) => `${v.mat} ${v.I} A over ${v.L} m, ${v.A} mm², ${v.V} V`,
    ),
    introOutputs: ['drop', 'pct'],
    relatedSlugs: ['wire-resistance-calculator', 'ohms-law-calculator', 'electrical-power-calculator'],
    checks: [
      { inputs: {}, expect: { drop: '6.45 V', pct: '2.8%', load: '223.55 V' } },
      { inputs: { mat: 'aluminium', I: 32, L: 60, A: 6, V: 400 }, expect: { drop: '16.96 V', pct: '4.24%', load: '383.04 V' } },
      { inputs: { I: 10, L: 10, A: 1.5, V: 12 }, expect: { drop: '2.24 V', pct: '18.67%' } },
    ],
  },
  {
    slug: 'battery-life-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Electricity',
    title: 'Battery Life Calculator: Runtime From Capacity and Load',
    h1: 'Battery Life Calculator',
    metaDescription:
      'Estimate how long a battery lasts from its capacity in milliamp-hours, the load current and the usable fraction, plus the stored energy in watt-hours.',
    about:
      'The runtime of a battery is its usable capacity divided by the current the device draws. Capacity is quoted in milliamp-hours, so a 3,000 mAh cell can in principle supply 3,000 mA for an hour or 300 mA for ten. Real batteries give less than the label at high loads and in the cold, so enter the percentage you expect to use. The page returns the runtime in hours and minutes and the stored energy in watt-hours at the nominal voltage.',
    inputs: [
      pos('cap', 'Battery capacity (mAh)', 3000, 1e9),
      pos('load', 'Load current (mA)', 250, 1e9),
      field('use', 'Usable capacity (%)', 85, 1, 100),
      pos('v', 'Nominal voltage (V)', 3.7, 1000),
    ],
    outputs: [out('life', 'Runtime', true), out('hours', 'In hours'), out('wh', 'Energy stored')],
    calculate: (i) => {
      const h = toD(i.cap).mul(toD(i.use).div(100)).div(toD(i.load));
      return { life: hm(h), hours: u(h, 2, 'hours'), wh: u(toD(i.cap).mul(toD(i.v)).div(1000), 2, 'Wh') };
    },
    formulaDescription:
      'Runtime = capacity × usable fraction ÷ load current. Energy = capacity (Ah) × nominal voltage. A constant load is assumed; the real runtime shortens at high drain and low temperature.',
    formulaLatex: 't = \\dfrac{C\\,\\eta}{I}',
    workedExample:
      'A 3,000 mAh cell at 85% usable, powering a 250 mA load: 3,000 × 0.85 ÷ 250 = 10.2 hours, or 10 h 12 min. Its stored energy is 3 Ah × 3.7 V = 11.1 Wh.',
    faq: [
      {
        question: 'Why is real life shorter than the label?',
        answer: 'High currents, cold, age and cut-off voltages all reduce the capacity you can actually draw.',
      },
      { question: 'What is a milliamp-hour?', answer: 'A current of one milliamp flowing for one hour, a measure of charge, not of energy.' },
      { question: 'How do I compare cells of different voltage?', answer: 'Multiply capacity by voltage to get watt-hours, the energy stored.' },
    ],
    scenarios: mixed(
      'battery-life-calculator',
      12,
      (r) => ({ cap: r(100, 24000), load: r(5, 3200), use: Math.round(r(50, 100)), v: r(1.2, 14.8) }),
      (v) => `${v.cap} mAh cell, ${v.load} mA draw, ${v.use}% usable`,
    ),
    introOutputs: ['life'],
    relatedSlugs: ['electrical-power-calculator', 'electricity-cost-calculator', 'capacitor-energy-calculator'],
    checks: [
      { inputs: {}, expect: { life: '10 h 12 min', hours: '10.2 hours', wh: '11.1 Wh' } },
      { inputs: { cap: 20000, load: 1500, use: 90, v: 3.7 }, expect: { life: '12 h 0 min', hours: '12 hours', wh: '74 Wh' } },
      { inputs: { cap: 2000, load: 30, use: 100, v: 3 }, expect: { life: '66 h 40 min', hours: '66.67 hours' } },
    ],
  },
  {
    slug: 'transformer-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Electricity',
    title: 'Transformer Calculator: Turns Ratio, Voltage and Current',
    h1: 'Transformer Calculator',
    metaDescription:
      'Calculate the secondary voltage, primary current and power of an ideal transformer from the primary voltage, the turns on each winding and the load current.',
    about:
      'An ideal transformer changes the voltage of an alternating supply in proportion to the number of turns on its two windings, and the current changes in the opposite proportion, so that the power in equals the power out. Enter the primary voltage, the turns on each winding and the current the load draws on the secondary to find the secondary voltage, the primary current and the power delivered. A step-down ratio like 1,000 to 52 turns turns mains into a safe low voltage.',
    inputs: [
      pos('vp', 'Primary voltage (V)', 230, 1e9),
      pos('np', 'Primary turns', 1000, 1e9),
      pos('ns', 'Secondary turns', 52, 1e9),
      pos('is', 'Secondary (load) current (A)', 2, 1e9),
    ],
    outputs: [out('vs', 'Secondary voltage', true), out('ip', 'Primary current'), out('p', 'Power delivered')],
    calculate: (i) => {
      const ratio = toD(i.ns).div(toD(i.np));
      const vs = toD(i.vp).mul(ratio);
      return { vs: u(vs, 2, 'V'), ip: u(toD(i.is).mul(ratio), 3, 'A'), p: u(vs.mul(toD(i.is)), 2, 'W') };
    },
    formulaDescription:
      'V_s ÷ V_p = N_s ÷ N_p and I_p ÷ I_s = N_s ÷ N_p, with P_in = P_out. Ideal transformer: no winding resistance, no core loss, no leakage.',
    formulaLatex: '\\dfrac{V_{s}}{V_{p}} = \\dfrac{N_{s}}{N_{p}} = \\dfrac{I_{p}}{I_{s}}',
    workedExample: '230 V across 1,000 primary turns and 52 secondary turns: V_s = 11.96 V. A 2 A load needs 0.104 A on the primary, and the power is 23.92 W.',
    faq: [
      { question: 'Does a transformer work on DC?', answer: 'No. It relies on a changing magnetic flux, so it needs alternating current.' },
      {
        question: 'Where does the energy go in a real one?',
        answer: 'Winding resistance, core heating and leakage waste a few percent, so real transformers are 90 to 99 percent efficient.',
      },
      {
        question: 'Why high voltage for transmission?',
        answer: 'The same power at higher voltage means lower current, so far less energy is lost as heat in the lines.',
      },
    ],
    scenarios: mixed(
      'transformer-calculator',
      12,
      (r) => ({ vp: r(12, 11000), np: r(100, 5000), ns: r(10, 5000), is: r(0.05, 60) }),
      (v) => `${v.vp} V, ${v.np} to ${v.ns} turns, ${v.is} A`,
    ),
    introOutputs: ['vs'],
    relatedSlugs: ['electrical-power-calculator', 'power-factor-calculator', 'ohms-law-calculator'],
    checks: [
      { inputs: {}, expect: { vs: '11.96 V', ip: '0.104 A', p: '23.92 W' } },
      { inputs: { vp: 120, np: 200, ns: 800, is: 0.5 }, expect: { vs: '480 V', ip: '2 A', p: '240 W' } },
      { inputs: { vp: 11000, np: 5000, ns: 100, is: 100 }, expect: { vs: '220 V', ip: '2 A', p: '22,000 W' } },
    ],
  },
  {
    slug: 'power-factor-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Electricity',
    title: 'Power Factor Calculator: Real, Apparent and Reactive Power',
    h1: 'Power Factor Calculator',
    metaDescription:
      'Calculate the power factor, apparent power, reactive power and phase angle of a single-phase AC load from its real power, voltage and current.',
    about:
      'In an AC circuit with coils or capacitors the current and voltage drift out of step, so the apparent power, voltage times current, is more than the real power doing useful work. Their ratio is the power factor, between zero and one. Enter the real power in kilowatts, the voltage and the current of a single-phase load to get the power factor, the apparent power in kilovolt-amperes, the reactive power and the phase angle. Low power factors mean the supply carries current that does no work.',
    inputs: [pos('P', 'Real power (kW)', 4.5, 1e9), pos('V', 'Voltage (V)', 230, 1e9), pos('I', 'Current (A)', 25, 1e9)],
    outputs: [out('pf', 'Power factor', true), out('s', 'Apparent power'), out('q', 'Reactive power'), out('ang', 'Phase angle')],
    calculate: (i) => {
      const p = toD(i.P);
      const s = toD(i.V).mul(toD(i.I)).div(1000);
      if (p.gt(s)) return { pf: 'Real power cannot exceed apparent power', s: '', q: '', ang: '' };
      const pf = p.div(s);
      return { pf: fmtNumber(pf, 3), s: u(s, 2, 'kVA'), q: u(s.pow(2).minus(p.pow(2)).sqrt(), 2, 'kVAr'), ang: `${fmtNumber(D.acos(pf).div(RAD), 1)}°` };
    },
    formulaDescription: 'S = V I, PF = P ÷ S, Q = √(S² − P²) and φ = acos(PF). Single-phase, with V and I as RMS values.',
    formulaLatex: '\\mathrm{PF} = \\dfrac{P}{S} = \\cos\\varphi',
    workedExample: '4.5 kW drawn at 230 V and 25 A: S = 5.75 kVA, PF = 4.5 ÷ 5.75 = 0.783, Q = 3.58 kVAr and φ = 38.5°.',
    faq: [
      {
        question: 'Why does a low power factor matter?',
        answer: 'The wiring and supply must carry the full current even though only part of it does work, which wastes capacity and energy.',
      },
      { question: 'What causes it?', answer: 'Inductive loads such as motors and transformers; capacitors can correct it.' },
      { question: 'What is a good value?', answer: 'Close to 1. Many industrial tariffs penalise values below about 0.9.' },
    ],
    scenarios: mixed(
      'power-factor-calculator',
      12,
      (r) => ({ P: r(0.3, 60), V: r(110, 690), I: r(2, 160) }),
      (v) => `${v.P} kW at ${v.V} V and ${v.I} A`,
    ),
    introOutputs: ['pf'],
    relatedSlugs: ['electrical-power-calculator', 'watts-to-amps-calculator', 'rlc-impedance-calculator'],
    checks: [
      { inputs: {}, expect: { pf: '0.783', s: '5.75 kVA', q: '3.58 kVAr', ang: '38.5°' } },
      { inputs: { P: 10, V: 400, I: 30 }, expect: { pf: '0.833', s: '12 kVA', q: '6.63 kVAr', ang: '33.6°' } },
      { inputs: { P: 9, V: 230, I: 10 }, expect: { pf: 'Real power cannot exceed apparent power' } },
    ],
  },
  {
    slug: 'watts-to-amps-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Electricity',
    title: 'Watts to Amps Calculator: DC, AC and Three-Phase',
    h1: 'Watts to Amps Calculator',
    metaDescription: 'Convert power in watts to current in amps for a DC, single-phase AC or three-phase AC supply, with the voltage and power factor.',
    about:
      'The current a device draws follows from its power and the supply voltage. For direct current it is simply the watts divided by the volts. For alternating current the power factor enters, because only part of the current does useful work, and for three-phase supplies a factor of the square root of three appears. Pick the supply type, enter the power, the voltage and the power factor to get the current in amps and the apparent power in kilovolt-amperes.',
    inputs: [
      sel('sup', 'Supply', 'ac1', [
        ['dc', 'DC'],
        ['ac1', 'AC, single phase'],
        ['ac3', 'AC, three phase'],
      ]),
      pos('P', 'Power (W)', 2300, 1e12),
      pos('V', 'Voltage (V)', 230, 1e9),
      field('pf', 'Power factor (ignored for DC)', 0.9, 0.01, 1),
    ],
    outputs: [out('i', 'Current', true), out('s', 'Apparent power')],
    calculate: (i) => {
      const p = toD(i.P);
      const v = toD(i.V);
      const pf = toD(i.pf);
      const sup = String(i.sup);
      const amps = sup === 'dc' ? p.div(v) : sup === 'ac3' ? p.div(new D(3).sqrt().mul(v).mul(pf)) : p.div(v.mul(pf));
      return { i: u(amps, 2, 'A'), s: u(sup === 'dc' ? p.div(1000) : p.div(pf).div(1000), 2, 'kVA') };
    },
    formulaDescription:
      'DC: I = P ÷ V. Single-phase AC: I = P ÷ (V × PF). Three-phase AC: I = P ÷ (√3 × V_line × PF). The apparent power is P ÷ PF (equal to P for DC).',
    formulaLatex: 'I = \\dfrac{P}{V\\cos\\varphi}',
    workedExample:
      'A 2,300 W load on a 230 V single-phase supply with a power factor of 0.9: I = 2,300 ÷ (230 × 0.9) = 11.11 A, and the apparent power is 2.56 kVA.',
    faq: [
      {
        question: 'Why does power factor matter?',
        answer: 'For AC loads with a power factor below one, more current flows than the watts alone would suggest.',
      },
      { question: 'Which voltage in three-phase?', answer: 'The line-to-line voltage, such as 400 V in many countries.' },
      {
        question: 'Can I use it to size a fuse?',
        answer: 'It gives the running current only; protection must follow local wiring rules and start-up currents.',
      },
    ],
    scenarios: varied(
      'watts-to-amps-calculator',
      12,
      [
        { name: 'P', lo: 5, hi: 40000, step: 5 },
        { name: 'V', lo: 5, hi: 690, step: 1 },
        { name: 'pf', lo: 0.5, hi: 1, step: 0.01 },
      ],
      [{ name: 'sup', options: ['dc', 'ac1', 'ac3'] }],
      (v) => `${v.sup}: ${v.P} W at ${v.V} V, pf ${v.pf}`,
    ),
    introOutputs: ['i'],
    relatedSlugs: ['electrical-power-calculator', 'power-factor-calculator', 'ohms-law-calculator'],
    checks: [
      { inputs: {}, expect: { i: '11.11 A', s: '2.56 kVA' } },
      { inputs: { sup: 'dc', P: 60, V: 12 }, expect: { i: '5 A', s: '0.06 kVA' } },
      { inputs: { sup: 'ac3', P: 15000, V: 400, pf: 0.85 }, expect: { i: '25.47 A', s: '17.65 kVA' } },
    ],
  },
  {
    slug: 'magnetic-force-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Magnetism',
    title: 'Magnetic Force Calculator: Charged Particle in a Field',
    h1: 'Magnetic Force Calculator',
    metaDescription:
      'Calculate the magnetic force on an electron, proton or alpha particle moving perpendicular to a magnetic field, with its circular path radius and cyclotron frequency.',
    about:
      'A charged particle moving through a magnetic field feels a sideways force that never does any work, so it bends the particle into a circle without speeding it up. The force is the charge times the speed times the field strength. Choose a particle, enter its speed in kilometres per second and the field in millitesla, with the velocity perpendicular to the field, to get the force, the radius of its circular path and how many times a second it goes round.',
    inputs: [
      sel('part', 'Particle', 'electron', [
        ['electron', 'Electron'],
        ['proton', 'Proton'],
        ['alpha', 'Alpha particle'],
      ]),
      pos('v', 'Speed (km/s)', 10000, 1e5),
      pos('B', 'Magnetic field (mT)', 1, 1e7),
    ],
    outputs: [out('f', 'Magnetic force', true), out('r', 'Radius of the circular path'), out('fr', 'Cyclotron frequency')],
    calculate: (i) => {
      const p = PARTICLES[String(i.part)] ?? PARTICLES.electron;
      const q = new D(p.q);
      const m = new D(p.m);
      const v = toD(i.v).mul(1000);
      const b = toD(i.B).div(1000);
      return { f: `${sci(q.mul(v).mul(b))} N`, r: u(m.mul(v).div(q.mul(b)).mul(100), 3, 'cm'), fr: u(q.mul(b).div(PI.mul(2).mul(m)).div('1e6'), 2, 'MHz') };
    },
    formulaDescription:
      'F = q v B for a velocity perpendicular to the field. The path is a circle of radius r = m v ÷ (q B) with frequency f = q B ÷ (2π m). Non-relativistic speeds only.',
    formulaLatex: 'F = qvB, \\quad r = \\dfrac{mv}{qB}',
    workedExample: 'An electron at 10,000 km/s in a 1 mT field: F = 1.602×10⁻¹⁵ N, it circles with a radius of 5.686 cm at 27.99 MHz.',
    faq: [
      {
        question: 'Does the field speed the particle up?',
        answer: 'No. The force is always perpendicular to the motion, so it changes the direction but not the speed.',
      },
      { question: 'Why do electrons circle tighter than protons?', answer: 'The electron is about 1,800 times lighter, so the same force bends it much more.' },
      { question: 'Where is this used?', answer: 'In cyclotrons, mass spectrometers and old cathode-ray tubes.' },
    ],
    scenarios: varied(
      'magnetic-force-calculator',
      12,
      [
        { name: 'v', lo: 100, hi: 30000, step: 100 },
        { name: 'B', lo: 0.1, hi: 900, step: 0.1 },
      ],
      [{ name: 'part', options: ['electron', 'proton', 'alpha'] }],
      (v) => `${v.part} at ${v.v} km/s in ${v.B} mT`,
    ),
    introOutputs: ['r'],
    relatedSlugs: ['solenoid-field-calculator', 'straight-wire-field-calculator', 'centripetal-force-calculator'],
    checks: [
      { inputs: {}, expect: { f: '1.602 × 10^-15 N', r: '5.686 cm', fr: '27.99 MHz' } },
      { inputs: { part: 'proton', v: 3000, B: 50 }, expect: { f: '2.403 × 10^-14 N', r: '62.638 cm', fr: '0.76 MHz' } },
      { inputs: { part: 'alpha', v: 15000, B: 1500 }, expect: { f: '7.210 × 10^-12 N', r: '20.736 cm' } },
    ],
  },
  {
    slug: 'solenoid-field-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Magnetism',
    title: 'Solenoid Magnetic Field Calculator',
    h1: 'Solenoid Magnetic Field Calculator',
    metaDescription:
      'Calculate the magnetic field inside a long solenoid from the number of turns, its length, the current and the core material, in millitesla and gauss.',
    about:
      'A coil of wire, a solenoid, makes a nearly uniform magnetic field inside it when current flows. The field grows with the current and the number of turns per metre, and an iron or ferrite core can multiply it many times. Enter the number of turns, the coil length in centimetres, the current in amps and the core material to get the field in millitesla and in gauss, along with the field strength in amperes per metre that the coil itself produces.',
    inputs: [
      pos('N', 'Number of turns', 500, 1e9),
      pos('L', 'Coil length (cm)', 20, 1e7),
      pos('I', 'Current (A)', 2, 1e6),
      sel('core', 'Core', 'air', [
        ['air', 'Air (μr 1)'],
        ['ferrite', 'Ferrite (about 200)'],
        ['iron', 'Soft iron (about 5,000)'],
      ]),
    ],
    outputs: [out('b', 'Magnetic field B', true), out('g', 'In gauss'), out('h', 'Field strength H')],
    calculate: (i) => {
      const n = toD(i.N);
      const l = toD(i.L).div(100);
      const b = MU0.mul(new D(MUR[String(i.core)] ?? '1'))
        .mul(n)
        .mul(toD(i.I))
        .div(l);
      return { b: u(b.mul(1000), 3, 'mT'), g: u(b.mul(10000), 2, 'G'), h: u(n.mul(toD(i.I)).div(l), 1, 'A/m') };
    },
    formulaDescription:
      'B = μ₀ μ_r N I ÷ L with μ₀ = 1.25663706212×10⁻⁶ T·m/A, valid inside a long solenoid far from its ends. The core permeability is approximate and falls as the iron saturates.',
    formulaLatex: 'B = \\mu_{0}\\mu_{r}\\dfrac{N I}{L}',
    workedExample: '500 turns over 20 cm carrying 2 A in air: n = 2,500 turns per metre, B = 1.2566×10⁻⁶ × 2,500 × 2 = 6.283 mT = 62.83 G, with H = 5,000 A/m.',
    faq: [
      {
        question: 'What does the core do?',
        answer: 'A magnetic core concentrates the flux, multiplying the field by its relative permeability until it saturates.',
      },
      { question: 'Is the field uniform?', answer: 'Roughly so inside a long coil; it is weaker near the ends, about half the central value at the very end.' },
      { question: "How does that compare with the Earth's field?", answer: 'About 0.05 mT, so this example coil is over a hundred times stronger.' },
    ],
    scenarios: varied(
      'solenoid-field-calculator',
      12,
      [
        { name: 'N', lo: 50, hi: 4000, step: 10 },
        { name: 'L', lo: 2, hi: 80, step: 1 },
        { name: 'I', lo: 0.1, hi: 12, step: 0.1 },
      ],
      [{ name: 'core', options: ['air', 'ferrite', 'iron'] }],
      (v) => `${v.N} turns, ${v.L} cm, ${v.I} A, ${v.core}`,
    ),
    introOutputs: ['b'],
    relatedSlugs: ['straight-wire-field-calculator', 'induced-emf-calculator', 'magnetic-force-calculator'],
    checks: [
      { inputs: {}, expect: { b: '6.283 mT', g: '62.83 G', h: '5,000 A/m' } },
      { inputs: { N: 1200, L: 30, I: 1.5, core: 'iron' }, expect: { b: '37,699.112 mT', g: '376,991.12 G', h: '6,000 A/m' } },
      { inputs: { N: 100, L: 5, I: 0.5, core: 'ferrite' }, expect: { b: '251.327 mT', h: '1,000 A/m' } },
    ],
  },
  {
    slug: 'straight-wire-field-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Magnetism',
    title: 'Magnetic Field of a Straight Wire Calculator',
    h1: 'Magnetic Field of a Straight Wire Calculator',
    metaDescription:
      "Calculate the magnetic field around a long straight current-carrying wire at a given distance, in microtesla and gauss, compared with the Earth's field.",
    about:
      "A current in a long straight wire circles it with a magnetic field that weakens with distance. The field is the permeability of free space times the current over two pi times the distance. Enter the current in amps and your distance from the wire in centimetres to find the field in microtesla and gauss and how it compares with the Earth's natural field of about 50 microtesla. A 10 A wire gives 40 microtesla at 5 cm, almost the same as the Earth.",
    inputs: [pos('I', 'Current (A)', 10, 1e9), pos('r', 'Distance from the wire (cm)', 5, 1e9)],
    outputs: [out('b', 'Magnetic field', true), out('g', 'In gauss'), out('earth', "Compared with the Earth's field (50 µT)")],
    calculate: (i) => {
      const b = MU0.mul(toD(i.I)).div(PI.mul(2).mul(toD(i.r).div(100)));
      return { b: u(b.mul('1e6'), 2, 'µT'), g: u(b.mul(10000), 4, 'G'), earth: `${fmtNumber(b.mul('1e6').div(50), 2)}×` };
    },
    formulaDescription:
      'B = μ₀ I ÷ (2π r) for a long straight wire in air, with the field lines forming circles around it (right-hand rule). μ₀ = 1.25663706212×10⁻⁶ T·m/A.',
    formulaLatex: 'B = \\dfrac{\\mu_{0}I}{2\\pi r}',
    workedExample: "10 A at 5 cm: B = 1.2566×10⁻⁶ × 10 ÷ (2π × 0.05) = 40 µT = 0.4 G, which is 0.8 times the Earth's field.",
    faq: [
      { question: 'Which way does the field point?', answer: 'Point your right thumb along the current; your fingers curl in the direction of the field.' },
      {
        question: 'Why does a compass go wrong near cables?',
        answer: "The field of a large current can rival the Earth's, so the needle points along the sum of both.",
      },
      { question: 'Does it work for a short wire?', answer: 'Only approximately. The formula is for a wire much longer than the distance you are from it.' },
    ],
    scenarios: mixed(
      'straight-wire-field-calculator',
      12,
      (r) => ({ I: r(0.2, 900), r: r(0.5, 160) }),
      (v) => `${v.I} A at ${v.r} cm`,
    ),
    introOutputs: ['b'],
    relatedSlugs: ['solenoid-field-calculator', 'magnetic-force-calculator', 'induced-emf-calculator'],
    checks: [
      { inputs: {}, expect: { b: '40 µT', g: '0.4 G', earth: '0.8×' } },
      { inputs: { I: 100, r: 2 }, expect: { b: '1,000 µT', g: '10 G', earth: '20×' } },
      { inputs: { I: 0.5, r: 10 }, expect: { b: '1 µT', earth: '0.02×' } },
    ],
  },
  {
    slug: 'induced-emf-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Magnetism',
    title: "Induced EMF Calculator: Faraday's Law",
    h1: 'Induced EMF Calculator',
    metaDescription:
      "Calculate the EMF induced in a coil by Faraday's law when a magnetic field through it falls to zero, from the turns, field, area, angle and time.",
    about:
      "Change the magnetic flux through a coil and a voltage appears across it: that is Faraday's law of induction, the principle behind generators and transformers. The induced voltage is the number of turns times the rate of change of flux. Here the field through the coil drops from its starting value to zero over a chosen time. Enter the turns, the field, the coil area, the angle between the field and the coil's normal and the time to get the average EMF and the starting flux.",
    inputs: [
      pos('N', 'Number of turns', 200, 1e9),
      pos('B', 'Magnetic field (T)', 0.3, 1e4),
      pos('A', 'Coil area (cm²)', 50, 1e9),
      pos('t', 'Time for the field to vanish (s)', 0.1, 1e9),
      field('ang', 'Angle between field and coil normal (°)', 0, 0, 90),
    ],
    outputs: [out('emf', 'Average induced EMF', true), out('flux', 'Starting flux')],
    calculate: (i) => {
      const flux = toD(i.B).mul(toD(i.A).div(10000)).mul(toD(i.ang).mul(RAD).cos());
      return { emf: u(toD(i.N).mul(flux).div(toD(i.t)), 3, 'V'), flux: u(flux.mul(1000), 3, 'mWb') };
    },
    formulaDescription: "ε = N ΔΦ ÷ Δt with Φ = B A cos θ. The magnitude of the average EMF is quoted; the sign (Lenz's law) opposes the change.",
    formulaLatex: '\\varepsilon = -N\\dfrac{\\Delta\\Phi}{\\Delta t}',
    workedExample:
      'A 200-turn coil of 50 cm² in a 0.3 T field aligned with its axis: Φ = 1.5 mWb. If the field dies away in 0.1 s the average EMF is 200 × 0.0015 ÷ 0.1 = 3 V.',
    faq: [
      { question: 'What does the minus sign mean?', answer: "Lenz's law: the induced current opposes the change in flux that causes it." },
      { question: 'How do generators use this?', answer: 'Spinning a coil in a field makes the flux change continuously, so an alternating EMF appears.' },
      { question: 'Why does the angle matter?', answer: "Only the component of the field perpendicular to the coil's plane contributes to the flux." },
    ],
    scenarios: mixed(
      'induced-emf-calculator',
      12,
      (r) => ({ N: r(10, 3000), B: r(0.02, 2), A: r(5, 400), t: r(0.01, 8), ang: r(0, 80) }),
      (v) => `${v.N} turns, ${v.B} T, ${v.A} cm², ${v.t} s`,
    ),
    introOutputs: ['emf'],
    relatedSlugs: ['solenoid-field-calculator', 'transformer-calculator', 'straight-wire-field-calculator'],
    checks: [
      { inputs: {}, expect: { emf: '3 V', flux: '1.5 mWb' } },
      { inputs: { N: 50, B: 0.8, A: 20, t: 0.05, ang: 60 }, expect: { emf: '0.8 V', flux: '0.8 mWb' } },
      { inputs: { N: 1000, B: 0.02, A: 100, t: 2, ang: 90 }, expect: { emf: '0 V', flux: '0 mWb' } },
    ],
  },
  {
    slug: 'decibel-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Waves and optics',
    title: 'Decibel Calculator: Ratios to dB and Back',
    h1: 'Decibel Calculator',
    metaDescription: 'Convert a power or amplitude ratio to decibels, or decibels back to a ratio, for sound, signals and gain.',
    about:
      'The decibel is a logarithmic way to compare two quantities, which is handy when they differ by huge factors, as sound levels and signal gains do. A power ratio of 100 is 20 dB, and doubling the power adds 3 dB. For amplitude quantities such as voltage or sound pressure the multiplier is 20 instead of 10, because power goes with the square. Choose a direction, enter a ratio or a number of decibels, and read both the power and the amplitude version.',
    inputs: [
      sel('mode', 'Convert', 'ratio', [
        ['ratio', 'Ratio to decibels'],
        ['db', 'Decibels to ratio'],
      ]),
      real('x', 'Ratio, or decibels', 100, -1000, 1e12),
    ],
    outputs: [out('power', 'Power quantity', true), out('amp', 'Amplitude quantity (voltage, pressure)')],
    calculate: (i) => {
      const x = toD(i.x);
      if (String(i.mode) === 'db' && x.abs().gt(300)) return { power: 'Enter between −300 and 300 dB', amp: '' };
      if (String(i.mode) === 'db') return { power: `${fmtNumber(new D(10).pow(x.div(10)), 4)}×`, amp: `${fmtNumber(new D(10).pow(x.div(20)), 4)}×` };
      if (x.lte(0)) return { power: 'The ratio must be above zero', amp: '' };
      return { power: u(D.log10(x).mul(10), 2, 'dB'), amp: u(D.log10(x).mul(20), 2, 'dB') };
    },
    formulaDescription:
      'Power: dB = 10 log₁₀(P₂ ÷ P₁). Amplitude (voltage, current, sound pressure): dB = 20 log₁₀(A₂ ÷ A₁). The reverse is ratio = 10^(dB ÷ 10) for power and 10^(dB ÷ 20) for amplitude.',
    formulaLatex: '\\mathrm{dB} = 10\\log_{10}\\dfrac{P_{2}}{P_{1}}',
    workedExample:
      'A ratio of 100 is 20 dB as a power ratio and 40 dB as an amplitude ratio. Going the other way, +3 dB is a power factor of 1.9953, close to double.',
    faq: [
      {
        question: 'Why two different formulas?',
        answer: 'Power is proportional to the square of voltage or pressure, so an amplitude ratio gives twice as many decibels.',
      },
      { question: 'What does 3 dB mean?', answer: 'About a doubling of power, or a factor of 1.41 in amplitude.' },
      { question: 'Can a decibel be negative?', answer: 'Yes. A negative value means the quantity has fallen, such as a loss of signal.' },
    ],
    scenarios: varied(
      'decibel-calculator',
      12,
      [{ name: 'x', lo: 1.7, hi: 940, step: 0.01 }],
      [{ name: 'mode', options: ['ratio', 'db'] }],
      (v) => `${v.mode}: ${v.x}`,
    ),
    introOutputs: ['power'],
    relatedSlugs: ['speed-of-sound-calculator', 'inverse-square-law-calculator', 'frequency-period-calculator'],
    checks: [
      { inputs: {}, expect: { power: '20 dB', amp: '40 dB' } },
      { inputs: { x: 2 }, expect: { power: '3.01 dB', amp: '6.02 dB' } },
      { inputs: { mode: 'db', x: 3 }, expect: { power: '1.9953×', amp: '1.4125×' } },
      { inputs: { mode: 'db', x: -20 }, expect: { power: '0.01×', amp: '0.1×' } },
    ],
  },
  {
    slug: 'beat-frequency-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'Beat Frequency Calculator: Two Close Tones',
    h1: 'Beat Frequency Calculator',
    metaDescription: 'Find the beat frequency, beat period and perceived pitch when two sound waves of nearly equal frequency are played together.',
    about:
      'Play two notes that are almost, but not exactly, the same pitch and the sound pulses in loudness. Those pulses are beats, and their rate equals the difference between the two frequencies. Musicians tune strings and organ pipes by listening for the beats to slow to nothing. Enter the two frequencies in hertz to get the beat frequency, the time between loudness peaks and the average pitch the ear perceives.',
    inputs: [pos('f1', 'First frequency (Hz)', 440, 1e9), pos('f2', 'Second frequency (Hz)', 444, 1e9)],
    outputs: [out('beat', 'Beat frequency', true), out('per', 'Time between beats'), out('avg', 'Perceived pitch')],
    calculate: (i) => {
      const f1 = toD(i.f1);
      const f2 = toD(i.f2);
      const b = f1.minus(f2).abs();
      return { beat: u(b, 2, 'Hz'), per: b.isZero() ? 'No beats (same frequency)' : u(new D(1).div(b), 3, 's'), avg: u(f1.plus(f2).div(2), 2, 'Hz') };
    },
    formulaDescription: 'f_beat = |f₁ − f₂| and the perceived pitch is the average (f₁ + f₂) ÷ 2. Beats are audible when the difference is below about 15 Hz.',
    formulaLatex: 'f_{beat} = |f_{1} - f_{2}|',
    workedExample: '440 Hz and 444 Hz: 4 beats per second, one every 0.25 s, with a perceived pitch of 442 Hz.',
    faq: [
      { question: 'How do I tune with beats?', answer: 'Adjust one string until the beat slows and finally vanishes: then the two frequencies match.' },
      {
        question: 'Why does the loudness rise and fall?',
        answer: 'The two waves drift in and out of step, adding up when in step and cancelling when out of step.',
      },
      {
        question: 'What if the difference is large?',
        answer: 'Above roughly 15 Hz the ear stops hearing separate beats and hears a rough or a separate tone.',
      },
    ],
    scenarios: mixed(
      'beat-frequency-calculator',
      12,
      (r) => ({ f1: r(60, 2200), f2: r(60, 2200) }),
      (v) => `tones ${v.f1} and ${v.f2}`,
    ),
    introOutputs: ['beat'],
    relatedSlugs: ['frequency-period-calculator', 'string-frequency-calculator', 'resonance-tube-calculator'],
    checks: [
      { inputs: {}, expect: { beat: '4 Hz', per: '0.25 s', avg: '442 Hz' } },
      { inputs: { f1: 261.63, f2: 262.5 }, expect: { beat: '0.87 Hz', per: '1.149 s', avg: '262.07 Hz' } },
      { inputs: { f1: 500, f2: 500 }, expect: { beat: '0 Hz', per: 'No beats (same frequency)', avg: '500 Hz' } },
    ],
  },
  {
    slug: 'string-frequency-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'String Frequency Calculator: Vibrating String Harmonics',
    h1: 'String Frequency Calculator',
    metaDescription:
      'Calculate the fundamental frequency and harmonics of a vibrating string from its length, tension and linear density, plus the wave speed on the string.',
    about:
      'A guitar or piano string vibrates at a pitch set by three things: how long it is, how tight it is and how heavy it is per unit length. Shorter, tighter and lighter strings sound higher. Enter the vibrating length in centimetres, the tension in newtons and the linear density in grams per metre to get the fundamental frequency, the speed of waves along the string and the second and third harmonics that give the instrument its timbre.',
    inputs: [pos('L', 'Vibrating length (cm)', 65, 1e5), pos('T', 'Tension (N)', 70, 1e9), pos('mu', 'Linear density (g/m)', 0.4, 1e6)],
    outputs: [out('f1', 'Fundamental frequency', true), out('v', 'Wave speed on the string'), out('f2', 'Second harmonic'), out('f3', 'Third harmonic')],
    calculate: (i) => {
      const v = toD(i.T).div(toD(i.mu).div(1000)).sqrt();
      const f1 = v.div(toD(i.L).div(100).mul(2));
      return { f1: u(f1, 2, 'Hz'), v: u(v, 1, 'm/s'), f2: u(f1.mul(2), 2, 'Hz'), f3: u(f1.mul(3), 2, 'Hz') };
    },
    formulaDescription: 'v = √(T ÷ μ) and f_n = n v ÷ (2 L) for a string fixed at both ends. The harmonics are whole-number multiples of the fundamental.',
    formulaLatex: 'f_{1} = \\dfrac{1}{2L}\\sqrt{\\dfrac{T}{\\mu}}',
    workedExample:
      'A 65 cm string under 70 N with a density of 0.4 g/m: v = √(70 ÷ 0.0004) = 418.3 m/s, so f₁ = 418.3 ÷ 1.3 = 321.79 Hz, a little below the E4 note at 329.63 Hz.',
    faq: [
      { question: 'How do I raise the pitch?', answer: 'Tighten the string, shorten it by pressing a fret, or use a lighter string.' },
      {
        question: 'What are harmonics?',
        answer: "Extra standing-wave patterns at whole-number multiples of the fundamental, which add to the sound's character.",
      },
      { question: 'Does thickness matter?', answer: 'Yes, through the linear density: a thicker, heavier string vibrates more slowly and sounds lower.' },
    ],
    scenarios: mixed(
      'string-frequency-calculator',
      12,
      (r) => ({ L: r(12, 160), T: r(8, 900), mu: r(0.05, 14) }),
      (v) => `${v.L} cm, ${v.T} N, ${v.mu} g/m`,
    ),
    introOutputs: ['f1'],
    relatedSlugs: ['beat-frequency-calculator', 'resonance-tube-calculator', 'frequency-period-calculator'],
    checks: [
      { inputs: {}, expect: { f1: '321.79 Hz', v: '418.3 m/s', f2: '643.58 Hz', f3: '965.38 Hz' } },
      { inputs: { L: 60, T: 120, mu: 1.2 }, expect: { f1: '263.52 Hz', v: '316.2 m/s', f2: '527.05 Hz', f3: '790.57 Hz' } },
      { inputs: { L: 33, T: 60, mu: 0.9 }, expect: { f1: '391.21 Hz', v: '258.2 m/s' } },
    ],
  },
  {
    slug: 'resonance-tube-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'Resonance Tube Calculator: Open and Closed Pipes',
    h1: 'Resonance Tube Calculator',
    metaDescription: 'Find the resonant frequencies of an open pipe or a pipe closed at one end from its length and the air temperature.',
    about:
      'Air in a pipe resonates at frequencies set by its length and the speed of sound. A pipe open at both ends supports every harmonic, with a fundamental of the speed over twice the length. A pipe closed at one end has a fundamental half as high and supports only the odd harmonics, which is why a clarinet sounds different from a flute. Choose the pipe type, enter its length in centimetres and the temperature to get the first three resonances.',
    inputs: [
      sel('kind', 'Pipe', 'open', [
        ['open', 'Open at both ends'],
        ['closed', 'Closed at one end'],
      ]),
      pos('L', 'Length (cm)', 50, 1e6),
      real('T', 'Air temperature (°C)', 20, -80, 100),
    ],
    outputs: [out('f1', 'First resonance', true), out('f2', 'Second resonance'), out('f3', 'Third resonance')],
    calculate: (i) => {
      const v = new D('331.3').mul(new D(1).plus(toD(i.T).div('273.15')).sqrt());
      const l = toD(i.L).div(100);
      if (String(i.kind) === 'closed') {
        const f1 = v.div(l.mul(4));
        return { f1: u(f1, 1, 'Hz'), f2: u(f1.mul(3), 1, 'Hz'), f3: u(f1.mul(5), 1, 'Hz') };
      }
      const f1 = v.div(l.mul(2));
      return { f1: u(f1, 1, 'Hz'), f2: u(f1.mul(2), 1, 'Hz'), f3: u(f1.mul(3), 1, 'Hz') };
    },
    formulaDescription:
      'Open pipe: f_n = n v ÷ (2 L), n = 1, 2, 3. Closed pipe: f_n = (2n − 1) v ÷ (4 L), so 1, 3 and 5 times the fundamental. v = 331.3 √(1 + T ÷ 273.15) m/s. End corrections are ignored.',
    formulaLatex: 'f_{n} = \\dfrac{nv}{2L}',
    workedExample: 'A 50 cm open pipe at 20 °C (v = 343.21 m/s): f₁ = 343.2 Hz, f₂ = 686.4 Hz and f₃ = 1,029.6 Hz.',
    faq: [
      {
        question: 'Why is a closed pipe lower?',
        answer: 'It has a node at the closed end and an antinode at the open end, so only a quarter wavelength fits, doubling the wavelength.',
      },
      { question: 'Why do warmer pipes play sharper?', answer: 'Sound travels faster in warm air, raising every resonance.' },
      { question: 'What is end correction?', answer: 'A real open end behaves as if the pipe were slightly longer; the page ignores it for simplicity.' },
    ],
    scenarios: varied(
      'resonance-tube-calculator',
      12,
      [
        { name: 'L', lo: 5, hi: 250, step: 1 },
        { name: 'T', lo: -10, hi: 38, step: 1 },
      ],
      [{ name: 'kind', options: ['open', 'closed'] }],
      (v) => `${v.kind} pipe, ${v.L} cm, ${v.T} °C`,
    ),
    introOutputs: ['f1'],
    relatedSlugs: ['string-frequency-calculator', 'speed-of-sound-calculator', 'beat-frequency-calculator'],
    checks: [
      { inputs: {}, expect: { f1: '343.2 Hz', f2: '686.4 Hz', f3: '1,029.6 Hz' } },
      { inputs: { kind: 'closed', L: 17, T: 20 }, expect: { f1: '504.7 Hz', f2: '1,514.2 Hz', f3: '2,523.6 Hz' } },
      { inputs: { kind: 'open', L: 120, T: 0 }, expect: { f1: '138 Hz', f3: '414.1 Hz' } },
    ],
  },
  {
    slug: 'diffraction-grating-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'Diffraction Grating Calculator: Angle and Maximum Order',
    h1: 'Diffraction Grating Calculator',
    metaDescription:
      'Calculate the diffraction angle of a grating from its lines per millimetre, the wavelength and the order, with the line spacing and the highest order possible.',
    about:
      'A diffraction grating, a surface with many fine parallel lines, splits light into sharp beams at angles that depend on the wavelength, which is how a spectrometer separates colours. The bright beams appear where light from neighbouring lines arrives in step. Enter the lines per millimetre, the wavelength in nanometres and the order you want to see to get the angle of the beam, the spacing between lines and the highest order that exists before the beam would pass 90 degrees.',
    inputs: [pos('lines', 'Lines per millimetre', 600, 1e5), pos('lam', 'Wavelength (nm)', 550, 1e7), intField('m', 'Order of the maximum', 1, 1, 50)],
    outputs: [out('ang', 'Angle of the maximum', true), out('maxo', 'Highest order possible'), out('d', 'Line spacing')],
    calculate: (i) => {
      const d = new D('1e6').div(toD(i.lines));
      const lam = toD(i.lam);
      const s = toD(i.m).mul(lam).div(d);
      return {
        ang: s.gt(1) ? 'No such order (it would be beyond 90°)' : `${fmtNumber(D.asin(s).div(RAD), 2)}°`,
        maxo: d.div(lam).floor().toFixed(0),
        d: u(d, 1, 'nm'),
      };
    },
    formulaDescription:
      'd sin θ = m λ, with d = 1 ÷ (lines per mm) in nm. The highest order is the largest whole m with m λ ≤ d. Light shining perpendicular to the grating.',
    formulaLatex: 'd\\sin\\theta = m\\lambda',
    workedExample:
      'A 600 lines per mm grating (d = 1,666.7 nm) with 550 nm light: sin θ = 550 ÷ 1,666.7 = 0.33, so θ = 19.27° in first order, and the highest order is 3.',
    faq: [
      {
        question: 'Why do different colours separate?',
        answer: 'The angle depends on the wavelength, so longer wavelengths are deflected more than shorter ones.',
      },
      { question: 'What is the zero order?', answer: 'The undeflected straight-through beam, the same for all colours.' },
      {
        question: 'Why does it differ from a prism?',
        answer: 'A prism bends blue more than red; a grating bends red more, and gives sharper, evenly spaced spectra.',
      },
    ],
    scenarios: varied(
      'diffraction-grating-calculator',
      12,
      [
        { name: 'lines', lo: 80, hi: 1200, step: 10 },
        { name: 'lam', lo: 400, hi: 700, step: 5 },
        { name: 'm', lo: 1, hi: 3, step: 1 },
      ],
      [],
      (v) => `${v.lines} lines/mm, ${v.lam} nm, order ${v.m}`,
    ),
    introOutputs: ['ang'],
    relatedSlugs: ['double-slit-calculator', 'photon-energy-calculator', 'wave-speed-calculator'],
    checks: [
      { inputs: {}, expect: { ang: '19.27°', maxo: '3', d: '1,666.7 nm' } },
      { inputs: { lines: 300, lam: 633, m: 2 }, expect: { ang: '22.32°', maxo: '5', d: '3,333.3 nm' } },
      { inputs: { lines: 1000, lam: 550, m: 2 }, expect: { ang: 'No such order (it would be beyond 90°)', maxo: '1', d: '1,000 nm' } },
      { inputs: { lines: 1200, lam: 700, m: 1 }, expect: { ang: '57.14°', maxo: '1' } },
    ],
  },
  {
    slug: 'double-slit-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: "Double Slit Calculator: Young's Fringe Spacing",
    h1: 'Double Slit Calculator',
    metaDescription:
      "Calculate the fringe spacing on the screen in Young's double-slit experiment from the slit separation, the wavelength and the distance to the screen.",
    about:
      "When light passes through two narrow slits the waves overlap and produce a pattern of bright and dark bands, the interference fringes of Young's experiment. The spacing between bright fringes grows with the wavelength and the distance to the screen and shrinks with the slit separation. Enter the separation in millimetres, the wavelength in nanometres and the screen distance in metres to get the spacing in millimetres and the angle to the first bright fringe.",
    inputs: [pos('d', 'Slit separation (mm)', 0.2, 1e3), pos('lam', 'Wavelength (nm)', 550, 1e7), pos('L', 'Distance to screen (m)', 1.5, 1e6)],
    outputs: [out('dy', 'Fringe spacing', true), out('ang', 'Angle to the first bright fringe')],
    calculate: (i) => {
      const d = toD(i.d).div(1000);
      const lam = toD(i.lam).mul('1e-9');
      return { dy: u(lam.mul(toD(i.L)).div(d).mul(1000), 3, 'mm'), ang: `${fmtNumber(D.asin(lam.div(d)).div(RAD), 4)}°` };
    },
    formulaDescription:
      'Fringe spacing Δy = λ L ÷ d for small angles, and the first bright fringe is at sin θ = λ ÷ d. d is the slit separation, L the screen distance.',
    formulaLatex: '\\Delta y = \\dfrac{\\lambda L}{d}',
    workedExample: '0.2 mm slits, 550 nm light and a screen 1.5 m away: Δy = 550×10⁻⁹ × 1.5 ÷ 0.0002 = 4.125 mm, with the first fringe at 0.1576°.',
    faq: [
      { question: 'Why do I see dark bands?', answer: 'Where the two paths differ by half a wavelength the waves cancel, leaving darkness.' },
      { question: 'How can I make the fringes wider?', answer: 'Use a longer wavelength, a greater screen distance or a smaller slit separation.' },
      { question: 'Who first did the experiment?', answer: 'Thomas Young in 1801, as evidence that light behaves as a wave.' },
    ],
    scenarios: mixed(
      'double-slit-calculator',
      12,
      (r) => ({ d: r(0.05, 1.4), lam: r(400, 750), L: r(0.5, 6) }),
      (v) => `slits ${v.d} mm, ${v.lam} nm, screen ${v.L} m`,
    ),
    introOutputs: ['dy'],
    relatedSlugs: ['diffraction-grating-calculator', 'photon-energy-calculator', 'snells-law-calculator'],
    checks: [
      { inputs: {}, expect: { dy: '4.125 mm', ang: '0.1576°' } },
      { inputs: { d: 0.5, lam: 633, L: 2 }, expect: { dy: '2.532 mm', ang: '0.0725°' } },
      { inputs: { d: 0.1, lam: 450, L: 1 }, expect: { dy: '4.5 mm', ang: '0.2578°' } },
    ],
  },
  {
    slug: 'mirror-equation-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'Mirror Equation Calculator: Concave and Convex Mirrors',
    h1: 'Mirror Equation Calculator',
    metaDescription:
      'Use the mirror equation to find the image distance, magnification and image type for a concave or convex mirror from its focal length and the object distance.',
    about:
      'Picture a shaving mirror, a satellite dish or the passenger-side mirror of a car: each is a curved reflector, and where the reflection appears depends on the curve. A concave reflector curves inward like a bowl and has a positive focal length; a convex one bulges outward and has a negative focal length, as in a rear-view mirror. Type the focal length in centimetres (a minus sign for bulging mirrors) and how far the object stands from the glass to learn where the reflection forms, how large it looks and whether it is real or virtual.',
    inputs: [real('f', 'Focal length (cm, negative for convex)', 15, -1e6, 1e6), pos('do', 'Object distance (cm)', 40, 1e6)],
    outputs: [out('di', 'Image distance', true), out('m', 'Magnification'), out('kind', 'Image')],
    calculate: (i) => {
      const f = toD(i.f);
      const dobj = toD(i.do);
      if (f.isZero() || dobj.eq(f)) return { di: 'At infinity (parallel rays)', m: 'Not defined', kind: 'No image forms' };
      const di = new D(1).div(new D(1).div(f).minus(new D(1).div(dobj)));
      const m = di.neg().div(dobj);
      return { di: u(di, 2, 'cm'), m: `${fmtNumber(m, 3)}×`, kind: imageKind(di, m) };
    },
    formulaDescription:
      '1 ÷ f = 1 ÷ d_o + 1 ÷ d_i and m = −d_i ÷ d_o. With this sign convention a positive image distance is real (in front of the mirror) and a negative one is virtual (behind it). Paraxial rays only.',
    formulaLatex: '\\dfrac{1}{f} = \\dfrac{1}{d_o} + \\dfrac{1}{d_i}',
    workedExample: 'A concave mirror with f = 15 cm and an object at 40 cm: d_i = 1 ÷ (1/15 − 1/40) = 24 cm and m = −0.6, a real, inverted, reduced image.',
    faq: [
      { question: 'How is it related to the focal length?', answer: "A spherical mirror's focal length is half its radius of curvature." },
      { question: 'Why are car mirrors convex?', answer: 'They show a wider field of view, at the cost of making things look smaller and farther away.' },
      {
        question: 'What makes a magnified image?',
        answer: 'A concave mirror with the object closer than the focal length gives an upright, enlarged virtual image.',
      },
    ],
    scenarios: mixed(
      'mirror-equation-calculator',
      12,
      (r) => ({ f: r(-480, 760) || 10.5, do: r(31, 940) }),
      (v) => `reflector ${v.f} cm focal, standing ${v.do} cm away`,
    ),
    introOutputs: ['di'],
    relatedSlugs: ['thin-lens-calculator', 'snells-law-calculator', 'telescope-magnification-calculator'],
    checks: [
      { inputs: {}, expect: { di: '24 cm', m: '-0.6×', kind: 'Real, inverted, reduced' } },
      { inputs: { f: 15, do: 10 }, expect: { di: '-30 cm', m: '3×', kind: 'Virtual, upright, magnified' } },
      { inputs: { f: -20, do: 50 }, expect: { di: '-14.29 cm', m: '0.286×', kind: 'Virtual, upright, reduced' } },
      { inputs: { f: 12, do: 12 }, expect: { di: 'At infinity (parallel rays)', m: 'Not defined', kind: 'No image forms' } },
    ],
  },
  {
    slug: 'brewster-angle-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'Brewster Angle Calculator: Polarising Angle',
    h1: 'Brewster Angle Calculator',
    metaDescription:
      "Calculate Brewster's angle, where reflected light is fully polarised, from the refractive indices of the two media, with the refraction angle.",
    about:
      'Reflected sunlight off a lake or a wet road is partly polarised, and at one particular angle of incidence it becomes completely polarised, vibrating only parallel to the surface. Photographers and anglers use polarising sunglasses or filters to remove that glare. Give the refractive index of the material the light starts in and of the material it strikes, and the page returns the glare-free angle, named for David Brewster, plus the direction the transmitted beam takes, which is exactly perpendicular to the reflected one.',
    inputs: [field('n1', 'Refractive index of the first medium', 1, 1, 4), field('n2', 'Refractive index of the second medium', 1.5, 1, 4)],
    outputs: [out('ang', 'Brewster angle', true), out('ref', 'Angle of the refracted ray')],
    calculate: (i) => {
      const a = D.atan(toD(i.n2).div(toD(i.n1))).div(RAD);
      return { ang: `${fmtNumber(a, 2)}°`, ref: `${fmtNumber(new D(90).minus(a), 2)}°` };
    },
    formulaDescription:
      'tan θ_B = n₂ ÷ n₁. At this angle the reflected and refracted rays are at right angles, so θ_refracted = 90° − θ_B. Angles are from the normal.',
    formulaLatex: '\\tan\\theta_{B} = \\dfrac{n_{2}}{n_{1}}',
    workedExample: 'Air (1.00) to glass (1.50): θ_B = atan(1.5) = 56.31°, and the refracted ray leaves at 33.69°.',
    faq: [
      { question: 'Why does it reduce glare?', answer: 'Glare is mostly reflected light polarised horizontally; a polariser with a vertical axis blocks it.' },
      { question: 'What about water?', answer: "For air to water (1.33), Brewster's angle is about 53.1°." },
      { question: 'Does it work from inside the glass?', answer: 'Yes; swap the indices and the angle changes accordingly, here to 33.69°.' },
    ],
    scenarios: mixed(
      'brewster-angle-calculator',
      12,
      (r) => ({ n1: r(1, 2.2), n2: r(1, 2.8) }),
      (v) => `from index ${v.n1} onto index ${v.n2}`,
    ),
    introOutputs: ['ref'],
    relatedSlugs: ['snells-law-calculator', 'thin-lens-calculator', 'photon-energy-calculator'],
    checks: [
      { inputs: {}, expect: { ang: '56.31°', ref: '33.69°' } },
      { inputs: { n1: 1.33, n2: 1.5 }, expect: { ang: '48.44°', ref: '41.56°' } },
      { inputs: { n1: 1.5, n2: 1 }, expect: { ang: '33.69°', ref: '56.31°' } },
    ],
  },
  {
    slug: 'telescope-magnification-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Waves and optics',
    title: 'Telescope Magnification Calculator: Focal Lengths and Aperture',
    h1: 'Telescope Magnification Calculator',
    metaDescription:
      'Calculate the magnification of a telescope from the focal lengths of the objective and eyepiece, with the exit pupil and the highest useful magnification for its aperture.',
    about:
      "A telescope's magnification is the focal length of its main mirror or lens divided by the focal length of the eyepiece, so swapping the eyepiece changes the power. But more magnification is not always better: the aperture sets the detail that can be seen, and beyond about twice the aperture in millimetres the image only gets blurrier. Enter the three values to get the magnification, the exit pupil, the size of the light beam leaving the eyepiece, and that practical limit.",
    inputs: [pos('fo', 'Objective focal length (mm)', 900, 1e6), pos('fe', 'Eyepiece focal length (mm)', 25, 1e5), pos('ap', 'Aperture (mm)', 100, 1e5)],
    outputs: [out('mag', 'Magnification', true), out('pupil', 'Exit pupil'), out('maxm', 'Highest useful magnification')],
    calculate: (i) => {
      const m = toD(i.fo).div(toD(i.fe));
      return { mag: `${fmtNumber(m, 1)}×`, pupil: u(toD(i.ap).div(m), 2, 'mm'), maxm: `${fmtNumber(toD(i.ap).mul(2), 0)}×` };
    },
    formulaDescription:
      'M = f_objective ÷ f_eyepiece. Exit pupil = aperture ÷ M. A common rule of thumb limits useful magnification to about 2 × aperture in mm (50 × the aperture in inches).',
    formulaLatex: 'M = \\dfrac{f_{obj}}{f_{eye}}',
    workedExample:
      'A 900 mm focal length telescope with a 25 mm eyepiece magnifies 36×. With a 100 mm aperture the exit pupil is 2.78 mm and the highest useful magnification is about 200×.',
    faq: [
      {
        question: 'Why does a bigger aperture matter more?',
        answer: 'It collects more light and resolves finer detail, which magnification alone cannot add.',
      },
      {
        question: 'What is the exit pupil?',
        answer:
          'The diameter of the light beam leaving the eyepiece; for comfortable viewing it should not exceed the pupil of your eye, about 7 mm in the dark.',
      },
      { question: 'Does a Barlow lens change it?', answer: 'Yes, it multiplies the effective focal length, so a 2× Barlow doubles the magnification.' },
    ],
    scenarios: mixed(
      'telescope-magnification-calculator',
      12,
      (r) => ({ fo: r(200, 3000), fe: r(4, 40), ap: r(50, 350) }),
      (v) => `focal ${v.fo} mm, eyepiece ${v.fe} mm, aperture ${v.ap} mm`,
    ),
    introOutputs: ['mag', 'pupil'],
    relatedSlugs: ['thin-lens-calculator', 'mirror-equation-calculator', 'snells-law-calculator'],
    checks: [
      { inputs: {}, expect: { mag: '36×', pupil: '2.78 mm', maxm: '200×' } },
      { inputs: { fo: 1200, fe: 10, ap: 150 }, expect: { mag: '120×', pupil: '1.25 mm', maxm: '300×' } },
      { inputs: { fo: 500, fe: 32, ap: 80 }, expect: { mag: '15.6×', pupil: '5.12 mm' } },
    ],
  },
  {
    slug: 'de-broglie-wavelength-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Modern physics',
    title: 'De Broglie Wavelength Calculator: Matter Waves',
    h1: 'De Broglie Wavelength Calculator',
    metaDescription: 'Calculate the de Broglie wavelength of a particle or object from its mass and speed, with its kinetic energy in electronvolts.',
    about:
      'Quantum mechanics says every moving particle has a wavelength, the Planck constant divided by its momentum. For an electron the wavelength is comparable with the spacing of atoms, which is why electrons diffract from crystals and why electron microscopes can see fine detail. For a thrown ball it is absurdly small, far below anything measurable. Enter the mass in kilograms (scientific notation such as 9.109e-31 works) and the speed in metres per second to get the wavelength and the kinetic energy.',
    inputs: [pos('m', 'Mass (kg, e.g. 9.109e-31 for an electron)', 9.109e-31, 1e12), pos('v', 'Speed (m/s, below about 3×10⁷)', 1e6, 3e7)],
    outputs: [out('nm', 'Wavelength', true), out('m', 'In metres'), out('ev', 'Kinetic energy')],
    calculate: (i) => {
      const m = toD(i.m);
      const v = toD(i.v);
      const lam = H.div(m.mul(v));
      return { nm: u(lam.mul('1e9'), 4, 'nm'), m: `${sci(lam)} m`, ev: u(m.mul(v.pow(2)).div(2).div(QE), 3, 'eV') };
    },
    formulaDescription:
      'λ = h ÷ (m v) with h = 6.62607015×10⁻³⁴ J·s. The kinetic energy ½ m v² is converted with 1 eV = 1.602176634×10⁻¹⁹ J. Non-relativistic: keep the speed under about a tenth of the speed of light.',
    formulaLatex: '\\lambda = \\dfrac{h}{mv}',
    workedExample: 'An electron (9.109×10⁻³¹ kg) at 10⁶ m/s: λ = 6.626×10⁻³⁴ ÷ (9.109×10⁻²⁵) = 0.7274 nm, with a kinetic energy of 2.843 eV.',
    faq: [
      {
        question: 'Why do we not see the wavelength of a ball?',
        answer: 'Its mass is so large that the wavelength is about 10⁻³⁴ m, far too small to show any wave effect.',
      },
      { question: 'How was it confirmed?', answer: 'By electron diffraction from crystals in 1927, as Davisson and Germer showed.' },
      {
        question: "Is it the same as a photon's wavelength?",
        answer: "A photon's wavelength follows from its energy; for matter, it follows from its momentum.",
      },
    ],
    scenarios: mixed(
      'de-broglie-wavelength-calculator',
      12,
      (r) => ({ m: e10(r(1, 900), -31), v: e10(r(1, 900), 4) }),
      (v) => `mass ${v.m} kg at ${v.v} m/s`,
    ),
    introOutputs: ['nm'],
    relatedSlugs: ['photon-energy-calculator', 'photoelectric-effect-calculator', 'time-dilation-calculator'],
    checks: [
      { inputs: {}, expect: { nm: '0.7274 nm', m: '7.274 × 10^-10 m', ev: '2.843 eV' } },
      { inputs: { m: 0.145, v: 40 }, expect: { nm: '0 nm', m: '1.142 × 10^-34 m', ev: '724,015,052,637,448,462,502.044 eV' } },
      { inputs: { m: 1.6726e-27, v: 2000 }, expect: { nm: '0.1981 nm', ev: '0.021 eV' } },
    ],
  },
  {
    slug: 'photoelectric-effect-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Modern physics',
    title: 'Photoelectric Effect Calculator: Electron Energy and Cutoff',
    h1: 'Photoelectric Effect Calculator',
    metaDescription:
      'Calculate the maximum kinetic energy of electrons ejected from a metal by light of a given wavelength, the stopping potential and the cutoff wavelength.',
    about:
      "Shine light on a metal and electrons come out, but only if each photon carries enough energy to overcome the metal's work function. Brighter light of too low a frequency does nothing; this puzzle led Einstein to the photon picture. Choose a metal, enter the wavelength of the light in nanometres and the calculator gives the maximum kinetic energy of the ejected electrons in electronvolts, the stopping voltage that halts them and the longest wavelength that works at all.",
    inputs: [
      sel('metal', 'Metal (work function)', 'zn', [
        ['cs', 'Caesium (about 2.1 eV)'],
        ['na', 'Sodium (about 2.3 eV)'],
        ['zn', 'Zinc (about 4.3 eV)'],
        ['cu', 'Copper (about 4.7 eV)'],
        ['pt', 'Platinum (about 5.6 eV)'],
      ]),
      pos('nm', 'Wavelength of the light (nm)', 250, 1e6),
    ],
    outputs: [out('ke', 'Maximum electron energy', true), out('stop', 'Stopping potential'), out('cut', 'Cutoff wavelength')],
    calculate: (i) => {
      const phi = new D(PHI[String(i.metal)] ?? '4.3');
      const hc = H.mul(C).div(QE).mul('1e9');
      const ke = hc.div(toD(i.nm)).minus(phi);
      const cut = u(hc.div(phi), 1, 'nm');
      if (ke.lt(0)) return { ke: 'No electrons are ejected', stop: '0 V', cut };
      return { ke: u(ke, 3, 'eV'), stop: u(ke, 3, 'V'), cut };
    },
    formulaDescription:
      'K_max = h c ÷ λ − φ, with h c = 1,239.84 eV·nm. The stopping potential in volts equals K_max in eV, and the cutoff wavelength is h c ÷ φ. Work functions are typical figures that vary with the surface.',
    formulaLatex: 'K_{max} = \\dfrac{hc}{\\lambda} - \\phi',
    workedExample:
      '250 nm ultraviolet light has a photon energy of 4.959 eV. On zinc (φ ≈ 4.3 eV) electrons leave with up to 0.659 eV, a stopping potential of 0.659 V. The cutoff wavelength is 288.3 nm.',
    faq: [
      {
        question: 'Why does brightness not help below the cutoff?',
        answer: 'Each electron absorbs a single photon, so a photon without enough energy ejects nothing however many arrive.',
      },
      {
        question: 'What does a brighter light change?',
        answer: 'Above the cutoff, it ejects more electrons per second, but each has the same maximum energy.',
      },
      { question: 'What is the stopping potential?', answer: 'The reverse voltage that just stops the fastest electrons reaching the collector.' },
    ],
    scenarios: varied(
      'photoelectric-effect-calculator',
      12,
      [{ name: 'nm', lo: 120, hi: 700, step: 5 }],
      [{ name: 'metal', options: ['cs', 'na', 'zn', 'cu', 'pt'] }],
      (v) => `${v.metal} with ${v.nm} nm light`,
    ),
    introOutputs: ['ke'],
    relatedSlugs: ['photon-energy-calculator', 'de-broglie-wavelength-calculator', 'hydrogen-spectrum-calculator'],
    checks: [
      { inputs: {}, expect: { ke: '0.659 eV', stop: '0.659 V', cut: '288.3 nm' } },
      { inputs: { metal: 'cs', nm: 500 }, expect: { ke: '0.38 eV', stop: '0.38 V', cut: '590.4 nm' } },
      { inputs: { metal: 'pt', nm: 300 }, expect: { ke: 'No electrons are ejected', stop: '0 V', cut: '221.4 nm' } },
      { inputs: { metal: 'na', nm: 400 }, expect: { ke: '0.8 eV', cut: '539.1 nm' } },
    ],
  },
  {
    slug: 'hydrogen-spectrum-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Modern physics',
    title: 'Hydrogen Spectrum Calculator: Rydberg Formula',
    h1: 'Hydrogen Spectrum Calculator',
    metaDescription:
      'Find the wavelength, series name and photon energy of a hydrogen emission line from the upper and lower energy levels using the Rydberg formula.',
    about:
      'When the electron in a hydrogen atom drops from a higher energy level to a lower one it emits a photon of a precise wavelength. The wavelengths follow the Rydberg formula, and the lines are grouped into series by the level they end on: Lyman in the ultraviolet, Balmer in the visible and Paschen in the infrared. Enter the upper and lower level numbers to get the wavelength, the name of the series, the photon energy and the part of the spectrum.',
    inputs: [intField('nu', 'Upper level n', 3, 2, 60), intField('nl', 'Lower level n', 2, 1, 59)],
    outputs: [out('lam', 'Wavelength', true), out('series', 'Series'), out('e', 'Photon energy'), out('band', 'Spectrum band')],
    calculate: (i) => {
      const nu = Number(i.nu);
      const nl = Number(i.nl);
      if (nu <= nl) return { lam: 'The upper level must be higher than the lower level', series: '', e: '', band: '' };
      const x = new D(1).div(nl * nl).minus(new D(1).div(nu * nu));
      const lam = new D(1).div(RH.mul(x)).mul('1e9');
      return { lam: u(lam, 2, 'nm'), series: `${SERIES[nl] ?? 'Humphreys or higher'} series`, e: u(RH.mul(H).mul(C).div(QE).mul(x), 3, 'eV'), band: band(lam) };
    },
    formulaDescription:
      '1 ÷ λ = R_H (1 ÷ n_l² − 1 ÷ n_u²) with R_H = 1.0967758341×10⁷ m⁻¹ for hydrogen, and E = h c ÷ λ. Wavelengths are in vacuum; the Bohr model with the electron mass correction.',
    formulaLatex: '\\dfrac{1}{\\lambda} = R_{H}\\left(\\dfrac{1}{n_{l}^{2}} - \\dfrac{1}{n_{u}^{2}}\\right)',
    workedExample: 'The jump from n = 3 to n = 2 gives 656.47 nm, the red Hα line of the Balmer series, with a photon energy of 1.889 eV.',
    faq: [
      {
        question: 'Why are the lines at fixed wavelengths?',
        answer: 'The electron can only occupy certain energy levels, so each jump releases a photon of one specific energy.',
      },
      {
        question: 'Which lines can I see?',
        answer: 'The Balmer series, ending on level 2, has four lines in the visible range, from red at 656 nm to violet at 410 nm.',
      },
      { question: 'Why vacuum wavelengths?', answer: 'Wavelengths measured in air are about 0.03% shorter, so tables for air list slightly smaller values.' },
    ],
    scenarios: mixed(
      'hydrogen-spectrum-calculator',
      12,
      (r) => {
        const nl = Math.floor(r(1, 5.99));
        return { nl, nu: nl + Math.floor(r(1, 9.99)) };
      },
      (v) => `n ${v.nu} to ${v.nl}`,
    ),
    introOutputs: ['lam', 'series'],
    relatedSlugs: ['photon-energy-calculator', 'wiens-law-calculator', 'photoelectric-effect-calculator'],
    checks: [
      { inputs: {}, expect: { lam: '656.47 nm', series: 'Balmer series', e: '1.889 eV', band: 'Visible light' } },
      { inputs: { nu: 2, nl: 1 }, expect: { lam: '121.57 nm', series: 'Lyman series', e: '10.199 eV', band: 'Ultraviolet' } },
      { inputs: { nu: 4, nl: 3 }, expect: { lam: '1,875.63 nm', series: 'Paschen series', e: '0.661 eV', band: 'Infrared' } },
      { inputs: { nu: 5, nl: 2 }, expect: { lam: '434.17 nm', series: 'Balmer series' } },
      { inputs: { nu: 2, nl: 2 }, expect: { lam: 'The upper level must be higher than the lower level' } },
    ],
  },
  {
    slug: 'schwarzschild-radius-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Modern physics',
    title: 'Schwarzschild Radius Calculator: Black Hole Size',
    h1: 'Schwarzschild Radius Calculator',
    metaDescription:
      'Calculate the Schwarzschild radius of a mass, the size to which it would have to be squeezed to become a black hole, for the Sun, the Earth, Jupiter or a mass in kilograms.',
    about:
      'Every mass has a critical radius, the Schwarzschild radius, below which it would collapse into a black hole because even light could not escape. For the Sun it is only about 3 kilometres, and for the Earth less than a centimetre. Enter a mass and choose its unit, in solar masses, Earth masses, Jupiter masses or kilograms, to get the radius in metres and in kilometres. Real stars are enormously larger than this radius, so none of them is a black hole.',
    inputs: [
      pos('m', 'Mass', 1, 1e30),
      sel('unit', 'Unit', 'sun', [
        ['sun', 'Solar masses (1.98847×10³⁰ kg)'],
        ['earth', 'Earth masses (5.9722×10²⁴ kg)'],
        ['jupiter', 'Jupiter masses (1.89813×10²⁷ kg)'],
        ['kg', 'Kilograms'],
      ]),
    ],
    outputs: [out('rs', 'Schwarzschild radius', true), out('km', 'In kilometres')],
    calculate: (i) => {
      const rs = new D(2)
        .mul(new D('6.6743e-11'))
        .mul(toD(i.m).mul(new D(MASSES[String(i.unit)] ?? '1')))
        .div(C.pow(2));
      return { rs: `${sci(rs)} m`, km: u(rs.div(1000), 6, 'km') };
    },
    formulaDescription:
      'r_s = 2 G M ÷ c² with G = 6.6743×10⁻¹¹ and c = 299,792,458 m/s. It is the radius at which the escape velocity equals the speed of light.',
    formulaLatex: 'r_{s} = \\dfrac{2GM}{c^{2}}',
    workedExample: 'One solar mass: r_s = 2 × 6.6743×10⁻¹¹ × 1.98847×10³⁰ ÷ (299,792,458)² = 2.953×10³ m, or 2.953339 km.',
    faq: [
      { question: 'Does the Sun become a black hole?', answer: 'No. It is far too big (700,000 km radius) and will end as a white dwarf, not a black hole.' },
      {
        question: 'How big is a supermassive black hole?',
        answer: 'The one in our galaxy has about 4.3 million solar masses, a radius of roughly 12.7 million km.',
      },
      { question: 'Is the radius the size of the black hole?', answer: 'It is the radius of the event horizon, the boundary beyond which nothing can return.' },
    ],
    scenarios: varied(
      'schwarzschild-radius-calculator',
      12,
      [{ name: 'm', lo: 1, hi: 900, step: 1 }],
      [{ name: 'unit', options: ['sun', 'earth', 'jupiter', 'kg'] }],
      (v) => `${v.m} of ${v.unit}`,
    ),
    introOutputs: ['rs'],
    relatedSlugs: ['escape-velocity-calculator', 'mass-energy-calculator', 'gravitational-force-calculator'],
    checks: [
      { inputs: {}, expect: { rs: '2.953 × 10^3 m', km: '2.953339 km' } },
      { inputs: { m: 1, unit: 'earth' }, expect: { rs: '8.870 × 10^-3 m', km: '0.000009 km' } },
      { inputs: { m: 4300000, unit: 'sun' }, expect: { rs: '1.270 × 10^10 m', km: '12,699,359.342888 km' } },
    ],
  },
  {
    slug: 'banked-curve-calculator',
    category: 'physics',
    tier: 3,
    subCluster: 'Forces',
    title: 'Banked Curve Calculator: Ideal Banking Angle',
    h1: 'Banked Curve Calculator',
    metaDescription:
      'Find the ideal banking angle of a curve for a given speed and radius, the lateral acceleration in g, and the top speed on a flat curve for different road surfaces.',
    about:
      'A banked curve tilts the road so that part of the normal force points toward the centre of the bend and supplies the centripetal force, without needing any friction. At the ideal angle a car can take the bend at exactly the design speed even on ice. Enter the speed in kilometres per hour and the radius of the curve, and choose a road surface to see the ideal angle, the sideways acceleration in g and the fastest the same curve could be taken if it were flat.',
    inputs: [
      pos('kmh', 'Speed (km/h)', 90, 2000),
      pos('r', 'Radius of the curve (m)', 300, 1e7),
      sel('surf', 'Road surface (flat case)', 'dry', [
        ['dry', 'Dry (μ 0.7)'],
        ['wet', 'Wet (μ 0.4)'],
        ['ice', 'Ice (μ 0.1)'],
      ]),
    ],
    outputs: [out('ang', 'Ideal banking angle', true), out('g', 'Sideways acceleration'), out('max', 'Top speed if the curve were flat')],
    calculate: (i) => {
      const v = toD(i.kmh).div('3.6');
      const r = toD(i.r);
      const mu = new D(FRICTION[String(i.surf)] ?? '0.7');
      return {
        ang: `${fmtNumber(D.atan(v.pow(2).div(r.mul(G))).div(RAD), 2)}°`,
        g: u(v.pow(2).div(r).div(G), 3, 'g'),
        max: u(mu.mul(r).mul(G).sqrt().mul('3.6'), 1, 'km/h'),
      };
    },
    formulaDescription: 'Ideal banking: tan θ = v² ÷ (r g). Flat curve limit: v_max = √(μ r g). Level-road friction only, no aerodynamic downforce.',
    formulaLatex: '\\tan\\theta = \\dfrac{v^{2}}{rg}',
    workedExample:
      '90 km/h (25 m/s) on a 300 m radius: tan θ = 625 ÷ (300 × 9.80665) = 0.2124, so θ = 11.99°, a sideways load of 0.212 g. Flat on dry road the limit is 163.4 km/h.',
    faq: [
      {
        question: 'Why bank a road at all?',
        answer: 'It lets cars corner at speed without depending on tyre grip, and it is safer when the surface is wet or icy.',
      },
      {
        question: 'What if I drive faster than the design speed?',
        answer: 'Then friction must supply the missing inward force, and the car tends to slide up the bank.',
      },
      { question: 'Does the mass matter?', answer: 'No. It cancels, so heavy and light vehicles share the same ideal angle.' },
    ],
    scenarios: varied(
      'banked-curve-calculator',
      12,
      [
        { name: 'kmh', lo: 20, hi: 300, step: 5 },
        { name: 'r', lo: 20, hi: 1500, step: 10 },
      ],
      [{ name: 'surf', options: ['dry', 'wet', 'ice'] }],
      (v) => `${v.kmh} km/h, ${v.r} m radius, ${v.surf}`,
    ),
    introOutputs: ['ang'],
    relatedSlugs: ['centripetal-force-calculator', 'stopping-distance-calculator', 'inclined-plane-calculator'],
    checks: [
      { inputs: {}, expect: { ang: '11.99°', g: '0.212 g', max: '163.4 km/h' } },
      { inputs: { kmh: 60, r: 100, surf: 'wet' }, expect: { ang: '15.82°', g: '0.283 g', max: '71.3 km/h' } },
      { inputs: { kmh: 120, r: 500, surf: 'ice' }, expect: { ang: '12.77°', max: '79.7 km/h' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
