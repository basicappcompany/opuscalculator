import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import bmi from '../src/calculators/bmi-calculator';
import discount from '../src/calculators/discount-calculator';
import mortgage from '../src/calculators/mortgage-calculator';
import CalculatorWidget from '../src/components/calculator/CalculatorWidget';
import generateFinance from '../src/generators/finance';
import generateEmerging from '../src/generators/emerging';
import { runWith } from '../src/lib/calc-utils';
import {
  CURRENCIES,
  POPULAR_CURRENCIES,
  activeCurrency,
  currencyForRegion,
  currencyFromLanguage,
  getCurrency,
  isLocalHost,
  regionFromTrace,
  symbolOf,
  withCurrency,
} from '../src/lib/currency';
import { currencyOf } from '../src/lib/currency-of';
import { fmtCurrency } from '../src/lib/format';
import { parseResultNumber } from '../src/lib/solve';
import { toWidgetSpec } from '../src/lib/widget-spec';

// Building every finance calculator takes a few seconds on a busy machine: do it once, lazily, for this file.
let financeCache: ReturnType<typeof generateFinance> | undefined;
const finance = () => (financeCache ??= generateFinance());
const SLOW = 30_000;

describe('currency list', () => {
  it('has unique codes, every popular code exists, and a symbol for each', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const p of POPULAR_CURRENCIES) expect(getCurrency(p), p).toBeDefined();
    for (const c of CURRENCIES) expect(c.symbol.trim().length, c.code).toBeGreaterThan(0);
  });

  it('looks codes up case-insensitively and rejects unknown ones', () => {
    expect(getCurrency('eur')?.symbol).toBe('€');
    expect(getCurrency('XXX')).toBeUndefined();
    expect(getCurrency(null)).toBeUndefined();
    expect(symbolOf('CHF')).toBe('CHF');
  });
});

