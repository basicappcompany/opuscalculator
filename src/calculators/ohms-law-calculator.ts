import { numberField, selectField } from '../lib/calc-utils';
import { toD, type Dec } from '../lib/decimal';
import { fmtNumber } from '../lib/format';
import type { CalculatorConfig } from '../lib/types';

const UNDEFINED = 'Undefined (division by zero)';
const show = (d: Dec, unit: string) => `${fmtNumber(d, 6)} ${unit}`;

const config: CalculatorConfig = {
  slug: 'ohms-law-calculator',
  category: 'physics',
  tier: 2,
  publish: false,
  title: "Ohm's Law Calculator: Voltage, Current, Resistance and Power",
  h1: "Ohm's Law Calculator",
  metaDescription: "Solve Ohm's law for voltage, current or resistance from the other two values, and get the electrical power in watts. V = I × R, P = V × I.",
  intro:
    "With a current of 2 amperes flowing through a 6 ohm resistor, the voltage across it is 12 volts and the power it dissipates as heat is 24 watts. Ohm's law says that the voltage across a conductor equals the current through it multiplied by its resistance, written V = I × R, and it is the first equation anyone learns in circuit analysis. Choose which quantity you want to find, enter the other two, and the calculator returns all four values: voltage, current, resistance and power. Electrical power follows from the same numbers as P = V × I, so you can also see how much a resistor must be able to dissipate before it overheats, or whether a circuit will stay within the rating of a power supply. The law holds for ohmic materials such as resistors and wires at a steady temperature, but it does not describe non-linear parts like diodes and transistors, where resistance changes with voltage and temperature. Values are entered in volts, amperes and ohms, so convert milliamps and kilohms first.",
  inputs: [
    {
      name: 'find',
      label: 'Find',
      type: 'select',
      default: 'voltage',
      unitOptions: [
        { value: 'voltage', label: 'Voltage (V)' },
        { value: 'current', label: 'Current (I)' },
        { value: 'resistance', label: 'Resistance (R)' },
      ],
      validator: selectField(['voltage', 'current', 'resistance']),
    },
    { name: 'voltage', label: 'Voltage (volts)', type: 'number', min: 0, max: 1e9, default: 12, validator: numberField({ min: 0, max: 1e9 }) },
    { name: 'current', label: 'Current (amperes)', type: 'number', min: 0, max: 1e9, default: 2, validator: numberField({ min: 0, max: 1e9 }) },
    { name: 'resistance', label: 'Resistance (ohms)', type: 'number', min: 0, max: 1e9, default: 6, validator: numberField({ min: 0, max: 1e9 }) },
  ],
  outputs: [
    { name: 'voltage', label: 'Voltage', format: 'text', highlight: true },
    { name: 'current', label: 'Current', format: 'text', highlight: true },
    { name: 'resistance', label: 'Resistance', format: 'text', highlight: true },
    { name: 'power', label: 'Power', format: 'text' },
  ],
  calculate: (i) => {
    let v = toD(i.voltage);
    let c = toD(i.current);
    let r = toD(i.resistance);
    if (i.find === 'current') {
      if (r.isZero()) return { voltage: show(v, 'V'), current: UNDEFINED, resistance: show(r, 'Ω'), power: UNDEFINED };
      c = v.div(r);
    } else if (i.find === 'resistance') {
      if (c.isZero()) return { voltage: show(v, 'V'), current: show(c, 'A'), resistance: UNDEFINED, power: show(v.mul(c), 'W') };
      r = v.div(c);
    } else {
      v = c.mul(r);
    }
    return { voltage: show(v, 'V'), current: show(c, 'A'), resistance: show(r, 'Ω'), power: show(v.mul(c), 'W') };
  },
  formulaDescription:
    "Ohm's law: V = I × R, so I = V ÷ R and R = V ÷ I, with voltage V in volts, current I in amperes and resistance R in ohms. Power P = V × I (equivalently I² × R or V² ÷ R) in watts. The calculator solves for the quantity you choose from the other two.",
  workedExample:
    'Find the voltage when I = 2 A and R = 6 Ω: V = 2 × 6 = 12 V, and the power is P = 12 × 2 = 24 W. Find the current for V = 12 V and R = 6 Ω: I = 12 ÷ 6 = 2 A. Find the resistance for V = 12 V and I = 2 A: R = 12 ÷ 2 = 6 Ω.',
  faq: [
    {
      question: "What is Ohm's law?",
      answer:
        'It states that the current through a conductor is proportional to the voltage across it and inversely proportional to its resistance, so V = I × R. It applies to ohmic components such as resistors at constant temperature.',
    },
    {
      question: 'How do I calculate power from voltage and current?',
      answer:
        "Multiply them: P = V × I, in watts. Using Ohm's law the same power can also be written I² × R or V² ÷ R, depending on which two quantities you know.",
    },
    {
      question: 'Why does the calculator say undefined?',
      answer:
        "Solving for current needs a non-zero resistance and solving for resistance needs a non-zero current, because both divide. A resistance of exactly zero is a short circuit, where Ohm's law gives no finite current.",
    },
    {
      question: "Does Ohm's law work for every component?",
      answer:
        "No. Diodes, transistors and light bulb filaments have a resistance that changes with voltage or temperature, so their current is not a straight-line function of voltage. Ohm's law describes ideal resistors and many wires.",
    },
  ],
  relatedSlugs: ['standard-deviation-calculator', 'percentage-calculator', 'cm-to-inches'],
  lastUpdated: '2026-11-22',
};

export default config;
