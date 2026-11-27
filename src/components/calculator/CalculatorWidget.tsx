import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, Copy, Link2, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { cn } from '../../lib/utils';
import { loadCalculatorConfig } from '../../lib/config-loader';
import { currencyLongLabel, getCurrency, symbolOf, withCurrency } from '../../lib/currency';
import { OPEN_SELECTOR_EVENT, getCurrencyState, onCurrencyChange, startCurrency, type CurrencyState } from '../../lib/currency-store';
import { convertValue } from '../../lib/units';
import { solveInput } from '../../lib/solve';
import { readShareParams, shareResultUrl } from '../../lib/toolbar';
import type { CalculatorConfig } from '../../lib/types';
import type { WidgetSpec } from '../../lib/widget-spec';

/**
 * Generic calculator island. It contains no calculator-specific logic: everything it shows comes
 * from `spec` (a plain-data snapshot of the config, so the first paint, defaults and default
 * result, is in the server HTML) and, after hydration, from the real config loaded by slug.
 */
export interface CalculatorWidgetProps {
  spec: WidgetSpec;
  /** split: inputs left, results card right. compact: one input row, oversized result. stack: inputs above results. */
  variant?: 'split' | 'compact' | 'stack';
}

const DEBOUNCE_MS = 150;
/** How long a result must stay unchanged before a screen reader is told about it. */
const ANNOUNCE_MS = 400;

const FORWARD = '';

const SOLVING_HINT = 'Worked out from the result you asked for, so it cannot be typed.';

type Values = Record<string, string>;

