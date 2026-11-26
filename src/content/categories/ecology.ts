import type { HubContent } from './types';

const hub: HubContent = {
  category: 'ecology',
  title: 'Ecology Calculators: Populations, Density and Footprints',
  metaDescription:
    'Free ecology calculators for population density, growth and carbon footprints, with the models explained and the uncertainty in environmental estimates made clear.',
  h1: 'Ecology Calculators',
  lede: 'Ecology asks how living things relate to each other and to their surroundings, and its calculations try to put numbers on those relationships: how crowded a habitat is, how fast a population changes, how much carbon an activity releases. Each answer rests on assumptions about a messy natural system, so understanding the assumptions matters as much as the arithmetic.',
  sections: [
    {
      heading: 'What ecological calculations are used for',
      paragraphs: [
        'Ecologists, students and conservation workers use a small set of core measures. Density describes how many individuals live in a given area. Growth rate describes how a population changes between surveys. Diversity indices summarise how many species there are and how evenly they are spread. Footprint calculations estimate the environmental cost of activities such as travel, energy use and food.',
        "These measures turn field observations into figures that can be compared across sites and over time. A single count of animals in a meadow means little on its own, but a density that can be compared with last year's, or with a neighbouring habitat, supports a conclusion about whether a population is rising or falling.",
        'The general public uses simplified versions, mostly for personal footprint estimates. The aim there is awareness and comparison between choices, rather than an exact accounting.',
      ],
    },
    {
      heading: 'How the formulas relate to each other',
      paragraphs: [
        'Density is the starting point: the number of individuals divided by the area they occupy. Comparing density at two times gives the change in the population, and the percentage change per year gives a growth rate. If growth is steady in proportion, the compound growth formula used in finance applies equally to rabbits and to bank balances.',
        'Growth models then extend this. Exponential growth assumes the rate stays constant and is a good description over short periods when resources are plentiful. Logistic growth adds a carrying capacity, the population that the environment can sustain, and describes the levelling off that real populations show as resources become limited.',
        'Diversity indices summarise a different property. Species richness is simply the count of species. Indices such as the Shannon index also take into account how evenly individuals are distributed across species, so a community dominated by one species scores lower than one with the same number of species in more even numbers.',
        'Footprint calculations are sums of products. Each activity, such as a kilometre driven or a kilowatt-hour used, is multiplied by an emission factor, and the results are added together. The structure is simple, and the hard part is the quality of the factors, which vary by country, year and method.',
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The most common mistake is treating a sample as a census. A count made in one plot on one day estimates a population, and the estimate carries uncertainty from where and when the sample was taken. Scaling a plot count up to a whole region assumes the plot is representative, which is often not the case.',
        'A second mistake is extrapolating growth beyond its limits. A population growing at a steady rate for a few years does not keep doing so. Using an exponential model to predict far into the future is almost always misleading, because resources, predators and disease eventually limit growth.',
        'Third, comparing diversity indices that were calculated differently. Different indices emphasise different features, and a value from one is not comparable with a value from another. Compare like with like, and report which index you used.',
        'Fourth, over-trusting footprint figures. Emission factors are averages, and the same activity can have very different emissions depending on how the energy is generated or how a product was made. A personal footprint estimate is good for spotting the largest contributors, and weak as a precise total.',
        'Finally, drawing causal conclusions from a number. A falling population density tells you something has changed. It does not tell you why, and an explanation needs evidence beyond the calculation.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        'Students of ecology and environmental science benefit from working through density, growth and diversity calculations with checkable examples. The calculators show the formula and an example, so the method can be reproduced by hand.',
        'Citizen scientists and volunteers who contribute to wildlife surveys benefit from quick ways to turn counts into comparable figures, and from a clear statement of what those figures can and cannot show. Land managers, teachers running field studies and local conservation groups gain a shared vocabulary, because everyone is calculating density or growth in the same way. Consistency of method is often more valuable than sophistication, since a simple measure repeated every year shows a trend that a clever one used once cannot.',
        'Individuals and small organisations interested in their environmental impact benefit from an approximate footprint to identify where changes would matter most, even though the absolute number is uncertain.',
        'These calculators are for educational and informational purposes. They are not a substitute for professional scientific or environmental advice. For regulatory reporting, conservation planning or claims about environmental impact, use recognised methods and consult a qualified specialist.',
      ],
    },
  ],
  subclusters: [],
  featured: [],
  guide: [],
};

export default hub;
