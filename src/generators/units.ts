import { numberField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { capitalise, fmtSig, hash32, isShort, lcg, parseFactor, pick } from '../lib/gen-utils';
import type { CalculatorConfig, Tier } from '../lib/types';

/**
 * Prompt 5, units.ts: every pairwise conversion inside ten unit families. Each pair is its own page with
 * its own slug, copy, formula and worked example. Nothing here is published by itself: a page is live
 * only when its cohort flag is on (cohort N is tier N). The most common pairs are Tier 2, the rest Tier 3.
 */

interface Unit {
  /** Slug token: kg-to-pounds uses "kg" and "pounds". */
  slug: string;
  singular: string;
  plural: string;
  abbr: string;
  /** Size of one of this unit in the family's base unit, written as an exact factor expression. */
  factor: string;
  /** One sentence about the unit. Used on pages where this is the target unit. */
  fact: string;
}

interface Family {
  key: string;
  noun: string;
  units: Unit[];
  /** The pairs people actually search for (both directions are Tier 2); every other pair is Tier 3. */
  popular: [string, string][];
  /** Two or three sentences on why people convert in this family; one is chosen per page. */
  uses: string[];
  defaultValue: number;
}

const u = (slug: string, singular: string, plural: string, abbr: string, factor: string, fact: string): Unit => ({
  slug,
  singular,
  plural,
  abbr,
  factor,
  fact,
});

const LENGTH: Family = {
  key: 'length',
  noun: 'length',
  defaultValue: 10,
  popular: [
    ['cm', 'inches'],
    ['meters', 'feet'],
    ['km', 'miles'],
    ['inches', 'feet'],
    ['yards', 'meters'],
    ['mm', 'inches'],
    ['feet', 'inches'],
    ['miles', 'feet'],
  ],
  uses: [
    'Length conversions come up when plans, product sizes or distances are written in one system and your tape measure or map uses the other.',
    'People most often convert lengths for travel distances, clothing and furniture sizes, building plans, screen dimensions and school science work.',
    'A length in the wrong unit is an easy mistake in woodworking, sewing and online shopping, which is why a checked conversion saves returns.',
  ],
  units: [
    u('mm', 'millimeter', 'millimeters', 'mm', '0.001', 'A millimeter is one thousandth of a meter, roughly the thickness of ten sheets of printer paper.'),
    u('cm', 'centimeter', 'centimeters', 'cm', '0.01', 'A centimeter is one hundredth of a meter, about the width of a fingernail.'),
    u(
      'meters',
      'meter',
      'meters',
      'm',
      '1',
      'The meter is the SI base unit of length, defined by the distance light travels in a vacuum in 1/299,792,458 of a second.',
    ),
    u('km', 'kilometer', 'kilometers', 'km', '1000', 'A kilometer is 1,000 meters, the standard unit for road distances in most countries.'),
    u('inches', 'inch', 'inches', 'in', '0.0254', 'The inch is the imperial unit of length, defined since 1959 as exactly 25.4 millimeters.'),
    u(
      'feet',
      'foot',
      'feet',
      'ft',
      '0.3048',
      'A foot is 12 inches, or exactly 0.3048 meters, and is still the standard unit for heights in the United States.',
    ),
    u('yards', 'yard', 'yards', 'yd', '0.9144', 'A yard is 3 feet, or exactly 0.9144 meters, used for fabric, sports fields and some road signs.'),
    u(
      'miles',
      'mile',
      'miles',
      'mi',
      '1609.344',
      'The statute mile is 5,280 feet, or exactly 1,609.344 meters, used for road distances in the United States and the United Kingdom.',
    ),
    u(
      'nautical-miles',
      'nautical mile',
      'nautical miles',
      'nmi',
      '1852',
      'A nautical mile is exactly 1,852 meters, close to one minute of latitude, and is used in sea and air navigation.',
    ),
  ],
};

const WEIGHT: Family = {
  key: 'weight',
  noun: 'weight and mass',
  defaultValue: 10,
  popular: [
    ['kg', 'pounds'],
    ['pounds', 'kg'],
    ['grams', 'ounces'],
    ['ounces', 'grams'],
    ['stone', 'pounds'],
    ['stone', 'kg'],
    ['mg', 'grams'],
    ['tonnes', 'kg'],
  ],
  uses: [
    'Weight conversions matter for cooking, postage, luggage allowances, body weight and anything bought by the pound or the kilogram.',
    'Recipes, shipping labels and fitness trackers rarely agree on units, so most people convert weights several times a year.',
    'A mass written in the wrong unit can mean the wrong amount of an ingredient or the wrong shipping bracket, so the factor matters.',
  ],
  units: [
    u(
      'mg',
      'milligram',
      'milligrams',
      'mg',
      '0.000001',
      'A milligram is one thousandth of a gram, the scale on which medicine doses and vitamins are usually labeled.',
    ),
    u(
      'grams',
      'gram',
      'grams',
      'g',
      '0.001',
      'The gram is one thousandth of a kilogram, and the usual unit for food labels and kitchen scales outside the United States.',
    ),
    u(
      'kg',
      'kilogram',
      'kilograms',
      'kg',
      '1',
      'The kilogram is the SI base unit of mass, defined since 2019 through the Planck constant rather than a physical object.',
    ),
    u('tonnes', 'metric tonne', 'metric tonnes', 't', '1000', 'A metric tonne is 1,000 kilograms, the unit used for cargo, crops and vehicle weight.'),
    u(
      'ounces',
      'ounce',
      'ounces',
      'oz',
      '0.028349523125',
      'The avoirdupois ounce is one sixteenth of a pound, exactly 28.349523125 grams, used for food portions and postage in the United States.',
    ),
    u(
      'pounds',
      'pound',
      'pounds',
      'lb',
      '0.45359237',
      'The international pound is exactly 0.45359237 kilograms and is the everyday weight unit in the United States.',
    ),
    u(
      'stone',
      'stone',
      'stone',
      'st',
      '6.35029318',
      'A stone is 14 pounds, about 6.35 kilograms, and is still used for body weight in the United Kingdom and Ireland.',
    ),
    u(
      'us-tons',
      'US ton',
      'US tons',
      'short ton',
      '907.18474',
      'The US short ton is 2,000 pounds, about 907.18 kilograms, and is the ton used in American freight and construction.',
    ),
  ],
};

const VOLUME: Family = {
  key: 'volume',
  noun: 'volume',
  defaultValue: 10,
  popular: [
    ['liters', 'gallons'],
    ['gallons', 'liters'],
    ['ml', 'fluid-ounces'],
    ['cups', 'ml'],
    ['cups', 'tablespoons'],
    ['tablespoons', 'teaspoons'],
    ['quarts', 'liters'],
    ['fluid-ounces', 'ml'],
  ],
  uses: [
    'Volume conversions are most useful in the kitchen, at the fuel pump, and when comparing bottle, tank and container sizes.',
    'Recipes from different countries use cups, spoons and milliliters, and a wrong conversion changes a dish or a dose.',
    'Whether you are filling an aquarium, mixing a cleaning solution or reading a recipe, the same liquid has a different number in each unit.',
  ],
  units: [
    u(
      'ml',
      'milliliter',
      'milliliters',
      'mL',
      '0.001',
      'A milliliter is one thousandth of a liter, which is one cubic centimeter, about a fifth of a teaspoon.',
    ),
    u('liters', 'liter', 'liters', 'L', '1', 'The liter is 1,000 milliliters, or one cubic decimeter, and is the everyday metric unit for drinks and fuel.'),
    u(
      'cubic-meters',
      'cubic meter',
      'cubic meters',
      'm³',
      '1000',
      'A cubic meter is 1,000 liters, the SI unit of volume, used for water supply, concrete and room volumes.',
    ),
    u('teaspoons', 'US teaspoon', 'US teaspoons', 'tsp', '0.00492892159375', 'The US teaspoon is one third of a tablespoon, about 4.93 milliliters.'),
    u('tablespoons', 'US tablespoon', 'US tablespoons', 'tbsp', '0.01478676478125', 'The US tablespoon is half a fluid ounce, about 14.79 milliliters.'),
    u(
      'fluid-ounces',
      'US fluid ounce',
      'US fluid ounces',
      'fl oz',
      '0.0295735295625',
      'The US fluid ounce is one 128th of a US gallon, about 29.57 milliliters, and is a unit of volume, not weight.',
    ),
    u(
      'cups',
      'US cup',
      'US cups',
      'cup',
      '0.2365882365',
      'The US customary cup is 8 fluid ounces, about 236.59 milliliters, the standard measure in American recipes.',
    ),
    u('pints', 'US pint', 'US pints', 'pt', '0.473176473', 'The US liquid pint is 16 fluid ounces, about 473.18 milliliters.'),
    u('quarts', 'US quart', 'US quarts', 'qt', '0.946352946', 'The US liquid quart is a quarter of a gallon, about 946.35 milliliters.'),
    u(
      'gallons',
      'US gallon',
      'US gallons',
      'gal',
      '3.785411784',
      'The US gallon is exactly 231 cubic inches, or 3.785411784 liters, and is the unit for fuel in the United States.',
    ),
    u(
      'imperial-gallons',
      'imperial gallon',
      'imperial gallons',
      'imp gal',
      '4.54609',
      'The imperial gallon is exactly 4.54609 liters, about 20 percent larger than the US gallon, used in the United Kingdom.',
    ),
  ],
};

const AREA: Family = {
  key: 'area',
  noun: 'area',
  defaultValue: 10,
  popular: [
    ['sq-meters', 'sq-feet'],
    ['sq-feet', 'sq-meters'],
    ['acres', 'hectares'],
    ['hectares', 'acres'],
    ['sq-km', 'sq-miles'],
    ['sq-feet', 'sq-yards'],
    ['acres', 'sq-feet'],
    ['sq-miles', 'acres'],
  ],
  uses: [
    'Area conversions matter for property listings, flooring and paint estimates, farmland and any plan that mixes metric and imperial sizes.',
    'Land is sold by the acre in some countries and by the hectare in others, and room sizes in square feet or square meters, so conversions come up in every move.',
    'Because areas are squared, the numbers change faster than lengths do, and an error in the factor is easy to miss without a check.',
  ],
  units: [
    u(
      'sq-cm',
      'square centimeter',
      'square centimeters',
      'cm²',
      '0.0001',
      'A square centimeter is a square 1 centimeter on each side, one ten-thousandth of a square meter.',
    ),
    u('sq-meters', 'square meter', 'square meters', 'm²', '1', 'The square meter is the SI unit of area, a square 1 meter on each side.'),
    u(
      'sq-km',
      'square kilometer',
      'square kilometers',
      'km²',
      '1000000',
      'A square kilometer is one million square meters, or 100 hectares, used for countries, lakes and large estates.',
    ),
    u(
      'hectares',
      'hectare',
      'hectares',
      'ha',
      '10000',
      'A hectare is 10,000 square meters, a square about 100 meters on a side, used for farmland and forestry.',
    ),
    u(
      'sq-inches',
      'square inch',
      'square inches',
      'in²',
      '0.00064516',
      'A square inch is exactly 6.4516 square centimeters, used for small parts, screens and tire pressure.',
    ),
    u(
      'sq-feet',
      'square foot',
      'square feet',
      'ft²',
      '0.09290304',
      'A square foot is exactly 0.09290304 square meters, the standard unit for floor space in the United States.',
    ),
    u(
      'sq-yards',
      'square yard',
      'square yards',
      'yd²',
      '0.83612736',
      'A square yard is 9 square feet, exactly 0.83612736 square meters, used for carpet and turf.',
    ),
    u(
      'acres',
      'acre',
      'acres',
      'ac',
      '4046.8564224',
      'An acre is 43,560 square feet, about 4,046.86 square meters, the traditional unit for land in the United States.',
    ),
    u(
      'sq-miles',
      'square mile',
      'square miles',
      'mi²',
      '2589988.110336',
      'A square mile is 640 acres, about 2.59 square kilometers, used for cities and counties.',
    ),
  ],
};

const SPEED: Family = {
  key: 'speed',
  noun: 'speed',
  defaultValue: 10,
  popular: [
    ['mph', 'kph'],
    ['kph', 'mph'],
    ['mps', 'kph'],
    ['kph', 'mps'],
    ['knots', 'mph'],
    ['mph', 'knots'],
  ],
  uses: [
    'Speed conversions are needed for road trips abroad, sports statistics, weather reports and anyone comparing a speed limit with a car dashboard.',
    'Pilots and sailors use knots, drivers use miles or kilometers per hour, and physics uses meters per second, so every field needs a bridge between them.',
  ],
  units: [
    u(
      'mps',
      'meter per second',
      'meters per second',
      'm/s',
      '1',
      'A meter per second is the SI unit of speed, about 3.6 kilometers per hour, and is the unit used in physics problems.',
    ),
    u(
      'kph',
      'kilometer per hour',
      'kilometers per hour',
      'km/h',
      '1000/3600',
      'Kilometers per hour is the road speed unit in most countries, and one kilometer per hour is 5/18 of a meter per second.',
    ),
    u(
      'mph',
      'mile per hour',
      'miles per hour',
      'mph',
      '1609.344/3600',
      'Miles per hour is the road speed unit in the United States and the United Kingdom, equal to exactly 0.44704 meters per second.',
    ),
    u(
      'knots',
      'knot',
      'knots',
      'kn',
      '1852/3600',
      'A knot is one nautical mile per hour, about 1.852 kilometers per hour, used for ships, aircraft and wind speed.',
    ),
    u(
      'fps',
      'foot per second',
      'feet per second',
      'ft/s',
      '0.3048',
      'A foot per second is exactly 0.3048 meters per second, used for projectile speeds and some engineering work.',
    ),
  ],
};

const TIME: Family = {
  key: 'time',
  noun: 'time',
  defaultValue: 10,
  popular: [
    ['hours', 'minutes'],
    ['minutes', 'seconds'],
    ['days', 'hours'],
    ['weeks', 'days'],
    ['seconds', 'minutes'],
    ['minutes', 'hours'],
    ['hours', 'days'],
    ['days', 'weeks'],
  ],
  uses: [
    'Time conversions help with scheduling, billing by the hour, video and audio lengths, and counting down to deadlines.',
    'Contracts, timesheets and project plans each count time in different units, so a clean conversion avoids arithmetic slips.',
    'A duration in seconds is easy for a computer and hard for a person, which is why so many people look up the conversion.',
  ],
  units: [
    u(
      'ms',
      'millisecond',
      'milliseconds',
      'ms',
      '0.001',
      'A millisecond is one thousandth of a second, the scale used for network delays and animation timing.',
    ),
    u('seconds', 'second', 'seconds', 's', '1', 'The second is the SI base unit of time, defined by the radiation of a caesium-133 atom.'),
    u('minutes', 'minute', 'minutes', 'min', '60', 'A minute is exactly 60 seconds, the shortest unit most people schedule by.'),
    u('hours', 'hour', 'hours', 'h', '3600', 'An hour is 60 minutes or 3,600 seconds, the basic unit for work shifts and travel times.'),
    u('days', 'day', 'days', 'd', '86400', 'A day is defined here as 24 hours or 86,400 seconds, ignoring leap seconds and daylight saving shifts.'),
    u('weeks', 'week', 'weeks', 'wk', '604800', 'A week is 7 days or 604,800 seconds, the planning cycle for most calendars and pay periods.'),
    u(
      'years',
      'year',
      'years',
      'yr',
      '31557600',
      'A year here is the Julian year of exactly 365.25 days, or 31,557,600 seconds, so calendar years may differ by a day.',
    ),
  ],
};

const DIGITAL: Family = {
  key: 'digital-storage',
  noun: 'digital storage',
  defaultValue: 10,
  popular: [
    ['gigabytes', 'megabytes'],
    ['megabytes', 'gigabytes'],
    ['terabytes', 'gigabytes'],
    ['gigabytes', 'terabytes'],
    ['bytes', 'kilobytes'],
    ['kilobytes', 'megabytes'],
    ['megabytes', 'kilobytes'],
    ['gibibytes', 'gigabytes'],
  ],
  uses: [
    'Storage conversions help when comparing a phone plan, a hard drive, a download size and a cloud quota that each use different prefixes.',
    'Disk makers count in powers of 1,000 while many operating systems count in powers of 1,024, so the same drive can show two different sizes.',
  ],
  units: [
    u('bits', 'bit', 'bits', 'bit', '1', 'A bit is the smallest unit of digital information, a single 0 or 1, and is used for network speeds.'),
    u('bytes', 'byte', 'bytes', 'B', '8', 'A byte is 8 bits, enough to store one character of basic text.'),
    u('kilobytes', 'kilobyte', 'kilobytes', 'KB', '8000', 'A kilobyte is 1,000 bytes in the decimal (SI) system, the size of a short text file.'),
    u(
      'megabytes',
      'megabyte',
      'megabytes',
      'MB',
      '8000000',
      'A megabyte is 1,000,000 bytes in the decimal system, about the size of a short song at low quality.',
    ),
    u(
      'gigabytes',
      'gigabyte',
      'gigabytes',
      'GB',
      '8000000000',
      'A gigabyte is 1,000,000,000 bytes in the decimal system, the unit used for data plans and phone storage.',
    ),
    u('terabytes', 'terabyte', 'terabytes', 'TB', '8000000000000', 'A terabyte is 1,000 gigabytes in the decimal system, the usual size label on hard drives.'),
    u(
      'kibibytes',
      'kibibyte',
      'kibibytes',
      'KiB',
      '8192',
      'A kibibyte is 1,024 bytes in the binary (IEC) system, the unit that older software called a kilobyte.',
    ),
    u('mebibytes', 'mebibyte', 'mebibytes', 'MiB', '8388608', 'A mebibyte is 1,048,576 bytes, or 1,024 kibibytes, in the binary system.'),
    u(
      'gibibytes',
      'gibibyte',
      'gibibytes',
      'GiB',
      '8589934592',
      'A gibibyte is 1,073,741,824 bytes, or 1,024 mebibytes, which operating systems often display as a gigabyte.',
    ),
    u(
      'tebibytes',
      'tebibyte',
      'tebibytes',
      'TiB',
      '8796093022208',
      'A tebibyte is 1,024 gibibytes in the binary system, about 10 percent more than a decimal terabyte.',
    ),
  ],
};

const PRESSURE: Family = {
  key: 'pressure',
  noun: 'pressure',
  defaultValue: 10,
  popular: [
    ['psi', 'bar'],
    ['bar', 'psi'],
    ['psi', 'kilopascals'],
    ['kilopascals', 'psi'],
    ['atmospheres', 'pascals'],
    ['mmhg', 'kilopascals'],
    ['atmospheres', 'psi'],
  ],
  uses: [
    'Pressure conversions matter for tire and pump gauges, weather reports, scuba diving, plumbing and blood pressure readings.',
    'Gauges and manuals use psi, bar, kilopascals or millimeters of mercury, so a pump or a part can be specified in a unit your gauge does not show.',
  ],
  units: [
    u(
      'pascals',
      'pascal',
      'pascals',
      'Pa',
      '1',
      'The pascal is the SI unit of pressure, one newton of force per square meter, a very small amount usually quoted in kilopascals.',
    ),
    u(
      'kilopascals',
      'kilopascal',
      'kilopascals',
      'kPa',
      '1000',
      'A kilopascal is 1,000 pascals, the unit used for tire pressure and weather in much of the world.',
    ),
    u('bar', 'bar', 'bar', 'bar', '100000', 'A bar is exactly 100,000 pascals, a little under standard atmospheric pressure, used in engineering and diving.'),
    u(
      'psi',
      'pound per square inch',
      'pounds per square inch',
      'psi',
      '4.4482216152605/0.00064516',
      'Pounds per square inch is the US unit for tire and pipe pressure, about 6,894.76 pascals.',
    ),
    u(
      'atmospheres',
      'atmosphere',
      'atmospheres',
      'atm',
      '101325',
      'The standard atmosphere is exactly 101,325 pascals, the average air pressure at sea level.',
    ),
    u(
      'mmhg',
      'millimeter of mercury',
      'millimeters of mercury',
      'mmHg',
      '133.322387415',
      'A millimeter of mercury is about 133.32 pascals and is the unit used for blood pressure readings.',
    ),
    u(
      'inhg',
      'inch of mercury',
      'inches of mercury',
      'inHg',
      '25.4*133.322387415',
      'An inch of mercury is 25.4 millimeters of mercury, about 3,386.39 pascals, used in aviation and US weather reports.',
    ),
  ],
};

const ENERGY: Family = {
  key: 'energy',
  noun: 'energy',
  defaultValue: 10,
  popular: [
    ['kcal', 'kilojoules'],
    ['kilojoules', 'kcal'],
    ['kwh', 'joules'],
    ['kwh', 'btu'],
    ['btu', 'kwh'],
    ['calories', 'joules'],
    ['joules', 'calories'],
    ['kcal', 'calories'],
  ],
  uses: [
    'Energy conversions are needed for food labels, electricity bills, heating and cooling ratings and physics homework.',
    'Food is labeled in calories or kilojoules, power companies bill in kilowatt-hours, and heaters are rated in BTUs, so comparing them takes a conversion.',
  ],
  units: [
    u('joules', 'joule', 'joules', 'J', '1', 'The joule is the SI unit of energy, the work done by a force of one newton over one meter.'),
    u(
      'kilojoules',
      'kilojoule',
      'kilojoules',
      'kJ',
      '1000',
      'A kilojoule is 1,000 joules, the unit on food labels in Australia, New Zealand and much of Europe.',
    ),
    u(
      'calories',
      'calorie',
      'calories',
      'cal',
      '4.184',
      'The thermochemical calorie is exactly 4.184 joules, the heat that warms one gram of water by about one degree Celsius.',
    ),
    u(
      'kcal',
      'kilocalorie',
      'kilocalories',
      'kcal',
      '4184',
      'A kilocalorie is 1,000 calories, exactly 4,184 joules, and is what a food label means by Calorie with a capital C.',
    ),
    u('wh', 'watt-hour', 'watt-hours', 'Wh', '3600', 'A watt-hour is 3,600 joules, the energy of one watt running for an hour, and the unit for batteries.'),
    u('kwh', 'kilowatt-hour', 'kilowatt-hours', 'kWh', '3600000', 'A kilowatt-hour is 3.6 million joules, the unit on household electricity bills.'),
    u(
      'btu',
      'BTU',
      'BTU',
      'BTU',
      '1055.05585262',
      'The British thermal unit (International Table) is about 1,055.06 joules and is used to rate heaters and air conditioners.',
    ),
    u(
      'foot-pounds',
      'foot-pound',
      'foot-pounds',
      'ft·lbf',
      '1.3558179483314',
      'A foot-pound of energy is about 1.3558 joules, used for ballistics and in US torque and work problems.',
    ),
  ],
};

const FAMILIES: Family[] = [LENGTH, WEIGHT, VOLUME, AREA, SPEED, TIME, DIGITAL, PRESSURE, ENERGY];

/** Hand-written pages that already cover a pair. The generator skips them so a slug is never defined twice. */
export const HANDWRITTEN_PAIRS: ReadonlySet<string> = new Set(['cm-to-inches']);

interface TempUnit {
  slug: string;
  singular: string;
  plural: string;
  abbr: string;
  min: number;
  fact: string;
  defaultValue: number;
  toKelvin: (v: Dec) => Dec;
  fromKelvin: (k: Dec) => Dec;
}

const TEMPS: TempUnit[] = [
  {
    slug: 'celsius',
    singular: 'degree Celsius',
    plural: 'degrees Celsius',
    abbr: '°C',
    min: -273.15,
    defaultValue: 25,
    fact: "The Celsius scale sets water's freezing point at 0 and its boiling point at 100 at sea level, and is used for weather in most countries.",
    toKelvin: (v) => v.plus('273.15'),
    fromKelvin: (k) => k.minus('273.15'),
  },
  {
    slug: 'fahrenheit',
    singular: 'degree Fahrenheit',
    plural: 'degrees Fahrenheit',
    abbr: '°F',
    min: -459.67,
    defaultValue: 77,
    fact: "The Fahrenheit scale puts water's freezing point at 32 and its boiling point at 212, and is used for weather and cooking in the United States.",
    toKelvin: (v) => v.plus('459.67').mul(5).div(9),
    fromKelvin: (k) => k.mul(9).div(5).minus('459.67'),
  },
  {
    slug: 'kelvin',
    singular: 'kelvin',
    plural: 'kelvins',
    abbr: 'K',
    min: 0,
    defaultValue: 300,
    fact: 'The kelvin is the SI unit of temperature, with zero at absolute zero, and is the scale used in physics and chemistry.',
    toKelvin: (v) => v,
    fromKelvin: (k) => k,
  },
];

const TEMP_FORMULA: Record<string, string> = {
  'celsius>fahrenheit': '°F = °C × 9/5 + 32',
  'fahrenheit>celsius': '°C = (°F − 32) × 5/9',
  'celsius>kelvin': 'K = °C + 273.15',
  'kelvin>celsius': '°C = K − 273.15',
  'fahrenheit>kelvin': 'K = (°F + 459.67) × 5/9',
  'kelvin>fahrenheit': '°F = K × 9/5 − 459.67',
};

const tierFor = (popular: boolean): Tier => (popular ? 2 : 3);

/** A converter is a pure function value -> value plus the words used to describe it. */
interface Pair {
  family: string;
  noun: string;
  from: { slug: string; singular: string; plural: string; abbr: string };
  to: { slug: string; singular: string; plural: string; abbr: string; fact: string };
  convert: (value: Dec) => Dec;
  /** The opposite conversion, to -> from. */
  back: (value: Dec) => Dec;
  /** Exact scale factor, or null for temperature, which has an offset. */
  factor: Dec | null;
  formulaText: string;
  min: number;
  defaultValue: number;
  tier: Tier;
  uses: string[];
}

const toFamilyPairs = (family: Family): Pair[] => {
  const pairs: Pair[] = [];
  const popular = new Set(family.popular.map(([a, b]) => `${a}>${b}`));
  for (const from of family.units) {
    for (const to of family.units) {
      if (from === to) continue;
      const slug = `${from.slug}-to-${to.slug}`;
      if (HANDWRITTEN_PAIRS.has(slug)) continue;
      const factor = parseFactor(from.factor).div(parseFactor(to.factor));
      pairs.push({
        family: family.key,
        noun: family.noun,
        from,
        to,
        convert: (v) => v.mul(factor),
        back: (v) => v.div(factor),
        factor,
        formulaText: `${to.plural} = ${from.plural} × ${fmtSig(factor, 10)}`,
        min: 0,
        defaultValue: family.defaultValue,
        tier: tierFor(popular.has(`${from.slug}>${to.slug}`)),
        uses: family.uses,
      });
    }
  }
  return pairs;
};

const toTempPairs = (): Pair[] => {
  const pairs: Pair[] = [];
  const popular = new Set(['celsius>fahrenheit', 'fahrenheit>celsius', 'celsius>kelvin', 'kelvin>celsius']);
  for (const from of TEMPS) {
    for (const to of TEMPS) {
      if (from === to) continue;
      const key = `${from.slug}>${to.slug}`;
      pairs.push({
        family: 'temperature',
        noun: 'temperature',
        from,
        to,
        convert: (v) => to.fromKelvin(from.toKelvin(v)),
        back: (v) => from.fromKelvin(to.toKelvin(v)),
        factor: null,
        formulaText: TEMP_FORMULA[key],
        min: from.min,
        defaultValue: from.defaultValue,
        tier: tierFor(popular.has(key)),
        uses: [
          'Temperature conversions are needed for recipes, weather forecasts abroad, oven settings, laboratory work and travel packing.',
          'Weather apps, ovens and science textbooks use different scales, and a temperature conversion has an offset as well as a scale, so it cannot be done by a single multiplication.',
        ],
      });
    }
  }
  return pairs;
};

/** Eight input values that are specific to a pair, so no two pages print the same reference numbers. */
function sampleValues(slug: string, min: number, count: number): Dec[] {
  const next = lcg(hash32(slug));
  const values: Dec[] = [];
  while (values.length < count) {
    const raw = new D((next() % 99000) + 1000).div(10); // 100.0 to 9,999.9: long digit runs make each page's numbers its own
    const v = min < 0 ? raw.minus(Math.min(-min, 100).toString()).toDecimalPlaces(1) : raw;
    if (!values.some((x) => x.eq(v))) values.push(v);
  }
  return values.sort((a, b) => a.cmp(b));
}

function build(pair: Pair): CalculatorConfig {
  const { from, to } = pair;
  const slug = `${from.slug}-to-${to.slug}`;
  const isTemp = pair.factor === null;
  const def = pair.defaultValue;
  const defIn = new D(def);
  const defOut = pair.convert(defIn);
  const samples = sampleValues(slug, pair.min, 32);
  const oneOut = pair.convert(new D(1));
  const exact = pair.factor !== null && isShort(pair.factor, 12);
  const reverse = pair.factor !== null ? new D(1).div(pair.factor) : null;
  const ratio = pair.factor !== null ? pair.factor : null;

  const step = pair
    .convert(new D(10))
    .minus(pair.convert(new D(0)))
    .div(10);
  const f = isTemp ? '' : fmtSig(pair.factor!, 10);
  const o = fmtSig(oneOut, 10);
  const how = exact ? 'exactly' : 'about';
  // Every sentence slot has several phrasings and one is chosen per page by hash, so two pages share few
  // template words and the copy is not the same sentence with the nouns swapped (Prompt 5, rule 3).
  const v = (slot: string, options: readonly string[]): string => pick(options, `${slug}:${slot}`);

  const factorSentence = isTemp
    ? v('factor', [
        `The conversion uses ${pair.formulaText}, because the two scales start at different points as well as having different step sizes.`,
        `The formula is ${pair.formulaText}. The zero points and the degree sizes both differ, so a plain multiplication would give a wrong answer.`,
        `Working from ${pair.formulaText}, the offset is applied together with the scale, which is why there is no single factor.`,
        `Because of different zero points, ${pair.formulaText} has to be applied in full; multiplying alone is not enough.`,
      ])
    : v('factor', [
        `The conversion multiplies by ${f}, so one ${from.singular} is ${how} ${o} ${to.plural}.`,
        `One ${from.singular} equals ${how} ${o} ${to.plural}, which means every value is scaled by ${f}.`,
        `To convert, take the number of ${from.plural} and multiply it by ${f}; a single ${from.singular} comes to ${o} ${to.plural}.`,
        `The scale factor is ${f}: one ${from.singular} measures ${how} ${o} ${to.plural}.`,
      ]);

  const sizeSentence = isTemp
    ? v('size', [
        `A change of one ${from.singular} is a change of ${fmtSig(step, 6)} ${to.plural}, which is why the offset matters.`,
        `Each ${from.singular} of change moves the ${to.singular} reading by ${fmtSig(step, 6)}.`,
        `Step size differs too: ${fmtSig(step, 6)} ${to.plural} for every ${from.singular}.`,
      ])
    : ratio!.gte(1)
      ? v('size', [
          `Each ${from.singular} is ${fmtSig(ratio!, 6)} times as large as one ${to.singular}.`,
          `In size, ${from.singular} beats ${to.singular} by a factor of ${fmtSig(ratio!, 6)}.`,
          `Put another way, the ${from.singular} is ${fmtSig(ratio!, 6)} times the ${to.singular}.`,
        ])
      : v('size', [
          `Each ${to.singular} is ${fmtSig(reverse!, 6)} times as large as one ${from.singular}.`,
          `In size, ${to.singular} beats ${from.singular} by a factor of ${fmtSig(reverse!, 6)}.`,
          `Put another way, the ${to.singular} is ${fmtSig(reverse!, 6)} times the ${from.singular}.`,
        ]);

  const back = pair.back(new D(1));
  const reverseSentence = isTemp
    ? v('reverse', [
        `Going back from ${to.plural} to ${from.plural} uses the opposite formula, and one ${to.singular} corresponds to ${fmtSig(back, 6)} ${from.abbr}.`,
        `For the return trip, a reading of 1 ${to.abbr} lands at ${fmtSig(back, 6)} ${from.abbr}.`,
        `The reverse converter turns ${to.plural} into ${from.plural}; as a check, 1 ${to.abbr} is ${fmtSig(back, 6)} ${from.abbr}.`,
      ])
    : v('reverse', [
        `To go the other way, multiply ${to.plural} by ${fmtSig(reverse!, 10)} to get ${from.plural}.`,
        `Reversing it, one ${to.singular} is ${fmtSig(reverse!, 10)} ${from.plural}.`,
        `Starting from ${to.plural} instead, the factor to use is ${fmtSig(reverse!, 10)}.`,
      ]);

  const tableLabel = v('table', [
    'A few values worked out in advance:',
    'Some reference points to compare against:',
    'Sample conversions:',
    'Quick checks you can compare with:',
  ]);
  const useAbbr = hash32(`${slug}:abbr`) % 2 === 0;
  const sampleText = samples
    .map((x) =>
      useAbbr
        ? `${fmtSig(x, 5, false)} ${from.abbr} = ${fmtSig(pair.convert(x), 5, false)} ${to.abbr}`
        : `${fmtSig(x, 5, false)} ${from.plural} = ${fmtSig(pair.convert(x), 5, false)} ${to.plural}`,
    )
    .join('; ');

  const useSentence = pick(pair.uses, slug);
  const introSentences = [
    `${fmtSig(defIn, 5)} ${def === 1 ? from.singular : from.plural} is ${fmtSig(defOut, 6)} ${to.plural}.`,
    factorSentence,
    to.fact,
    `${tableLabel} ${sampleText}.`,
    sizeSentence,
    reverseSentence,
  ];
  const intro = introSentences.join(' ');

  const inputName = 'value';
  const scenarioValues = [1, 5, 25, 100, 500, 1000].filter((v) => v !== def).slice(0, 5);
  const wEx = samples[3];
  const faq = [
    {
      question: `How do I convert ${from.plural} to ${to.plural}?`,
      answer: isTemp
        ? `Use ${pair.formulaText}. For example, ${fmtSig(wEx, 5)} ${from.abbr} is ${fmtSig(pair.convert(wEx), 5)} ${to.abbr}.`
        : `Multiply the number of ${from.plural} by ${fmtSig(pair.factor!, 10)}. For example, ${fmtSig(wEx, 5)} ${from.plural} × ${fmtSig(pair.factor!, 10)} = ${fmtSig(pair.convert(wEx), 6)} ${to.plural}.`,
    },
    {
      question: `How many ${to.plural} are in one ${from.singular}?`,
      answer: isTemp
        ? `One ${from.singular} is ${fmtSig(oneOut, 8)} ${to.abbr}, but only at that exact value: temperature scales have an offset, so the answer is different at every starting point.`
        : `One ${from.singular} is ${exact ? 'exactly' : 'approximately'} ${fmtSig(oneOut, 10)} ${to.plural}, which is the factor this converter multiplies by.`,
    },
    {
      question: `How many ${from.plural} make one ${to.singular}?`,
      answer: isTemp
        ? `One ${to.singular} corresponds to ${fmtSig(pair.back(new D(1)), 8)} ${from.abbr}, for that starting value only.`
        : `One ${to.singular} is ${exact ? 'exactly' : 'approximately'} ${fmtSig(reverse!, 10)} ${from.plural}, so dividing a number of ${from.plural} by that figure gives the same answer as this converter.`,
    },
    {
      question: `Why convert ${from.plural} to ${to.plural}?`,
      answer: `${useSentence} Enter any number of ${from.plural} above and the ${to.abbr} figure updates as you type, with the arithmetic done at full precision.`,
    },
    {
      question: `Is the ${from.singular} to ${to.singular} conversion exact?`,
      answer: isTemp
        ? 'Yes. The temperature scales are defined by exact relationships, and this converter keeps full precision and rounds only the number it displays.'
        : exact
          ? `Yes. The factor ${fmtSig(pair.factor!, 12)} is exact, because both units are defined exactly, so the only rounding is in the number shown.`
          : `The factor is a repeating or very long decimal, so it is shown rounded to 10 significant digits. The calculation itself keeps 40 digits of precision.`,
    },
  ];

  return {
    slug,
    category: 'conversion',
    tier: pair.tier,
    subCluster: pair.family,
    publish: true,
    title: `${capitalise(from.plural)} to ${capitalise(to.plural)} Converter (${from.abbr} to ${to.abbr})`,
    h1: `${capitalise(from.plural)} to ${capitalise(to.plural)} Converter`,
    metaDescription: isTemp
      ? `Convert ${from.plural} to ${to.plural} instantly with the exact formula ${pair.formulaText}, a quick-reference table and a worked example.`
      : `Convert ${from.plural} to ${to.plural} instantly: 1 ${from.singular} = ${fmtSig(oneOut, 8)} ${to.plural}. Free ${pair.noun} converter with the formula and a reference table.`,
    intro,
    inputs: [
      {
        name: inputName,
        label: `${capitalise(from.plural)} (${from.abbr})`,
        type: 'number',
        min: pair.min,
        max: 1e15,
        default: def,
        validator: numberField({ min: pair.min, max: 1e15 }),
      },
    ],
    outputs: [
      { name: 'result', label: `${capitalise(to.plural)} (${to.abbr})`, format: 'text', highlight: true },
      { name: 'summary', label: 'In words', format: 'text' },
    ],
    calculate: (i) => {
      const v = toD(i[inputName]);
      const out = pair.convert(v);
      return {
        result: fmtSig(out, 8),
        summary: `${fmtSig(v, 8)} ${v.eq(1) ? from.singular : from.plural} is ${fmtSig(out, 8)} ${to.plural}`,
      };
    },
    scenarios: scenarioValues.map((v) => ({ label: `${v} ${from.abbr}`, inputs: { [inputName]: v } })),
    formulaDescription: isTemp
      ? `${pair.formulaText}. The scales differ in their zero point and in the size of one degree, so the conversion is an offset plus a scale, applied here with exact decimal arithmetic.`
      : `${capitalise(to.plural)} = ${from.plural} × ${fmtSig(pair.factor!, 12)}. ${exact ? 'The factor is exact because both units have exact definitions.' : 'The factor is shown to 12 significant digits; the calculation keeps 40.'} To reverse it, divide by the same factor.`,
    workedExample: isTemp
      ? `${fmtSig(wEx, 5)} ${from.abbr} converts to ${fmtSig(pair.convert(wEx), 5)} ${to.abbr} using ${pair.formulaText}.`
      : `Convert ${fmtSig(wEx, 5)} ${from.plural}: ${fmtSig(wEx, 5)} × ${fmtSig(pair.factor!, 10)} = ${fmtSig(pair.convert(wEx), 8)} ${to.plural}.`,
    faq,
    relatedSlugs: [],
    lastUpdated: '2026-11-22',
  };
}

/** Every pair in every family, with relatedSlugs filled in: the reverse pair first, then pages sharing a unit. */
export default function generate(): CalculatorConfig[] {
  const pairs = [...FAMILIES.flatMap(toFamilyPairs), ...toTempPairs()];
  const configs = pairs.map(build);
  const bySlug = new Set(configs.map((c) => c.slug));
  const slugOf = (p: Pair) => `${p.from.slug}-to-${p.to.slug}`;
  configs.forEach((c, i) => {
    const p = pairs[i];
    // The reverse pair first, then pages sharing a unit in an order that depends on the page, not on the alphabet,
    // so inbound links spread evenly over the family instead of piling onto units that sort first.
    const sharing = pairs
      .filter(
        (q) => q.family === p.family && q !== p && slugOf(q) !== `${p.to.slug}-to-${p.from.slug}` && (q.from.slug === p.from.slug || q.to.slug === p.to.slug),
      )
      .map(slugOf)
      .sort((x, y) => hash32(`${c.slug}|${x}`) - hash32(`${c.slug}|${y}`));
    const candidates = [`${p.to.slug}-to-${p.from.slug}`, ...sharing];
    c.relatedSlugs = candidates.filter((s) => bySlug.has(s) && s !== c.slug).slice(0, 6);
  });
  return configs;
}
