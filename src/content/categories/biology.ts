import type { HubContent } from './types';

const hub: HubContent = {
  category: 'biology',
  title: 'Biology Calculators: Growth, Genetics and Lab Dilutions',
  metaDescription:
    'Free biology calculators for population growth, genetic ratios and laboratory dilutions, with the underlying models explained and their limits made clear.',
  h1: 'Biology Calculators',
  lede: 'Biology is less exact than physics, and its calculators reflect that. Many describe a model of living systems, such as exponential growth or Mendelian inheritance, that holds under stated conditions and breaks down outside them. This overview explains the common biological calculations, how they relate, and how to judge when a simple model fits the question you are asking.',
  sections: [
    {
      heading: 'What biology calculations are used for',
      paragraphs: [
        'Biology calculations fall into a few families. Growth calculations describe how a population of cells, organisms or molecules changes over time. Genetics calculations predict the proportions of traits in offspring. Laboratory calculations prepare solutions and dilutions and convert between units of concentration. Statistical calculations, such as sample sizes and averages, support experiments across all of them.',
        'Students use these tools throughout a biology course, from introductory genetics problems to laboratory practicals. Researchers use them to plan experiments and to check the arithmetic of routine preparation. Gardeners, breeders and aquarium keepers use simplified forms for practical work, such as estimating how a population will grow, or the likely ratio of traits in a litter or a seed batch.',
        'In each case the aim is to turn a biological question into a number you can test, and then to compare that number with what you observe.',
      ],
    },
    {
      heading: 'How the formulas relate to each other',
      paragraphs: [
        'Population growth models share a common structure. In the simplest, exponential growth, the population is multiplied by a constant factor in each time period, so the number of individuals grows faster as it gets larger. The doubling time, the time for the population to double, is a convenient way to describe that factor and connects directly to the growth rate through a logarithm.',
        'A more realistic model, logistic growth, adds a limit, called the carrying capacity. Growth is fast when the population is small, slows as resources become scarce and levels off at the limit. Exponential growth is the early part of the logistic curve, which is why it fits well for a short time and then fails.',
        'Genetics calculations rest on probability. When two parents each carry two versions of a gene, the combinations in the offspring follow fixed ratios, which a Punnett square lays out. For a single gene with one dominant and one recessive version, crossing two heterozygous parents gives the familiar three-to-one ratio of dominant to recessive appearance. For two genes inherited independently, the probabilities multiply.',
        'Laboratory dilutions use the same idea as in chemistry: the amount of the substance is unchanged when you add diluent, so concentration times volume is conserved. Serial dilutions repeat the step, so the overall dilution factor is the product of the factors at each step.',
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The most common mistake is applying exponential growth for too long. Real populations do not grow indefinitely, and a calculation that predicts billions of bacteria from a single cell is correct arithmetic about an unrealistic situation. Always ask what limits the growth in the real system.',
        'A second mistake is treating a genetic ratio as a guarantee. A three-to-one ratio is a probability for each offspring, not a count that must appear in every family. In a small number of offspring, the observed ratio can differ substantially from the expected one by chance, and it only approaches the expected ratio as numbers increase.',
        'Third, assuming independent inheritance when genes are linked. The multiplication rule for two genes requires that they are inherited independently. Genes that sit close together on the same chromosome tend to be inherited together, and the simple ratios no longer apply.',
        'Fourth, mixing up units of concentration and volume in dilution work. Check whether a dilution factor is expressed as a ratio, such as one to ten, or as a fraction. The meaning of a one-to-ten dilution is sometimes ambiguous between one part in ten total and one part to ten parts of diluent, so state it explicitly.',
        'Finally, forgetting that a model is not the organism. Every calculator here simplifies. Where a decision depends on the biology, such as medical, agricultural or environmental choices, the result is a starting point to discuss with someone who knows the system.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        'Students benefit from being able to check a genetics cross or a growth calculation quickly and to see the pattern behind the result. Seeing how the numbers change when you alter a rate or a starting size builds an intuition for why the models behave as they do.',
        'Laboratory workers benefit from a reliable, repeatable method for dilutions and concentrations. Preparation errors are among the most common causes of failed experiments, and an arithmetic check is a cheap safeguard.',
        'Teachers and writers use the calculators to produce examples and to illustrate how a simple model is built and when it stops working, which is a skill that matters as much as any single formula.',
        'These calculators are for educational and informational purposes only. They are not a substitute for professional scientific or medical advice, and they should not be used to make clinical, diagnostic or safety decisions.',
      ],
    },
  ],
  subclusters: [],
  featured: [],
  guide: [],
};

export default hub;
