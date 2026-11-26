import { numberField, selectField } from '../lib/calc-utils';
import { D, toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { sci, varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 22b (other, sports, physics): aspect ratio, heart-rate training zones and wavelength. The heart-rate
 * pages give estimates from published formulas and say so; the sports and physics categories show no disclaimer, but
 * the heart-rate page carries a plain note about checking with a doctor. Tier 2 or 3, so none is live until the
 * cohort gate opens.
 */

const num = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max }),
});
const sel = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});
const out = (name: string, label: string, highlight = false) => ({ name, label, format: 'text' as const, ...(highlight ? { highlight: true } : {}) });
const gcdBig = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
};
const ratio = (a: Dec, b: Dec): string => {
  const k = Math.max(a.decimalPlaces(), b.decimalPlaces());
  const scale = new D(10).pow(k);
  const ia = BigInt(a.mul(scale).toFixed(0));
  const ib = BigInt(b.mul(scale).toFixed(0));
  const g = gcdBig(ia, ib) || 1n;
  return `${ia / g} : ${ib / g}`;
};
const ZONES: [number, number, string, string][] = [
  [50, 60, 'z1', 'very light'],
  [60, 70, 'z2', 'light'],
  [70, 80, 'z3', 'moderate'],
  [80, 90, 'z4', 'hard'],
  [90, 100, 'z5', 'maximum'],
];
const MEDIUM: Record<string, string> = { light: '299792458', air: '343', water: '1480', steel: '5960' };
const FREQ: Record<string, string> = { Hz: '1', kHz: '1e3', MHz: '1e6', GHz: '1e9', THz: '1e12' };
const wavelengthText = (m: Dec): string => {
  const steps: [string, string, string][] = [
    ['1000', 'km', '1e-3'],
    ['1', 'm', '1'],
    ['0.01', 'cm', '100'],
    ['0.001', 'mm', '1000'],
    ['1e-6', 'µm', '1e6'],
    ['1e-9', 'nm', '1e9'],
  ];
  for (const [lim, unit, mult] of steps) if (m.gte(lim)) return `${fmtNumber(m.mul(mult), 4)} ${unit}`;
  return `${fmtNumber(m.mul('1e12'), 4)} pm`;
};
const band = (nm: Dec): string =>
  nm.lt('0.01')
    ? 'Gamma ray'
    : nm.lt(10)
      ? 'X-ray'
      : nm.lt(400)
        ? 'Ultraviolet'
        : nm.lt(700)
          ? 'Visible light'
          : nm.lt('1e6')
            ? 'Infrared'
            : 'Microwave or radio';

