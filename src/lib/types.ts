import type { ZodType } from 'zod';

export const CATEGORIES = [
  'math',
  'finance',
  'physics',
  'health',
  'conversion',
  'everyday-life',
  'statistics',
  'construction',
  'biology',
  'sports',
  'chemistry',
  'food',
  'ecology',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Tier = 1 | 2 | 3;

export interface UnitOption {
  value: string;
  label: string;
  /**
   * Exact size of one of this unit in some base unit shared by every option of the same input
   * (1 lb = '0.45359237' when kg is '1'). When every option has one, switching units converts the
   * number the person typed instead of just relabelling it.
   */
  factor?: string;
}

export interface CalculatorInput {
  name: string;
  label: string;
  type: 'number' | 'select' | 'date' | 'unit' | 'text';
  /**
   * Unit choices for `type: 'unit'` inputs, and the option list for `type: 'select'`. The selected unit
   * is passed to calculate() under the key `${name}Unit` (see `unitOf` in calc-utils); when absent the
   * first option is used.
   */
  unitOptions?: UnitOption[];
  min?: number;
  max?: number;
  default: string | number;
  validator: ZodType;
}

export interface CalculatorOutput {
  name: string;
  label: string;
  format: 'currency' | 'percent' | 'number' | 'date' | 'text';
  highlight?: boolean;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface Scenario {
  label: string;
  inputs: Record<string, string | number>;
}

/** Why the 26 Nov 2026 catalog audit flagged a page; see src/config/catalog-audit.ts. S scale, V variant, Q accuracy, D duplicate, T trivial, N niche. */
export type AuditCode = 'S' | 'V' | 'Q' | 'D' | 'T' | 'N';
export interface CatalogAudit {
  /** 'weak': recommend not publishing as it stands. 'niche': kept, publish last. */
  grade: 'weak' | 'niche';
  code: AuditCode;
  reason: string;
}

export interface CalculatorConfig {
  slug: string;
  category: Category;
  tier: Tier;
  /**
   * Group inside the category, used for hub grouping and sibling links (Prompt 7). Generated calculators set it
   * (for example 'length'); for hand-written ones it falls back to the cluster named in the hub copy file.
   */
  subCluster?: string;
  /**
   * Intent to publish. A page is only live when this is true AND the cohort flag for its tier is on
   * (cohort N is tier N, see src/config/rollout.ts): use isPublished() from the registry.
   */
  publish: boolean;
  /**
   * Set by the registry from src/config/catalog-audit.ts. Informational only: it does not change `publish`, the quality gate
   * or anything rendered. Absent means the audit did not flag the page.
   */
  audit?: CatalogAudit;
  title: string;
  h1: string;
  metaDescription: string;
  /** 150+ words of SEO copy; the answer comes in the first two sentences. */
  intro: string;
  inputs: CalculatorInput[];
  outputs: CalculatorOutput[];
  /**
   * ISO code of the currency this calculator's results and "($)" labels are written in. Optional: a calculator that
   * formats money without it is treated as USD (see `currencyOf` in src/lib/currency-of.ts). Country pages set it
   * (a Canada mortgage is CAD), and a visitor's detected currency does not override it; their own choice does.
   */
  currency?: string;
  /** Pure function. Uses decimal.js and returns already-formatted strings. */
  calculate: (inputs: Record<string, unknown>) => Record<string, string>;
  /** Name of an input the user can solve for, given an output. */
  solveFor?: string;
  formulaDescription: string;
  /** LaTeX for the headline formula. Rendered with KaTeX at build time (Layout B); other layouts ignore it. */
  formulaLatex?: string;
  /** Derivation shown step by step in Layout B. Each step is plain text; wrap maths in $...$ for KaTeX. */
  derivation?: string[];
  /**
   * Named input sets. The layouts run calculate() on each at build time, so the table can never go
   * stale: Layout A shows them as a scenario comparison, Layout C as a quick-reference table.
   * Only the inputs named here override the defaults.
   */
  scenarios?: Scenario[];
  workedExample: string;
  faq: FaqEntry[];
  relatedSlugs: string[];
  /** ISO date, e.g. 2026-11-22. */
  lastUpdated: string;
}
