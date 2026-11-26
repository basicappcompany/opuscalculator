import { numberListField, parseNumberList, selectField } from '../lib/calc-utils';
import { D, toD } from '../lib/decimal';
import { fmtFixed, fmtNumber, fmtPercent } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { field, intField, rows } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 3 (ecology): energy sizing, footprints, population models and diversity indices. Emission factors
 * and efficiencies are inputs with a stated default, never hidden constants. Ecology shows no disclaimer. All pages
 * are tier 2 or 3, so none is live until the cohort gate opens.
 */

const PI = new D('3.14159265358979323846264338327950288');
const select = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});

export const SPECS: Spec[] = [
  {
    slug: 'flight-carbon-footprint-calculator',
    category: 'ecology',
    tier: 2,
    subCluster: 'Eco footprint',
    title: 'Flight Carbon Footprint Calculator: CO2 per Passenger',
    h1: 'Flight Carbon Footprint Calculator',
    metaDescription:
      'Estimate the CO2 equivalent of a flight per passenger from the distance, an emission factor you can change, and whether it is one way or return.',
    about:
      "A flight's footprint depends on distance, aircraft, how full it is and the seat class, so no single number fits every trip. This calculator multiplies the distance by an emission factor in kilograms of CO2 equivalent per passenger-kilometre. The default of 0.15 is a typical order of magnitude for economy seats on a modern jet, and you can replace it with the figure from your airline or an official conversion table. Choose one way or return and the total is shown in kilograms and tonnes.",
    inputs: [
      field('distance', 'Distance, one way (km)', 5570, 1, 40000),
      field('factor', 'Emission factor (kg CO2e per passenger-km)', 0.15, 0.01, 1),
      select('trip', 'Trip', 'oneway', [
        ['oneway', 'One way'],
        ['return', 'Return'],
      ]),
    ],
    outputs: [
      { name: 'co2', label: 'CO2 equivalent per passenger', format: 'text', highlight: true },
      { name: 'tonnes', label: 'In tonnes', format: 'text' },
    ],
    calculate: (i) => {
      const kg = toD(i.distance)
        .mul(toD(i.factor))
        .mul(String(i.trip) === 'return' ? 2 : 1);
      return { co2: `${fmtNumber(kg, 1)} kg`, tonnes: `${fmtNumber(kg.div(1000), 3)} t` };
    },
    formulaDescription:
      'Emissions (kg CO2e) = distance × emission factor × trips, with 2 trips for a return journey. The factor is the average kilograms of CO2 equivalent per passenger-kilometre.',
    workedExample: '5,570 km at 0.15 kg per passenger-km is 835.5 kg, or 0.836 tonnes, one way; a return flight doubles it to 1,671 kg.',
    faq: [
      {
        question: 'Where can I find a better emission factor?',
        answer:
          'Government conversion tables and airline calculators publish factors by flight length and seat class. Business and first class are higher because they take more floor space.',
      },
      {
        question: 'Why is a short flight not proportionally lighter?',
        answer:
          'Take-off and climb burn a lot of fuel, so short trips emit more per kilometre than long cruise-dominated ones. A single average factor hides that.',
      },
      { question: 'Do contrails count?', answer: 'Some estimates add a multiplier for non-CO2 effects at altitude. This tool uses only the factor you enter.' },
    ],
    scenarios: rows(
      ['distance', 'factor', 'trip'],
      [
        [800, 0.2, 0],
        [3000, 0.15, 1],
        [9000, 0.13, 0],
        [14000, 0.12, 1],
        [1500, 0.18, 0],
        [6000, 0.14, 1],
      ],
      (v) => `${v[0]} km at ${v[1]} kg per km`,
    ).map((s, k) => ({ ...s, inputs: { ...s.inputs, trip: k % 2 === 0 ? 'oneway' : 'return' } })),
    introOutputs: ['co2'],
    relatedSlugs: ['car-vs-bike-carbon-calculator', 'kaya-identity-calculator'],
    checks: [
      { inputs: {}, expect: { co2: '835.5 kg', tonnes: '0.836 t' } },
      { inputs: { trip: 'return' }, expect: { co2: '1,671 kg', tonnes: '1.671 t' } },
      { inputs: { distance: 1000, factor: 0.2 }, expect: { co2: '200 kg' } },
    ],
  },
  {
    slug: 'solar-panel-calculator',
    category: 'ecology',
    tier: 2,
    subCluster: 'Renewable energy',
    title: 'Solar Panel Calculator: How Many Panels Do You Need',
    h1: 'Solar Panel Calculator',
    metaDescription: 'Size a solar system from your daily electricity use, panel wattage, local peak sun hours and system efficiency.',
    about:
      'To size a solar array, start from how much electricity you use in a day. A panel makes its rated power only in full sun, so its daily output is its rating times the peak sun hours at your location, reduced by losses in the inverter, wiring, dirt and heat. Divide your daily use by that output and round up. Enter the daily kilowatt-hours, the panel rating in watts, the peak sun hours from a solar map and a system efficiency of around 75 to 85 percent. Installers usually add a margin of ten to twenty percent for future demand, such as an electric car or a heat pump, and then check roof space: a 400 W panel covers roughly 1.9 square metres, so 21 of them need about 40 square metres of unshaded roof facing the equator. Off-grid homes go further and size a battery bank for two or three cloudy days, which multiplies the storage cost, so shaving daily use with efficient appliances is often the cheapest step.',
    inputs: [
      field('daily', 'Daily electricity use (kWh)', 30, 0.1, 10000),
      field('watts', 'Panel rating (W)', 400, 50, 1000),
      field('psh', 'Peak sun hours per day', 4.5, 1, 8),
      field('eff', 'System efficiency (%)', 80, 40, 100),
    ],
    outputs: [
      { name: 'panels', label: 'Panels needed', format: 'text', highlight: true },
      { name: 'size', label: 'System size', format: 'text' },
      { name: 'perPanel', label: 'Output per panel', format: 'text' },
    ],
    calculate: (i) => {
      const perPanel = toD(i.watts).div(1000).mul(toD(i.psh)).mul(toD(i.eff)).div(100);
      const panels = toD(i.daily).div(perPanel).ceil();
      return {
        panels: `${fmtNumber(panels, 0)} panels`,
        size: `${fmtNumber(panels.mul(toD(i.watts)).div(1000), 2)} kW`,
        perPanel: `${fmtNumber(perPanel, 2)} kWh/day`,
      };
    },
    formulaDescription:
      'Output per panel = rating (kW) × peak sun hours × efficiency. Panels = daily use ÷ output per panel, rounded up. System size = panels × rating.',
    workedExample:
      'A 400 W panel with 4.5 peak sun hours at 80% gives 0.4 × 4.5 × 0.8 = 1.44 kWh a day. For 30 kWh a day you need 30 ÷ 1.44 = 20.8, so 21 panels, an 8.4 kW system.',
    faq: [
      {
        question: 'What are peak sun hours?',
        answer:
          'The number of hours a day the sun would need to shine at full strength to deliver the same energy as the actual day. Solar maps list them by location and season.',
      },
      {
        question: 'Why include an efficiency figure?',
        answer: 'Inverters, cables, temperature and dirt all waste some energy, typically 15 to 25 percent in total.',
      },
      { question: 'Will it cover all my use?', answer: 'Only on average. Seasons and weather change output, so a grid connection or battery covers the gaps.' },
    ],
    scenarios: rows(
      ['daily', 'watts', 'psh', 'eff'],
      [
        [10, 400, 5, 80],
        [20, 450, 4, 78],
        [45, 550, 5.5, 82],
        [8, 300, 3.5, 75],
        [60, 400, 6, 85],
        [25, 410, 3, 80],
      ],
      (v) => `Using ${v[0]} kWh daily with ${v[1]} W modules in a ${v[2]} sun-hour region`,
    ),
    introOutputs: ['panels'],
    relatedSlugs: ['solar-panel-output-calculator', 'wind-turbine-calculator'],
    checks: [
      { inputs: {}, expect: { panels: '21 panels', size: '8.4 kW', perPanel: '1.44 kWh/day' } },
      { inputs: { daily: 10 }, expect: { panels: '7 panels', size: '2.8 kW' } },
      { inputs: { daily: 14.4 }, expect: { panels: '10 panels', size: '4 kW' } },
    ],
  },
  {
    slug: 'solar-panel-output-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Renewable energy',
    title: 'Solar Panel Output Calculator: Daily, Monthly and Yearly kWh',
    h1: 'Solar Panel Output Calculator',
    metaDescription: 'Estimate the electricity produced by an array from the number of panels, their wattage, peak sun hours and system efficiency.',
    about:
      "If you already have panels, or a quote for a system, the useful question is how much electricity it will make. Count the modules, convert each nameplate rating to kilowatts, then scale by the full-sun hours of your site and by a derating factor for real-world losses. The product is the energy yield per day, and monthly and yearly totals follow from it. Orientation, tilt, shade from chimneys or trees and cell temperature all pull the yield away from the headline number, and microinverters or optimisers limit the damage from partial shade. Real output swings with the seasons, so the yearly figure is an average, and a shaded roof will fall below it. Quote comparisons, payback estimates and feed-in tariff applications all start from the annual figure, which is why it is worth checking a supplier's claim here. Panels also degrade by about half a percent a year, so output in year twenty is roughly a tenth lower, and inverters often need replacing once in that time.",
    inputs: [
      intField('panels', 'Number of panels', 10, 1, 100000),
      field('watts', 'Panel rating (W)', 400, 50, 1000),
      field('psh', 'Peak sun hours per day', 5, 1, 8),
      field('eff', 'System efficiency (%)', 80, 40, 100),
    ],
    outputs: [
      { name: 'daily', label: 'Daily output', format: 'text', highlight: true },
      { name: 'monthly', label: 'Monthly output', format: 'text' },
      { name: 'yearly', label: 'Yearly output', format: 'text' },
    ],
    calculate: (i) => {
      const daily = toD(i.panels).mul(toD(i.watts)).div(1000).mul(toD(i.psh)).mul(toD(i.eff)).div(100);
      return { daily: `${fmtNumber(daily, 2)} kWh`, monthly: `${fmtNumber(daily.mul(30), 1)} kWh`, yearly: `${fmtNumber(daily.mul(365), 0)} kWh` };
    },
    formulaDescription: 'Daily energy = panels × rating (kW) × peak sun hours × efficiency. Monthly = daily × 30. Yearly = daily × 365.',
    workedExample: '10 panels of 400 W with 5 peak sun hours at 80%: 10 × 0.4 × 5 × 0.8 = 16 kWh a day, 480 kWh a month and 5,840 kWh a year.',
    faq: [
      {
        question: 'Is the yearly figure a guarantee?',
        answer:
          'No. It assumes the same sun hours all year. Summer output is higher and winter lower, and panels lose a fraction of a percent of output each year.',
      },
      {
        question: 'How does tilt and direction matter?',
        answer: 'A panel facing the equator at roughly your latitude collects most. East or west roofs lose around 10 to 20 percent.',
      },
      { question: 'Can I compare this with my bill?', answer: 'Yes. Divide your yearly use by the yearly output to see what share the array could cover.' },
    ],
    scenarios: rows(
      ['panels', 'watts', 'psh', 'eff'],
      [
        [20, 400, 4, 80],
        [6, 550, 5.5, 85],
        [30, 410, 3.5, 78],
        [12, 330, 6, 82],
        [8, 450, 4.8, 80],
        [40, 500, 5, 83],
      ],
      (v) => `An array of ${v[0]} panels rated ${v[1]} W under ${v[2]} hours of full sun`,
    ),
    introOutputs: ['daily', 'yearly'],
    relatedSlugs: ['solar-panel-calculator', 'hydroelectric-power-calculator'],
    checks: [
      { inputs: {}, expect: { daily: '16 kWh', monthly: '480 kWh', yearly: '5,840 kWh' } },
      { inputs: { panels: 20, psh: 4 }, expect: { daily: '25.6 kWh', monthly: '768 kWh', yearly: '9,344 kWh' } },
      { inputs: { panels: 1, watts: 1000, psh: 1, eff: 100 }, expect: { daily: '1 kWh', monthly: '30 kWh', yearly: '365 kWh' } },
    ],
  },
  {
    slug: 'wind-turbine-calculator',
    category: 'ecology',
    tier: 2,
    subCluster: 'Renewable energy',
    title: 'Wind Turbine Calculator: Power from Rotor Size and Wind Speed',
    h1: 'Wind Turbine Calculator',
    metaDescription:
      "Estimate a wind turbine's power from rotor diameter, wind speed and power coefficient, along with the swept area and the wind's available power.",
    about:
      'The power in moving air is half the air density times the swept area of the rotor times the cube of the wind speed. The cube is the key: doubling the wind speed multiplies the available power by eight. A turbine captures only a fraction of it, described by the power coefficient, which cannot exceed the Betz limit of about 0.593 and is near 0.35 to 0.45 for good machines. Enter rotor diameter, wind speed and coefficient. Air density is taken as 1.225 kg/m³, the sea-level value.',
    inputs: [
      field('diameter', 'Rotor diameter (m)', 10, 0.5, 250),
      field('speed', 'Wind speed (m/s)', 6, 1, 30),
      field('cp', 'Power coefficient Cp (at most 0.593)', 0.4, 0.05, 0.593),
    ],
    outputs: [
      { name: 'power', label: 'Turbine power', format: 'text', highlight: true },
      { name: 'area', label: 'Swept area', format: 'text' },
      { name: 'available', label: 'Power in the wind', format: 'text' },
    ],
    calculate: (i) => {
      const area = PI.mul(toD(i.diameter).div(2).pow(2));
      const available = area.mul('0.6125').mul(toD(i.speed).pow(3));
      return {
        power: `${fmtNumber(available.mul(toD(i.cp)).div(1000), 2)} kW`,
        area: `${fmtNumber(area, 2)} m²`,
        available: `${fmtNumber(available.div(1000), 2)} kW`,
      };
    },
    formulaDescription:
      'P = ½ × ρ × A × v³ × Cp, with ρ = 1.225 kg/m³, A = π × (d ÷ 2)² and v the wind speed in m/s. Cp is limited by the Betz limit of 16/27 ≈ 0.593.',
    workedExample:
      'A 10 m rotor sweeps 78.54 m². In a 6 m/s wind the air carries 0.5 × 1.225 × 78.54 × 216 = 10.39 kW. At Cp = 0.4 the turbine delivers 4.16 kW.',
    faq: [
      {
        question: 'Why is wind speed so important?',
        answer: 'Power rises with the cube of speed, so a site with 7 m/s winds has about 60 percent more power than one with 6 m/s.',
      },
      {
        question: 'What is the Betz limit?',
        answer:
          'It is the theoretical maximum fraction of wind power any turbine can capture, 59.3 percent, because the air must keep moving to leave the rotor.',
      },
      {
        question: 'Is this the energy I will get in a year?',
        answer:
          "No. This is instantaneous power. Winds vary, so annual energy depends on the wind speed distribution and the turbine's cut-in and rated speeds.",
      },
    ],
    scenarios: rows(
      ['diameter', 'speed', 'cp'],
      [
        [2, 5, 0.35],
        [5, 7, 0.4],
        [20, 8, 0.42],
        [50, 10, 0.45],
        [100, 12, 0.46],
        [3, 4, 0.3],
      ],
      (v) => `${v[0]} m rotor in ${v[1]} m/s wind at Cp ${v[2]}`,
    ),
    introOutputs: ['power'],
    relatedSlugs: ['solar-panel-calculator', 'hydroelectric-power-calculator'],
    checks: [
      { inputs: {}, expect: { power: '4.16 kW', area: '78.54 m²', available: '10.39 kW' } },
      { inputs: { speed: 12 }, expect: { power: '33.25 kW' } },
      { inputs: { diameter: 20 }, expect: { power: '16.63 kW', area: '314.16 m²' } },
    ],
  },
  {
    slug: 'hydroelectric-power-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Renewable energy',
    title: 'Hydroelectric Power Calculator: Flow, Head and Efficiency',
    h1: 'Hydroelectric Power Calculator',
    metaDescription: 'Estimate the electrical power of a small hydro site from water flow, head height and overall efficiency.',
    about:
      'A hydro turbine turns the energy of falling water into electricity. The available power is the density of water times gravity times the flow rate times the head, which is the vertical drop, and the overall efficiency of the turbine and generator takes a share of it. Small run-of-river schemes often reach 70 to 90 percent. Enter the flow in cubic metres per second, the head in metres and the efficiency, and the calculator returns the power and the energy it would make running all day.',
    inputs: [field('flow', 'Flow (m³/s)', 0.5, 0.001, 100000), field('head', 'Head (m)', 20, 0.5, 2000), field('eff', 'Overall efficiency (%)', 85, 10, 100)],
    outputs: [
      { name: 'power', label: 'Electrical power', format: 'text', highlight: true },
      { name: 'daily', label: 'Energy per day at full output', format: 'text' },
    ],
    calculate: (i) => {
      const watts = toD(i.flow).mul(toD(i.head)).mul('9806.65').mul(toD(i.eff)).div(100);
      return { power: `${fmtNumber(watts.div(1000), 2)} kW`, daily: `${fmtNumber(watts.mul(24).div(1000), 1)} kWh` };
    },
    formulaDescription: 'P = ρ × g × Q × H × η, with ρ = 1,000 kg/m³, g = 9.80665 m/s², Q the flow in m³/s, H the head in metres and η the efficiency.',
    workedExample:
      '0.5 m³/s falling 20 m at 85% efficiency: 1,000 × 9.80665 × 0.5 × 20 × 0.85 = 83,357 W, or 83.36 kW, about 2,000.6 kWh a day if the flow never changed.',
    faq: [
      {
        question: 'What is head?',
        answer: 'The vertical height the water falls, measured from the intake to the turbine. Pipe friction reduces the net head a little.',
      },
      {
        question: 'Will the flow stay constant?',
        answer: 'Rarely. Streams vary with the seasons, so use a flow your site can supply for most of the year, and expect less in a dry month.',
      },
      {
        question: 'Do I need a permit?',
        answer: 'Almost always. Diverting water can affect fish and downstream users, and many countries license even small schemes.',
      },
    ],
    scenarios: rows(
      ['flow', 'head', 'eff'],
      [
        [0.05, 30, 70],
        [2, 10, 80],
        [0.2, 50, 82],
        [10, 6, 88],
        [0.01, 100, 65],
        [1, 25, 85],
      ],
      (v) => `${v[0]} m³/s over ${v[1]} m at ${v[2]}%`,
    ),
    introOutputs: ['power'],
    relatedSlugs: ['wind-turbine-calculator', 'solar-panel-output-calculator'],
    checks: [
      { inputs: {}, expect: { power: '83.36 kW', daily: '2,000.6 kWh' } },
      { inputs: { head: 40 }, expect: { power: '166.71 kW' } },
      { inputs: { eff: 100 }, expect: { power: '98.07 kW' } },
    ],
  },
  {
    slug: 'drip-faucet-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Sustainable living',
    title: 'Drip Faucet Calculator: Water Wasted by a Leaking Tap',
    h1: 'Drip Faucet Calculator',
    metaDescription: 'Work out the litres of water lost per day, month and year from a dripping tap using the drips per minute and the size of a drop.',
    about:
      'A tap that drips once a second looks harmless, but the drops add up. Count the drips in one minute, multiply by the volume of a drop, and scale to a day, a month and a year. A typical drop is about 0.05 millilitres, which is the common figure of twenty drops to the millilitre. Enter the drips per minute you counted and change the drop volume if your drips are larger. A new washer usually costs far less than the water that leaks past an old one.',
    inputs: [field('dpm', 'Drips per minute', 60, 0, 10000), field('drop', 'Volume of one drop (mL)', 0.05, 0.01, 1)],
    outputs: [
      { name: 'day', label: 'Water wasted per day', format: 'text', highlight: true },
      { name: 'month', label: 'Per month', format: 'text' },
      { name: 'year', label: 'Per year', format: 'text' },
    ],
    calculate: (i) => {
      const perDay = toD(i.dpm).mul(1440).mul(toD(i.drop)).div(1000);
      return { day: `${fmtNumber(perDay, 2)} L`, month: `${fmtNumber(perDay.mul(30), 1)} L`, year: `${fmtNumber(perDay.mul(365), 1)} L` };
    },
    formulaDescription: 'Litres per day = drips per minute × 1,440 minutes × drop volume (mL) ÷ 1,000. Month = day × 30, year = day × 365.',
    workedExample: 'One drip a second is 60 per minute, or 86,400 a day. At 0.05 mL each that is 4,320 mL, or 4.32 L a day and 1,576.8 L a year.',
    faq: [
      {
        question: 'How do I count the drips?',
        answer: 'Time one minute with a phone and count, or catch the water in a measuring jug for ten minutes and scale up.',
      },
      {
        question: 'Is a drop always 0.05 mL?',
        answer: 'It varies with the tap and the water temperature. Measure a few drops in a graduated container if you want a better value.',
      },
      {
        question: 'Does a hot water leak cost more?',
        answer: 'Yes, because the energy used to heat it is also wasted, though this calculator counts only the water.',
      },
    ],
    scenarios: rows(
      ['dpm', 'drop'],
      [
        [10, 0.05],
        [30, 0.05],
        [120, 0.05],
        [60, 0.1],
        [200, 0.07],
        [5, 0.04],
      ],
      (v) => `${v[0]} drips a minute at ${v[1]} mL`,
    ),
    introOutputs: ['day', 'year'],
    relatedSlugs: ['car-vs-bike-carbon-calculator'],
    checks: [
      { inputs: {}, expect: { day: '4.32 L', month: '129.6 L', year: '1,576.8 L' } },
      { inputs: { dpm: 120 }, expect: { day: '8.64 L', year: '3,153.6 L' } },
      { inputs: { dpm: 10 }, expect: { day: '0.72 L', year: '262.8 L' } },
    ],
  },
  {
    slug: 'logistic-growth-calculator',
    category: 'ecology',
    tier: 2,
    subCluster: 'Population ecology',
    title: 'Logistic Growth Calculator: Population and Carrying Capacity',
    h1: 'Logistic Growth Calculator',
    metaDescription:
      'Project a population under logistic growth from its starting size, growth rate and carrying capacity, and find when it reaches half of capacity.',
    about:
      'Populations cannot grow without limit. The logistic model starts out growing almost exponentially, then slows as resources run short and levels off at the carrying capacity, the largest population the environment can support. The curve is S-shaped and the fastest growth happens when the population is half of capacity. Enter the starting number, the intrinsic growth rate per unit of time, the carrying capacity and the time elapsed. The calculator returns the projected size, the share of capacity reached and the time to reach half of it.',
    inputs: [
      field('k', 'Carrying capacity K', 1000, 1, 1000000000),
      field('n0', 'Starting population N0', 100, 0.001, 1000000000),
      field('r', 'Growth rate r (per time unit)', 0.5, 0.0001, 10),
      field('t', 'Time elapsed', 5, 0, 10000),
    ],
    outputs: [
      { name: 'n', label: 'Population at time t', format: 'text', highlight: true },
      { name: 'share', label: 'Share of capacity', format: 'text' },
      { name: 'half', label: 'Time to reach half of K', format: 'text' },
    ],
    calculate: (i) => {
      const k = toD(i.k);
      const n0 = toD(i.n0);
      if (n0.gte(k)) return { n: 'Start below the carrying capacity', share: '-', half: '-' };
      const ratio = k.minus(n0).div(n0);
      const n = k.div(ratio.mul(toD(i.r).mul(toD(i.t)).neg().exp()).plus(1));
      const half = ratio.ln().div(toD(i.r));
      return { n: fmtNumber(n, 1), share: fmtPercent(n.div(k).mul(100), 1), half: half.lt(0) ? 'Already past half' : fmtNumber(half, 2) };
    },
    formulaDescription:
      'N(t) = K ÷ (1 + ((K − N0) ÷ N0) × e^(−r × t)). Time to reach K/2 = ln((K − N0) ÷ N0) ÷ r. The growth rate at any moment is r × N × (1 − N ÷ K).',
    workedExample:
      'K = 1,000, N0 = 100 and r = 0.5. After 5 time units, e^-2.5 = 0.0821, so N = 1,000 ÷ (1 + 9 × 0.0821) = 575.1, which is 57.5% of capacity. Half of K is reached at ln 9 ÷ 0.5 = 4.39.',
    faq: [
      {
        question: 'What is carrying capacity?',
        answer: 'The maximum population an environment can sustain given food, space and other limits. It can change when conditions change.',
      },
      { question: 'When is growth fastest?', answer: 'At half the carrying capacity, where the logistic curve is steepest.' },
      {
        question: 'Do real populations follow the model?',
        answer: 'Some, such as yeast in a flask, follow it closely. Many overshoot and oscillate because of time lags in the response to crowding.',
      },
    ],
    scenarios: rows(
      ['k', 'n0', 'r', 't'],
      [
        [1000, 100, 0.5, 10],
        [5000, 50, 0.3, 20],
        [200, 10, 1.2, 4],
        [10000, 2000, 0.1, 30],
        [800, 400, 0.4, 5],
        [60, 2, 0.8, 8],
      ],
      (v) => `K ${v[0]}, N0 ${v[1]}, r ${v[2]}, after ${v[3]}`,
    ),
    introOutputs: ['n', 'share'],
    relatedSlugs: ['lotka-volterra-calculator', 'shannon-diversity-index-calculator'],
    checks: [
      { inputs: {}, expect: { n: '575.1', share: '57.5%', half: '4.39' } },
      { inputs: { t: 0 }, expect: { n: '100', share: '10.0%' } },
      { inputs: { n0: 500 }, expect: { half: '0' } },
      { inputs: { n0: 1000 }, expect: { n: 'Start below the carrying capacity' } },
    ],
  },
  {
    slug: 'lotka-volterra-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Population ecology',
    title: 'Lotka-Volterra Calculator: Predator-Prey Rates and Equilibrium',
    h1: 'Lotka-Volterra Calculator',
    metaDescription: 'Find the current rates of change of a predator and prey population and the equilibrium point from the Lotka-Volterra equations.',
    about:
      'The Lotka-Volterra model describes how a predator and its prey rise and fall together. Prey grow on their own at a steady rate and are eaten at a rate proportional to meetings with predators, while predators die off without food and grow when they eat. The two populations cycle round a balance point where neither changes. Enter the current numbers and the four rate parameters, and the calculator returns how fast each is changing now, and where the equilibrium lies.',
    inputs: [
      field('x', 'Prey population x', 10, 0.001, 1000000),
      field('y', 'Predator population y', 10, 0.001, 1000000),
      field('alpha', 'Prey growth rate α', 1.1, 0.0001, 100),
      field('beta', 'Predation rate β', 0.4, 0.0001, 100),
      field('delta', 'Predator gain rate δ', 0.1, 0.0001, 100),
      field('gamma', 'Predator death rate γ', 0.4, 0.0001, 100),
    ],
    outputs: [
      { name: 'dx', label: 'Prey change per time unit', format: 'text', highlight: true },
      { name: 'dy', label: 'Predator change per time unit', format: 'text' },
      { name: 'xEq', label: 'Equilibrium prey', format: 'text' },
      { name: 'yEq', label: 'Equilibrium predators', format: 'text' },
    ],
    calculate: (i) => {
      const x = toD(i.x);
      const y = toD(i.y);
      const dx = toD(i.alpha).mul(x).minus(toD(i.beta).mul(x).mul(y));
      const dy = toD(i.delta).mul(x).mul(y).minus(toD(i.gamma).mul(y));
      return {
        dx: fmtNumber(dx, 3),
        dy: fmtNumber(dy, 3),
        xEq: fmtNumber(toD(i.gamma).div(toD(i.delta)), 3),
        yEq: fmtNumber(toD(i.alpha).div(toD(i.beta)), 3),
      };
    },
    formulaDescription: 'dx/dt = αx − βxy and dy/dt = δxy − γy. Both are zero at the equilibrium x* = γ ÷ δ, y* = α ÷ β.',
    workedExample:
      'With x = y = 10, α = 1.1, β = 0.4, δ = 0.1, γ = 0.4: prey change by 11 − 40 = −29 and predators by 10 − 4 = 6. The equilibrium is x* = 4 prey and y* = 2.75 predators.',
    faq: [
      {
        question: 'Why do the populations cycle?',
        answer:
          'Many prey feed the predators, whose numbers grow and eat the prey down, and then the predators starve. The prey recover and the cycle repeats.',
      },
      {
        question: 'Is equilibrium stable?',
        answer: 'In this simple model, no. Populations orbit it without settling. Adding crowding limits makes the balance stable.',
      },
      {
        question: 'Does it forecast real animals?',
        answer: 'It illustrates the idea, as in the classic lynx and hare records, but real systems have more species, seasons and noise.',
      },
    ],
    scenarios: rows(
      ['x', 'y', 'alpha', 'beta', 'delta', 'gamma'],
      [
        [20, 2, 1.1, 0.4, 0.1, 0.4],
        [4, 2.75, 1.1, 0.4, 0.1, 0.4],
        [50, 10, 0.8, 0.02, 0.01, 0.5],
        [30, 5, 1, 0.1, 0.02, 0.3],
        [8, 15, 0.6, 0.05, 0.03, 0.4],
        [100, 20, 0.5, 0.01, 0.004, 0.2],
      ],
      (v) => `${v[0]} prey and ${v[1]} predators`,
    ),
    introOutputs: ['dx', 'dy'],
    relatedSlugs: ['logistic-growth-calculator', 'shannon-diversity-index-calculator'],
    checks: [
      { inputs: {}, expect: { dx: '-29', dy: '6', xEq: '4', yEq: '2.75' } },
      { inputs: { x: 4, y: 2.75 }, expect: { dx: '0', dy: '0' } },
      { inputs: { x: 20, y: 2 }, expect: { dx: '6', dy: '3.2' } },
    ],
  },
  {
    slug: 'shannon-diversity-index-calculator',
    category: 'ecology',
    tier: 2,
    subCluster: 'Biodiversity',
    title: 'Shannon Diversity Index Calculator with Evenness and Simpson',
    h1: 'Shannon Diversity Index Calculator',
    metaDescription: 'Calculate the Shannon diversity index, Pielou evenness and Simpson diversity from the number of individuals counted of each species.',
    about:
      "Ecologists summarise how diverse a community is with a number that rises with both the number of species and how evenly the individuals are spread among them. The Shannon index does this using logarithms of each species' share of the total. Evenness compares it with the highest value possible for that many species, and the Simpson index gives the chance that two individuals picked at random belong to different species. Type the counts for each species, separated by commas or spaces; species with a count of zero are ignored.",
    inputs: [
      {
        name: 'counts',
        label: 'Individuals counted per species (separated by commas)',
        type: 'text',
        default: '45, 30, 15, 10',
        validator: numberListField(1, 200),
      },
    ],
    outputs: [
      { name: 'h', label: "Shannon index H'", format: 'text', highlight: true },
      { name: 'evenness', label: 'Evenness', format: 'text' },
      { name: 'simpson', label: 'Simpson diversity', format: 'text' },
    ],
    calculate: (i) => {
      const counts = parseNumberList(i.counts).filter((c) => c.gt(0));
      const total = counts.reduce((a, c) => a.plus(c), new D(0));
      if (counts.length === 0) return { h: 'Enter at least one count above zero', evenness: '-', simpson: '-' };
      let h = new D(0);
      let sumSq = new D(0);
      for (const c of counts) {
        const p = c.div(total);
        h = h.minus(p.mul(p.ln()));
        sumSq = sumSq.plus(p.pow(2));
      }
      const evenness = counts.length > 1 ? fmtFixed(h.div(new D(counts.length).ln()), 3) : 'Needs two or more species';
      return { h: fmtFixed(h.isZero() ? new D(0) : h, 3), evenness, simpson: fmtFixed(new D(1).minus(sumSq), 3) };
    },
    formulaDescription: "H' = −Σ pi ln pi, where pi is each species' share of the total. Evenness J = H' ÷ ln S for S species. Simpson diversity = 1 − Σ pi².",
    workedExample:
      "Counts 45, 30, 15 and 10 give shares 0.45, 0.30, 0.15 and 0.10. H' = 1.235, evenness = 1.235 ÷ ln 4 = 0.891, and Simpson diversity = 1 − 0.325 = 0.675.",
    faq: [
      {
        question: 'What is a high Shannon value?',
        answer:
          'There is no fixed scale. Values usually fall between 1.5 and 3.5 in real samples, and they are best used to compare sites, not to judge one alone.',
      },
      { question: 'Does sample size matter?', answer: 'Yes. Small samples miss rare species and bias the index low, so compare samples of similar effort.' },
      {
        question: 'Why use both Shannon and Simpson?',
        answer: 'Shannon is more sensitive to rare species, Simpson to common ones, so they can rank sites differently.',
      },
    ],
    scenarios: ['10, 10, 10, 10', '80, 10, 5, 5', '25, 25, 25, 25, 25', '120, 60, 30, 15, 8, 4', '50, 1', '33, 33, 34'].map((counts) => ({
      label: `Counts of ${counts}`,
      inputs: { counts },
    })),
    introOutputs: ['h'],
    relatedSlugs: ['logistic-growth-calculator', 'kaya-identity-calculator'],
    checks: [
      { inputs: {}, expect: { h: '1.235', evenness: '0.891', simpson: '0.675' } },
      { inputs: { counts: '10, 10, 10, 10' }, expect: { h: '1.386', evenness: '1.000', simpson: '0.750' } },
      { inputs: { counts: '5' }, expect: { h: '0.000', evenness: 'Needs two or more species', simpson: '0.000' } },
    ],
  },
  {
    slug: 'kaya-identity-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Eco footprint',
    title: 'Kaya Identity Calculator: Emissions from Population, GDP and Energy',
    h1: 'Kaya Identity Calculator',
    metaDescription:
      'Break carbon emissions into population, income, energy intensity and carbon intensity with the Kaya identity and see the total in megatonnes of CO2.',
    about:
      "The Kaya identity splits a country's carbon dioxide emissions into four factors that multiply together: how many people there are, how rich each is, how much energy each unit of income takes, and how much carbon each unit of energy emits. It shows where cuts must come from, since people and income usually grow. Enter the population in millions, the income per person in dollars, the energy used per dollar in megajoules, and the carbon emitted per megajoule in kilograms.",
    inputs: [
      field('pop', 'Population (millions)', 1000, 0.001, 100000),
      field('gdp', 'Income per person ($ per year)', 20000, 1, 10000000),
      field('intensity', 'Energy intensity (MJ per $)', 5, 0.01, 1000),
      field('carbon', 'Carbon intensity (kg CO2 per MJ)', 0.06, 0.001, 1),
    ],
    outputs: [
      { name: 'total', label: 'Total emissions', format: 'text', highlight: true },
      { name: 'perPerson', label: 'Per person', format: 'text' },
    ],
    calculate: (i) => {
      const perPerson = toD(i.gdp).mul(toD(i.intensity)).mul(toD(i.carbon)).div(1000);
      return { total: `${fmtNumber(perPerson.mul(toD(i.pop)), 0)} Mt CO2`, perPerson: `${fmtNumber(perPerson, 2)} t CO2` };
    },
    formulaDescription:
      'CO2 = population × (GDP ÷ population) × (energy ÷ GDP) × (CO2 ÷ energy). With population in millions, the total in megatonnes is population × income × energy intensity × carbon intensity ÷ 1,000.',
    workedExample:
      '1,000 million people at $20,000 each, using 5 MJ per $ at 0.06 kg CO2 per MJ: each person emits 20,000 × 5 × 0.06 ÷ 1,000 = 6 t, so the total is 6,000 Mt CO2.',
    faq: [
      {
        question: 'Which factor can fall fastest?',
        answer:
          'Carbon intensity, by switching from coal and gas to renewables and nuclear. Energy intensity falls through efficiency. Income and population usually rise.',
      },
      {
        question: 'Is it a forecast?',
        answer: 'No, it is an accounting identity. It always balances, so it shows how emissions break down, not what will happen.',
      },
      {
        question: 'Where do I find the inputs?',
        answer: 'National statistics offices and the IEA publish energy use per unit of GDP and the emission factor of the energy mix.',
      },
    ],
    scenarios: rows(
      ['pop', 'gdp', 'intensity', 'carbon'],
      [
        [330, 65000, 4, 0.055],
        [1400, 12000, 6, 0.08],
        [67, 42000, 2.5, 0.04],
        [200, 8000, 5.5, 0.05],
        [25, 55000, 5, 0.06],
        [140, 11000, 7, 0.065],
      ],
      (v) => `${v[0]} million people at $${v[1]} each`,
    ),
    introOutputs: ['total'],
    relatedSlugs: ['flight-carbon-footprint-calculator', 'car-vs-bike-carbon-calculator'],
    checks: [
      { inputs: {}, expect: { total: '6,000 Mt CO2', perPerson: '6 t CO2' } },
      { inputs: { pop: 500 }, expect: { total: '3,000 Mt CO2' } },
      { inputs: { pop: 200, gdp: 10000, intensity: 4, carbon: 0.05 }, expect: { total: '400 Mt CO2', perPerson: '2 t CO2' } },
    ],
  },
  {
    slug: 'car-vs-bike-carbon-calculator',
    category: 'ecology',
    tier: 3,
    subCluster: 'Sustainable living',
    title: 'Car vs Bike Carbon Calculator: CO2 Saved by Cycling',
    h1: 'Car vs Bike Carbon Calculator',
    metaDescription: 'Estimate the fuel burned and CO2 emitted by driving a regular trip instead of cycling it, from distance, days per year and fuel economy.',
    about:
      "Replacing a short regular car trip with a bicycle is one of the simplest ways to cut personal emissions, and the saving is easy to estimate. Multiply the distance by the days you travel to get the yearly kilometres, convert to litres of fuel with your car's consumption, then to CO2 with the emissions of a litre of fuel, about 2.3 kilograms for petrol. The result is the yearly CO2 you would avoid by cycling. It does not count the food energy a cyclist uses or the lifetime emissions of vehicles.",
    inputs: [
      field('km', 'Trip distance, each day (km)', 10, 0.1, 1000),
      field('days', 'Days per year', 250, 1, 366),
      field('economy', 'Fuel use (litres per 100 km)', 7.5, 1, 40),
      field('factor', 'CO2 per litre of fuel (kg)', 2.31, 0.5, 4),
    ],
    outputs: [
      { name: 'co2', label: 'CO2 avoided per year', format: 'text', highlight: true },
      { name: 'fuel', label: 'Fuel saved per year', format: 'text' },
      { name: 'distance', label: 'Distance per year', format: 'text' },
    ],
    calculate: (i) => {
      const km = toD(i.km).mul(toD(i.days));
      const litres = km.mul(toD(i.economy)).div(100);
      return { co2: `${fmtNumber(litres.mul(toD(i.factor)), 1)} kg`, fuel: `${fmtNumber(litres, 1)} L`, distance: `${fmtNumber(km, 0)} km` };
    },
    formulaDescription:
      'Yearly distance = trip distance × days. Fuel = distance × litres per 100 km ÷ 100. CO2 = fuel × kg CO2 per litre (about 2.31 for petrol).',
    workedExample: '10 km a day for 250 days is 2,500 km. At 7.5 L per 100 km that is 187.5 L of fuel, and at 2.31 kg per litre it comes to 433.1 kg of CO2.',
    faq: [
      {
        question: 'What is the emission factor for diesel?',
        answer: 'It is higher per litre, about 2.6 kg, because diesel is denser. Enter your own value for diesel or for another fuel.',
      },
      {
        question: 'Does cycling have no emissions at all?',
        answer: "Not quite. The food a cyclist eats and the bike's manufacture cause some, but they are far below a car's per kilometre.",
      },
      {
        question: 'What about electric cars?',
        answer: 'Set the economy to the energy used per 100 km times your grid factor, or use a very low value for a clean grid.',
      },
    ],
    scenarios: rows(
      ['km', 'days', 'economy', 'factor'],
      [
        [5, 220, 8, 2.31],
        [20, 230, 6.5, 2.31],
        [3, 300, 9, 2.31],
        [15, 250, 5.5, 2.6],
        [8, 180, 10, 2.31],
        [30, 220, 7, 2.6],
      ],
      (v) => `${v[0]} km on ${v[1]} days at ${v[2]} L per 100 km`,
    ),
    introOutputs: ['co2'],
    relatedSlugs: ['flight-carbon-footprint-calculator', 'kaya-identity-calculator', 'drip-faucet-calculator'],
    checks: [
      { inputs: {}, expect: { co2: '433.1 kg', fuel: '187.5 L', distance: '2,500 km' } },
      { inputs: { km: 20 }, expect: { co2: '866.3 kg' } },
      { inputs: { economy: 5, days: 200 }, expect: { co2: '231 kg', fuel: '100 L' } },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
