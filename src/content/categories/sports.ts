import type { HubContent } from './types';

const hub: HubContent = {
  category: 'sports',
  title: 'Sports and Fitness Calculators: Pace, Speed and Training',
  metaDescription:
    'Free sports calculators for running pace, speed, race times and training loads, with the formulas shown and the common mistakes in pacing and prediction explained.',
  h1: 'Sports Calculators',
  lede: 'Sport generates a steady stream of small calculations: what pace will finish a race in a target time, how fast was that split, how heavy can I lift. They are simple arithmetic, but they connect to how you train, and the right use of them is to set targets and track change. This overview explains the main calculations, how they fit together, and where they mislead.',
  sections: [
    {
      heading: 'What sports calculations are used for',
      paragraphs: [
        'Athletes and coaches use calculators to turn goals into numbers. A runner wants to know what pace holds a finishing time over a fixed distance. A cyclist wants average speed from distance and time. A lifter wants an estimate of a maximum lift from a lighter set. A team wants to track a rate, such as scoring per game, over a season.',
        'Most of these are a form of the same relationship: how a quantity such as distance or work relates to time and effort. Having the arithmetic done reliably lets people concentrate on the training itself, and on the interpretation of the result rather than the calculation.',
        'Spectators and writers use them too, to compare performances across events and to understand what a record time implies in pace or speed. Converting a marathon time into a pace per kilometre or mile makes a remarkable performance more concrete.',
      ],
    },
    {
      heading: 'How the formulas relate to each other',
      paragraphs: [
        'Pace, speed and time are three views of one relationship. Speed is distance divided by time. Pace is the inverse, time divided by distance, and it is the form runners prefer because it describes the time taken per unit of distance. Finishing time is pace multiplied by distance. Knowing any two gives the third, and converting between kilometres and miles is a single multiplication.',
        'Race predictions build on that. A common approach takes a result at one distance and estimates the time at another by scaling for the longer distance, with an allowance for the fact that pace slows as distance increases. These are models fitted to large collections of results, so they describe a typical athlete and not a specific one.',
        'Strength calculations use a different structure. Estimates of a one-repetition maximum are formulas that relate the weight lifted and the number of repetitions completed to the weight you could lift once. Several formulas exist, and they agree reasonably for low repetition counts and diverge as the number of repetitions grows.',
        'Training load ideas connect these. Whether the measure is distance, time or total weight lifted, the principle is the same: a quantity of work, tracked over days and weeks, with changes introduced gradually.',
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The most common mistake is assuming a constant pace. A calculated average pace is a target and not a plan for each kilometre. Starting faster than the average usually costs more time late in the race than it gains early, and an even or slightly negative split is more reliable for most people.',
        'A second mistake is trusting a race prediction from a different kind of effort. A prediction based on a short, fast result may not reflect endurance, and one based on a flat course may be optimistic for a hilly one. Terrain, weather and fatigue all change what a given fitness produces.',
        'Third, using a one-repetition maximum estimate as a measured fact. The estimate is least reliable when the set has many repetitions, because fatigue and technique affect the final reps. It is a starting point for choosing training weights, and attempting a true maximum should be done with proper warm-up and a spotter.',
        'Fourth, unit confusion. Mixing kilometres and miles, or minutes per kilometre and kilometres per hour, is a persistent source of errors, particularly when a pace is typed as minutes and seconds. A pace of five minutes thirty seconds is 5.5 minutes, not 5.30.',
        'Finally, increasing training too quickly because a calculation said it was possible. A target pace or weight that is arithmetically sensible may still be too much for your current fitness. Build gradually, and treat pain or unusual fatigue as information.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        'Runners, cyclists and swimmers benefit from clear pacing targets and from a quick way to compare training sessions and races over different distances. Having a number to aim at makes a plan concrete.',
        'People who lift weights benefit from the ability to choose working weights from a recent set, without having to test a maximum. This makes programmes easier to follow and reduces the risk of attempting loads that are too heavy.',
        'Coaches and club organisers benefit from consistent arithmetic across a group, so that targets and results are comparable, and from tools they can share with athletes. Newcomers to a sport gain too, because a concrete figure such as a target pace for a first ten-kilometre run turns a vague ambition into a plan they can check against their progress each week.',
        'These calculators provide estimates for planning and are not a substitute for coaching or medical advice. If you have a health condition, are returning from injury or are starting a demanding programme after a long break, consult a qualified professional before you begin.',
      ],
    },
  ],
  subclusters: [],
  featured: [],
  guide: [],
};

export default hub;
