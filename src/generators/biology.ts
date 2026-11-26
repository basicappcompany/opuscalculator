import { z } from 'zod';
import { selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtFixed, fmtNumber } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { field, intField, rows, sci } from '../lib/spec-helpers';
import type { CalculatorConfig, Scenario } from '../lib/types';

/**
 * Catalog batch 4 (biology): bench laboratory, population genetics, Mendelian crosses and protein mass. Constants
 * are stated in the formula text. Biology is a YMYL category, so every page carries the disclaimer and a review date.
 * All pages are tier 2 or 3, so none is live until the cohort gate opens.
 */

const AVOGADRO = new D('6.02214076e23');
const LN2 = new D(2).ln();

const select = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});

const clean = (v: unknown) => String(v).replace(/\s+/g, '').toUpperCase();

/** A sequence input: letters from one alphabet, whitespace ignored. */
const seq = (name: string, label: string, def: string, alphabet: string, min: number, max: number) => ({
  name,
  label,
  type: 'text' as const,
  default: def,
  validator: z.string().refine(
    (v) => {
      const s = clean(v);
      return s.length >= min && s.length <= max && [...s].every((c) => alphabet.includes(c));
    },
    `Use only the letters ${[...alphabet].join(', ')} (${min} to ${max} letters)`,
  ),
});

const withInputs = (label: string, inputs: Scenario['inputs']): Scenario => ({ label, inputs });

// Melting temperature of a primer: Wallace rule below 14 nt, the basic GC formula from 14 nt up.
const primerTm = (s: string) => {
  let gc = 0;
  for (const c of s) if (c === 'G' || c === 'C') gc++;
  const n = s.length;
  if (n < 14) return new D(2).mul(n - gc).add(new D(4).mul(gc));
  return new D('64.9').add(new D(41).mul(new D(gc).sub('16.4')).div(n));
};

// Chance that a gamete from a parent with this genotype carries the dominant allele (uppercase letters).
const transmit = (genotype: string) => new D([...genotype].filter((c) => c === c.toUpperCase()).length).div(2);
// Chance that an offspring shows the dominant phenotype, under complete dominance.
const domChance = (a: string, b: string) => new D(1).sub(new D(1).sub(transmit(a)).mul(new D(1).sub(transmit(b))));

const geno = (name: string, label: string, letter: string, def: string) =>
  select(name, label, def, [
    [`${letter}${letter}`.toUpperCase(), `${letter.toUpperCase()}${letter.toUpperCase()} (homozygous dominant)`],
    [`${letter.toUpperCase()}${letter.toLowerCase()}`, `${letter.toUpperCase()}${letter.toLowerCase()} (heterozygous)`],
    [`${letter.toLowerCase()}${letter.toLowerCase()}`, `${letter.toLowerCase()}${letter.toLowerCase()} (homozygous recessive)`],
  ]);

const CODON_TABLE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
const BASE_INDEX: Record<string, number> = { T: 0, C: 1, A: 2, G: 3 };
const RESIDUE_MASS: Record<string, string> = {
  A: '71.0788',
  C: '103.1388',
  D: '115.0886',
  E: '129.1155',
  F: '147.1766',
  G: '57.0519',
  H: '137.1411',
  I: '113.1594',
  K: '128.1741',
  L: '113.1594',
  M: '131.1926',
  N: '114.1038',
  P: '97.1167',
  Q: '128.1307',
  R: '156.1875',
  S: '87.0782',
  T: '101.1051',
  V: '99.1326',
  W: '186.2132',
  Y: '163.1760',
};

