import type { HubContent } from './types';

const hub: HubContent = {
  category: 'conversion',
  title: 'Unit Conversion Calculators: Length, Weight and More',
  metaDescription:
    'Free unit converters for length, weight, volume and temperature, with exact conversion factors, worked examples and the mistakes that cause wrong conversions.',
  h1: 'Unit Conversion Calculators',
  lede: 'Unit conversion is the most common calculation in the world and one of the easiest to get wrong, because the arithmetic is trivial and the attention is not. A recipe in cups, a table in centimetres and a form in inches all describe the same quantities in different languages. These converters use exact factors and show them, so you can see what was multiplied and trust the result.',
  sections: [
    {
      heading: 'What unit conversions are used for',
      paragraphs: [
        'People convert units whenever two systems meet. Travel is the obvious case: distances, temperatures and fuel economy change from one country to the next. Shopping across borders brings sizes and weights in unfamiliar units. Recipes written for one market need adapting for another. Any product that ships internationally has a specification that must be expressed in both metric and imperial or US customary units.',
        'Work and study use conversions constantly too. Engineers and technicians move between units when a drawing, a part and a standard disagree. Students convert as a standard step in physics and chemistry problems. Healthcare workers convert between units of mass and volume when preparing doses, an area where a slip has serious consequences and where a second check is always wise.',
        'The common thread is that the underlying quantity does not change, only its description. Converting is relabelling, and the calculators here are designed to make that relabelling exact and visible.',
      ],
    },
    {
      heading: 'How conversions work and relate to each other',
      paragraphs: [
        'Most conversions multiply by a fixed factor. One inch is defined as exactly 2.54 centimetres, so converting centimetres to inches means dividing by 2.54, and the reverse means multiplying. Because the factor is exact by definition, the result is as precise as the number you start with. Other factors, such as pounds to kilograms, are also exact by definition, even though the figure has several decimal places.',
        'Some conversions need an offset as well as a factor. Temperature is the standard example: Celsius and Fahrenheit differ by both a scale and a starting point, so you multiply and add. Treating a temperature conversion like a simple scaling is a frequent mistake, and it is why temperature is handled separately from length or mass.',
        'Conversions also chain. To go from centimetres to feet you can go via inches, or via metres. Each route gives the same answer if the factors are exact, but intermediate rounding can make the routes disagree. That is why these tools keep full precision through the calculation and round only at the end.',
        'Within a family of units, every pair is connected. Length has many units, and converting between any two is the same operation: multiply by the ratio of their sizes. The tools here are organised by family and by pair so that the common ones are one step away.',
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The most frequent mistake is inverting the conversion: multiplying when you should divide. A quick sense check helps. A centimetre is smaller than an inch, so a number of centimetres is larger than the same length in inches, and the converted figure should be smaller. If the answer moves in the wrong direction, the factor was applied the wrong way round.',
        'A second mistake is confusing units with similar names. A US gallon and an imperial gallon are different sizes. A US ton, a long ton and a metric tonne differ. A fluid ounce measures volume and an ounce measures weight. In each case the same word hides a different quantity, so make sure the unit you are converting is the unit you mean.',
        'Third, using rounded factors in chained conversions. If you round a factor to two or three digits and apply it several times, the error grows. Where accuracy matters, use the exact value or a calculator that keeps full precision.',
        'Fourth, forgetting that squared and cubed units need squared and cubed factors. One metre is one hundred centimetres, but one square metre is ten thousand square centimetres, and one cubic metre is a million cubic centimetres. Applying the linear factor to an area or a volume is a common source of large errors.',
        'Finally, reporting unreasonable precision. If you measure a board as 90 centimetres, converting to 35.4331 inches does not make the measurement more precise. Keep the number of significant figures in line with the original measurement.',
      ],
    },
    {
      heading: 'Who benefits from these converters',
      paragraphs: [
        'Travellers, online shoppers and anyone cooking from an overseas recipe benefit from the fast, reliable answer. For them the value is convenience: no mental arithmetic and no fear of a decimal slip while standing in a shop or a kitchen.',
        'Tradespeople, hobbyists and makers use converters to translate plans and specifications. A drawing in one system and a tape measure in another is a routine situation, and an exact conversion avoids wasted material.',
        'Students use them to check unit conversions inside larger problems, where a unit error can quietly ruin a long calculation. Seeing the factor used makes it easier to learn the common ones and to spot an answer that has the wrong order of magnitude.',
        "These converters are suitable for general use. For medical dosing, laboratory work or engineering with safety implications, follow your organisation's protocols and verify conversions independently, since the cost of a unit error in those settings is high.",
      ],
    },
  ],
  subclusters: [
    {
      label: 'Length',
      blurb: 'Metric and imperial distance conversions.',
      slugs: ['cm-to-inches'],
    },
  ],
  featured: [
    {
      slug: 'cm-to-inches',
      blurb:
        'Converts centimetres to inches using the exact 2.54 factor, and shows the result in feet and inches as well as decimal inches. It is the conversion most people need for clothing sizes, screens and furniture.',
    },
  ],
  guide: [
    {
      situation: 'You have a length in centimetres and need inches',
      slug: 'cm-to-inches',
      advice: 'Check that the answer is smaller than the number you started with, since an inch is the larger unit.',
    },
  ],
};

export default hub;
