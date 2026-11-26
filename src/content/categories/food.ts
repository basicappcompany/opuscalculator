import type { HubContent } from './types';

const hub: HubContent = {
  category: 'food',
  title: 'Food and Cooking Calculators: Recipes and Nutrition',
  metaDescription:
    'Free food calculators for scaling recipes, converting cooking measures and estimating nutrition, with the common kitchen mistakes explained and ingredient caveats stated.',
  h1: 'Food and Cooking Calculators',
  lede: 'Kitchen arithmetic is full of small traps: a recipe for four that must feed ten, a cup measure that has to become grams, an oven temperature in the wrong scale. Cooking tolerates a degree of improvisation, but baking and nutrition tracking reward accuracy. This overview explains the common food calculations, how they relate, and where an estimate needs a second look.',
  sections: [
    {
      heading: 'What food calculations are used for',
      paragraphs: [
        'The most common use is scaling. A recipe is written for a certain number of servings, and a cook needs the same dish for more or fewer people. Each ingredient must be multiplied by the same factor, and the cooking time and the size of the pan may need adjusting as well.',
        'The second is converting measures. Recipes use cups, spoons, grams, ounces, millilitres and degrees in two scales, depending on where they were written. A calculator that converts reliably saves both effort and spoiled dishes.',
        'The third is nutrition: estimating the energy, protein, carbohydrate and fat in a portion, or the cost per serving. People use these figures to plan meals, to follow a dietary programme and to compare options. For anyone with a medical dietary requirement or an allergy, the numbers are only a part of a wider picture.',
      ],
    },
    {
      heading: 'How the formulas relate to each other',
      paragraphs: [
        'Scaling is a single multiplication. The scaling factor is the number of servings you want divided by the number the recipe makes, and every ingredient quantity is multiplied by it. This is the same proportional reasoning as in a percentage or ratio problem, and it is the simplest and most useful kitchen calculation.',
        'Volume-to-weight conversion is a different kind of calculation, because it depends on the ingredient. A cup is a volume, a gram is a mass, and the link between them is the density of the ingredient. A cup of flour weighs much less than a cup of sugar, and flour itself varies depending on how it is packed. There is no single factor for converting cups to grams, only a factor for each ingredient.',
        "Temperature conversion needs both a multiplier and an offset, since the scales start at different points. Nutrition calculations are sums: the energy in a dish is the sum of the energy in its ingredients, which in turn is each ingredient's weight times its energy per unit of weight.",
        "Taken together, a cook's calculation is usually a chain: scale the recipe, convert the quantities to the units on the kitchen scale, then check the temperature and time. Each link is simple, and mistakes mostly come from skipping one.",
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The most common mistake in scaling is assuming that everything scales equally. Quantities do, but cooking time often does not, because a larger volume of food takes longer to heat through while a thinner layer takes less. Spices and salt can also be too strong when multiplied straight, so scale them cautiously and adjust to taste.',
        'A second mistake is using a volume conversion for the wrong ingredient. Using a generic figure for grams per cup gives results that can be wrong by a significant margin, especially for flour, which compresses. Where precision matters, as in baking, weighing ingredients is more reliable than measuring by volume.',
        'Third, confusing similar units. A US cup, a metric cup and an imperial cup are different sizes. A tablespoon is different in different countries, and a fluid ounce is not the same as an ounce of weight. Check which standard the recipe uses before converting.',
        'Fourth, treating nutrition estimates as exact. Labels and databases report averages, natural foods vary, and cooking changes weight through water loss. Estimates are useful for comparison and trends, and they should not be read as precise.',
        'Finally, overlooking allergens and dietary needs. A calculator works on quantities and does not check whether an ingredient is safe for you. Always read ingredient labels yourself, since formulations change.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        'Home cooks benefit most, particularly when cooking for a different number of people than a recipe was written for, or when following a recipe from another country. The result is less waste and fewer failed dishes.',
        'Bakers benefit from converting to weights, because baking is more sensitive to proportions than most cooking. Working in grams makes results more consistent from one batch to the next.',
        'People tracking nutrition benefit from fast estimates for portions and meals, and from seeing how different ingredient choices change the total, as long as they remember the figures are approximate. Anyone cooking on a budget, running a small food business or catering for an event also benefits, since the same scaling arithmetic gives the quantity of each ingredient to buy and a cost per portion, which makes pricing and shopping lists much more reliable.',
        'These calculators give estimates only. Check all ingredients against known allergies, and consult a dietitian for medical or therapeutic dietary needs. Nothing here replaces the advice of a professional who knows your health history.',
      ],
    },
  ],
  subclusters: [],
  featured: [],
  guide: [],
};

export default hub;
