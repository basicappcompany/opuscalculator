import { selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtFixed, fmtNumber } from '../lib/format';
import { ATOMIC_MASS, hillFormula, wholeNumberRatio } from '../lib/formula';
import { fmtSig } from '../lib/gen-utils';
import { defineCalculator, mixed, type Spec } from '../lib/spec';
import { field, intField, sci, varied } from '../lib/spec-helpers';
import type { CalculatorConfig, Scenario } from '../lib/types';

/**
 * Catalog batch 9 (chemistry): atoms and crystals, solution recipes and buffers, mole conversions and formulas.
 * Every formula, sentence and number is written for this site. Constants: N_A = 6.02214076e23 per mol, e = 1.602176634e-19 C,
 * epsilon_0 = 8.8541878128e-12 F/m (CODATA 2018, exact or recommended). Pages are tier 2 or 3, so none is live until the
 * cohort gate opens. Chemistry shows the category disclaimer; nothing here is a dose or a safety instruction.
 */

const NA = new D('6.02214076e23');
const E_CHARGE = new D('1.602176634e-19');
const EPS0 = new D('8.8541878128e-12');
const PI = new D('3.14159265358979323846264338327950288');
const LN10 = new D(10).ln();

const select = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});

const sig4 = (x: Dec): string => fmtSig(x, 4, false);
const withInputs = (label: string, inputs: Scenario['inputs']): Scenario => ({ label, inputs });

const SYMBOLS =
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(
    ' ',
  );

/** Subshells in the order the Madelung rule fills them. */
const FILL: [number, string, number][] = [
  [1, 's', 2],
  [2, 's', 2],
  [2, 'p', 6],
  [3, 's', 2],
  [3, 'p', 6],
  [4, 's', 2],
  [3, 'd', 10],
  [4, 'p', 6],
  [5, 's', 2],
  [4, 'd', 10],
  [5, 'p', 6],
  [6, 's', 2],
  [4, 'f', 14],
  [5, 'd', 10],
  [6, 'p', 6],
  [7, 's', 2],
  [5, 'f', 14],
  [6, 'd', 10],
  [7, 'p', 6],
];
/** Measured ground states that differ from the Madelung filling: the subshells whose counts change. */
const EXCEPTIONS: Record<number, Record<string, number>> = {
  24: { '3d': 5, '4s': 1 },
  29: { '3d': 10, '4s': 1 },
  41: { '4d': 4, '5s': 1 },
  42: { '4d': 5, '5s': 1 },
  44: { '4d': 7, '5s': 1 },
  45: { '4d': 8, '5s': 1 },
  46: { '4d': 10, '5s': 0 },
  47: { '4d': 10, '5s': 1 },
  57: { '4f': 0, '5d': 1 },
  58: { '4f': 1, '5d': 1 },
  64: { '4f': 7, '5d': 1 },
  78: { '5d': 9, '6s': 1 },
  79: { '5d': 10, '6s': 1 },
  89: { '5f': 0, '6d': 1 },
  90: { '5f': 0, '6d': 2 },
  91: { '5f': 2, '6d': 1 },
  92: { '5f': 3, '6d': 1 },
  93: { '5f': 4, '6d': 1 },
  96: { '5f': 7, '6d': 1 },
  103: { '6d': 0, '7p': 1 },
};
const NOBLE: [number, string][] = [
  [2, 'He'],
  [10, 'Ne'],
  [18, 'Ar'],
  [36, 'Kr'],
  [54, 'Xe'],
  [86, 'Rn'],
];
const L_ORDER = 's p d f';

function electronConfig(z: number): { entries: [string, number][]; shorthand: string; outer: number } {
  const counts = new Map<string, number>();
  let left = z;
  for (const [n, l, cap] of FILL) {
    if (left <= 0) break;
    const take = Math.min(cap, left);
    counts.set(`${n}${l}`, take);
    left -= take;
  }
  for (const [key, count] of Object.entries(EXCEPTIONS[z] ?? {})) counts.set(key, count);
  const entries = [...counts.entries()]
    .filter(([, c]) => c > 0)
    .sort(([a], [b]) => Number(a[0]) - Number(b[0]) || L_ORDER.indexOf(a[1]) - L_ORDER.indexOf(b[1]));
  const core = [...NOBLE].reverse().find(([cz]) => cz < z);
  let shorthand = entries.map(([k, c]) => `${k}${c}`).join(' ');
  if (core) {
    const coreKeys = new Set(electronConfigKeys(core[0]));
    shorthand = `[${core[1]}] ${entries
      .filter(([k]) => !coreKeys.has(k))
      .map(([k, c]) => `${k}${c}`)
      .join(' ')}`.trim();
  }
  const topShell = Math.max(...entries.map(([k]) => Number(k[0])));
  const outer = entries.filter(([k]) => Number(k[0]) === topShell).reduce((s, [, c]) => s + c, 0);
  return { entries, shorthand, outer };
}
/** The subshell keys that are completely inside a noble-gas core. */
function electronConfigKeys(coreZ: number): string[] {
  const keys: string[] = [];
  let left = coreZ;
  for (const [n, l, cap] of FILL) {
    if (left <= 0) break;
    keys.push(`${n}${l}`);
    left -= cap;
  }
  return keys;
}

const ELEMENTS = ['C', 'H', 'O', 'N', 'S', 'P', 'Cl', 'Na', 'K', 'Ca', 'Fe', 'Mg', 'Al', 'F', 'Br', 'I', 'Cu', 'Zn', 'Mn', 'Si', 'Pb'];
const ELEMENT_OPTIONS: [string, string][] = [['none', 'None'], ...ELEMENTS.map((s): [string, string] => [s, s])];
const ZERO = BigInt(0);
const ONE = BigInt(1);
const gcd = (a: bigint, b: bigint): bigint => (b === ZERO ? (a < ZERO ? -a : a) : gcd(b, a % b));

