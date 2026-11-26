import type { HubContent } from './types';

const hub: HubContent = {
  category: 'health',
  title: 'Health Calculators: BMI, Calories and Body Metrics',
  metaDescription:
    'Free health calculators for BMI, calorie needs, energy expenditure and body composition, with the formulas shown and the limits of each estimate explained plainly.',
  h1: 'Health Calculators',
  lede: 'Health calculators turn a few measurements, such as height, weight, age and activity, into numbers that describe your body or your energy needs. They are estimates built from population averages, which makes them useful for orientation and poor for diagnosis. This page explains what each kind of calculator is for, where the estimates break down, and how to use them sensibly.',
  sections: [
    {
      heading: 'What health calculations are used for',
      paragraphs: [
        'Most health calculators answer one of two questions. The first is about size and composition: is my weight in proportion to my height, and how much of my body is fat. The second is about energy: how many calories does my body use in a day, and how many should I eat to maintain, lose or gain weight. Everything else is a refinement of one of those.',
        'These numbers are used in several places. Individuals use them to set a starting point for a diet or an exercise plan. Coaches and trainers use them to set a first estimate they can adjust from experience. Clinicians use some of them, especially body mass index, as a rapid screening tool across large groups of people, not as a verdict on any one person.',
        'The value of a calculator is that it makes an estimate consistent and repeatable. If you measure the same way each time, you can track change over weeks and months, and the trend tells you more than any single reading.',
      ],
    },
    {
      heading: 'How the formulas relate to each other',
      paragraphs: [
        'Body mass index is the simplest: weight divided by height squared. It ignores age, sex and body composition, which is both its strength and its weakness. It is quick and needs only two measurements, but it cannot tell muscle from fat, so a muscular person can score as overweight while carrying little body fat.',
        'The energy calculators build up in layers. Basal metabolic rate is the energy your body uses at complete rest, and it is estimated from weight, height, age and sex using an equation such as Mifflin-St Jeor. Total daily energy expenditure multiplies that resting figure by an activity factor, because a person who trains every day uses far more than someone at a desk. The calorie calculator then adds or subtracts a daily amount to reach a weight goal.',
        'Body fat estimates sit alongside these. A tape-measure method, such as the US Navy method, estimates body fat from circumference measurements and height. It captures composition in a way that body mass index cannot, though it carries its own error, mainly from how consistently the measurements are taken.',
        'Put together, the usual order is: check proportion with body mass index, estimate resting and total energy use, then set a calorie target. Each step feeds the next, and each step adds a layer of assumption.',
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The biggest mistake is treating an estimate as a measurement. Resting energy equations can be off by a meaningful margin for any individual, because they are fitted to averages of groups. Two people with the same inputs can have noticeably different real needs. Use the result as a starting point, then watch what happens to your weight over two to three weeks and adjust.',
        'A second mistake is overstating the activity level. The activity factor is the largest multiplier in the energy calculation, and people tend to pick the highest category that sounds plausible. If you are unsure, choose the lower one. An inflated activity factor leads to a calorie target that is too high, and the weight does not move as expected.',
        'Third, people read body mass index categories as health outcomes. The categories are population thresholds. They do not account for age, muscle mass, bone structure or where fat is stored. Many athletes, and some older adults, fall outside the usual ranges without any health problem. It is a screening number, and a conversation with a clinician is the right next step if a result worries you.',
        'Fourth, measurement inconsistency. Weight changes during the day with food, water and salt, and a circumference measurement depends on exactly where the tape sits. Measure at the same time of day, in the same way, and compare like with like.',
        'Finally, aggressive targets. A very large calorie deficit may produce quick early change but is hard to sustain, and some people should not diet at all without medical supervision. The calculators here do not know your medical history, so they cannot tell you whether a target is safe for you.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        'People starting a new fitness or nutrition routine benefit most, because they have no baseline. A reasonable first estimate of energy needs is better than a guess, and it gives them something concrete to test and refine.',
        'People tracking change over time benefit from the consistency. Re-running the same calculation with updated weight each month shows whether the plan is working, and shows how needs shift as weight changes. Resting energy use falls as body weight falls, so a target that worked at the start will usually need revisiting.',
        'Students and curious readers benefit from seeing the formulas laid out. Each calculator shows its equation and a worked example, so you can see which input drives the result and why, rather than receiving a number from a black box.',
        'These calculators are for information and education. They are not medical advice, and they cannot diagnose, treat or rule out any condition. If you are pregnant, managing a medical condition, taking medication, recovering from an eating disorder or planning any significant change to your diet or exercise, speak to a qualified healthcare provider first. Use the numbers here to inform that conversation, not to replace it.',
      ],
    },
  ],
  subclusters: [
    {
      label: 'Body measurements',
      blurb: 'Size, proportion and composition.',
      slugs: ['bmi-calculator', 'body-fat-calculator'],
    },
    {
      label: 'Calories and energy',
      blurb: 'Estimate how much energy your body uses and what that means for a goal.',
      slugs: ['calorie-calculator', 'tdee-calculator'],
    },
  ],
  featured: [
    {
      slug: 'bmi-calculator',
      blurb:
        'Calculates body mass index from height and weight and shows the standard category the result falls in. It is the fastest way to check proportion, with the caveat that it cannot distinguish muscle from fat.',
    },
    {
      slug: 'tdee-calculator',
      blurb:
        'Estimates total daily energy expenditure by combining resting energy use with an activity level. It gives you the maintenance calorie figure that every weight goal is measured against.',
    },
    {
      slug: 'calorie-calculator',
      blurb:
        'Turns your age, sex, height, weight, activity level and a weekly weight-change goal into a daily calorie target. It is the one to use once you want a specific direction rather than just a maintenance figure.',
    },
    {
      slug: 'body-fat-calculator',
      blurb:
        'Estimates body fat percentage from tape measurements using the US Navy method. It gives a better picture of composition than body mass index when you do not have access to scanning equipment.',
    },
  ],
  guide: [
    {
      situation: 'You want a quick check on weight in proportion to height',
      slug: 'bmi-calculator',
      advice: 'Treat the category as a screening result, and look at body composition too if you are very muscular.',
    },
    {
      situation: 'You want to know how many calories you burn in a day',
      slug: 'tdee-calculator',
      advice: 'Pick the lower activity level if you are between two, then adjust from real results.',
    },
    {
      situation: 'You have a weight goal and a weekly pace in mind',
      slug: 'calorie-calculator',
      advice: 'Keep the pace moderate, since the target is only as good as the estimate under it.',
    },
    {
      situation: 'You want to track composition rather than just weight',
      slug: 'body-fat-calculator',
      advice: 'Measure at the same place and time each session so the trend is meaningful.',
    },
  ],
};

export default hub;