export const SPECS: Spec[] = [
  {
    slug: 'annealing-temperature-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Bio laboratory',
    title: 'PCR Annealing Temperature Calculator for Primer Pairs',
    h1: 'Annealing Temperature Calculator',
    metaDescription: 'Paste a forward and a reverse primer to get each melting temperature and a starting annealing temperature for your PCR program.',
    about:
      'In PCR the annealing step lets the primers bind the template, and the right temperature depends on the primers. Too low and they bind at the wrong places, giving extra bands; too high and they barely bind, giving little product. Paste the forward and reverse primer sequences and the calculator counts the G and C bases, finds the melting temperature of each primer, and suggests an annealing temperature five degrees below the lower of the two. Primers of 14 bases or more use the basic GC formula; shorter ones use the Wallace rule. Treat the result as a starting point for a gradient run, because salt, polymerase buffer and additives shift the true optimum by several degrees.',
    inputs: [
      seq('fwd', "Forward primer (5' to 3')", 'ATGCCGTAAGCTTGCAGCTA', 'ACGT', 10, 60),
      seq('rev', "Reverse primer (5' to 3')", 'GCTAGCCATGGCATTCGACG', 'ACGT', 10, 60),
    ],
    outputs: [
      { name: 'ta', label: 'Suggested annealing temperature', format: 'text', highlight: true },
      { name: 'tm1', label: 'Forward primer Tm', format: 'text' },
      { name: 'tm2', label: 'Reverse primer Tm', format: 'text' },
      { name: 'gap', label: 'Tm difference between primers', format: 'text' },
    ],
    calculate: (i) => {
      const t1 = primerTm(clean(i.fwd));
      const t2 = primerTm(clean(i.rev));
      return {
        ta: `${fmtFixed(D.min(t1, t2).sub(5), 1)} °C`,
        tm1: `${fmtFixed(t1, 1)} °C`,
        tm2: `${fmtFixed(t2, 1)} °C`,
        gap: `${fmtFixed(t1.sub(t2).abs(), 1)} °C`,
      };
    },
    formulaDescription:
      'For a primer of N bases with G+C bases counted: Tm = 64.9 + 41 × (G+C − 16.4) ÷ N for N of 14 or more, and Tm = 2 × (A+T) + 4 × (G+C) below 14. Annealing temperature = the lower Tm − 5 °C.',
    workedExample:
      'A 20-base primer with 10 G or C bases has Tm = 64.9 + 41 × (10 − 16.4) ÷ 20 = 51.8 °C. If the partner primer has 12 G or C bases its Tm is 55.9 °C, so the annealing temperature starts at 51.8 − 5 = 46.8 °C.',
    faq: [
      {
        question: 'Why subtract five degrees from the lower Tm?',
        answer:
          'Annealing a little under the melting temperature keeps both primers bound reliably. It is a common starting rule; a temperature gradient run finds the real optimum.',
      },
      {
        question: 'My primers differ by more than five degrees. Is that a problem?',
        answer:
          'Large gaps make it hard to suit both primers at one temperature. Redesign one of them so the two melting temperatures sit within about two degrees.',
      },
      {
        question: 'Does this account for salt or DMSO?',
        answer:
          'No. The basic formula ignores salt, magnesium and additives, which change the real melting temperature. Nearest-neighbour tools from polymerase makers model those effects.',
      },
    ],
    scenarios: [
      withInputs('Primers with moderate GC content', { fwd: 'ATGCCGTAAGCTTGCAGCTA', rev: 'GCTAGCCATGGCATTCGACG' }),
      withInputs('A pair rich in G and C', { fwd: 'GCGGCCGCTAGCGGATCCGC', rev: 'CCGGCGCTAGCGCCGGATCG' }),
      withInputs('An AT-rich pair', { fwd: 'ATAATTTAGCATATTAACGT', rev: 'TTAAATGCATAATTTCAGAT' }),
      withInputs('A pair of 24-mers', { fwd: 'ACGTTGACCGATAGCTTACGGATC', rev: 'GGATCCATTGCAAGCTTCGAGTAC' }),
      withInputs('A short 12-base pair', { fwd: 'GCATGCATGCAT', rev: 'CGTACGTACGTA' }),
    ],
    introOutputs: ['ta', 'tm1'],
    relatedSlugs: ['dna-concentration-calculator', 'qpcr-efficiency-calculator'],
    checks: [
      { inputs: {}, expect: { ta: '46.8 °C', tm1: '51.8 °C', tm2: '55.9 °C', gap: '4.1 °C' } },
      { inputs: { fwd: 'GCGCGCGCGC', rev: 'ATATATATAT' }, expect: { ta: '15.0 °C', tm1: '40.0 °C', tm2: '20.0 °C' } },
      { inputs: { fwd: 'gcgcgcgcgcatatatatat', rev: 'GCGCGCGCGCATATATATAT' }, expect: { ta: '46.8 °C', gap: '0.0 °C' } },
    ],
  },
  {
    slug: 'generation-time-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Bio laboratory',
    title: 'Generation Time Calculator: Bacterial Growth Rate and Doublings',
    h1: 'Generation Time Calculator',
    metaDescription: 'Work out how many generations a culture went through and the generation time from two counts and the time between them.',
    about:
      'The generation time of a culture is how long a cell population takes to double during exponential growth. Take two counts, for instance colony-forming units or an optical density converted to cells, from the same culture a known time apart. The ratio of the counts gives the number of doublings, and dividing the elapsed time by that number gives the generation time. Escherichia coli in rich medium at 37 degrees divides about every 20 minutes, while many soil bacteria take hours. The calculation holds only while the culture grows exponentially: lag phase at the start and the plateau at the end both make the apparent time longer, so choose two points on the straight part of a semi-log plot.',
    inputs: [
      field('n0', 'Initial count (cells/mL)', 1000, 0.000001, 1e15),
      field('n', 'Final count (cells/mL)', 16000, 0.000001, 1e18),
      field('t', 'Time between counts (min)', 120, 0.1, 100000),
    ],
    outputs: [
      { name: 'g', label: 'Generation time', format: 'text', highlight: true },
      { name: 'gens', label: 'Generations (doublings)', format: 'text' },
      { name: 'mu', label: 'Specific growth rate', format: 'text' },
    ],
    calculate: (i) => {
      const n0 = toD(i.n0),
        n = toD(i.n),
        t = toD(i.t);
      if (n.lte(n0)) return { g: 'Final count must exceed the initial count', gens: '-', mu: '-' };
      const ratioLn = n.div(n0).ln();
      const gens = ratioLn.div(LN2);
      return { g: `${fmtNumber(t.div(gens), 2)} min`, gens: fmtNumber(gens, 2), mu: `${fmtNumber(ratioLn.div(t), 4)} per min` };
    },
    formulaDescription: 'Generations n = ln(N ÷ N0) ÷ ln 2 = log2(N ÷ N0). Generation time g = t ÷ n. Specific growth rate μ = ln(N ÷ N0) ÷ t = ln 2 ÷ g.',
    workedExample:
      'A culture grows from 1,000 to 16,000 cells per mL in 120 minutes. N ÷ N0 = 16, so n = log2(16) = 4 doublings, g = 120 ÷ 4 = 30 minutes, and μ = ln 16 ÷ 120 = 0.0231 per minute.',
    faq: [
      {
        question: 'Can I use optical density instead of counts?',
        answer:
          'Yes, while density and cell number stay proportional, usually below an OD600 of about 0.4 to 0.6. Beyond that the readings flatten and the time looks too long.',
      },
      {
        question: 'What is the difference between generation time and growth rate?',
        answer:
          'Generation time is how long one doubling takes. The specific growth rate is the fraction of the population added per unit time. They are linked by μ = ln 2 ÷ g.',
      },
      {
        question: 'Why is my generation time longer than the textbook value?',
        answer:
          'The counts probably span lag phase or the approach to plateau. Use two points from the exponential phase, in the same medium and temperature as the reference.',
      },
    ],
    scenarios: rows(
      ['n0', 'n', 't'],
      [
        [1000, 16000, 120],
        [500, 4000, 90],
        [1e6, 4e6, 100],
        [2e4, 5e7, 300],
        [100, 1e5, 240],
        [8e5, 1e7, 75],
      ],
      (v) => `A culture rising from ${v[0]} to ${v[1]} cells per mL over ${v[2]} minutes`,
    ),
    introOutputs: ['g', 'gens'],
    relatedSlugs: ['cell-doubling-time-calculator', 'log-reduction-calculator'],
    checks: [
      { inputs: {}, expect: { g: '30 min', gens: '4', mu: '0.0231 per min' } },
      { inputs: { n0: 100, n: 800, t: 90 }, expect: { g: '30 min', gens: '3' } },
      { inputs: { n0: 1e6, n: 4e6, t: 100 }, expect: { g: '50 min', gens: '2' } },
    ],
  },
  {
    slug: 'cell-doubling-time-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Bio laboratory',
    title: 'Cell Doubling Time Calculator: Predict Cell Numbers',
    h1: 'Cell Doubling Time Calculator',
    metaDescription: 'Predict cell numbers after a given time from the starting count and the doubling time, and find the hours needed to reach a target.',
    about:
      'Cell culture planning often runs forward from a known doubling time: how many cells will there be on Friday, and when will the flask be ready to split? Many adherent lines such as HeLa double in 20 to 24 hours, primary cells and stem cells are slower, and yeast can double in 90 minutes. Give the number of cells you seed, the doubling time and the time elapsed, and the calculator returns the expected count. Give a target count as well and it returns the hours needed to reach it. Growth stays exponential only at low to moderate density, so cells near confluence grow more slowly than predicted. Use the result to schedule passages and to decide how many cells to seed for an assay.',
    inputs: [
      field('n0', 'Starting cells', 100000, 1, 1e15),
      field('td', 'Doubling time (h)', 24, 0.1, 1000),
      field('t', 'Elapsed time (h)', 72, 0, 100000),
      field('target', 'Target cell number', 2000000, 1, 1e18),
    ],
    outputs: [
      { name: 'cells', label: 'Expected cells after the elapsed time', format: 'text', highlight: true },
      { name: 'doublings', label: 'Doublings in that time', format: 'text' },
      { name: 'toTarget', label: 'Time to reach the target', format: 'text' },
    ],
    calculate: (i) => {
      const n0 = toD(i.n0),
        td = toD(i.td),
        t = toD(i.t),
        target = toD(i.target);
      const doublings = t.div(td);
      const cells = n0.mul(new D(2).pow(doublings));
      const toTarget = target.lte(n0) ? 'The target is already reached' : `${fmtNumber(target.div(n0).ln().div(LN2).mul(td), 1)} h`;
      return { cells: fmtNumber(cells, 0), doublings: fmtNumber(doublings, 2), toTarget };
    },
    formulaDescription: 'Cells = N0 × 2^(t ÷ td). Time to reach a target T = td × log2(T ÷ N0) = td × ln(T ÷ N0) ÷ ln 2.',
    workedExample:
      '100,000 cells with a 24-hour doubling time, left 72 hours, go through 3 doublings, giving 100,000 × 8 = 800,000 cells. To reach 2,000,000 takes 24 × log2(20) = 103.7 hours.',
    faq: [
      {
        question: 'How do I measure the doubling time in the first place?',
        answer: 'Count cells at two times during exponential growth and use the generation time calculator, or fit a line to the logarithm of several counts.',
      },
      {
        question: 'Why do my cells stop short of the prediction?',
        answer:
          'Confluence, nutrient depletion and contact inhibition slow growth. The model assumes unlimited space and medium, so it overestimates late in a culture.',
      },
      {
        question: 'Does it matter that some cells die?',
        answer:
          'Yes. The doubling time here is the net one. If viability is low, measure the doubling time on live cells only, or the prediction will run high.',
      },
    ],
    scenarios: rows(
      ['n0', 'td', 't', 'target'],
      [
        [100000, 24, 72, 2000000],
        [5e5, 36, 96, 1e7],
        [2e5, 20, 48, 1e6],
        [1e4, 48, 240, 5e6],
        [3e6, 18, 36, 1e8],
        [1e5, 28, 56, 4e5],
      ],
      (v) => `Seeding ${v[0]} cells that double every ${v[1]} hours`,
    ),
    introOutputs: ['cells', 'toTarget'],
    relatedSlugs: ['generation-time-calculator', 'cell-dilution-calculator'],
    checks: [
      { inputs: {}, expect: { cells: '800,000', doublings: '3', toTarget: '103.7 h' } },
      { inputs: { t: 24 }, expect: { cells: '200,000', doublings: '1' } },
      { inputs: { target: 50000 }, expect: { toTarget: 'The target is already reached' } },
    ],
  },
  {
    slug: 'cell-dilution-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Bio laboratory',
    title: 'Cell Dilution Calculator: Seeding Volume and Medium',
    h1: 'Cell Dilution Calculator',
    metaDescription: 'Find how much cell suspension and fresh medium to combine to reach a desired cell density in a chosen final volume.',
    about:
      'Seeding a plate or a flask means turning a counted stock of cells into a suspension at the density the experiment needs. If the stock holds 1,000,000 cells per mL and the plate needs 100,000 per mL in 10 mL, the answer is to take 1 mL of stock and add 9 mL of medium. The calculator applies the dilution equation to the cell densities and gives both volumes plus the fold dilution. Mix the stock well before pipetting, because cells settle within minutes and the first aliquot would otherwise be too thin. If the stock is more dilute than the target you must concentrate the cells by centrifugation instead; the tool flags that case. Counts from a haemocytometer or automated counter go straight into the stock field.',
    inputs: [
      field('c1', 'Stock density (cells/mL)', 1000000, 1, 1e12),
      field('c2', 'Desired density (cells/mL)', 100000, 1, 1e12),
      field('vf', 'Final volume (mL)', 10, 0.01, 100000),
    ],
    outputs: [
      { name: 'stock', label: 'Volume of cell suspension', format: 'text', highlight: true },
      { name: 'medium', label: 'Volume of medium to add', format: 'text' },
      { name: 'fold', label: 'Dilution factor', format: 'text' },
    ],
    calculate: (i) => {
      const c1 = toD(i.c1),
        c2 = toD(i.c2),
        vf = toD(i.vf);
      if (c2.gt(c1)) return { stock: 'Desired density exceeds the stock density', medium: '-', fold: '-' };
      const v1 = c2.mul(vf).div(c1);
      return { stock: `${fmtNumber(v1, 3)} mL`, medium: `${fmtNumber(vf.sub(v1), 3)} mL`, fold: `${fmtNumber(c1.div(c2), 2)}-fold` };
    },
    formulaDescription: 'C1 × V1 = C2 × V2, so the stock volume V1 = C2 × V2 ÷ C1. Medium = V2 − V1. Dilution factor = C1 ÷ C2.',
    workedExample:
      'To make 10 mL at 100,000 cells per mL from a stock at 1,000,000 cells per mL, V1 = 100,000 × 10 ÷ 1,000,000 = 1 mL. Add 9 mL of medium; the dilution is 10-fold.',
    faq: [
      {
        question: 'Do I need the total cell number as well?',
        answer: 'Total cells is the density times the volume. For 10 mL at 100,000 per mL the plate receives 1,000,000 cells in all.',
      },
      {
        question: 'What if I seed several wells?',
        answer: 'Add the volume per well for all wells plus a 10 percent overage for pipetting losses, and use that as the final volume.',
      },
      {
        question: 'Is this the same as a chemical C1V1 calculation?',
        answer: 'The algebra is identical. Only the units differ: cells per mL instead of moles per litre.',
      },
    ],
    scenarios: rows(
      ['c1', 'c2', 'vf'],
      [
        [1e6, 1e5, 10],
        [2.5e6, 2e5, 50],
        [8e5, 5e4, 24],
        [4e6, 1e6, 12],
        [1.2e6, 3e5, 6],
        [5e6, 2.5e5, 100],
      ],
      (v) => `A stock of ${v[0]} cells per mL diluted to ${v[1]} for ${v[2]} mL`,
    ),
    introOutputs: ['stock', 'medium'],
    relatedSlugs: ['cell-doubling-time-calculator', 'log-reduction-calculator'],
    checks: [
      { inputs: {}, expect: { stock: '1 mL', medium: '9 mL', fold: '10-fold' } },
      { inputs: { c1: 2500000, c2: 200000, vf: 50 }, expect: { stock: '4 mL', medium: '46 mL', fold: '12.5-fold' } },
      { inputs: { c1: 1000000, c2: 500000, vf: 2 }, expect: { stock: '1 mL', medium: '1 mL', fold: '2-fold' } },
    ],
  },
  {
    slug: 'dna-concentration-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Bio laboratory',
    title: 'DNA Concentration Calculator from A260 Absorbance',
    h1: 'DNA Concentration Calculator',
    metaDescription: 'Convert an A260 reading and dilution factor into the concentration of DNA or RNA in ng/µL, with a purity ratio and total yield.',
    about:
      'A spectrophotometer measures how strongly a nucleic acid sample absorbs ultraviolet light at 260 nanometres, and that absorbance is proportional to concentration. One absorbance unit corresponds to about 50 ng/µL of double-stranded DNA, 40 ng/µL of RNA and 33 ng/µL of single-stranded DNA or an oligonucleotide. Enter the reading, any dilution you made before measuring and the sample type, and the calculator returns the concentration of the original sample. Add the A280 reading and it reports the A260/A280 ratio, a quick purity check: about 1.8 for clean DNA and 2.0 for clean RNA, with lower values pointing to protein or phenol. Enter the elution volume as well to see the total yield in micrograms, which tells you whether a miniprep, a column kit or a phenol extraction gave enough material for sequencing, digestion or transfection.',
    inputs: [
      field('a260', 'A260 reading', 0.5, 0.001, 10),
      field('a280', 'A280 reading', 0.27, 0.001, 10),
      field('dil', 'Dilution factor', 50, 1, 100000),
      select('type', 'Sample type', 'dsdna', [
        ['dsdna', 'Double-stranded DNA (50)'],
        ['ssdna', 'Single-stranded DNA (33)'],
        ['rna', 'RNA (40)'],
      ]),
      field('vol', 'Sample volume (µL)', 50, 0.1, 100000),
    ],
    outputs: [
      { name: 'conc', label: 'Concentration', format: 'text', highlight: true },
      { name: 'ratio', label: 'A260/A280 ratio', format: 'text' },
      { name: 'yield', label: 'Total yield', format: 'text' },
    ],
    calculate: (i) => {
      const factor = { dsdna: 50, ssdna: 33, rna: 40 }[String(i.type)] ?? 50;
      const conc = toD(i.a260).mul(factor).mul(toD(i.dil));
      return {
        conc: `${fmtNumber(conc, 1)} ng/µL`,
        ratio: fmtFixed(toD(i.a260).div(toD(i.a280)), 2),
        yield: `${fmtNumber(conc.mul(toD(i.vol)).div(1000), 2)} µg`,
      };
    },
    formulaDescription:
      'Concentration (ng/µL) = A260 × conversion factor × dilution factor, with a factor of 50 for dsDNA, 33 for ssDNA and 40 for RNA. Purity ratio = A260 ÷ A280. Yield (µg) = concentration × volume (µL) ÷ 1,000.',
    workedExample:
      'A260 = 0.5 on a 1-in-50 dilution of double-stranded DNA: 0.5 × 50 × 50 = 1,250 ng/µL. With A280 = 0.27 the ratio is 1.85, close to the 1.8 expected for pure DNA, and 50 µL holds 62.5 µg.',
    faq: [
      {
        question: 'What does a low A260/A280 ratio mean?',
        answer: 'Protein or phenol carry-over, which absorb near 280 nm. A ratio well under 1.7 for DNA suggests the sample needs another clean-up.',
      },
      {
        question: 'Why dilute the sample before reading?',
        answer: 'Instruments are accurate for absorbances of roughly 0.1 to 1.0. Dilute concentrated samples into that range and enter the dilution factor.',
      },
      {
        question: 'Does a high ratio also signal a problem?',
        answer: 'It can: a ratio above 2.0 for DNA may indicate RNA contamination. A fluorescence assay is more specific than absorbance.',
      },
    ],
    scenarios: [
      withInputs('A plasmid prep read at a 1-in-50 dilution', { a260: 0.5, a280: 0.27, dil: 50, type: 'dsdna', vol: 50 }),
      withInputs('An RNA extract diluted ten times', { a260: 0.4, a280: 0.2, dil: 10, type: 'rna', vol: 30 }),
      withInputs('An oligonucleotide stock diluted 100-fold', { a260: 0.2, a280: 0.11, dil: 100, type: 'ssdna', vol: 100 }),
      withInputs('Genomic DNA read undiluted', { a260: 0.12, a280: 0.065, dil: 1, type: 'dsdna', vol: 200 }),
      withInputs('A weak RNA sample read straight from the tube', { a260: 0.08, a280: 0.04, dil: 1, type: 'rna', vol: 20 }),
    ],
    introOutputs: ['conc', 'yield'],
    relatedSlugs: ['dna-copy-number-calculator', 'protein-concentration-calculator'],
    checks: [
      { inputs: {}, expect: { conc: '1,250 ng/µL', ratio: '1.85', yield: '62.5 µg' } },
      { inputs: { a260: 0.4, a280: 0.2, dil: 10, type: 'rna', vol: 30 }, expect: { conc: '160 ng/µL', ratio: '2.00', yield: '4.8 µg' } },
      { inputs: { a260: 0.2, dil: 100, type: 'ssdna' }, expect: { conc: '660 ng/µL' } },
    ],
  },
  {
    slug: 'ligation-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Bio laboratory',
    title: 'Ligation Calculator: Insert to Vector Mass Ratio',
    h1: 'Ligation Calculator',
    metaDescription: 'Calculate how many nanograms of insert to add to a ligation from the vector mass, both lengths and the molar ratio you want.',
    about:
      "A cloning ligation works best when the ends of insert and vector are present in a chosen molar ratio, commonly three inserts to one vector. Because a long piece weighs more than a short one, equal masses are not equal numbers of molecules, so the insert mass has to be scaled by the length ratio. Enter the vector mass you plan to use, the vector and insert lengths in base pairs and the molar ratio, and the calculator gives the nanograms of insert to pipette, along with the picomole amounts. Ratios from 1:1 for blunt ends up to 5:1 or more for small inserts are used, and a vector-only control tells you how much of the background is uncut plasmid. Keep the total DNA in the reaction within the ligase supplier's recommended range.",
    inputs: [
      field('vec', 'Vector mass (ng)', 50, 0.1, 100000),
      field('vlen', 'Vector length (bp)', 3500, 100, 1e7),
      field('ilen', 'Insert length (bp)', 800, 10, 1e7),
      field('ratio', 'Molar ratio, insert : vector', 3, 0.1, 100),
    ],
    outputs: [
      { name: 'insert', label: 'Insert to add', format: 'text', highlight: true },
      { name: 'vfmol', label: 'Vector amount', format: 'text' },
      { name: 'ifmol', label: 'Insert amount', format: 'text' },
    ],
    calculate: (i) => {
      const vec = toD(i.vec),
        vlen = toD(i.vlen),
        ilen = toD(i.ilen),
        ratio = toD(i.ratio);
      const vfmol = vec.mul(1e6).div(vlen.mul(650));
      return {
        insert: `${fmtNumber(ratio.mul(vec).mul(ilen).div(vlen), 2)} ng`,
        vfmol: `${fmtNumber(vfmol, 2)} fmol`,
        ifmol: `${fmtNumber(vfmol.mul(ratio), 2)} fmol`,
      };
    },
    formulaDescription:
      'Insert mass = molar ratio × vector mass × insert length ÷ vector length. Moles of double-stranded DNA = mass ÷ (length × 650 g/mol per base pair); 1 ng of 1,000 bp DNA is about 1.54 fmol.',
    workedExample:
      'With 50 ng of a 3,500 bp vector, an 800 bp insert and a 3:1 ratio, insert = 3 × 50 × 800 ÷ 3,500 = 34.29 ng. The vector is 21.98 fmol and the insert 65.93 fmol.',
    faq: [
      {
        question: 'Which ratio should I start with?',
        answer: 'Three insert molecules per vector is the usual start. Use 1:1 for blunt ends and try 5:1 or higher for small inserts or when yields are poor.',
      },
      {
        question: 'Why is the average base pair weight 650?',
        answer: 'It is the mean mass of an A-T and a G-C pair in grams per mole, close enough for ligation planning.',
      },
      {
        question: 'Does the ligation volume matter?',
        answer: 'The calculation gives masses, not concentrations. Keep the total volume within what the ligase buffer recommends, usually 10 to 20 µL.',
      },
    ],
    scenarios: rows(
      ['vec', 'vlen', 'ilen', 'ratio'],
      [
        [50, 3500, 800, 3],
        [100, 3000, 3000, 1],
        [50, 5000, 500, 5],
        [25, 2700, 1200, 3],
        [75, 6500, 250, 7],
        [40, 4300, 2100, 2],
      ],
      (v) => `${v[0]} ng of a ${v[1]} bp vector with a ${v[2]} bp insert at ${v[3]}:1`,
    ),
    introOutputs: ['insert', 'vfmol'],
    relatedSlugs: ['dna-concentration-calculator', 'dna-copy-number-calculator'],
    checks: [
      { inputs: {}, expect: { insert: '34.29 ng', vfmol: '21.98 fmol', ifmol: '65.93 fmol' } },
      { inputs: { vec: 100, vlen: 1000, ilen: 1000, ratio: 1 }, expect: { insert: '100 ng' } },
      { inputs: { vlen: 5000, ilen: 500, ratio: 5 }, expect: { insert: '25 ng' } },
    ],
  },
  {
    slug: 'log-reduction-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Bio laboratory',
    title: 'Log Reduction Calculator: Percent Kill from Counts',
    h1: 'Log Reduction Calculator',
    metaDescription: 'Convert microbial counts before and after treatment into a log reduction and a percent reduction.',
    about:
      'Disinfectants, filters and heat treatments are rated by how far they cut the number of microorganisms, and the usual scale is the base-10 logarithm. A 1-log reduction removes 90 percent, 2-log removes 99 percent, 3-log removes 99.9 percent and so on, so each extra log leaves a tenth as many survivors. Enter the count before and after treatment, in colony-forming units or any consistent unit, and the calculator gives the log reduction and the percent. Water treatment targets such as 4-log removal of viruses, and food-safety targets such as a 5-log reduction of Salmonella, are written in this form. Counts below the detection limit give only a minimum log reduction, so do not enter zero.',
    inputs: [field('before', 'Count before treatment', 1000000, 0.000001, 1e18), field('after', 'Count after treatment', 1000, 0.000001, 1e18)],
    outputs: [
      { name: 'log', label: 'Log reduction', format: 'text', highlight: true },
      { name: 'pct', label: 'Percent reduction', format: 'text' },
      { name: 'fold', label: 'Fold reduction', format: 'text' },
    ],
    calculate: (i) => {
      const before = toD(i.before),
        after = toD(i.after);
      if (after.gte(before)) return { log: fmtFixed(0, 2), pct: '0%', fold: 'No reduction' };
      return {
        log: fmtFixed(before.div(after).log(10), 2),
        pct: `${fmtNumber(new D(1).sub(after.div(before)).mul(100), 4)}%`,
        fold: `${fmtNumber(before.div(after), 1)}-fold`,
      };
    },
    formulaDescription:
      'Log reduction = log10(count before ÷ count after). Percent reduction = (1 − after ÷ before) × 100. A reduction of n logs leaves 1 ÷ 10^n of the organisms.',
    workedExample:
      'Counts fall from 1,000,000 to 1,000 CFU. The ratio is 1,000, so the log reduction is 3.00, which is a 99.9 percent reduction and a 1,000-fold drop.',
    faq: [
      {
        question: 'What if the count after treatment is zero?',
        answer: 'Report it as below the detection limit and enter that limit instead, so the result reads as "at least" this many logs.',
      },
      {
        question: 'Is a 6-log reduction the same as 99.9999 percent?',
        answer: 'Yes. Each log adds a nine to the percentage, so 6 logs is 99.9999 percent removed.',
      },
      {
        question: 'Does the base matter?',
        answer: 'Log reduction is always base 10 in regulatory and product claims. Natural-log values from growth studies are not interchangeable.',
      },
    ],
    scenarios: rows(
      ['before', 'after'],
      [
        [1e6, 1e3],
        [1e8, 1e2],
        [100, 50],
        [5e5, 25],
        [2e7, 3e4],
        [1e4, 10],
      ],
      (v) => `A sample falling from ${v[0]} to ${v[1]} organisms after treatment`,
    ),
    introOutputs: ['log', 'pct'],
    relatedSlugs: ['generation-time-calculator', 'cell-dilution-calculator'],
    checks: [
      { inputs: {}, expect: { log: '3.00', pct: '99.9%', fold: '1,000-fold' } },
      { inputs: { before: 1e8, after: 100 }, expect: { log: '6.00', pct: '99.9999%' } },
      { inputs: { before: 100, after: 50 }, expect: { log: '0.30', pct: '50%', fold: '2-fold' } },
    ],
  },
  {
    slug: 'protein-concentration-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Bio laboratory',
    title: 'Protein Concentration Calculator from A280 and Extinction Coefficient',
    h1: 'Protein Concentration Calculator',
    metaDescription: 'Convert a 280 nm absorbance, path length and extinction coefficient into mg/mL of protein, corrected for dilution.',
    about:
      "Proteins that contain tryptophan and tyrosine absorb ultraviolet light at 280 nanometres, so a quick absorbance reading gives the concentration if you know the protein's extinction coefficient. Here the coefficient is the absorbance of a 1 mg/mL solution in a 1 cm cuvette: about 0.67 for bovine serum albumin, about 1.4 for a typical IgG antibody and close to 1.0 as a rough default for an unknown protein. Enter the reading, the path length of your cuvette or instrument, the coefficient and any dilution you made, and the calculator returns the concentration of the sample and of the undiluted stock. The method needs a clean sample: nucleic acids absorb strongly near 260 nm and distort the reading, so a sample that is cloudy or pink from nucleic acid will read too high. A drop-volume instrument with a 1 mm path needs 0.1 entered as the path length, and blanking the instrument with the exact buffer used in the sample removes most of the background.",
    inputs: [
      field('a280', 'A280 reading', 0.7, 0.001, 10),
      field('path', 'Path length (cm)', 1, 0.01, 10),
      field('eps', 'Extinction coefficient (mL/(mg·cm))', 1.4, 0.01, 20),
      field('dil', 'Dilution factor', 10, 1, 100000),
    ],
    outputs: [
      { name: 'sample', label: 'Concentration as measured', format: 'text', highlight: true },
      { name: 'stock', label: 'Concentration of the undiluted stock', format: 'text' },
    ],
    calculate: (i) => {
      const c = toD(i.a280).div(toD(i.eps).mul(toD(i.path)));
      return { sample: `${fmtNumber(c, 3)} mg/mL`, stock: `${fmtNumber(c.mul(toD(i.dil)), 3)} mg/mL` };
    },
    formulaDescription:
      'Beer-Lambert law: concentration (mg/mL) = A280 ÷ (ε × path length), with ε in mL/(mg·cm) and path length in cm. The stock concentration is that value times the dilution factor.',
    workedExample:
      'An antibody with ε = 1.4 reads A280 = 0.7 in a 1 cm cuvette: 0.7 ÷ 1.4 = 0.5 mg/mL. The sample was diluted tenfold, so the stock is 5 mg/mL.',
    faq: [
      {
        question: 'Where do I find the extinction coefficient?',
        answer: 'Compute it from the sequence with a protein tool, or look up the value for your protein. Antibodies and BSA have well-known values.',
      },
      {
        question: 'When is A280 unreliable?',
        answer: 'With nucleic acid contamination, with very low concentrations under about 0.1 mg/mL, and for proteins that lack tryptophan and tyrosine.',
      },
      {
        question: 'How does this differ from the Bradford assay?',
        answer:
          'Bradford measures dye binding against a standard curve and does not need the extinction coefficient, but it consumes sample and varies between proteins.',
      },
    ],
    scenarios: rows(
      ['a280', 'path', 'eps', 'dil'],
      [
        [0.7, 1, 1.4, 10],
        [0.35, 0.5, 1.4, 1],
        [0.8, 1, 0.667, 5],
        [0.12, 1, 1, 1],
        [1.2, 0.1, 1.1, 20],
        [0.45, 1, 2.2, 2],
      ],
      (v) => `A reading of ${v[0]} through ${v[1]} cm with ε = ${v[2]}`,
    ),
    introOutputs: ['sample', 'stock'],
    relatedSlugs: ['dna-concentration-calculator', 'protein-molecular-weight-calculator'],
    checks: [
      { inputs: {}, expect: { sample: '0.5 mg/mL', stock: '5 mg/mL' } },
      { inputs: { a280: 0.667, eps: 0.667, dil: 1 }, expect: { sample: '1 mg/mL', stock: '1 mg/mL' } },
      { inputs: { a280: 0.35, path: 0.5, dil: 1 }, expect: { sample: '0.5 mg/mL' } },
    ],
  },
  {
    slug: 'protein-molecular-weight-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Protein chemistry',
    title: 'Protein Molecular Weight Calculator from Amino Acid Sequence',
    h1: 'Protein Molecular Weight Calculator',
    metaDescription: 'Paste a one-letter amino acid sequence to get the average molecular weight of the protein or peptide in daltons and kilodaltons.',
    about:
      'The molecular weight of a protein is the sum of the masses of its amino acids, less the water lost as each peptide bond forms, plus one water for the free ends. Paste the sequence in one-letter code and the calculator adds the average residue mass of every letter and then the mass of one water molecule. The result is the average mass used for gel estimates, molarity conversions and buffer recipes, and a lower figure than the monoisotopic mass that a mass spectrometer reports for a single peptide. It assumes a free chain with no post-translational changes, disulphide bonds, tags or modifications, each of which shifts the true mass slightly. Spaces and line breaks in the sequence are ignored.',
    inputs: [seq('sequence', 'Amino acid sequence (one-letter code)', 'ACDEFGHIKLMNPQRSTVWY', 'ACDEFGHIKLMNPQRSTVWY', 1, 5000)],
    outputs: [
      { name: 'mw', label: 'Molecular weight', format: 'text', highlight: true },
      { name: 'kda', label: 'In kilodaltons', format: 'text' },
      { name: 'length', label: 'Length', format: 'text' },
    ],
    calculate: (i) => {
      const s = clean(i.sequence);
      let total = new D('18.01524');
      for (const c of s) total = total.add(RESIDUE_MASS[c] ?? '0');
      return { mw: `${fmtNumber(total, 2)} Da`, kda: `${fmtNumber(total.div(1000), 3)} kDa`, length: `${s.length} residues` };
    },
    formulaDescription:
      'Mass = sum of the average residue masses of every amino acid + 18.01524 (one water). Residue masses run from 57.0519 for glycine to 186.2132 for tryptophan.',
    workedExample:
      'A single glycine, 57.0519 + 18.01524, is 75.07 Da. The twenty standard amino acids once each add to 2,377.72, so the free peptide weighs 2,395.74 Da.',
    faq: [
      {
        question: 'Why does my gel band run at a different size?',
        answer:
          'Gels separate by shape and charge as well as mass, and sugars, lipids and tags change both. Treat the calculated mass as a reference, not a prediction of the band.',
      },
      {
        question: 'Does it handle unusual residues?',
        answer: 'Only the twenty standard letters are accepted. Selenocysteine, modified residues and ambiguity codes are not supported.',
      },
      {
        question: 'What is the difference from monoisotopic mass?',
        answer:
          'Monoisotopic mass uses the lightest isotope of each element, which is what a high-resolution mass spectrometer detects for small peptides. Average mass weights all isotopes.',
      },
    ],
    scenarios: [
      withInputs('All twenty amino acids once each', { sequence: 'ACDEFGHIKLMNPQRSTVWY' }),
      withInputs('A single glycine', { sequence: 'G' }),
      withInputs('A short poly-histidine tag', { sequence: 'HHHHHH' }),
      withInputs('The start of a signal peptide', { sequence: 'MKKTAIAIAVALAGFATVAQA' }),
      withInputs('A FLAG epitope tag', { sequence: 'DYKDDDDK' }),
    ],
    introOutputs: ['mw', 'length'],
    relatedSlugs: ['protein-concentration-calculator', 'dna-to-mrna-calculator'],
    checks: [
      { inputs: {}, expect: { mw: '2,395.74 Da', kda: '2.396 kDa', length: '20 residues' } },
      { inputs: { sequence: 'G' }, expect: { mw: '75.07 Da', length: '1 residues' } },
      { inputs: { sequence: 'g g' }, expect: { mw: '132.12 Da' } },
    ],
  },
  {
    slug: 'allele-frequency-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Genetics',
    title: 'Allele Frequency Calculator from Genotype Counts',
    h1: 'Allele Frequency Calculator',
    metaDescription: 'Count the genotypes in a sample to get the frequencies p and q of the two alleles and the heterozygotes expected under Hardy-Weinberg.',
    about:
      'An allele frequency is the share of all gene copies in a population that are one particular variant. Because each diploid individual carries two copies, a homozygote contributes two copies of its allele and a heterozygote contributes one of each. Count how many individuals have genotype AA, Aa and aa, and the calculator adds up the copies of the A allele, divides by the total number of copies to get p, and takes q as the remainder. It then shows how many heterozygotes a population in Hardy-Weinberg equilibrium would carry, so you can see at once whether your observed count is unusually high or low, which hints at inbreeding, selection or a sampling problem.',
    inputs: [
      intField('aa', 'Individuals with genotype AA', 36, 0, 1e9),
      intField('het', 'Individuals with genotype Aa', 48, 0, 1e9),
      intField('rec', 'Individuals with genotype aa', 16, 0, 1e9),
    ],
    outputs: [
      { name: 'p', label: 'Frequency of allele A (p)', format: 'text', highlight: true },
      { name: 'q', label: 'Frequency of allele a (q)', format: 'text' },
      { name: 'expected', label: 'Heterozygotes expected under Hardy-Weinberg', format: 'text' },
    ],
    calculate: (i) => {
      const aa = toD(i.aa),
        het = toD(i.het),
        rec = toD(i.rec);
      const n = aa.add(het).add(rec);
      if (n.isZero()) return { p: '-', q: '-', expected: 'Enter at least one individual' };
      const p = aa.mul(2).add(het).div(n.mul(2));
      const q = new D(1).sub(p);
      return { p: fmtNumber(p, 4), q: fmtNumber(q, 4), expected: `${fmtNumber(p.mul(q).mul(2).mul(n), 1)} (observed ${fmtNumber(het, 0)})` };
    },
    formulaDescription:
      'p = (2 × AA + Aa) ÷ (2 × N) and q = 1 − p, where N is the number of individuals. Expected heterozygotes under Hardy-Weinberg = 2pq × N.',
    workedExample:
      'In 100 individuals with 36 AA, 48 Aa and 16 aa, allele A appears 2 × 36 + 48 = 120 times in 200 copies, so p = 0.6 and q = 0.4. Expected heterozygotes are 2 × 0.6 × 0.4 × 100 = 48, matching the 48 observed.',
    faq: [
      {
        question: 'What if my gene has more than two alleles?',
        answer: 'Count the copies of each allele the same way: two per homozygote and one per heterozygote, divided by twice the number of individuals.',
      },
      {
        question: 'Does the sample need to be random?',
        answer: 'Yes. Sampling relatives or one subgroup biases the frequencies, and the Hardy-Weinberg comparison then means little.',
      },
      {
        question: 'Is the result a probability?',
        answer: 'It is the proportion of gene copies in the sample, which estimates the population frequency. Small samples give wide uncertainty.',
      },
    ],
    scenarios: rows(
      ['aa', 'het', 'rec'],
      [
        [36, 48, 16],
        [10, 0, 10],
        [50, 40, 10],
        [2, 12, 86],
        [120, 240, 140],
        [5, 90, 5],
      ],
      (v) => `A sample of ${v[0]} AA, ${v[1]} Aa and ${v[2]} aa individuals`,
    ),
    introOutputs: ['p', 'q'],
    relatedSlugs: ['hardy-weinberg-equilibrium-calculator', 'punnett-square-calculator'],
    checks: [
      { inputs: {}, expect: { p: '0.6', q: '0.4', expected: '48 (observed 48)' } },
      { inputs: { aa: 10, het: 0, rec: 10 }, expect: { p: '0.5', expected: '10 (observed 0)' } },
      { inputs: { aa: 0, het: 0, rec: 0 }, expect: { expected: 'Enter at least one individual' } },
    ],
  },
  {
    slug: 'hardy-weinberg-equilibrium-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Genetics',
    title: 'Hardy-Weinberg Equilibrium Calculator: p, q and Carriers',
    h1: 'Hardy-Weinberg Equilibrium Calculator',
    metaDescription: 'From the frequency of a recessive trait, find the allele frequencies p and q, the genotype frequencies and the carrier rate.',
    about:
      'The Hardy-Weinberg principle says that in a large, randomly mating population with no selection, mutation or migration, allele and genotype frequencies stay constant from one generation to the next: p squared for the dominant homozygote, 2pq for the heterozygote and q squared for the recessive homozygote. The only genotype you can usually see is the recessive one, because carriers look like dominant homozygotes. Enter how common the recessive phenotype is, as a percentage, and the calculator takes the square root to find q, then fills in p, the three genotype frequencies and the odds that a random person is a carrier. Cystic fibrosis, with about 1 child in 2,500 affected among people of European ancestry, shows how large the hidden carrier group is.',
    inputs: [field('q2', 'Recessive phenotype frequency (%)', 9, 0.0001, 99.99), intField('n', 'Population size', 1000, 1, 1e10)],
    outputs: [
      { name: 'alleles', label: 'Allele frequencies', format: 'text', highlight: true },
      { name: 'genotypes', label: 'Genotype frequencies (AA, Aa, aa)', format: 'text' },
      { name: 'carriers', label: 'Expected carriers (Aa)', format: 'text' },
      { name: 'odds', label: 'Carrier odds', format: 'text' },
    ],
    calculate: (i) => {
      const q2 = toD(i.q2).div(100);
      const q = q2.sqrt();
      const p = new D(1).sub(q);
      const het = p.mul(q).mul(2);
      return {
        alleles: `p = ${fmtNumber(p, 4)}, q = ${fmtNumber(q, 4)}`,
        genotypes: `${fmtNumber(p.mul(p).mul(100), 2)}%, ${fmtNumber(het.mul(100), 2)}%, ${fmtNumber(q2.mul(100), 2)}%`,
        carriers: `${fmtNumber(het.mul(toD(i.n)), 0)} of ${fmtNumber(toD(i.n), 0)}`,
        odds: `1 in ${fmtNumber(new D(1).div(het), 1)}`,
      };
    },
    formulaDescription: 'p + q = 1 and p² + 2pq + q² = 1. From the recessive phenotype frequency q², q = √(q²) and p = 1 − q. Carrier frequency = 2pq.',
    workedExample:
      'If 9% of a population shows a recessive trait, q² = 0.09, q = 0.3 and p = 0.7. Genotypes are 49% AA, 42% Aa and 9% aa, so in 1,000 people 420 are carriers, odds of 1 in 2.4.',
    faq: [
      {
        question: 'What are the Hardy-Weinberg assumptions?',
        answer:
          'A large population, random mating, no selection, no mutation and no migration. Real populations break them, so the result is an expectation, not a measurement.',
      },
      {
        question: 'Why use the recessive frequency as the input?',
        answer: 'It is the one genotype that can be counted directly from visible traits or disease cases. The dominant group mixes AA and Aa.',
      },
      {
        question: 'How do I test whether a population is in equilibrium?',
        answer: 'Compare observed genotype counts with the expected ones using a chi-square test with one degree of freedom for two alleles.',
      },
    ],
    scenarios: rows(
      ['q2', 'n'],
      [
        [9, 1000],
        [4, 500],
        [25, 2000],
        [0.04, 100000],
        [1, 10000],
        [16, 250],
      ],
      (v) => `A recessive trait seen in ${v[0]} percent of ${v[1]} people`,
    ),
    introOutputs: ['alleles', 'carriers'],
    relatedSlugs: ['allele-frequency-calculator', 'punnett-square-calculator'],
    checks: [
      { inputs: {}, expect: { alleles: 'p = 0.7, q = 0.3', genotypes: '49%, 42%, 9%', carriers: '420 of 1,000', odds: '1 in 2.4' } },
      { inputs: { q2: 4 }, expect: { genotypes: '64%, 32%, 4%', carriers: '320 of 1,000' } },
      { inputs: { q2: 25, n: 200 }, expect: { alleles: 'p = 0.5, q = 0.5', carriers: '100 of 200', odds: '1 in 2' } },
    ],
  },
  {
    slug: 'punnett-square-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Genetics',
    title: 'Punnett Square Calculator: Offspring Genotype and Phenotype',
    h1: 'Punnett Square Calculator',
    metaDescription: 'Cross two parents for one gene to see the four boxes of the Punnett square and the genotype and phenotype percentages of the offspring.',
    about:
      "A Punnett square shows every way two parents' gametes can combine for a single gene. Each parent passes on one of its two alleles with equal chance, so a heterozygote Aa gives A half the time and a half the time. Choose the genotype of each parent, with a capital letter for the dominant allele, and the calculator fills the four boxes and counts them: how many offspring are AA, Aa and aa, and how many show the dominant or the recessive trait. It assumes complete dominance, one gene on an ordinary chromosome and no linkage, which is the classic Mendelian case taught from pea plants to blood types. For traits with incomplete dominance or co-dominance, use the genotype percentages rather than the phenotype line.",
    inputs: [geno('p1', 'Parent 1 genotype', 'A', 'Aa'), geno('p2', 'Parent 2 genotype', 'A', 'Aa')],
    outputs: [
      { name: 'boxes', label: 'The four boxes', format: 'text' },
      { name: 'genotypes', label: 'Offspring genotypes', format: 'text', highlight: true },
      { name: 'phenotypes', label: 'Offspring phenotypes', format: 'text' },
    ],
    calculate: (i) => {
      const a = String(i.p1),
        b = String(i.p2);
      const boxes: string[] = [];
      for (const x of a) for (const y of b) boxes.push([x, y].sort().join(''));
      const x = transmit(a),
        y = transmit(b);
      const hom = x.mul(y),
        rec = new D(1).sub(x).mul(new D(1).sub(y)),
        het = new D(1).sub(hom).sub(rec);
      const part = (p: Dec, label: string) => (p.isZero() ? null : `${fmtNumber(p.mul(100), 2)}% ${label}`);
      return {
        boxes: boxes.join(', '),
        genotypes: [part(hom, 'AA'), part(het, 'Aa'), part(rec, 'aa')].filter(Boolean).join(', '),
        phenotypes: [part(hom.add(het), 'dominant'), part(rec, 'recessive')].filter(Boolean).join(', '),
      };
    },
    formulaDescription:
      'Each parent passes the dominant allele with probability 0.5 per capital letter in its genotype (AA 1, Aa 0.5, aa 0). P(AA) = x × y, P(aa) = (1 − x)(1 − y) and P(Aa) is the rest, for parent probabilities x and y.',
    workedExample:
      'Aa × Aa gives the boxes AA, Aa, Aa, aa: 25% AA, 50% Aa and 25% aa, so 75% show the dominant trait and 25% the recessive one, the classic 3:1 ratio.',
    faq: [
      {
        question: 'What does the 3:1 ratio mean?',
        answer:
          'Two heterozygous parents produce, on average, three offspring with the dominant phenotype for each one with the recessive phenotype. Individual families vary by chance.',
      },
      {
        question: 'Can two dominant-looking parents have a recessive child?',
        answer: 'Yes, if both are carriers (Aa). Each pregnancy then has a one in four chance of an aa child.',
      },
      { question: 'Does the order of parents matter?', answer: 'No. Swapping the parents gives the same boxes and the same percentages.' },
    ],
    scenarios: [
      withInputs('Two heterozygous carriers', { p1: 'Aa', p2: 'Aa' }),
      withInputs('A homozygous dominant with a homozygous recessive', { p1: 'AA', p2: 'aa' }),
      withInputs('A carrier with a recessive parent (a test cross)', { p1: 'Aa', p2: 'aa' }),
      withInputs('A homozygous dominant with a carrier', { p1: 'AA', p2: 'Aa' }),
      withInputs('Two homozygous recessive parents', { p1: 'aa', p2: 'aa' }),
    ],
    introOutputs: ['genotypes', 'phenotypes'],
    relatedSlugs: ['dihybrid-cross-calculator', 'hardy-weinberg-equilibrium-calculator'],
    checks: [
      { inputs: {}, expect: { boxes: 'AA, Aa, Aa, aa', genotypes: '25% AA, 50% Aa, 25% aa', phenotypes: '75% dominant, 25% recessive' } },
      { inputs: { p1: 'AA', p2: 'aa' }, expect: { boxes: 'Aa, Aa, Aa, Aa', genotypes: '100% Aa', phenotypes: '100% dominant' } },
      { inputs: { p1: 'Aa', p2: 'aa' }, expect: { genotypes: '50% Aa, 50% aa', phenotypes: '50% dominant, 50% recessive' } },
    ],
  },
  {
    slug: 'dihybrid-cross-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Genetics',
    title: 'Dihybrid Cross Calculator: Phenotype Ratios for Two Genes',
    h1: 'Dihybrid Cross Calculator',
    metaDescription: 'Cross two parents for two independent genes and get the four phenotype classes as a ratio out of 16 and as percentages.',
    about:
      "A dihybrid cross follows two genes at once, such as seed shape and seed colour in Mendel's peas. When the genes sit on different chromosomes they are inherited independently, which means the chance of any combination is the product of the single-gene chances. Choose each parent's genotype for gene A and gene B and the calculator works out the chance of showing the dominant trait for each gene, then multiplies them to give the four phenotype classes: dominant for both, dominant for A only, dominant for B only and recessive for both. Two double heterozygotes, AaBb, give the famous 9:3:3:1 ratio. Genes close together on one chromosome are linked and break the pattern, so counts from real crosses can differ. Mendel crossed round yellow peas with wrinkled green ones and counted 315, 101, 108 and 32 seeds in the second generation, close to the 9:3:3:1 expectation. When one gene masks the other, as the extension gene does for coat colour in Labrador retrievers, the same cross gives 9 black, 3 chocolate and 4 yellow, so check for interaction before using the plain ratio.",
    inputs: [
      geno('p1a', 'Parent 1, gene A', 'A', 'Aa'),
      geno('p1b', 'Parent 1, gene B', 'B', 'Bb'),
      geno('p2a', 'Parent 2, gene A', 'A', 'Aa'),
      geno('p2b', 'Parent 2, gene B', 'B', 'Bb'),
    ],
    outputs: [
      { name: 'ratio', label: 'Phenotype ratio (A_B_ : A_bb : aaB_ : aabb)', format: 'text', highlight: true },
      { name: 'percent', label: 'Percentages in the same order', format: 'text' },
    ],
    calculate: (i) => {
      const da = domChance(String(i.p1a), String(i.p2a)),
        db = domChance(String(i.p1b), String(i.p2b));
      const ra = new D(1).sub(da),
        rb = new D(1).sub(db);
      const classes = [da.mul(db), da.mul(rb), ra.mul(db), ra.mul(rb)];
      return { ratio: classes.map((c) => fmtNumber(c.mul(16), 2)).join(' : '), percent: classes.map((c) => `${fmtNumber(c.mul(100), 2)}%`).join(', ') };
    },
    formulaDescription:
      "For each gene, P(dominant phenotype) = 1 − (1 − x)(1 − y), where x and y are each parent's chance of passing the dominant allele. The four classes are the products of the two genes' dominant and recessive chances, scaled by 16 for the ratio.",
    workedExample:
      'AaBb × AaBb: each gene gives 3/4 dominant and 1/4 recessive, so the classes are 9/16, 3/16, 3/16 and 1/16, a 9:3:3:1 ratio, or 56.25%, 18.75%, 18.75% and 6.25%.',
    faq: [
      {
        question: 'Why 16?',
        answer:
          'Each parent makes up to four types of gamete for two genes, so the full grid has 4 × 4 = 16 boxes. The ratio is shown out of 16 for that reason.',
      },
      {
        question: 'What if the genes are linked?',
        answer:
          'Then the independence assumption fails and parental combinations show up more often than predicted. Linkage needs recombination frequencies, which this tool does not use.',
      },
      {
        question: 'What is a test cross?',
        answer: 'Crossing a double heterozygote with a double recessive. The classes come out at 1:1:1:1, which this calculator shows as 4:4:4:4 out of 16.',
      },
    ],
    scenarios: [
      withInputs('Two double heterozygotes', { p1a: 'Aa', p1b: 'Bb', p2a: 'Aa', p2b: 'Bb' }),
      withInputs('A test cross of AaBb with aabb', { p1a: 'Aa', p1b: 'Bb', p2a: 'aa', p2b: 'bb' }),
      withInputs('Pure dominant crossed with pure recessive', { p1a: 'AA', p1b: 'BB', p2a: 'aa', p2b: 'bb' }),
      withInputs('One parent recessive for B, the other recessive for A', { p1a: 'Aa', p1b: 'bb', p2a: 'aa', p2b: 'Bb' }),
      withInputs('Heterozygous at A, homozygous dominant at B in one parent', { p1a: 'Aa', p1b: 'BB', p2a: 'Aa', p2b: 'Bb' }),
    ],
    introOutputs: ['ratio'],
    relatedSlugs: ['punnett-square-calculator', 'trihybrid-cross-calculator'],
    checks: [
      { inputs: {}, expect: { ratio: '9 : 3 : 3 : 1', percent: '56.25%, 18.75%, 18.75%, 6.25%' } },
      { inputs: { p2a: 'aa', p2b: 'bb' }, expect: { ratio: '4 : 4 : 4 : 4' } },
      { inputs: { p1a: 'AA', p1b: 'BB', p2a: 'aa', p2b: 'bb' }, expect: { ratio: '16 : 0 : 0 : 0' } },
    ],
  },
  {
    slug: 'trihybrid-cross-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Genetics',
    title: 'Trihybrid Cross Calculator: 27:9:9:9:3:3:3:1 Ratios',
    h1: 'Trihybrid Cross Calculator',
    metaDescription: 'Cross two parents for three independent genes and get the eight phenotype classes as a ratio out of 64.',
    about:
      'With three independent genes the number of phenotype classes grows to eight, and a grid of 64 boxes would be needed to draw them. The product rule makes the grid unnecessary: the chance of each class is the product of the chances for gene A, gene B and gene C. Choose the genotype of each parent for all three genes, and the calculator finds the dominant chance per gene and combines them. Two triple heterozygotes, AaBbCc, give the 27:9:9:9:3:3:3:1 ratio, in which about 42 percent of offspring show all three dominant traits and only 1.6 percent show all three recessive. Breeders use these figures to judge how big a population has to be to see the rarest class at least once. A triple heterozygote makes 2 × 2 × 2 = 8 kinds of gamete, so a full square needs 8 rows and 8 columns, and a chi-square test of observed counts against this ratio has 7 degrees of freedom. Plant breeders also use the eight-class pattern to plan how many seedlings to grow and score, because a population of 200 plants is needed before the rarest class is likely to appear.',
    inputs: [
      geno('p1a', 'Parent 1, gene A', 'A', 'Aa'),
      geno('p1b', 'Parent 1, gene B', 'B', 'Bb'),
      geno('p1c', 'Parent 1, gene C', 'C', 'Cc'),
      geno('p2a', 'Parent 2, gene A', 'A', 'Aa'),
      geno('p2b', 'Parent 2, gene B', 'B', 'Bb'),
      geno('p2c', 'Parent 2, gene C', 'C', 'Cc'),
    ],
    outputs: [
      { name: 'ratio', label: 'Eight classes out of 64', format: 'text', highlight: true },
      { name: 'allDom', label: 'All three traits dominant', format: 'text' },
      { name: 'allRec', label: 'All three traits recessive', format: 'text' },
    ],
    calculate: (i) => {
      const d = [domChance(String(i.p1a), String(i.p2a)), domChance(String(i.p1b), String(i.p2b)), domChance(String(i.p1c), String(i.p2c))];
      const r = d.map((x) => new D(1).sub(x));
      const order = [
        [1, 1, 1],
        [1, 1, 0],
        [1, 0, 1],
        [0, 1, 1],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [0, 0, 0],
      ];
      const classes = order.map((o) => o.reduce((acc, bit, k) => acc.mul(bit ? d[k] : r[k]), new D(1)));
      return {
        ratio: classes.map((c) => fmtNumber(c.mul(64), 2)).join(' : '),
        allDom: `${fmtNumber(classes[0].mul(100), 2)}%`,
        allRec: `${fmtNumber(classes[7].mul(100), 2)}%`,
      };
    },
    formulaDescription:
      'For each gene, P(dominant) = 1 − (1 − x)(1 − y). Each of the eight classes is the product of three such chances, scaled by 64. Order: A_B_C_, A_B_cc, A_bbC_, aaB_C_, A_bbcc, aaB_cc, aabbC_, aabbcc.',
    workedExample:
      'AaBbCc × AaBbCc: each gene is 3/4 dominant, so all dominant is (3/4)³ = 27/64 = 42.19%, and all recessive is (1/4)³ = 1/64 = 1.56%. The classes run 27 : 9 : 9 : 9 : 3 : 3 : 3 : 1.',
    faq: [
      {
        question: 'Do I need a 64-box grid?',
        answer:
          'No. Multiplying the single-gene probabilities gives the same answer with far less work, which is why textbooks switch to the product rule here.',
      },
      {
        question: 'How large a family do I need to see the rarest class?',
        answer: 'For a 1 in 64 class you need about 190 offspring to be 95 percent sure of seeing at least one.',
      },
      {
        question: 'Does it work for crosses with homozygous parents?',
        answer: 'Yes. A homozygous gene just makes that factor 1 or 0, so some classes drop out and the others scale up.',
      },
    ],
    scenarios: [
      withInputs('Two triple heterozygotes', { p1a: 'Aa', p1b: 'Bb', p1c: 'Cc', p2a: 'Aa', p2b: 'Bb', p2c: 'Cc' }),
      withInputs('Backcross of a triple heterozygote to the recessive', { p1a: 'Aa', p1b: 'Bb', p1c: 'Cc', p2a: 'aa', p2b: 'bb', p2c: 'cc' }),
      withInputs('All-dominant parent against all-recessive parent', { p1a: 'AA', p1b: 'BB', p1c: 'CC', p2a: 'aa', p2b: 'bb', p2c: 'cc' }),
      withInputs('Different genotypes at all three genes', { p1a: 'Aa', p1b: 'BB', p1c: 'cc', p2a: 'aa', p2b: 'Bb', p2c: 'Cc' }),
      withInputs('Gene C fixed as CC in both parents', { p1a: 'Aa', p1b: 'Bb', p1c: 'CC', p2a: 'Aa', p2b: 'Bb', p2c: 'CC' }),
    ],
    introOutputs: ['ratio'],
    relatedSlugs: ['dihybrid-cross-calculator', 'punnett-square-calculator'],
    checks: [
      { inputs: {}, expect: { ratio: '27 : 9 : 9 : 9 : 3 : 3 : 3 : 1', allDom: '42.19%', allRec: '1.56%' } },
      { inputs: { p2a: 'aa', p2b: 'bb', p2c: 'cc' }, expect: { ratio: '8 : 8 : 8 : 8 : 8 : 8 : 8 : 8' } },
      { inputs: { p1a: 'AA', p1b: 'BB', p1c: 'CC', p2a: 'aa', p2b: 'bb', p2c: 'cc' }, expect: { ratio: '64 : 0 : 0 : 0 : 0 : 0 : 0 : 0', allDom: '100%' } },
    ],
  },
  {
    slug: 'dna-copy-number-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Genetics',
    title: 'DNA Copy Number Calculator: Copies from ng and Length',
    h1: 'DNA Copy Number Calculator',
    metaDescription: 'Convert a mass of DNA and its length in base pairs into the number of molecules, for qPCR standards and dilution series.',
    about:
      "Absolute quantification by qPCR needs a standard of known copy number, and the copy number of a purified plasmid or amplicon follows from its mass and length. A double-stranded base pair weighs about 650 daltons, so a molecule of the given length has a known mass; dividing the sample mass by it gives moles, and multiplying by Avogadro's number gives molecules. Enter the mass in nanograms, the length in base pairs and whether the DNA is double or single stranded, and the calculator returns the copies and the amount in femtomoles. Short fragments carry far more copies per nanogram than long plasmids, which is why a standard curve is built from a dilution series rather than from one tube. Quantify the stock by fluorescence for the best accuracy.",
    inputs: [
      field('mass', 'Mass of DNA (ng)', 1, 0.000001, 1e9),
      field('len', 'Length (bp or nt)', 5000, 10, 1e9),
      select('type', 'DNA type', 'ds', [
        ['ds', 'Double-stranded (650 per bp)'],
        ['ss', 'Single-stranded (330 per nt)'],
      ]),
    ],
    outputs: [
      { name: 'copies', label: 'Copy number', format: 'text', highlight: true },
      { name: 'fmol', label: 'Amount', format: 'text' },
    ],
    calculate: (i) => {
      const weight = String(i.type) === 'ss' ? 330 : 650;
      const mol = toD(i.mass).div(1e9).div(toD(i.len).mul(weight));
      return { copies: sci(mol.mul(AVOGADRO)), fmol: `${fmtNumber(mol.mul(1e15), 4)} fmol` };
    },
    formulaDescription: 'Moles = mass (g) ÷ (length × 650 g/mol per base pair), or × 330 per base for single strands. Copies = moles × 6.022 × 10^23.',
    workedExample:
      "1 ng of a 5,000 bp plasmid: 10^-9 g ÷ (5,000 × 650) = 3.077 × 10^-16 mol, which is 0.3077 fmol. Multiplying by Avogadro's number gives 1.853 × 10^8 copies.",
    faq: [
      {
        question: 'Why is the weight 650 per base pair?',
        answer:
          'It is the average of the four nucleotide monophosphate masses, doubled for a base pair and less water. Pairs differ slightly, but 650 is the accepted working value.',
      },
      {
        question: 'How do I make a standard curve from this?',
        answer:
          'Dilute the stock tenfold several times and record the copy number of each dilution; run them in qPCR and plot cycle number against the logarithm of copies.',
      },
      {
        question: 'Does a linearised plasmid count differently?',
        answer: 'Use the length of the molecule you actually quantified. A linear fragment cut from a plasmid has fewer base pairs than the circular one.',
      },
    ],
    scenarios: [
      withInputs('1 ng of a 5 kb plasmid', { mass: 1, len: 5000, type: 'ds' }),
      withInputs('10 ng of a 1 kb amplicon', { mass: 10, len: 1000, type: 'ds' }),
      withInputs('0.1 ng of a 300 bp product', { mass: 0.1, len: 300, type: 'ds' }),
      withInputs('1 ng of a 100-nucleotide oligo', { mass: 1, len: 100, type: 'ss' }),
      withInputs('100 ng of a 10 kb fragment', { mass: 100, len: 10000, type: 'ds' }),
    ],
    introOutputs: ['copies', 'fmol'],
    relatedSlugs: ['dna-concentration-calculator', 'qpcr-efficiency-calculator'],
    checks: [
      { inputs: {}, expect: { copies: '1.853 × 10^8', fmol: '0.3077 fmol' } },
      { inputs: { mass: 10 }, expect: { copies: '1.853 × 10^9' } },
      { inputs: { mass: 1, len: 1000, type: 'ss' }, expect: { copies: '1.825 × 10^9' } },
    ],
  },
  {
    slug: 'dna-to-mrna-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Genetics',
    title: 'DNA to mRNA Calculator: Transcribe and Translate a Sequence',
    h1: 'DNA to mRNA Calculator',
    metaDescription: 'Transcribe a DNA template or coding strand into mRNA, split it into codons and read off the amino acids it would encode.',
    about:
      "Transcription copies a gene into messenger RNA. The enzyme reads the template strand and builds an RNA chain whose bases are the complement of the template, with uracil in place of thymine: A pairs with U, T with A, G with C and C with G. The coding strand carries the same sequence as the mRNA except that it has T where the RNA has U. Paste a sequence, say which strand it is, and the calculator returns the mRNA, the codons and the standard-code translation, ending at a stop codon shown as Stop. The template is entered as written from the 3' end to the 5' end, so no reversing is needed. Leftover bases that do not fill a codon are noted, and the GC content of the mRNA is given.",
    inputs: [
      seq('dna', 'DNA sequence', 'TACGGTCAAATT', 'ACGT', 3, 300),
      select('strand', 'This sequence is the', 'template', [
        ['template', "Template strand (3' to 5')"],
        ['coding', "Coding strand (5' to 3')"],
      ]),
    ],
    outputs: [
      { name: 'mrna', label: "mRNA (5' to 3')", format: 'text', highlight: true },
      { name: 'codons', label: 'Codons', format: 'text' },
      { name: 'protein', label: 'Amino acids', format: 'text' },
      { name: 'gc', label: 'GC content of the mRNA', format: 'text' },
    ],
    calculate: (i) => {
      const s = clean(i.dna);
      const comp: Record<string, string> = { A: 'U', T: 'A', C: 'G', G: 'C' };
      const mrna = String(i.strand) === 'coding' ? s.replace(/T/g, 'U') : [...s].map((c) => comp[c]).join('');
      const codons: string[] = [];
      const aa: string[] = [];
      for (let k = 0; k + 3 <= mrna.length; k += 3) {
        const c = mrna.slice(k, k + 3);
        codons.push(c);
        const [a, b, d] = [...c].map((x) => BASE_INDEX[x === 'U' ? 'T' : x]);
        const letter = CODON_TABLE[16 * a + 4 * b + d];
        aa.push(letter === '*' ? 'Stop' : letter);
      }
      const left = mrna.length % 3;
      let gc = 0;
      for (const c of mrna) if (c === 'G' || c === 'C') gc++;
      return {
        mrna,
        codons: codons.join(' ') + (left ? ` (+${left} leftover base${left > 1 ? 's' : ''})` : ''),
        protein: aa.join('-'),
        gc: `${fmtNumber(new D(gc).div(mrna.length).mul(100), 2)}%`,
      };
    },
    formulaDescription:
      'Template strand: mRNA base = complement of each DNA base (A→U, T→A, G→C, C→G). Coding strand: mRNA = the same sequence with T replaced by U. Codons are read in threes from the first base and translated with the standard genetic code.',
    workedExample:
      "Template 3'-TACGGTCAAATT-5' gives mRNA 5'-AUGCCAGUUUAA-3'. The codons are AUG CCA GUU UAA, which code for methionine, proline, valine and a stop: M-P-V-Stop. GC content is 4 of 12 bases, 33.33%.",
    faq: [
      {
        question: 'Which strand do I have?',
        answer:
          'The coding (sense) strand is the one that reads like the mRNA and is the usual way sequences are published. The template strand is its complement.',
      },
      {
        question: 'Why does translation start at the first base?',
        answer:
          'This tool reads from the first base. Real translation begins at a start codon, usually AUG, so trim the sequence to the start of the open reading frame first.',
      },
      { question: 'Does it handle introns?', answer: 'No. Splicing is not modelled, so the sequence should already be the exons joined together, as in cDNA.' },
    ],
    scenarios: [
      withInputs('A short template with a start and stop', { dna: 'TACGGTCAAATT', strand: 'template' }),
      withInputs('A coding strand for methionine and alanine', { dna: 'ATGGCC', strand: 'coding' }),
      withInputs('A template that gives a start then a stop', { dna: 'TACATT', strand: 'template' }),
      withInputs('A longer coding sequence', { dna: 'ATGAAAGGGTTTCCCTAA', strand: 'coding' }),
      withInputs('A template with a leftover base', { dna: 'TACCCGA', strand: 'template' }),
    ],
    introOutputs: ['mrna', 'protein'],
    relatedSlugs: ['protein-molecular-weight-calculator', 'dna-copy-number-calculator'],
    checks: [
      { inputs: {}, expect: { mrna: 'AUGCCAGUUUAA', codons: 'AUG CCA GUU UAA', protein: 'M-P-V-Stop', gc: '33.33%' } },
      { inputs: { dna: 'ATGGCC', strand: 'coding' }, expect: { mrna: 'AUGGCC', protein: 'M-A', gc: '66.67%' } },
      { inputs: { dna: 'TACATT' }, expect: { mrna: 'AUGUAA', protein: 'M-Stop' } },
    ],
  },
  {
    slug: 'mutation-frequency-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Genetics',
    title: 'Mutation Frequency Calculator: Mutants per Million Cells',
    h1: 'Mutation Frequency Calculator',
    metaDescription: 'Divide the number of mutant colonies by the number of cells plated to get the mutation frequency and mutants per million.',
    about:
      'Mutation frequency is the share of cells in a culture that carry a mutation at the time you look: mutants counted on selective plates divided by the total cells plated on non-selective ones. It is a snapshot, and it is high when a mutation happened early in the culture because its descendants multiply, so one jackpot can inflate the figure. Reversion tests in bacteria, drug-resistance assays in yeast and reporter assays in cell lines all report it this way. Enter the mutant count and the total cells, and the calculator gives the frequency in scientific notation and per million cells. For a rate per cell division, which is not the same thing, use a fluctuation test and the mutation rate calculator.',
    inputs: [field('mutants', 'Mutant colonies counted', 25, 0, 1e12), field('cells', 'Total viable cells plated', 5000000, 1, 1e15)],
    outputs: [
      { name: 'freq', label: 'Mutation frequency', format: 'text', highlight: true },
      { name: 'perMillion', label: 'Mutants per million cells', format: 'text' },
    ],
    calculate: (i) => {
      const f = toD(i.mutants).div(toD(i.cells));
      return { freq: sci(f), perMillion: fmtNumber(f.mul(1e6), 3) };
    },
    formulaDescription: 'Mutation frequency = number of mutants ÷ total number of viable cells. Mutants per million = frequency × 10^6.',
    workedExample: '25 resistant colonies among 5,000,000 viable cells plated is 25 ÷ 5,000,000 = 5 × 10^-6, which is 5 mutants per million cells.',
    faq: [
      {
        question: 'How is frequency different from rate?',
        answer:
          'Frequency is a proportion at one moment. Rate is the chance per cell per division, and it needs a fluctuation test to separate early from late mutations.',
      },
      {
        question: 'Why does one culture give a very different count from another?',
        answer: 'Mutations arise at random times. An early event gives a large clone, so independent cultures show large variation in the count.',
      },
      {
        question: 'Which cell count should I use?',
        answer: 'Viable cells determined on non-selective plates, not the optical density or the raw number plated.',
      },
    ],
    scenarios: rows(
      ['mutants', 'cells'],
      [
        [25, 5e6],
        [3, 1e6],
        [120, 2e8],
        [0, 1e7],
        [8, 4e5],
        [450, 1e9],
      ],
      (v) => `${v[0]} mutants counted among ${v[1]} cells plated`,
    ),
    introOutputs: ['freq', 'perMillion'],
    relatedSlugs: ['mutation-rate-calculator', 'log-reduction-calculator'],
    checks: [
      { inputs: {}, expect: { freq: '5.000 × 10^-6', perMillion: '5' } },
      { inputs: { mutants: 3, cells: 1000000 }, expect: { freq: '3.000 × 10^-6', perMillion: '3' } },
      { inputs: { mutants: 0 }, expect: { freq: '0', perMillion: '0' } },
    ],
  },
  {
    slug: 'mutation-rate-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Genetics',
    title: 'Mutation Rate Calculator: Luria-Delbruck p0 Method',
    h1: 'Mutation Rate Calculator',
    metaDescription: 'Estimate the mutation rate per cell division from a fluctuation test, using the fraction of cultures with no mutants.',
    about:
      'A fluctuation test, designed by Luria and Delbruck in 1943, grows many small parallel cultures from a few cells and then plates each one on selective medium. Because mutations arise at random times during growth, the number of mutants varies a great deal from culture to culture, and the average count misleads. The p0 method uses only the fraction of cultures that have no mutants at all. If mutations follow a Poisson process, that fraction equals e to the power of minus m, where m is the expected number of mutation events per culture, so m is minus the natural logarithm of the fraction. Dividing m by the number of cells at the end of growth gives the mutation rate per cell per division, a number usually between 10 to the minus 10 and 10 to the minus 6. The method works best when between 10 and 80 percent of the cultures are mutant-free.',
    inputs: [
      intField('cultures', 'Number of cultures', 30, 1, 100000),
      intField('none', 'Cultures with no mutants', 12, 0, 100000),
      field('n', 'Cells per culture at plating', 100000000, 1, 1e15),
    ],
    outputs: [
      { name: 'm', label: 'Mutation events per culture (m)', format: 'text', highlight: true },
      { name: 'rate', label: 'Mutation rate per cell per division', format: 'text' },
    ],
    calculate: (i) => {
      const c = toD(i.cultures),
        none = toD(i.none);
      if (none.isZero() || none.gt(c)) return { m: 'Needs at least one culture without mutants', rate: '-' };
      const m = c.div(none).ln();
      return { m: fmtFixed(m, 3), rate: sci(m.div(toD(i.n))) };
    },
    formulaDescription:
      'p0 = cultures with no mutants ÷ total cultures. m = −ln(p0). Mutation rate μ = m ÷ N, where N is the number of cells per culture at the end of growth.',
    workedExample:
      '12 of 30 cultures are mutant-free, so p0 = 0.4 and m = −ln 0.4 = 0.916. With 10^8 cells per culture, μ = 0.916 ÷ 10^8 = 9.163 × 10^-9 per cell division.',
    faq: [
      {
        question: 'What if every culture has mutants?',
        answer: 'Then p0 is zero and the method fails. Use smaller cultures or fewer cells per culture, or switch to a median-based method.',
      },
      {
        question: 'How many cultures do I need?',
        answer: 'At least 20 to 30 give a usable estimate, and more narrow the confidence limits. Replicate experiments are standard.',
      },
      {
        question: 'Is N the final cell number or the average?',
        answer: 'The final number at plating is the usual choice for the simple p0 method. More refined estimators use the number of divisions.',
      },
    ],
    scenarios: rows(
      ['cultures', 'none', 'n'],
      [
        [30, 12, 1e8],
        [20, 10, 1e7],
        [50, 5, 2e8],
        [40, 30, 5e7],
        [24, 6, 1e9],
        [60, 20, 3e8],
      ],
      (v) => `${v[1]} of ${v[0]} cultures free of mutants, ${v[2]} cells each`,
    ),
    introOutputs: ['m', 'rate'],
    relatedSlugs: ['mutation-frequency-calculator', 'generation-time-calculator'],
    checks: [
      { inputs: {}, expect: { m: '0.916', rate: '9.163 × 10^-9' } },
      { inputs: { cultures: 20, none: 10, n: 10000000 }, expect: { m: '0.693', rate: '6.931 × 10^-8' } },
      { inputs: { cultures: 10, none: 0 }, expect: { m: 'Needs at least one culture without mutants' } },
    ],
  },
  {
    slug: 'qpcr-efficiency-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Genetics',
    title: 'qPCR Efficiency Calculator from the Standard Curve Slope',
    h1: 'qPCR Efficiency Calculator',
    metaDescription: 'Convert the slope of a qPCR standard curve into amplification efficiency in percent and the fold increase per cycle.',
    about:
      "In quantitative PCR a dilution series of known template is run and the cycle threshold is plotted against the logarithm of the starting amount. The line's slope tells you how well the reaction doubles. A slope of about minus 3.32 means the product doubles every cycle, which is 100 percent efficiency; a steeper slope means a poorer reaction, and a shallower one often points to inhibitors or pipetting error. Enter the slope from your instrument or spreadsheet and the calculator returns the efficiency and the fold increase per cycle. Guidelines usually accept 90 to 110 percent with a correlation coefficient of at least 0.98, and relative quantification by the delta-delta Ct method assumes that both target and reference assays sit in that window.",
    inputs: [field('slope', 'Slope of the standard curve', -3.32, -10, -1.5)],
    outputs: [
      { name: 'eff', label: 'Amplification efficiency', format: 'text', highlight: true },
      { name: 'factor', label: 'Fold increase per cycle', format: 'text' },
      { name: 'verdict', label: 'Against the 90–110% guideline', format: 'text' },
    ],
    calculate: (i) => {
      const e = new D(10).pow(new D(-1).div(toD(i.slope))).sub(1);
      const pct = e.mul(100);
      return { eff: `${fmtNumber(pct, 1)}%`, factor: fmtNumber(e.add(1), 3), verdict: pct.gte(90) && pct.lte(110) ? 'Within the range' : 'Outside the range' };
    },
    formulaDescription:
      'Efficiency E = 10^(−1 ÷ slope) − 1, shown as a percentage. The fold increase per cycle is 1 + E, which is 2 at 100 percent efficiency.',
    workedExample:
      'A slope of −3.32 gives E = 10^(1 ÷ 3.32) − 1 = 1.0008, or 100.1 percent, so the product multiplies 2.001 times per cycle. A slope of −3.6 gives E = 89.6 percent, just outside the guideline.',
    faq: [
      {
        question: 'Can efficiency exceed 100 percent?',
        answer:
          'Not physically. Values above 110 percent usually mean inhibition at the high-concentration points flattening the curve, or pipetting errors in the dilution series.',
      },
      {
        question: 'What dilution series should I run?',
        answer: 'Five points at tenfold or fivefold steps, in triplicate, spanning the range of your samples. Check R squared of at least 0.98.',
      },
      {
        question: 'Why does the slope change with the base of the dilution?',
        answer: 'It does not, provided the x axis is the log10 of the amount or concentration. Using the natural log changes the slope by a factor of 2.303.',
      },
    ],
    scenarios: rows(['slope'], [[-3.32], [-3.6], [-3.1], [-3.45], [-4], [-3.0]], (v) => `A standard curve with a slope of ${v[0]}`),
    introOutputs: ['eff', 'factor'],
    relatedSlugs: ['dna-copy-number-calculator', 'annealing-temperature-calculator'],
    checks: [
      { inputs: {}, expect: { eff: '100.1%', factor: '2.001', verdict: 'Within the range' } },
      { inputs: { slope: -3.6 }, expect: { eff: '89.6%', verdict: 'Outside the range' } },
      { inputs: { slope: -3.1 }, expect: { eff: '110.2%', verdict: 'Outside the range' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
