import { D, toD } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { intField } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 4 (biology): gestation timers for ten species. Each species has an average length and a usual window
 * taken from standard husbandry and veterinary references; the page counts days from breeding, so a different start
 * point (such as ovulation in dogs) shifts the result. Tier 2 or 3, so none is live until the cohort gate opens.
 */

interface Species {
  slug: string;
  name: string; // "Cat"
  noun: string; // used in scenario labels
  title: string;
  h1: string;
  meta: string;
  avg: number;
  lo: number;
  hi: number;
  def: number; // default days since breeding
  tier: 2 | 3;
  about: string;
  worked: string;
  faq: [string, string][];
  related: [string, string];
  expect: { remaining: string; range: string; progress: string };
  scenarioDays: number[];
}

const SPECIES: Species[] = [
  {
    slug: 'cat-pregnancy-calculator',
    name: 'Cat',
    noun: 'A queen',
    title: 'Cat Pregnancy Calculator: Days Left Until Kittens',
    h1: 'Cat Pregnancy Calculator',
    meta: 'Count the days since your cat was bred to see how far along she is, how many days remain and when the kittens usually arrive.',
    avg: 64,
    lo: 63,
    hi: 66,
    def: 30,
    tier: 2,
    about:
      'A queen is pregnant for about nine weeks, usually 63 to 66 days from mating, and a mating can happen several times over a few days, so the count starts from the first one you saw. Around the third week her nipples turn pink and enlarge, a change owners call pinking up, and a vet can feel or scan the kittens from about the third to fourth week. Appetite rises in the second half, and she will look for a quiet, dark nest in the last week. Kittens born before day 58 are rarely strong enough to survive. Provide a box lined with towels, keep her indoors in late pregnancy and book a vet check, particularly for a first litter or a breed with a flat face.',
    worked:
      'A queen bred 30 days ago has about 64 − 30 = 34 days to go. The usual window of day 63 to 66 means kittens in 33 to 36 days, and she is 46.9 percent of the way through.',
    faq: [
      [
        'How early can a vet confirm a cat pregnancy?',
        'Ultrasound can show heartbeats from around day 16 to 21, and a trained vet can feel the swellings in the abdomen around the third to fourth week.',
      ],
      [
        'What if my cat goes past 66 days?',
        'A queen that has not delivered by day 68 or shows green discharge, heavy bleeding or hard straining without a kitten needs a vet the same day.',
      ],
      ['Do kittens come all at once?', 'Not usually. A litter can span several hours, and a rest of up to two hours between kittens can be normal.'],
    ],
    related: ['dog-pregnancy-calculator', 'rabbit-gestation-calculator'],
    expect: { remaining: '34 days to the average due date', range: '33 to 36 days from now', progress: '46.9%' },
    scenarioDays: [14, 28, 42, 52, 60, 64],
  },
  {
    slug: 'dog-pregnancy-calculator',
    name: 'Dog',
    noun: 'A bitch',
    title: 'Dog Pregnancy Calculator: Whelping Date and Days Left',
    h1: 'Dog Pregnancy Calculator',
    meta: 'Enter the days since your dog was bred to see how far along she is and when the puppies are most likely to be whelped.',
    avg: 63,
    lo: 58,
    hi: 68,
    def: 30,
    tier: 2,
    about:
      "A dog is pregnant for about 63 days counted from ovulation, but breeders usually count from the mating date, and because sperm survive for several days the real span from a mating is anywhere from 58 to 68 days. Progesterone testing or a vet's ultrasound narrows the date much more precisely. Pregnancy can be confirmed by ultrasound at around day 25 to 30, and an X-ray after about day 45 shows the skeletons so the number of puppies can be counted before whelping. Her body temperature drops by about one degree Celsius within a day of whelping, a sign many breeders track with a rectal thermometer twice a day in the last week. Prepare a whelping box at least a week before the earliest date. Toy breeds and short-nosed breeds often need a caesarean section, so ask your vet to plan it, and expect litters from two puppies in the smallest breeds to a dozen in giants such as mastiffs. Many breeders keep a log of the birth time, weight and sex, and weigh the puppies daily for the first fortnight, since a puppy that fails to gain is the first sign that something is wrong. Vaccination status, worming before mating and a high-quality puppy diet from the fifth week of pregnancy are all part of preparing a healthy litter.",
    worked:
      'A bitch bred 30 days ago has about 63 − 30 = 33 days to go, with a window of 28 to 38 days from now, and she is 47.6 percent through the average term.',
    faq: [
      [
        'Why is the dog due date so uncertain from a mating?',
        'Sperm can live up to a week in the bitch and the egg matures after ovulation, so the interval from a single mating to birth varies by several days. Hormone tests give a firmer date.',
      ],
      [
        'When can I see the puppies on a scan?',
        'An ultrasound can show heartbeats from about day 25 to 30, and radiographs after about day 45 allow an accurate puppy count.',
      ],
      [
        'What counts as an emergency during whelping?',
        'More than two hours of strong straining without a puppy, over four hours between puppies, green discharge before the first puppy or collapse all call for an immediate vet visit.',
      ],
    ],
    related: ['cat-pregnancy-calculator', 'swine-gestation-calculator'],
    expect: { remaining: '33 days to the average due date', range: '28 to 38 days from now', progress: '47.6%' },
    scenarioDays: [21, 35, 45, 55, 61, 66],
  },
  {
    slug: 'cow-gestation-calculator',
    name: 'Cow',
    noun: 'A cow',
    title: 'Cow Gestation Calculator: Calving Date and Days Left',
    h1: 'Cow Gestation Calculator',
    meta: 'Find how many days are left until calving from the days since breeding, with the usual window for dairy and beef cows.',
    avg: 283,
    lo: 279,
    hi: 287,
    def: 140,
    tier: 3,
    about:
      'A cow carries her calf for about 283 days, a little over nine months, though breed and sex of the calf shift it by a few days. Holsteins tend to calve near day 279, many beef breeds a few days later, and bull calves are carried a day or two longer than heifer calves. Dairy herds dry the cow off about 60 days before calving to let the udder rest and the calf grow, and feed is adjusted in the last trimester when the calf gains most of its weight. Heifers are moved to a clean calving pen a week or two before the due date, and observation increases from day 275. Enter the days since artificial insemination or the observed service, and the calculator shows the days remaining and the window in which most calves arrive.',
    worked:
      'A cow bred 140 days ago has about 283 − 140 = 143 days left, with calving between 139 and 147 days from now, and the pregnancy is 49.5 percent complete.',
    faq: [
      [
        'When should a dairy cow be dried off?',
        'About 60 days before the expected calving date, which for the average 283-day pregnancy means around day 223.',
      ],
      [
        'How do I confirm a cow is in calf?',
        'A vet can palpate or scan from about day 30 to 35, and a blood or milk test can confirm earlier. Check again at 60 days.',
      ],
      [
        'What if the cow goes past her window?',
        'Call the vet if she has not calved by about day 292, or sooner if she is straining without progress after two hours.',
      ],
    ],
    related: ['mare-gestation-calculator', 'sheep-gestation-calculator'],
    expect: { remaining: '143 days to the average due date', range: '139 to 147 days from now', progress: '49.5%' },
    scenarioDays: [30, 90, 180, 230, 270, 283],
  },
  {
    slug: 'goat-gestation-calculator',
    name: 'Goat',
    noun: 'A doe',
    title: 'Goat Gestation Calculator: Kidding Date and Days Left',
    h1: 'Goat Gestation Calculator',
    meta: 'Use the days since your doe was bred to find how far along she is and when kidding is likely, around day 150.',
    avg: 150,
    lo: 145,
    hi: 155,
    def: 75,
    tier: 3,
    about:
      'A doe is pregnant for about five months, around 150 days, with a normal spread from 145 to 155 days. Dairy breeds such as Saanen and Alpine tend to run a day or two shorter than the meat breeds, and does carrying triplets kid slightly earlier than those with a single kid. In the last six weeks the kids gain most of their weight, so feed quality matters, and many keepers give a booster vaccination against clostridial disease and tetanus about a month before kidding so the kids receive protection in the colostrum. The udder fills in the last two to four weeks, the ligaments beside the tail soften within a day of kidding, and the doe often paws the bedding and calls. Prepare a clean, dry kidding pen at least a week before day 145. Goat milk keepers also note that a doe due to kid in autumn must be bred in spring, since most breeds cycle only in the short days of autumn and winter.',
    worked:
      'A doe bred 75 days ago has about 150 − 75 = 75 days to go, with kidding likely between 70 and 80 days from now. She is exactly halfway through the average term.',
    faq: [
      [
        'How can I tell my goat is close to kidding?',
        'The udder tightens and shines, the ligaments by the tail soften, and she may seek isolation, paw the ground and pass a clear discharge.',
      ],
      ['When should I vaccinate the doe?', 'Many keepers give the clostridial booster four to six weeks before kidding so antibodies reach the colostrum.'],
      ['How many kids are typical?', 'Twins are most common, singles are usual for first-time does and triplets occur in prolific breeds.'],
    ],
    related: ['sheep-gestation-calculator', 'cow-gestation-calculator'],
    expect: { remaining: '75 days to the average due date', range: '70 to 80 days from now', progress: '50%' },
    scenarioDays: [20, 50, 100, 120, 140, 148],
  },
  {
    slug: 'guinea-pig-pregnancy-calculator',
    name: 'Guinea pig',
    noun: 'A sow',
    title: 'Guinea Pig Pregnancy Calculator: Days Until the Pups',
    h1: 'Guinea Pig Pregnancy Calculator',
    meta: 'Count the days since a guinea pig was housed with a boar to see how far along she is and when the pups are likely.',
    avg: 65,
    lo: 59,
    hi: 72,
    def: 30,
    tier: 3,
    about:
      'A guinea pig pregnancy is long for a small rodent, about 65 days on average, with a range of 59 to 72 days, and large litters tend to arrive earlier than single pups. The pups are born fully furred with open eyes and can nibble solid food within a day, which is why the sow needs to be in good shape beforehand. A first litter should ideally arrive before the sow is about seven months old, because the pelvic bones fuse later and a first birth after that age can be obstructed, and anyone expecting pups should seek advice from an exotics vet. From about week five the belly widens and you can sometimes feel the pups move, and from week six the sow needs more vitamin C, hay and fresh greens. Give a quiet, larger enclosure and avoid handling her in the last week.',
    worked:
      'A sow bred 30 days ago has about 65 − 30 = 35 days to go. The window of 59 to 72 days means birth in 29 to 42 days from now, and she is 46.2 percent through.',
    faq: [
      [
        'How can I tell my guinea pig is pregnant?',
        'Weight gain, a widening belly from about week four to five and movement of the pups under the skin near the end. A vet can confirm with a scan.',
      ],
      [
        'Why does the due date range so widely?',
        "Litter size, the sow's age and the exact mating date all change it. Large litters come earlier, small litters later.",
      ],
      ['Should the boar stay in the cage?', 'No. A sow can conceive again within hours of giving birth, so separate the boar before the due window opens.'],
    ],
    related: ['rabbit-gestation-calculator', 'cat-pregnancy-calculator'],
    expect: { remaining: '35 days to the average due date', range: '29 to 42 days from now', progress: '46.2%' },
    scenarioDays: [10, 25, 40, 52, 60, 66],
  },
  {
    slug: 'mare-gestation-calculator',
    name: 'Mare',
    noun: 'A mare',
    title: 'Mare Gestation Calculator: Foaling Date and Days Left',
    h1: 'Mare Gestation Calculator',
    meta: 'Find the days remaining until foaling from the days since breeding, with the wide usual window for horses of 320 to 360 days.',
    avg: 340,
    lo: 320,
    hi: 360,
    def: 170,
    tier: 3,
    about:
      'A mare carries her foal for about 340 days, roughly eleven months, and unlike most animals she has an unusually wide normal range: 320 to 360 days, and foals born well over 370 days are still seen. Colts are carried a few days longer than fillies, foals conceived early in the season are carried longer than late ones, and an older mare or a heavily fed one may differ again. Breeders confirm pregnancy with an ultrasound at about 14 to 16 days and recheck at 28 to 30. In the final month the udder fills, the teats may drip wax, and mares usually foal at night. Prepare a clean, bedded stall at least a month before the earliest date, and ask your vet about vaccination and deworming schedule for the last trimester.',
    worked: 'A mare bred 170 days ago is exactly halfway: 340 − 170 = 170 days remain, and foaling falls between 150 and 190 days from now.',
    faq: [
      [
        'Why is the horse range so wide?',
        'Foal sex, season of breeding, age and nutrition of the mare, and individual variation all contribute. A healthy foal can arrive anywhere in the 320 to 360 day window.',
      ],
      ["When should a mare's pregnancy be checked?", 'Commonly at 14 to 16 days for presence, at 28 to 30 days for a heartbeat, and again after 60 days.'],
      [
        'What are signs that foaling is close?',
        'Udder fills with colostrum, wax forms on the teats, the muscles around the tail head relax and she becomes restless and sweaty.',
      ],
    ],
    related: ['llama-gestation-calculator', 'cow-gestation-calculator'],
    expect: { remaining: '170 days to the average due date', range: '150 to 190 days from now', progress: '50%' },
    scenarioDays: [30, 100, 200, 280, 320, 340],
  },
  {
    slug: 'llama-gestation-calculator',
    name: 'Llama',
    noun: 'A female llama',
    title: 'Llama Gestation Calculator: Cria Date and Days Left',
    h1: 'Llama Gestation Calculator',
    meta: 'Enter the days since breeding to see how far along your llama is and when the cria is likely to arrive, near day 350.',
    avg: 350,
    lo: 330,
    hi: 360,
    def: 175,
    tier: 3,
    about:
      'A llama is pregnant for about 350 days, nearly twelve months, and bears a single young animal called a cria. Alpacas, a related species, carry theirs for slightly less, so use the llama figure only for llamas. Llamas are induced ovulators: they ovulate in response to mating, and a pregnant female will spit off a male in the "spit test", which is a simple check from about day 14. A cria is usually born in daylight, which is an adaptation to cold nights in the Andes, and standing within an hour and nursing within a few. Check that the cria has suckled within six hours, because the first milk supplies protective antibodies. Provide shelter and keep the dam fed well in the last trimester, when most of the cria\'s growth takes place.',
    worked: 'A llama bred 175 days ago is halfway through: 350 − 175 = 175 days to go, with a window of 155 to 185 days from now.',
    faq: [
      [
        'How do I check if my llama is pregnant?',
        'The spit test is a first sign, and a vet can confirm with a blood progesterone test or an ultrasound from about day 25.',
      ],
      [
        'Why does a cria usually arrive in the day?',
        'Births cluster in the morning and early afternoon, a trait that helps the newborn dry and warm before the cold night.',
      ],
      ['Is the alpaca the same?', 'No. Alpacas carry for about 335 to 345 days, so adjust the date by a few days earlier.'],
    ],
    related: ['mare-gestation-calculator', 'goat-gestation-calculator'],
    expect: { remaining: '175 days to the average due date', range: '155 to 185 days from now', progress: '50%' },
    scenarioDays: [30, 120, 220, 300, 340, 350],
  },
  {
    slug: 'rabbit-gestation-calculator',
    name: 'Rabbit',
    noun: 'A doe rabbit',
    title: 'Rabbit Gestation Calculator: Kindling Date and Days Left',
    h1: 'Rabbit Gestation Calculator',
    meta: 'Count the days since a doe rabbit was bred to see how far along she is and when the kits will be born, about 31 days.',
    avg: 31,
    lo: 28,
    hi: 33,
    def: 15,
    tier: 3,
    about:
      'A rabbit pregnancy is short, about 31 days, with kindling normally between day 28 and day 33; a litter that arrives before day 28 often does not survive, and one that runs past day 33 may be a sign of trouble or an empty doe. Kits are born blind and hairless, and the doe nurses them only once or twice a day, usually at night, which is why a nest that seems untended is normally fine. Place a nest box with clean straw in the cage around day 28, because the doe starts to pull fur from her chest and dewlap one to two days before kindling to line the nest. Palpation by an experienced person at day 10 to 14 can detect embryos, but it can also hurt them, so ask a vet. Give extra hay and water, and handle her gently. Meat breeds such as the New Zealand White average eight kits, and dwarf breeds only three or four, so litter size depends strongly on the breed you keep. Rabbits are also induced ovulators and can be mated again within hours of kindling, so many keepers separate the buck at once to protect her condition. Hutch rabbits kept outdoors need extra bedding and shelter from heat, because does that overheat in summer may abort or lose the litter.',
    worked:
      'A doe bred 15 days ago has about 31 − 15 = 16 days to go. The window of day 28 to 33 puts kindling 13 to 18 days from now, and she is 48.4 percent through.',
    faq: [
      ['When should the nest box go in?', 'Around day 28, a few days before the earliest likely birth, so the doe has time to line it with fur.'],
      [
        'The doe has not kindled by day 34. What now?',
        'Contact a vet. A rabbit that is past her term may have an empty uterus, dead kits or a retained litter, and each is dangerous without help.',
      ],
      [
        'Why does the doe leave her kits alone?',
        'Wild rabbits visit the nest once or twice a day to avoid drawing predators. A kit with a round, full belly has been fed.',
      ],
    ],
    related: ['guinea-pig-pregnancy-calculator', 'cat-pregnancy-calculator'],
    expect: { remaining: '16 days to the average due date', range: '13 to 18 days from now', progress: '48.4%' },
    scenarioDays: [7, 12, 20, 26, 29, 31],
  },
  {
    slug: 'sheep-gestation-calculator',
    name: 'Sheep',
    noun: 'An ewe',
    title: 'Sheep Gestation Calculator: Lambing Date and Days Left',
    h1: 'Sheep Gestation Calculator',
    meta: 'Enter the days since the ram joined the ewes to see how far along a ewe is and when lambing is expected, about day 147.',
    avg: 147,
    lo: 142,
    hi: 152,
    def: 70,
    tier: 3,
    about:
      'A ewe is pregnant for about 147 days, close to five months, with a usual range of 142 to 152 days, and the exact length depends on breed, the number of lambs and the nutrition of the ewe. Early-maturing meat breeds lamb a little sooner than some wool breeds, and ewes with twins are often a day or two early. Flocks are often managed by recording the day a ram wearing a marker harness painted each ewe, which gives a firm service date. Ultrasound from about day 45 to 90 reveals the number of lambs, so the feed can be matched in the last six weeks, when two thirds of foetal growth takes place. Shearing before lambing, a clostridial booster and a clean, dry lambing area are standard preparation. Watch ewes closely from day 142. Hill and lowland flocks differ in lambing percentage, and a shepherd on exposed ground may delay the tupping date so lambs arrive in spring grass rather than snow.',
    worked: 'A ewe served 70 days ago has about 147 − 70 = 77 days to go, with lambing between 72 and 82 days from now, and she is 47.6 percent through.',
    faq: [
      [
        'How can I find out how many lambs a ewe carries?',
        'Ultrasound scanning between about day 45 and day 90 counts the lambs, which lets you feed singles and multiples differently.',
      ],
      ['What are the signs lambing is near?', 'The udder tightens and fills, the vulva swells and the ewe separates from the flock and becomes restless.'],
      [
        "Does the ram's breed change the date?",
        "Slightly. Some sire breeds add or cut a day or two, so a flock's own record is the best guide for the following year.",
      ],
    ],
    related: ['goat-gestation-calculator', 'cow-gestation-calculator'],
    expect: { remaining: '77 days to the average due date', range: '72 to 82 days from now', progress: '47.6%' },
    scenarioDays: [30, 60, 100, 120, 140, 147],
  },
  {
    slug: 'swine-gestation-calculator',
    name: 'Swine',
    noun: 'A sow',
    title: 'Swine Gestation Calculator: Farrowing Date and Days Left',
    h1: 'Swine Gestation Calculator',
    meta: 'Use the days since breeding to find how far along a sow is and when she will farrow, using the 3-3-3 rule of 114 days.',
    avg: 114,
    lo: 111,
    hi: 117,
    def: 60,
    tier: 3,
    about:
      "Pig keepers remember the sow's gestation as three months, three weeks and three days, which comes to about 114 days. The usual window is 111 to 117 days, and litters that arrive before day 110 have a high loss. Gilts, which are young females having their first litter, often run a day or two shorter than older sows. Sows are checked for pregnancy by ultrasound from about day 25 and again at 35, and any sow that returns to heat at around three weeks was not pregnant. Move her to the farrowing pen about five to seven days before the due date, to give her time to settle, and wash her before she goes in. Reduce feed slightly on the day before farrowing. Signs of imminent labour are restlessness, nesting with straw and milk in the teats.",
    worked: 'A sow bred 60 days ago has about 114 − 60 = 54 days to go, with farrowing between 51 and 57 days from now, and she is 52.6 percent through.',
    faq: [
      [
        'What is the 3-3-3 rule?',
        'Three months, three weeks and three days after service, which is about 114 days. It is a quick way to set the due date in the field.',
      ],
      ['When do I move the sow to the farrowing pen?', 'About five to seven days before the due date, so she can settle and build a nest.'],
      ['How can I tell she is nearly ready to farrow?', 'The vulva swells, milk can be expressed from the teats and she builds a nest and breathes quickly.'],
    ],
    related: ['dog-pregnancy-calculator', 'sheep-gestation-calculator'],
    expect: { remaining: '54 days to the average due date', range: '51 to 57 days from now', progress: '52.6%' },
    scenarioDays: [25, 45, 70, 90, 105, 112],
  },
];

