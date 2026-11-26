import { defaultInputs } from './calc-utils';
import { DEFAULT_CURRENCY, symbolOf, withCurrency } from './currency';
import type { CalculatorConfig } from './types';

/**
 * The currency a calculator's own results are written in, or undefined when it shows no money (BMI, a percentage).
 *
 * A config can say it (`currency`: country pages do). Otherwise this finds out instead of trusting a hand-kept list:
 * it runs calculate() once as-is and once with the display currency forced to something else; if any output changes,
 * the calculator formats money through fmtCurrency, so it is a money calculator and its own currency is USD. A calculator
 * with a "($)" input label counts too, because its labels need to follow the chosen symbol.
 */
export function currencyOf(config: CalculatorConfig): string | undefined {
  if (config.currency) return config.currency;
  const inputs = defaultInputs(config);
  const own = config.calculate(inputs);
  const forced = withCurrency('EUR', () => config.calculate(inputs));
  const formatsMoney = Object.keys(own).some((k) => own[k] !== forced[k]);
  const labelsMoney = config.inputs.some((i) => i.label.includes(`(${symbolOf(DEFAULT_CURRENCY)})`));
  return formatsMoney || labelsMoney ? DEFAULT_CURRENCY : undefined;
}
