import { D, toD, type Dec } from '../lib/decimal';
import { fmtFixed, fmtNumber, fmtPercent } from '../lib/format';
import { fmtSig } from '../lib/gen-utils';
import { defineCalculator, type Spec } from '../lib/spec';
import { field, intField, rows, sci } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 2 (chemistry): solution recipes, kinetics, equilibrium and thermodynamics, electrochemistry,
 * molecular structure and gases. Every formula, sentence and number is written for this site.
 * Constants: R = 8.314462618 J/(mol K), F = 96485.33212 C/mol (CODATA 2018). All pages are tier 2 or 3, so none is
 * live until the cohort gate opens.
 */

const R_GAS = new D('8.314462618');
const FARADAY = new D('96485.33212');
const LN2 = new D(2).ln();

/** An equilibrium constant reads better as a plain number in the middle range and in powers of ten outside it. */
const fmtK = (k: Dec): string => (k.gte('0.001') && k.lt(10000) ? fmtSig(k, 4, false) : sci(k, 3));

export const SPECS: Spec[] = [
  {
    slug: 'average-atomic-mass-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Atoms and elements',
    title: 'Average Atomic Mass Calculator from Isotope Abundances',
    h1: 'Average Atomic Mass Calculator',
    metaDescription: 'Weight up to three isotope masses by their natural abundances to get the average atomic mass printed on the periodic table.',
    about:
      "The atomic mass on the periodic table is not the mass of any single atom. It is a weighted average over the element's naturally occurring isotopes, each mass counted in proportion to how common it is. Chlorine is about three quarters chlorine-35 and one quarter chlorine-37, which is why its tabulated mass sits near 35.45. Enter up to three isotope masses in atomic mass units with their abundances in percent, which must total 100, and the weighted mean follows.",
    inputs: [
      field('m1', 'Isotope 1 mass (u)', 34.96885, 0, 300),
      field('a1', 'Isotope 1 abundance (%)', 75.76, 0, 100),
      field('m2', 'Isotope 2 mass (u)', 36.9659, 0, 300),
      field('a2', 'Isotope 2 abundance (%)', 24.24, 0, 100),
      field('m3', 'Isotope 3 mass (u)', 0, 0, 300),
      field('a3', 'Isotope 3 abundance (%)', 0, 0, 100),
    ],
    outputs: [
      { name: 'avg', label: 'Average atomic mass', format: 'text', highlight: true },
      { name: 'total', label: 'Abundances add up to', format: 'text' },
    ],
    calculate: (i) => {
      const total = toD(i.a1).plus(toD(i.a2)).plus(toD(i.a3));
      if (!total.eq(100)) return { avg: `Abundances add up to ${fmtNumber(total, 2)}, not 100`, total: `${fmtNumber(total, 2)}%` };
      const sum = toD(i.m1)
        .mul(toD(i.a1))
        .plus(toD(i.m2).mul(toD(i.a2)))
        .plus(toD(i.m3).mul(toD(i.a3)));
      return { avg: `${fmtFixed(sum.div(100), 3)} u`, total: '100%' };
    },
    formulaDescription: 'Average mass = (m1 × a1 + m2 × a2 + m3 × a3) ÷ 100, with each abundance a in percent and each isotope mass m in atomic mass units.',
    workedExample: 'Chlorine: 34.96885 × 75.76% + 36.9659 × 24.24% = 26.4924 + 8.9605 = 35.453 u.',
    faq: [
      {
        question: 'Why is the periodic table value not a whole number?',
        answer:
          "Because it averages isotopes of different mass number, and each isotope's own mass is also slightly off a whole number because of nuclear binding energy.",
      },
      {
        question: 'What if the abundances do not add to 100?',
        answer: 'The tool says so instead of guessing. Check each entry or add the missing isotope in the third row.',
      },
      {
        question: 'Does the average change from sample to sample?',
        answer: 'Slightly. Isotope ratios vary a little in nature, so IUPAC gives some elements as a small range.',
      },
    ],
    scenarios: rows(
      ['m1', 'a1', 'm2', 'a2', 'm3', 'a3'],
      [
        [10.0129, 19.9, 11.0093, 80.1, 0, 0],
        [62.9296, 69.15, 64.9278, 30.85, 0, 0],
        [23.985, 78.99, 24.9858, 10, 25.9826, 11.01],
        [27.9769, 92.223, 28.9765, 4.685, 29.9738, 3.092],
        [6.0151, 7.59, 7.016, 92.41, 0, 0],
        [19.9924, 90.48, 20.9938, 0.27, 21.9914, 9.25],
      ],
      (v) => `${v[0]} u at ${v[1]}% with ${v[2]} u at ${v[3]}%`,
    ),
    introOutputs: ['avg'],
    relatedSlugs: ['molar-mass-calculator', 'grams-to-moles-calculator'],
    checks: [
      { inputs: {}, expect: { avg: '35.453 u', total: '100%' } },
      { inputs: { m1: 10.0129, a1: 19.9, m2: 11.0093, a2: 80.1 }, expect: { avg: '10.811 u' } },
      { inputs: { a1: 50 }, expect: { avg: 'Abundances add up to 74.24, not 100' } },
    ],
  },
  {
    slug: 'normality-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions and concentration',
    title: 'Normality Calculator: Equivalents per Litre from Mass',
    h1: 'Normality Calculator',
    metaDescription: 'Find the normality of a solution in equivalents per litre from the mass of solute, molar mass, equivalents per mole and volume.',
    about:
      'Normality counts reactive equivalents rather than moles, so it tracks what a solution can actually do in an acid-base or redox reaction. One mole of sulfuric acid can give two moles of hydrogen ions, so a 1 mol/L solution is 2 N. Titration textbooks and some pharmacopoeias still use it. Enter the mass, the molar mass, how many equivalents each mole supplies in your reaction, and the final volume. The molarity is shown beside it so you can check the factor.',
    inputs: [
      field('mass', 'Mass of solute (g)', 9.8, 0, 1000000),
      field('mm', 'Molar mass (g/mol)', 98, 0.1, 100000),
      intField('z', 'Equivalents per mole', 2, 1, 12),
      field('volume', 'Final volume (L)', 1, 0.001, 100000),
    ],
    outputs: [
      { name: 'normality', label: 'Normality', format: 'text', highlight: true },
      { name: 'molarity', label: 'Equivalent molarity', format: 'text' },
    ],
    calculate: (i) => {
      const molarity = toD(i.mass).div(toD(i.mm)).div(toD(i.volume));
      return { normality: `${fmtNumber(molarity.mul(toD(i.z)), 4)} N`, molarity: `${fmtNumber(molarity, 4)} mol/L` };
    },
    formulaDescription: 'Normality N = (mass ÷ molar mass × equivalents per mole) ÷ volume in litres, which equals molarity × equivalents per mole.',
    workedExample: '9.8 g of H2SO4 (98 g/mol) is 0.1 mol. With 2 equivalents per mole that is 0.2 eq in 1 L, so the solution is 0.2 N and 0.1 mol/L.',
    faq: [
      {
        question: 'Why does one compound have several normalities?',
        answer: 'The equivalents per mole depend on the reaction. Phosphoric acid gives 1, 2 or 3 hydrogen ions depending on how far it is neutralised.',
      },
      {
        question: 'Is normality still recommended?',
        answer: 'IUPAC discourages it because it is reaction-specific, but older methods and some industry specifications still quote it.',
      },
      { question: 'How do I convert normality to molarity?', answer: 'Divide by the equivalents per mole, which is the reverse of the calculation here.' },
    ],
    scenarios: rows(
      ['mass', 'mm', 'z', 'volume'],
      [
        [4.9, 98, 2, 0.5],
        [40, 40, 1, 1],
        [3.65, 36.46, 1, 0.1],
        [53, 106, 2, 0.25],
        [15.8, 158, 5, 0.2],
        [74, 74.1, 2, 2],
      ],
      (v) => `${v[0]} g of ${v[1]} g/mol, ${v[2]} eq/mol, ${v[3]} L`,
    ),
    introOutputs: ['normality'],
    relatedSlugs: ['molarity-calculator', 'titration-calculator'],
    checks: [
      { inputs: {}, expect: { normality: '0.2 N', molarity: '0.1 mol/L' } },
      { inputs: { z: 1 }, expect: { normality: '0.1 N' } },
      { inputs: { mass: 49, volume: 0.5 }, expect: { normality: '2 N', molarity: '1 mol/L' } },
    ],
  },
  {
    slug: 'ppm-to-molarity-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions and concentration',
    title: 'PPM to Molarity Calculator for Dilute Aqueous Solutions',
    h1: 'PPM to Molarity Calculator',
    metaDescription: 'Convert a concentration in parts per million (mg/L) to molarity and millimolar using the molar mass of the dissolved substance.',
    about:
      'Water-quality reports give concentrations in parts per million, while chemistry works in moles per litre. For a dilute solution in water, one ppm is one milligram of solute per litre, so the conversion divides by 1,000 to reach grams and by the molar mass to reach moles. Drinking-water limits for nitrate, fluoride or lead are quoted this way. Enter the ppm and the molar mass of the species that was measured, and read the answer in mol/L and mmol/L.',
    inputs: [field('ppm', 'Concentration (ppm, mg/L)', 584.4, 0, 1000000), field('mm', 'Molar mass (g/mol)', 58.44, 0.1, 100000)],
    outputs: [
      { name: 'molar', label: 'Molarity', format: 'text', highlight: true },
      { name: 'milli', label: 'Millimolar', format: 'text' },
    ],
    calculate: (i) => {
      const molar = toD(i.ppm).div(1000).div(toD(i.mm));
      return { molar: `${fmtSig(molar, 4, false)} mol/L`, milli: `${fmtSig(molar.mul(1000), 4, false)} mmol/L` };
    },
    formulaDescription:
      'M = ppm ÷ 1,000 ÷ molar mass, valid when 1 ppm = 1 mg/L, which holds for dilute water-based solutions near 4 °C and is a close approximation at room temperature.',
    workedExample: '584.4 ppm of NaCl is 0.5844 g/L. Divided by 58.44 g/mol that is 0.01 mol/L, or 10 mmol/L.',
    faq: [
      {
        question: 'Is ppm always mg/L?',
        answer: 'Only for dilute aqueous solutions where the density is close to 1 g/mL. For other liquids or for gases, ppm has a different meaning.',
      },
      {
        question: 'Which molar mass do I use for nitrate reported as nitrogen?',
        answer: 'Use the molar mass of the species the lab reported: 14.007 for nitrate-nitrogen, 62.00 for the nitrate ion itself.',
      },
      { question: 'How do I go the other way?', answer: 'Multiply the molarity by the molar mass and by 1,000 to get mg/L.' },
    ],
    scenarios: rows(
      ['ppm', 'mm'],
      [
        [5844, 58.44],
        [35.45, 35.45],
        [10, 62],
        [250, 40.08],
        [1.5, 19],
        [0.015, 207.2],
      ],
      (v) => `${v[0]} ppm at ${v[1]} g/mol`,
    ),
    relatedSlugs: ['molarity-calculator', 'mass-percent-calculator'],
    checks: [
      { inputs: {}, expect: { molar: '0.01 mol/L', milli: '10 mmol/L' } },
      { inputs: { ppm: 5844 }, expect: { molar: '0.1 mol/L', milli: '100 mmol/L' } },
      { inputs: { ppm: 35.45, mm: 35.45 }, expect: { molar: '0.001 mol/L', milli: '1 mmol/L' } },
    ],
  },
  {
    slug: 'percent-solution-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions and concentration',
    title: 'Percent Solution Calculator: Grams of Solute for a w/v Recipe',
    h1: 'Percent Solution Calculator',
    metaDescription: 'Work out how many grams of solid to dissolve to make a given volume of a weight-per-volume percent solution.',
    about:
      'A weight-per-volume percent solution holds a stated number of grams of solute in every 100 millilitres of finished solution. Culture media, stains and staining buffers are specified this way, as in a 5% glucose solution or 0.9% saline. To prepare it, multiply the percentage by the volume you want and divide by 100 to get grams, dissolve in part of the water, then make up to the final volume. The calculator also shows the same strength in milligrams per millilitre. Agar plates, gel running buffers and microscopy fixatives are typical recipes, and a 1% w/v solution is exactly 10 mg in every millilitre, a quick check that avoids slips when scaling a protocol up or down for a larger batch.',
    inputs: [field('pct', 'Strength (% w/v)', 5, 0, 100), field('volume', 'Volume to make (mL)', 250, 0, 1000000)],
    outputs: [
      { name: 'mass', label: 'Solute to weigh', format: 'text', highlight: true },
      { name: 'conc', label: 'Same strength', format: 'text' },
    ],
    calculate: (i) => ({
      mass: `${fmtNumber(toD(i.pct).mul(toD(i.volume)).div(100), 3)} g`,
      conc: `${fmtNumber(toD(i.pct).mul(10), 3)} mg/mL`,
    }),
    formulaDescription: 'Mass in grams = percent × volume in mL ÷ 100. Concentration in mg/mL = percent × 10.',
    workedExample: 'A 5% w/v solution, 250 mL: 5 × 250 ÷ 100 = 12.5 g of solute, made up to 250 mL. That is 50 mg/mL.',
    faq: [
      {
        question: 'Is w/v the same as w/w?',
        answer:
          'No. Weight per volume uses grams per 100 mL of solution; weight per weight uses grams per 100 g. They agree only if the solution has a density of 1 g/mL.',
      },
      {
        question: 'Do I add the solute to 250 mL of water?',
        answer: 'No. Dissolve it in less than the final volume and add solvent up to the mark, so the finished solution is exactly 250 mL.',
      },
      {
        question: 'How is it different from the mass percent calculator?',
        answer: 'Mass percent compares two masses. A percent solution compares a mass with a volume, which is what labware measures.',
      },
    ],
    scenarios: rows(
      ['pct', 'volume'],
      [
        [0.9, 1000],
        [10, 50],
        [2, 500],
        [0.1, 100],
        [20, 200],
        [1.5, 750],
      ],
      (v) => `${v[0]}% for ${v[1]} mL`,
    ),
    relatedSlugs: ['mass-percent-calculator', 'dilution-calculator'],
    checks: [
      { inputs: {}, expect: { mass: '12.5 g', conc: '50 mg/mL' } },
      { inputs: { pct: 0.9, volume: 1000 }, expect: { mass: '9 g', conc: '9 mg/mL' } },
      { inputs: { pct: 10, volume: 50 }, expect: { mass: '5 g', conc: '100 mg/mL' } },
    ],
  },
  {
    slug: 'alligation-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions and concentration',
    title: 'Alligation Calculator: Mixing Two Strengths to Reach a Target',
    h1: 'Alligation Calculator',
    metaDescription: 'Use the alligation alternate method to find how much of a stronger and a weaker solution to mix to reach a target strength.',
    about:
      'Alligation is a quick way to blend two solutions of different strength into one of an intermediate strength. Write the target between the two strengths, subtract diagonally, and the differences are the parts of each to mix. Pharmacists have used it for centuries to cut an ointment or alcohol to the right strength. Enter the stronger and weaker strengths, the target and the total volume you need. The calculator returns the parts and the volume of each component.',
    inputs: [
      field('high', 'Stronger solution (%)', 70, 0, 100),
      field('low', 'Weaker solution (%)', 10, 0, 100),
      field('target', 'Target strength (%)', 40, 0, 100),
      field('volume', 'Total volume needed (mL)', 500, 0, 1000000),
    ],
    outputs: [
      { name: 'ratio', label: 'Parts stronger : weaker', format: 'text', highlight: true },
      { name: 'vHigh', label: 'Volume of stronger', format: 'text' },
      { name: 'vLow', label: 'Volume of weaker', format: 'text' },
    ],
    calculate: (i) => {
      const high = toD(i.high);
      const low = toD(i.low);
      const target = toD(i.target);
      if (!(high.gt(target) && target.gt(low))) return { ratio: 'The target must lie between the two strengths', vHigh: '-', vLow: '-' };
      const partsHigh = target.minus(low);
      const partsLow = high.minus(target);
      const all = partsHigh.plus(partsLow);
      const volume = toD(i.volume);
      return {
        ratio: `${fmtNumber(partsHigh, 2)} : ${fmtNumber(partsLow, 2)}`,
        vHigh: `${fmtNumber(volume.mul(partsHigh).div(all), 2)} mL`,
        vLow: `${fmtNumber(volume.mul(partsLow).div(all), 2)} mL`,
      };
    },
    formulaDescription: 'Parts of stronger = target − weaker. Parts of weaker = stronger − target. Volume of each = total volume × its parts ÷ (sum of parts).',
    workedExample:
      'To get 40% from 70% and 10% stock: stronger parts = 40 − 10 = 30, weaker parts = 70 − 40 = 30, a 1:1 mix. For 500 mL that is 250 mL of each.',
    faq: [
      {
        question: 'Why must the target lie between the strengths?',
        answer: 'Mixing can only give a strength somewhere between its ingredients. Anything outside needs a stronger or weaker stock.',
      },
      {
        question: 'Does the method assume volumes add?',
        answer: 'Yes. Some mixtures, such as alcohol and water, contract slightly, so for critical work check the final strength.',
      },
      { question: 'Can I use it for any unit?', answer: 'Yes, percent, ppm or molarity all work if both stocks and the target use the same unit.' },
    ],
    scenarios: rows(
      ['high', 'low', 'target', 'volume'],
      [
        [95, 0, 70, 1000],
        [70, 10, 20, 500],
        [50, 5, 25, 250],
        [12, 1, 3, 100],
        [100, 20, 90, 800],
        [37, 0, 10, 300],
      ],
      (v) => `${v[0]}% and ${v[1]}% mixed to ${v[2]}%, ${v[3]} mL`,
    ),
    introOutputs: ['ratio'],
    relatedSlugs: ['dilution-calculator', 'percent-solution-calculator', 'mass-percent-calculator'],
    checks: [
      { inputs: {}, expect: { ratio: '30 : 30', vHigh: '250 mL', vLow: '250 mL' } },
      { inputs: { target: 20 }, expect: { ratio: '10 : 50', vHigh: '83.33 mL', vLow: '416.67 mL' } },
      { inputs: { target: 70 }, expect: { ratio: 'The target must lie between the two strengths' } },
    ],
  },
  {
    slug: 'titration-calculator',
    category: 'chemistry',
    tier: 2,
    subCluster: 'Stoichiometry',
    title: 'Titration Calculator: Unknown Concentration from the Endpoint',
    h1: 'Titration Calculator',
    metaDescription: "Find the concentration of an unknown solution from the titrant's molarity, the endpoint volume, the sample volume and the mole ratio.",
    about:
      'In a titration you add a solution of known concentration, the titrant, to a measured sample until an indicator shows the reaction is complete. The moles of titrant used then reveal the moles in the sample. Divide the titrant moles by the mole ratio from the balanced equation, then by the sample volume, to get the unknown concentration. Enter the titrant molarity and the burette volume at the endpoint, the pipetted sample volume, and the number of moles of titrant that react with one mole of sample.',
    inputs: [
      field('conc', 'Titrant concentration (mol/L)', 0.1, 0.00001, 100),
      field('vt', 'Titrant volume at endpoint (mL)', 25, 0.001, 10000),
      field('va', 'Sample volume (mL)', 20, 0.001, 10000),
      field('n', 'Moles of titrant per mole of sample', 1, 0.1, 10),
    ],
    outputs: [
      { name: 'unknown', label: 'Sample concentration', format: 'text', highlight: true },
      { name: 'mmol', label: 'Sample amount', format: 'text' },
    ],
    calculate: (i) => {
      const mmolSample = toD(i.conc).mul(toD(i.vt)).div(toD(i.n));
      return { unknown: `${fmtNumber(mmolSample.div(toD(i.va)), 4)} mol/L`, mmol: `${fmtNumber(mmolSample, 4)} mmol` };
    },
    formulaDescription: 'Sample concentration = (titrant concentration × titrant volume ÷ mole ratio) ÷ sample volume, with both volumes in the same unit.',
    workedExample: '25.0 mL of 0.1 mol/L NaOH neutralises 20.0 mL of HCl at a 1:1 ratio: 0.1 × 25 = 2.5 mmol, and 2.5 ÷ 20 = 0.125 mol/L.',
    faq: [
      {
        question: 'What mole ratio do I use for sulfuric acid and NaOH?',
        answer: 'Two moles of NaOH react with one mole of H2SO4, so enter 2 as the moles of titrant per mole of sample.',
      },
      {
        question: 'Is the endpoint the same as the equivalence point?',
        answer:
          'Not exactly. The endpoint is where the indicator changes colour, the equivalence point is where the amounts match. A good indicator makes them nearly equal.',
      },
      { question: 'Why repeat a titration?', answer: 'To catch overshoot and reading errors. Concordant results within 0.1 mL are the usual standard.' },
    ],
    scenarios: rows(
      ['conc', 'vt', 'va', 'n'],
      [
        [0.1, 10, 25, 1],
        [0.5, 12.4, 10, 2],
        [0.02, 18.6, 25, 5],
        [0.1, 22.45, 20, 1],
        [1, 7.3, 25, 1],
        [0.05, 30.1, 50, 2],
      ],
      (v) => `${v[0]} mol/L titrant, ${v[1]} mL to endpoint, ${v[2]} mL sample, ratio ${v[3]}`,
    ),
    introOutputs: ['unknown'],
    relatedSlugs: ['normality-calculator', 'molarity-calculator', 'dilution-calculator'],
    checks: [
      { inputs: {}, expect: { unknown: '0.125 mol/L', mmol: '2.5 mmol' } },
      { inputs: { n: 2 }, expect: { unknown: '0.0625 mol/L', mmol: '1.25 mmol' } },
      { inputs: { conc: 0.5, vt: 10, va: 25 }, expect: { unknown: '0.2 mol/L', mmol: '5 mmol' } },
    ],
  },
  {
    slug: 'water-hardness-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions and concentration',
    title: 'Water Hardness Calculator: Calcium and Magnesium as CaCO3',
    h1: 'Water Hardness Calculator',
    metaDescription: 'Turn calcium and magnesium concentrations in mg/L into total hardness as calcium carbonate, grains per gallon and a hardness class.',
    about:
      'Hard water carries dissolved calcium and magnesium, which leave scale in kettles and reduce soap lather. Labs report total hardness as the amount of calcium carbonate that would contain the same number of moles of hardness ions. Calcium counts 2.497 and magnesium 4.118 times its mg/L, the ratio of the molar mass of calcium carbonate to each metal. Enter the two concentrations from a water report. The result is classed with the common USGS bands and also given in grains per gallon.',
    inputs: [field('ca', 'Calcium (mg/L)', 40, 0, 10000), field('mg', 'Magnesium (mg/L)', 12, 0, 10000)],
    outputs: [
      { name: 'hardness', label: 'Total hardness', format: 'text', highlight: true },
      { name: 'class', label: 'Hardness class', format: 'text' },
      { name: 'gpg', label: 'Grains per gallon', format: 'text' },
    ],
    calculate: (i) => {
      const h = toD(i.ca).mul('2.497').plus(toD(i.mg).mul('4.118'));
      return {
        hardness: `${fmtNumber(h, 1)} mg/L as CaCO3`,
        class: h.lte(60) ? 'Soft' : h.lte(120) ? 'Moderately hard' : h.lte(180) ? 'Hard' : 'Very hard',
        gpg: fmtNumber(h.div('17.1'), 1),
      };
    },
    formulaDescription:
      'Hardness (mg/L as CaCO3) = 2.497 × [Ca] + 4.118 × [Mg], with each concentration in mg/L. One grain per US gallon = 17.1 mg/L. Bands: up to 60 soft, 61 to 120 moderately hard, 121 to 180 hard, above 180 very hard.',
    workedExample:
      '40 mg/L of calcium and 12 mg/L of magnesium: 40 × 2.497 + 12 × 4.118 = 99.88 + 49.42 = 149.3 mg/L as CaCO3, which is hard water and about 8.7 grains per gallon.',
    faq: [
      {
        question: 'Why express hardness as calcium carbonate?',
        answer: 'It gives calcium, magnesium and other hardness ions a single common unit, so different waters can be compared.',
      },
      {
        question: 'Is hard water harmful?',
        answer: 'Not to drink. It mainly causes scale and uses more soap, though a water softener may be wanted for appliances.',
      },
      { question: 'Are the bands universal?', answer: 'No. The USGS bands are common, but other agencies place the limits slightly differently.' },
    ],
    scenarios: rows(
      ['ca', 'mg'],
      [
        [10, 2],
        [25, 5],
        [60, 10],
        [90, 25],
        [120, 40],
        [15, 15],
      ],
      (v) => `${v[0]} mg/L Ca and ${v[1]} mg/L Mg`,
    ),
    introOutputs: ['hardness', 'class'],
    relatedSlugs: ['ppm-to-molarity-calculator', 'molarity-calculator'],
    checks: [
      { inputs: {}, expect: { hardness: '149.3 mg/L as CaCO3', class: 'Hard', gpg: '8.7' } },
      { inputs: { ca: 10, mg: 2 }, expect: { hardness: '33.2 mg/L as CaCO3', class: 'Soft' } },
      { inputs: { ca: 60, mg: 10 }, expect: { hardness: '191 mg/L as CaCO3', class: 'Very hard' } },
    ],
  },
  {
    slug: 'atom-economy-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Reactions',
    title: 'Atom Economy Calculator for Green Chemistry',
    h1: 'Atom Economy Calculator',
    metaDescription: "Compare the molar mass of the product you want with the combined molar mass of all reactants to get a reaction's atom economy.",
    about:
      'Atom economy asks what fraction of the atoms you put into a reaction end up in the product you want. It is one of the twelve principles of green chemistry: a reaction can have a high yield and still waste most of its starting material as by-product. Add up the molar masses of every reactant, each multiplied by its coefficient, and compare with the molar mass of the desired product times its coefficient. The difference is the mass that leaves as by-product per mole of reaction.',
    inputs: [
      field('desired', 'Desired product molar mass × coefficient (g/mol)', 88.106, 0.1, 1000000),
      field('total', 'All reactants, molar mass × coefficient (g/mol)', 106.12, 0.1, 1000000),
    ],
    outputs: [
      { name: 'economy', label: 'Atom economy', format: 'text', highlight: true },
      { name: 'waste', label: 'By-product mass', format: 'text' },
    ],
    calculate: (i) => {
      const desired = toD(i.desired);
      const total = toD(i.total);
      return { economy: fmtPercent(desired.div(total).mul(100), 1), waste: `${fmtNumber(total.minus(desired), 3)} g/mol` };
    },
    formulaDescription: 'Atom economy = (molar mass of desired product × its coefficient) ÷ (sum of reactant molar masses × coefficients) × 100.',
    workedExample:
      'Esterification: acetic acid 60.052 + ethanol 46.068 = 106.12 g/mol of reactants gives ethyl acetate 88.106 g/mol. Atom economy = 88.106 ÷ 106.12 = 83.0%, with 18.014 g/mol lost as water.',
    faq: [
      {
        question: 'How is atom economy different from percent yield?',
        answer:
          'Percent yield measures what a real run recovers. Atom economy is a property of the equation and says how much waste is built in even at a perfect yield.',
      },
      {
        question: 'What counts as a high atom economy?',
        answer: 'Additions and rearrangements can reach 100%. Substitutions and eliminations lose a leaving group, so they are lower.',
      },
      { question: 'Do solvents and catalysts count?', answer: 'No. Only the stoichiometric reactants in the balanced equation are included.' },
    ],
    scenarios: rows(
      ['desired', 'total'],
      [
        [34.062, 34.062],
        [180.156, 342.3],
        [100, 250],
        [60.052, 120.1],
        [46.068, 74.1],
        [200, 205],
      ],
      (v) => `${v[0]} g/mol wanted from ${v[1]} g/mol in`,
    ),
    introOutputs: ['economy'],
    relatedSlugs: ['percent-yield-calculator', 'theoretical-yield-calculator', 'molar-mass-calculator'],
    checks: [
      { inputs: {}, expect: { economy: '83.0%', waste: '18.014 g/mol' } },
      { inputs: { desired: 100, total: 100 }, expect: { economy: '100.0%', waste: '0 g/mol' } },
      { inputs: { desired: 50, total: 200 }, expect: { economy: '25.0%', waste: '150 g/mol' } },
    ],
  },
  {
    slug: 'arrhenius-equation-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Kinetics',
    title: 'Arrhenius Equation Calculator: Rate Constant from Temperature',
    h1: 'Arrhenius Equation Calculator',
    metaDescription: 'Calculate a rate constant from the pre-exponential factor, activation energy and temperature with the Arrhenius equation.',
    about:
      'Reactions speed up when they are heated, and the Arrhenius equation puts a number on it. The rate constant equals a pre-exponential factor times an exponential that shrinks as the activation energy grows and as the temperature falls. The exponential is the fraction of collisions energetic enough to react. Give the factor in per second, the activation energy in kilojoules per mole and the temperature in kelvin. A rise of about ten degrees often roughly doubles the rate, though the exact change depends on the barrier.',
    inputs: [
      field('a', 'Pre-exponential factor A (1/s)', 10000000000, 0.000001, 1e30),
      field('ea', 'Activation energy (kJ/mol)', 50, 0, 1000),
      field('t', 'Temperature (K)', 298.15, 1, 5000),
    ],
    outputs: [
      { name: 'k', label: 'Rate constant', format: 'text', highlight: true },
      { name: 'fraction', label: 'Fraction with enough energy', format: 'text' },
    ],
    calculate: (i) => {
      const fraction = toD(i.ea)
        .mul(1000)
        .div(R_GAS.mul(toD(i.t)))
        .neg()
        .exp();
      return { k: `${sci(toD(i.a).mul(fraction))} s^-1`, fraction: sci(fraction) };
    },
    formulaDescription: 'k = A × exp(−Ea ÷ (R × T)), with Ea in joules per mole, R = 8.314462618 J/(mol·K) and T in kelvin.',
    workedExample:
      'Ea = 50 kJ/mol at 298.15 K: Ea ÷ RT = 50,000 ÷ 2,478.96 = 20.17, so the energetic fraction is e^-20.17 = 1.74 × 10^-9. With A = 10^10 per second, k is about 17 per second.',
    faq: [
      {
        question: 'What does the pre-exponential factor mean?',
        answer: 'It reflects how often reactants collide with a suitable orientation. It is measured from experiment and has the units of the rate constant.',
      },
      {
        question: 'Why must temperature be in kelvin?',
        answer: 'The exponent uses absolute temperature, so a Celsius value would give a wrong answer. Add 273.15 to a Celsius reading.',
      },
      {
        question: 'Does a catalyst change this?',
        answer:
          'It lowers the activation energy, which raises the exponential term and so the rate constant, without changing the overall energy of the reaction.',
      },
    ],
    scenarios: rows(
      ['a', 'ea', 't'],
      [
        [10000000000, 50, 310],
        [1000000000000, 75, 298.15],
        [100000000, 30, 350],
        [10000000000000, 100, 400],
        [1000000, 20, 273.15],
        [100000000000, 60, 500],
      ],
      (v) => `A = ${v[0]}, Ea ${v[1]} kJ/mol, ${v[2]} K`,
    ),
    introOutputs: ['k'],
    relatedSlugs: ['activation-energy-calculator', 'rate-constant-calculator', 'gibbs-free-energy-calculator'],
    checks: [
      { inputs: {}, expect: { k: '1.739 × 10^1 s^-1', fraction: '1.739 × 10^-9' } },
      { inputs: { ea: 0 }, expect: { k: '1.000 × 10^10 s^-1', fraction: '1.000 × 10^0' } },
      { inputs: { ea: 0, a: 5000000 }, expect: { k: '5.000 × 10^6 s^-1' } },
    ],
  },
  {
    slug: 'activation-energy-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Kinetics',
    title: 'Activation Energy Calculator from Two Rate Constants',
    h1: 'Activation Energy Calculator',
    metaDescription: "Find a reaction's activation energy in kJ/mol from its rate constants measured at two different temperatures.",
    about:
      'You do not need to know the pre-exponential factor to find an activation energy. Measure the rate constant at two temperatures and the Arrhenius equation lets the factor cancel, leaving the energy barrier in terms of the ratio of the constants and the gap between the reciprocal temperatures. The larger the jump in rate for a given rise in temperature, the higher the barrier. Use consistent units for both constants and give the temperatures in kelvin.',
    inputs: [
      field('k1', 'Rate constant k1', 0.001, 0.000000000001, 1e12),
      field('t1', 'Temperature T1 (K)', 300, 1, 5000),
      field('k2', 'Rate constant k2', 0.002, 0.000000000001, 1e12),
      field('t2', 'Temperature T2 (K)', 310, 1, 5000),
    ],
    outputs: [{ name: 'ea', label: 'Activation energy', format: 'text', highlight: true }],
    calculate: (i) => {
      const t1 = toD(i.t1);
      const t2 = toD(i.t2);
      if (t1.eq(t2)) return { ea: 'Use two different temperatures' };
      const ea = R_GAS.mul(toD(i.k2).div(toD(i.k1)).ln()).div(new D(1).div(t1).minus(new D(1).div(t2)));
      return { ea: `${fmtNumber(ea.div(1000), 2)} kJ/mol` };
    },
    formulaDescription: 'Ea = R × ln(k2 ÷ k1) ÷ (1 ÷ T1 − 1 ÷ T2), with R = 8.314462618 J/(mol·K) and the result converted to kJ/mol.',
    workedExample:
      'k doubles from 0.001 to 0.002 between 300 K and 310 K: R ln 2 = 5.763 and 1/300 − 1/310 = 1.0753 × 10^-4, so Ea = 53,598 J/mol, or about 53.6 kJ/mol.',
    faq: [
      {
        question: 'Does it matter which temperature is first?',
        answer: 'No. Swapping both pairs gives the same answer, as long as each constant stays with its temperature.',
      },
      {
        question: 'How accurate is a two-point estimate?',
        answer: 'It is only as good as the two measurements. Plotting ln k against 1/T over several temperatures gives a better slope.',
      },
      {
        question: 'Can the answer be negative?',
        answer: 'If k falls as temperature rises the result is negative, which signals a complex mechanism rather than a simple one-step barrier.',
      },
    ],
    scenarios: rows(
      ['k1', 't1', 'k2', 't2'],
      [
        [0.001, 300, 0.004, 320],
        [0.5, 280, 1.2, 295],
        [2.5e-5, 350, 1.1e-3, 400],
        [0.03, 298, 0.06, 308],
        [1.2, 310, 2.4, 320],
        [4e-4, 320, 8e-3, 370],
      ],
      (v) => `k ${v[0]} at ${v[1]} K and ${v[2]} at ${v[3]} K`,
    ),
    relatedSlugs: ['arrhenius-equation-calculator', 'rate-constant-calculator'],
    checks: [
      { inputs: {}, expect: { ea: '53.6 kJ/mol' } },
      { inputs: { k2: 0.001 }, expect: { ea: '0 kJ/mol' } },
      { inputs: { t2: 300 }, expect: { ea: 'Use two different temperatures' } },
    ],
  },
  {
    slug: 'rate-constant-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Kinetics',
    title: 'First-Order Rate Constant Calculator from Concentration Data',
    h1: 'Rate Constant Calculator',
    metaDescription: 'Find the first-order rate constant and half-life from the starting concentration, the concentration after a time and the elapsed time.',
    about:
      'For a first-order reaction the natural logarithm of concentration falls in a straight line with time, and the slope of that line is the rate constant. With just two concentration readings you can get it directly: take the logarithm of the ratio of starting to remaining concentration and divide by the time. Enter both concentrations in the same unit and the time in any unit; the constant comes back per that time unit, together with the half-life it implies. Typical sources of data are absorbance readings during a dye fading, the pressure of a decomposing gas or titration samples drawn at intervals. Pharmacologists apply the same arithmetic to a drug clearing from plasma, where it is called the elimination rate constant. Because only the ratio of two readings enters the logarithm, you may use absorbance, pressure or any signal proportional to concentration without calibrating it. Check that a third reading falls on the same line before trusting the order, since a mixed-order reaction can fool two points.',
    inputs: [
      field('c0', 'Initial concentration', 1, 0.000001, 1000000),
      field('c', 'Concentration after time', 0.5, 0.000001, 1000000),
      field('time', 'Elapsed time', 10, 0.000001, 1000000000),
    ],
    outputs: [
      { name: 'k', label: 'First-order rate constant', format: 'text', highlight: true },
      { name: 'half', label: 'Implied half-life', format: 'text' },
    ],
    calculate: (i) => {
      const c0 = toD(i.c0);
      const c = toD(i.c);
      if (c.gte(c0)) return { k: 'Concentration must fall over time', half: '-' };
      const k = c0.div(c).ln().div(toD(i.time));
      return { k: `${fmtSig(k, 4, false)} per time unit`, half: fmtNumber(LN2.div(k), 3) };
    },
    formulaDescription: 'k = ln(C0 ÷ C) ÷ t for a first-order reaction. Half-life t½ = ln 2 ÷ k.',
    workedExample: 'A concentration that falls from 1 to 0.5 in 10 time units: k = ln 2 ÷ 10 = 0.06931 per time unit, and the half-life is 10.',
    faq: [
      {
        question: 'How do I know a reaction is first order?',
        answer: 'If ln C against time is a straight line, or the half-life stays the same as the concentration falls, it is first order.',
      },
      {
        question: 'What if the concentration rises?',
        answer: 'Then a reactant is not being consumed, and the formula does not apply. The tool asks for a falling concentration.',
      },
      {
        question: 'Does the unit of time matter?',
        answer: 'The constant is quoted per whatever unit you used, so convert seconds to minutes or hours if you want it in those.',
      },
    ],
    scenarios: rows(
      ['c0', 'c', 'time'],
      [
        [1, 0.25, 40],
        [0.8, 0.2, 120],
        [2, 1.5, 30],
        [0.05, 0.01, 600],
        [10, 9, 5],
        [3.2, 0.4, 24],
      ],
      (v) => `Signal dropping from ${v[0]} to ${v[1]} in ${v[2]} units of time`,
    ),
    introOutputs: ['k'],
    relatedSlugs: ['half-life-calculator', 'arrhenius-equation-calculator', 'activation-energy-calculator'],
    checks: [
      { inputs: {}, expect: { k: '0.06931 per time unit', half: '10' } },
      { inputs: { c: 0.25, time: 40 }, expect: { k: '0.03466 per time unit', half: '20' } },
      { inputs: { c: 2 }, expect: { k: 'Concentration must fall over time' } },
    ],
  },
  {
    slug: 'equilibrium-constant-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Equilibrium',
    title: 'Equilibrium Constant Calculator from Standard Gibbs Energy',
    h1: 'Equilibrium Constant Calculator',
    metaDescription: 'Convert a standard Gibbs free energy change and temperature into an equilibrium constant K and see which side the reaction favours.',
    about:
      "The equilibrium constant says how far a reaction runs before it settles, and it follows directly from the standard Gibbs free energy change. A negative ΔG° gives a K above one and favours products, a positive value favours reactants, and each 5.7 kJ/mol at room temperature shifts K by a factor of ten. Enter ΔG° in kilojoules per mole and the temperature in kelvin. Very large or small constants are shown in powers of ten. Ammonia synthesis, esterification and the dissociation of weak acids are all judged this way, and process engineers use it to decide how much of a feed can ever be converted before they design the reactor. Remember that a favourable constant says nothing about how fast equilibrium is reached. Heating shifts K in the direction that absorbs heat, as Le Chatelier's principle predicts, so an exothermic reaction loses ground as it warms, which is why industrial ammonia plants trade temperature against catalyst activity and pressure.",
    inputs: [field('dg', 'Standard Gibbs energy ΔG° (kJ/mol)', -5.7, -1000, 1000), field('t', 'Temperature (K)', 298.15, 1, 5000)],
    outputs: [
      { name: 'k', label: 'Equilibrium constant K', format: 'text', highlight: true },
      { name: 'side', label: 'Favours', format: 'text' },
    ],
    calculate: (i) => {
      const k = toD(i.dg)
        .mul(1000)
        .div(R_GAS.mul(toD(i.t)))
        .neg()
        .exp();
      const side = k.gt('1.01') ? 'Products' : k.lt('0.99') ? 'Reactants' : 'Neither side strongly';
      return { k: fmtK(k), side };
    },
    formulaDescription: 'K = exp(−ΔG° ÷ (R × T)), with ΔG° in joules per mole, R = 8.314462618 J/(mol·K) and T in kelvin.',
    workedExample: 'ΔG° = −5.7 kJ/mol at 298.15 K: −ΔG° ÷ RT = 5,700 ÷ 2,478.96 = 2.2993, so K = e^2.2993, close to 10. Products are favoured.',
    faq: [
      {
        question: 'Is K the same as the reaction quotient Q?',
        answer: 'Q uses concentrations at any moment. K is the value of Q at equilibrium, so comparing them shows which way the reaction will move.',
      },
      { question: 'Does a large K mean a fast reaction?', answer: 'No. K says where the reaction ends up, not how quickly it gets there.' },
      {
        question: 'Why does K change with temperature?',
        answer: 'Both the explicit T in the formula and ΔG° itself depend on temperature, so K must be worked out at each temperature.',
      },
    ],
    scenarios: rows(
      ['dg', 't'],
      [
        [-40, 298.15],
        [0, 298.15],
        [25, 298.15],
        [-11.4, 298.15],
        [-92.2, 700],
        [60, 400],
      ],
      (v) => `A standard free energy of ${v[0]} kJ/mol held at ${v[1]} K`,
    ),
    introOutputs: ['k'],
    relatedSlugs: ['gibbs-free-energy-calculator', 'nernst-equation-calculator'],
    checks: [
      { inputs: {}, expect: { k: '9.968', side: 'Products' } },
      { inputs: { dg: 0 }, expect: { k: '1', side: 'Neither side strongly' } },
      { inputs: { dg: 40 }, expect: { k: '9.824 × 10^-8', side: 'Reactants' } },
    ],
  },
  {
    slug: 'vapor-pressure-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Thermodynamics',
    title: 'Vapor Pressure Calculator: Clausius-Clapeyron at a New Temperature',
    h1: 'Vapor Pressure Calculator',
    metaDescription: "Estimate a liquid's vapour pressure at a new temperature from one known point and its enthalpy of vaporisation.",
    about:
      'The vapour pressure of a liquid climbs steeply with temperature. If you know it at one temperature and the enthalpy of vaporisation, the Clausius-Clapeyron equation gives it at another. It assumes the enthalpy stays constant over the range and treats the vapour as an ideal gas, so it works best over a modest span of temperatures. Use the normal boiling point, where the pressure is 101.325 kPa, as the known point and the pressure comes back in whatever unit you entered.',
    inputs: [
      field('p1', 'Known pressure P1 (kPa)', 101.325, 0.000001, 100000),
      field('t1', 'Temperature T1 (K)', 373.15, 1, 5000),
      field('t2', 'New temperature T2 (K)', 363.15, 1, 5000),
      field('dh', 'Enthalpy of vaporisation (kJ/mol)', 40.7, 0.1, 500),
    ],
    outputs: [{ name: 'p2', label: 'Vapour pressure at T2', format: 'text', highlight: true }],
    calculate: (i) => {
      const exponent = toD(i.dh)
        .mul(1000)
        .div(R_GAS)
        .mul(new D(1).div(toD(i.t1)).minus(new D(1).div(toD(i.t2))));
      return { p2: `${fmtNumber(toD(i.p1).mul(exponent.exp()), 2)} kPa` };
    },
    formulaDescription: 'ln(P2 ÷ P1) = −(ΔHvap ÷ R) × (1 ÷ T2 − 1 ÷ T1), solved for P2.',
    workedExample:
      'Water boils at 373.15 K and 101.325 kPa with ΔHvap = 40.7 kJ/mol. At 363.15 K the exponent is −0.3612, so P2 = 101.325 × e^-0.3612 = 70.6 kPa.',
    faq: [
      {
        question: 'Why is the real value slightly different?',
        answer: 'The enthalpy of vaporisation changes with temperature and real vapours are not ideal, so the equation is an estimate over a limited range.',
      },
      {
        question: 'Can I use it to find a boiling point at altitude?',
        answer: 'Yes. Set P2 to the local pressure by trying temperatures until it matches, or rearrange the same equation for T2.',
      },
      {
        question: 'What units should the pressure be in?',
        answer: 'Any, since only the ratio matters. The label shows kPa because that is the unit of the default.',
      },
    ],
    scenarios: rows(
      ['p1', 't1', 't2', 'dh'],
      [
        [101.325, 373.15, 353.15, 40.7],
        [101.325, 351.4, 330, 38.6],
        [101.325, 337.8, 310, 35.3],
        [101.325, 373.15, 393.15, 40.7],
        [101.325, 329.2, 300, 29.1],
        [101.325, 353.2, 320, 30.7],
      ],
      (v) => `${v[1]} K to ${v[2]} K, ΔH ${v[3]} kJ/mol`,
    ),
    relatedSlugs: ['raoults-law-calculator', 'gibbs-free-energy-calculator', 'boiling-point-elevation-calculator'],
    checks: [
      { inputs: {}, expect: { p2: '70.6 kPa' } },
      { inputs: { t2: 373.15 }, expect: { p2: '101.33 kPa' } },
      { inputs: { t2: 383.15 }, expect: { p2: '142.7 kPa' } },
    ],
  },
  {
    slug: 'raoults-law-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Colligative properties',
    title: "Raoult's Law Calculator: Vapor Pressure Lowering by a Solute",
    h1: "Raoult's Law Calculator",
    metaDescription: "Use Raoult's law to find a solution's vapour pressure and the lowering caused by a non-volatile solute from the moles of each.",
    about:
      "Raoult's law says that a solvent's vapour pressure above a solution is its pure-solvent vapour pressure scaled by its mole fraction. Dissolving a non-volatile solute dilutes the solvent at the surface, so fewer molecules escape and the vapour pressure drops. That lowering is the root of the other colligative properties. Enter the pure solvent's vapour pressure, the moles of solute and the moles of solvent. The law holds best for dilute solutions of similar molecules.",
    inputs: [
      field('p0', 'Pure solvent vapour pressure (kPa)', 100, 0.000001, 100000),
      field('solute', 'Moles of solute', 1, 0, 1000000),
      field('solvent', 'Moles of solvent', 9, 0.000001, 1000000),
    ],
    outputs: [
      { name: 'p', label: 'Solution vapour pressure', format: 'text', highlight: true },
      { name: 'drop', label: 'Vapour pressure lowering', format: 'text' },
      { name: 'x', label: 'Solvent mole fraction', format: 'text' },
    ],
    calculate: (i) => {
      const x = toD(i.solvent).div(toD(i.solvent).plus(toD(i.solute)));
      const p0 = toD(i.p0);
      return { p: `${fmtNumber(p0.mul(x), 3)} kPa`, drop: `${fmtNumber(p0.minus(p0.mul(x)), 3)} kPa`, x: fmtFixed(x, 4) };
    },
    formulaDescription: 'P = x(solvent) × P°, with x = n(solvent) ÷ (n(solvent) + n(solute)). The lowering is P° − P.',
    workedExample:
      '1 mol of solute in 9 mol of solvent gives x = 0.9. If the pure solvent has P° = 100 kPa, the solution has 90 kPa and the lowering is 10 kPa.',
    faq: [
      {
        question: 'What if the solute is also volatile?',
        answer: 'Then each component contributes its own partial pressure, and the total is the sum, which is a different calculation.',
      },
      {
        question: "Why is the lowering independent of the solute's identity?",
        answer: 'Only the mole fraction matters for an ideal solution, so it is a colligative property: it depends on how many particles, not which kind.',
      },
      {
        question: 'Do real solutions follow the law?',
        answer:
          'Approximately, when the solute and solvent molecules are similar in size and attract each other equally. Strong interactions produce deviations.',
      },
    ],
    scenarios: rows(
      ['p0', 'solute', 'solvent'],
      [
        [3.17, 0.5, 55.5],
        [23.8, 2, 40],
        [101.3, 0.1, 10],
        [50, 3, 7],
        [75, 1, 1],
        [12.3, 0.25, 20],
      ],
      (v) => `P° ${v[0]}, ${v[1]} mol solute, ${v[2]} mol solvent`,
    ),
    introOutputs: ['p', 'drop'],
    relatedSlugs: ['vapor-pressure-calculator', 'mole-fraction-calculator', 'boiling-point-elevation-calculator'],
    checks: [
      { inputs: {}, expect: { p: '90 kPa', drop: '10 kPa', x: '0.9000' } },
      { inputs: { solute: 3, solvent: 7 }, expect: { p: '70 kPa', drop: '30 kPa' } },
      { inputs: { solute: 0 }, expect: { p: '100 kPa', drop: '0 kPa' } },
    ],
  },
  {
    slug: 'ionic-strength-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Solutions and concentration',
    title: 'Ionic Strength Calculator for Up to Three Ions',
    h1: 'Ionic Strength Calculator',
    metaDescription: 'Compute the ionic strength of a solution from the concentration and charge of up to three ions: I = ½ Σ c z².',
    about:
      'Ionic strength measures how much electrical charge a solution carries, weighting each ion by the square of its charge. Doubly charged ions therefore count four times as much as singly charged ones. It matters because it sets how strongly ions shield each other, which feeds into activity coefficients, protein solubility and the behaviour of buffers. Enter the molar concentration and the size of the charge for up to three kinds of ion, positive and negative alike.',
    inputs: [
      field('c1', 'Ion 1 concentration (mol/L)', 0.1, 0, 100),
      intField('z1', 'Ion 1 charge size', 1, 1, 6),
      field('c2', 'Ion 2 concentration (mol/L)', 0.1, 0, 100),
      intField('z2', 'Ion 2 charge size', 1, 1, 6),
      field('c3', 'Ion 3 concentration (mol/L)', 0, 0, 100),
      intField('z3', 'Ion 3 charge size', 1, 1, 6),
    ],
    outputs: [{ name: 'i', label: 'Ionic strength', format: 'text', highlight: true }],
    calculate: (i) => {
      const term = (c: unknown, z: unknown) => toD(c).mul(toD(z).pow(2));
      const sum = term(i.c1, i.z1).plus(term(i.c2, i.z2)).plus(term(i.c3, i.z3));
      return { i: `${fmtNumber(sum.div(2), 4)} mol/L` };
    },
    formulaDescription: 'I = ½ × Σ (ci × zi²), summed over every ion, with ci in mol/L and zi the charge number.',
    workedExample: '0.1 mol/L CaCl2 gives 0.1 mol/L of Ca²⁺ (z = 2) and 0.2 mol/L of Cl⁻ (z = 1): ½ × (0.1 × 4 + 0.2 × 1) = 0.3 mol/L.',
    faq: [
      { question: 'Do I enter the sign of the charge?', answer: 'No, only its size, because the charge is squared. Sodium and chloride both enter as 1.' },
      {
        question: 'Why list each ion separately?',
        answer: 'A salt that releases several ions per formula unit contributes each one. 0.1 M CaCl2 gives 0.1 M calcium and 0.2 M chloride.',
      },
      {
        question: 'Why does it matter in biochemistry?',
        answer: 'Salt concentration affects enzyme activity and protein stability, and ionic strength is the clean way to compare buffers.',
      },
    ],
    scenarios: rows(
      ['c1', 'z1', 'c2', 'z2', 'c3', 'z3'],
      [
        [0.1, 2, 0.2, 1, 0, 1],
        [0.01, 3, 0.03, 1, 0, 1],
        [0.2, 1, 0.1, 2, 0, 1],
        [0.05, 1, 0.05, 1, 0.01, 2],
        [0.5, 1, 0.5, 1, 0, 1],
        [0.02, 2, 0.02, 2, 0, 1],
      ],
      (v) => `${v[0]} M at charge ${v[1]} with ${v[2]} M at charge ${v[3]}`,
    ),
    relatedSlugs: ['molarity-calculator', 'henderson-hasselbalch-calculator'],
    checks: [
      { inputs: {}, expect: { i: '0.1 mol/L' } },
      { inputs: { c1: 0.1, z1: 2, c2: 0.2, z2: 1 }, expect: { i: '0.3 mol/L' } },
      { inputs: { c1: 0.01, z1: 3, c2: 0.03, z2: 1 }, expect: { i: '0.06 mol/L' } },
    ],
  },
  {
    slug: 'electrolysis-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Electrochemistry',
    title: "Electrolysis Calculator: Mass Deposited by Faraday's Law",
    h1: 'Electrolysis Calculator',
    metaDescription: "Use Faraday's law to find the mass of a metal deposited at an electrode from current, time, molar mass and electrons transferred.",
    about:
      "Faraday's laws link the amount of electricity passed through an electrolytic cell to the amount of substance changed at an electrode. Multiply current by time to get charge in coulombs, divide by Faraday's constant to get moles of electrons, then divide by the electrons needed per atom to get moles of metal. This is how electroplating baths and copper refineries are sized. Enter current in amperes, time in minutes, the molar mass of the product and the electrons transferred per atom.",
    inputs: [
      field('current', 'Current (A)', 2, 0, 100000),
      field('minutes', 'Time (minutes)', 30, 0, 1000000),
      field('mm', 'Molar mass of product (g/mol)', 63.546, 0.1, 1000),
      { ...field('n', 'Electrons per atom', 2, 1, 6), type: 'number' as const },
    ],
    outputs: [
      { name: 'mass', label: 'Mass deposited', format: 'text', highlight: true },
      { name: 'charge', label: 'Charge passed', format: 'text' },
      { name: 'moles', label: 'Moles of product', format: 'text' },
    ],
    calculate: (i) => {
      const charge = toD(i.current).mul(toD(i.minutes)).mul(60);
      const moles = charge.div(toD(i.n).mul(FARADAY));
      return { mass: `${fmtNumber(moles.mul(toD(i.mm)), 4)} g`, charge: `${fmtNumber(charge, 1)} C`, moles: `${fmtNumber(moles, 5)} mol` };
    },
    formulaDescription: 'Q = I × t. Moles of product = Q ÷ (n × F), with F = 96,485.33 C/mol. Mass = moles × molar mass.',
    workedExample:
      '2 A for 30 minutes passes 3,600 C. Copper needs 2 electrons per atom: 3,600 ÷ (2 × 96,485) = 0.01866 mol, which is 0.01866 × 63.546 = 1.1855 g.',
    faq: [
      {
        question: 'Why is the real mass sometimes lower?',
        answer:
          'Current efficiency is below 100% when some charge drives side reactions such as gas evolution, so a real deposit weighs less than this ideal figure.',
      },
      {
        question: 'What do I enter for electrons per atom?',
        answer: 'The charge on the ion being reduced: 1 for silver, 2 for copper(II) or zinc, 3 for aluminium.',
      },
      { question: 'Does it work for gases?', answer: 'Yes. The moles of product apply to a gas too, and the ideal gas law then gives its volume.' },
    ],
    scenarios: rows(
      ['current', 'minutes', 'mm', 'n'],
      [
        [1, 60, 107.87, 1],
        [5, 20, 65.38, 2],
        [10, 45, 26.982, 3],
        [0.5, 120, 58.693, 2],
        [2.5, 90, 63.546, 1],
        [20, 10, 24.305, 2],
      ],
      (v) => `${v[0]} A for ${v[1]} min, ${v[2]} g/mol, ${v[3]} e⁻`,
    ),
    introOutputs: ['mass'],
    relatedSlugs: ['cell-emf-calculator', 'grams-to-moles-calculator', 'nernst-equation-calculator'],
    checks: [
      { inputs: {}, expect: { mass: '1.1855 g', charge: '3,600 C', moles: '0.01866 mol' } },
      { inputs: { n: 1 }, expect: { mass: '2.371 g' } },
      { inputs: { current: 0 }, expect: { mass: '0 g', charge: '0 C' } },
    ],
  },
  {
    slug: 'cell-emf-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Electrochemistry',
    title: 'Cell EMF Calculator: Standard Cell Potential and ΔG°',
    h1: 'Cell EMF Calculator',
    metaDescription:
      'Subtract the anode from the cathode reduction potential to get the standard cell EMF, then read off ΔG° and whether the cell is galvanic.',
    about:
      'The standard EMF of an electrochemical cell is the difference between the reduction potentials of its two half-cells: the cathode minus the anode. A positive value means the reaction runs spontaneously and the cell can deliver current, while a negative value means it would need to be driven, as in electrolysis. Look up both standard reduction potentials in volts, enter the electrons transferred, and the calculator gives the EMF, the verdict and the matching standard Gibbs energy.',
    inputs: [
      field('cathode', 'Cathode reduction potential (V)', 0.34, -4, 4),
      field('anode', 'Anode reduction potential (V)', -0.76, -4, 4),
      { ...field('n', 'Electrons transferred', 2, 1, 12), type: 'number' as const },
    ],
    outputs: [
      { name: 'emf', label: 'Standard cell EMF', format: 'text', highlight: true },
      { name: 'verdict', label: 'Cell type', format: 'text' },
      { name: 'dg', label: 'Standard Gibbs energy', format: 'text' },
    ],
    calculate: (i) => {
      const e = toD(i.cathode).minus(toD(i.anode));
      const dg = e.isZero() ? new D(0) : toD(i.n).mul(FARADAY).mul(e).div(1000).neg();
      return {
        emf: `${fmtFixed(e, 2)} V`,
        verdict: e.isZero() ? 'At equilibrium' : e.gt(0) ? 'Galvanic (spontaneous)' : 'Electrolytic (needs input)',
        dg: `${fmtNumber(dg, 2)} kJ/mol`,
      };
    },
    formulaDescription: 'E°cell = E°cathode − E°anode. ΔG° = −n × F × E°cell, with F = 96,485.33 C/mol.',
    workedExample:
      'Copper (0.34 V) as cathode and zinc (−0.76 V) as anode: E°cell = 0.34 − (−0.76) = 1.10 V. With n = 2, ΔG° = −2 × 96,485 × 1.10 = −212.27 kJ/mol.',
    faq: [
      { question: 'Which half-cell is the anode?', answer: 'The one with the lower reduction potential, because it is the one that loses electrons.' },
      {
        question: 'Do I multiply the potential when I double the equation?',
        answer: 'No. Potential is an intensive property and does not change when the half-reaction is scaled; only n and ΔG° change.',
      },
      {
        question: 'Is EMF the voltage I will measure?',
        answer: 'Only at standard conditions and with no current drawn. Concentration, temperature and internal resistance change the reading.',
      },
    ],
    scenarios: rows(
      ['cathode', 'anode', 'n'],
      [
        [0.8, 0.34, 2],
        [0.34, -0.44, 2],
        [-0.76, 0.34, 2],
        [1.36, -2.71, 2],
        [0.8, -0.76, 2],
        [-0.13, -0.8, 1],
      ],
      (v) => `${v[0]} V cathode, ${v[1]} V anode, n = ${v[2]}`,
    ),
    introOutputs: ['emf', 'verdict'],
    relatedSlugs: ['nernst-equation-calculator', 'electrolysis-calculator', 'gibbs-free-energy-calculator'],
    checks: [
      { inputs: {}, expect: { emf: '1.10 V', verdict: 'Galvanic (spontaneous)', dg: '-212.27 kJ/mol' } },
      { inputs: { cathode: -0.76, anode: 0.34 }, expect: { emf: '-1.10 V', verdict: 'Electrolytic (needs input)', dg: '212.27 kJ/mol' } },
      { inputs: { cathode: 0.8, anode: 0.8 }, expect: { emf: '0.00 V', verdict: 'At equilibrium', dg: '0 kJ/mol' } },
    ],
  },
  {
    slug: 'radiocarbon-dating-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Nuclear chemistry',
    title: 'Radiocarbon Dating Calculator: Age from Remaining Carbon-14',
    h1: 'Radiocarbon Dating Calculator',
    metaDescription: 'Estimate the age of organic material from the percentage of carbon-14 that remains, using the 5,730 year half-life.',
    about:
      'Living things take in carbon-14 from the air until they die, and from then on it decays with a half-life of about 5,730 years. Measure how much of the original activity is left and the age follows from the decay law solved for time. The method reaches back roughly 50,000 years, after which too little carbon-14 remains to measure. Real dates also need calibration against tree rings, which this uncalibrated calculation does not include.',
    inputs: [field('pct', 'Carbon-14 remaining (% of modern)', 25, 0.0001, 100), field('half', 'Half-life (years)', 5730, 1, 1000000)],
    outputs: [
      { name: 'age', label: 'Estimated age', format: 'text', highlight: true },
      { name: 'periods', label: 'Half-lives elapsed', format: 'text' },
    ],
    calculate: (i) => {
      const half = toD(i.half);
      const periods = new D(100).div(toD(i.pct)).ln().div(LN2);
      return { age: `${fmtNumber(periods.mul(half), 0)} years`, periods: fmtNumber(periods, 3) };
    },
    formulaDescription: 't = (t½ ÷ ln 2) × ln(100 ÷ P), where P is the percentage of carbon-14 left and t½ = 5,730 years.',
    workedExample: '25% remaining is two half-lives, since 100 → 50 → 25. Age = 2 × 5,730 = 11,460 years.',
    faq: [
      {
        question: 'Why do published dates differ from this result?',
        answer:
          'Laboratories calibrate against tree rings and other records because atmospheric carbon-14 has varied over time. The raw figure is the radiocarbon age.',
      },
      {
        question: 'Which half-life should I use?',
        answer:
          "The modern value is 5,730 years. Older labs used Libby's 5,568 years, and raw radiocarbon ages are still quoted with it, so check your source.",
      },
      { question: 'What can be dated?', answer: 'Once-living material such as wood, bone, charcoal and cloth. Rocks and metals cannot be dated this way.' },
    ],
    scenarios: [90, 75, 50, 12.5, 5, 1].map((pct) => ({ label: `${pct}% carbon-14 left`, inputs: { pct } })),
    introOutputs: ['age'],
    relatedSlugs: ['half-life-calculator', 'rate-constant-calculator'],
    checks: [
      { inputs: {}, expect: { age: '11,460 years', periods: '2' } },
      { inputs: { pct: 50 }, expect: { age: '5,730 years', periods: '1' } },
      { inputs: { pct: 12.5 }, expect: { age: '17,190 years', periods: '3' } },
      { inputs: { pct: 100 }, expect: { age: '0 years' } },
    ],
  },
  {
    slug: 'degree-of-unsaturation-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Organic chemistry',
    title: 'Degree of Unsaturation Calculator from a Molecular Formula',
    h1: 'Degree of Unsaturation Calculator',
    metaDescription: 'Count the rings and pi bonds in a molecule from its formula with the degree of unsaturation, also called double bond equivalents.',
    about:
      'The degree of unsaturation, or double bond equivalents, counts how many rings and pi bonds a molecule contains, and it is the first thing an organic chemist works out from a molecular formula. Each ring or double bond removes two hydrogens from the saturated parent, and a triple bond counts as two. Enter the number of carbon, hydrogen, nitrogen and halogen atoms. Oxygen and sulfur do not change the count, so they are not asked for. A result of 4 or more in a formula with six carbons is a classic hint of a benzene ring, which spectroscopists confirm with NMR, so the number guides which structures to draw before any spectrum is read. Fractions or negatives show a miscount.',
    inputs: [
      intField('c', 'Carbon atoms', 6, 1, 200),
      intField('h', 'Hydrogen atoms', 6, 0, 500),
      intField('n', 'Nitrogen atoms', 0, 0, 50),
      intField('x', 'Halogen atoms (F, Cl, Br, I)', 0, 0, 50),
    ],
    outputs: [
      { name: 'dou', label: 'Degree of unsaturation', format: 'text', highlight: true },
      { name: 'note', label: 'What it means', format: 'text' },
    ],
    calculate: (i) => {
      const dou = toD(i.c).mul(2).plus(2).plus(toD(i.n)).minus(toD(i.h)).minus(toD(i.x)).div(2);
      if (!dou.isInteger() || dou.lt(0)) return { dou: fmtNumber(dou, 1), note: 'Not a valid neutral molecule: check the atom counts' };
      return {
        dou: fmtNumber(dou, 0),
        note: dou.isZero() ? 'Fully saturated, no rings or pi bonds' : `${fmtNumber(dou, 0)} rings or pi bonds in total (a triple bond counts as two)`,
      };
    },
    formulaDescription: 'DoU = (2C + 2 + N − H − X) ÷ 2, where C, H, N and X are the counts of carbon, hydrogen, nitrogen and halogen atoms.',
    workedExample: 'Benzene, C6H6: (2 × 6 + 2 − 6) ÷ 2 = 4, which is one ring and three double bonds. Caffeine, C8H10N4O2: (16 + 2 + 4 − 10) ÷ 2 = 6.',
    faq: [
      {
        question: 'Why are oxygen and sulfur left out?',
        answer: 'They are divalent, so inserting one into a chain or ring adds no hydrogens and does not change the count.',
      },
      { question: 'Why does nitrogen add one?', answer: 'It is trivalent, so each nitrogen lets the saturated parent carry one extra hydrogen.' },
      {
        question: 'What if the answer is a fraction?',
        answer: 'The formula cannot belong to a neutral closed-shell molecule, which usually means a counting error or a radical or ion.',
      },
    ],
    scenarios: rows(
      ['c', 'h', 'n', 'x'],
      [
        [2, 6, 0, 0],
        [4, 8, 0, 0],
        [8, 10, 4, 0],
        [2, 3, 0, 3],
        [7, 8, 0, 0],
        [10, 8, 0, 0],
      ],
      (v) => `C${v[0]}H${v[1]}${v[2] ? `N${v[2]}` : ''}${v[3] ? `X${v[3]}` : ''}`,
    ),
    introOutputs: ['dou'],
    relatedSlugs: ['molar-mass-calculator', 'percent-composition-calculator'],
    checks: [
      { inputs: {}, expect: { dou: '4', note: '4 rings or pi bonds in total (a triple bond counts as two)' } },
      { inputs: { c: 2, h: 6 }, expect: { dou: '0', note: 'Fully saturated, no rings or pi bonds' } },
      { inputs: { c: 8, h: 10, n: 4 }, expect: { dou: '6' } },
      { inputs: { c: 2, h: 5 }, expect: { note: 'Not a valid neutral molecule: check the atom counts' } },
    ],
  },
  {
    slug: 'rate-of-effusion-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Gases',
    title: "Rate of Effusion Calculator: Graham's Law for Two Gases",
    h1: 'Rate of Effusion Calculator',
    metaDescription: "Compare how fast two gases effuse through a small hole with Graham's law, from their molar masses.",
    about:
      "Graham's law states that a gas escaping through a tiny opening does so at a rate inversely proportional to the square root of its molar mass, so lighter gases leak out faster. At the same temperature and pressure, hydrogen escapes four times as quickly as oxygen. The law explains why helium balloons deflate faster than air-filled ones, and it was used to separate uranium isotopes. Enter the molar masses of the two gases to compare their rates and the times they take.",
    inputs: [field('m1', 'Molar mass of gas 1 (g/mol)', 2, 0.1, 1000), field('m2', 'Molar mass of gas 2 (g/mol)', 32, 0.1, 1000)],
    outputs: [
      { name: 'ratio', label: 'Rate of gas 1 relative to gas 2', format: 'text', highlight: true },
      { name: 'time', label: 'Time of gas 1 relative to gas 2', format: 'text' },
    ],
    calculate: (i) => {
      const ratio = D.sqrt(toD(i.m2).div(toD(i.m1)));
      return { ratio: `${fmtFixed(ratio, 3)}×`, time: `${fmtFixed(new D(1).div(ratio), 3)}×` };
    },
    formulaDescription: 'rate1 ÷ rate2 = √(M2 ÷ M1). For equal amounts of gas, the time to effuse is inversely proportional to the rate.',
    workedExample: 'Hydrogen (2 g/mol) against oxygen (32 g/mol): √(32 ÷ 2) = √16 = 4, so hydrogen effuses four times faster and takes a quarter of the time.',
    faq: [
      {
        question: 'Is effusion the same as diffusion?',
        answer:
          'Effusion is passage through a hole smaller than the mean free path. Diffusion is spreading through other gas, and it follows a similar square-root law only roughly.',
      },
      {
        question: 'Does the law depend on temperature?',
        answer: 'The ratio does not, as long as both gases are at the same temperature. Each gas speeds up with heat in the same proportion.',
      },
      {
        question: 'Can I find an unknown molar mass with it?',
        answer: 'Yes. Measure the relative rates against a known gas and rearrange to get M1 = M2 × (rate2 ÷ rate1)².',
      },
    ],
    scenarios: rows(
      ['m1', 'm2'],
      [
        [4.0026, 28.014],
        [16.043, 44.01],
        [2.016, 28.014],
        [235, 238],
        [17.031, 36.46],
        [20.18, 39.948],
      ],
      (v) => `${v[0]} g/mol against ${v[1]} g/mol`,
    ),
    introOutputs: ['ratio'],
    relatedSlugs: ['molar-mass-of-gas-calculator', 'partial-pressure-calculator'],
    checks: [
      { inputs: {}, expect: { ratio: '4.000×', time: '0.250×' } },
      { inputs: { m1: 16, m2: 16 }, expect: { ratio: '1.000×' } },
      { inputs: { m1: 4, m2: 16 }, expect: { ratio: '2.000×', time: '0.500×' } },
    ],
  },
  {
    slug: 'percent-ionic-character-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Bonding',
    title: 'Percent Ionic Character Calculator from Electronegativity',
    h1: 'Percent Ionic Character Calculator',
    metaDescription: "Estimate how ionic a bond is from the electronegativities of the two atoms with Pauling's equation.",
    about:
      'Few bonds are purely ionic or purely covalent. Pauling suggested that the ionic share of a bond grows with the difference in electronegativity between the two atoms, following an exponential that reaches 50% near a difference of 1.7. The result is a rough guide for classifying a bond as nonpolar covalent, polar covalent or ionic. Enter the Pauling electronegativities of both atoms, which you can find on any electronegativity table, in either order.',
    inputs: [field('a', 'Electronegativity of atom A', 0.93, 0.5, 4.5), field('b', 'Electronegativity of atom B', 3.16, 0.5, 4.5)],
    outputs: [
      { name: 'pct', label: 'Ionic character', format: 'text', highlight: true },
      { name: 'kind', label: 'Bond type', format: 'text' },
    ],
    calculate: (i) => {
      const diff = toD(i.a).minus(toD(i.b)).abs();
      const pct = new D(1).minus(diff.pow(2).div(4).neg().exp()).mul(100);
      return { pct: fmtPercent(pct, 1), kind: diff.lt('0.4') ? 'Nonpolar covalent' : diff.lt('1.7') ? 'Polar covalent' : 'Mostly ionic' };
    },
    formulaDescription: 'Ionic character (%) = 100 × (1 − e^(−(ΔEN)² ÷ 4)), where ΔEN is the difference in Pauling electronegativity.',
    workedExample: 'Sodium (0.93) and chlorine (3.16): ΔEN = 2.23, so (2.23)² ÷ 4 = 1.243 and the ionic character is 100 × (1 − e^-1.243) = 71.2%.',
    faq: [
      {
        question: 'Does 100% ionic ever happen?',
        answer: 'Not in practice. Even caesium fluoride, with the largest difference, retains some covalent character.',
      },
      { question: 'Why does the order not matter?', answer: 'Only the size of the difference is used, so swapping atoms A and B gives the same answer.' },
      { question: 'Are the 0.4 and 1.7 cut-offs fixed?', answer: 'They are conventions. Textbooks vary a little, and the percentage itself changes smoothly.' },
    ],
    scenarios: rows(
      ['a', 'b'],
      [
        [2.55, 2.2],
        [1, 3],
        [2.55, 3.44],
        [0.82, 3.98],
        [2.2, 3.44],
        [1.57, 3.16],
      ],
      (v) => `Electronegativity ${v[0]} with ${v[1]}`,
    ),
    introOutputs: ['pct'],
    relatedSlugs: ['bond-order-calculator', 'molar-mass-calculator'],
    checks: [
      { inputs: {}, expect: { pct: '71.2%', kind: 'Mostly ionic' } },
      { inputs: { a: 2, b: 2 }, expect: { pct: '0.0%', kind: 'Nonpolar covalent' } },
      { inputs: { a: 1, b: 3 }, expect: { pct: '63.2%', kind: 'Mostly ionic' } },
    ],
  },
  {
    slug: 'bond-order-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Bonding',
    title: 'Bond Order Calculator from Molecular Orbital Electrons',
    h1: 'Bond Order Calculator',
    metaDescription: 'Work out a bond order from the electrons in bonding and antibonding molecular orbitals and see what it says about the bond.',
    about:
      'In molecular orbital theory the bond order is half the difference between the electrons in bonding orbitals and those in antibonding orbitals. A higher order means a shorter, stronger bond: nitrogen with an order of three is notoriously hard to break. An order of zero means the molecule is not stable, which is why helium does not form He2. Count the valence electrons that fill each type of orbital, then enter the two totals.',
    inputs: [intField('bonding', 'Electrons in bonding orbitals', 8, 0, 40), intField('anti', 'Electrons in antibonding orbitals', 4, 0, 40)],
    outputs: [
      { name: 'order', label: 'Bond order', format: 'text', highlight: true },
      { name: 'meaning', label: 'Reading', format: 'text' },
    ],
    calculate: (i) => {
      const order = toD(i.bonding).minus(toD(i.anti)).div(2);
      const meaning = order.lte(0)
        ? 'No stable bond'
        : order.eq(1)
          ? 'Single bond'
          : order.eq(2)
            ? 'Double bond'
            : order.eq(3)
              ? 'Triple bond'
              : 'Fractional bond order';
      return { order: fmtNumber(order, 1), meaning };
    },
    formulaDescription: 'Bond order = (electrons in bonding orbitals − electrons in antibonding orbitals) ÷ 2.',
    workedExample:
      'Valence electrons of O2: 8 in bonding orbitals and 4 in antibonding. Bond order = (8 − 4) ÷ 2 = 2, a double bond. N2 has 8 and 2, so order 3.',
    faq: [
      {
        question: 'Can a bond order be a fraction?',
        answer: 'Yes. O2⁺ has 8 bonding and 3 antibonding electrons, giving 2.5, which is why it has a shorter bond than O2.',
      },
      {
        question: 'Which electrons do I count?',
        answer: 'The valence electrons placed in the molecular orbitals of the molecule. Core electrons cancel out and are left off.',
      },
      {
        question: 'What does a zero or negative order mean?',
        answer: 'The antibonding electrons cancel the bonding ones, so the molecule is not expected to be stable.',
      },
    ],
    scenarios: rows(
      ['bonding', 'anti'],
      [
        [8, 2],
        [2, 2],
        [8, 3],
        [6, 2],
        [8, 5],
        [7, 2],
      ],
      (v) => `${v[0]} bonding and ${v[1]} antibonding electrons`,
    ),
    introOutputs: ['order'],
    relatedSlugs: ['percent-ionic-character-calculator', 'degree-of-unsaturation-calculator'],
    checks: [
      { inputs: {}, expect: { order: '2', meaning: 'Double bond' } },
      { inputs: { bonding: 8, anti: 2 }, expect: { order: '3', meaning: 'Triple bond' } },
      { inputs: { bonding: 2, anti: 2 }, expect: { order: '0', meaning: 'No stable bond' } },
      { inputs: { bonding: 8, anti: 3 }, expect: { order: '2.5', meaning: 'Fractional bond order' } },
    ],
  },
  {
    slug: 'michaelis-menten-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Biochemistry',
    title: 'Michaelis-Menten Calculator: Enzyme Reaction Velocity',
    h1: 'Michaelis-Menten Calculator',
    metaDescription: "Find an enzyme's reaction velocity from Vmax, the Michaelis constant Km and the substrate concentration.",
    about:
      'The Michaelis-Menten equation describes how the rate of a simple enzyme-catalysed reaction climbs with substrate concentration and then levels off at a maximum velocity as the enzyme becomes saturated. Km is the substrate concentration at which the rate is half the maximum, so a small Km signals tight binding. Enter Vmax in any rate unit, Km and the substrate concentration in the same concentration unit. The velocity is returned in the unit of Vmax together with the fraction of the maximum reached.',
    inputs: [
      field('vmax', 'Maximum velocity Vmax', 100, 0, 1000000),
      field('km', 'Michaelis constant Km', 5, 0.000001, 1000000),
      field('s', 'Substrate concentration [S]', 5, 0, 1000000),
    ],
    outputs: [
      { name: 'v', label: 'Reaction velocity', format: 'text', highlight: true },
      { name: 'fraction', label: 'Share of Vmax', format: 'text' },
    ],
    calculate: (i) => {
      const fraction = toD(i.s).div(toD(i.km).plus(toD(i.s)));
      return { v: fmtNumber(toD(i.vmax).mul(fraction), 3), fraction: fmtPercent(fraction.mul(100), 1) };
    },
    formulaDescription: 'v = Vmax × [S] ÷ (Km + [S]). At [S] = Km the velocity is exactly Vmax ÷ 2.',
    workedExample: 'Vmax = 100 and Km = 5. At [S] = 5, v = 100 × 5 ÷ 10 = 50, which is 50.0% of Vmax. At [S] = 45, v = 100 × 45 ÷ 50 = 90.',
    faq: [
      {
        question: 'Why does the rate level off?',
        answer: 'Once every enzyme molecule is busy, extra substrate cannot be processed any faster, and the velocity approaches Vmax.',
      },
      {
        question: 'How do I find Km from data?',
        answer: 'Plot velocity against concentration and read the concentration at half Vmax, or fit a Lineweaver-Burk line to get Km and Vmax together.',
      },
      { question: 'Does the model fit every enzyme?', answer: 'No. Allosteric enzymes give an S-shaped curve and inhibitors change the apparent Km or Vmax.' },
    ],
    scenarios: rows(
      ['vmax', 'km', 's'],
      [
        [100, 5, 45],
        [250, 0.8, 2],
        [40, 12, 3],
        [75, 2.5, 25],
        [500, 100, 100],
        [12, 0.05, 0.5],
      ],
      (v) => `Vmax ${v[0]}, Km ${v[1]}, [S] ${v[2]}`,
    ),
    introOutputs: ['v'],
    relatedSlugs: ['langmuir-isotherm-calculator', 'rate-constant-calculator'],
    checks: [
      { inputs: {}, expect: { v: '50', fraction: '50.0%' } },
      { inputs: { s: 45 }, expect: { v: '90', fraction: '90.0%' } },
      { inputs: { s: 15 }, expect: { v: '75' } },
      { inputs: { s: 0 }, expect: { v: '0', fraction: '0.0%' } },
    ],
  },
  {
    slug: 'langmuir-isotherm-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Surfaces',
    title: 'Langmuir Isotherm Calculator: Surface Coverage and Uptake',
    h1: 'Langmuir Isotherm Calculator',
    metaDescription: 'Calculate the fraction of surface sites covered by an adsorbed gas, and the amount adsorbed, from K, pressure and monolayer capacity.',
    about:
      'The Langmuir isotherm models a gas sticking to a surface that has a fixed number of identical sites, each holding one molecule. At low pressure coverage rises in proportion to pressure, and at high pressure it levels off as the sites fill, approaching a single complete layer. The adsorption constant K measures how strongly the gas binds. Enter K in inverse pressure units, the pressure, and the monolayer capacity to see the coverage and the uptake per gram of adsorbent.',
    inputs: [
      field('k', 'Adsorption constant K (1/kPa)', 0.5, 0, 100000),
      field('p', 'Pressure (kPa)', 2, 0, 1000000),
      field('qmax', 'Monolayer capacity (mmol/g)', 4, 0, 100000),
    ],
    outputs: [
      { name: 'theta', label: 'Surface coverage', format: 'text', highlight: true },
      { name: 'q', label: 'Amount adsorbed', format: 'text' },
    ],
    calculate: (i) => {
      const kp = toD(i.k).mul(toD(i.p));
      const theta = kp.div(new D(1).plus(kp));
      return { theta: fmtPercent(theta.mul(100), 1), q: `${fmtNumber(theta.mul(toD(i.qmax)), 3)} mmol/g` };
    },
    formulaDescription: 'θ = K × P ÷ (1 + K × P). Amount adsorbed = θ × monolayer capacity.',
    workedExample: 'K = 0.5 per kPa at 2 kPa gives KP = 1, so θ = 1 ÷ 2 = 50.0% and, with a capacity of 4 mmol/g, 2 mmol/g is adsorbed.',
    faq: [
      {
        question: 'What are the assumptions of the model?',
        answer: 'One layer only, identical sites, no interaction between neighbouring molecules and a fixed energy of adsorption.',
      },
      { question: 'What does a large K tell me?', answer: 'Strong binding: the surface fills at a low pressure.' },
      {
        question: 'When does the model fail?',
        answer: 'For multilayer adsorption, for heterogeneous surfaces and near the condensation pressure, where BET or Freundlich models do better.',
      },
    ],
    scenarios: rows(
      ['k', 'p', 'qmax'],
      [
        [0.5, 18, 4],
        [0.05, 10, 2.5],
        [2, 0.5, 6],
        [0.01, 200, 10],
        [0.2, 5, 1.5],
        [1.2, 3, 8],
      ],
      (v) => `K ${v[0]}, ${v[1]} kPa, capacity ${v[2]}`,
    ),
    introOutputs: ['theta'],
    relatedSlugs: ['michaelis-menten-calculator', 'partial-pressure-calculator'],
    checks: [
      { inputs: {}, expect: { theta: '50.0%', q: '2 mmol/g' } },
      { inputs: { p: 18 }, expect: { theta: '90.0%', q: '3.6 mmol/g' } },
      { inputs: { p: 0 }, expect: { theta: '0.0%', q: '0 mmol/g' } },
    ],
  },
  {
    slug: 'stp-gas-volume-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Gases',
    title: 'STP Gas Volume Calculator: Litres from Moles at Standard Conditions',
    h1: 'STP Gas Volume Calculator',
    metaDescription: 'Convert moles of an ideal gas to litres at standard temperature and pressure, using both the 1 atm and the 1 bar definitions.',
    about:
      'Standard temperature and pressure fix a reference state for comparing gases, but there are two in common use. The older definition is 0 °C and 1 atmosphere, where one mole of ideal gas fills 22.414 litres. IUPAC now defines it at 0 °C and 1 bar, a slightly lower pressure, where the molar volume is 22.711 litres. Enter the number of moles and the calculator gives the volume under both, so you can match whichever your textbook or data sheet uses.',
    inputs: [field('n', 'Amount of gas (mol)', 1, 0, 1000000)],
    outputs: [
      { name: 'atm', label: 'Volume at 0 °C and 1 atm', format: 'text', highlight: true },
      { name: 'bar', label: 'Volume at 0 °C and 1 bar', format: 'text' },
    ],
    calculate: (i) => {
      const nrt = toD(i.n).mul(R_GAS).mul('273.15');
      return { atm: `${fmtNumber(nrt.div('101.325'), 3)} L`, bar: `${fmtNumber(nrt.div(100), 3)} L` };
    },
    formulaDescription: 'V = n × R × T ÷ P with T = 273.15 K and R = 8.314462618 L·kPa/(mol·K). P = 101.325 kPa for 1 atm and 100 kPa for 1 bar.',
    workedExample: 'One mole at 273.15 K: 8.314462618 × 273.15 = 2,271.0 L·kPa. Divided by 101.325 kPa that is 22.414 L, and by 100 kPa it is 22.711 L.',
    faq: [
      {
        question: 'Which STP should I use?',
        answer: 'The one your source states. Many school textbooks use 1 atm, while current IUPAC data and many data sheets use 1 bar.',
      },
      {
        question: 'Is room temperature the same as STP?',
        answer: 'No. At 25 °C and 1 atm one mole occupies about 24.5 L, so using 22.4 L at room temperature underestimates the volume.',
      },
      { question: 'Does it work for every gas?', answer: 'It assumes ideal behaviour, which is a good approximation for most gases at these conditions.' },
    ],
    scenarios: [0.25, 0.5, 2, 3.5, 5, 10].map((n) => ({ label: `${n} mol of gas`, inputs: { n } })),
    introOutputs: ['atm'],
    relatedSlugs: ['molar-mass-of-gas-calculator', 'partial-pressure-calculator', 'grams-to-moles-calculator'],
    checks: [
      { inputs: {}, expect: { atm: '22.414 L', bar: '22.711 L' } },
      { inputs: { n: 2 }, expect: { atm: '44.828 L', bar: '45.422 L' } },
      { inputs: { n: 0.5 }, expect: { atm: '11.207 L', bar: '11.355 L' } },
    ],
  },
  {
    slug: 'molar-mass-of-gas-calculator',
    category: 'chemistry',
    tier: 3,
    subCluster: 'Gases',
    title: 'Molar Mass of a Gas Calculator from Density, Pressure and Temperature',
    h1: 'Molar Mass of a Gas Calculator',
    metaDescription: 'Find the molar mass of an ideal gas from its density, temperature and pressure with M = dRT/P.',
    about:
      'The density of a gas depends on its molar mass, temperature and pressure, so a measured density lets you work the molar mass out and often identify the gas. The ideal gas law rearranged gives the molar mass as density times the gas constant times the temperature, divided by the pressure. This is the Dumas method taught in general chemistry labs. Enter the density in grams per litre, the temperature in kelvin and the pressure in kilopascals.',
    inputs: [
      field('d', 'Density (g/L)', 1.429, 0.000001, 100000),
      field('t', 'Temperature (K)', 273.15, 1, 5000),
      field('p', 'Pressure (kPa)', 101.325, 0.001, 10000000),
    ],
    outputs: [{ name: 'm', label: 'Molar mass', format: 'text', highlight: true }],
    calculate: (i) => ({ m: `${fmtNumber(toD(i.d).mul(R_GAS).mul(toD(i.t)).div(toD(i.p)), 2)} g/mol` }),
    formulaDescription: 'M = d × R × T ÷ P, from PV = nRT with n = mass ÷ M. R = 8.314462618 L·kPa/(mol·K), T in kelvin and P in kPa.',
    workedExample: 'Oxygen has a density of 1.429 g/L at 273.15 K and 101.325 kPa: M = 1.429 × 8.314 × 273.15 ÷ 101.325 = 32.03 g/mol.',
    faq: [
      {
        question: 'How do I measure the density?',
        answer:
          'Weigh a flask of known volume empty and full of the gas at a recorded temperature and pressure, then divide the mass difference by the volume.',
      },
      {
        question: 'Why might my answer be off?',
        answer: 'Real gases deviate from the ideal law at high pressure or low temperature, and moisture in the flask changes the mass.',
      },
      {
        question: 'Can it identify a gas?',
        answer: 'It narrows the choice. Compare the result with the molar masses of likely candidates such as 28 for nitrogen or 44 for carbon dioxide.',
      },
    ],
    scenarios: rows(
      ['d', 't', 'p'],
      [
        [1.25, 273.15, 101.325],
        [0.0899, 273.15, 101.325],
        [1.977, 273.15, 101.325],
        [1.784, 298.15, 101.325],
        [2.9, 298.15, 101.325],
        [0.717, 273.15, 101.325],
      ],
      (v) => `${v[0]} g/L at ${v[1]} K and ${v[2]} kPa`,
    ),
    relatedSlugs: ['stp-gas-volume-calculator', 'rate-of-effusion-calculator', 'molar-mass-calculator'],
    checks: [
      { inputs: {}, expect: { m: '32.03 g/mol' } },
      { inputs: { d: 1.25 }, expect: { m: '28.02 g/mol' } },
      { inputs: { d: 0.0899 }, expect: { m: '2.02 g/mol' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