const build = (s: Species): Spec => ({
  slug: s.slug,
  category: 'biology',
  tier: s.tier,
  subCluster: 'Animal pregnancy',
  title: s.title,
  h1: s.h1,
  metaDescription: s.meta,
  about: s.about,
  inputs: [intField('days', 'Days since breeding', s.def, 0, 500)],
  outputs: [
    { name: 'remaining', label: 'Time to the average due date', format: 'text', highlight: true },
    { name: 'range', label: 'Usual window for birth', format: 'text' },
    { name: 'progress', label: 'Progress through the pregnancy', format: 'text' },
  ],
  calculate: (i) => {
    const days = toD(i.days);
    const left = new D(s.avg).sub(days);
    const remaining = left.gt(0)
      ? `${fmtNumber(left, 0)} days to the average due date`
      : left.isZero()
        ? 'Due on the average day'
        : `${fmtNumber(left.abs(), 0)} days past the average`;
    const usual = days.gt(s.hi)
      ? 'Past the usual window, call your vet'
      : `${fmtNumber(D.max(new D(s.lo).sub(days), 0), 0)} to ${fmtNumber(new D(s.hi).sub(days), 0)} days from now`;
    const progress = `${fmtNumber(D.min(days.div(s.avg).mul(100), 100), 1)}%`;
    return { remaining, range: usual, progress };
  },
  formulaDescription: `Days remaining = ${s.avg} − days since breeding. The usual window runs from day ${s.lo} to day ${s.hi}. Progress = days since breeding ÷ ${s.avg} × 100, capped at 100 percent.`,
  workedExample: s.worked,
  faq: s.faq.map(([question, answer]) => ({ question, answer })),
  scenarios: s.scenarioDays.map((d) => ({ label: `${s.noun} bred ${d} days ago`, inputs: { days: d } })),
  introOutputs: ['remaining', 'range'],
  relatedSlugs: s.related,
  checks: [
    { inputs: {}, expect: s.expect },
    { inputs: { days: s.avg }, expect: { remaining: 'Due on the average day', progress: '100%' } },
    { inputs: { days: s.hi + 3 }, expect: { remaining: `${s.hi + 3 - s.avg} days past the average`, range: 'Past the usual window, call your vet' } },
  ],
});

export const SPECS: Spec[] = SPECIES.map(build);

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
