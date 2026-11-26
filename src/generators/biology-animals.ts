import { selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { field, intField, rows } from '../lib/spec-helpers';
import type { CalculatorConfig, Scenario } from '../lib/types';

/**
 * Catalog batch 5 (biology): pets, other animals, livestock and one wastewater page. Rules of thumb are labelled as
 * such in the page copy. Energy factors are the widely used veterinary resting-energy multipliers. No drug doses, no
 * toxicity thresholds and no money outputs. Tier 2 or 3, so none is live until the cohort gate opens.
 */

const PI = new D('3.14159265358979323846264338327950288');
const LB_PER_KG = new D('2.20462262185');
const KG_PER_LB = new D('0.45359237');
const LITRES_PER_GALLON = new D('3.785411784');
const CUBIC_FEET_PER_BUSHEL = new D('1.2445');

const select = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});

const withInputs = (label: string, inputs: Scenario['inputs']): Scenario => ({ label, inputs });

/** Resting energy requirement in kcal per day: 70 × kg^0.75. */
const rer = (kg: Dec) => new D(70).mul(kg.pow('0.75'));

export const SPECS: Spec[] = [
  {
    slug: 'dog-food-calculator',
    category: 'biology',
    tier: 2,
    subCluster: 'Dog',
    title: 'Dog Food Calculator: Daily Calories and Grams to Feed',
    h1: 'Dog Food Calculator',
    metaDescription: "Estimate your dog's daily calorie need from weight and life stage, then convert it to grams of food using the calories in your brand.",
    about:
      "Veterinary nutritionists estimate a dog's energy needs in two steps. First the resting energy requirement, the calories needed just to stay alive at rest, is 70 times the body weight in kilograms raised to the power 0.75. Then it is multiplied by a factor for the dog's situation: about 1.6 for a neutered adult, 1.8 for an intact one, 1.2 to 1.4 for an inactive dog, 1.0 for a dog losing weight and 2 to 3 for a growing puppy. Enter the weight, the stage and the calories per 100 grams printed on the food bag, which is on the pack, and you will get the grams to feed in a day. Split it into two meals, count treats as part of the total and adjust every few weeks according to body condition, not the scale alone. This is a starting point for a healthy dog; sick dogs need a vet's plan. Large-breed puppies are the exception to feeding by appetite: too many calories speed their growth and raise the risk of joint disease, so keep them lean and weigh a growing pup every week.",
    inputs: [
      field('kg', 'Dog weight (kg)', 10, 1, 100),
      select('stage', 'Life stage', 'neutered', [
        ['neutered', 'Neutered adult (×1.6)'],
        ['intact', 'Intact adult (×1.8)'],
        ['inactive', 'Inactive or obese-prone (×1.2)'],
        ['loss', 'Weight loss (×1.0)'],
        ['puppy-young', 'Puppy under 4 months (×3.0)'],
        ['puppy-older', 'Puppy over 4 months (×2.0)'],
      ]),
      field('density', 'Food energy (kcal per 100 g)', 350, 50, 600),
    ],
    outputs: [
      { name: 'rer', label: 'Resting energy requirement', format: 'text' },
      { name: 'der', label: 'Daily energy requirement', format: 'text', highlight: true },
      { name: 'grams', label: 'Food to feed per day', format: 'text' },
    ],
    calculate: (i) => {
      const factor = new D(
        { neutered: '1.6', intact: '1.8', inactive: '1.2', loss: '1.0', 'puppy-young': '3.0', 'puppy-older': '2.0' }[String(i.stage)] ?? '1.6',
      );
      const r = rer(toD(i.kg));
      const der = r.mul(factor);
      return { rer: `${fmtNumber(r, 0)} kcal`, der: `${fmtNumber(der, 0)} kcal/day`, grams: `${fmtNumber(der.div(toD(i.density)).mul(100), 0)} g` };
    },
    formulaDescription: 'RER = 70 × weight(kg)^0.75. Daily energy = RER × life-stage factor. Food per day (g) = daily energy ÷ kcal per 100 g × 100.',
    workedExample: 'A neutered 10 kg dog: RER = 70 × 10^0.75 = 394 kcal. × 1.6 = 630 kcal a day. Food at 350 kcal per 100 g means 630 ÷ 350 × 100 = 180 g.',
    faq: [
      {
        question: 'Is the factor exact?',
        answer:
          "No. Individual dogs differ by 25 percent or more. Weigh and score your dog's body condition every two to four weeks and adjust by about 10 percent.",
      },
      { question: 'Do treats count?', answer: "Yes. Keep treats under about 10 percent of the day's calories and reduce the meals to match." },
      {
        question: 'Can I use this for a sick dog?',
        answer: "No. Illness, pregnancy and some medicines change energy needs, so follow your vet's feeding plan.",
      },
    ],
    scenarios: [
      withInputs('A neutered 10 kg dog on dry food', { kg: 10, stage: 'neutered', density: 350 }),
      withInputs('An overweight 30 kg dog on a diet', { kg: 30, stage: 'loss', density: 340 }),
      withInputs('A 4 kg toy dog, intact', { kg: 4, stage: 'intact', density: 380 }),
      withInputs('A 20 kg neutered dog on a rich food', { kg: 20, stage: 'neutered', density: 400 }),
      withInputs('A 6 kg puppy of five months', { kg: 6, stage: 'puppy-older', density: 410 }),
    ],
    introOutputs: ['der', 'grams'],
    relatedSlugs: ['cat-calorie-calculator', 'dog-water-intake-calculator'],
    checks: [
      { inputs: {}, expect: { rer: '394 kcal', der: '630 kcal/day', grams: '180 g' } },
      { inputs: { stage: 'loss' }, expect: { der: '394 kcal/day', grams: '112 g' } },
      { inputs: { kg: 20, density: 400 }, expect: { der: '1,059 kcal/day', grams: '265 g' } },
    ],
  },
  {
    slug: 'cat-calorie-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Cat',
    title: 'Cat Calorie Calculator: How Much to Feed a Cat per Day',
    h1: 'Cat Calorie Calculator',
    metaDescription: 'Work out how many calories a cat needs from her weight and status, and how many grams of dry or wet food that is.',
    about:
      'Cats are strict carnivores with modest energy needs, and overfeeding is the most common nutrition problem seen in indoor cats. To estimate the calories, start with the resting energy requirement, 70 times the weight in kilograms to the power of 0.75, then apply a status factor. Neutered adults need about 1.2 times resting energy, intact adults 1.4, kittens up to 2.5 and a cat losing weight 0.8. A 4 kg neutered cat therefore needs near 240 kcal a day, which is only about 60 grams of dry food. That is less than the scoop many owners use, and an extra 20 kcal a day, one small treat, adds nearly a kilogram over a year. Cats should lose weight slowly, no more than one to two percent of body weight a week, because rapid loss risks liver disease. Ask your vet to set the target. Because cats are natural grazers, many owners use puzzle feeders or several small meals, which slows eating and keeps an indoor cat busy, and fresh water should sit apart from the food bowl.',
    inputs: [
      field('kg', 'Cat weight (kg)', 4, 0.5, 12),
      select('status', 'Status', 'neutered', [
        ['neutered', 'Neutered adult (×1.2)'],
        ['intact', 'Intact adult (×1.4)'],
        ['inactive', 'Inactive or senior (×1.0)'],
        ['loss', 'Weight loss (×0.8)'],
        ['kitten', 'Kitten (×2.5)'],
      ]),
      field('density', 'Food energy (kcal per 100 g)', 400, 50, 600),
    ],
    outputs: [
      { name: 'rer', label: 'Resting energy', format: 'text' },
      { name: 'der', label: 'Calories per day', format: 'text', highlight: true },
      { name: 'grams', label: 'Grams of this food per day', format: 'text' },
    ],
    calculate: (i) => {
      const factor = new D({ neutered: '1.2', intact: '1.4', inactive: '1.0', loss: '0.8', kitten: '2.5' }[String(i.status)] ?? '1.2');
      const r = rer(toD(i.kg));
      const der = r.mul(factor);
      return { rer: `${fmtNumber(r, 0)} kcal`, der: `${fmtNumber(der, 0)} kcal/day`, grams: `${fmtNumber(der.div(toD(i.density)).mul(100), 1)} g` };
    },
    formulaDescription:
      'Resting energy = 70 × weight(kg)^0.75. Calories per day = resting energy × status factor. Grams per day = calories ÷ kcal per 100 g × 100.',
    workedExample: 'A neutered 4 kg cat: 70 × 4^0.75 = 198 kcal at rest. × 1.2 = 238 kcal a day, and at 400 kcal per 100 g of dry food that is 59.4 g.',
    faq: [
      {
        question: 'How do I know the calories in my cat food?',
        answer: 'The bag or tin gives kcal per 100 g or per kilogram; in some regions it is shown as ME. Enter it as kcal per 100 g.',
      },
      {
        question: 'Is wet food different?',
        answer: 'Wet food has far fewer calories per gram because of its water, often 70 to 100 kcal per 100 g. Enter the figure on the can.',
      },
      {
        question: 'How fast should an overweight cat lose weight?',
        answer: 'About 1 to 2 percent of body weight a week. Faster loss can cause a serious liver condition in cats.',
      },
    ],
    scenarios: [
      withInputs('A neutered adult cat of 4 kg on dry food', { kg: 4, status: 'neutered', density: 400 }),
      withInputs('A heavy 6 kg cat on a diet', { kg: 6, status: 'loss', density: 360 }),
      withInputs('A 1.5 kg kitten', { kg: 1.5, status: 'kitten', density: 420 }),
      withInputs('A 3.5 kg intact female', { kg: 3.5, status: 'intact', density: 400 }),
      withInputs('A 4.5 kg senior fed on wet food', { kg: 4.5, status: 'inactive', density: 90 }),
    ],
    introOutputs: ['der', 'grams'],
    relatedSlugs: ['dog-food-calculator', 'cat-age-calculator'],
    checks: [
      { inputs: {}, expect: { rer: '198 kcal', der: '238 kcal/day', grams: '59.4 g' } },
      { inputs: { status: 'kitten' }, expect: { der: '495 kcal/day' } },
      { inputs: { status: 'loss' }, expect: { der: '158 kcal/day' } },
    ],
  },
  {
    slug: 'dog-water-intake-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Dog',
    title: 'Dog Water Intake Calculator: Daily Water by Weight',
    h1: 'Dog Water Intake Calculator',
    metaDescription: 'Estimate how much water a dog usually drinks in a day from its weight, using about 60 mL per kilogram as the starting rule.',
    about:
      'A healthy dog drinks roughly 50 to 70 millilitres of water per kilogram of body weight a day, the same as about one fluid ounce per pound, and the figure includes the water in its food. Dogs that eat dry kibble drink more than dogs on wet or raw diets, and hot weather, exercise, nursing and a salty snack all push the amount up. This calculator multiplies the weight by the allowance per kilogram that you choose, with 60 as the default, and shows the result in millilitres, litres and cups. It is a guide for noticing change: a dog that suddenly drinks much more than usual, well over 100 millilitres per kilogram, or stops drinking should be seen by a vet, since diabetes, kidney disease and infections often show up first as thirst. Always keep fresh water available.',
    inputs: [field('kg', 'Dog weight (kg)', 10, 1, 100), field('rate', 'Allowance (mL per kg per day)', 60, 30, 120)],
    outputs: [
      { name: 'ml', label: 'Water per day', format: 'text', highlight: true },
      { name: 'litres', label: 'In litres', format: 'text' },
      { name: 'cups', label: 'In cups of 240 mL', format: 'text' },
    ],
    calculate: (i) => {
      const ml = toD(i.kg).mul(toD(i.rate));
      return { ml: `${fmtNumber(ml, 0)} mL`, litres: `${fmtNumber(ml.div(1000), 2)} L`, cups: `${fmtNumber(ml.div(240), 1)} cups` };
    },
    formulaDescription: 'Water per day (mL) = weight (kg) × allowance (mL per kg). Litres = mL ÷ 1,000. Cups = mL ÷ 240.',
    workedExample:
      'A 10 kg dog at 60 mL per kg: 10 × 60 = 600 mL, which is 0.6 litres or 2.5 cups. A dog drinking more than double that, 1,200 mL, deserves a vet check.',
    faq: [
      {
        question: 'When is a dog drinking too much?',
        answer: "Persistent drinking above about 100 mL per kg a day, or a sudden change, can point to diabetes, kidney or liver disease or Cushing's disease.",
      },
      {
        question: 'Does food count towards the total?',
        answer: 'Yes. Wet food is about 75 percent water, so dogs on tinned or raw diets drink less from the bowl than dogs on kibble.',
      },
      { question: 'Should I limit water?', answer: 'Not unless a vet says so. Offer water freely, with more on hot days and after exercise.' },
    ],
    scenarios: rows(
      ['kg', 'rate'],
      [
        [10, 60],
        [25, 50],
        [4, 80],
        [40, 60],
        [6, 70],
        [55, 55],
      ],
      (v) => `A dog of ${v[0]} kg allowed ${v[1]} mL per kg`,
    ),
    introOutputs: ['ml', 'cups'],
    relatedSlugs: ['dog-food-calculator', 'dog-age-calculator'],
    checks: [
      { inputs: {}, expect: { ml: '600 mL', litres: '0.6 L', cups: '2.5 cups' } },
      { inputs: { kg: 25, rate: 50 }, expect: { ml: '1,250 mL', litres: '1.25 L', cups: '5.2 cups' } },
      { inputs: { kg: 4, rate: 80 }, expect: { ml: '320 mL', cups: '1.3 cups' } },
    ],
  },
  {
    slug: 'dog-crate-size-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Dog',
    title: 'Dog Crate Size Calculator: Length and Height for Your Dog',
    h1: 'Dog Crate Size Calculator',
    metaDescription: 'Find the crate your dog needs from its body length and standing height, and the nearest standard crate size in inches.',
    about:
      'A crate should be large enough for a dog to stand, turn round and lie down, and no larger, because a dog that has room to use one end as a toilet will not keep the den clean. The usual guidance is to measure the dog from the tip of the nose to the root of the tail, add 2 to 4 inches for the length, and measure the standing height to the top of the head or the ears, if they stand, and add the same margin for the height. Standard wire crates come in lengths of 18, 24, 30, 36, 42 and 48 inches, and the calculator picks the smallest one that fits. Puppies grow, so buy for the adult size and use the divider panel that most wire crates include to shorten the space until the dog is grown.',
    inputs: [
      field('length', 'Dog length, nose to base of tail (in)', 24, 8, 60),
      field('height', 'Standing height (in)', 22, 6, 45),
      field('margin', 'Extra room (in)', 3, 2, 4),
    ],
    outputs: [
      { name: 'need', label: 'Minimum inside length by height', format: 'text' },
      { name: 'crate', label: 'Standard crate to buy', format: 'text', highlight: true },
    ],
    calculate: (i) => {
      const len = toD(i.length).add(toD(i.margin));
      const tall = toD(i.height).add(toD(i.margin));
      const size = [18, 24, 30, 36, 42, 48].find((s) => new D(s).gte(len));
      return { need: `${fmtNumber(len, 1)} in by ${fmtNumber(tall, 1)} in`, crate: size ? `${size}-inch crate` : 'Larger than a standard 48-inch crate' };
    },
    formulaDescription:
      'Required length = dog length + margin. Required height = standing height + margin. The crate is the smallest standard length (18, 24, 30, 36, 42 or 48 in) at least as long as the required length.',
    workedExample:
      'A dog 24 in long and 22 in tall with 3 in to spare needs a crate at least 27 in long and 25 in tall inside, so the 30-inch crate is the smallest standard choice.',
    faq: [
      {
        question: 'Should a crate be bigger so the dog has more space?',
        answer: 'No. Too much room defeats the purpose of crate training, because the dog can sleep at one end and use the other as a toilet.',
      },
      {
        question: 'What about a growing puppy?',
        answer: 'Buy the crate for the adult size and block off the extra space with a divider panel while the puppy grows.',
      },
      {
        question: 'Does the crate height matter?',
        answer: 'Yes. A dog must be able to sit and stand without touching the roof, so allow the extra margin above the head or ears.',
      },
    ],
    scenarios: rows(
      ['length', 'height', 'margin'],
      [
        [24, 22, 3],
        [14, 12, 2],
        [30, 27, 3],
        [20, 18, 4],
        [38, 33, 3],
        [27, 24, 2],
      ],
      (v) => `A dog ${v[0]} in long and ${v[1]} in tall with ${v[2]} in margin`,
    ),
    introOutputs: ['need', 'crate'],
    relatedSlugs: ['dog-size-calculator', 'dog-food-calculator'],
    checks: [
      { inputs: {}, expect: { need: '27 in by 25 in', crate: '30-inch crate' } },
      { inputs: { length: 30 }, expect: { crate: '36-inch crate' } },
      { inputs: { length: 47 }, expect: { crate: 'Larger than a standard 48-inch crate' } },
    ],
  },
  {
    slug: 'dog-size-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Dog',
    title: 'Dog Size Calculator: Predict Adult Weight of a Puppy',
    h1: 'Dog Size Calculator',
    metaDescription: 'Estimate how heavy a puppy will be when fully grown from its weight now and its age in weeks, with a size class.',
    about:
      "Owners of mixed-breed puppies often want to know how big the dog will become before it outgrows the flat. A rule used by many vets is to scale the current weight by the ratio of a year to the puppy's age: the weight divided by the age in weeks, times 52. A puppy of 8 kilograms at 16 weeks should grow to about 26 kilograms. The rule works best for puppies of 14 to 20 weeks and for medium-sized breeds, because toy breeds finish growing sooner and giants keep growing until two years, so it tends to overestimate small dogs and underestimate giants. Use the answer with the size class and the breed history, since the weight of the parents is a better predictor than any formula. Check the puppy against its breed growth chart too.",
    inputs: [field('kg', 'Puppy weight now (kg)', 8, 0.2, 60), field('weeks', 'Puppy age (weeks)', 16, 8, 52)],
    outputs: [
      { name: 'adult', label: 'Estimated adult weight', format: 'text', highlight: true },
      { name: 'lb', label: 'In pounds', format: 'text' },
      { name: 'size', label: 'Size class', format: 'text' },
    ],
    calculate: (i) => {
      const adult = toD(i.kg).div(toD(i.weeks)).mul(52);
      const size = adult.lt(5) ? 'Toy' : adult.lt(10) ? 'Small' : adult.lt(25) ? 'Medium' : adult.lt(45) ? 'Large' : 'Giant';
      return { adult: `${fmtNumber(adult, 1)} kg`, lb: `${fmtNumber(adult.mul(LB_PER_KG), 1)} lb`, size };
    },
    formulaDescription:
      'Adult weight ≈ current weight ÷ age in weeks × 52. Size classes by adult weight: toy under 5 kg, small 5 to 10, medium 10 to 25, large 25 to 45, giant 45 and over.',
    workedExample: 'A puppy of 8 kg at 16 weeks: 8 ÷ 16 × 52 = 26 kg, about 57.3 lb, a large dog. A 2 kg puppy of 12 weeks gives 8.7 kg, a small dog.',
    faq: [
      {
        question: 'How accurate is the estimate?',
        answer: 'Within about 15 to 20 percent for most dogs. Growth rates differ by breed, so use it as a range and not a promise.',
      },
      {
        question: 'Why is it less reliable for giant breeds?',
        answer: 'Giants keep gaining weight until about 18 to 24 months, so the rule, which assumes growth ends at a year, underestimates them.',
      },
      {
        question: 'Is there a better predictor?',
        answer: 'The adult weights of the parents and a breed growth chart. Your vet can also estimate it from paw size and the growth plates on an X-ray.',
      },
    ],
    scenarios: rows(
      ['kg', 'weeks'],
      [
        [8, 16],
        [2, 12],
        [30, 26],
        [5, 14],
        [12, 20],
        [3, 10],
      ],
      (v) => `A puppy of ${v[0]} kg at ${v[1]} weeks`,
    ),
    introOutputs: ['adult', 'size'],
    relatedSlugs: ['dog-crate-size-calculator', 'dog-age-calculator'],
    checks: [
      { inputs: {}, expect: { adult: '26 kg', lb: '57.3 lb', size: 'Large' } },
      { inputs: { kg: 2, weeks: 12 }, expect: { adult: '8.7 kg', lb: '19.1 lb', size: 'Small' } },
      { inputs: { kg: 30, weeks: 26 }, expect: { adult: '60 kg', size: 'Giant' } },
    ],
  },
  {
    slug: 'crickets-chirping-thermometer-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Other animals',
    title: 'Cricket Thermometer: Temperature from Chirps (Dolbear)',
    h1: 'Crickets Chirping Thermometer',
    metaDescription: "Count a cricket's chirps for a few seconds to estimate the air temperature in Fahrenheit and Celsius with Dolbear's law.",
    about:
      'Snowy tree crickets chirp faster on warm evenings and slower on cool ones, because the muscles that drive the song are chemical engines that speed up with heat. In 1897 the physicist Amos Dolbear published a formula that turns the chirp rate into a temperature. Count the chirps over a stretch of seconds, enter both numbers, and the calculator scales the count to a minute and applies the law. In the standard form the temperature in degrees Fahrenheit is 50 plus the chirps per minute minus 40, divided by 4. The rule is accurate to about a degree or two for the snowy tree cricket, Oecanthus fultoni, in the range of 55 to 100 degrees Fahrenheit, and a rough guide for other species, whose songs differ. Count at the same cricket for the best result and listen at night.',
    inputs: [intField('chirps', 'Chirps counted', 35, 1, 1000), field('seconds', 'Counting time (seconds)', 15, 5, 120)],
    outputs: [
      { name: 'f', label: 'Temperature', format: 'text', highlight: true },
      { name: 'c', label: 'In Celsius', format: 'text' },
      { name: 'cpm', label: 'Chirps per minute', format: 'text' },
    ],
    calculate: (i) => {
      const cpm = toD(i.chirps).mul(60).div(toD(i.seconds));
      const f = cpm.sub(40).div(4).add(50);
      return { f: `${fmtNumber(f, 1)} °F`, c: `${fmtNumber(f.sub(32).mul(5).div(9), 1)} °C`, cpm: fmtNumber(cpm, 1) };
    },
    formulaDescription: "Chirps per minute N = chirps × 60 ÷ seconds. Dolbear's law: T(°F) = 50 + (N − 40) ÷ 4. Celsius = (°F − 32) × 5 ÷ 9.",
    workedExample: '35 chirps in 15 seconds is 140 per minute, so T = 50 + (140 − 40) ÷ 4 = 75 °F, which is 23.9 °C.',
    faq: [
      {
        question: 'Will it work with any cricket?',
        answer:
          'The formula was fitted to snowy tree crickets. Field crickets follow the same pattern with different constants, so other species give only a rough estimate.',
      },
      {
        question: 'What is the 14-second shortcut?',
        answer: 'Counting chirps for 14 seconds and adding 40 gives about the temperature in Fahrenheit. It is a simplification of the same law.',
      },
      { question: 'Does it work below freezing?', answer: 'No. Crickets stop singing below about 50 degrees Fahrenheit, and the law is not valid there.' },
    ],
    scenarios: rows(
      ['chirps', 'seconds'],
      [
        [35, 15],
        [20, 15],
        [56, 20],
        [30, 10],
        [44, 30],
        [27, 14],
      ],
      (v) => `${v[0]} chirps heard over ${v[1]} seconds`,
    ),
    introOutputs: ['f', 'c'],
    relatedSlugs: ['dry-matter-calculator', 'turtle-tank-size-calculator'],
    checks: [
      { inputs: {}, expect: { f: '75 °F', c: '23.9 °C', cpm: '140' } },
      { inputs: { chirps: 20 }, expect: { f: '60 °F', c: '15.6 °C' } },
      { inputs: { chirps: 56, seconds: 20 }, expect: { f: '82 °F', c: '27.8 °C' } },
    ],
  },
  {
    slug: 'dry-matter-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Other animals',
    title: 'Dry Matter Calculator: As-Fed to Dry Matter Basis',
    h1: 'Dry Matter Calculator',
    metaDescription: 'Convert moisture and a nutrient percentage as fed into dry matter and the nutrient content on a dry matter basis.',
    about:
      'Feeds differ enormously in water. Fresh grass is 75 to 80 percent water, silage about 65, hay around 12 and a dry pellet about 10, so comparing their protein or fibre as fed would mislead. Nutritionists convert everything to a dry matter basis, which removes the water and shows what the animal is actually getting. Enter the moisture of the feed, a nutrient percentage as fed and the weight of feed, and the calculator gives the dry matter percentage, the mass of dry matter and the nutrient on a dry matter basis. The same conversion is how pet food labels are compared: a canned food with 8 percent protein as fed and 75 percent moisture holds 32 percent on a dry matter basis. Dry matter intake is also what a cow or sheep ration is balanced against.',
    inputs: [
      field('moisture', 'Moisture (%)', 75, 0, 99),
      field('nutrient', 'Nutrient as fed (%)', 8, 0, 100),
      field('amount', 'Feed as fed (kg)', 100, 0.01, 1000000),
    ],
    outputs: [
      { name: 'dmPct', label: 'Dry matter', format: 'text' },
      { name: 'dm', label: 'Dry matter in the amount fed', format: 'text', highlight: true },
      { name: 'basis', label: 'Nutrient on a dry matter basis', format: 'text' },
    ],
    calculate: (i) => {
      const dm = new D(100).sub(toD(i.moisture));
      return {
        dmPct: `${fmtNumber(dm, 2)}%`,
        dm: `${fmtNumber(dm.div(100).mul(toD(i.amount)), 2)} kg`,
        basis: `${fmtNumber(toD(i.nutrient).div(dm).mul(100), 2)}%`,
      };
    },
    formulaDescription:
      'Dry matter % = 100 − moisture %. Dry matter mass = as-fed mass × dry matter % ÷ 100. Nutrient on a dry matter basis = nutrient as fed ÷ dry matter % × 100.',
    workedExample:
      'A feed with 75% moisture has 25% dry matter, so 100 kg as fed holds 25 kg of dry matter. If it has 8% protein as fed, the protein is 8 ÷ 25 × 100 = 32% on a dry matter basis.',
    faq: [
      {
        question: 'Why compare feeds on a dry matter basis?',
        answer: 'Because water dilutes every other nutrient. Only after removing it can you compare silage with hay or wet pet food with dry.',
      },
      {
        question: 'How do I measure moisture?',
        answer:
          'Weigh a sample, dry it in an oven at about 105 degrees Celsius to constant weight and weigh again. Labs use the same method, and a microwave is a rough shortcut on the farm.',
      },
      {
        question: 'Is dry matter the same as the dry weight?',
        answer: 'Yes. It is what remains after the water is gone, which includes the nutrients, fibre and ash.',
      },
    ],
    scenarios: rows(
      ['moisture', 'nutrient', 'amount'],
      [
        [75, 8, 100],
        [10, 18, 50],
        [60, 12, 10],
        [85, 3, 200],
        [12, 9, 500],
        [68, 4.5, 80],
      ],
      (v) => `A feed at ${v[0]} percent moisture with ${v[1]} percent nutrient, ${v[2]} kg`,
    ),
    introOutputs: ['dm', 'basis'],
    relatedSlugs: ['feed-conversion-ratio-calculator', 'cattle-per-acre-calculator'],
    checks: [
      { inputs: {}, expect: { dmPct: '25%', dm: '25 kg', basis: '32%' } },
      { inputs: { moisture: 10, nutrient: 18, amount: 50 }, expect: { dmPct: '90%', dm: '45 kg', basis: '20%' } },
      { inputs: { moisture: 60, nutrient: 12, amount: 10 }, expect: { dm: '4 kg', basis: '30%' } },
    ],
  },
  {
    slug: 'horse-weight-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Other animals',
    title: 'Horse Weight Calculator: Estimate Weight from Girth and Length',
    h1: 'Horse Weight Calculator',
    metaDescription: "Estimate a horse's weight without a scale from its heart girth and body length in inches, in pounds and kilograms.",
    about:
      'A weighbridge is rarely at hand, but a tape measure is. The standard formula used by vets and extension services estimates the weight in pounds as the heart girth squared times the body length, divided by 330, with both measures in inches. The heart girth is the circumference behind the elbows, around the deepest part of the chest, measured with the horse standing square and breathing out. The body length runs from the point of the shoulder to the point of the buttock. The result is accurate to within about 5 to 10 percent for adult horses, which is enough to dose a wormer on the label or to track weight changes over a season, but it is not as exact as a scale, and it is less reliable for ponies, foals, pregnant mares and horses with very large or very small bellies. Always measure at the same time of day.',
    inputs: [field('girth', 'Heart girth (in)', 72, 20, 100), field('length', 'Body length (in)', 66, 20, 100)],
    outputs: [
      { name: 'lb', label: 'Estimated weight', format: 'text', highlight: true },
      { name: 'kg', label: 'In kilograms', format: 'text' },
    ],
    calculate: (i) => {
      const lb = toD(i.girth).pow(2).mul(toD(i.length)).div(330);
      return { lb: `${fmtNumber(lb, 1)} lb`, kg: `${fmtNumber(lb.mul(KG_PER_LB), 1)} kg` };
    },
    formulaDescription: 'Weight (lb) = heart girth² × body length ÷ 330, with girth and length in inches. Weight (kg) = pounds × 0.45359237.',
    workedExample: 'A horse with a 72 in girth and a 66 in length: 72² × 66 ÷ 330 = 5,184 × 66 ÷ 330 = 1,036.8 lb, about 470.3 kg.',
    faq: [
      {
        question: 'How accurate is a weight tape?',
        answer: 'Similar to this formula, within about 5 to 10 percent. For drug doses, ask your vet, who will prefer a scale or an allowance for the error.',
      },
      {
        question: 'How do I measure the length correctly?',
        answer: 'From the point of the shoulder to the point of the buttock in a straight line, with the horse standing square on level ground.',
      },
      {
        question: 'Does it work for ponies and foals?',
        answer: 'Less well. Growing animals and miniatures have different proportions, and this formula is fitted to adult horses.',
      },
    ],
    scenarios: rows(
      ['girth', 'length'],
      [
        [72, 66],
        [60, 55],
        [80, 70],
        [66, 60],
        [76, 68],
        [54, 48],
      ],
      (v) => `A horse with a ${v[0]} in girth and ${v[1]} in length`,
    ),
    introOutputs: ['lb', 'kg'],
    relatedSlugs: ['dog-size-calculator', 'feed-conversion-ratio-calculator'],
    checks: [
      { inputs: {}, expect: { lb: '1,036.8 lb', kg: '470.3 kg' } },
      { inputs: { girth: 60, length: 55 }, expect: { lb: '600 lb', kg: '272.2 kg' } },
      { inputs: { girth: 80, length: 70 }, expect: { lb: '1,357.6 lb', kg: '615.8 kg' } },
    ],
  },
  {
    slug: 'rat-cage-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Other animals',
    title: 'Rat Cage Calculator: Cage Volume and How Many Rats Fit',
    h1: 'Rat Cage Calculator',
    metaDescription: 'Work out the volume of a cage in cubic feet and how many pet rats it can house at 2 cubic feet each.',
    about:
      'Pet rats are active, social animals that climb and explore, so cage volume matters more than floor space alone. A common welfare guideline from rat rescues asks for at least 2 cubic feet of cage per rat, and more is better, with the cage tall enough for levels, hammocks and rope. Because rats are sociable and do badly alone, they are kept in pairs or small groups, so the minimum for two is 4 cubic feet. Enter the interior length, width and height of the cage in inches along with the number of rats you keep, and the calculator gives the volume, the largest number of rats it suits and the space each would have. Bar spacing matters too: for adult rats no more than 1 inch, and for babies half an inch. Choose a solid floor so the feet are not injured.',
    inputs: [
      field('l', 'Length (in)', 30, 6, 120),
      field('w', 'Width (in)', 18, 6, 120),
      field('h', 'Height (in)', 24, 6, 120),
      intField('rats', 'Rats you keep', 3, 1, 30),
    ],
    outputs: [
      { name: 'vol', label: 'Cage volume', format: 'text' },
      { name: 'cap', label: 'Most rats it suits at 2 cu ft each', format: 'text', highlight: true },
      { name: 'each', label: 'Space per rat for your group', format: 'text' },
    ],
    calculate: (i) => {
      const vol = toD(i.l).mul(toD(i.w)).mul(toD(i.h)).div(1728);
      const cap = vol.div(2).floor();
      return {
        vol: `${fmtNumber(vol, 2)} cu ft`,
        cap: `${fmtNumber(cap, 0)} ${cap.eq(1) ? 'rat' : 'rats'}`,
        each: `${fmtNumber(vol.div(toD(i.rats)), 2)} cu ft per rat`,
      };
    },
    formulaDescription:
      'Volume (cu ft) = length × width × height (in inches) ÷ 1,728. Most rats = volume ÷ 2, rounded down. Space per rat = volume ÷ number of rats.',
    workedExample:
      'A cage 30 in long, 18 in wide and 24 in tall is 12,960 cubic inches, or 7.5 cu ft. At 2 cu ft each it suits 3 rats, and three rats get 2.5 cu ft each.',
    faq: [
      {
        question: 'Why are rats kept in groups?',
        answer: 'They are highly social. A single rat tends to become bored and stressed, so welfare groups recommend at least two of the same sex.',
      },
      {
        question: 'Is taller or wider better?',
        answer: 'Rats use height, so a tall cage with several levels is good, provided the floors are solid and the drops short enough to prevent falls.',
      },
      {
        question: 'What about bar spacing?',
        answer: 'Use bars no more than 1 inch apart for adults and half an inch for young rats, so that they cannot squeeze out or get caught.',
      },
    ],
    scenarios: rows(
      ['l', 'w', 'h', 'rats'],
      [
        [30, 18, 24, 3],
        [24, 12, 12, 2],
        [36, 24, 24, 4],
        [28, 18, 36, 3],
        [40, 20, 30, 6],
        [24, 18, 18, 2],
      ],
      (v) => `A cage of ${v[0]} by ${v[1]} by ${v[2]} inches for ${v[3]} rats`,
    ),
    introOutputs: ['vol', 'cap'],
    relatedSlugs: ['turtle-tank-size-calculator', 'dog-crate-size-calculator'],
    checks: [
      { inputs: {}, expect: { vol: '7.5 cu ft', cap: '3 rats', each: '2.5 cu ft per rat' } },
      { inputs: { l: 24, w: 12, h: 12, rats: 2 }, expect: { vol: '2 cu ft', cap: '1 rat', each: '1 cu ft per rat' } },
      { inputs: { l: 36, w: 24, h: 24, rats: 4 }, expect: { vol: '12 cu ft', cap: '6 rats', each: '3 cu ft per rat' } },
    ],
  },
  {
    slug: 'turtle-tank-size-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Other animals',
    title: 'Turtle Tank Size Calculator: Gallons per Inch of Shell',
    h1: 'Turtle Tank Size Calculator',
    metaDescription: 'Find the tank volume for aquatic pet turtles from their adult shell length, using the common 10 gallons per inch rule.',
    about:
      'A hatchling turtle looks tiny in a small tank, but many pet turtles, such as red-eared sliders, grow to eight or ten inches of shell and live for decades. The rule of thumb used by reptile keepers is to allow 10 gallons of water for every inch of the adult shell length, measured straight along the top of the shell from head to tail end. A six-inch turtle therefore needs a 60 gallon tank, and each extra turtle adds its own share. Buy for the adult size rather than the baby, since upgrading later is costly. Bigger is better because turtles are messy: large water volume dilutes waste, but you still need a strong filter rated for several times the tank volume, a basking platform and a heat lamp. Mud, musk and box turtles that are not strictly aquatic need different setups.',
    inputs: [field('shell', 'Adult shell length (in)', 6, 1, 20), intField('count', 'Number of turtles', 1, 1, 20)],
    outputs: [
      { name: 'gal', label: 'Tank size needed', format: 'text', highlight: true },
      { name: 'litres', label: 'In litres', format: 'text' },
    ],
    calculate: (i) => {
      const gal = toD(i.shell).mul(10).mul(toD(i.count));
      return { gal: `${fmtNumber(gal, 0)} gallons`, litres: `${fmtNumber(gal.mul(LITRES_PER_GALLON), 1)} L` };
    },
    formulaDescription: 'Tank volume (US gallons) = 10 × adult shell length (in) × number of turtles. Litres = gallons × 3.785411784.',
    workedExample:
      'One turtle that will reach 6 in of shell needs 10 × 6 = 60 gallons, which is 227.1 litres. Two such turtles need 120 gallons, or 454.2 litres.',
    faq: [
      {
        question: 'Is the 10 gallons per inch rule a minimum?',
        answer: 'Yes. It is a minimum for aquatic species. More water space is better and makes keeping the water clean easier.',
      },
      {
        question: 'How big do pet turtles get?',
        answer:
          'Red-eared sliders reach about 8 to 12 inches, with females larger; musk turtles stay around 4 to 5 inches. Check the adult size of your species.',
      },
      {
        question: 'What else does the tank need?',
        answer:
          'A basking platform with a heat and UVB lamp, a powerful filter, and water deep enough for the turtle to swim and turn over, around one and a half times its shell length.',
      },
    ],
    scenarios: rows(
      ['shell', 'count'],
      [
        [6, 1],
        [8, 1],
        [4, 2],
        [10, 1],
        [5, 3],
        [12, 1],
      ],
      (v) => `${v[1]} turtle${v[1] > 1 ? 's' : ''} reaching ${v[0]} inches of shell`,
    ),
    introOutputs: ['gal', 'litres'],
    relatedSlugs: ['rat-cage-calculator', 'crickets-chirping-thermometer-calculator'],
    checks: [
      { inputs: {}, expect: { gal: '60 gallons', litres: '227.1 L' } },
      { inputs: { count: 2 }, expect: { gal: '120 gallons', litres: '454.2 L' } },
      { inputs: { shell: 4 }, expect: { gal: '40 gallons', litres: '151.4 L' } },
    ],
  },
  {
    slug: 'animal-mortality-rate-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Livestock',
    title: 'Animal Mortality Rate Calculator for Herds and Flocks',
    h1: 'Animal Mortality Rate Calculator',
    metaDescription: 'Calculate the mortality percentage, deaths per 1,000 animals and survival rate for a herd, flock or batch.',
    about:
      'Mortality rate is the share of animals in a group that die over a period, and it is one of the first numbers a farm manager, vet or lender asks for. It is used to judge a batch of broilers, a feedlot pen, a litter of piglets or a year of calving, and it is tracked against targets such as 4 to 5 percent for a broiler flock or 3 to 5 percent for calves in a well-run dairy. Enter the deaths, the number at the start and the number added during the period, and the calculator gives the percentage, the figure per 1,000 head and the survival rate. A sharp rise points to disease, heat or a management fault, so record losses by day and cause, and investigate when deaths exceed the usual curve. Compare like with like, because the age and class of animals changes what is normal.',
    inputs: [
      field('deaths', 'Deaths in the period', 18, 0, 10000000),
      field('start', 'Animals at the start', 1200, 1, 100000000),
      field('added', 'Animals added during the period', 0, 0, 100000000),
    ],
    outputs: [
      { name: 'pct', label: 'Mortality rate', format: 'text', highlight: true },
      { name: 'per1000', label: 'Deaths per 1,000 animals', format: 'text' },
      { name: 'survival', label: 'Survival rate', format: 'text' },
    ],
    calculate: (i) => {
      const total = toD(i.start).add(toD(i.added));
      const rate = toD(i.deaths).div(total).mul(100);
      return { pct: `${fmtNumber(rate, 2)}%`, per1000: fmtNumber(rate.mul(10), 1), survival: `${fmtNumber(new D(100).sub(rate), 2)}%` };
    },
    formulaDescription:
      'Mortality % = deaths ÷ (animals at the start + animals added) × 100. Deaths per 1,000 = mortality % × 10. Survival % = 100 − mortality %.',
    workedExample: '18 deaths among 1,200 animals is 18 ÷ 1,200 = 1.5%, which is 15 deaths per 1,000 head and a survival rate of 98.5%.',
    faq: [
      {
        question: 'Should culls be counted as deaths?',
        answer: 'Report them separately. Mortality means animals that died, and culling is a management decision, though total losses can be useful too.',
      },
      {
        question: 'What period should I use?',
        answer:
          'The production cycle you are judging: a broiler batch, a rearing period, a calving season or a year. State the period when you compare figures.',
      },
      {
        question: 'What is a normal mortality rate?',
        answer:
          'It depends on species and age. Targets for adult cattle are often below 2 percent a year, while young stock and poultry have higher but well-known benchmarks.',
      },
    ],
    scenarios: rows(
      ['deaths', 'start', 'added'],
      [
        [18, 1200, 0],
        [45, 500, 100],
        [0, 800, 0],
        [12, 20000, 0],
        [60, 3000, 500],
        [7, 250, 0],
      ],
      (v) => `${v[0]} deaths from ${v[1]} animals with ${v[2]} added`,
    ),
    introOutputs: ['pct', 'survival'],
    relatedSlugs: ['feed-conversion-ratio-calculator', 'cattle-per-acre-calculator'],
    checks: [
      { inputs: {}, expect: { pct: '1.5%', per1000: '15', survival: '98.5%' } },
      { inputs: { deaths: 45, start: 500, added: 100 }, expect: { pct: '7.5%', per1000: '75' } },
      { inputs: { deaths: 0 }, expect: { pct: '0%', survival: '100%' } },
    ],
  },
  {
    slug: 'cattle-per-acre-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Livestock',
    title: 'Cattle per Acre Calculator: Stocking Rate for Pasture',
    h1: 'Cattle per Acre Calculator',
    metaDescription: 'Estimate how many acres each animal needs and how many head a pasture carries from forage yield, intake and grazing days.',
    about:
      'Overgrazing damages pasture and underuse wastes feed, so the stocking rate matters. The method used by extension services compares what the pasture grows with what the animals eat. A cow of 1,000 pounds eats around 2.5 percent of her body weight in dry forage a day. Only part of the forage can be grazed, because plants need leaf left to regrow, and a utilisation of about 50 percent is a common planning figure. Enter the annual dry matter yield per acre, the animal weight, the intake percentage, the days of grazing and the acres you have. The calculator returns the acres needed for each animal, the animals per acre and the herd your pasture supports. Rain, soil, species and fertility change the yield from under 1,000 to more than 6,000 pounds per acre, so measure or ask your local advisor.',
    inputs: [
      field('forage', 'Forage yield (lb dry matter per acre)', 3000, 200, 20000),
      field('util', 'Utilisation (%)', 50, 10, 100),
      field('weight', 'Animal weight (lb)', 1000, 100, 3000),
      field('intake', 'Daily intake (% of body weight)', 2.5, 1, 5),
      field('days', 'Grazing days', 180, 1, 365),
      field('acres', 'Pasture size (acres)', 40, 0.1, 1000000),
    ],
    outputs: [
      { name: 'perHead', label: 'Acres needed per animal', format: 'text', highlight: true },
      { name: 'perAcre', label: 'Animals per acre', format: 'text' },
      { name: 'herd', label: 'Head your pasture carries', format: 'text' },
    ],
    calculate: (i) => {
      const supply = toD(i.forage).mul(toD(i.util)).div(100);
      const need = toD(i.weight).mul(toD(i.intake)).div(100).mul(toD(i.days));
      const perHead = need.div(supply);
      return {
        perHead: `${fmtNumber(perHead, 2)} acres`,
        perAcre: fmtNumber(supply.div(need), 2),
        herd: `${fmtNumber(toD(i.acres).div(perHead).floor(), 0)} head`,
      };
    },
    formulaDescription:
      'Usable forage per acre = yield × utilisation. Need per animal = weight × intake % × grazing days. Acres per animal = need ÷ usable forage. Head = acres ÷ acres per animal, rounded down.',
    workedExample:
      '3,000 lb per acre at 50% use gives 1,500 lb usable. A 1,000 lb animal at 2.5% for 180 days eats 4,500 lb, so it needs 3 acres. A 40 acre pasture carries 13 head.',
    faq: [
      {
        question: 'What is utilisation?',
        answer: 'The share of the forage that is grazed. Leaving half keeps enough leaf for plants to regrow and protects the soil.',
      },
      {
        question: 'How can I carry more animals?',
        answer: 'Improve the yield with fertility, legumes and rotational grazing, or feed hay to extend the season, rather than packing in more head.',
      },
      {
        question: 'How do I find my forage yield?',
        answer: 'Clip and weigh samples from small plots, dry them and scale up, or use the figure for your soil from the local agricultural service.',
      },
    ],
    scenarios: rows(
      ['forage', 'util', 'weight', 'intake', 'days', 'acres'],
      [
        [3000, 50, 1000, 2.5, 180, 40],
        [6000, 50, 1000, 2.5, 180, 40],
        [3000, 50, 1000, 2.5, 365, 40],
        [2000, 40, 1200, 2.2, 150, 100],
        [4500, 55, 900, 2.6, 200, 25],
        [1500, 50, 1100, 2.5, 120, 80],
      ],
      (v) => `${v[0]} lb of forage per acre for ${v[2]} lb animals grazing ${v[4]} days`,
    ),
    introOutputs: ['perHead', 'herd'],
    relatedSlugs: ['dry-matter-calculator', 'feed-conversion-ratio-calculator'],
    checks: [
      { inputs: {}, expect: { perHead: '3 acres', perAcre: '0.33', herd: '13 head' } },
      { inputs: { forage: 6000 }, expect: { perHead: '1.5 acres', perAcre: '0.67', herd: '26 head' } },
      { inputs: { days: 365 }, expect: { perHead: '6.08 acres', herd: '6 head' } },
    ],
  },
  {
    slug: 'feed-conversion-ratio-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Livestock',
    title: 'Feed Conversion Ratio Calculator: Feed per Kilogram of Gain',
    h1: 'Feed Conversion Ratio Calculator',
    metaDescription: 'Divide the feed eaten by the weight gained to get the feed conversion ratio and the feed efficiency of a group of animals.',
    about:
      'The feed conversion ratio, or FCR, tells a producer how many kilograms of feed an animal needs to put on one kilogram of body weight. The lower it is, the more efficient the animal. Broiler chickens reach about 1.6 to 1.9 over a six-week cycle, pigs between 2.5 and 3.0 from weaning to market, and beef cattle in a feedlot 6 to 8 on a dry matter basis, which is why poultry can be so much cheaper to grow than beef. Enter the total feed given to a group, and the total weight of the group at the start and at the end, and the calculator returns FCR and feed efficiency, the inverse as a percentage. Compare batches under similar conditions; heat, disease, wasted feed and a poor diet all push FCR up, and a rising trend is an early warning to check the feeders and the health of the animals.',
    inputs: [
      field('feed', 'Total feed given (kg)', 250, 0.1, 100000000),
      field('start', 'Group weight at the start (kg)', 40, 0, 100000000),
      field('end', 'Group weight at the end (kg)', 140, 0, 100000000),
    ],
    outputs: [
      { name: 'gain', label: 'Weight gained', format: 'text' },
      { name: 'fcr', label: 'Feed conversion ratio', format: 'text', highlight: true },
      { name: 'eff', label: 'Feed efficiency', format: 'text' },
    ],
    calculate: (i) => {
      const gain = toD(i.end).sub(toD(i.start));
      if (gain.lte(0)) return { gain: `${fmtNumber(gain, 1)} kg`, fcr: 'No weight gain', eff: '-' };
      const fcr = toD(i.feed).div(gain);
      return { gain: `${fmtNumber(gain, 1)} kg`, fcr: fmtNumber(fcr, 2), eff: `${fmtNumber(new D(100).div(fcr), 1)}%` };
    },
    formulaDescription: 'Weight gain = final weight − starting weight. FCR = feed given ÷ weight gain. Feed efficiency = weight gain ÷ feed given × 100.',
    workedExample: 'A group eats 250 kg of feed and grows from 40 kg to 140 kg, a gain of 100 kg. FCR = 250 ÷ 100 = 2.5, so feed efficiency is 40 percent.',
    faq: [
      {
        question: 'Should the FCR use feed as fed or dry matter?',
        answer: 'Either, but compare like with like. Cattle figures are usually dry matter, and poultry and pig figures as fed.',
      },
      { question: 'What lowers FCR?', answer: 'Good genetics, balanced feed, clean water, comfortable temperatures, low disease and little feed waste.' },
      { question: 'What if the animals lose weight?', answer: 'The ratio has no meaning without a gain, so the calculator reports no weight gain.' },
    ],
    scenarios: rows(
      ['feed', 'start', 'end'],
      [
        [250, 40, 140],
        [180, 20, 80],
        [3500, 60, 1000],
        [9000, 300, 3300],
        [1200, 150, 650],
        [60, 5, 35],
      ],
      (v) => `${v[0]} kg of feed while the group grew from ${v[1]} kg to ${v[2]} kg`,
    ),
    introOutputs: ['fcr', 'eff'],
    relatedSlugs: ['dry-matter-calculator', 'animal-mortality-rate-calculator'],
    checks: [
      { inputs: {}, expect: { gain: '100 kg', fcr: '2.5', eff: '40%' } },
      { inputs: { feed: 180, start: 20, end: 80 }, expect: { fcr: '3', eff: '33.3%' } },
      { inputs: { feed: 100, start: 50, end: 50 }, expect: { fcr: 'No weight gain' } },
    ],
  },
  {
    slug: 'grain-bin-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Livestock',
    title: 'Grain Bin Calculator: Bushels and Tons in a Round Bin',
    h1: 'Grain Bin Calculator',
    metaDescription: 'Calculate the bushels and tons of grain in a round bin from its diameter, wall height and the height of the peak.',
    about:
      'A farmer who wants to know how much corn or wheat is stored in a round bin can measure it instead of weighing it. The grain forms a cylinder up to the depth on the walls, with a cone on top when the bin was filled from a central spout. Add the volume of the cylinder, pi times the radius squared times the grain depth, to the cone, a third of pi times the radius squared times the peak height, and divide by 1.2445 cubic feet, the volume of a US bushel. The weight follows from the test weight of the crop, 56 pounds per bushel for corn, 60 for wheat and soybeans, 48 for barley and 32 for oats. Real grain packs under its own weight, so a deep bin holds a few percent more than this estimate, and moisture changes the test weight.',
    inputs: [
      field('dia', 'Bin diameter (ft)', 24, 3, 150),
      field('depth', 'Grain depth at the wall (ft)', 20, 0.5, 150),
      field('peak', 'Height of the peak (ft, 0 if level)', 4, 0, 60),
      select('crop', 'Grain', 'corn', [
        ['corn', 'Corn (56 lb/bu)'],
        ['wheat', 'Wheat (60 lb/bu)'],
        ['soy', 'Soybeans (60 lb/bu)'],
        ['barley', 'Barley (48 lb/bu)'],
        ['oats', 'Oats (32 lb/bu)'],
      ]),
    ],
    outputs: [
      { name: 'vol', label: 'Grain volume', format: 'text' },
      { name: 'bu', label: 'Bushels', format: 'text', highlight: true },
      { name: 'tons', label: 'Weight in short tons', format: 'text' },
    ],
    calculate: (i) => {
      const r = toD(i.dia).div(2);
      const base = PI.mul(r.pow(2));
      const vol = base.mul(toD(i.depth)).add(base.mul(toD(i.peak)).div(3));
      const bu = vol.div(CUBIC_FEET_PER_BUSHEL);
      const lbPerBu = { corn: 56, wheat: 60, soy: 60, barley: 48, oats: 32 }[String(i.crop)] ?? 56;
      return { vol: `${fmtNumber(vol, 0)} cu ft`, bu: fmtNumber(bu, 0), tons: `${fmtNumber(bu.mul(lbPerBu).div(2000), 1)} tons` };
    },
    formulaDescription: 'Volume = π r² × depth + π r² × peak ÷ 3, with r = diameter ÷ 2. Bushels = volume ÷ 1.2445. Tons = bushels × test weight (lb) ÷ 2,000.',
    workedExample:
      'A 24 ft bin with 20 ft of grain and a 4 ft peak: π × 12² = 452.4 sq ft; × 20 = 9,047.8, plus 603.2 for the cone, is 9,651 cu ft, or 7,755 bushels. At 56 lb per bushel, that is 217.1 tons.',
    faq: [
      {
        question: 'Is the answer exact?',
        answer:
          'It is an estimate. Grain settles in a tall bin and holds several percent more than the plain volume, and moisture and fines change the test weight.',
      },
      {
        question: 'What if my bin has a hopper bottom?',
        answer: 'Add the volume of the hopper cone below the wall separately; this calculator covers the straight-walled part and the peak on top.',
      },
      {
        question: 'What is a bushel?',
        answer: 'A volume of 1.2445 cubic feet in the United States. Weight per bushel varies by crop, and grain buyers set standard test weights.',
      },
    ],
    scenarios: [
      withInputs('A 24 ft bin of corn with a peak', { dia: 24, depth: 20, peak: 4, crop: 'corn' }),
      withInputs('A level-filled 24 ft bin', { dia: 24, depth: 20, peak: 0, crop: 'corn' }),
      withInputs('A 30 ft bin of wheat', { dia: 30, depth: 24, peak: 5, crop: 'wheat' }),
      withInputs('A small 15 ft bin of oats', { dia: 15, depth: 12, peak: 3, crop: 'oats' }),
      withInputs('A 36 ft bin of soybeans', { dia: 36, depth: 28, peak: 6, crop: 'soy' }),
    ],
    introOutputs: ['bu', 'tons'],
    relatedSlugs: ['cattle-per-acre-calculator', 'dry-matter-calculator'],
    checks: [
      { inputs: {}, expect: { vol: '9,651 cu ft', bu: '7,755', tons: '217.1 tons' } },
      { inputs: { peak: 0 }, expect: { vol: '9,048 cu ft', bu: '7,270' } },
      { inputs: { crop: 'wheat' }, expect: { bu: '7,755', tons: '232.6 tons' } },
    ],
  },
  {
    slug: 'mlvss-calculator',
    category: 'biology',
    tier: 3,
    subCluster: 'Other',
    title: 'MLVSS Calculator: Mixed Liquor Volatile Suspended Solids',
    h1: 'MLVSS Calculator',
    metaDescription: 'Turn the dried and ashed weights of a mixed liquor sample into MLSS, MLVSS in mg/L and the volatile fraction.',
    about:
      'In an activated sludge plant, bacteria that clean the wastewater live in the aeration tank as a suspension called mixed liquor. Operators measure how much of it there is with a gravimetric test. A known volume of sample is filtered, dried at 105 degrees Celsius and weighed, which gives the mixed liquor suspended solids, MLSS. The dried residue is then ignited at 550 degrees Celsius; what burns off is the volatile part, mostly living and dead cells, and what remains is ash. The loss on ignition divided by the sample volume is the MLVSS, the best simple indicator of the active biomass. A healthy conventional plant runs at 2,000 to 4,000 mg/L MLSS with about 70 to 80 percent volatile, and a falling volatile fraction means inert material is building up in the system, which affects sludge age and food to microorganism ratio.',
    inputs: [
      field('vol', 'Sample volume (mL)', 20, 1, 1000),
      field('dry', 'Dry residue at 105 °C (mg)', 60, 0.1, 100000),
      field('ash', 'Ash after 550 °C (mg)', 12, 0, 100000),
    ],
    outputs: [
      { name: 'mlss', label: 'MLSS', format: 'text' },
      { name: 'mlvss', label: 'MLVSS', format: 'text', highlight: true },
      { name: 'frac', label: 'Volatile fraction', format: 'text' },
    ],
    calculate: (i) => {
      const dry = toD(i.dry),
        ash = toD(i.ash),
        vol = toD(i.vol);
      const vss = dry.sub(ash);
      return {
        mlss: `${fmtNumber(dry.div(vol).mul(1000), 0)} mg/L`,
        mlvss: `${fmtNumber(vss.div(vol).mul(1000), 0)} mg/L`,
        frac: `${fmtNumber(vss.div(dry).mul(100), 1)}%`,
      };
    },
    formulaDescription:
      'MLSS (mg/L) = dry residue (mg) ÷ sample volume (mL) × 1,000. MLVSS = (dry residue − ash) ÷ volume × 1,000. Volatile fraction = MLVSS ÷ MLSS × 100.',
    workedExample:
      'A 20 mL sample leaves 60 mg after drying and 12 mg of ash. MLSS = 60 ÷ 20 × 1,000 = 3,000 mg/L, MLVSS = 48 ÷ 20 × 1,000 = 2,400 mg/L, and 80 percent is volatile.',
    faq: [
      {
        question: 'What volatile fraction is typical?',
        answer: 'About 70 to 80 percent for a domestic plant. Industrial waste or sludge with much inorganic material can be lower.',
      },
      {
        question: 'Why is MLVSS used instead of MLSS?',
        answer: 'Because the volatile solids stand for the living organic matter, while the ash is inert and does no treatment.',
      },
      {
        question: 'What is the filter step?',
        answer:
          'The sample is filtered through a pre-weighed glass fibre filter, and the filter plus solids is dried and then ashed, so the filter weight must be subtracted.',
      },
    ],
    scenarios: rows(
      ['vol', 'dry', 'ash'],
      [
        [20, 60, 12],
        [10, 50, 10],
        [25, 100, 40],
        [50, 160, 36],
        [15, 45, 9],
        [30, 105, 21],
      ],
      (v) => `A ${v[0]} mL sample drying to ${v[1]} mg and leaving ${v[2]} mg of ash`,
    ),
    introOutputs: ['mlss', 'mlvss'],
    relatedSlugs: ['dry-matter-calculator', 'animal-mortality-rate-calculator'],
    checks: [
      { inputs: {}, expect: { mlss: '3,000 mg/L', mlvss: '2,400 mg/L', frac: '80%' } },
      { inputs: { vol: 10, dry: 50, ash: 10 }, expect: { mlss: '5,000 mg/L', mlvss: '4,000 mg/L' } },
      { inputs: { vol: 25, dry: 100, ash: 40 }, expect: { mlss: '4,000 mg/L', mlvss: '2,400 mg/L', frac: '60%' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
