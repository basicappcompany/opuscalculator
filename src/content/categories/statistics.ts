import type { HubContent } from './types';

const hub: HubContent = {
  category: 'statistics',
  title: 'Statistics Calculators: Spread, Samples and Confidence',
  metaDescription:
    'Free statistics calculators for standard deviation and sample size, with the formulas shown and the common mistakes in using them explained in plain language.',
  h1: 'Statistics Calculators',
  lede: 'Statistics is the discipline of drawing careful conclusions from incomplete data. Its calculations, such as the spread of a set of numbers or the number of people to survey, are short, but their meaning is easy to misread. These calculators handle the arithmetic and show the formulas, and this overview explains what the statistics tell you, and what they do not.',
  sections: [
    {
      heading: 'What statistical calculations are used for',
      paragraphs: [
        'Statistical calculations answer two broad questions. The first is descriptive: what does this set of data look like. Averages say where the centre is, and measures of spread, such as the standard deviation, say how widely the values vary around it. The second is inferential: what can I conclude about a larger group from a smaller sample, and how sure can I be.',
        'They are used everywhere data is gathered. Researchers design studies and report results. Businesses run surveys and tests of products. Quality engineers monitor whether a process is stable. Teachers analyse exam scores, and journalists read polls. Each of them needs a few reliable calculations and a clear sense of what those calculations assume.',
        'Because statistical results are used to justify decisions, correctness matters in two senses: the arithmetic must be right, and the method must suit the question. The first is what a calculator provides. The second remains the responsibility of the person using it.',
      ],
    },
    {
      heading: 'How the formulas relate to each other',
      paragraphs: [
        'The standard deviation is built from the mean. For each value you take its distance from the mean and square it, average those squared distances to get the variance, then take the square root to return to the original units. A small standard deviation means the values cluster tightly around the average. A large one means they are scattered.',
        'The sample size formula builds on spread and confidence. To estimate a proportion, such as the share of people who prefer a product, the number of responses needed depends on how precise you want the answer to be, which is the margin of error, and how confident you want to be, which sets a critical value from the normal distribution. Tighter precision and higher confidence both require larger samples.',
        'These ideas connect through the standard error, which describes how much a sample average is expected to vary from sample to sample. It shrinks with the square root of the sample size, which is why quadrupling a sample only halves the uncertainty. Many statistical formulas are some version of that relationship.',
        'Seeing the connections helps in practice. The spread of your data feeds directly into how large a sample you need, and the confidence level you choose determines how many people you must ask. Planning a study is largely a matter of trading precision against cost.',
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The most common error with standard deviation is mixing up the population and sample versions. When your data is the entire group of interest, you divide by the number of values. When it is a sample from a larger group, you divide by one less than the number of values, which corrects for the tendency of a sample to underestimate spread. Using the wrong one gives a slightly different answer, noticeable with small datasets.',
        'A second mistake is reading standard deviation as meaningful for any data. It describes spread well for roughly symmetric data. For heavily skewed data or data with extreme outliers, a single large value can dominate it. Look at the data before summarising it.',
        'Third, using a sample size formula and then ignoring the assumptions. The usual formula assumes a random sample, and it says nothing about bias. A very large sample gathered badly, for example from only the people who chose to respond, can still give a wrong answer. A big sample reduces random error, not systematic error.',
        'Fourth, forgetting the population correction and the response rate. If you need four hundred completed responses and expect a quarter of people to reply, you must contact sixteen hundred. The number the formula returns is the number you need to complete, not the number you need to invite.',
        'Finally, treating a confidence level as a probability that your particular result is right. A ninety-five percent confidence level describes the long-run behaviour of the method across many samples. It does not say there is a ninety-five percent chance that this one interval contains the true value, though that is how it is often misdescribed.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        'Students learning statistics benefit from checking their working and seeing the formula next to the answer. Computing a standard deviation by hand is a good exercise, and a calculator lets you confirm the result and find your slip.',
        'Researchers and analysts planning a survey or an experiment benefit from the sample size tool. Settling the required sample before data collection avoids two expensive failures: surveying too few people to see anything, and surveying far more than necessary.',
        'Small business owners and community organisations, who often run informal surveys without a statistician, benefit from having a defensible rule for how many responses are enough, and a clear statement of the margin of error that comes with it.',
        'These calculators give the standard textbook results. For regulated research, clinical studies or any decision with serious consequences, involve a qualified statistician who can check that the method suits your design, your data and your question.',
      ],
    },
  ],
  subclusters: [
    {
      label: 'Describing data',
      blurb: 'Measure how spread out a set of values is.',
      slugs: ['standard-deviation-calculator'],
    },
    {
      label: 'Planning a survey',
      blurb: 'Work out how many responses you need.',
      slugs: ['sample-size-calculator'],
    },
  ],
  featured: [
    {
      slug: 'standard-deviation-calculator',
      blurb:
        'Takes a list of numbers and returns the mean, variance and standard deviation, for either a sample or a whole population. Use it to summarise how consistent a set of measurements or scores is.',
    },
    {
      slug: 'sample-size-calculator',
      blurb:
        'Calculates how many survey responses you need for a chosen confidence level and margin of error. Run it before you collect data, so you know when you have enough.',
    },
  ],
  guide: [
    {
      situation: 'You have a list of values and want to know how consistent they are',
      slug: 'standard-deviation-calculator',
      advice: 'Choose the sample version unless your list is every value in the group you care about.',
    },
    {
      situation: 'You are planning a survey and need to know how many responses to collect',
      slug: 'sample-size-calculator',
      advice: 'Divide the result by your expected response rate to get the number of people to invite.',
    },
  ],
};

export default hub;