export default function CalculatorWidget({ spec, variant = 'stack' }: CalculatorWidgetProps) {
  const uid = useId();
  const [values, setValues] = useState<Values>(spec.defaults);
  const [results, setResults] = useState<Record<string, string>>(spec.initialResults);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [solveName, setSolveName] = useState(FORWARD);
  const [targetOutput, setTargetOutput] = useState(spec.outputs[0]?.name ?? '');
  const [targetValue, setTargetValue] = useState('');
  const [solveError, setSolveError] = useState('');
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Currency. `native` is what the server HTML is written in (absent: this calculator shows no money, so no selector).
  // The visitor's choice or detected currency arrives after hydration, so the first paint always matches the HTML.
  const native = spec.currency;
  const [currencyState, setCurrencyState] = useState<CurrencyState | null>(null);
  // A choice applies everywhere. A detected currency applies only to calculators written in USD: a Canada mortgage stays in C$.
  const effective = native ? (currencyState && (currencyState.source === 'chosen' || native === 'USD') ? currencyState.code : native) : undefined;
  const currencyRef = useRef(effective);
  currencyRef.current = effective;
  const shownCurrency = useRef(native);

  const configRef = useRef<CalculatorConfig | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const linkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load calculate() and the validators after hydration. The first paint never waits for this.
  useEffect(() => {
    let live = true;
    loadCalculatorConfig(spec.slug).then((c) => {
      if (live) configRef.current = c;
    });
    return () => {
      live = false;
      clearTimeout(timer.current);
      clearTimeout(copiedTimer.current);
      clearTimeout(linkTimer.current);
    };
  }, [spec.slug]);

  const compute = useCallback(
    async (next: Values, solve: string, output: string, target: string) => {
      const config = (configRef.current ??= await loadCalculatorConfig(spec.slug));
      const nextErrors: Record<string, string> = {};
      for (const input of config.inputs) {
        if (input.name === solve) continue; // its value is the answer, not something to validate
        const parsed = input.validator.safeParse(next[input.name]);
        if (!parsed.success) nextErrors[input.name] = parsed.error.issues[0]?.message ?? 'Check this value';
      }

      let working = next;
      let nextSolveError = '';
      if (solve) {
        if (Object.keys(nextErrors).length === 0) {
          const solved = withCurrency(currencyRef.current, () => solveInput(config, next, solve, output, target));
          if (solved.ok) {
            working = { ...next, [solve]: solved.value };
            setValues(working);
          } else nextSolveError = solved.reason;
        }
      }
      setErrors(nextErrors);
      setSolveError(nextSolveError);
      if (Object.keys(nextErrors).length === 0 && !nextSolveError) {
        shownCurrency.current = currencyRef.current;
        setResults(withCurrency(currencyRef.current, () => config.calculate(working)));
      }
    },
    [spec.slug],
  );

  // The page's "Use with AI" dialog builds its prompt from these, so the assistant gets the numbers the visitor typed.
  useEffect(() => {
    const defaults = Object.fromEntries(shareKeys.map((k) => [k, defaultOf(k)]));
    window.dispatchEvent(new CustomEvent('opus:inputs', { detail: { values: { ...defaults, ...values }, defaults } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce when the values change
  }, [values]);

  // A shared-result link (?homePrice=300000): fill the inputs and recompute. After hydration only, so the server HTML and the
  // first paint stay the default state (CLAUDE.md rule 2). The values go through the same validators as typed input.
  useEffect(() => {
    const found = readShareParams(window.location.search, shareKeys);
    if (Object.keys(found).length === 0) return;
    const next = { ...spec.defaults, ...found };
    setValues(next);
    void compute(next, FORWARD, targetOutput, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  // Follow the visitor's currency (header selector, saved choice, detection). Only calculators that show money listen.
  useEffect(() => {
    if (!native) return;
    startCurrency();
    setCurrencyState(getCurrencyState());
    return onCurrencyChange(setCurrencyState);
  }, [native]);

  // Re-format the shown result when the currency changes. Skipped while the HTML's own currency is still showing.
  useEffect(() => {
    if (!native || shownCurrency.current === effective) return;
    void compute(values, solveName, targetOutput, targetValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a currency change should trigger this
  }, [effective]);

  const schedule = (next: Values, solve = solveName, output = targetOutput, target = targetValue) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void compute(next, solve, output, target), DEBOUNCE_MS);
  };

  const setField = (name: string, value: string) => {
    const next = { ...values, [name]: value };
    setValues(next);
    schedule(next);
  };

  /** Switch units on one or more unit inputs, converting each typed number into the new unit. */
  const switchUnits = (changes: { name: string; unit: string }[]) => {
    const next = { ...values };
    for (const { name, unit } of changes) {
      const options = spec.inputs.find((i) => i.name === name)?.unitOptions;
      const from = options?.find((o) => o.value === (values[`${name}Unit`] ?? options[0].value));
      const to = options?.find((o) => o.value === unit);
      next[name] = convertValue(values[name] ?? '', from, to);
      next[`${name}Unit`] = unit;
    }
    setValues(next);
    schedule(next);
  };

  // The inputs a shared-result link carries: every input, plus the unit pick of each unit input.
  const shareKeys = spec.inputs.flatMap((i) => (i.type === 'unit' && i.unitOptions ? [i.name, `${i.name}Unit`] : [i.name]));
  const defaultOf = (key: string): string => {
    if (spec.defaults[key] !== undefined) return spec.defaults[key];
    const unitOf = spec.inputs.find((i) => `${i.name}Unit` === key);
    return unitOf?.unitOptions?.[0]?.value ?? '';
  };
  const changed = solveName !== FORWARD || shareKeys.some((k) => (values[k] ?? defaultOf(k)) !== defaultOf(k));

  const reset = () => {
    clearTimeout(timer.current);
    setValues(spec.defaults);
    setSolveName(FORWARD);
    setTargetValue('');
    setErrors({});
    setSolveError('');
    if (native && effective !== native) void compute(spec.defaults, FORWARD, targetOutput, '');
    else {
      shownCurrency.current = native;
      setResults(spec.initialResults);
    }
  };

  // "Loan amount ($)" follows the chosen symbol: "Loan amount (€)".
  const nativeSymbol = native ? symbolOf(native) : '';
  const shownSymbol = effective ? symbolOf(effective) : '';
  const labelOf = (label: string) => (native && shownSymbol !== nativeSymbol ? label.split(`(${nativeSymbol})`).join(`(${shownSymbol})`) : label);
  const currencyWhy =
    currencyState?.source === 'chosen'
      ? 'your choice'
      : native && native !== 'USD'
        ? 'this calculator is written for it'
        : currencyState?.source === 'detected'
          ? currencyState.detail
          : '';
  const shownCurrencyInfo = effective ? getCurrency(effective) : undefined;

  const copy = async () => {
    const text = spec.outputs
      .filter((o) => results[o.name])
      .map((o) => `${o.label}: ${results[o.name]}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard blocked (insecure context or permissions): nothing useful to do. */
    }
  };

  const shareResult = async () => {
    const defaults = Object.fromEntries(shareKeys.map((k) => [k, defaultOf(k)]));
    const url = shareResultUrl(window.location.href, values, defaults, shareKeys);
    // The page's own Share dialog (CalculatorToolbar) takes this when there is one: it cancels the event to say so. Without it
    // (the embedded copy has no toolbar) fall back to the system share sheet, then the clipboard.
    const title = document.querySelector('h1')?.textContent?.trim() || document.title;
    const lines = spec.outputs.filter((o) => results[o.name]).map((o) => `${o.label}: ${results[o.name]}`);
    const text = [title, ...lines].join('\n');
    if (!window.dispatchEvent(new CustomEvent('opus:share', { cancelable: true, detail: { url, title, text } }))) return;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return; // the visitor closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      clearTimeout(linkTimer.current);
      linkTimer.current = setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* Clipboard blocked: nothing useful to do. */
    }
  };

  // Metric/imperial: one switch for every unit input, offered only when each has exactly two choices.
  const unitInputs = spec.inputs.filter((i) => i.type === 'unit' && i.unitOptions);
  const canToggleUnits = unitInputs.length > 0 && unitInputs.every((i) => i.unitOptions?.length === 2);
  const unitSetLabel = (index: 0 | 1) => unitInputs.map((i) => i.unitOptions![index].label).join(' · ');
  const unitSetActive = (index: 0 | 1) => unitInputs.every((i) => values[`${i.name}Unit`] === i.unitOptions![index].value);
  const setUnitSet = (index: 0 | 1) => {
    switchUnits(unitInputs.map((i) => ({ name: i.name, unit: i.unitOptions![index].value })));
  };

  const solvable = spec.solveFor ? spec.inputs.filter((i) => i.type === 'number' && i.min !== undefined && i.max !== undefined) : [];
  const targetable = spec.outputs.filter((o) => o.format !== 'text' && o.format !== 'date');

  const id = (name: string) => `${uid}-${name}`;
  const hasErrors = Object.keys(errors).length > 0 || solveError !== '';
  const compact = variant === 'compact';
  const shown = spec.outputs.filter((o) => results[o.name]);
  const headline = shown.filter((o) => o.highlight);
  const rest = shown.filter((o) => !o.highlight);

  // What a screen reader is told. It changes with every result, but is only handed to the live region once it has held
  // still for 400 ms, so typing "250000" does not announce 2, 25, 250, 2500, 25000 and 250000.
  const announcement = shown.map((o) => `${o.label}: ${results[o.name]}`).join('. ');
  const [announced, setAnnounced] = useState(announcement);
  useEffect(() => {
    const t = setTimeout(() => setAnnounced(announcement), ANNOUNCE_MS);
    return () => clearTimeout(t);
  }, [announcement]);

  return (
    <section
      id="calculator"
      tabIndex={-1}
      aria-label="Calculator"
      className={cn(
        'scroll-mt-20 rounded-lg border border-border bg-card p-4 shadow-md focus:outline-none sm:p-6',
        variant === 'split' && 'grid gap-6 lg:grid-cols-2',
      )}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          clearTimeout(timer.current);
          void compute(values, solveName, targetOutput, targetValue);
        }}
        noValidate
      >
        {shownCurrencyInfo && (
          <div role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-accent-soft px-3 py-2 text-sm">
            <span>
              Results in <strong>{currencyLongLabel(shownCurrencyInfo)}</strong>
            </span>
            {currencyWhy && <span className="text-muted">· {currencyWhy}</span>}
            <button
              type="button"
              className="font-medium text-accent underline underline-offset-2"
              onClick={() => window.dispatchEvent(new Event(OPEN_SELECTOR_EVENT))}
            >
              Change
            </button>
          </div>
        )}

        {canToggleUnits && (
          <div role="group" aria-label="Units" className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Units</span>
            {([0, 1] as const).map((i) => (
              <Button key={i} size="sm" variant={unitSetActive(i) ? 'default' : 'outline'} aria-pressed={unitSetActive(i)} onClick={() => setUnitSet(i)}>
                {unitSetLabel(i)}
              </Button>
            ))}
          </div>
        )}

        {solvable.length > 0 && (
          <div>
            <Label htmlFor={id('solve')}>Solve for</Label>
            <Select
              id={id('solve')}
              value={solveName}
              onChange={(e) => {
                setSolveName(e.target.value);
                setSolveError('');
                schedule(values, e.target.value);
              }}
            >
              <option value={FORWARD}>Calculate the result from my inputs</option>
              {solvable.map((i) => (
                <option key={i.name} value={i.name}>
                  Solve for {labelOf(i.label).toLowerCase()}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className={cn('gap-4', compact ? 'grid sm:grid-cols-2 lg:grid-cols-3' : 'space-y-4')}>
          {spec.inputs.map((input) => {
            const error = errors[input.name];
            const solving = solveName === input.name;
            const errorId = id(`${input.name}-error`);
            const common = {
              id: id(input.name),
              name: input.name,
              value: values[input.name] ?? '',
              'aria-invalid': error ? true : undefined,
              'aria-required': true,
              // A field being solved for is read-only and says why, instead of just going grey.
              'aria-describedby': error ? errorId : solving ? id(`${input.name}-solving`) : undefined,
              'aria-disabled': solving ? true : undefined,
              title: solving ? SOLVING_HINT : undefined,
              disabled: solving,
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setField(input.name, e.target.value),
            };
            return (
              <div key={input.name} className={cn(!compact && 'ledger-row')}>
                <Label htmlFor={common.id} className={cn(!compact && 'ledger-label')}>
                  {labelOf(input.label)}
                </Label>
                <div className={cn('flex gap-2', compact ? 'mt-1' : 'ledger-field')}>
                  {input.type === 'select' ? (
                    <Select {...common}>
                      {input.unitOptions?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      {...common}
                      type={input.type === 'date' ? 'date' : 'text'}
                      inputMode={input.type === 'number' || input.type === 'unit' ? 'decimal' : undefined}
                      autoComplete="off"
                    />
                  )}
                  {input.type === 'unit' && input.unitOptions && (
                    <Select
                      aria-label={`${input.label} unit`}
                      className="w-24 shrink-0"
                      value={values[`${input.name}Unit`] ?? input.unitOptions[0].value}
                      onChange={(e) => switchUnits([{ name: input.name, unit: e.target.value }])}
                    >
                      {input.unitOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
                {solving && (
                  <p id={id(`${input.name}-solving`)} className="mt-1 text-sm text-muted">
                    {SOLVING_HINT}
                  </p>
                )}
                {error && (
                  <p id={errorId} className="mt-1 text-sm text-danger">
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {solveName && (
          <div className="rounded-md bg-accent-soft p-3">
            <p className="mb-2 text-sm font-medium">I want this result</p>
            <div className="flex gap-2">
              <Select
                aria-label="Result to match"
                value={targetOutput}
                onChange={(e) => {
                  setTargetOutput(e.target.value);
                  schedule(values, solveName, e.target.value);
                }}
              >
                {targetable.map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Input
                aria-label="Target value"
                aria-invalid={solveError ? true : undefined}
                aria-describedby={solveError ? id('solve-error') : undefined}
                inputMode="decimal"
                value={targetValue}
                placeholder="Target"
                onChange={(e) => {
                  setTargetValue(e.target.value);
                  schedule(values, solveName, targetOutput, e.target.value);
                }}
              />
            </div>
            {solveError && (
              <p id={id('solve-error')} className="mt-2 text-sm text-danger">
                {solveError}
              </p>
            )}
          </div>
        )}

        {/* A quiet text button under the inputs. Greyed out until something changed; aria-disabled (not disabled) keeps it focusable and the reason is read out. */}
        <div>
          <button
            type="button"
            data-toolbar="reset"
            aria-disabled={changed ? undefined : true}
            aria-describedby={changed ? undefined : id('reset-hint')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-muted underline-offset-2 transition-colors hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              !changed && 'cursor-not-allowed opacity-50 hover:no-underline',
            )}
            onClick={() => {
              if (changed) reset();
            }}
          >
            <RotateCcw size={14} aria-hidden="true" /> Clear all changes
          </button>
          {!changed && (
            <span id={id('reset-hint')} className="sr-only">
              Nothing has changed yet.
            </span>
          )}
        </div>
      </form>

      <div data-stale={hasErrors ? 'true' : undefined} className={cn('result-card', variant === 'stack' && 'mt-6', compact && 'mt-6 text-center')}>
        <h2 className="sr-only">Result</h2>
        {hasErrors && (
          <p className="mb-3 text-sm font-medium">
            Fix the highlighted input to update the result. <span className="stale-tag">stale</span>
          </p>
        )}
        {/* Screen readers hear the result here, once the number has stopped changing for 400 ms; the visible copy below is hidden from them. */}
        <output aria-live="polite" aria-atomic="true" className="sr-only">
          {announced}
        </output>
        <dl aria-hidden="true" className="space-y-4">
          {headline.map((o) => (
            <div key={o.name}>
              <dt className="result-muted text-sm font-medium">{o.label}</dt>
              <dd className={cn('result-value', compact ? 'text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl')}>{results[o.name]}</dd>
            </div>
          ))}
          {rest.map((o) => (
            <div key={o.name} className={cn('flex flex-wrap justify-between gap-x-4 border-t border-dashed border-border pt-3', compact && 'justify-center')}>
              <dt className="result-muted text-sm">{o.label}</dt>
              <dd className="result-value text-lg">{results[o.name]}</dd>
            </div>
          ))}
        </dl>
        <p className="result-exact">
          <span aria-hidden="true" className="result-dot" /> Exact decimal arithmetic
        </p>
        {/* The actions belong with the answer. Dark glass buttons keep white text readable on every result gradient. */}
        <div className={cn('mt-5 flex flex-wrap gap-2', compact && 'justify-center')}>
          <button type="button" className="result-btn" aria-label="Copy results" onClick={() => void copy()}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="result-btn" data-toolbar="share-result" onClick={() => void shareResult()}>
            {linkCopied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {linkCopied ? 'Link copied' : 'Share result'}
          </button>
          <span role="status" className="sr-only">
            {linkCopied ? 'Link to this result copied' : ''}
          </span>
        </div>
      </div>
    </section>
  );
}
