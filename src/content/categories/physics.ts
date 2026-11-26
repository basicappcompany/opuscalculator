import type { HubContent } from './types';

const hub: HubContent = {
  category: 'physics',
  title: 'Physics Calculators: Electricity, Motion and Energy',
  metaDescription:
    'Free physics calculators for electricity, motion and energy, with each formula shown, units explained and the usual mistakes pointed out before they cost you marks.',
  h1: 'Physics Calculators',
  lede: 'Physics calculations are short equations that link a few measured quantities, and most of the difficulty is in the units and in knowing which equation fits the situation. A calculator removes the arithmetic, but it cannot choose the right relationship for you. These pages show the formula, the units and a worked example, and this overview explains how the common formulas connect and where students most often go wrong.',
  sections: [
    {
      heading: 'What physics calculations are used for',
      paragraphs: [
        'Physics calculators serve students first. Homework, revision and lab reports all involve applying a formula to measured values, and checking an answer quickly makes it easier to find the step where a mistake crept in. A good calculator shows the relationship as well as the result, so the learner can see which quantities depend on which.',
        'They are also used by hobbyists and practitioners. Anyone building a circuit, sizing a battery, estimating how far a vehicle travels or working out how much energy an appliance uses is using a physics formula, whether or not they call it that. For these users the calculator is a practical shortcut, and the units matter more than the theory.',
        'A third use is estimation. Physics encourages order-of-magnitude thinking: is this answer around ten, or around ten thousand. Running a quick calculation with rounded inputs often reveals whether a design or a claim is plausible before any detailed work begins.',
      ],
    },
    {
      heading: 'How the formulas relate to each other',
      paragraphs: [
        'Most introductory formulas are one of a small number of shapes. Many are simple proportions, such as voltage equals current times resistance, or force equals mass times acceleration. A few involve squares, such as kinetic energy depending on the square of speed. The shape tells you how sensitive the result is: doubling a quantity in a proportional formula doubles the answer, while doubling a squared quantity quadruples it.',
        "Different areas of physics also share structure. Ohm's law links voltage, current and resistance. Electrical power links voltage, current and power, and combining it with Ohm's law gives power in terms of current and resistance, or voltage and resistance. This pattern of substitution runs throughout the subject: once you know two relationships that share a variable, you can eliminate that variable and derive a third.",
        'Energy is the thread that ties areas together. Electrical energy, kinetic energy, potential energy and heat are all measured in joules, and many problems reduce to tracking where energy goes. A formula from one topic can often be linked to another through energy, which is why unit conversions and consistent notation matter so much.',
        'For that reason these calculators allow you to solve for different unknowns from the same relationship. If a formula links three quantities, knowing any two gives the third, and being able to rearrange freely is the central skill the calculators are designed to support.',
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The most common source of wrong answers is units. A formula only works if its quantities use consistent units, and mixing milliamps with amps, or kilometres per hour with metres per second, produces answers that are wrong by large factors. Convert everything to a consistent set, usually standard units, before you substitute, and check the unit of the final answer.',
        "A second mistake is applying a formula outside its conditions. Ohm's law describes ohmic components, where resistance is constant. It does not describe a diode or a filament lamp whose resistance changes with voltage and temperature. Equations of motion with constant acceleration do not hold when the acceleration varies. Every formula has a range of validity, and reading it is part of using it.",
        'Third, confusing similar quantities. Mass and weight, speed and velocity, power and energy, and heat and temperature are pairs that are used interchangeably in everyday speech but mean different things in physics. A calculation that mixes them up gives a number that looks sensible and means nothing.',
        'Fourth, rounding too early and quoting too many digits. Carry a few extra digits through the working, round at the end, and report a result with no more precision than the inputs justify. Reporting a result to six figures from inputs measured to two is false precision.',
        'Finally, sign and direction errors. Quantities such as velocity, force and displacement have direction, and a calculation that ignores it can produce an answer with the wrong sign. Choose a positive direction at the start and stay consistent.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        "Secondary and university students benefit most, particularly when they use the calculator to check a hand-worked answer rather than to replace the working. Comparing your own result with the calculator's result, and then finding the difference, is one of the quickest ways to learn.",
        'Electronics hobbyists and technicians use the electrical tools to choose resistor values, check current draw and avoid overloading components. For them the benefit is speed and the reduced chance of an arithmetic slip that would otherwise burn out a part.',
        'Teachers and tutors use worked examples to build questions and to check answer keys. Because each calculator shows its formula and an example, it also doubles as a quick reference for the relationship in question.',
        'These tools are for education and estimation. For safety-critical work, such as mains wiring or structural design, rely on qualified professionals, applicable standards and proper engineering tools. The calculators give the idealised result of a textbook formula, and real systems add losses, tolerances and safety margins that the formula does not include.',
      ],
    },
  ],
  subclusters: [
    {
      label: 'Electricity',
      blurb: 'Voltage, current, resistance and power.',
      slugs: ['ohms-law-calculator'],
    },
  ],
  featured: [
    {
      slug: 'ohms-law-calculator',
      blurb:
        'Solves for voltage, current or resistance when you know the other two. It also reports the power in watts, and it is the first calculator to use for any basic circuit question.',
    },
  ],
  guide: [
    {
      situation: 'You know two of voltage, current and resistance and need the third',
      slug: 'ohms-law-calculator',
      advice: 'Convert to base units first, and remember the law only holds for components with constant resistance.',
    },
  ],
};

export default hub;
