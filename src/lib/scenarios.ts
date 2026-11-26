import { runWith } from './calc-utils';
import type { CalculatorConfig } from './types';

export interface ScenarioTable {
  columns: { name: string; label: string }[];
  rows: { label: string; results: Record<string, string> }[];
}

/**
 * Run calculate() for every scenario in the config so the table is computed, never typed in.
 * Returns null when the config defines no scenarios, and the layout then leaves the section out.
 */
export function scenarioTable(config: CalculatorConfig): ScenarioTable | null {
  if (!config.scenarios?.length) return null;
  return {
    columns: config.outputs.map((o) => ({ name: o.name, label: o.label })),
    rows: config.scenarios.map((s) => ({ label: s.label, results: runWith(config, s.inputs) })),
  };
}
