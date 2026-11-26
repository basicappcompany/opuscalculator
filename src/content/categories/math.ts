import type { HubContent } from './types';

const hub: HubContent = {
  category: 'math',
  title: 'Math Calculators: Percentages and Everyday Arithmetic',
  metaDescription:
    'Free math calculators for percentages and everyday arithmetic, with the formulas shown, worked examples, and the common mistakes that give wrong answers.',
  h1: 'Math Calculators',
  lede: 'Most of the maths people use in daily life is a small set of operations: percentages, ratios, fractions and a little algebra. The calculations are simple, but they are easy to set up wrongly, and a wrong setup gives a confident, wrong answer. These calculators handle the arithmetic and show the formula, so you can check that the question you asked is the question you meant.',
  sections: [
    {
      heading: 'What these calculations are used for',
      paragraphs: [
        'Percentages are the workhorse of everyday maths. They appear in prices, discounts, tax, tips, grades, interest, exam scores, statistics in the news and changes in anything that can be measured. Whenever a figure is described as a share of something, or as having grown or shrunk by some proportion, a percentage calculation is underneath it.',
        'Beyond percentages, the same family of tools covers ratios and proportions, rounding, averages, powers and roots, and conversions between fractions, decimals and percentages. Each is a different way of describing how one quantity relates to another, and each has a handful of standard formulas.',
        'People reach for these calculators in several situations: checking a sum quickly, double-checking homework, scaling a recipe or a plan, working out how much a change really is, and settling a disagreement about what a figure means. In each case the aim is the same: a reliable answer without the risk of a slip in manual arithmetic.',
      ],
    },
    {
      heading: 'How the formulas relate to each other',
      paragraphs: [
        'Every percentage problem has three quantities: a part, a whole and a rate. The three standard questions are what is the rate percent of the whole, what percent is the part of the whole, and what whole has this part as its rate percent. They are three rearrangements of one equation: part equals rate times whole, with the rate written as a decimal.',
        'Percentage change is a fourth variation. It compares a new value with an old one: subtract the old from the new, divide by the old, and multiply by one hundred. The key detail is that the base is always the old value, which is the source of many mistakes, covered below.',
        'Ratios and fractions are the same relationship written differently. A ratio of one to four, the fraction one quarter, the decimal 0.25 and the percentage twenty-five percent all describe the same relationship between a part and a whole. Moving between these forms is just multiplying or dividing by one hundred, or by the denominator.',
        'Seen this way, the whole family is small. A learner who understands part, whole and rate can solve the great majority of everyday problems, and a calculator is mostly a fast way to avoid arithmetic slips while keeping the reasoning visible.',
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The classic error is using the wrong base. If a price rises by ten percent and then falls by ten percent, it does not return to where it started, because the second ten percent is taken from a larger number. The same asymmetry explains why a fifty percent loss needs a one hundred percent gain to recover. Always ask: percent of what?',
        'A second error is confusing percentage points with percent. If an interest rate moves from four percent to five percent, it has risen by one percentage point, but by twenty-five percent in relative terms. News reports, loan offers and survey results often use one when readers assume the other, so check which is meant.',
        'Third, adding percentages that apply to different bases. A twenty percent discount followed by a further ten percent off is not thirty percent off. The second discount applies to the already reduced price, so the combined discount is twenty-eight percent. Stacked changes multiply, they do not add.',
        'Fourth, rounding too early. If you round each step of a multi-step calculation, small errors accumulate. Carry the full precision through and round only the final answer. The calculators on this site use exact decimal arithmetic rather than ordinary floating point numbers, so results such as one-tenth plus two-tenths come out as exactly three-tenths.',
        'Finally, reading the question too quickly. A phrase such as ten percent more than, ten percent of, and ten percent less than each leads to a different setup. Take a moment to write which quantity is the whole before you calculate anything.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        'Students use them to check their working. Seeing the formula and a worked example next to the result helps a learner understand why an answer is right, not just that it is. A calculator that shows its steps is a study tool as much as a shortcut.',
        'Shoppers and small business owners use them to cut through marketing. A banner announcing a percentage off, a mark-up quoted by a supplier or a margin target in a pricing plan can be translated into actual amounts in seconds, which makes comparison honest.',
        'Professionals who use numbers occasionally, such as managers writing a report or teachers marking assessments, benefit from a quick, trustworthy way to verify a figure. The value is less in the speed than in the confidence that the sum has been done correctly.',
        'Anyone who has felt uncertain about percentages will find that the confusion mostly disappears once the three quantities are named. Start from the part, the whole and the rate, decide which one you are looking for, and the calculation follows.',
      ],
    },
  ],
  subclusters: [
    {
      label: 'Percentages',
      blurb: 'Parts, wholes and rates.',
      slugs: ['percentage-calculator'],
    },
  ],
  featured: [
    {
      slug: 'percentage-calculator',
      blurb:
        'Answers the three standard percentage questions in one place: what is a percent of a number, what percent one number is of another, and how much a value has changed. Start here whenever a problem contains the word percent.',
    },
  ],
  guide: [
    {
      situation: 'You need a percentage of a number, a share, or a percentage change',
      slug: 'percentage-calculator',
      advice: 'Decide which number is the whole first, since that is the figure most mistakes come from.',
    },
  ],
};

export default hub;