export const SPECS: Spec[] = [
  {
    slug: 'atom-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Atoms and elements',
    title: 'Atom Calculator: Protons, Neutrons and Electrons',
    h1: 'Atom Calculator',
    metaDescription: 'Find the number of protons, neutrons and electrons in an atom or ion from its atomic number, mass number and charge.',
    about:
      'Every atom is built from three kinds of particle, and three numbers describe them. The atomic number is the count of protons and names the element. The mass number is protons plus neutrons, so subtracting the first from the second gives the neutrons. An atom is neutral when its electrons equal its protons, and an ion has lost electrons if its charge is positive or gained them if negative. Enter the three numbers and the page returns the particle counts and the isotope symbol. Mass numbers are whole numbers, unlike the decimal average on the periodic table.',
    inputs: [intField('z', 'Atomic number (protons)', 26, 1, 118), intField('a', 'Mass number', 56, 1, 300), intField('charge', 'Charge', 0, -10, 10)],
    outputs: [
      { name: 'p', label: 'Protons', format: 'text' },
      { name: 'n', label: 'Neutrons', format: 'text', highlight: true },
      { name: 'e', label: 'Electrons', format: 'text' },
      { name: 'symbol', label: 'Isotope', format: 'text' },
    ],
    calculate: (i) => {
      const z = Number(i.z);
      const a = Number(i.a);
      const symbol = SYMBOLS[z - 1] ?? '?';
      if (a < z) return { p: String(z), n: 'The mass number cannot be below the atomic number', e: '-', symbol };
      return { p: String(z), n: String(a - z), e: String(z - Number(i.charge)), symbol: `${symbol}-${a}` };
    },
    formulaDescription:
      'Protons = atomic number Z. Neutrons = mass number A − Z. Electrons = Z − charge. The isotope is written as the element symbol and the mass number.',
    workedExample:
      'Iron-56 has Z = 26 and A = 56, so 26 protons, 56 − 26 = 30 neutrons and, when neutral, 26 electrons. The ion Fe with charge +3 has 23 electrons.',
    faq: [
      {
        question: 'Why is the mass number a whole number?',
        answer: 'It counts particles, protons plus neutrons. The atomic mass on the periodic table is a weighted average over isotopes and is not whole.',
      },
      {
        question: 'Does the charge change the neutrons?',
        answer: 'No. Gaining or losing electrons changes only the electron count. The nucleus is untouched.',
      },
      { question: 'What are isotopes?', answer: 'Atoms of one element with different neutron numbers, such as carbon-12 and carbon-14.' },
    ],
    scenarios: mixed(
      'atom-calculator',
      8,
      (r) => {
        const z = Math.round(r(3, 92));
        return { z, a: z + Math.round(r(0, 1.4) * z), charge: Math.round(r(-3, 4)) };
      },
      (v) => `Z ${v.z}, mass number ${v.a}, charge ${v.charge}`,
    ),
    introOutputs: ['n'],
    relatedSlugs: ['average-atomic-mass-calculator', 'molar-mass-calculator'],
    checks: [
      { inputs: {}, expect: { p: '26', n: '30', e: '26', symbol: 'Fe-56' } },
      { inputs: { z: 8, a: 18, charge: -2 }, expect: { n: '10', e: '10', symbol: 'O-18' } },
      { inputs: { z: 11, a: 23, charge: 1 }, expect: { n: '12', e: '10', symbol: 'Na-23' } },
    ],
  },
  {
    slug: 'effective-nuclear-charge-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Atoms and elements',
    title: "Effective Nuclear Charge Calculator Using Slater's Rules",
    h1: 'Effective Nuclear Charge Calculator',
    metaDescription: 'Estimate the effective nuclear charge felt by an outer s or p electron from the atomic number and Slater shielding constants.',
    about:
      "An outer electron does not feel the full pull of the nucleus, because the electrons between them partly screen it. The effective nuclear charge Zeff is the atomic number minus a shielding constant S. Slater's rules estimate S for an electron in an s or p orbital: each other electron in the same group shields by 0.35, each electron in the shell one level lower by 0.85, and every electron deeper still by 1.00. Count the electrons in each group, enter them and the page gives S and Zeff. The rule explains why atoms shrink across a period.",
    inputs: [
      intField('z', 'Atomic number (Z)', 11, 1, 118),
      intField('same', 'Other electrons in the same shell group', 0, 0, 10),
      intField('prev', 'Electrons in the shell one level lower (n − 1)', 8, 0, 32),
      intField('inner', 'Electrons in all shells deeper than that', 2, 0, 80),
    ],
    outputs: [
      { name: 's', label: 'Shielding constant S', format: 'text' },
      { name: 'zeff', label: 'Effective nuclear charge', format: 'text', highlight: true },
    ],
    calculate: (i) => {
      const s = toD(i.same).mul('0.35').plus(toD(i.prev).mul('0.85')).plus(toD(i.inner));
      return { s: fmtNumber(s, 2), zeff: fmtNumber(toD(i.z).minus(s), 2) };
    },
    formulaDescription:
      'S = 0.35 × (other electrons in the same group) + 0.85 × (electrons in shell n − 1) + 1.00 × (all deeper electrons). Zeff = Z − S. This version is for s and p electrons.',
    workedExample:
      'Sodium (Z = 11), its 3s electron: no others in its group, 8 in the n = 2 shell, 2 in n = 1. S = 0 + 6.8 + 2 = 8.8, so Zeff = 11 − 8.8 = 2.2.',
    faq: [
      {
        question: 'Why does Zeff rise across a period?',
        answer:
          'Each new proton adds a full unit of nuclear charge, while a new electron in the same shell shields only 0.35 of it, so the pull on the outer electrons grows.',
      },
      {
        question: 'What about d and f electrons?',
        answer:
          'Slater gives different values for them, since electrons in groups at the same level or inside d and f orbitals shield by 1.00. This page covers s and p electrons.',
      },
      {
        question: 'What is the 1s case?',
        answer: 'The one other 1s electron shields by 0.30, not 0.35. Enter it by lowering Z accordingly, or use the standard value of Z − 0.30.',
      },
    ],
    scenarios: mixed(
      'effective-nuclear-charge-calculator',
      8,
      (r) => ({ z: Math.round(r(5, 54)), same: Math.round(r(0, 7)), prev: Math.round(r(2, 18)), inner: Math.round(r(0, 28)) }),
      (v) => `Z ${v.z} with ${v.same} in the group, ${v.prev} one level lower and ${v.inner} deeper`,
    ),
    introOutputs: ['zeff'],
    relatedSlugs: ['electron-configuration-calculator', 'electronegativity-difference-calculator'],
    checks: [
      { inputs: {}, expect: { s: '8.8', zeff: '2.2' } },
      { inputs: { z: 17, same: 6, prev: 8, inner: 2 }, expect: { s: '10.9', zeff: '6.1' } },
      { inputs: { z: 6, same: 3, prev: 2, inner: 0 }, expect: { s: '2.75', zeff: '3.25' } },
    ],
  },
  {
    slug: 'electron-configuration-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Atoms and elements',
    title: 'Electron Configuration Calculator for Elements 1 to 118',
    h1: 'Electron Configuration Calculator',
    metaDescription: 'Write the full and noble-gas electron configuration of any element from its atomic number, with the electrons in the outer shell.',
    about:
      'An electron configuration lists how many electrons sit in each subshell. Electrons fill the lowest energy subshells first, in the order given by the Madelung rule: 1s, 2s, 2p, 3s, 3p, 4s, 3d and so on. A few elements, such as chromium, copper, silver and gold, break the pattern because a half-full or full d subshell is more stable, and this page uses their measured ground states. Enter the atomic number and read the full configuration, the shorthand that starts from the previous noble gas and the number of electrons in the outermost shell.',
    inputs: [intField('z', 'Atomic number', 26, 1, 118)],
    outputs: [
      { name: 'full', label: 'Electron configuration', format: 'text', highlight: true },
      { name: 'short', label: 'Noble-gas shorthand', format: 'text' },
      { name: 'outer', label: 'Electrons in the outermost shell', format: 'text' },
    ],
    calculate: (i) => {
      const { entries, shorthand, outer } = electronConfig(Number(i.z));
      return { full: entries.map(([k, c]) => `${k}${c}`).join(' '), short: shorthand, outer: String(outer) };
    },
    formulaDescription:
      'Fill subshells in the order 1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p, up to 2, 2, 6, 2, 6, 2, 10... electrons each (s 2, p 6, d 10, f 14), then apply the measured exceptions. The shorthand replaces the inner part with the noble gas before the element.',
    workedExample: 'Iron, Z = 26: 1s2 2s2 2p6 3s2 3p6 3d6 4s2, shorthand [Ar] 3d6 4s2, with 2 electrons in its outermost shell (n = 4).',
    faq: [
      {
        question: 'Why does 4s fill before 3d?',
        answer:
          'For atoms with few electrons the 4s subshell is lower in energy, so it fills first. Once filled, 3d drops below it, which is why 4s electrons leave first when a transition metal forms an ion.',
      },
      {
        question: 'Which elements are exceptions?',
        answer:
          'This page handles chromium, copper, niobium, molybdenum, ruthenium, rhodium, palladium, silver, lanthanum, cerium, gadolinium, platinum, gold, actinium, thorium, protactinium, uranium, neptunium, curium and lawrencium.',
      },
      {
        question: 'Are the heaviest elements certain?',
        answer: 'Elements beyond about 103 are made a few atoms at a time, so their configurations are predictions from calculation.',
      },
    ],
    scenarios: varied('electron-configuration-calculator', 8, [{ name: 'z', lo: 3, hi: 100 }], [], (v) => `element number ${v.z}`),
    introOutputs: ['short'],
    relatedSlugs: ['effective-nuclear-charge-calculator', 'atom-calculator'],
    checks: [
      { inputs: {}, expect: { full: '1s2 2s2 2p6 3s2 3p6 3d6 4s2', short: '[Ar] 3d6 4s2', outer: '2' } },
      { inputs: { z: 24 }, expect: { short: '[Ar] 3d5 4s1', outer: '1' } },
      { inputs: { z: 29 }, expect: { short: '[Ar] 3d10 4s1' } },
      { inputs: { z: 11 }, expect: { full: '1s2 2s2 2p6 3s1', short: '[Ne] 3s1', outer: '1' } },
      { inputs: { z: 1 }, expect: { full: '1s1', short: '1s1', outer: '1' } },
    ],
  },
  {
    slug: 'electronegativity-difference-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Atoms and elements',
    title: 'Electronegativity Difference Calculator: Ionic or Covalent Bond',
    h1: 'Electronegativity Difference Calculator',
    metaDescription:
      'Subtract two Pauling electronegativities to classify a bond as nonpolar covalent, polar covalent or ionic and see which atom pulls harder.',
    about:
      'Electronegativity measures how strongly an atom pulls shared electrons toward itself, and the Pauling scale runs from about 0.7 for cesium to 3.98 for fluorine. The size of the difference between two bonded atoms tells you what kind of bond they form. A gap under 0.4 is nonpolar covalent, one from 0.4 to 1.7 is polar covalent and a larger one is usually ionic. Enter the two values from a periodic table and the page gives the gap, the bond class and the atom that carries the partial negative charge. The limits are textbook conventions and not sharp lines.',
    inputs: [field('en1', 'Electronegativity of atom 1', 3.16, 0, 4.5), field('en2', 'Electronegativity of atom 2', 0.93, 0, 4.5)],
    outputs: [
      { name: 'diff', label: 'Difference', format: 'text' },
      { name: 'type', label: 'Bond type', format: 'text', highlight: true },
      { name: 'toward', label: 'Electrons pulled toward', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.en1);
      const b = toD(i.en2);
      const diff = a.minus(b).abs();
      const type = diff.lt('0.4') ? 'Nonpolar covalent' : diff.lte('1.7') ? 'Polar covalent' : 'Ionic';
      return { diff: fmtNumber(diff, 2), type, toward: a.gt(b) ? 'Atom 1' : a.lt(b) ? 'Atom 2' : 'Neither' };
    },
    formulaDescription:
      'Difference = |EN1 − EN2|. Below 0.4: nonpolar covalent. From 0.4 to 1.7: polar covalent. Above 1.7: ionic. The atom with the larger value attracts the shared electrons.',
    workedExample:
      'Chlorine at 3.16 and sodium at 0.93 differ by 2.23, so the bond is ionic and chlorine takes the electron. Carbon at 2.55 and hydrogen at 2.20 differ by 0.35, which is nonpolar covalent.',
    faq: [
      {
        question: 'Where do I find the values?',
        answer:
          'Any periodic table with a Pauling scale lists them: fluorine 3.98, oxygen 3.44, nitrogen 3.04, chlorine 3.16, carbon 2.55, hydrogen 2.20, sodium 0.93.',
      },
      {
        question: 'Is 1.7 an exact boundary?',
        answer: 'No. It is a rule of thumb that corresponds to about 50 percent ionic character. Real bonds shade continuously from covalent to ionic.',
      },
      {
        question: 'What is percent ionic character?',
        answer: 'It is a separate estimate based on the same difference. See the percent ionic character calculator.',
      },
    ],
    scenarios: mixed(
      'electronegativity-difference-calculator',
      8,
      (r) => ({ en1: r(0.7, 3.98), en2: r(0.7, 3.98) }),
      (v) => `values ${v.en1} and ${v.en2}`,
    ),
    introOutputs: ['diff'],
    relatedSlugs: ['percent-ionic-character-calculator', 'bond-order-calculator'],
    checks: [
      { inputs: {}, expect: { diff: '2.23', type: 'Ionic', toward: 'Atom 1' } },
      { inputs: { en1: 2.55, en2: 2.2 }, expect: { diff: '0.35', type: 'Nonpolar covalent', toward: 'Atom 1' } },
      { inputs: { en1: 2.2, en2: 3.44 }, expect: { diff: '1.24', type: 'Polar covalent', toward: 'Atom 2' } },
      { inputs: { en1: 2, en2: 2 }, expect: { diff: '0', type: 'Nonpolar covalent', toward: 'Neither' } },
    ],
  },
  {
    slug: 'cubic-unit-cell-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solid state',
    title: 'Cubic Unit Cell Calculator: Density, Atomic Radius and Packing',
    h1: 'Cubic Unit Cell Calculator',
    metaDescription:
      'Find the density, atomic radius and packing efficiency of a simple, body-centred or face-centred cubic metal from its edge length and molar mass.',
    about:
      'Many metals crystallise in a cubic unit cell, and the cell shape fixes how many atoms it holds: one for simple cubic, two for body-centred and four for face-centred. Knowing the edge length from X-ray diffraction and the molar mass lets you work out the density by dividing the mass of the atoms in the cell by the cell volume. The page also gives the atomic radius, which depends on which atoms touch along the cell, and the fraction of space the atoms fill. Enter the structure, the edge in picometres and the molar mass in grams per mole.',
    inputs: [
      select('cell', 'Structure', 'fcc', [
        ['sc', 'Simple cubic (1 atom)'],
        ['bcc', 'Body-centred cubic (2 atoms)'],
        ['fcc', 'Face-centred cubic (4 atoms)'],
      ]),
      field('edge', 'Edge length (pm)', 361, 50, 2000),
      field('mass', 'Molar mass (g/mol)', 63.546, 1, 400),
    ],
    outputs: [
      { name: 'density', label: 'Density', format: 'text', highlight: true },
      { name: 'radius', label: 'Atomic radius', format: 'text' },
      { name: 'packing', label: 'Packing efficiency', format: 'text' },
    ],
    calculate: (i) => {
      const cell = String(i.cell);
      const atoms = cell === 'sc' ? 1 : cell === 'bcc' ? 2 : 4;
      const edge = toD(i.edge);
      const volumeCm3 = edge.mul('1e-10').pow(3);
      const density = toD(atoms).mul(toD(i.mass)).div(NA.mul(volumeCm3));
      const radius = cell === 'sc' ? edge.div(2) : cell === 'bcc' ? edge.mul(new D(3).sqrt()).div(4) : edge.div(new D(2).sqrt().mul(2));
      const packing = cell === 'sc' ? PI.div(6) : cell === 'bcc' ? PI.mul(new D(3).sqrt()).div(8) : PI.div(new D(2).sqrt().mul(3));
      return { density: `${fmtNumber(density, 2)} g/cm³`, radius: `${fmtNumber(radius, 2)} pm`, packing: `${fmtNumber(packing.mul(100), 2)}%` };
    },
    formulaDescription:
      'Density = (atoms per cell × molar mass) ÷ (N_A × edge³), with the edge in cm. Radius: simple cubic a/2, body-centred a√3/4, face-centred a/(2√2). Packing: 52.36%, 68.02% and 74.05%.',
    workedExample:
      'Copper, face-centred, edge 361 pm, 63.546 g/mol: 4 × 63.546 ÷ (6.022 × 10^23 × (3.61 × 10^-8 cm)³) = 8.97 g/cm³, with a radius of 127.63 pm and 74.05% of the cell filled.',
    faq: [
      {
        question: 'Why are four atoms counted in a face-centred cell?',
        answer: 'Eight corner atoms each count for one eighth and six face atoms each count for one half, giving 1 + 3 = 4.',
      },
      {
        question: 'Which structure is the most efficient?',
        answer: 'Face-centred cubic and hexagonal close packing fill 74 percent of space, the maximum for equal spheres.',
      },
      {
        question: 'Why does the answer differ a little from tables?',
        answer:
          'Tabulated densities depend on temperature and on defects in the real crystal, while the calculation assumes a perfect cell at the temperature of the edge length.',
      },
    ],
    scenarios: varied(
      'cubic-unit-cell-calculator',
      8,
      [
        { name: 'edge', lo: 280, hi: 650 },
        { name: 'mass', lo: 20, hi: 210 },
      ],
      [{ name: 'cell', options: ['sc', 'bcc', 'fcc'] }],
      (v) => `${v.cell} cell with edge ${v.edge} pm and mass ${v.mass}`,
    ),
    introOutputs: ['density'],
    relatedSlugs: ['miller-indices-calculator', 'lattice-energy-calculator'],
    checks: [
      { inputs: {}, expect: { density: '8.97 g/cm³', radius: '127.63 pm', packing: '74.05%' } },
      { inputs: { cell: 'bcc', edge: 286.65, mass: 55.845 }, expect: { density: '7.87 g/cm³', radius: '124.12 pm', packing: '68.02%' } },
      { inputs: { cell: 'sc', edge: 335, mass: 209 }, expect: { density: '9.23 g/cm³', radius: '167.5 pm', packing: '52.36%' } },
    ],
  },
  {
    slug: 'miller-indices-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solid state',
    title: 'Miller Indices Calculator: Plane Indices and d-Spacing',
    h1: 'Miller Indices Calculator',
    metaDescription: 'Turn the intercepts of a crystal plane into Miller indices (hkl) and find the spacing between planes in a cubic lattice.',
    about:
      'Miller indices name a family of planes in a crystal with three small whole numbers. To find them, write the points where the plane cuts the three axes in units of the lattice constant, take the reciprocal of each, and clear fractions by multiplying to the smallest whole numbers. A plane that runs parallel to an axis never cuts it, so its intercept is taken as infinity and its index is zero; enter 0 for that case. For a cubic lattice the page also gives the distance between neighbouring planes, which is what an X-ray diffraction pattern measures.',
    inputs: [
      field('x', 'Intercept on the x axis', 1, -100, 100),
      field('y', 'Intercept on the y axis', 1, -100, 100),
      field('z', 'Intercept on the z axis', 1, -100, 100),
      field('a', 'Cubic lattice constant (pm)', 361, 50, 2000),
    ],
    outputs: [
      { name: 'hkl', label: 'Miller indices', format: 'text', highlight: true },
      { name: 'd', label: 'Plane spacing d', format: 'text' },
    ],
    calculate: (i) => {
      const recips = [i.x, i.y, i.z].map((v) => (toD(v).isZero() ? new D(0) : new D(1).div(toD(v))));
      if (recips.every((r) => r.isZero())) return { hkl: 'The plane must cut at least one axis', d: '-' };
      let found: bigint[] | null = null;
      for (let m = 1; m <= 24 && !found; m++) {
        const scaled = recips.map((r) => r.mul(m));
        if (scaled.every((s) => s.minus(s.toDecimalPlaces(0)).abs().lt('0.02'))) found = scaled.map((s) => BigInt(s.toDecimalPlaces(0).toFixed(0)));
      }
      if (!found) return { hkl: 'No small whole-number indices fit these intercepts', d: '-' };
      const g = found.reduce((acc, v) => gcd(acc, v), ZERO);
      const [h, k, l] = found.map((v) => v / (g === ZERO ? ONE : g));
      const d = toD(i.a).div(new D((h * h + k * k + l * l).toString()).sqrt());
      return { hkl: `(${h} ${k} ${l})`, d: `${fmtNumber(d, 2)} pm` };
    },
    formulaDescription:
      'Take the reciprocals of the intercepts (1/∞ = 0), multiply by the smallest number that makes them whole, and divide out any common factor. Cubic spacing: d = a ÷ √(h² + k² + l²).',
    workedExample: 'Intercepts 1, 2 and 3 have reciprocals 1, 1/2 and 1/3; times 6 gives (6 3 2). With a = 361 pm, d = 361 ÷ √49 = 51.57 pm.',
    faq: [
      { question: 'What does a zero index mean?', answer: 'The plane is parallel to that axis and never cuts it.' },
      {
        question: 'What if an intercept is negative?',
        answer: 'The index is negative and is usually written with a bar over the number, here shown with a minus sign.',
      },
      {
        question: 'Are (111) and (222) the same plane?',
        answer: 'They are parallel, but (222) has half the spacing. The page reduces to the smallest indices for the plane itself.',
      },
    ],
    scenarios: [
      withInputs('intercepts 1, 1 and 1', { x: 1, y: 1, z: 1, a: 361 }),
      withInputs('intercepts 0.5, 1 and parallel to z', { x: 0.5, y: 1, z: 0, a: 361 }),
      withInputs('intercepts 1, 2 and 3', { x: 1, y: 2, z: 3, a: 361 }),
      withInputs('intercepts 0.5, 0.5 and 1', { x: 0.5, y: 0.5, z: 1, a: 361 }),
      withInputs('intercepts 1, parallel to y and z, a = 405 pm', { x: 1, y: 0, z: 0, a: 405 }),
      withInputs('intercepts 1, -1 and 1, a = 287 pm', { x: 1, y: -1, z: 1, a: 287 }),
    ],
    introOutputs: ['hkl'],
    relatedSlugs: ['cubic-unit-cell-calculator', 'lattice-energy-calculator'],
    checks: [
      { inputs: {}, expect: { hkl: '(1 1 1)', d: '208.42 pm' } },
      { inputs: { x: 0.5, y: 1, z: 0 }, expect: { hkl: '(2 1 0)', d: '161.44 pm' } },
      { inputs: { x: 0.5, y: 0.5, z: 1 }, expect: { hkl: '(2 2 1)', d: '120.33 pm' } },
      { inputs: { x: 1, y: 2, z: 3 }, expect: { hkl: '(6 3 2)', d: '51.57 pm' } },
    ],
  },
  {
    slug: 'lattice-energy-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solid state',
    title: 'Lattice Energy Calculator Using the Born-Lande Equation',
    h1: 'Lattice Energy Calculator',
    metaDescription: 'Estimate the lattice energy of an ionic crystal from the Madelung constant, ion charges, ion separation and Born exponent.',
    about:
      'The lattice energy of an ionic solid is the energy released when separated gaseous ions come together to form the crystal, and it explains why ionic compounds melt at high temperatures. The Born-Lande equation estimates it from the electrostatic attraction between the ions, corrected for their repulsion at short range. You supply the Madelung constant for the crystal structure, the charges of the two ions, the distance between their centres in picometres and the Born exponent, which is about 8 for sodium chloride. The page returns the energy per mole as a positive number of kilojoules.',
    inputs: [
      field('madelung', 'Madelung constant', 1.74756, 1, 5),
      intField('zplus', 'Charge of the cation', 1, 1, 4),
      intField('zminus', 'Charge of the anion (size)', 1, 1, 4),
      field('r0', 'Distance between ion centres (pm)', 282, 50, 600),
      field('n', 'Born exponent', 8, 3, 15),
    ],
    outputs: [
      { name: 'energy', label: 'Lattice energy', format: 'text', highlight: true },
      { name: 'mj', label: 'In megajoules per mole', format: 'text' },
    ],
    calculate: (i) => {
      const u = NA.mul(toD(i.madelung))
        .mul(toD(i.zplus))
        .mul(toD(i.zminus))
        .mul(E_CHARGE.pow(2))
        .div(PI.mul(4).mul(EPS0).mul(toD(i.r0).mul('1e-12')))
        .mul(new D(1).minus(new D(1).div(toD(i.n))))
        .div(1000);
      return { energy: `${fmtNumber(u, 0)} kJ/mol`, mj: `${fmtNumber(u.div(1000), 3)} MJ/mol` };
    },
    formulaDescription:
      'U = N_A × M × z+ × z− × e² ÷ (4π ε0 r0) × (1 − 1/n), with r0 in metres, M the Madelung constant, n the Born exponent. The result is divided by 1,000 to give kJ per mole.',
    workedExample: 'NaCl: M = 1.74756, charges 1 and 1, r0 = 282 pm, n = 8 gives about 753 kJ/mol, close to the experimental value near 787 kJ/mol.',
    faq: [
      {
        question: 'Why does a higher charge give such a large energy?',
        answer:
          'The attraction scales with the product of the charges, so magnesium oxide with 2+ and 2− is about four times stronger than a 1+ and 1− salt at similar spacing.',
      },
      {
        question: 'Where do I find the Madelung constant?',
        answer: 'It depends only on the crystal structure: 1.74756 for rock salt, 1.76267 for caesium chloride and 1.6381 for zinc blende.',
      },
      {
        question: 'Why is the answer different from the experimental value?',
        answer: 'The equation ignores covalent character and van der Waals terms, so it is an estimate, usually within a few percent for simple salts.',
      },
    ],
    scenarios: mixed(
      'lattice-energy-calculator',
      8,
      (r) => ({ madelung: r(1.6, 1.8), zplus: Math.round(r(1, 3)), zminus: Math.round(r(1, 3)), r0: Math.round(r(180, 400)), n: r(5, 12) }),
      (v) => `M ${v.madelung}, charges ${v.zplus} and ${v.zminus}, distance ${v.r0} pm, exponent ${v.n}`,
    ),
    introOutputs: ['energy'],
    relatedSlugs: ['cubic-unit-cell-calculator', 'percent-ionic-character-calculator'],
    checks: [
      { inputs: {}, expect: { energy: '753 kJ/mol', mj: '0.753 MJ/mol' } },
      { inputs: { zplus: 2, zminus: 2, r0: 210, n: 7 }, expect: { energy: '3,964 kJ/mol' } },
      { inputs: { madelung: 1.76267, r0: 356, n: 10.5 }, expect: { energy: '622 kJ/mol' } },
    ],
  },
  {
    slug: 'pka-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Acids and bases',
    title: 'pKa Calculator: Convert Between Ka and pKa',
    h1: 'pKa Calculator',
    metaDescription: 'Convert an acid dissociation constant Ka to pKa, or pKa back to Ka, and find the pKb of the conjugate base at 25 degrees Celsius.',
    about:
      'The acid dissociation constant Ka measures how far an acid gives up its proton in water, and because values run over many powers of ten chemists quote the pKa, the negative base-10 logarithm of Ka. A smaller pKa means a stronger acid: hydrochloric acid is below zero, acetic acid is 4.76 and phenol about 10. Choose which way to convert, enter Ka as a coefficient and a power of ten or enter the pKa, and the page returns the other value and the pKb of the conjugate base from pKa + pKb = 14, which holds at 25 degrees Celsius.',
    inputs: [
      select('mode', 'Convert', 'ka', [
        ['ka', 'Ka to pKa'],
        ['pka', 'pKa to Ka'],
      ]),
      field('coef', 'Ka coefficient', 1.8, 0.001, 999),
      intField('exp', 'Ka power of ten', -5, -30, 10),
      field('pka', 'pKa (used when converting to Ka)', 4.75, -10, 40),
    ],
    outputs: [
      { name: 'pka', label: 'pKa', format: 'text', highlight: true },
      { name: 'ka', label: 'Ka', format: 'text' },
      { name: 'pkb', label: 'pKb of the conjugate base', format: 'text' },
    ],
    calculate: (i) => {
      const pka = String(i.mode) === 'pka' ? toD(i.pka) : toD(i.coef).log(10).plus(toD(i.exp)).neg();
      const ka = new D(10).pow(pka.neg());
      return { pka: fmtNumber(pka, 3), ka: sci(ka, 3), pkb: fmtNumber(new D(14).minus(pka), 3) };
    },
    formulaDescription: 'pKa = −log10(Ka) and Ka = 10^(−pKa). At 25 °C the conjugate base has pKb = 14 − pKa.',
    workedExample: 'Ka = 1.8 × 10^-5 gives pKa = 4.745 and pKb = 9.255. In the other direction pKa 4.75 gives Ka = 1.778 × 10^-5.',
    faq: [
      {
        question: 'Does a lower pKa mean a stronger acid?',
        answer: 'Yes. Each unit lower is ten times more dissociation, so pKa 3 is ten times stronger than pKa 4.',
      },
      {
        question: 'Why does pKb use 14?',
        answer: 'The product of Ka and Kb for a conjugate pair equals the water constant Kw = 1.0 × 10^-14 at 25 °C, so the p-values add to 14.',
      },
      {
        question: 'Is pKa the pH where half the acid is dissociated?',
        answer: 'Yes, from the Henderson-Hasselbalch equation: at pH = pKa, the acid and its conjugate base are present in equal amounts.',
      },
    ],
    scenarios: mixed(
      'pka-calculator',
      8,
      (r) => ({ coef: r(1, 9.9), exp: -Math.round(r(2, 14)), pka: r(1, 13) }),
      (v) => `Ka ${v.coef} × 10^${v.exp}`,
    ),
    introOutputs: ['pka'],
    relatedSlugs: ['henderson-hasselbalch-calculator', 'ph-calculator'],
    checks: [
      { inputs: {}, expect: { pka: '4.745', ka: '1.800 × 10^-5', pkb: '9.255' } },
      { inputs: { mode: 'pka', pka: 4.75 }, expect: { ka: '1.778 × 10^-5', pkb: '9.25' } },
      { inputs: { coef: 1, exp: -7 }, expect: { pka: '7', pkb: '7' } },
    ],
  },
  {
    slug: 'mass-concentration-to-molarity-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions',
    title: 'Mass Concentration to Molarity Calculator (g/L, mg/mL to mol/L)',
    h1: 'Mass Concentration to Molarity Calculator',
    metaDescription:
      'Convert a concentration in grams per litre, milligrams per millilitre, micrograms per millilitre or milligrams per litre into moles per litre.',
    about:
      'Labels and papers often give a concentration as mass per volume, while reactions are worked out in moles. The bridge is the molar mass: dividing grams per litre by grams per mole leaves moles per litre. Pick the unit you were given, enter the concentration and the molar mass of the dissolved substance, and the page converts to grams per litre first and then to molarity and millimolar. A physiological saline of 9 g/L sodium chloride, for example, is 0.154 mol/L. The result is a concentration of the substance as written, so use the correct molar mass for hydrates.',
    inputs: [
      field('conc', 'Mass concentration', 9, 0, 1e9),
      select('unit', 'Unit', 'gl', [
        ['gl', 'g/L'],
        ['mgml', 'mg/mL'],
        ['ugml', 'µg/mL'],
        ['mgl', 'mg/L'],
      ]),
      field('mm', 'Molar mass (g/mol)', 58.44, 0.5, 1e6),
    ],
    outputs: [
      { name: 'molar', label: 'Molarity', format: 'text', highlight: true },
      { name: 'milli', label: 'Millimolar', format: 'text' },
    ],
    calculate: (i) => {
      const factor = { gl: '1', mgml: '1', ugml: '0.001', mgl: '0.001' }[String(i.unit)] ?? '1';
      const molar = toD(i.conc).mul(factor).div(toD(i.mm));
      return { molar: `${sig4(molar)} mol/L`, milli: `${sig4(molar.mul(1000))} mmol/L` };
    },
    formulaDescription:
      'Grams per litre = value × factor (g/L and mg/mL × 1, µg/mL and mg/L × 0.001). Molarity = grams per litre ÷ molar mass. Millimolar = molarity × 1,000.',
    workedExample: '9 g/L of NaCl (58.44 g/mol) is 9 ÷ 58.44 = 0.154 mol/L, which is 154 mmol/L. 100 µg/mL of glucose (180.16) is 0.1 g/L, so 0.000555 mol/L.',
    faq: [
      {
        question: 'Why are g/L and mg/mL the same?',
        answer: 'A gram per litre is a thousandth of a gram in each millilitre, which is one milligram per millilitre.',
      },
      {
        question: 'Which molar mass do I use for a hydrate?',
        answer: 'Include the water of crystallisation if the mass you weighed includes it. CuSO4·5H2O is 249.68, not 159.61.',
      },
      { question: 'How do I go the other way?', answer: 'Multiply molarity by the molar mass to get grams per litre.' },
    ],
    scenarios: varied(
      'mass-concentration-to-molarity-calculator',
      8,
      [
        { name: 'conc', lo: 2, hi: 480 },
        { name: 'mm', lo: 18, hi: 342, step: 0.5 },
      ],
      [{ name: 'unit', options: ['gl', 'mgml', 'ugml', 'mgl'] }],
      (v) => `${v.conc} ${v.unit} of a ${v.mm} g/mol solute`,
    ),
    introOutputs: ['molar'],
    relatedSlugs: ['molarity-calculator', 'percentage-concentration-to-molarity-calculator'],
    checks: [
      { inputs: {}, expect: { molar: '0.154 mol/L', milli: '154 mmol/L' } },
      { inputs: { conc: 100, unit: 'ugml', mm: 180.16 }, expect: { molar: '0.0005551 mol/L', milli: '0.5551 mmol/L' } },
      { inputs: { conc: 58.44, mm: 58.44 }, expect: { molar: '1 mol/L' } },
    ],
  },
  {
    slug: 'percentage-concentration-to-molarity-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions',
    title: 'Percent Concentration to Molarity Calculator (w/v and w/w)',
    h1: 'Percent Concentration to Molarity Calculator',
    metaDescription:
      'Convert a weight-per-volume or weight-per-weight percentage into molarity using the molar mass and, for w/w, the density of the solution.',
    about:
      'Stock acids and bases are sold by weight percent, saline and buffers by weight per volume, and calculations need molarity. For a weight-per-volume percentage the grams in 100 millilitres are the percentage itself, so multiplying by ten gives grams per litre. A weight-per-weight percentage also needs the density of the solution, because it is a mass fraction of the whole. Choose the type, enter the percentage, the molar mass and for w/w the density, and the page returns moles per litre. Concentrated hydrochloric acid at 37 percent with a density of 1.19 is about 12.1 molar.',
    inputs: [
      select('kind', 'Percentage type', 'ww', [
        ['wv', 'Weight per volume (g per 100 mL)'],
        ['ww', 'Weight per weight (mass percent)'],
      ]),
      field('pct', 'Percentage', 37, 0, 100),
      field('mm', 'Molar mass (g/mol)', 36.46, 0.5, 1e6),
      field('rho', 'Density of the solution (g/mL, used for w/w)', 1.19, 0.5, 5),
    ],
    outputs: [
      { name: 'molar', label: 'Molarity', format: 'text', highlight: true },
      { name: 'gl', label: 'Grams of solute per litre', format: 'text' },
    ],
    calculate: (i) => {
      const gPerL = String(i.kind) === 'wv' ? toD(i.pct).mul(10) : toD(i.pct).mul(10).mul(toD(i.rho));
      return { molar: `${fmtNumber(gPerL.div(toD(i.mm)), 3)} mol/L`, gl: `${fmtNumber(gPerL, 1)} g/L` };
    },
    formulaDescription: 'w/v: grams per litre = % × 10. w/w: grams per litre = % × 10 × density (g/mL). Molarity = grams per litre ÷ molar mass.',
    workedExample: '37% w/w HCl, density 1.19 g/mL, 36.46 g/mol: 37 × 10 × 1.19 = 440.3 g/L, so 440.3 ÷ 36.46 = 12.08 mol/L.',
    faq: [
      {
        question: 'Why does w/w need a density?',
        answer: 'Mass percent describes grams per 100 grams of solution, and molarity needs volume, so the density converts mass to volume.',
      },
      { question: 'What is a 0.9 percent saline?', answer: '0.9 grams of sodium chloride per 100 mL, which is 9 g/L, about 0.154 molar.' },
      {
        question: 'Is the density of a stock the same as water?',
        answer: 'No. Concentrated acids are denser: sulfuric acid at 98 percent is 1.84 g/mL, so its molarity is about 18.4.',
      },
    ],
    scenarios: varied(
      'percentage-concentration-to-molarity-calculator',
      8,
      [
        { name: 'pct', lo: 3, hi: 96 },
        { name: 'mm', lo: 17, hi: 160, step: 0.5 },
        { name: 'rho', lo: 1.0, hi: 1.9, step: 0.01 },
      ],
      [{ name: 'kind', options: ['wv', 'ww'] }],
      (v) => `${v.pct}% ${v.kind}, ${v.mm} g/mol, density ${v.rho}`,
    ),
    introOutputs: ['molar'],
    relatedSlugs: ['mass-concentration-to-molarity-calculator', 'molarity-calculator'],
    checks: [
      { inputs: {}, expect: { molar: '12.076 mol/L', gl: '440.3 g/L' } },
      { inputs: { kind: 'wv', pct: 0.9, mm: 58.44 }, expect: { molar: '0.154 mol/L', gl: '9 g/L' } },
      { inputs: { pct: 98, mm: 98.08, rho: 1.84 }, expect: { molar: '18.385 mol/L' } },
    ],
  },
  {
    slug: 'bleach-dilution-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions',
    title: 'Bleach Dilution Calculator: Household Bleach to a Target ppm',
    h1: 'Bleach Dilution Calculator',
    metaDescription: 'Work out how much household bleach and water to mix for a chosen available chlorine concentration in parts per million.',
    about:
      'Household bleach is a solution of sodium hypochlorite, and its strength is printed on the label as a percentage of available chlorine. One percent is 10,000 parts per million, so a 6 percent bleach holds 60,000 ppm. To reach a lower target, divide the target by the stock concentration and multiply by the final volume to find the bleach, then add water for the rest. This is only the arithmetic. Follow the label and the guidance for your task for the strength to use, use fresh bleach because it weakens with age, and never mix it with ammonia or acids.',
    inputs: [
      field('stock', 'Stock strength (% available chlorine)', 6, 0.1, 15),
      field('target', 'Target concentration (ppm)', 1000, 1, 100000),
      field('final', 'Final volume (mL)', 1000, 1, 1e6),
    ],
    outputs: [
      { name: 'bleach', label: 'Bleach to measure', format: 'text', highlight: true },
      { name: 'water', label: 'Water to add', format: 'text' },
      { name: 'ratio', label: 'Bleach to water', format: 'text' },
    ],
    calculate: (i) => {
      const stockPpm = toD(i.stock).mul(10000);
      const target = toD(i.target);
      if (target.gt(stockPpm)) return { bleach: 'The target is stronger than the stock', water: '-', ratio: '-' };
      const bleach = target.div(stockPpm).mul(toD(i.final));
      const water = toD(i.final).minus(bleach);
      return {
        bleach: `${fmtNumber(bleach, 2)} mL`,
        water: `${fmtNumber(water, 2)} mL`,
        ratio: bleach.isZero() ? '-' : `1 : ${fmtNumber(water.div(bleach), 1)}`,
      };
    },
    formulaDescription: 'Stock ppm = % × 10,000. Bleach volume = target ppm ÷ stock ppm × final volume (C1V1 = C2V2). Water = final volume − bleach volume.',
    workedExample:
      'A 6% bleach is 60,000 ppm. For 1,000 mL at 1,000 ppm: 1,000 ÷ 60,000 × 1,000 = 16.67 mL of bleach plus 983.33 mL of water, a ratio of 1 : 59.',
    faq: [
      {
        question: 'What strength should I use?',
        answer: 'It depends on the job and the guidance for it. This page only does the dilution arithmetic from the strength you choose.',
      },
      {
        question: 'Does bleach lose strength?',
        answer: 'Yes, sodium hypochlorite breaks down with time, heat and light, so an old bottle is weaker than its label.',
      },
      { question: 'Can I mix bleach with other cleaners?', answer: 'No. Mixing with ammonia or acids releases toxic gases. Ventilate and use it alone.' },
    ],
    scenarios: mixed(
      'bleach-dilution-calculator',
      8,
      (r) => ({ stock: r(2.5, 12), target: Math.round(r(50, 5000)), final: Math.round(r(200, 8000)) }),
      (v) => `${v.stock}% stock to ${v.target} ppm, ${v.final} mL`,
    ),
    introOutputs: ['bleach'],
    relatedSlugs: ['dilution-calculator', 'dilution-factor-calculator'],
    checks: [
      { inputs: {}, expect: { bleach: '16.67 mL', water: '983.33 mL', ratio: '1 : 59' } },
      { inputs: { stock: 5.25, target: 200, final: 5000 }, expect: { bleach: '19.05 mL', water: '4,980.95 mL' } },
      { inputs: { stock: 1, target: 20000 }, expect: { bleach: 'The target is stronger than the stock' } },
    ],
  },
  {
    slug: 'dilution-factor-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions',
    title: 'Dilution Factor Calculator from Sample and Diluent Volumes',
    h1: 'Dilution Factor Calculator',
    metaDescription: 'Find the dilution factor and ratio from the sample and diluent volumes, and the concentration after dilution.',
    about:
      'A dilution factor says how many times a sample has been thinned: the total final volume divided by the volume of sample that went into it. Adding 1 mL of sample to 9 mL of diluent makes 10 mL, so the factor is 10 and the concentration falls to one tenth. People write this as a 1:10 dilution, but a ratio of 1:9 describes sample to diluent, and the two conventions are often confused, so the page shows both. Enter the volumes and the starting concentration in any unit; the result is in the same unit.',
    inputs: [
      field('sample', 'Sample volume', 1, 0.0001, 1e6),
      field('diluent', 'Diluent volume', 9, 0, 1e7),
      field('start', 'Starting concentration', 100, 0, 1e12),
    ],
    outputs: [
      { name: 'df', label: 'Dilution factor', format: 'text', highlight: true },
      { name: 'ratio', label: 'Sample to diluent', format: 'text' },
      { name: 'final', label: 'Final concentration', format: 'text' },
    ],
    calculate: (i) => {
      const sample = toD(i.sample);
      const df = sample.plus(toD(i.diluent)).div(sample);
      return { df: fmtNumber(df, 3), ratio: `1 : ${fmtNumber(toD(i.diluent).div(sample), 3)}`, final: fmtNumber(toD(i.start).div(df), 4) };
    },
    formulaDescription:
      'Dilution factor = (sample volume + diluent volume) ÷ sample volume. Final concentration = starting concentration ÷ dilution factor. Sample to diluent ratio = 1 : (diluent ÷ sample).',
    workedExample: '1 mL of sample in 9 mL of diluent gives a factor of 10 and a ratio of 1 : 9. A 100 mg/L stock becomes 10 mg/L.',
    faq: [
      {
        question: 'Is 1:10 the same as a factor of 10?',
        answer:
          'Usually yes: 1 part in 10 total parts is a factor of 10. Some texts mean 1 part to 10 parts of diluent, which is a factor of 11, so check the source.',
      },
      {
        question: 'How do repeated dilutions combine?',
        answer: 'Multiply the factors. Two 1:10 steps give a factor of 100. The serial dilution calculator does this for a whole series.',
      },
      { question: 'Do volumes need the same unit?', answer: 'Yes, but any unit works as long as sample and diluent match.' },
    ],
    scenarios: mixed(
      'dilution-factor-calculator',
      8,
      (r) => ({ sample: r(0.1, 20), diluent: r(0.5, 480), start: Math.round(r(10, 90000)) }),
      (v) => `${v.sample} of sample in ${v.diluent} of diluent, start ${v.start}`,
    ),
    introOutputs: ['df'],
    relatedSlugs: ['serial-dilution-calculator', 'dilution-calculator'],
    checks: [
      { inputs: {}, expect: { df: '10', ratio: '1 : 9', final: '10' } },
      { inputs: { sample: 2, diluent: 8, start: 250 }, expect: { df: '5', ratio: '1 : 4', final: '50' } },
      { inputs: { sample: 1, diluent: 99, start: 5000 }, expect: { df: '100', ratio: '1 : 99', final: '50' } },
    ],
  },
  {
    slug: 'mixing-ratio-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions',
    title: 'Mixing Ratio Calculator: Split a Total Volume by Parts',
    h1: 'Mixing Ratio Calculator',
    metaDescription: 'Split a total volume between two components given as a ratio such as 4:1, with the amount and percentage of each.',
    about:
      'Cleaning concentrates, two-part resins, coolants and fertilisers come with a mixing ratio, such as 4 parts of one to 1 part of the other. To make a chosen total, add the parts to find the size of one part, then multiply. Enter the parts of each component and the volume you want, and the page returns the volume of each in the same unit and the share of the total each takes. A 4:1 mix makes 80 percent of the first and 20 percent of the second. Ratios are by volume unless the product says otherwise, so check the label.',
    inputs: [
      field('a', 'Parts of component A', 4, 0.01, 1000),
      field('b', 'Parts of component B', 1, 0.01, 1000),
      field('total', 'Total volume wanted', 500, 0.01, 1e9),
    ],
    outputs: [
      { name: 'va', label: 'Volume of A', format: 'text', highlight: true },
      { name: 'vb', label: 'Volume of B', format: 'text' },
      { name: 'pa', label: 'Share of A', format: 'text' },
    ],
    calculate: (i) => {
      const parts = toD(i.a).plus(toD(i.b));
      return {
        va: fmtNumber(toD(i.total).mul(toD(i.a)).div(parts), 2),
        vb: fmtNumber(toD(i.total).mul(toD(i.b)).div(parts), 2),
        pa: `${fmtNumber(toD(i.a).div(parts).mul(100), 2)}%`,
      };
    },
    formulaDescription: 'One part = total ÷ (parts A + parts B). Volume of A = parts A × one part. Volume of B = parts B × one part.',
    workedExample: 'A 4:1 mix of 500 mL has 5 parts of 100 mL, so 400 mL of A and 100 mL of B, which is 80% A.',
    faq: [
      { question: 'Are ratios by volume or weight?', answer: 'Check the label. Mixing by weight needs the densities of both components.' },
      { question: 'Can I use three components?', answer: 'Mix two, then treat the mixture as one component of the next ratio.' },
      { question: 'What unit is the result in?', answer: 'The same unit as the total you entered, such as millilitres, litres or ounces.' },
    ],
    scenarios: mixed(
      'mixing-ratio-calculator',
      8,
      (r) => ({ a: Math.round(r(1, 20)), b: Math.round(r(1, 8)), total: Math.round(r(100, 9000)) }),
      (v) => `${v.a} to ${v.b} for ${v.total}`,
    ),
    introOutputs: ['va'],
    relatedSlugs: ['dilution-factor-calculator', 'alligation-calculator'],
    checks: [
      { inputs: {}, expect: { va: '400', vb: '100', pa: '80%' } },
      { inputs: { a: 2, b: 1, total: 300 }, expect: { va: '200', vb: '100', pa: '66.67%' } },
      { inputs: { a: 10, b: 1, total: 1100 }, expect: { va: '1,000', vb: '100' } },
    ],
  },
  {
    slug: 'buffer-capacity-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Acids and bases',
    title: 'Buffer Capacity Calculator: Van Slyke Equation',
    h1: 'Buffer Capacity Calculator',
    metaDescription: 'Calculate the buffer capacity of a weak acid and conjugate base solution from the total concentration, the pH and the pKa.',
    about:
      'Buffer capacity describes how much strong acid or base a solution can absorb before its pH moves by one unit. It is greatest when the pH equals the pKa of the buffering acid and falls steeply a unit or so either side. For a single weak acid the Van Slyke equation gives the capacity beta as 2.303 times the total buffer concentration times a factor built from Ka and the hydrogen ion concentration. Enter the total concentration of acid plus base, the pH you are working at and the pKa, and the page returns beta in moles per litre per pH unit. Biologists use the idea to pick phosphate, Tris, HEPES or bicarbonate for cell culture, enzyme assays and electrophoresis tanks, where drift of even a few tenths harms the experiment. Brewers, aquarists, pool owners, shampoo formulators and soil scientists meet the same limit when a mash, tank, pond, lotion or field resists being pushed around.',
    inputs: [
      field('c', 'Total buffer concentration (mol/L)', 0.1, 0.00001, 20),
      field('ph', 'pH', 4.76, 0, 14),
      field('pka', 'pKa of the weak acid', 4.76, -2, 16),
    ],
    outputs: [
      { name: 'beta', label: 'Buffer capacity β', format: 'text', highlight: true },
      { name: 'frac', label: 'Share of the maximum', format: 'text' },
    ],
    calculate: (i) => {
      const h = new D(10).pow(toD(i.ph).neg());
      const ka = new D(10).pow(toD(i.pka).neg());
      const factor = ka.mul(h).div(ka.plus(h).pow(2));
      return { beta: `${sig4(LN10.mul(toD(i.c)).mul(factor))} mol/(L·pH)`, frac: `${fmtNumber(factor.div('0.25').mul(100), 1)}%` };
    },
    formulaDescription: 'β = 2.303 × C × (Ka × [H+]) ÷ (Ka + [H+])², with [H+] = 10^−pH and Ka = 10^−pKa. The maximum, at pH = pKa, is 0.576 × C.',
    workedExample:
      'A 0.1 mol/L acetate buffer at pH = pKa = 4.76: the factor is 0.25, so β = 2.3026 × 0.1 × 0.25 = 0.0576 mol/(L·pH). One unit higher, β falls to 0.019.',
    faq: [
      { question: 'Where is a buffer most effective?', answer: 'Within about one pH unit of the pKa, and best at the pKa itself.' },
      { question: 'How do I raise the capacity?', answer: 'Use a higher total concentration of the buffer. Capacity is proportional to it.' },
      {
        question: 'Does the equation include water?',
        answer: 'No. At very low or very high pH the hydrogen and hydroxide ions of water add capacity, which this single-acid form ignores.',
      },
    ],
    scenarios: mixed(
      'buffer-capacity-calculator',
      16,
      (r) => ({ c: r(0.01, 1), ph: r(3, 10), pka: r(3.5, 9.5) }),
      (v) => `${v.c} mol/L at pH ${v.ph} with pKa ${v.pka}`,
    ),
    introOutputs: ['beta'],
    relatedSlugs: ['henderson-hasselbalch-calculator', 'buffer-ph-calculator'],
    checks: [
      { inputs: {}, expect: { beta: '0.05756 mol/(L·pH)', frac: '100%' } },
      { inputs: { ph: 5.76 }, expect: { beta: '0.01903 mol/(L·pH)', frac: '33.1%' } },
      { inputs: { c: 1, ph: 7, pka: 7 }, expect: { beta: '0.5756 mol/(L·pH)' } },
    ],
  },
  {
    slug: 'buffer-ph-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Acids and bases',
    title: 'Buffer pH Calculator After Adding Strong Acid or Base',
    h1: 'Buffer pH Calculator',
    metaDescription:
      'Find the pH of a buffer after a small amount of strong acid or strong base is added, from the moles of weak acid and conjugate base and the pKa.',
    about:
      'A buffer resists pH change because added strong base converts weak acid to its conjugate base and added strong acid does the reverse. As long as both partners remain, the new pH follows from the Henderson-Hasselbalch equation using the updated amounts. Enter the millimoles of weak acid and conjugate base, the pKa, and the millimoles of strong acid or base added. The page shifts the amounts and returns the new pH and the base-to-acid ratio. If the added strong reagent is more than one partner can absorb, the buffer is exhausted and the page says so. Typical uses include checking a carboxylic acid pair for a titration, choosing between phosphate and acetate, and judging whether a protein sample will stay stable overnight.',
    inputs: [
      field('acid', 'Weak acid (mmol)', 100, 0.001, 1e6),
      field('base', 'Conjugate base (mmol)', 100, 0.001, 1e6),
      field('pka', 'pKa', 4.76, -2, 16),
      select('add', 'Add strong', 'base', [
        ['base', 'Base (NaOH)'],
        ['acid', 'Acid (HCl)'],
      ]),
      field('amount', 'Amount added (mmol)', 10, 0, 1e6),
    ],
    outputs: [
      { name: 'ph', label: 'pH after addition', format: 'text', highlight: true },
      { name: 'ratio', label: 'Base to acid ratio', format: 'text' },
    ],
    calculate: (i) => {
      const x = toD(i.amount);
      const baseSide = String(i.add) === 'base';
      const acid = baseSide ? toD(i.acid).minus(x) : toD(i.acid).plus(x);
      const base = baseSide ? toD(i.base).plus(x) : toD(i.base).minus(x);
      if (acid.lte(0) || base.lte(0)) return { ph: 'The buffer is used up: the added amount exceeds what it can absorb', ratio: '-' };
      return { ph: fmtFixed(toD(i.pka).plus(base.div(acid).log(10)), 2), ratio: fmtNumber(base.div(acid), 3) };
    },
    formulaDescription:
      'Adding strong base x: acid → acid − x, base → base + x. Adding strong acid x: acid → acid + x, base → base − x. Then pH = pKa + log10(base ÷ acid).',
    workedExample:
      'An acetate buffer of 100 mmol acid and 100 mmol base, pKa 4.76, gains 10 mmol NaOH: 90 acid and 110 base, so pH = 4.76 + log10(110 ÷ 90) = 4.85. With 10 mmol HCl instead it is 4.67.',
    faq: [
      {
        question: 'Why does the pH barely move?',
        answer:
          'The added reagent is consumed by the buffer pair, so only the ratio of base to acid changes, and the pH shifts by the logarithm of that ratio.',
      },
      {
        question: 'When does a buffer fail?',
        answer: 'When the added acid or base exceeds one of the two components. Then the buffer is used up and the pH changes sharply.',
      },
      { question: 'Does volume matter?', answer: 'Not for the ratio, since both species are in the same solution, so millimoles are enough.' },
    ],
    scenarios: varied(
      'buffer-ph-calculator',
      8,
      [
        { name: 'acid', lo: 20, hi: 300 },
        { name: 'base', lo: 20, hi: 300 },
        { name: 'pka', lo: 3.2, hi: 9.8, step: 0.05 },
        { name: 'amount', lo: 1, hi: 15 },
      ],
      [{ name: 'add', options: ['base', 'acid'] }],
      (v) => `${v.acid} and ${v.base} mmol, pKa ${v.pka}, plus ${v.amount} mmol of ${v.add}`,
    ),
    introOutputs: ['ph'],
    relatedSlugs: ['henderson-hasselbalch-calculator', 'buffer-capacity-calculator'],
    checks: [
      { inputs: {}, expect: { ph: '4.85', ratio: '1.222' } },
      { inputs: { add: 'acid' }, expect: { ph: '4.67', ratio: '0.818' } },
      { inputs: { amount: 0 }, expect: { ph: '4.76', ratio: '1' } },
      { inputs: { amount: 100 }, expect: { ratio: '-' } },
    ],
  },
  {
    slug: 'neutralization-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Acids and bases',
    title: 'Neutralization Calculator: Strong Acid and Strong Base Mixing',
    h1: 'Neutralization Calculator',
    metaDescription: 'Find the volume of strong base that neutralises a strong acid and the pH of the mixture when a different volume is added.',
    about:
      'When a strong acid meets a strong base, protons and hydroxide ions combine to form water until one of them runs out. The point where they match is the equivalence point and the mixture is neutral at pH 7 at 25 degrees Celsius. Enter the concentration, volume and number of protons of the acid, and the concentration, volume and number of hydroxide ions of the base. The page works out the volume of base needed to neutralise, then compares the moles you actually mixed, reports which is in excess and finds the pH from what is left in the combined volume. It assumes complete dissociation, so it fits strong acids and bases only.',
    inputs: [
      field('ma', 'Acid concentration (mol/L)', 0.1, 0.0001, 20),
      field('va', 'Acid volume (mL)', 25, 0.01, 1e6),
      intField('na', 'Protons per acid formula (1 for HCl, 2 for H2SO4)', 1, 1, 3),
      field('mb', 'Base concentration (mol/L)', 0.1, 0.0001, 20),
      field('vb', 'Base volume added (mL)', 20, 0, 1e6),
      intField('nb', 'Hydroxides per base formula (1 for NaOH, 2 for Ba(OH)2)', 1, 1, 3),
    ],
    outputs: [
      { name: 'vneutral', label: 'Base volume to neutralise', format: 'text' },
      { name: 'ph', label: 'pH of the mixture', format: 'text', highlight: true },
      { name: 'state', label: 'State', format: 'text' },
    ],
    calculate: (i) => {
      const hPlus = toD(i.ma).mul(toD(i.va)).mul(toD(i.na));
      const oh = toD(i.mb).mul(toD(i.vb)).mul(toD(i.nb));
      const vneutral = hPlus.div(toD(i.mb).mul(toD(i.nb)));
      const volume = toD(i.va).plus(toD(i.vb));
      let ph = new D(7);
      let state = 'Neutral (exactly neutralised)';
      if (hPlus.gt(oh)) {
        ph = hPlus.minus(oh).div(volume).log(10).neg();
        state = 'Acid in excess';
      } else if (oh.gt(hPlus)) {
        ph = new D(14).plus(oh.minus(hPlus).div(volume).log(10));
        state = 'Base in excess';
      }
      return { vneutral: `${fmtNumber(vneutral, 2)} mL`, ph: fmtFixed(ph, 2), state };
    },
    formulaDescription:
      'Moles H+ = M × V × n (acid). Moles OH− likewise. Neutralising volume = moles H+ ÷ (base M × n). The excess moles ÷ total volume gives [H+] or [OH−]; pH = −log10[H+] or 14 + log10[OH−]. Equal moles give pH 7.',
    workedExample:
      '25 mL of 0.1 M HCl has 2.5 mmol H+. 20 mL of 0.1 M NaOH has 2.0 mmol OH−, so 0.5 mmol H+ is left in 45 mL: [H+] = 0.0111, pH 1.95. It takes 25 mL of base to neutralise.',
    faq: [
      {
        question: 'Does it work for weak acids?',
        answer: 'Not exactly. A weak acid at its equivalence point has a salt that changes the pH. Use the titration calculator for that case.',
      },
      { question: 'Why is neutral pH 7?', answer: 'At 25 °C the product of [H+] and [OH−] in water is 1 × 10^-14, so equal amounts give pH 7.' },
      {
        question: 'Is the heat of neutralisation included?',
        answer: 'No. Mixing strong acid and base releases heat, but this tool only does the amounts and pH.',
      },
    ],
    scenarios: mixed(
      'neutralization-calculator',
      8,
      (r) => ({ ma: r(0.02, 1), va: Math.round(r(10, 100)), na: Math.round(r(1, 2)), mb: r(0.02, 1), vb: Math.round(r(5, 130)), nb: Math.round(r(1, 2)) }),
      (v) => `${v.va} mL of ${v.ma} M acid (${v.na} H) and ${v.vb} mL of ${v.mb} M base (${v.nb} OH)`,
    ),
    introOutputs: ['ph'],
    relatedSlugs: ['titration-calculator', 'ph-calculator'],
    checks: [
      { inputs: {}, expect: { vneutral: '25 mL', ph: '1.95', state: 'Acid in excess' } },
      { inputs: { vb: 25 }, expect: { ph: '7.00', state: 'Neutral (exactly neutralised)' } },
      { inputs: { vb: 30 }, expect: { ph: '11.96', state: 'Base in excess' } },
    ],
  },
  {
    slug: 'tds-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions',
    title: 'TDS Calculator: Conductivity to Total Dissolved Solids',
    h1: 'TDS Calculator',
    metaDescription:
      'Convert electrical conductivity in microsiemens per centimetre to total dissolved solids in mg/L, or back, with an adjustable conversion factor.',
    about:
      'Total dissolved solids is the combined mass of the minerals and salts dissolved in water, and the easy way to estimate it is to measure how well the water conducts electricity. Dissolved ions carry current, so conductivity in microsiemens per centimetre scales with TDS in milligrams per litre. The multiplier depends on the mix of ions and is usually between 0.5 and 0.7, with 0.64 and 0.5 the common meter settings. Choose a direction, enter the reading and the factor, and the page converts. Conductivity also changes with temperature, so use a reading corrected to 25 degrees Celsius.',
    inputs: [
      select('mode', 'Convert', 'ec', [
        ['ec', 'Conductivity to TDS'],
        ['tds', 'TDS to conductivity'],
      ]),
      field('value', 'Reading (µS/cm or mg/L)', 1000, 0, 1e7),
      field('factor', 'Conversion factor', 0.64, 0.4, 0.9),
    ],
    outputs: [
      { name: 'tds', label: 'Total dissolved solids', format: 'text', highlight: true },
      { name: 'ec', label: 'Conductivity', format: 'text' },
    ],
    calculate: (i) => {
      const factor = toD(i.factor);
      const ec = String(i.mode) === 'tds' ? toD(i.value).div(factor) : toD(i.value);
      return { tds: `${fmtNumber(ec.mul(factor), 1)} mg/L`, ec: `${fmtNumber(ec, 1)} µS/cm` };
    },
    formulaDescription:
      'TDS (mg/L) = conductivity (µS/cm) × factor. Conductivity = TDS ÷ factor. The factor is typically 0.5 to 0.7 depending on the dissolved ions.',
    workedExample:
      'Water reading 1,000 µS/cm with a factor of 0.64 has about 640 mg/L of dissolved solids. A TDS of 320 mg/L at the same factor corresponds to 500 µS/cm.',
    faq: [
      {
        question: 'Which factor should I use?',
        answer:
          'Use the one your meter or standard specifies. 0.5 matches a sodium chloride scale, 0.64 to 0.7 suits natural fresh water. A laboratory evaporation test is exact.',
      },
      { question: 'Does temperature matter?', answer: 'Yes. Conductivity rises about 2 percent per degree Celsius, so readings are corrected to 25 °C.' },
      {
        question: 'Is TDS a safety measure?',
        answer: 'No. It says how much is dissolved, not what. Drinking water safety depends on the specific substances present.',
      },
    ],
    scenarios: mixed(
      'tds-calculator',
      8,
      (r) => ({ value: Math.round(r(40, 4800)), factor: r(0.5, 0.75) }),
      (v) => `reading ${v.value} with factor ${v.factor}`,
    ),
    introOutputs: ['tds'],
    relatedSlugs: ['water-hardness-calculator', 'ppm-to-molarity-calculator'],
    checks: [
      { inputs: {}, expect: { tds: '640 mg/L', ec: '1,000 µS/cm' } },
      { inputs: { value: 500, factor: 0.5 }, expect: { tds: '250 mg/L' } },
      { inputs: { mode: 'tds', value: 320 }, expect: { tds: '320 mg/L', ec: '500 µS/cm' } },
    ],
  },
  {
    slug: 'activity-coefficient-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions',
    title: 'Activity Coefficient Calculator: Debye-Huckel Equation',
    h1: 'Activity Coefficient Calculator',
    metaDescription:
      'Estimate the activity coefficient of an ion from its charge and the ionic strength with the Debye-Huckel limiting or extended law at 25 degrees Celsius.',
    about:
      'In real solutions ions interact, so their effective concentration, the activity, is lower than the amount present. The activity coefficient gamma is the factor between them, and it falls as the ionic strength and the ion charge rise. The Debye-Huckel limiting law gives log gamma = −0.509 z² √I and is reliable below about 0.01 mol/L. The extended form adds a term for the size of the ion and stretches the range to about 0.1 mol/L. Choose the law, enter the charge, ionic strength and ion size in angstroms, and the page returns the logarithm and the coefficient. Electrochemists use it for seawater, brines, galvanic cells, solubility products and the Nernst equation, where concentrations alone would give the wrong potential.',
    inputs: [
      select('law', 'Equation', 'limiting', [
        ['limiting', 'Limiting law (I below 0.01)'],
        ['extended', 'Extended law (I below 0.1)'],
      ]),
      intField('z', 'Ion charge (size)', 2, 1, 4),
      field('i', 'Ionic strength (mol/L)', 0.01, 0.00001, 1),
      field('a', 'Ion size parameter (angstroms)', 4.5, 1, 12),
    ],
    outputs: [
      { name: 'log', label: 'log10 of γ', format: 'text' },
      { name: 'gamma', label: 'Activity coefficient γ', format: 'text', highlight: true },
    ],
    calculate: (i) => {
      const root = toD(i.i).sqrt();
      let log = new D('-0.509').mul(toD(i.z).pow(2)).mul(root);
      if (String(i.law) === 'extended') log = log.div(new D(1).plus(new D('0.328').mul(toD(i.a)).mul(root)));
      return { log: fmtFixed(log, 4), gamma: fmtNumber(new D(10).pow(log), 3) };
    },
    formulaDescription:
      'Limiting: log γ = −0.509 z² √I. Extended: log γ = −0.509 z² √I ÷ (1 + 0.328 a √I), with a in angstroms. Constants are for water at 25 °C.',
    workedExample:
      'A doubly charged ion at I = 0.01 mol/L: log γ = −0.509 × 4 × 0.1 = −0.2036, so γ = 0.626. With the extended law and a = 4.5 Å it is −0.1774, so γ = 0.665.',
    faq: [
      {
        question: 'Why is gamma below 1?',
        answer: 'Each ion is surrounded by an atmosphere of opposite charge that holds it back, so it behaves as if less concentrated.',
      },
      { question: 'What is ionic strength?', answer: 'Half the sum of concentration times charge squared over every ion in the solution.' },
      {
        question: 'What if I need very concentrated solutions?',
        answer: 'Use a Davies or Pitzer model; the Debye-Huckel forms break down above roughly 0.1 mol/L.',
      },
    ],
    scenarios: varied(
      'activity-coefficient-calculator',
      12,
      [
        { name: 'z', lo: 1, hi: 4 },
        { name: 'i', lo: 0.001, hi: 0.1, step: 0.001 },
        { name: 'a', lo: 2.5, hi: 9, step: 0.5 },
      ],
      [{ name: 'law', options: ['limiting', 'extended'] }],
      (v) => `${v.law} law, charge ${v.z}, I ${v.i}, size ${v.a}`,
    ),
    introOutputs: ['gamma'],
    relatedSlugs: ['ionic-strength-calculator', 'nernst-equation-calculator'],
    checks: [
      { inputs: {}, expect: { log: '-0.2036', gamma: '0.626' } },
      { inputs: { law: 'extended' }, expect: { log: '-0.1774', gamma: '0.665' } },
      { inputs: { law: 'extended', z: 1, i: 0.1, a: 4 }, expect: { log: '-0.1138', gamma: '0.77' } },
    ],
  },
  {
    slug: 'reconstitution-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions',
    title: 'Reconstitution Calculator: Powder and Diluent to Concentration',
    h1: 'Reconstitution Calculator',
    metaDescription:
      'Find the concentration of a reconstituted laboratory reagent from the mass of powder and the diluent volume, and the volume holding a wanted mass.',
    about:
      'Freeze-dried reagents, enzymes, standards and dyes are shipped as a powder that you dissolve in a measured volume of diluent. The concentration is the mass of powder divided by the volume. Once it is in solution, the volume that contains a particular mass is that mass divided by the concentration. Enter the mass in the vial, the diluent volume and the mass you want to draw, and the page gives the concentration in milligrams per millilitre and the volume to draw. This is arithmetic for laboratory reagents and does not replace the instructions on a product. It is not for medicines.',
    inputs: [
      field('mass', 'Powder in the vial (mg)', 500, 0.001, 1e9),
      field('volume', 'Diluent added (mL)', 10, 0.001, 1e6),
      field('want', 'Mass wanted (mg)', 125, 0, 1e9),
    ],
    outputs: [
      { name: 'conc', label: 'Concentration', format: 'text', highlight: true },
      { name: 'draw', label: 'Volume holding the wanted mass', format: 'text' },
    ],
    calculate: (i) => {
      const conc = toD(i.mass).div(toD(i.volume));
      return { conc: `${fmtNumber(conc, 3)} mg/mL`, draw: `${fmtNumber(toD(i.want).div(conc), 3)} mL` };
    },
    formulaDescription:
      'Concentration = powder mass ÷ diluent volume. Volume to draw = wanted mass ÷ concentration. Any volume taken up by the dissolved powder is ignored.',
    workedExample: '500 mg dissolved in 10 mL is 50 mg/mL. The volume holding 125 mg is 125 ÷ 50 = 2.5 mL.',
    faq: [
      {
        question: 'Does the powder add to the volume?',
        answer:
          'A little, so the true concentration is slightly lower than calculated when a lot of powder is dissolved in a small volume. Use a volumetric flask for accuracy.',
      },
      {
        question: 'Can I use this for drugs?',
        answer: 'No. Medicines have their own labelled instructions, and a dose must come from a prescriber or pharmacist.',
      },
      { question: 'How do I get molar units?', answer: 'Divide mg/mL by the molar mass to get mol/L, using the mass concentration to molarity calculator.' },
    ],
    scenarios: mixed(
      'reconstitution-calculator',
      8,
      (r) => ({ mass: Math.round(r(5, 3000)), volume: r(0.5, 60), want: Math.round(r(1, 900)) }),
      (v) => `${v.mass} mg in ${v.volume} mL, ${v.want} mg wanted`,
    ),
    introOutputs: ['conc'],
    relatedSlugs: ['resuspension-calculator', 'mass-concentration-to-molarity-calculator'],
    checks: [
      { inputs: {}, expect: { conc: '50 mg/mL', draw: '2.5 mL' } },
      { inputs: { mass: 1000, volume: 5, want: 50 }, expect: { conc: '200 mg/mL', draw: '0.25 mL' } },
      { inputs: { want: 0 }, expect: { draw: '0 mL' } },
    ],
  },
  {
    slug: 'resuspension-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions',
    title: 'Resuspension Calculator for Oligos and DNA: Buffer Volume',
    h1: 'Resuspension Calculator',
    metaDescription: 'Work out the volume of buffer to add to a dried oligo or DNA pellet to reach a target concentration in micromolar.',
    about:
      'Synthetic oligonucleotides arrive dried in a tube, with the supplier stating the amount in nanomoles. To make a stock, you add buffer or water so that the nanomoles are spread over a volume that gives the concentration you want. Because a nanomole per microlitre equals a millimolar and a micromolar is a thousandth of that, the volume in microlitres is the nanomoles divided by the micromolar target and multiplied by one thousand. Enter the amount received and the stock concentration, and the page gives the volume to add and the same value in millilitres.',
    inputs: [field('nmol', 'Amount in the tube (nmol)', 25, 0.001, 1e6), field('target', 'Target stock concentration (µM)', 100, 0.01, 1e5)],
    outputs: [
      { name: 'ul', label: 'Volume to add', format: 'text', highlight: true },
      { name: 'ml', label: 'In millilitres', format: 'text' },
    ],
    calculate: (i) => {
      const ul = toD(i.nmol).div(toD(i.target)).mul(1000);
      return { ul: `${fmtNumber(ul, 1)} µL`, ml: `${fmtNumber(ul.div(1000), 4)} mL` };
    },
    formulaDescription: 'Volume (µL) = amount (nmol) ÷ target concentration (µM) × 1,000. Because 1 nmol in 1 µL is 1 mM, which is 1,000 µM.',
    workedExample: '25 nmol made up to 100 µM needs 25 ÷ 100 × 1,000 = 250 µL. 40 nmol at 10 µM needs 4,000 µL, or 4 mL.',
    faq: [
      {
        question: 'What buffer should I use?',
        answer: 'Many labs use Tris-EDTA at a slightly basic pH because it protects nucleic acids better than plain water. Follow your protocol.',
      },
      {
        question: 'How do I make a working dilution?',
        answer: 'Dilute the stock, for example 1 in 10 for a 10 µM working solution, using the dilution factor calculator.',
      },
      { question: 'Does the pellet add volume?', answer: 'A tiny amount, which is negligible at these volumes.' },
    ],
    scenarios: mixed(
      'resuspension-calculator',
      8,
      (r) => ({ nmol: r(2, 400), target: Math.round(r(5, 500)) }),
      (v) => `${v.nmol} nmol to ${v.target} µM`,
    ),
    introOutputs: ['ul'],
    relatedSlugs: ['reconstitution-calculator', 'dilution-factor-calculator'],
    checks: [
      { inputs: {}, expect: { ul: '250 µL', ml: '0.25 mL' } },
      { inputs: { nmol: 40, target: 10 }, expect: { ul: '4,000 µL', ml: '4 mL' } },
      { inputs: { nmol: 5.2, target: 100 }, expect: { ul: '52 µL' } },
    ],
  },
  {
    slug: 'moles-to-atoms-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Stoichiometry',
    title: "Moles to Atoms Calculator Using Avogadro's Number",
    h1: 'Moles to Atoms Calculator',
    metaDescription: "Convert moles of a substance to the number of molecules and the total number of atoms using Avogadro's constant.",
    about:
      'A mole is a counting unit, like a dozen, but for a very large number: 6.02214076 × 10^23 particles. To change moles into a count of molecules, multiply by that constant. If each molecule holds several atoms, multiply again by the number of atoms in the formula to get the total number of atoms. Enter the moles and the atoms per formula unit, for example 3 for carbon dioxide or 1 for a monatomic element, and the page prints both counts in scientific notation. Use it to see how many atoms are in a sample, a drop of water or a teaspoon of salt. Textbook problems about sugar cubes, diamonds, balloons and candle wax often start here, before moving on to gas volumes.',
    inputs: [field('moles', 'Amount (mol)', 2, 0, 1e9), intField('per', 'Atoms in one formula unit', 3, 1, 1000)],
    outputs: [
      { name: 'particles', label: 'Molecules or formula units', format: 'text' },
      { name: 'atoms', label: 'Atoms in total', format: 'text', highlight: true },
    ],
    calculate: (i) => {
      const particles = toD(i.moles).mul(NA);
      return { particles: sci(particles, 3), atoms: sci(particles.mul(toD(i.per)), 3) };
    },
    formulaDescription: 'Particles = moles × 6.02214076 × 10^23. Atoms = particles × atoms per formula unit.',
    workedExample: '2 mol of CO2 holds 2 × 6.022 × 10^23 = 1.204 × 10^24 molecules, and with 3 atoms in each molecule, 3.613 × 10^24 atoms.',
    faq: [
      { question: "Is Avogadro's number exact?", answer: 'Since 2019 the Avogadro constant is defined as exactly 6.02214076 × 10^23 per mole.' },
      { question: 'What is one atom of an element?', answer: 'For a monatomic sample such as iron, there is one atom per formula unit, so enter 1.' },
      {
        question: 'How do I start from grams?',
        answer: "Divide by the molar mass first, with the grams to moles calculator, or use the Avogadro's number calculator.",
      },
    ],
    scenarios: mixed(
      'moles-to-atoms-calculator',
      12,
      (r) => ({ moles: r(0.01, 25), per: Math.round(r(1, 14)) }),
      (v) => `${v.moles} mol with ${v.per} atoms per formula`,
    ),
    introOutputs: ['atoms'],
    relatedSlugs: ['avogadros-number-calculator', 'grams-to-moles-calculator'],
    checks: [
      { inputs: {}, expect: { particles: '1.204 × 10^24', atoms: '3.613 × 10^24' } },
      { inputs: { moles: 1, per: 1 }, expect: { particles: '6.022 × 10^23', atoms: '6.022 × 10^23' } },
      { inputs: { moles: 0.5, per: 2 }, expect: { particles: '3.011 × 10^23', atoms: '6.022 × 10^23' } },
    ],
  },
  {
    slug: 'avogadros-number-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Stoichiometry',
    title: "Avogadro's Number Calculator: Grams to Number of Particles",
    h1: "Avogadro's Number Calculator",
    metaDescription: 'Turn a mass in grams and a molar mass into moles and the number of particles using the Avogadro constant 6.02214076 × 10^23.',
    about:
      "Avogadro's number links the world of single atoms to the world of grams on a balance. One mole of any substance has the same number of particles, and its mass in grams equals its molar mass, so 12.011 grams of carbon, 18.015 grams of water and 58.44 grams of salt each hold 6.022 × 10^23 particles. Enter the mass and the molar mass and the page gives the moles, and the number of particles in scientific notation. The constant itself is defined exactly as 6.02214076 × 10^23 per mole and is shown beside the result. Try it on a pinch of sand, a graphene flake, a nanoparticle suspension or a bead of mercury to see how enormous counts of tiny grains become on the balance.",
    inputs: [field('grams', 'Mass (g)', 36.03, 0, 1e9), field('mm', 'Molar mass (g/mol)', 18.015, 0.5, 1e6)],
    outputs: [
      { name: 'moles', label: 'Moles', format: 'text' },
      { name: 'particles', label: 'Number of particles', format: 'text', highlight: true },
      { name: 'constant', label: 'Avogadro constant', format: 'text' },
    ],
    calculate: (i) => {
      const moles = toD(i.grams).div(toD(i.mm));
      return { moles: fmtNumber(moles, 4), particles: sci(moles.mul(NA), 3), constant: '6.02214076 × 10^23 per mol' };
    },
    formulaDescription: 'Moles = mass ÷ molar mass. Particles = moles × N_A, with N_A = 6.02214076 × 10^23 per mole.',
    workedExample:
      '36.03 g of water at 18.015 g/mol is 2 mol, so 2 × 6.022 × 10^23 = 1.204 × 10^24 molecules. 1 g of NaCl at 58.44 g/mol is 0.0171 mol, or 1.030 × 10^22 formula units.',
    faq: [
      {
        question: 'Who was Avogadro?',
        answer:
          'Amedeo Avogadro proposed in 1811 that equal volumes of gases hold equal numbers of molecules. The constant was named in his honour much later.',
      },
      {
        question: 'Why is it exact now?',
        answer: 'The 2019 redefinition of the SI fixed the value of the Avogadro constant, and the mole is defined from it.',
      },
      {
        question: 'What counts as a particle?',
        answer: 'Whatever the formula represents: an atom for an element, a molecule for water, a formula unit for a salt.',
      },
    ],
    scenarios: mixed(
      'avogadros-number-calculator',
      12,
      (r) => ({ grams: r(0.05, 400), mm: r(2, 320) }),
      (v) => `${v.grams} g at ${v.mm} g/mol`,
    ),
    introOutputs: ['particles'],
    relatedSlugs: ['moles-to-atoms-calculator', 'grams-to-moles-calculator'],
    checks: [
      { inputs: {}, expect: { moles: '2', particles: '1.204 × 10^24', constant: '6.02214076 × 10^23 per mol' } },
      { inputs: { grams: 1, mm: 58.44 }, expect: { moles: '0.0171', particles: '1.030 × 10^22' } },
      { inputs: { grams: 12.011, mm: 12.011 }, expect: { moles: '1', particles: '6.022 × 10^23' } },
    ],
  },
  {
    slug: 'molar-ratio-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Stoichiometry',
    title: 'Molar Ratio Calculator from a Balanced Equation',
    h1: 'Molar Ratio Calculator',
    metaDescription: 'Use the coefficients of a balanced chemical equation to convert moles of one substance into moles and grams of another.',
    about:
      'The coefficients in a balanced equation are mole ratios. In 2 H2 + O2 → 2 H2O, two moles of hydrogen make two moles of water and use one of oxygen, so the ratio of hydrogen to water is 2 to 2. To find how much of one substance goes with another, multiply the known moles by the wanted coefficient and divide by the given coefficient. Enter the two coefficients, the moles you have and the molar mass of the wanted substance, and the page returns the moles and the mass of the wanted substance. It does not check that the equation is balanced.',
    inputs: [
      intField('given', 'Coefficient of the substance you have', 2, 1, 50),
      intField('wanted', 'Coefficient of the wanted substance', 2, 1, 50),
      field('moles', 'Moles you have', 3, 0, 1e9),
      field('mm', 'Molar mass of the wanted substance (g/mol)', 18.015, 0.5, 1e6),
    ],
    outputs: [
      { name: 'wanted', label: 'Moles of wanted substance', format: 'text', highlight: true },
      { name: 'grams', label: 'Mass of wanted substance', format: 'text' },
    ],
    calculate: (i) => {
      const moles = toD(i.moles).mul(toD(i.wanted)).div(toD(i.given));
      return { wanted: `${fmtNumber(moles, 4)} mol`, grams: `${fmtNumber(moles.mul(toD(i.mm)), 3)} g` };
    },
    formulaDescription: 'Moles of wanted = moles given × (coefficient of wanted ÷ coefficient of given). Mass = moles of wanted × its molar mass.',
    workedExample:
      'From 2 H2 + O2 → 2 H2O, 3 mol of H2 gives 3 × 2 ÷ 2 = 3 mol of H2O, which is 54.045 g. From N2 + 3 H2 → 2 NH3, 6 mol of H2 gives 4 mol of NH3, or 68.124 g.',
    faq: [
      {
        question: 'Do the coefficients have to be balanced?',
        answer: 'Yes. Ratios from an unbalanced equation are wrong. Balance it first with the equation balancer.',
      },
      {
        question: 'What about limiting reagents?',
        answer: 'This page uses one known substance. If two reactants are given, find which gives less product; that is the limiting reagent.',
      },
      { question: 'Can it work in reverse?', answer: 'Yes. Swap the two coefficients to find how much reactant you need for a wanted amount of product.' },
    ],
    scenarios: mixed(
      'molar-ratio-calculator',
      8,
      (r) => ({ given: Math.round(r(1, 6)), wanted: Math.round(r(1, 8)), moles: r(0.1, 40), mm: r(2, 250) }),
      (v) => `ratio ${v.given} to ${v.wanted} for ${v.moles} mol at ${v.mm} g/mol`,
    ),
    introOutputs: ['wanted'],
    relatedSlugs: ['theoretical-yield-calculator', 'grams-to-moles-calculator'],
    checks: [
      { inputs: {}, expect: { wanted: '3 mol', grams: '54.045 g' } },
      { inputs: { given: 3, wanted: 2, moles: 6, mm: 17.031 }, expect: { wanted: '4 mol', grams: '68.124 g' } },
      { inputs: { given: 1, wanted: 3, moles: 2 }, expect: { wanted: '6 mol' } },
    ],
  },
  {
    slug: 'actual-yield-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Stoichiometry',
    title: 'Actual Yield Calculator from Theoretical Yield and Percent Yield',
    h1: 'Actual Yield Calculator',
    metaDescription: 'Find the actual mass of product you can expect from a theoretical yield and a percent yield, and how much is lost.',
    about:
      'The theoretical yield is the most product a reaction could give if every molecule reacted and nothing were lost. Real syntheses give less because of side reactions, incomplete conversion and losses in transfer and purification. The percent yield compares what you actually got with that ideal. To plan an experiment you can turn the relation around: multiply the theoretical yield by the expected percent yield to find the actual yield you should hope for, and see how much is lost. Enter the two numbers in any unit of mass, and the page returns the expected product and the shortfall.',
    inputs: [field('theory', 'Theoretical yield', 25, 0, 1e9), field('pct', 'Expected percent yield (%)', 78, 0, 100)],
    outputs: [
      { name: 'actual', label: 'Actual yield', format: 'text', highlight: true },
      { name: 'lost', label: 'Lost compared with theoretical', format: 'text' },
    ],
    calculate: (i) => {
      const actual = toD(i.theory).mul(toD(i.pct)).div(100);
      return { actual: fmtNumber(actual, 3), lost: fmtNumber(toD(i.theory).minus(actual), 3) };
    },
    formulaDescription: 'Actual yield = theoretical yield × percent yield ÷ 100. Lost = theoretical yield − actual yield.',
    workedExample: 'A reaction that could give 25 g and runs at 78% gives 19.5 g, which loses 5.5 g. A theoretical 12.5 g at 92% gives 11.5 g.',
    faq: [
      {
        question: 'How do I find the theoretical yield?',
        answer: 'Work from the limiting reagent: moles of reagent × the mole ratio × molar mass of the product.',
      },
      {
        question: 'Can percent yield exceed 100?',
        answer: 'Only through error, such as a wet or impure product. A measured value above 100 means the sample still holds solvent or by-products.',
      },
      {
        question: 'What is a typical percent yield?',
        answer: 'Simple steps in teaching labs give 60 to 90 percent, multi-step syntheses much less because losses multiply.',
      },
    ],
    scenarios: mixed(
      'actual-yield-calculator',
      8,
      (r) => ({ theory: r(0.5, 480), pct: Math.round(r(8, 99)) }),
      (v) => `${v.theory} theoretical at ${v.pct}%`,
    ),
    introOutputs: ['actual'],
    relatedSlugs: ['percent-yield-calculator', 'theoretical-yield-calculator'],
    checks: [
      { inputs: {}, expect: { actual: '19.5', lost: '5.5' } },
      { inputs: { theory: 12.5, pct: 92 }, expect: { actual: '11.5', lost: '1' } },
      { inputs: { pct: 100 }, expect: { actual: '25', lost: '0' } },
    ],
  },
  {
    slug: 'empirical-formula-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Stoichiometry',
    title: 'Empirical Formula Calculator from Mass or Percent Composition',
    h1: 'Empirical Formula Calculator',
    metaDescription:
      'Find the empirical formula of a compound from the masses or percentages of up to four elements, and the molecular formula from the molar mass.',
    about:
      'The empirical formula is the simplest whole-number ratio of atoms in a compound. To find it, treat the percentages as grams, divide each by the atomic mass to get moles, divide all the moles by the smallest, and if a ratio is not close to a whole number, multiply every ratio by 2, 3 or more until it is. Choose up to four elements and enter their masses or percentages; the page does the arithmetic. If you also know the molar mass of the compound, it divides by the formula mass to give the molecular formula. Glucose, CH2O in its simplest form, is C6H12O6. Typical sources of the data are combustion analysis, mass spectrometry of an unknown, hydrate crystals heated to constant weight and metal oxides reduced in a furnace.',
    inputs: [
      select('e1', 'Element 1', 'C', ELEMENT_OPTIONS),
      field('m1', 'Mass or percent of element 1', 40, 0, 1e6),
      select('e2', 'Element 2', 'H', ELEMENT_OPTIONS),
      field('m2', 'Mass or percent of element 2', 6.7, 0, 1e6),
      select('e3', 'Element 3', 'O', ELEMENT_OPTIONS),
      field('m3', 'Mass or percent of element 3', 53.3, 0, 1e6),
      select('e4', 'Element 4', 'none', ELEMENT_OPTIONS),
      field('m4', 'Mass or percent of element 4', 0, 0, 1e6),
      field('molar', 'Molar mass of the compound (g/mol, 0 if unknown)', 0, 0, 1e6),
    ],
    outputs: [
      { name: 'empirical', label: 'Empirical formula', format: 'text', highlight: true },
      { name: 'ratios', label: 'Mole ratios before rounding', format: 'text' },
      { name: 'molecular', label: 'Molecular formula', format: 'text' },
    ],
    calculate: (i) => {
      const rows = [
        [i.e1, i.m1],
        [i.e2, i.m2],
        [i.e3, i.m3],
        [i.e4, i.m4],
      ]
        .map(([e, m]) => ({ el: String(e), mass: toD(m) }))
        .filter((row) => row.el !== 'none' && row.mass.gt(0));
      if (rows.length === 0) return { empirical: 'Enter at least one element and a mass', ratios: '-', molecular: '-' };
      const moles = rows.map((row) => row.mass.div(ATOMIC_MASS[row.el]));
      const smallest = moles.reduce((a, b) => (a.lt(b) ? a : b));
      const ratios = moles.map((m) => m.div(smallest));
      const counts = wholeNumberRatio(ratios);
      if (!counts)
        return { empirical: 'No simple whole-number ratio found: check the data', ratios: ratios.map((r) => fmtNumber(r, 3)).join(' : '), molecular: '-' };
      const symbols = rows.map((row) => row.el);
      const write = (factor: Dec) =>
        hillFormula(
          symbols,
          counts.map((n) => n.mul(factor)),
        );
      const formulaMass = counts.reduce((sum, n, k) => sum.plus(new D(ATOMIC_MASS[symbols[k]]).mul(n)), new D(0));
      let molecular = 'Enter the molar mass to find it';
      if (toD(i.molar).gt(0)) {
        const factor = toD(i.molar).div(formulaMass).toDecimalPlaces(0);
        molecular = factor.gte(1) ? write(factor) : 'The molar mass is below the empirical formula mass';
      }
      return { empirical: write(new D(1)), ratios: ratios.map((r) => fmtNumber(r, 3)).join(' : '), molecular };
    },
    formulaDescription:
      'Moles of each element = mass ÷ atomic mass. Divide all by the smallest. Multiply by 2, 3, ... up to 8 until every ratio is within 0.1 of a whole number. Molecular formula = empirical formula × (molar mass ÷ empirical formula mass).',
    workedExample:
      '40.0% C, 6.7% H, 53.3% O: moles 3.330, 6.647, 3.331, ratio 1 : 1.996 : 1.000, so CH2O. With a molar mass of 180.16 the factor is 6 and the molecular formula is C6H12O6.',
    faq: [
      { question: 'Do I enter masses or percentages?', answer: 'Either, because only the ratio matters. Percentages are the masses in a 100 g sample.' },
      {
        question: 'What if the ratio is something like 1.5?',
        answer: 'Multiply all ratios by 2 to get whole numbers. The page does this for you, up to a factor of 8.',
      },
      {
        question: 'Why is the answer only the empirical formula?',
        answer: 'Mass data give only a ratio. Glucose and formaldehyde share the formula CH2O. The molar mass tells them apart.',
      },
    ],
    scenarios: [
      withInputs('52.9% Al and 47.1% O', { e1: 'Al', m1: 52.9, e2: 'O', m2: 47.1, e3: 'none', m3: 0, e4: 'none', m4: 0, molar: 0 }),
      withInputs('40.04% Ca, 12.0% C and 47.96% O', { e1: 'Ca', m1: 40.04, e2: 'C', m2: 12, e3: 'O', m3: 47.96, e4: 'none', m4: 0, molar: 0 }),
      withInputs('32.37% Na, 22.57% S and 45.06% O', { e1: 'Na', m1: 32.37, e2: 'S', m2: 22.57, e3: 'O', m3: 45.06, e4: 'none', m4: 0, molar: 0 }),
      withInputs('30.45% N and 69.55% O', { e1: 'N', m1: 30.45, e2: 'O', m2: 69.55, e3: 'none', m3: 0, e4: 'none', m4: 0, molar: 0 }),
      withInputs('5.93% H and 94.07% O, molar mass 34.01', { e1: 'H', m1: 5.93, e2: 'O', m2: 94.07, e3: 'none', m3: 0, e4: 'none', m4: 0, molar: 34.01 }),
      withInputs('43.64% P and 56.36% O', { e1: 'P', m1: 43.64, e2: 'O', m2: 56.36, e3: 'none', m3: 0, e4: 'none', m4: 0, molar: 0 }),
    ],
    introOutputs: ['empirical'],
    relatedSlugs: ['percent-composition-calculator', 'molar-mass-calculator'],
    checks: [
      { inputs: {}, expect: { empirical: 'CH2O', molecular: 'Enter the molar mass to find it' } },
      { inputs: { molar: 180.16 }, expect: { empirical: 'CH2O', molecular: 'C6H12O6' } },
      { inputs: { e1: 'Fe', m1: 69.94, e2: 'O', m2: 30.06, e3: 'none', m3: 0 }, expect: { empirical: 'Fe2O3' } },
      { inputs: { e1: 'C', m1: 92.3, e2: 'H', m2: 7.7, e3: 'none', m3: 0 }, expect: { empirical: 'CH' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
