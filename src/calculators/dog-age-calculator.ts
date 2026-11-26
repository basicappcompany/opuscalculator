import { numberField } from '../lib/calc-utils';
import { toD } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const config: CalculatorConfig = {
  slug: 'dog-age-calculator',
  category: 'other',
  tier: 3,
  publish: false,
  title: 'Dog Age Calculator: Dog Years to Human Years',
  h1: 'Dog Age Calculator',
  metaDescription:
    "Convert your dog's age to human years with the 2020 epigenetic-clock formula from University of California San Diego, and compare it with the old seven-times rule.",
  intro:
    "A 5-year-old dog is roughly 56.8 in human years by the most recent scientific formula, well above the 35 years that the old rule of multiplying by seven would suggest. The popular seven-year rule is a myth: dogs mature much faster than people in their first couple of years, then age more slowly. In 2020 researchers at the University of California San Diego studied chemical changes to the DNA of 105 Labrador retrievers, the same kind of changes that mark human aging, and found that human age is about 16 times the natural logarithm of the dog's age plus 31. Enter your dog's age in years, using decimals for months such as 2.5, and the calculator applies that formula and shows the seven-times figure next to it for comparison. Treat the answer as a guide rather than a fact, because the study covered one breed, and lifespan and aging speed differ widely between small, large and giant breeds. The formula is not meant for puppies under about six months.",
  inputs: [{ name: 'dogAge', label: "Dog's age (years)", type: 'number', min: 0.5, max: 30, default: 5, validator: numberField({ min: 0.5, max: 30 }) }],
  outputs: [
    { name: 'humanAge', label: 'Equivalent human age', format: 'number', highlight: true },
    { name: 'sevenRule', label: 'Old "× 7" rule (for comparison)', format: 'number' },
  ],
  calculate: (i) => {
    const age = toD(i.dogAge);
    return {
      humanAge: fmtNumber(age.ln().mul(16).plus(31), 1),
      sevenRule: fmtNumber(age.mul(7), 1),
    };
  },
  formulaDescription:
    'Human age ≈ 16 × ln(dog age in years) + 31, where ln is the natural logarithm. This is the epigenetic-clock formula published in 2020 (Wang et al., Cell Systems) from DNA methylation in Labrador retrievers. For comparison, the old rule is dog age × 7. The formula is meant for dogs of about six months and older.',
  workedExample:
    'A 5-year-old dog: ln(5) = 1.6094, so 16 × 1.6094 = 25.75 and 25.75 + 31 = 56.75, shown as 56.8 human years. The old rule gives 5 × 7 = 35. At 1 year, ln(1) = 0, so the formula gives exactly 31 human years.',
  faq: [
    {
      question: 'Is one dog year really seven human years?',
      answer:
        'No. The seven-times rule is a rough rule of thumb with no scientific basis. Dogs age quickly early on, so a one-year-old dog is closer to a 30-year-old person, and aging then slows.',
    },
    {
      question: 'How was the dog-age formula developed?',
      answer:
        "Researchers compared DNA methylation patterns, a chemical marker that changes with age, in 105 Labrador retrievers with the pattern in humans. That produced the logarithmic formula of 16 times the natural log of the dog's age plus 31.",
    },
    {
      question: 'Does the formula work for every breed?',
      answer:
        'Not exactly. It was calibrated on Labrador retrievers. Small breeds usually live longer and giant breeds live shorter lives, so the human-age equivalent can differ by several years for the same age.',
    },
    {
      question: "Why can't I enter a very young puppy?",
      answer:
        'The logarithm drops sharply for ages under half a year, and the research did not cover tiny puppies, so the result would not be reliable. The calculator accepts ages from six months.',
    },
  ],
  relatedSlugs: ['age-calculator', 'percentage-calculator', 'date-difference-calculator'],
  lastUpdated: '2026-11-22',
};

export default config;
