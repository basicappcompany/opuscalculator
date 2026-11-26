import { defaultInputs } from './calc-utils';
import { currencyOf } from './currency-of';
import type { CalculatorConfig, CalculatorInput, CalculatorOutput } from './types';

/**
 * What the widget island receives. Astro can only pass plain data to a hydrated island, and a config
 * holds functions and zod validators, so the island gets this snapshot to render the first paint
 * and loads the real config (calculate + validators) in the browser afterwards.
 */
export interface WidgetSpec {
  slug: string;
  inputs: Pick<CalculatorInput, 'name' | 'label' | 'type' | 'unitOptions' | 'min' | 'max'>[];
  outputs: CalculatorOutput[];
  /** Default value of every input as a string, plus `${name}Unit` for unit inputs. */
  defaults: Record<string, string>;
  /** Formatted result for the defaults, computed at build time so it is in the initial HTML. */
  initialResults: Record<string, string>;
  solveFor?: string;
  /** ISO code of the currency the results above are written in. Absent when the calculator shows no money (no selector). */
  currency?: string;
}

export function toWidgetSpec(config: CalculatorConfig): WidgetSpec {
  const defaults: Record<string, string> = {};
  for (const [k, v] of Object.entries(defaultInputs(config))) defaults[k] = String(v);
  return {
    slug: config.slug,
    inputs: config.inputs.map(({ name, label, type, unitOptions, min, max }) => ({ name, label, type, unitOptions, min, max })),
    outputs: config.outputs,
    defaults,
    initialResults: config.calculate(defaultInputs(config)),
    solveFor: config.solveFor,
    currency: currencyOf(config),
  };
}