describe('fmtCurrency with a chosen currency', () => {
  it('is USD by default and keeps an explicit symbol when nothing is chosen', () => {
    expect(fmtCurrency('1234.5')).toBe('$1,234.50');
    expect(fmtCurrency('1234.5', 'C$')).toBe('C$1,234.50');
  });

  it('a chosen currency overrides the symbol, including a calculator that passes its own', () => {
    expect(withCurrency('EUR', () => fmtCurrency('1234.5'))).toBe('€1,234.50');
    expect(withCurrency('GBP', () => fmtCurrency('1234.5', 'C$'))).toBe('£1,234.50');
    expect(withCurrency('CHF', () => fmtCurrency('5'))).toBe('CHF 5.00');
  });

  it('uses no decimals for currencies without a minor unit, and still never shows -0', () => {
    expect(withCurrency('JPY', () => fmtCurrency('1234.5'))).toBe('¥1,235');
    expect(withCurrency('KRW', () => fmtCurrency('-0.4'))).toBe('₩0');
  });

  it('puts the minus sign before the symbol', () => {
    expect(withCurrency('INR', () => fmtCurrency('-5'))).toBe('-₹5.00');
  });

  it('is scoped: the previous currency is restored, even when the function throws', () => {
    expect(activeCurrency()).toBeNull();
    withCurrency('EUR', () => expect(activeCurrency()?.code).toBe('EUR'));
    expect(activeCurrency()).toBeNull();
    expect(() =>
      withCurrency('EUR', () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(activeCurrency()).toBeNull();
    withCurrency('EUR', () => withCurrency('GBP', () => expect(activeCurrency()?.code).toBe('GBP')));
  });

  it('an unknown or empty code means the calculator keeps its own currency', () => {
    expect(withCurrency('NOPE', () => fmtCurrency('5'))).toBe('$5.00');
    expect(withCurrency(undefined, () => fmtCurrency('5', 'C$'))).toBe('C$5.00');
  });
});

describe('a real calculator in another currency (typed numbers are never converted)', () => {
  it('mortgage shows the same amounts with the chosen symbol', () => {
    const usd = runWith(mortgage);
    const eur = withCurrency('EUR', () => runWith(mortgage));
    expect(eur.monthlyPayment).toBe(usd.monthlyPayment.replace('$', '€'));
    expect(eur.totalInterest).toBe(usd.totalInterest.replace('$', '€'));
    expect(eur.loanToValue).toBe(usd.loanToValue); // a percentage is not money
  });

  it('the LLM token cost shows its sub-dollar prices with the chosen symbol too', () => {
    const tokens = generateEmerging().find((c) => c.slug === 'llm-token-cost-calculator')!;
    const own = runWith(tokens);
    const eur = withCurrency('EUR', () => runWith(tokens));
    expect(Object.values(own).join(' ')).toContain('$');
    expect(Object.values(eur).join(' ')).not.toContain('$');
    expect(Object.values(eur).join(' ')).toContain('€');
  });
});

describe('solving for an input still reads results in any currency', () => {
  it.each([
    ['$1,234.56', '1234.56'],
    ['-$5.00', '-5'],
    ['C$1,163.21', '1163.21'],
    ['-₹5.00', '-5'],
    ['CHF 1,000.00', '1000'],
    ['€0.50', '0.5'],
    ['12 V', '12'],
    ['22.9', '22.9'],
  ])('parses %s', (text, expected) => {
    expect(parseResultNumber(text)?.toString()).toBe(expected);
  });
  it('returns null when there is no number', () => {
    expect(parseResultNumber('n/a')).toBeNull();
  });
});

describe('which calculators get the selector (currencyOf)', () => {
  it('money calculators are USD and non-money calculators have none', () => {
    expect(currencyOf(mortgage)).toBe('USD');
    expect(currencyOf(discount)).toBe('USD');
    expect(currencyOf(bmi)).toBeUndefined();
  });

  it(
    'country pages carry their own currency',
    () => {
      expect(currencyOf(finance().find((c) => c.slug === 'ca-25-year-mortgage-calculator')!)).toBe('CAD');
      expect(currencyOf(finance().find((c) => c.slug === 'in-20-year-mortgage-calculator')!)).toBe('INR');
      expect(currencyOf(finance().find((c) => c.slug === 'uk-25-year-mortgage-calculator')!)).toBe('GBP');
    },
    SLOW,
  );

  it('is evaluated without leaking a display currency into later calculations', () => {
    currencyOf(mortgage);
    expect(activeCurrency()).toBeNull();
    expect(runWith(mortgage).monthlyPayment).toBe('$2,022.62');
  });
});

describe('detection helpers (no permission prompt, no cookie)', () => {
  it('knows local hosts, where the Cloudflare trace endpoint does not exist', () => {
    for (const h of ['localhost', '127.0.0.1', '[::1]', 'dev.localhost', 'calc.test', 'mybox.local']) expect(isLocalHost(h), h).toBe(true);
    for (const h of ['opuscalculator.com', 'www.opuscalculator.com', 'opuscalculator.pages.dev', '', undefined]) expect(isLocalHost(h), String(h)).toBe(false);
  });

  it('maps a country to a currency, including the euro area', () => {
    expect(currencyForRegion('GB')).toBe('GBP');
    expect(currencyForRegion('de')).toBe('EUR');
    expect(currencyForRegion('IN')).toBe('INR');
    expect(currencyForRegion('ZZ')).toBeUndefined();
    expect(currencyForRegion(undefined)).toBeUndefined();
  });

  it('reads the country from a browser language tag, and ignores a bare language', () => {
    expect(currencyFromLanguage('en-GB')).toBe('GBP');
    expect(currencyFromLanguage('pt_BR')).toBe('BRL');
    expect(currencyFromLanguage('en')).toBeUndefined();
    expect(currencyFromLanguage('')).toBeUndefined();
  });

  it('reads the country from the Cloudflare trace and ignores unknown values', () => {
    expect(regionFromTrace('fl=1\nh=opuscalculator.com\nloc=IN\ntls=TLSv1.3\n')).toBe('IN');
    expect(regionFromTrace('loc=XX\n')).toBeUndefined();
    expect(regionFromTrace('loc=T1\n')).toBeUndefined();
    expect(regionFromTrace('nothing here')).toBeUndefined();
  });
});

describe("the server HTML always ships the calculator's own currency (rule 2)", () => {
  const html = (config = mortgage) => renderToString(createElement(CalculatorWidget, { spec: toWidgetSpec(config), variant: 'split' }));

  it('a money calculator renders in USD with the currency line and a Change control', () => {
    const out = html();
    expect(out).toContain('$2,022.62');
    expect(out).toContain('US dollar ($)');
    expect(out).toContain('Change');
    expect(out).toContain('Home price ($)');
  });

  it('a calculator without money has no currency line', () => {
    expect(html(bmi)).not.toContain('Results in');
  });

  it(
    'a country page is written in its own currency',
    () => {
      const ca = finance().find((c) => c.slug === 'ca-25-year-mortgage-calculator')!;
      const out = html(ca);
      expect(out).toContain('Canadian dollar (C$)');
      expect(out).toContain('C$');
    },
    SLOW,
  );
});

describe('the currency store', () => {
  // Node has no window: give globalThis the few browser pieces the store uses.
  const g = globalThis as Record<string, unknown>;
  const saved: Record<string, unknown> = {};
  const target = new EventTarget();
  const memory = (): Storage => {
    const data = new Map<string, string>();
    return {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, String(v)),
      removeItem: (k) => void data.delete(k),
      clear: () => data.clear(),
      key: () => null,
      get length() {
        return data.size;
      },
    } as Storage;
  };
  let store: typeof import('../src/lib/currency-store');

  beforeEach(async () => {
    for (const k of [
      'addEventListener',
      'removeEventListener',
      'dispatchEvent',
      'localStorage',
      'sessionStorage',
      'fetch',
      '__opusCurrency',
      '__opusCurrencyStarted',
    ])
      saved[k] = g[k];
    g.addEventListener = target.addEventListener.bind(target);
    g.removeEventListener = target.removeEventListener.bind(target);
    g.dispatchEvent = target.dispatchEvent.bind(target);
    g.localStorage = memory();
    g.sessionStorage = memory();
    g.fetch = () => Promise.reject(new Error('offline'));
    delete g.__opusCurrency;
    delete g.__opusCurrencyStarted;
    store = await import('../src/lib/currency-store');
  });
  afterEach(() => {
    delete (g as { navigator?: unknown }).navigator; // drop any test override, the real one shows through again
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete g[k];
      else g[k] = v;
    }
  });

  it('defaults to USD', () => {
    expect(store.getCurrencyState()).toMatchObject({ code: 'USD', source: 'default' });
  });

  it('a choice is saved, announced, and wins over detection on the next visit', () => {
    const seen: string[] = [];
    const off = store.onCurrencyChange((s) => seen.push(`${s.code}:${s.source}`));
    store.chooseCurrency('eur');
    expect(seen).toEqual(['EUR:chosen']);
    expect(g.localStorage && (g.localStorage as Storage).getItem('opus-currency')).toBe('EUR');
    off();

    delete g.__opusCurrency;
    delete g.__opusCurrencyStarted;
    Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-GB' }, configurable: true });
    store.startCurrency();
    expect(store.getCurrencyState()).toMatchObject({ code: 'EUR', source: 'chosen' });
  });

  it('ignores a code that is not a supported currency', () => {
    store.chooseCurrency('NOPE');
    expect(store.getCurrencyState().source).toBe('default');
  });

  it('with nothing chosen it detects from the browser language', () => {
    Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-IN' }, configurable: true });
    store.startCurrency();
    expect(store.getCurrencyState()).toMatchObject({ code: 'INR', source: 'detected', detail: 'from your browser language' });
  });
});