export const SPECS: Spec[] = [
  {
    slug: 'aspect-ratio-calculator',
    category: 'other',
    tier: 2,
    subCluster: 'Design and screens',
    title: 'Aspect Ratio Calculator: Ratio, Resize and Orientation',
    h1: 'Aspect Ratio Calculator',
    metaDescription:
      'Find the aspect ratio of an image, video or screen from its width and height, and the new height for a different width that keeps the same proportions.',
    about:
      'The aspect ratio is the proportion of width to height, such as 16:9 for most video and 4:3 for older screens and many cameras. Enter the width and height in pixels, or any unit, and the calculator reduces them to the simplest whole-number ratio, gives the same ratio as a decimal and says whether the shape is landscape, portrait or square. Add a new width to find the matching height that keeps the proportions, which is what you need when scaling an image or setting up an embedded video without stretching it.',
    inputs: [
      num('w', 'Width', 1920, 0.0001, 1e7),
      num('h', 'Height', 1080, 0.0001, 1e7),
      num('nw', 'New width (to find the matching height)', 1280, 0.0001, 1e7),
    ],
    outputs: [
      out('ratio', 'Aspect ratio', true),
      out('dec', 'As a decimal (width ÷ height)'),
      out('nh', 'Height at the new width'),
      out('orient', 'Orientation'),
      out('mp', 'Size in megapixels'),
    ],
    calculate: (i) => {
      const w = toD(i.w);
      const h = toD(i.h);
      return {
        ratio: ratio(w, h),
        dec: fmtNumber(w.div(h), 4),
        nh: fmtNumber(h.mul(toD(i.nw)).div(w), 2),
        orient: w.gt(h) ? 'Landscape' : w.lt(h) ? 'Portrait' : 'Square',
        mp: `${fmtNumber(w.mul(h).div('1e6'), 2)} megapixels`,
      };
    },
    formulaDescription:
      'The ratio is width : height divided by their greatest common divisor (after scaling decimals to whole numbers). New height = height × new width ÷ width. Megapixels = width × height ÷ 1,000,000 when the units are pixels.',
    formulaLatex: 'h_{new} = h\\,\\dfrac{w_{new}}{w}',
    workedExample:
      '1920 × 1080 reduces to 16 : 9 (1.7778). At a width of 1280 the matching height is 720, and the image is 2.07 megapixels. 4000 × 3000 is 4 : 3, and 1080 × 1920 is a portrait 9 : 16.',
    faq: [
      {
        question: 'What are common aspect ratios?',
        answer: '16:9 for video and monitors, 4:3 for older screens and many cameras, 3:2 for photographs, 1:1 for squares and 9:16 for vertical video.',
      },
      { question: 'Why must I keep the ratio when resizing?', answer: 'Changing one side without the other stretches or squashes the picture.' },
      {
        question: 'Does it work for CSS?',
        answer: 'Yes: the reduced ratio can be used as an aspect-ratio value, and the decimal gives the padding trick percentage.',
      },
    ],
    scenarios: varied(
      'aspect-ratio-calculator',
      12,
      [
        { name: 'w', lo: 320, hi: 7680, step: 16 },
        { name: 'h', lo: 240, hi: 4320, step: 16 },
        { name: 'nw', lo: 100, hi: 2000, step: 10 },
      ],
      [],
      (v) => `${v.w} by ${v.h} resized to ${v.nw} wide`,
    ),
    introOutputs: ['ratio', 'nh'],
    relatedSlugs: ['ratio-calculator', 'area-calculator', 'unit-rate-calculator'],
    checks: [
      { inputs: {}, expect: { ratio: '16 : 9', dec: '1.7778', nh: '720', orient: 'Landscape', mp: '2.07 megapixels' } },
      { inputs: { w: 1080, h: 1920, nw: 360 }, expect: { ratio: '9 : 16', dec: '0.5625', nh: '640', orient: 'Portrait', mp: '2.07 megapixels' } },
      { inputs: { w: 4000, h: 3000, nw: 1000 }, expect: { ratio: '4 : 3', dec: '1.3333', nh: '750', orient: 'Landscape', mp: '12 megapixels' } },
      { inputs: { w: 800, h: 800, nw: 100 }, expect: { ratio: '1 : 1', dec: '1', nh: '100', orient: 'Square', mp: '0.64 megapixels' } },
      { inputs: { w: 2.5, h: 4, nw: 10 }, expect: { ratio: '5 : 8', dec: '0.625', nh: '16', orient: 'Portrait', mp: '0 megapixels' } },
    ],
  },
  {
    slug: 'heart-rate-zone-calculator',
    category: 'sports',
    tier: 2,
    subCluster: 'Training',
    title: 'Heart Rate Zone Calculator: Five Training Zones From Your Age',
    h1: 'Heart Rate Zone Calculator',
    metaDescription:
      'Estimate your maximum heart rate and five training zones from your age, using the Tanaka or the classic 220 minus age formula, as a percentage of maximum or the Karvonen heart rate reserve method.',
    about:
      'Exercise physiologists divide effort into bands by how hard the heart is beating, from an easy warm-up pace up to an all-out sprint. Each band is a slice of your highest sustainable pulse, which can be predicted from your age: either 208 minus seven tenths of your age, known as the Tanaka equation, or the older 220 minus your age. Choose that, and whether bands should be cut from the top pulse alone or from the reserve left above your resting pulse. Out come five ranges in beats per minute. They are averages; if you have a cardiac condition or take medication that affects your pulse, ask a doctor first.',
    inputs: [
      num('age', 'Age (years)', 35, 10, 100),
      num('rest', 'Resting heart rate (beats per minute)', 60, 30, 120),
      sel('meth', 'Maximum heart rate formula', 'tanaka', [
        ['tanaka', 'Tanaka: 208 − 0.7 × age'],
        ['fox', 'Classic: 220 − age'],
      ]),
      sel('zmode', 'Zones as a percentage of', 'max', [
        ['max', 'Maximum heart rate'],
        ['reserve', 'Heart rate reserve (Karvonen)'],
      ]),
    ],
    outputs: [out('max', 'Estimated maximum heart rate', true), ...ZONES.map(([lo, hi, k, name], n) => out(k, `Zone ${n + 1}: ${name} (${lo} to ${hi}%)`))],
    calculate: (i) => {
      const age = toD(i.age);
      const rest = toD(i.rest);
      const mx = String(i.meth) === 'tanaka' ? new D(208).minus(age.mul('0.7')) : new D(220).minus(age);
      const res: Record<string, string> = { max: `${fmtNumber(mx, 0)} bpm` };
      for (const [lo, hi, k] of ZONES) {
        const reserve = String(i.zmode) === 'reserve';
        const a = reserve ? rest.plus(mx.minus(rest).mul(lo).div(100)) : mx.mul(lo).div(100);
        const b = reserve ? rest.plus(mx.minus(rest).mul(hi).div(100)) : mx.mul(hi).div(100);
        res[k] = `${fmtNumber(a, 0)} to ${fmtNumber(b, 0)} bpm`;
      }
      return res;
    },
    formulaDescription:
      'Maximum heart rate = 208 − 0.7 × age (Tanaka) or 220 − age (classic). Zone = maximum × percentage. Karvonen: zone = resting + (maximum − resting) × percentage. Zones: 50 to 60%, 60 to 70%, 70 to 80%, 80 to 90% and 90 to 100%. Formulas estimate the average: individual maximum rates differ by 10 beats or more.',
    formulaLatex: 'HR_{target} = HR_{rest} + (HR_{max} - HR_{rest})\\times p',
    workedExample:
      'Age 35 with the Tanaka formula: maximum 184 bpm (183.5 rounded). Zones as a percentage of maximum run 92 to 110, 110 to 128, 128 to 147, 147 to 165 and 165 to 184 bpm. At 50 with a classic maximum of 170 and a resting rate of 70 the Karvonen zone 3 is 140 to 150.',
    faq: [
      {
        question: 'Which formula is better?',
        answer: 'The Tanaka formula tends to fit older adults better; the classic one overestimates for them. Neither replaces a measured maximum.',
      },
      {
        question: 'What is heart rate reserve?',
        answer: 'The difference between your maximum and resting heart rates; the Karvonen method scales zones within that range.',
      },
      {
        question: 'Should I check with a doctor?',
        answer: 'If you have a heart condition, take medication that affects your pulse or are new to hard exercise, yes: these are general estimates.',
      },
    ],
    scenarios: varied(
      'heart-rate-zone-calculator',
      12,
      [
        { name: 'age', lo: 16, hi: 78, step: 1 },
        { name: 'rest', lo: 42, hi: 85, step: 1 },
      ],
      [
        { name: 'meth', options: ['tanaka', 'fox'] },
        { name: 'zmode', options: ['max', 'reserve'] },
      ],
      (v) => `${v.age} yrs resting pulse ${v.rest} via ${v.meth} on ${v.zmode}`,
    ),
    introOutputs: ['z3'],
    relatedSlugs: ['target-heart-rate-calculator', 'max-heart-rate-calculator', 'calories-burned-calculator'],
    checks: [
      { inputs: {}, expect: { max: '184 bpm', z1: '92 to 110 bpm', z2: '110 to 128 bpm', z3: '128 to 147 bpm', z4: '147 to 165 bpm', z5: '165 to 184 bpm' } },
      {
        inputs: { age: 50, rest: 70, meth: 'fox', zmode: 'reserve' },
        expect: { max: '170 bpm', z1: '120 to 130 bpm', z2: '130 to 140 bpm', z3: '140 to 150 bpm', z4: '150 to 160 bpm', z5: '160 to 170 bpm' },
      },
      {
        inputs: { age: 22, meth: 'fox' },
        expect: { max: '198 bpm', z1: '99 to 119 bpm', z2: '119 to 139 bpm', z3: '139 to 158 bpm', z4: '158 to 178 bpm', z5: '178 to 198 bpm' },
      },
      {
        inputs: { age: 65, rest: 55, zmode: 'reserve' },
        expect: { max: '163 bpm', z1: '109 to 120 bpm', z2: '120 to 130 bpm', z3: '130 to 141 bpm', z4: '141 to 152 bpm', z5: '152 to 163 bpm' },
      },
    ],
  },
  {
    slug: 'wavelength-calculator',
    category: 'physics',
    tier: 2,
    subCluster: 'Waves and optics',
    title: 'Wavelength Calculator: From Frequency for Light, Radio and Sound',
    h1: 'Wavelength Calculator',
    metaDescription:
      'Calculate the wavelength of a wave from its frequency and the medium: light or radio in vacuum, sound in air, water or steel, with the period and the part of the spectrum.',
    about:
      'Wavelength is the distance a wave travels in one cycle, the wave speed divided by the frequency. A Wi-Fi signal at 2.4 gigahertz has a wavelength of about 12.5 centimetres, green light at 540 terahertz about 555 nanometres and a 440 hertz note in air about 78 centimetres. Enter the frequency with its unit and pick the medium. Light and radio waves travel at the speed of light, sound at a speed that depends on the material. You also get the period of one cycle and, for light and radio, the band of the spectrum.',
    inputs: [
      num('f', 'Frequency', 100, 0.000001, 1e15),
      sel('fu', 'Frequency unit', 'MHz', [
        ['Hz', 'Hertz (Hz)'],
        ['kHz', 'Kilohertz (kHz)'],
        ['MHz', 'Megahertz (MHz)'],
        ['GHz', 'Gigahertz (GHz)'],
        ['THz', 'Terahertz (THz)'],
      ]),
      sel('med', 'Wave and medium', 'light', [
        ['light', 'Light or radio in vacuum (299,792,458 m/s)'],
        ['air', 'Sound in air at 20 °C (343 m/s)'],
        ['water', 'Sound in water (1,480 m/s)'],
        ['steel', 'Sound in steel (5,960 m/s)'],
      ]),
    ],
    outputs: [out('wl', 'Wavelength', true), out('m', 'In metres'), out('per', 'Period of one cycle'), out('band', 'Spectrum band')],
    calculate: (i) => {
      const f = toD(i.f).mul(FREQ[String(i.fu)] ?? '1');
      const med = String(i.med);
      const lam = new D(MEDIUM[med] ?? MEDIUM.light).div(f);
      return {
        wl: wavelengthText(lam),
        m: `${sci(lam)} m`,
        per: `${sci(new D(1).div(f))} s`,
        band: med === 'light' ? band(lam.mul('1e9')) : 'Not an electromagnetic wave',
      };
    },
    formulaDescription:
      'λ = v ÷ f, with v the wave speed in the medium (299,792,458 m/s for light and radio in vacuum; typical values for sound) and f the frequency in hertz. Period T = 1 ÷ f. Speeds of sound vary with temperature, pressure and the exact material.',
    formulaLatex: '\\lambda = \\dfrac{v}{f}',
    workedExample:
      'A 100 MHz radio wave (FM) has a wavelength of 2.9979 m and a period of 10 ns. 2.4 GHz is 12.4914 cm; 540 THz light is 555.1712 nm, in the visible band; and a 440 Hz note in air is 77.9545 cm.',
    faq: [
      {
        question: 'Does the wavelength change in glass or water?',
        answer: 'For light, yes: it shortens by the refractive index while the frequency stays the same. This page uses vacuum for light.',
      },
      {
        question: 'Why does sound need a medium?',
        answer: 'It is a pressure wave in matter, so it cannot travel in a vacuum, and its speed depends on the material.',
      },
      { question: 'Is wavelength the same as period?', answer: 'No. Wavelength is a distance; the period is the time of one cycle.' },
    ],
    scenarios: varied(
      'wavelength-calculator',
      12,
      [{ name: 'f', lo: 15, hi: 950, step: 5 }],
      [
        { name: 'fu', options: ['Hz', 'kHz', 'MHz', 'GHz', 'THz'] },
        { name: 'med', options: ['light', 'air', 'water', 'steel'] },
      ],
      (v) => `${v.f} ${v.fu} in ${v.med}`,
    ),
    introOutputs: ['wl'],
    relatedSlugs: ['wave-speed-calculator', 'photon-energy-calculator', 'frequency-period-calculator'],
    checks: [
      { inputs: {}, expect: { wl: '2.9979 m', m: '2.998 × 10^0 m', per: '1.000 × 10^-8 s', band: 'Microwave or radio' } },
      { inputs: { f: 2.4, fu: 'GHz' }, expect: { wl: '12.4914 cm', m: '1.249 × 10^-1 m', per: '4.167 × 10^-10 s', band: 'Microwave or radio' } },
      {
        inputs: { f: 440, fu: 'Hz', med: 'air' },
        expect: { wl: '77.9545 cm', m: '7.795 × 10^-1 m', per: '2.273 × 10^-3 s', band: 'Not an electromagnetic wave' },
      },
      { inputs: { f: 540, fu: 'THz' }, expect: { wl: '555.1712 nm', m: '5.552 × 10^-7 m', per: '1.852 × 10^-15 s', band: 'Visible light' } },
      {
        inputs: { f: 20, fu: 'kHz', med: 'water' },
        expect: { wl: '7.4 cm', m: '7.400 × 10^-2 m', per: '5.000 × 10^-5 s', band: 'Not an electromagnetic wave' },
      },
      {
        inputs: { f: 3, fu: 'THz', med: 'steel' },
        expect: { wl: '1.9867 nm', m: '1.987 × 10^-9 m', per: '3.333 × 10^-13 s', band: 'Not an electromagnetic wave' },
      },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
