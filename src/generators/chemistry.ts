import { z } from 'zod';
import { numberField } from '../lib/calc-utils';
import { D, toD } from '../lib/decimal';
import { fmtFixed, fmtNumber, fmtPercent } from '../lib/format';
import { fmtSig } from '../lib/gen-utils';
import { elementMass, molarMass, parseFormula } from '../lib/formula';
import { defineCalculator, type Spec } from '../lib/spec';
import { field, rows, sci } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 1 (chemistry): solutions, stoichiometry, thermodynamics, electrochemistry and spectroscopy.
 * Topics come from the owner's catalog target; every formula, sentence and number here is written for this site.
 * Constants: R = 8.314462618 J/(mol K) and F = 96485.33212 C/mol (CODATA 2018), Avogadro 6.02214076e23 per mol.
 * All pages are tier 2 or 3, so none is live until the cohort gate opens.
 */

const text = (value: string, label: string) => ({ name: 'formula', label, type: 'text' as const, default: value, validator: z.string().trim().min(1).max(60) });

const R_GAS = new D('8.314462618');
const FARADAY = new D('96485.33212');
const AVOGADRO = new D('6.02214076e23');

export const SPECS: Spec[] = [
  {
    slug: 'molarity-calculator',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Solutions and concentration',
    title: 'Molarity Calculator: Moles per Litre from Mass and Volume',
    h1: 'Molarity Calculator',
    metaDescription: 'Turn the mass of a dissolved substance, its molar mass and the final volume of the solution into moles and molarity in mol/L.',
    about:
      'Molarity is the number of moles of a dissolved substance in each litre of solution, and it is the concentration most laboratory recipes quote. Weigh the solid, divide by its molar mass to get moles, then divide by the volume of the finished solution, not the volume of solvent you started with. A 58.44 g portion of table salt made up to one litre is a one molar solution. Use the molar mass calculator if you only have a formula. Typical bench uses are making up buffer stocks, preparing standards for a titration and checking a reagent label. Weigh to the precision of your balance, use a volumetric flask rather than a beaker, and note that glassware is calibrated at 20 °C. For a hydrate, include the water of crystallisation in the molar mass or the answer comes out too high.',
    inputs: [
      field('mass', 'Mass of solute (g)', 29.22, 0, 1000000),
      field('mm', 'Molar mass (g/mol)', 58.44, 0.1, 100000),
      field('volume', 'Final volume (L)', 0.5, 0.001, 100000),
    ],
    outputs: [
      { name: 'molarity', label: 'Molarity', format: 'text', highlight: true },
      { name: 'moles', label: 'Moles of solute', format: 'text' },
    ],
    calculate: (i) => {
      const volume = toD(i.volume);
      if (volume.lte(0)) return { molarity: 'Enter a volume above zero', moles: '-' };
      const moles = toD(i.mass).div(toD(i.mm));
      return { molarity: `${fmtNumber(moles.div(volume), 4)} mol/L`, moles: `${fmtNumber(moles, 4)} mol` };
    },
    formulaDescription: 'Moles n = mass ÷ molar mass. Molarity M = n ÷ V, with V the final volume of the solution in litres.',
    workedExample: '29.22 g of NaCl (58.44 g/mol) is 0.5 mol. Dissolved and made up to 0.5 L it gives 0.5 ÷ 0.5 = 1 mol/L.',
    faq: [
      {
        question: 'Is the volume the solvent or the whole solution?',
        answer: 'The whole solution. Dissolving a solid changes the volume a little, so make it up to the mark in a volumetric flask.',
      },
      {
        question: 'What is the difference between molarity and molality?',
        answer: 'Molarity divides by litres of solution and changes slightly with temperature. Molality divides by kilograms of solvent and does not.',
      },
      {
        question: 'How do I get the molar mass?',
        answer: 'Add the atomic masses of every atom in the formula, or type the formula into the molar mass calculator.',
      },
    ],
    scenarios: rows(
      ['mass', 'mm', 'volume'],
      [
        [10, 58.44, 0.5],
        [4, 40, 0.25],
        [18, 180.156, 0.2],
        [9.8, 98.072, 1],
        [100, 342.3, 1.5],
        [2.5, 74.55, 0.1],
        [53.5, 53.49, 0.4],
      ],
      (v) => `${v[0]} g, ${v[1]} g/mol, made up to ${v[2]} L`,
    ),
    relatedSlugs: ['molality-calculator', 'dilution-calculator', 'molar-mass-calculator'],
    checks: [
      { inputs: {}, expect: { molarity: '1 mol/L', moles: '0.5 mol' } },
      { inputs: { mass: 40, mm: 40, volume: 2 }, expect: { molarity: '0.5 mol/L', moles: '1 mol' } },
      { inputs: { mass: 10, mm: 40, volume: 0.25 }, expect: { molarity: '1 mol/L', moles: '0.25 mol' } },
    ],
  },
  {
    slug: 'molality-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions and concentration',
    title: 'Molality Calculator: Moles per Kilogram of Solvent',
    h1: 'Molality Calculator',
    metaDescription: 'Find molality, the moles of solute per kilogram of solvent, from the mass of solute, its molar mass and the mass of solvent.',
    about:
      'Molality counts the moles of solute against the mass of the solvent alone, in kilograms. Because mass does not change when a solution warms or cools, molality is the preferred measure for colligative properties such as boiling point elevation and freezing point depression. Enter the mass of the dissolved substance, its molar mass and how many kilograms of solvent you used, and the calculator returns the molality and the moles involved. Process chemists favour it for freezing and boiling work because heating or cooling a sample never changes the figure. In dilute aqueous solutions it lands close to the molarity, since a litre of water weighs about a kilogram, but in syrups or non-aqueous solvents the two drift apart. A solution that is 1 mol/kg holds one mole of dissolved particles for every kilogram of solvent, which for sucrose means 342.3 grams stirred into a kilogram of water, not into a litre of final syrup.',
    inputs: [
      field('mass', 'Mass of solute (g)', 11.688, 0, 1000000),
      field('mm', 'Molar mass (g/mol)', 58.44, 0.1, 100000),
      field('solvent', 'Mass of solvent (kg)', 0.5, 0.001, 100000),
    ],
    outputs: [
      { name: 'molality', label: 'Molality', format: 'text', highlight: true },
      { name: 'moles', label: 'Moles of solute', format: 'text' },
    ],
    calculate: (i) => {
      const moles = toD(i.mass).div(toD(i.mm));
      return { molality: `${fmtNumber(moles.div(toD(i.solvent)), 4)} mol/kg`, moles: `${fmtNumber(moles, 4)} mol` };
    },
    formulaDescription: 'Molality b = moles of solute ÷ kilograms of solvent, with moles = mass of solute ÷ molar mass.',
    workedExample: '11.688 g of NaCl is 0.2 mol. Dissolved in 0.5 kg of water that is 0.2 ÷ 0.5 = 0.4 mol/kg.',
    faq: [
      {
        question: 'Why use molality instead of molarity?',
        answer: 'It depends on masses only, so it does not drift with temperature. That makes it the right input for boiling and freezing point formulas.',
      },
      { question: 'Is the solvent mass in grams or kilograms?', answer: 'Kilograms. Divide grams by 1,000 first if you weighed the water in grams.' },
      { question: 'Do I include the solute in the solvent mass?', answer: 'No. Only the solvent counts, which is the main difference from mass percent.' },
    ],
    scenarios: rows(
      ['mass', 'mm', 'solvent'],
      [
        [58.44, 58.44, 1],
        [20, 40, 0.25],
        [34.2, 342.3, 0.2],
        [9, 180.156, 0.1],
        [7.45, 74.55, 0.5],
        [100, 98.072, 2],
      ],
      (v) => `Stirring ${v[0]} g (molar mass ${v[1]}) into ${v[2]} kg of solvent`,
    ),
    relatedSlugs: ['molarity-calculator', 'boiling-point-elevation-calculator', 'freezing-point-depression-calculator'],
    checks: [
      { inputs: {}, expect: { molality: '0.4 mol/kg', moles: '0.2 mol' } },
      { inputs: { mass: 58.44, solvent: 1 }, expect: { molality: '1 mol/kg' } },
      { inputs: { mass: 11.688, solvent: 0.2 }, expect: { molality: '1 mol/kg' } },
    ],
  },
  {
    slug: 'ph-calculator',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Acids and bases',
    title: 'pH Calculator: pH, pOH and Hydroxide from Hydrogen Ion Concentration',
    h1: 'pH Calculator',
    metaDescription:
      'Enter the hydrogen ion concentration in mol/L and get pH, pOH, hydroxide concentration and whether the solution is acidic, neutral or basic.',
    about:
      'The pH scale compresses the huge range of hydrogen ion concentrations into a short number: pH is the negative base-10 logarithm of the concentration in mol/L. A concentration of 0.001 mol/L is pH 3, and each step down the scale is a tenfold rise in acidity. At 25 °C the ion product of water is 1 × 10^-14, so pH and pOH always add to 14. Type the concentration as a decimal, for example 0.0001, or in the form 1e-4.',
    inputs: [field('h', 'Hydrogen ion concentration (mol/L)', 0.001, 0.00000000000001, 10)],
    outputs: [
      { name: 'ph', label: 'pH', format: 'text', highlight: true },
      { name: 'poh', label: 'pOH', format: 'text' },
      { name: 'oh', label: 'Hydroxide concentration', format: 'text' },
      { name: 'nature', label: 'Solution is', format: 'text' },
    ],
    calculate: (i) => {
      const h = toD(i.h);
      const ph = h.log(10).neg();
      const poh = new D(14).minus(ph);
      const rounded = ph.toDecimalPlaces(2);
      return {
        ph: fmtFixed(ph, 2),
        poh: fmtFixed(poh, 2),
        oh: `${sci(new D('1e-14').div(h), 2)} mol/L`,
        nature: rounded.lt(7) ? 'Acidic' : rounded.gt(7) ? 'Basic' : 'Neutral',
      };
    },
    formulaDescription: 'pH = −log10 [H+]. pOH = 14 − pH at 25 °C, and [OH−] = 1 × 10^-14 ÷ [H+]. A pH below 7 is acidic, above 7 basic.',
    workedExample: '[H+] = 0.001 mol/L gives pH = 3.00 and pOH = 11.00, so [OH−] = 1.00 × 10^-11 mol/L and the solution is acidic.',
    faq: [
      {
        question: 'Why is neutral exactly 7?',
        answer: 'In pure water at 25 °C the hydrogen and hydroxide concentrations are both 1 × 10^-7 mol/L, and the negative logarithm of that is 7.',
      },
      {
        question: 'Does the answer change with temperature?',
        answer: 'Yes. The ion product of water shifts with temperature, so neutral is not exactly pH 7 away from 25 °C. This tool assumes 25 °C.',
      },
      {
        question: 'Can pH be negative or above 14?',
        answer: 'Yes, for very strong acids or bases at high concentration, though this tool limits the input to 10 mol/L.',
      },
    ],
    scenarios: [0.1, 0.01, 0.00001, 0.0000001, 0.000000001, 0.00000000001].map((h) => ({ label: `[H+] of ${h} mol/L`, inputs: { h } })),
    relatedSlugs: ['henderson-hasselbalch-calculator', 'molarity-calculator'],
    checks: [
      { inputs: {}, expect: { ph: '3.00', poh: '11.00', oh: '1.00 × 10^-11 mol/L', nature: 'Acidic' } },
      { inputs: { h: 1e-7 }, expect: { ph: '7.00', poh: '7.00', nature: 'Neutral' } },
      { inputs: { h: 1e-10 }, expect: { ph: '10.00', poh: '4.00', nature: 'Basic' } },
    ],
  },
  {
    slug: 'dilution-calculator',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Solutions and concentration',
    title: 'Dilution Calculator: C1V1 = C2V2 Final Volume and Water to Add',
    h1: 'Dilution Calculator',
    metaDescription: 'Use C1V1 = C2V2 to find the final volume and the solvent to add when diluting a stock solution to a lower concentration.',
    about:
      'When you dilute a solution the amount of solute stays the same and only the solvent grows, so concentration times volume is constant before and after. That gives the classic C1V1 = C2V2. Enter the stock concentration, the volume of stock you will take and the concentration you want, and the calculator returns the final volume and the volume of solvent to add. Any concentration unit works if both entries use the same one.',
    inputs: [
      field('c1', 'Stock concentration C1', 12, 0.0001, 1000000),
      field('v1', 'Stock volume V1 (mL)', 25, 0.001, 1000000),
      field('c2', 'Target concentration C2', 1, 0.0001, 1000000),
    ],
    outputs: [
      { name: 'v2', label: 'Final volume', format: 'text', highlight: true },
      { name: 'water', label: 'Solvent to add', format: 'text' },
      { name: 'factor', label: 'Dilution factor', format: 'text' },
    ],
    calculate: (i) => {
      const c1 = toD(i.c1);
      const c2 = toD(i.c2);
      if (c2.gt(c1)) return { v2: 'The target cannot exceed the stock concentration', water: '-', factor: '-' };
      const v2 = c1.mul(toD(i.v1)).div(c2);
      return { v2: `${fmtNumber(v2, 3)} mL`, water: `${fmtNumber(v2.minus(toD(i.v1)), 3)} mL`, factor: `${fmtNumber(c1.div(c2), 3)}×` };
    },
    formulaDescription: 'C1 × V1 = C2 × V2, so V2 = C1 × V1 ÷ C2. Solvent to add = V2 − V1. Dilution factor = C1 ÷ C2.',
    workedExample: 'Diluting 12 M stock to 1 M with 25 mL of stock: V2 = 12 × 25 ÷ 1 = 300 mL, so add 275 mL of solvent. The dilution factor is 12.',
    faq: [
      {
        question: 'Do I add the stock to the water or the water to the stock?',
        answer: 'For strong acids always add the acid to the water, slowly, and follow your lab safety rules. The arithmetic is the same either way.',
      },
      { question: 'Do both concentrations need the same unit?', answer: 'Yes. Molarity, percent or ppm all work as long as C1 and C2 match.' },
      {
        question: 'Why is the solvent to add not equal to V2?',
        answer: 'Because V2 includes the volume of stock you started with. Subtract V1 to find what to add.',
      },
    ],
    scenarios: rows(
      ['c1', 'v1', 'c2'],
      [
        [6, 50, 2],
        [10, 5, 0.1],
        [37, 10, 1],
        [2, 100, 0.5],
        [18, 20, 3],
        [0.5, 40, 0.05],
        [95, 12, 70],
      ],
      (v) => `${v[1]} mL of ${v[0]} diluted to ${v[2]}`,
    ),
    relatedSlugs: ['serial-dilution-calculator', 'molarity-calculator', 'mass-percent-calculator'],
    checks: [
      { inputs: {}, expect: { v2: '300 mL', water: '275 mL', factor: '12×' } },
      { inputs: { c1: 6, v1: 50, c2: 2 }, expect: { v2: '150 mL', water: '100 mL', factor: '3×' } },
      { inputs: { c1: 1, v1: 10, c2: 2 }, expect: { v2: 'The target cannot exceed the stock concentration' } },
    ],
  },
  {
    slug: 'serial-dilution-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions and concentration',
    title: 'Serial Dilution Calculator: Concentration After Each Step',
    h1: 'Serial Dilution Calculator',
    metaDescription:
      'List the concentration after every step of a serial dilution from the starting concentration, the dilution factor and the number of steps.',
    about:
      'A serial dilution repeats the same dilution several times, each tube feeding the next, to reach very low concentrations that a single dilution could not measure accurately. The concentration falls by the dilution factor at every step, so after n steps the total dilution is the factor raised to the power n. Microbiologists and assay designers use it to build standard curves and to count colonies. Enter the starting value, the factor per step and the number of steps.',
    inputs: [
      field('start', 'Starting concentration', 100, 0.000001, 1000000000),
      field('factor', 'Dilution factor per step', 10, 1.01, 1000),
      { name: 'steps', label: 'Number of steps', type: 'number', default: 6, min: 1, max: 12, validator: numberField({ min: 1, max: 12, integer: true }) },
    ],
    outputs: [
      { name: 'final', label: 'Final concentration', format: 'text', highlight: true },
      { name: 'total', label: 'Total dilution', format: 'text' },
      { name: 'series', label: 'After each step', format: 'text' },
    ],
    calculate: (i) => {
      const factor = toD(i.factor);
      const steps = toD(i.steps);
      let current = toD(i.start);
      const series: string[] = [];
      for (let k = new D(0); k.lt(steps); k = k.plus(1)) {
        current = current.div(factor);
        series.push(fmtSig(current, 4, false));
      }
      return { final: fmtSig(current, 4, false), total: fmtNumber(factor.pow(steps), 0), series: series.join(' → ') };
    },
    formulaDescription: 'Concentration after step k = start ÷ factor^k. Total dilution = factor^n for n steps.',
    workedExample: 'Start at 100 with a tenfold dilution six times: 10, 1, 0.1, 0.01, 0.001, 0.0001. The total dilution is 10^6 = 1,000,000.',
    faq: [
      {
        question: 'Why dilute in steps instead of once?',
        answer: 'Pipetting a tiny volume into a large one is inaccurate. Several moderate dilutions keep every transfer volume practical.',
      },
      {
        question: 'What factor should I choose?',
        answer: 'Tenfold is common for counting, twofold for fine standard curves. The tool accepts any factor above one.',
      },
      { question: 'Is the factor per step or overall?', answer: 'Per step. The overall dilution is shown in the total dilution line.' },
    ],
    scenarios: rows(
      ['start', 'factor', 'steps'],
      [
        [64, 2, 5],
        [250, 5, 3],
        [1000, 10, 4],
        [80, 4, 6],
        [5, 3, 8],
        [12, 2, 10],
      ],
      (v) => `${v[0]} diluted ${v[1]}-fold, ${v[2]} times`,
    ),
    relatedSlugs: ['dilution-calculator', 'molarity-calculator'],
    checks: [
      { inputs: {}, expect: { final: '0.0001', total: '1,000,000', series: '10 → 1 → 0.1 → 0.01 → 0.001 → 0.0001' } },
      { inputs: { start: 64, factor: 2, steps: 5 }, expect: { final: '2', total: '32', series: '32 → 16 → 8 → 4 → 2' } },
      { inputs: { start: 250, factor: 5, steps: 3 }, expect: { final: '2', total: '125', series: '50 → 10 → 2' } },
    ],
  },
  {
    slug: 'molar-mass-calculator',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Stoichiometry',
    title: 'Molar Mass Calculator: Grams per Mole from a Chemical Formula',
    h1: 'Molar Mass Calculator',
    metaDescription: 'Type a chemical formula such as C6H12O6 or Ca(OH)2 and get its molar mass in g/mol and the number of atoms it contains.',
    about:
      'The molar mass of a compound is the sum of the atomic masses of every atom in its formula, in grams per mole. It is the number that links the mass you weigh to the moles you calculate with. Type the formula using capital letters for each element and numbers for the counts, with round brackets for groups, as in Al2(SO4)3. The tool uses conventional atomic weights for 37 common elements and tells you when it meets one it does not know.',
    inputs: [text('H2O', 'Chemical formula')],
    outputs: [
      { name: 'mass', label: 'Molar mass', format: 'text', highlight: true },
      { name: 'atoms', label: 'Atoms in the formula', format: 'text' },
    ],
    calculate: (i) => {
      const parsed = parseFormula(String(i.formula));
      if ('error' in parsed) return { mass: parsed.error, atoms: '-' };
      let atoms = 0;
      for (const n of parsed.counts.values()) atoms += n;
      return { mass: `${fmtNumber(molarMass(parsed.counts), 3)} g/mol`, atoms: String(atoms) };
    },
    formulaDescription:
      'Molar mass = sum over elements of (atomic weight × number of atoms). Brackets multiply the group inside them. Weights are conventional IUPAC values to three decimals where the table gives them.',
    workedExample: 'Water, H2O: 2 × 1.008 + 15.999 = 18.015 g/mol. Calcium hydroxide, Ca(OH)2: 40.078 + 2 × (15.999 + 1.008) = 74.092 g/mol.',
    faq: [
      {
        question: 'How do I write a formula with brackets?',
        answer: 'Put the group in round brackets and the count after it, for example Mg(NO3)2 or Al2(SO4)3. Nested brackets also work.',
      },
      {
        question: 'Why is my formula rejected?',
        answer: 'Element symbols are case sensitive: Co is cobalt and CO is carbon monoxide written as C then O. Hydrate dots and charges are not supported.',
      },
      {
        question: 'Is molar mass the same as molecular weight?',
        answer: 'Numerically yes. Molar mass is in grams per mole, molecular weight is a relative mass with no unit.',
      },
    ],
    scenarios: ['C6H12O6', 'NaCl', 'H2SO4', 'Ca(OH)2', 'Al2(SO4)3', 'CH3COOH', 'KMnO4', 'NH4NO3'].map((f) => ({ label: f, inputs: { formula: f } })),
    relatedSlugs: ['percent-composition-calculator', 'grams-to-moles-calculator', 'molarity-calculator'],
    checks: [
      { inputs: {}, expect: { mass: '18.015 g/mol', atoms: '3' } },
      { inputs: { formula: 'Ca(OH)2' }, expect: { mass: '74.092 g/mol', atoms: '5' } },
      { inputs: { formula: 'C6H12O6' }, expect: { mass: '180.156 g/mol', atoms: '24' } },
      { inputs: { formula: 'Al2(SO4)3' }, expect: { mass: '342.132 g/mol', atoms: '17' } },
      { inputs: { formula: 'Xx' }, expect: { mass: 'Unknown element "Xx"' } },
    ],
  },
  {
    slug: 'percent-composition-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Stoichiometry',
    title: 'Percent Composition Calculator: Mass Percent of Each Element',
    h1: 'Percent Composition Calculator',
    metaDescription: 'Give a chemical formula and see the percentage by mass contributed by each element in the compound.',
    about:
      "Percent composition says what share of a compound's mass comes from each element. It is the first step in checking a sample's purity, comparing fertilisers or working back to an empirical formula from analysis data. Each element's contribution is its atomic mass times its count, divided by the molar mass of the whole formula. Type a formula such as C6H12O6 and the percentages are listed in the order the elements appear, and they add up to 100.",
    inputs: [text('C6H12O6', 'Chemical formula')],
    outputs: [
      { name: 'breakdown', label: 'Mass percent by element', format: 'text', highlight: true },
      { name: 'mass', label: 'Molar mass', format: 'text' },
    ],
    calculate: (i) => {
      const parsed = parseFormula(String(i.formula));
      if ('error' in parsed) return { breakdown: parsed.error, mass: '-' };
      const total = molarMass(parsed.counts);
      const parts = [...parsed.counts].map(([el, n]) => `${el} ${fmtFixed(elementMass(el, n).div(total).mul(100), 2)}%`);
      return { breakdown: parts.join(', '), mass: `${fmtNumber(total, 3)} g/mol` };
    },
    formulaDescription: 'Mass % of an element = (atomic weight × atoms of that element) ÷ molar mass of the compound × 100.',
    workedExample:
      'Glucose, C6H12O6, has a molar mass of 180.156 g/mol. Carbon contributes 72.066, so 72.066 ÷ 180.156 = 40.00%; hydrogen 12.096 gives 6.71% and oxygen 95.994 gives 53.28%.',
    faq: [
      { question: 'Do the percentages always add to 100?', answer: 'Yes, up to rounding in the last digit, because the elements make up the whole formula.' },
      {
        question: 'How is this different from empirical formula work?',
        answer:
          'Percent composition goes from formula to percentages. An empirical formula goes the other way, from percentages to the simplest ratio of atoms.',
      },
      { question: 'Can I use it for mixtures?', answer: 'No. It describes a single pure compound. A mixture needs the mass of each component.' },
    ],
    scenarios: ['H2O', 'NaCl', 'CaCO3', 'C2H5OH', 'Fe2O3', 'NH3', 'H2SO4', 'C8H10N4O2'].map((f) => ({ label: f, inputs: { formula: f } })),
    introOutputs: ['breakdown'],
    relatedSlugs: ['molar-mass-calculator', 'grams-to-moles-calculator'],
    checks: [
      { inputs: {}, expect: { breakdown: 'C 40.00%, H 6.71%, O 53.28%', mass: '180.156 g/mol' } },
      { inputs: { formula: 'H2O' }, expect: { breakdown: 'H 11.19%, O 88.81%' } },
      { inputs: { formula: 'NaCl' }, expect: { breakdown: 'Na 39.34%, Cl 60.66%' } },
    ],
  },
  {
    slug: 'grams-to-moles-calculator',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Stoichiometry',
    title: 'Grams to Moles Calculator with Number of Particles',
    h1: 'Grams to Moles Calculator',
    metaDescription: "Convert a mass in grams to moles using molar mass, and see how many particles that is with Avogadro's number.",
    about:
      "Chemical equations count atoms and molecules, but a balance reports grams, and the mole is the bridge between the two. Divide the mass by the molar mass to get moles, then multiply by Avogadro's number, 6.02214076 × 10^23 per mole, to count the particles. This calculator does both in one step so you can check how many molecules are in a sample. Use the molar mass calculator when you only know the formula. Typical questions are how many molecules sit in a drop of water, how much carbon dioxide a gram of chalk can release, or how many ions a pinch of salt holds. The counts are astronomically large, which is exactly why chemists count in moles instead of singly.",
    inputs: [field('mass', 'Mass (g)', 18.015, 0, 1000000000), field('mm', 'Molar mass (g/mol)', 18.015, 0.1, 100000)],
    outputs: [
      { name: 'moles', label: 'Amount of substance', format: 'text', highlight: true },
      { name: 'particles', label: 'Number of particles', format: 'text' },
    ],
    calculate: (i) => {
      const moles = toD(i.mass).div(toD(i.mm));
      return { moles: `${fmtNumber(moles, 4)} mol`, particles: sci(moles.mul(AVOGADRO)) };
    },
    formulaDescription: 'n = m ÷ M, and N = n × NA with NA = 6.02214076 × 10^23 per mole (the exact SI value).',
    workedExample: '36.03 g of water (18.015 g/mol) is 2 mol, which is 2 × 6.022 × 10^23 = 1.204 × 10^24 molecules.',
    faq: [
      {
        question: "Is Avogadro's number exact?",
        answer: 'Since 2019 the SI defines it as exactly 6.02214076 × 10^23 per mole, so the only rounding is in the display.',
      },
      {
        question: 'Does the answer count atoms or molecules?',
        answer: 'It counts the particles named by the molar mass you entered, so a molar mass of water counts molecules, not atoms.',
      },
      {
        question: 'How do I find the number of atoms?',
        answer: 'Multiply the molecule count by the atoms per molecule, which the molar mass calculator reports.',
      },
    ],
    scenarios: rows(
      ['mass', 'mm'],
      [
        [9.0075, 18.015],
        [58.44, 58.44],
        [100, 180.156],
        [4, 2.016],
        [250, 100.087],
        [0.5, 44.01],
      ],
      (v) => `${v[0]} g at ${v[1]} g/mol`,
    ),
    relatedSlugs: ['molar-mass-calculator', 'molarity-calculator', 'theoretical-yield-calculator'],
    checks: [
      { inputs: {}, expect: { moles: '1 mol', particles: '6.022 × 10^23' } },
      { inputs: { mass: 36.03 }, expect: { moles: '2 mol', particles: '1.204 × 10^24' } },
      { inputs: { mass: 9.0075 }, expect: { moles: '0.5 mol', particles: '3.011 × 10^23' } },
    ],
  },
  {
    slug: 'mole-fraction-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Stoichiometry',
    title: 'Mole Fraction Calculator for Two-Component Mixtures',
    h1: 'Mole Fraction Calculator',
    metaDescription: 'Work out the mole fraction of each component in a two-component mixture from the moles of each substance.',
    about:
      "The mole fraction of a component is its moles divided by the total moles in the mixture, so the fractions of all components add to exactly one. Unlike molarity it does not depend on volume or temperature, which is why Raoult's law and Dalton's law of partial pressures are written with it. Enter the moles of substance A and substance B, and the calculator returns the fraction of each as a number between zero and one. Distillation columns, vapour pressure tables and alloy phase diagrams all quote composition this way, because the figure survives heating, compression and stirring. Fractions carry no unit, and a quick sanity check is that your two answers must sum to one; if they do not, an entry was mistyped.",
    inputs: [field('a', 'Moles of A', 2, 0, 1000000), field('b', 'Moles of B', 3, 0, 1000000)],
    outputs: [
      { name: 'xa', label: 'Mole fraction of A', format: 'text', highlight: true },
      { name: 'xb', label: 'Mole fraction of B', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.a);
      const b = toD(i.b);
      const total = a.plus(b);
      if (total.lte(0)) return { xa: 'Enter an amount above zero', xb: '-' };
      return { xa: fmtFixed(a.div(total), 4), xb: fmtFixed(b.div(total), 4) };
    },
    formulaDescription: 'xA = nA ÷ (nA + nB) and xB = nB ÷ (nA + nB), so xA + xB = 1.',
    workedExample: '2 mol of A and 3 mol of B make 5 mol in total, so xA = 2 ÷ 5 = 0.4000 and xB = 3 ÷ 5 = 0.6000.',
    faq: [
      { question: 'Does it matter which substance is A?', answer: 'No. The labels are interchangeable, and the two answers swap if you swap the inputs.' },
      { question: 'Can I get a percentage?', answer: 'Multiply the fraction by 100 to get mole percent.' },
      {
        question: 'What about three components?',
        answer: 'Divide each amount by the sum of all three. The two-component form is the same rule with one term fewer.',
      },
    ],
    scenarios: rows(
      ['a', 'b'],
      [
        [1, 1],
        [0.5, 4.5],
        [10, 2.5],
        [3, 7],
        [0.25, 0.75],
        [12, 1],
      ],
      (v) => `${v[0]} mol of A with ${v[1]} mol of B`,
    ),
    relatedSlugs: ['partial-pressure-calculator', 'molality-calculator'],
    checks: [
      { inputs: {}, expect: { xa: '0.4000', xb: '0.6000' } },
      { inputs: { a: 1, b: 1 }, expect: { xa: '0.5000', xb: '0.5000' } },
      { inputs: { a: 0, b: 0 }, expect: { xa: 'Enter an amount above zero' } },
    ],
  },
  {
    slug: 'percent-yield-calculator',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Reactions',
    title: 'Percent Yield Calculator: Actual Over Theoretical Yield',
    h1: 'Percent Yield Calculator',
    metaDescription: 'Compare the product you actually collected with the theoretical yield to get the percent yield of a reaction.',
    about:
      'Percent yield tells you how much of the product a reaction could have made you actually collected. It is the actual yield divided by the theoretical yield, times 100. Losses to side reactions, incomplete conversion and transfers keep it below 100%. A value above 100% usually means the product is still wet or contaminated. Enter both masses in the same unit, and use the theoretical yield calculator if you need to work that figure out first. Teaching labs grade on it, and process teams track it batch after batch to spot drift in a plant. Usual culprits for a poor figure are product left on filter paper, an incomplete reaction and washing losses, while a suspiciously high value after one recrystallisation deserves a second drying.',
    inputs: [field('actual', 'Actual yield (g)', 8.5, 0, 1000000000), field('theoretical', 'Theoretical yield (g)', 10, 0.0001, 1000000000)],
    outputs: [
      { name: 'yield', label: 'Percent yield', format: 'text', highlight: true },
      { name: 'comment', label: 'Reading', format: 'text' },
    ],
    calculate: (i) => {
      const pct = toD(i.actual).div(toD(i.theoretical)).mul(100);
      return {
        yield: fmtPercent(pct, 1),
        comment: pct.gt(100)
          ? 'Above 100%: check for solvent or impurities'
          : pct.gte(90)
            ? 'Excellent recovery'
            : pct.gte(60)
              ? 'Typical for a multi-step lab prep'
              : 'Low recovery: look for losses',
      };
    },
    formulaDescription: 'Percent yield = actual yield ÷ theoretical yield × 100.',
    workedExample: 'A reaction predicted to give 10 g of product that delivers 8.5 g has a percent yield of 8.5 ÷ 10 × 100 = 85.0%.',
    faq: [
      {
        question: 'Why can percent yield exceed 100%?',
        answer: 'Almost always because the product retained solvent or contains impurities. A true yield cannot exceed the theoretical one.',
      },
      { question: 'Do both yields need the same unit?', answer: 'Yes. Grams are usual, but moles work equally well if both are in moles.' },
      {
        question: 'What is a good percent yield?',
        answer: 'It depends on the reaction. Simple single steps can reach 90% or more, while multi-step syntheses often report far less.',
      },
    ],
    scenarios: rows(
      ['actual', 'theoretical'],
      [
        [12, 10],
        [4.2, 7],
        [0.9, 1.2],
        [45, 50],
        [3, 8],
        [19.8, 20],
      ],
      (v) => `${v[0]} g collected from ${v[1]} g expected`,
    ),
    introOutputs: ['yield'],
    relatedSlugs: ['theoretical-yield-calculator', 'grams-to-moles-calculator'],
    checks: [
      { inputs: {}, expect: { yield: '85.0%', comment: 'Typical for a multi-step lab prep' } },
      { inputs: { actual: 12, theoretical: 10 }, expect: { yield: '120.0%', comment: 'Above 100%: check for solvent or impurities' } },
      { inputs: { actual: 9.5 }, expect: { yield: '95.0%', comment: 'Excellent recovery' } },
    ],
  },
  {
    slug: 'theoretical-yield-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Reactions',
    title: 'Theoretical Yield Calculator from the Limiting Reagent',
    h1: 'Theoretical Yield Calculator',
    metaDescription: "Predict the maximum mass of product from the limiting reagent's mass, both molar masses and the mole ratio in the balanced equation.",
    about:
      "The theoretical yield is the most product a reaction can give if every molecule of the limiting reagent reacts. Convert the reagent's mass to moles, multiply by the mole ratio of product to reagent from the balanced equation, then convert the product moles back to grams. This calculator follows those three steps. You supply the masses, molar masses and the coefficient ratio, and it returns the product mass and the moles behind it.",
    inputs: [
      field('mass', 'Mass of limiting reagent (g)', 10, 0, 1000000000),
      field('mmReagent', 'Molar mass of reagent (g/mol)', 40, 0.1, 100000),
      field('mmProduct', 'Molar mass of product (g/mol)', 58.44, 0.1, 100000),
      field('ratio', 'Moles of product per mole of reagent', 1, 0.01, 1000),
    ],
    outputs: [
      { name: 'product', label: 'Theoretical yield', format: 'text', highlight: true },
      { name: 'moles', label: 'Moles of product', format: 'text' },
    ],
    calculate: (i) => {
      const moles = toD(i.mass).div(toD(i.mmReagent)).mul(toD(i.ratio));
      return { product: `${fmtNumber(moles.mul(toD(i.mmProduct)), 3)} g`, moles: `${fmtNumber(moles, 4)} mol` };
    },
    formulaDescription:
      'Product moles = (reagent mass ÷ reagent molar mass) × (product coefficient ÷ reagent coefficient). Yield = product moles × product molar mass.',
    workedExample: '10 g of a 40 g/mol reagent is 0.25 mol. With a 1:1 ratio that is 0.25 mol of product, and at 58.44 g/mol the yield is 14.61 g.',
    faq: [
      {
        question: 'How do I find the limiting reagent?',
        answer: 'Compute the product each reagent could make; the one giving less is limiting. Enter that reagent here.',
      },
      {
        question: 'Where does the mole ratio come from?',
        answer: 'From the coefficients in the balanced equation, product over reagent. Two products per reagent gives a ratio of 2.',
      },
      { question: 'How is this related to percent yield?', answer: 'Divide the mass you actually collect by this theoretical yield to get the percent yield.' },
    ],
    scenarios: rows(
      ['mass', 'mmReagent', 'mmProduct', 'ratio'],
      [
        [20, 40, 58.44, 1],
        [5, 2.016, 18.015, 1],
        [12, 24.305, 40.304, 1],
        [8, 100.087, 56.077, 1],
        [3.5, 32.06, 98.072, 1],
        [15, 63.546, 143.09, 0.5],
      ],
      (v) => `${v[0]} g of a ${v[1]} g/mol reagent, ratio ${v[3]}`,
    ),
    introOutputs: ['product'],
    relatedSlugs: ['percent-yield-calculator', 'grams-to-moles-calculator', 'molar-mass-calculator'],
    checks: [
      { inputs: {}, expect: { product: '14.61 g', moles: '0.25 mol' } },
      { inputs: { ratio: 2 }, expect: { product: '29.22 g', moles: '0.5 mol' } },
      { inputs: { mass: 20 }, expect: { product: '29.22 g' } },
    ],
  },
  {
    slug: 'boiling-point-elevation-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Colligative properties',
    title: 'Boiling Point Elevation Calculator: ΔTb = i × Kb × m',
    h1: 'Boiling Point Elevation Calculator',
    metaDescription: "Calculate how far a dissolved solute raises a solvent's boiling point from the ebullioscopic constant, molality and van't Hoff factor.",
    about:
      "Dissolving a non-volatile solute in a liquid raises the temperature at which it boils. The rise depends on how many dissolved particles there are, not what they are, which is why it is a colligative property. It equals the van't Hoff factor times the solvent's ebullioscopic constant times the molality. Water's constant is 0.512 °C·kg/mol and the factor for table salt is about 2. Enter the base boiling point if your solvent is not water. Cooks notice how little a handful of salt changes the pasta pot, while engineers use the effect to size cooling circuits and desalination plants. Typical constants are 0.512 for water, 2.53 for benzene and 3.07 for acetic acid, and handbooks list a value for each common solvent.",
    inputs: [
      field('kb', 'Ebullioscopic constant Kb (°C·kg/mol)', 0.512, 0.01, 100),
      field('molality', 'Molality (mol/kg)', 1, 0, 100),
      field('i', "van't Hoff factor i", 2, 1, 10),
      field('base', 'Solvent boiling point (°C)', 100, -100, 500),
    ],
    outputs: [
      { name: 'rise', label: 'Boiling point rise', format: 'text', highlight: true },
      { name: 'boil', label: 'New boiling point', format: 'text' },
    ],
    calculate: (i) => {
      const rise = toD(i.i).mul(toD(i.kb)).mul(toD(i.molality));
      return { rise: `${fmtFixed(rise, 2)} °C`, boil: `${fmtFixed(toD(i.base).plus(rise), 2)} °C` };
    },
    formulaDescription: 'ΔTb = i × Kb × m, where m is molality in mol/kg. New boiling point = pure solvent boiling point + ΔTb.',
    workedExample: 'A 1 mol/kg salt solution in water: i = 2, Kb = 0.512, so ΔTb = 2 × 0.512 × 1 = 1.024 °C and water boils at about 101.02 °C.',
    faq: [
      {
        question: "What is the van't Hoff factor?",
        answer: 'The number of particles one formula unit gives in solution: about 1 for sugar, about 2 for NaCl and about 3 for CaCl2.',
      },
      { question: 'Why is the effect so small?', answer: 'Kb is a small number, so ordinary salt in water raises the boiling point by only a degree or so.' },
      {
        question: 'Does it work for concentrated solutions?',
        answer: 'The formula is accurate for dilute solutions. Strong solutions deviate because ions interact.',
      },
    ],
    scenarios: rows(
      ['kb', 'molality', 'i', 'base'],
      [
        [0.512, 0.5, 1, 100],
        [0.512, 2, 3, 100],
        [2.53, 1, 1, 80.1],
        [3.07, 0.8, 1, 118.1],
        [2.36, 1.5, 1, 61.2],
        [0.512, 0.1, 2, 100],
      ],
      (v) => `Kb ${v[0]}, ${v[1]} mol/kg, i = ${v[2]}`,
    ),
    introOutputs: ['rise'],
    relatedSlugs: ['freezing-point-depression-calculator', 'molality-calculator', 'osmotic-pressure-calculator'],
    checks: [
      { inputs: {}, expect: { rise: '1.02 °C', boil: '101.02 °C' } },
      { inputs: { i: 1, molality: 0.5 }, expect: { rise: '0.26 °C', boil: '100.26 °C' } },
      { inputs: { kb: 2.53, base: 80.1, molality: 1, i: 1 }, expect: { rise: '2.53 °C', boil: '82.63 °C' } },
    ],
  },
  {
    slug: 'freezing-point-depression-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Colligative properties',
    title: 'Freezing Point Depression Calculator: ΔTf = i × Kf × m',
    h1: 'Freezing Point Depression Calculator',
    metaDescription: "Find how much a solute lowers a solvent's freezing point from the cryoscopic constant, molality and van't Hoff factor.",
    about:
      "A solute lowers the temperature at which a liquid freezes, which is why salt is spread on icy roads and antifreeze protects engines. The drop is the van't Hoff factor times the cryoscopic constant of the solvent times the molality. For water the constant is 1.86 °C·kg/mol. This tool returns the size of the drop and the new freezing point. Change the solvent's normal freezing point and constant to work with benzene, camphor or any other liquid. Road crews, ice cream makers and biologists preserving samples all exploit the same drop, and deicing brines are chosen partly because calcium chloride delivers three particles per formula unit. Typical constants are 1.86 for water, 5.12 for benzene and 39.7 for camphor, which is why camphor became a classic choice in molar mass experiments.",
    inputs: [
      field('kf', 'Cryoscopic constant Kf (°C·kg/mol)', 1.86, 0.01, 100),
      field('molality', 'Molality (mol/kg)', 1, 0, 100),
      field('i', "van't Hoff factor i", 2, 1, 10),
      field('base', 'Solvent freezing point (°C)', 0, -200, 500),
    ],
    outputs: [
      { name: 'drop', label: 'Freezing point drop', format: 'text', highlight: true },
      { name: 'freeze', label: 'New freezing point', format: 'text' },
    ],
    calculate: (i) => {
      const drop = toD(i.i).mul(toD(i.kf)).mul(toD(i.molality));
      return { drop: `${fmtFixed(drop, 2)} °C`, freeze: `${fmtFixed(toD(i.base).minus(drop), 2)} °C` };
    },
    formulaDescription: 'ΔTf = i × Kf × m. New freezing point = pure solvent freezing point − ΔTf.',
    workedExample: 'One mol/kg of NaCl in water: i = 2, Kf = 1.86, so ΔTf = 2 × 1.86 × 1 = 3.72 °C and the solution freezes at about −3.72 °C.',
    faq: [
      {
        question: 'Why does salt melt ice?',
        answer:
          'Dissolved salt lowers the freezing point of the thin water film on the ice, so the ice melts until the film is saturated or the temperature is too low.',
      },
      {
        question: 'Is there a limit to how low it can go?',
        answer: 'Yes. Salt water reaches a eutectic point near −21 °C, below which this dilute formula no longer applies.',
      },
      {
        question: 'How is it linked to boiling point elevation?',
        answer: "Both depend on particle count through the same molality and van't Hoff factor, with a different constant for each solvent.",
      },
    ],
    scenarios: rows(
      ['kf', 'molality', 'i', 'base'],
      [
        [1.86, 0.5, 1, 0],
        [1.86, 3, 2, 0],
        [5.12, 1, 1, 5.5],
        [1.86, 0.25, 3, 0],
        [39.7, 0.4, 1, 178.8],
        [1.86, 5, 2, 0],
      ],
      (v) => `Kf ${v[0]}, ${v[1]} mol/kg, i = ${v[2]}`,
    ),
    introOutputs: ['freeze'],
    relatedSlugs: ['boiling-point-elevation-calculator', 'molality-calculator', 'osmotic-pressure-calculator'],
    checks: [
      { inputs: {}, expect: { drop: '3.72 °C', freeze: '-3.72 °C' } },
      { inputs: { i: 1, molality: 0.5 }, expect: { drop: '0.93 °C', freeze: '-0.93 °C' } },
      { inputs: { kf: 5.12, base: 5.5, molality: 1, i: 1 }, expect: { drop: '5.12 °C', freeze: '0.38 °C' } },
    ],
  },
  {
    slug: 'gibbs-free-energy-calculator',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Thermodynamics',
    title: 'Gibbs Free Energy Calculator: ΔG = ΔH − TΔS',
    h1: 'Gibbs Free Energy Calculator',
    metaDescription: 'Find ΔG from enthalpy change, temperature and entropy change, see whether a reaction is spontaneous and the temperature where it flips.',
    about:
      'The Gibbs free energy change decides whether a process can run by itself at constant temperature and pressure. A negative ΔG means spontaneous, a positive ΔG means it needs energy input, and zero means equilibrium. It balances the enthalpy change against the entropy change scaled by temperature. Enter ΔH in kilojoules per mole, the temperature in kelvin and ΔS in joules per mole per kelvin; the unit mismatch is handled for you.',
    inputs: [
      field('dh', 'Enthalpy change ΔH (kJ/mol)', -92.2, -100000, 100000),
      field('t', 'Temperature (K)', 298.15, 1, 10000),
      field('ds', 'Entropy change ΔS (J/mol·K)', -198.7, -10000, 10000),
    ],
    outputs: [
      { name: 'dg', label: 'Gibbs free energy change', format: 'text', highlight: true },
      { name: 'verdict', label: 'At this temperature', format: 'text' },
      { name: 'cross', label: 'Switch-over temperature', format: 'text' },
    ],
    calculate: (i) => {
      const dh = toD(i.dh);
      const ds = toD(i.ds);
      const dg = dh.minus(toD(i.t).mul(ds).div(1000));
      const cross = ds.isZero() ? null : dh.mul(1000).div(ds);
      return {
        dg: `${fmtNumber(dg, 2)} kJ/mol`,
        verdict: dg.isZero() ? 'At equilibrium' : dg.lt(0) ? 'Spontaneous' : 'Not spontaneous',
        cross: cross && cross.gt(0) ? `${fmtNumber(cross, 1)} K` : 'None above 0 K',
      };
    },
    formulaDescription: 'ΔG = ΔH − T × ΔS, with ΔS converted from J to kJ. The sign of ΔG sets spontaneity; ΔG = 0 at T = ΔH ÷ ΔS.',
    workedExample:
      'Ammonia synthesis: ΔH = −92.2 kJ/mol, ΔS = −198.7 J/mol·K at 298.15 K. TΔS = −59.24 kJ/mol, so ΔG = −92.2 + 59.24 = −32.96 kJ/mol. The reaction is spontaneous, but turns non-spontaneous above about 464 K.',
    faq: [
      {
        question: 'Does spontaneous mean fast?',
        answer: 'No. Spontaneous only says the reaction is allowed thermodynamically. Its speed depends on kinetics and may be extremely slow.',
      },
      {
        question: 'Why does temperature matter?',
        answer:
          'The entropy term is multiplied by T, so a reaction with positive ΔS becomes more favourable as it gets hotter, and one with negative ΔS less so.',
      },
      {
        question: 'Why are the units different for H and S?',
        answer: 'Tables list enthalpy in kJ/mol and entropy in J/mol·K. The tool divides the entropy term by 1,000 so they combine correctly.',
      },
    ],
    scenarios: rows(
      ['dh', 't', 'ds'],
      [
        [10, 300, 50],
        [40, 300, 50],
        [15, 300, 50],
        [-50, 350, -120],
        [178.3, 1000, 160.5],
        [-285.8, 298.15, -163.3],
      ],
      (v) => `ΔH ${v[0]} kJ, ${v[1]} K, ΔS ${v[2]} J/K`,
    ),
    introOutputs: ['dg', 'verdict'],
    relatedSlugs: ['half-life-calculator', 'nernst-equation-calculator'],
    checks: [
      { inputs: {}, expect: { dg: '-32.96 kJ/mol', verdict: 'Spontaneous', cross: '464 K' } },
      { inputs: { dh: 10, t: 300, ds: 50 }, expect: { dg: '-5 kJ/mol', verdict: 'Spontaneous', cross: '200 K' } },
      { inputs: { dh: 40, t: 300, ds: 50 }, expect: { dg: '25 kJ/mol', verdict: 'Not spontaneous', cross: '800 K' } },
      { inputs: { dh: 15, t: 300, ds: 50 }, expect: { dg: '0 kJ/mol', verdict: 'At equilibrium' } },
    ],
  },
  {
    slug: 'half-life-calculator',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Physical chemistry',
    title: 'Half-Life Calculator: Amount Remaining After Decay',
    h1: 'Half-Life Calculator',
    metaDescription: 'Find how much of a substance is left after a given time from its starting amount and half-life, plus the decay constant.',
    about:
      'The half-life is the time it takes for half of a decaying quantity to disappear, whether that is a radioactive isotope, a drug in the blood or a reactant in a first-order reaction. After each half-life the remainder is halved again, so the amount left follows a simple exponential. Enter the starting amount, the half-life and the elapsed time in any consistent unit. The calculator returns the amount left, the fraction remaining and the decay constant.',
    inputs: [
      field('n0', 'Starting amount', 100, 0, 1000000000),
      field('half', 'Half-life', 10, 0.000001, 1000000000),
      field('time', 'Elapsed time', 30, 0, 1000000000),
    ],
    outputs: [
      { name: 'remaining', label: 'Amount remaining', format: 'text', highlight: true },
      { name: 'fraction', label: 'Fraction remaining', format: 'text' },
      { name: 'periods', label: 'Half-lives elapsed', format: 'text' },
      { name: 'lambda', label: 'Decay constant', format: 'text' },
    ],
    calculate: (i) => {
      const half = toD(i.half);
      const periods = toD(i.time).div(half);
      const fraction = new D('0.5').pow(periods);
      return {
        remaining: fmtNumber(toD(i.n0).mul(fraction), 4),
        fraction: fmtPercent(fraction.mul(100), 1),
        periods: fmtNumber(periods, 3),
        lambda: fmtSig(new D(2).ln().div(half), 4, false),
      };
    },
    formulaDescription: 'N(t) = N0 × (1/2)^(t ÷ t½). The decay constant λ = ln 2 ÷ t½, and N(t) = N0 × e^(−λt).',
    workedExample:
      'Start with 100 units and a half-life of 10. After 30 time units three half-lives have passed, so 100 × (1/2)^3 = 12.5 remains, which is 12.5% of the original.',
    faq: [
      { question: 'Does the unit of time matter?', answer: 'Only that the half-life and the elapsed time use the same unit. Days, years or seconds all work.' },
      { question: 'Will the amount ever reach zero?', answer: 'Mathematically no: it halves forever. In practice the last atom decays at some point.' },
      {
        question: 'How does this relate to first-order kinetics?',
        answer: 'A first-order reaction has a constant half-life, t½ = ln 2 ÷ k, so the same formula applies with k as the rate constant.',
      },
    ],
    scenarios: rows(
      ['n0', 'half', 'time'],
      [
        [80, 2, 6],
        [500, 5730, 11460],
        [1, 8.02, 24],
        [250, 3.8, 10],
        [1000, 30, 45],
        [64, 1.5, 9],
      ],
      (v) => `${v[0]} units, half-life ${v[1]}, after ${v[2]}`,
    ),
    introOutputs: ['remaining', 'fraction'],
    relatedSlugs: ['gibbs-free-energy-calculator', 'serial-dilution-calculator'],
    checks: [
      { inputs: {}, expect: { remaining: '12.5', fraction: '12.5%', periods: '3', lambda: '0.06931' } },
      { inputs: { time: 10 }, expect: { remaining: '50', fraction: '50.0%' } },
      { inputs: { n0: 80, half: 2, time: 6 }, expect: { remaining: '10' } },
      { inputs: { time: 0 }, expect: { remaining: '100', fraction: '100.0%' } },
    ],
  },
  {
    slug: 'partial-pressure-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Physical chemistry',
    title: "Partial Pressure Calculator Using Dalton's Law",
    h1: 'Partial Pressure Calculator',
    metaDescription: "Use Dalton's law to find the partial pressure of one gas in a mixture from its moles, the total moles and the total pressure.",
    about:
      "In a mixture of ideal gases each gas contributes a partial pressure equal to what it would exert alone in the same container, and the partial pressures add up to the total. Dalton's law lets you find one of them from the mole fraction: multiply the total pressure by the moles of the gas over the total moles. Enter any pressure unit for the total and the answer comes back in the same unit. It is the basis of gas collection over water and of diving gas planning. Divers check oxygen's partial pressure against a working ceiling of about 1.4 bar, and chemists correct a gas collected over water by subtracting the vapour pressure of the water. Air at sea level is roughly 21% oxygen, so oxygen's partial pressure there is about 21 kPa.",
    inputs: [
      field('total', 'Total pressure (kPa)', 100, 0, 1000000),
      field('n', 'Moles of the gas', 2, 0, 1000000),
      field('all', 'Total moles of all gases', 5, 0.000001, 1000000),
    ],
    outputs: [
      { name: 'partial', label: 'Partial pressure', format: 'text', highlight: true },
      { name: 'fraction', label: 'Mole fraction', format: 'text' },
    ],
    calculate: (i) => {
      const n = toD(i.n);
      const all = toD(i.all);
      if (n.gt(all)) return { partial: 'Moles of the gas cannot exceed the total moles', fraction: '-' };
      const x = n.div(all);
      return { partial: `${fmtNumber(toD(i.total).mul(x), 3)} kPa`, fraction: fmtFixed(x, 4) };
    },
    formulaDescription: "Pi = xi × Ptotal, with xi = ni ÷ ntotal. The partial pressures of all components sum to Ptotal (Dalton's law).",
    workedExample:
      'A mixture at 100 kPa holds 5 mol of gas in total, 2 mol of which is the gas of interest. Its mole fraction is 0.4, so its partial pressure is 0.4 × 100 = 40 kPa.',
    faq: [
      {
        question: 'Does the law work for real gases?',
        answer: 'It is accurate at low to moderate pressures. At high pressure gas molecules interact and the partial pressures no longer add exactly.',
      },
      {
        question: 'Is the answer in kPa only?',
        answer: 'The label says kPa because that is the unit entered for the total. Use the same unit throughout and the answer follows it.',
      },
      {
        question: 'How is this related to mole fraction?',
        answer: 'Partial pressure is the mole fraction times the total pressure, so it is a direct scaling of the mole fraction.',
      },
    ],
    scenarios: rows(
      ['total', 'n', 'all'],
      [
        [200, 1, 4],
        [101.325, 0.78, 1],
        [50, 3, 6],
        [760, 0.21, 1],
        [300, 2.5, 10],
        [120, 4, 4],
      ],
      (v) => `${v[0]} kPa total, ${v[1]} of ${v[2]} mol`,
    ),
    introOutputs: ['partial'],
    relatedSlugs: ['mole-fraction-calculator', 'osmotic-pressure-calculator'],
    checks: [
      { inputs: {}, expect: { partial: '40 kPa', fraction: '0.4000' } },
      { inputs: { total: 200, n: 1, all: 4 }, expect: { partial: '50 kPa' } },
      { inputs: { n: 6, all: 5 }, expect: { partial: 'Moles of the gas cannot exceed the total moles' } },
    ],
  },
  {
    slug: 'osmotic-pressure-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Colligative properties',
    title: "Osmotic Pressure Calculator: van't Hoff Equation Π = iMRT",
    h1: 'Osmotic Pressure Calculator',
    metaDescription: "Calculate the osmotic pressure of a solution in atm and kPa from molarity, temperature and the van't Hoff factor.",
    about:
      "Osmotic pressure is the pressure that must be applied to a solution to stop pure solvent flowing into it through a semipermeable membrane. For dilute solutions the van't Hoff equation gives it as the van't Hoff factor times the molarity times the gas constant times the absolute temperature. It explains why cells swell in pure water and why reverse osmosis needs strong pumps. Enter the temperature in kelvin, which is the Celsius value plus 273.15.",
    inputs: [field('m', 'Molarity (mol/L)', 0.1, 0, 100), field('t', 'Temperature (K)', 298.15, 1, 1000), field('i', "van't Hoff factor i", 1, 1, 10)],
    outputs: [
      { name: 'atm', label: 'Osmotic pressure', format: 'text', highlight: true },
      { name: 'kpa', label: 'In kilopascals', format: 'text' },
    ],
    calculate: (i) => {
      const atm = toD(i.i).mul(toD(i.m)).mul('0.082057').mul(toD(i.t));
      return { atm: `${fmtFixed(atm, 2)} atm`, kpa: `${fmtFixed(atm.mul('101.325'), 2)} kPa` };
    },
    formulaDescription: 'Π = i × M × R × T, with R = 0.082057 L·atm/(mol·K). One atmosphere is 101.325 kPa.',
    workedExample: 'A 0.1 mol/L non-electrolyte solution at 298.15 K: Π = 1 × 0.1 × 0.082057 × 298.15 = 2.45 atm, or 247.89 kPa.',
    faq: [
      {
        question: 'Why does it use the gas constant?',
        answer: "For dilute solutions the dissolved particles behave like a gas filling the solution's volume, so Π has the same form as the ideal gas law.",
      },
      {
        question: "What is the van't Hoff factor here?",
        answer: 'The number of particles per formula unit: 1 for glucose, about 2 for NaCl. Real salts give slightly less at higher concentration.',
      },
      { question: 'Is the temperature in Celsius?', answer: 'No, kelvin. Add 273.15 to a Celsius reading.' },
    ],
    scenarios: rows(
      ['m', 't', 'i'],
      [
        [1, 273.15, 1],
        [0.15, 310.15, 2],
        [0.5, 298.15, 1],
        [0.02, 283.15, 3],
        [2, 350, 1],
        [0.9, 300, 2],
      ],
      (v) => `${v[0]} mol/L at ${v[1]} K, i = ${v[2]}`,
    ),
    introOutputs: ['atm'],
    relatedSlugs: ['boiling-point-elevation-calculator', 'freezing-point-depression-calculator', 'partial-pressure-calculator'],
    checks: [
      { inputs: {}, expect: { atm: '2.45 atm', kpa: '247.89 kPa' } },
      { inputs: { i: 2 }, expect: { atm: '4.89 atm', kpa: '495.79 kPa' } },
      { inputs: { m: 1, t: 273.15 }, expect: { atm: '22.41 atm' } },
    ],
  },
  {
    slug: 'nernst-equation-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Electrochemistry',
    title: 'Nernst Equation Calculator: Cell Potential Under Real Conditions',
    h1: 'Nernst Equation Calculator',
    metaDescription: 'Adjust a standard cell potential for temperature and the reaction quotient with the Nernst equation, and see the shift from standard.',
    about:
      "Standard cell potentials are measured with every species at one molar. Real cells rarely work that way, so the Nernst equation corrects the potential for the actual composition through the reaction quotient Q, and for temperature. The correction is the gas constant times the temperature over the number of electrons times Faraday's constant, multiplied by the natural log of Q. Enter the standard potential, the electrons transferred, temperature and Q.",
    inputs: [
      field('e0', 'Standard potential E° (V)', 1.1, -10, 10),
      field('n', 'Electrons transferred n', 2, 1, 20),
      field('t', 'Temperature (K)', 298.15, 1, 1000),
      field('q', 'Reaction quotient Q', 10, 0.000000000001, 1000000000000),
    ],
    outputs: [
      { name: 'e', label: 'Cell potential', format: 'text', highlight: true },
      { name: 'shift', label: 'Shift from standard', format: 'text' },
    ],
    calculate: (i) => {
      const e0 = toD(i.e0);
      const term = R_GAS.mul(toD(i.t)).div(toD(i.n).mul(FARADAY)).mul(toD(i.q).ln());
      const e = e0.minus(term);
      return { e: `${fmtFixed(e, 3)} V`, shift: `${fmtFixed(e.minus(e0), 3)} V` };
    },
    formulaDescription: 'E = E° − (R × T ÷ (n × F)) × ln Q, with R = 8.314462618 J/(mol·K) and F = 96485.33212 C/mol.',
    workedExample:
      'The zinc-copper cell, E° = 1.10 V, n = 2, at 298.15 K with Q = 10: the correction is 0.012846 × 2.3026 = 0.0296 V, so E = 1.10 − 0.0296 = 1.070 V.',
    faq: [
      { question: 'What happens when Q equals 1?', answer: 'The log term is zero, so the cell potential equals the standard potential.' },
      {
        question: 'What does a Q above 1 mean?',
        answer: 'There is more product than at standard conditions, which lowers the potential. As Q approaches the equilibrium constant, E falls to zero.',
      },
      {
        question: 'Why is there a 0.0592 in some textbooks?',
        answer: 'It is the same equation at 25 °C with the natural log converted to base 10: 0.0592 ÷ n × log10 Q.',
      },
    ],
    scenarios: rows(
      ['e0', 'n', 't', 'q'],
      [
        [1.1, 2, 298.15, 1],
        [1.1, 2, 298.15, 0.1],
        [1.1, 2, 298.15, 100],
        [0.34, 2, 310.15, 0.05],
        [0.8, 1, 298.15, 1000],
        [-0.76, 2, 323.15, 0.2],
      ],
      (v) => `E° ${v[0]} V, n = ${v[1]}, ${v[2]} K, Q = ${v[3]}`,
    ),
    introOutputs: ['e'],
    relatedSlugs: ['gibbs-free-energy-calculator', 'half-life-calculator'],
    checks: [
      { inputs: {}, expect: { e: '1.070 V', shift: '-0.030 V' } },
      { inputs: { q: 1 }, expect: { e: '1.100 V', shift: '0.000 V' } },
      { inputs: { q: 0.1 }, expect: { e: '1.130 V' } },
      { inputs: { q: 100 }, expect: { e: '1.041 V' } },
    ],
  },
  {
    slug: 'beer-lambert-law-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Spectroscopy',
    title: 'Beer-Lambert Law Calculator: Absorbance and Transmittance',
    h1: 'Beer-Lambert Law Calculator',
    metaDescription: 'Calculate absorbance and percent transmittance from molar absorptivity, path length and concentration using the Beer-Lambert law.',
    about:
      'A spectrophotometer measures how much light a sample absorbs, and the Beer-Lambert law links that absorbance to concentration. Absorbance is the molar absorptivity of the substance at the chosen wavelength, times the path length of the cuvette, times the concentration. Transmittance is the fraction of light that passes through, ten to the minus absorbance. Readings above about 1.5 are unreliable on most instruments, so dilute strongly coloured samples first.',
    inputs: [
      field('epsilon', 'Molar absorptivity ε (L/mol·cm)', 1000, 0, 10000000),
      field('length', 'Path length (cm)', 1, 0.001, 1000),
      field('c', 'Concentration (mol/L)', 0.0005, 0, 100),
    ],
    outputs: [
      { name: 'abs', label: 'Absorbance', format: 'text', highlight: true },
      { name: 'trans', label: 'Transmittance', format: 'text' },
    ],
    calculate: (i) => {
      const a = toD(i.epsilon).mul(toD(i.length)).mul(toD(i.c));
      return { abs: fmtFixed(a, 3), trans: fmtPercent(new D(10).pow(a.neg()).mul(100), 2) };
    },
    formulaDescription: 'A = ε × l × c, and transmittance T = 10^(−A). Percent transmittance = T × 100.',
    workedExample: 'ε = 1,000 L/mol·cm, a 1 cm cuvette and 0.0005 mol/L give A = 0.500. Transmittance is 10^-0.5 = 0.3162, or 31.62%.',
    faq: [
      { question: 'Why is absorbance unitless?', answer: 'It is a logarithm of a ratio of light intensities, so the units of ε, l and c cancel.' },
      {
        question: 'When does the law fail?',
        answer:
          'At high concentrations, with scattering samples, or when the light is not monochromatic. Absorbance stops being proportional to concentration.',
      },
      {
        question: 'How do I find ε?',
        answer:
          'Measure the absorbance of a known concentration, then divide by path length and concentration. Literature tables also list values per wavelength.',
      },
    ],
    scenarios: rows(
      ['epsilon', 'length', 'c'],
      [
        [1000, 1, 0.001],
        [1000, 1, 0.002],
        [6220, 1, 0.0001],
        [15000, 0.5, 0.00004],
        [250, 2, 0.003],
        [34000, 1, 0.00002],
      ],
      (v) => `ε ${v[0]}, ${v[1]} cm, ${v[2]} mol/L`,
    ),
    introOutputs: ['abs', 'trans'],
    relatedSlugs: ['molarity-calculator', 'dilution-calculator'],
    checks: [
      { inputs: {}, expect: { abs: '0.500', trans: '31.62%' } },
      { inputs: { c: 0.001 }, expect: { abs: '1.000', trans: '10.00%' } },
      { inputs: { c: 0.002 }, expect: { abs: '2.000', trans: '1.00%' } },
    ],
  },
  {
    slug: 'mass-percent-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions and concentration',
    title: 'Mass Percent Calculator: Percent by Mass of a Solute in a Solution',
    h1: 'Mass Percent Calculator',
    metaDescription: 'Find the mass percent of a solute from the mass of solute and the mass of solvent, along with the mass of the whole solution.',
    about:
      'Mass percent expresses concentration as the mass of solute per 100 units of total solution mass, which is the unit printed on bleach, vinegar and saline labels. Add the solute and solvent masses to get the solution mass, then divide the solute mass by it. Because it uses mass on both sides, it does not change with temperature. Enter both masses in the same unit and the result needs no conversion. Many cleaning and food products state strength this way, so it lets you check a label against what you mixed. Mass percent is not volume percent, and the two differ whenever solute and solvent have different densities, so do not swap one for the other in a recipe.',
    inputs: [field('solute', 'Mass of solute (g)', 10, 0, 1000000000), field('solvent', 'Mass of solvent (g)', 90, 0.0001, 1000000000)],
    outputs: [
      { name: 'pct', label: 'Mass percent', format: 'text', highlight: true },
      { name: 'total', label: 'Mass of solution', format: 'text' },
    ],
    calculate: (i) => {
      const solute = toD(i.solute);
      const total = solute.plus(toD(i.solvent));
      return { pct: fmtPercent(solute.div(total).mul(100), 2), total: `${fmtNumber(total, 3)} g` };
    },
    formulaDescription: 'Mass percent = mass of solute ÷ (mass of solute + mass of solvent) × 100.',
    workedExample: '10 g of salt in 90 g of water makes 100 g of solution, so the mass percent is 10 ÷ 100 × 100 = 10.00%.',
    faq: [
      { question: 'Is mass percent the same as weight percent?', answer: 'Yes. "Weight percent" and "w/w" are older names for the same ratio.' },
      { question: 'Why add the solute to the solvent?', answer: 'The denominator is the whole solution, not just the solvent.' },
      {
        question: 'How do I turn mass percent into molarity?',
        answer: "You also need the solution's density and the solute's molar mass; the molarity calculator covers the last step.",
      },
    ],
    scenarios: rows(
      ['solute', 'solvent'],
      [
        [5, 45],
        [25, 75],
        [1, 3],
        [36, 64],
        [0.9, 99.1],
        [12.5, 37.5],
      ],
      (v) => `${v[0]} g solute in ${v[1]} g solvent`,
    ),
    relatedSlugs: ['molarity-calculator', 'dilution-calculator', 'molality-calculator'],
    checks: [
      { inputs: {}, expect: { pct: '10.00%', total: '100 g' } },
      { inputs: { solute: 36, solvent: 64 }, expect: { pct: '36.00%' } },
      { inputs: { solute: 1, solvent: 3 }, expect: { pct: '25.00%', total: '4 g' } },
    ],
  },
  {
    slug: 'henderson-hasselbalch-calculator',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Acids and bases',
    title: 'Henderson-Hasselbalch Calculator for Buffer pH',
    h1: 'Henderson-Hasselbalch Calculator',
    metaDescription: 'Estimate the pH of a buffer from the pKa of the acid and the concentrations of its conjugate base and the acid.',
    about:
      "A buffer resists changes in pH because it holds a weak acid and its conjugate base together. The Henderson-Hasselbalch equation gives its pH from the acid's pKa and the ratio of base to acid concentrations: when the two are equal, the pH equals the pKa. Pick an acid whose pKa is within one unit of the pH you need, then adjust the ratio. The equation is an approximation that works best for concentrations well above 0.001 mol/L.",
    inputs: [
      field('pka', 'pKa of the acid', 4.76, -2, 16),
      field('base', 'Conjugate base concentration (mol/L)', 0.1, 0.000001, 100),
      field('acid', 'Acid concentration (mol/L)', 0.1, 0.000001, 100),
    ],
    outputs: [
      { name: 'ph', label: 'Buffer pH', format: 'text', highlight: true },
      { name: 'ratio', label: 'Base to acid ratio', format: 'text' },
    ],
    calculate: (i) => {
      const ratio = toD(i.base).div(toD(i.acid));
      return { ph: fmtFixed(toD(i.pka).plus(ratio.log(10)), 2), ratio: fmtSig(ratio, 4, false) };
    },
    formulaDescription: 'pH = pKa + log10([A−] ÷ [HA]), where [A−] is the conjugate base and [HA] the weak acid.',
    workedExample:
      'An acetate buffer (pKa 4.76) with equal base and acid has pH 4.76. With ten times more base the ratio is 10, log10 10 = 1, so the pH is 5.76.',
    faq: [
      {
        question: 'What makes a buffer most effective?',
        answer: 'It resists change best when pH is within one unit of the pKa, where both forms are present in useful amounts.',
      },
      {
        question: 'Does adding water change the pH?',
        answer: 'Only the ratio matters in this equation, so dilution leaves the pH almost unchanged, though buffer capacity falls.',
      },
      { question: 'Where do I find the pKa?', answer: 'Tables of weak acids list it; acetic acid is 4.76 and the ammonium ion is 9.25 at 25 °C.' },
    ],
    scenarios: rows(
      ['pka', 'base', 'acid'],
      [
        [4.76, 1, 0.1],
        [4.76, 0.01, 0.1],
        [7.21, 0.15, 0.1],
        [9.25, 0.2, 0.5],
        [6.35, 0.05, 0.05],
        [3.86, 0.3, 0.06],
      ],
      (v) => `pKa ${v[0]}, base ${v[1]}, acid ${v[2]}`,
    ),
    introOutputs: ['ph'],
    relatedSlugs: ['ph-calculator', 'molarity-calculator'],
    checks: [
      { inputs: {}, expect: { ph: '4.76', ratio: '1' } },
      { inputs: { base: 1 }, expect: { ph: '5.76', ratio: '10' } },
      { inputs: { base: 0.01 }, expect: { ph: '3.76', ratio: '0.1' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
