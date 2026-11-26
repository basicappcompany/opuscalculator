import type { HubContent } from './types';

const hub: HubContent = {
  category: 'chemistry',
  title: 'Chemistry Calculators: Moles, Molarity and Solutions',
  metaDescription:
    'Free chemistry calculators for moles, molar mass, concentration and dilution, with the formulas shown and the usual mistakes in units and significant figures explained.',
  h1: 'Chemistry Calculators',
  lede: 'Chemistry calculations translate between the things you can weigh or measure, such as grams and millilitres, and the things that reactions actually depend on, which is the number of particles. The central idea is the mole, and nearly everything else, from concentration to yield, is built on it. This overview explains how the common calculations connect and where learners usually lose marks.',
  sections: [
    {
      heading: 'What chemistry calculations are used for',
      paragraphs: [
        'Most chemistry calculations are bookkeeping for matter. A reaction combines substances in fixed proportions, and to prepare or predict anything you need to know how much of each substance is involved. Calculators help convert a mass in grams into an amount in moles, find how much of a product a reaction can make, and work out how concentrated a solution is.',
        'Students meet these calculations from the first weeks of a course, and they remain central through university. Laboratory staff use them daily to prepare solutions of a required concentration, to dilute stock solutions and to check yields. Hobbyists, from home brewers to aquarium keepers, use simplified versions of the same ideas when they mix solutions or adjust water chemistry.',
        "Because laboratory work involves real materials, accuracy and safety both matter. A calculator can remove arithmetic errors, but it does not replace the lab's protocols or the judgement of a qualified chemist.",
      ],
    },
    {
      heading: 'How the formulas relate to each other',
      paragraphs: [
        'The mole is the hub. The molar mass of a substance, found by adding up the atomic masses of its elements, links mass and moles: moles equal mass divided by molar mass. Once a quantity is in moles, it can be compared directly with any other substance in a balanced equation, because the coefficients in the equation are ratios of moles.',
        'Concentration builds on the mole. Molarity is moles of solute per litre of solution, so moles equal molarity times volume. This is why a single relationship lets you move between a mass of solid, a volume of solution and a concentration, depending on which two you know.',
        'Dilution follows from the same idea. When you add solvent to a solution, the amount of solute does not change, only the volume. That gives the familiar relationship in which the starting concentration times the starting volume equals the final concentration times the final volume. It is the mole relationship used twice, before and after.',
        "Yield calculations combine these steps. Start with a mass, convert to moles, use the equation's ratio to find the moles of product, convert back to a mass and compare the actual result with the theoretical one. Each calculator handles one link in that chain, and the chain is the same for most problems.",
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The most common error is using an unbalanced equation. The ratios between substances come from the coefficients, so an equation that is not balanced gives wrong proportions, and every later step inherits the error. Balance first, and check atoms on both sides.',
        'A second mistake is confusing the volume of solvent with the volume of solution. Molarity is defined per litre of the finished solution, not per litre of solvent added. When you prepare a solution, you dissolve the solute and then make up to the final volume, rather than adding a fixed volume of solvent.',
        'Third, unit slips. Grams versus kilograms, millilitres versus litres and moles versus millimoles are the usual culprits. Convert to consistent units at the start, and carry the units through the working, because a result in the wrong unit is often a sign that a step has been missed.',
        'Fourth, significant figures. A calculator will show many digits, but a result should not be quoted with more precision than the least precise measurement allows. Round at the end, not in the middle, and match the number of significant figures to your data.',
        'Finally, ignoring limiting reagents. When reactants are not mixed in exact proportions, the one that runs out first determines how much product forms. Calculating yield from the reagent in excess gives an answer that is too high.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        'Students benefit from checking their working. A calculator that shows the molar mass breakdown or the intermediate moles value helps locate the step where an answer went astray, which is more useful than simply seeing a right or wrong result.',
        'Laboratory technicians and researchers use them to prepare solutions quickly and to reduce the chance of an arithmetic error in a routine task. The benefit grows when the same calculation is repeated many times with different inputs.',
        'Teachers use worked examples to build practice questions and to demonstrate each link in a calculation, from mass to moles to concentration. A calculator also helps with the habit that matters most in this subject: writing down units at every step. Seeing a quantity change from grams to moles to a concentration, with the unit attached each time, makes the logic of a multi-step problem visible and makes it far easier to find an error.',
        "These calculators are for educational use. Follow your institution's laboratory safety protocols, and consult a qualified chemist before any experimental use. Hazardous substances need proper handling, labelling and disposal that no calculator can provide, and a correct number does not make an unsafe procedure safe.",
      ],
    },
  ],
  subclusters: [],
  featured: [],
  guide: [],
};

export default hub;
