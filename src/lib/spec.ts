import { runWith } from './calc-utils';
import { hash32, lcg } from './gen-utils';
import type { CalculatorConfig, CalculatorInput, CalculatorOutput, Category, FaqEntry, Scenario, Tier } from './types';

/** A known answer: with these inputs (the rest default) the named outputs must equal these strings. */
export interface Check {
  inputs: Record<string, unknown>;
  expect: Record<string, string>;
}

/**
 * A compact way to define one calculator for a generator (Prompt 5). The copy that varies is written by hand in
 * `about` and `faq`; the lede and the scenario lines are computed from `calculate()` at build time, so the
 * numbers in the intro can never disagree with the tool. `checks` are the known answers the generator's tests run.
 */
export interface Spec {
  slug: string;
  category: Category;
  tier: Tier;
  subCluster: string;
  title: string;
  h1: string;
  metaDescription: string;
  /** Two to four sentences, 55 words or more: what it is, how it works, when to use it. Hand-written per calculator. */
  about: string;
  inputs: CalculatorInput[];
  outputs: CalculatorOutput[];
  /** Native currency of the results when it is not USD (country pages). */
  currency?: string;
  calculate: CalculatorConfig['calculate'];
  formulaDescription: string;
  formulaLatex?: string;
  workedExample: string;
  /** At least 3 entries. */
  faq: FaqEntry[];
  /** Output names to quote in the intro's scenario lines. Default: all. Fewer, more varied numbers help the similarity gate. */
  introOutputs?: string[];
  /** Five or more. They become the scenario table on the page and the numbers in the intro. */
  scenarios: Scenario[];
  relatedSlugs?: string[];
  /** At least 3 known answers (Prompt 9.1). */
  checks: Check[];
  lastUpdated?: string;
}

const LAST_UPDATED = '2026-11-22';

/**
 * Thousands separators removed from numbers quoted in a scenario line (4,835.12 becomes 4835.12) and whole-number cents (.00), for the same reason. The quality gate
 * splits words at punctuation, so grouped numbers turn into many short tokens (000, 835, 12) that every page shares.
 */
const plain = (text: string): string => text.replace(/(?<=\d),(?=\d{3}(?!\d))/g, '').replace(/\.00(?!\d)/g, '');

function configOf(spec: Spec): CalculatorConfig {
  const config: CalculatorConfig = {
    slug: spec.slug,
    category: spec.category,
    tier: spec.tier,
    subCluster: spec.subCluster,
    publish: true,
    title: spec.title,
    h1: spec.h1,
    metaDescription: spec.metaDescription,
    intro: '',
    inputs: spec.inputs,
    outputs: spec.outputs,
    currency: spec.currency,
    calculate: spec.calculate,
    formulaDescription: spec.formulaDescription,
    formulaLatex: spec.formulaLatex,
    scenarios: spec.scenarios,
    workedExample: spec.workedExample,
    faq: spec.faq,
    relatedSlugs: spec.relatedSlugs ?? [],
    lastUpdated: spec.lastUpdated ?? LAST_UPDATED,
  };
  // The intro needs the finished config to run calculate() with the defaults and with each scenario.
  const highlight = spec.outputs.find((o) => o.highlight) ?? spec.outputs[0];
  const defaults = runWith(config, {});
  const lede = `With the default inputs, the ${highlight.label.toLowerCase()} comes to ${defaults[highlight.name]}.`;
  // Every output of every scenario, so the intro carries the real numbers of the table below the tool.
  const lines = spec.scenarios.map((s) => {
    const out = runWith(config, s.inputs);
    const quoted = spec.outputs.filter((o) => !spec.introOutputs || spec.introOutputs.includes(o.name));
    return `${plain(s.label)} gives ${quoted.map((o) => `${o.label.toLowerCase()} ${plain(out[o.name])}`).join(', ')}`;
  });
  config.intro = `${lede} ${spec.about} Worked scenarios, each run through the same calculator: ${lines.join('; ')}.`;
  return config;
}

/** Spec to config. Throws if the spec breaks a rule the quality gate or the tests would catch later anyway. */
export function defineCalculator(spec: Spec): CalculatorConfig {
  if (spec.faq.length < 3) throw new Error(`${spec.slug}: needs at least 3 FAQ entries`);
  if (spec.scenarios.length < 5) throw new Error(`${spec.slug}: needs at least 5 scenarios`);
  if (spec.checks.length < 3) throw new Error(`${spec.slug}: needs at least 3 known-answer checks`);
  return configOf(spec);
}

/** Scenarios with values specific to one page, from its slug: the numbers in the intro differ on every page. */
export function spread(slug: string, fields: { name: string; label: string }[], count = 12, lo = 12, hi = 990, decimals = 2): Scenario[] {
  const next = lcg(hash32(slug));
  const scale = 10 ** decimals;
  return Array.from({ length: count }, () => {
    const inputs: Record<string, number> = {};
    for (const f of fields) inputs[f.name] = Math.round((lo + ((next() % 100000) / 100000) * (hi - lo)) * scale) / scale;
    return { label: fields.map((f) => `${f.label} ${inputs[f.name]}`).join(', '), inputs };
  });
}

/** Scenarios whose input fields follow their own ranges: `make` gets a function r(lo, hi) giving a 2-decimal value. */
export function mixed(
  slug: string,
  count: number,
  make: (r: (lo: number, hi: number) => number) => Record<string, number>,
  label: (v: Record<string, number>) => string,
): Scenario[] {
  const next = lcg(hash32(slug));
  const r = (lo: number, hi: number) => Math.round((lo + ((next() % 100000) / 100000) * (hi - lo)) * 100) / 100;
  return Array.from({ length: count }, () => {
    const v = make(r);
    return { label: label(v), inputs: v };
  });
}
