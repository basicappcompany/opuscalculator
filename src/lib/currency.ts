/**
 * Currencies a visitor can show results in. Symbol and number formatting only: typed amounts are never
 * converted, because prices and rates are inputs on this site (no exchange-rate feed).
 *
 * The page HTML always ships the calculator's own currency (USD for most), so the default result is in the
 * raw HTML (CLAUDE.md rule 2). A chosen or detected currency re-formats in the browser after load.
 */
export interface Currency {
  code: string;
  /** Prefix shown before the amount. Alphabetic symbols carry a trailing space ("CHF 1,000.00"). */
  symbol: string;
  name: string;
  /** Decimal places: 2 for most, 0 for currencies with no minor unit in everyday use. */
  dp: number;
}

const c = (code: string, symbol: string, name: string, dp = 2): Currency => ({ code, symbol, name, dp });

export const CURRENCIES: readonly Currency[] = [
  c('USD', '$', 'US dollar'),
  c('EUR', '€', 'Euro'),
  c('GBP', '£', 'British pound'),
  c('INR', '₹', 'Indian rupee'),
  c('CAD', 'C$', 'Canadian dollar'),
  c('AUD', 'A$', 'Australian dollar'),
  c('JPY', '¥', 'Japanese yen', 0),
  c('CNY', 'CN¥', 'Chinese yuan'),
  c('CHF', 'CHF ', 'Swiss franc'),
  c('SEK', 'kr ', 'Swedish krona'),
  c('NOK', 'kr ', 'Norwegian krone'),
  c('DKK', 'kr ', 'Danish krone'),
  c('NZD', 'NZ$', 'New Zealand dollar'),
  c('SGD', 'S$', 'Singapore dollar'),
  c('HKD', 'HK$', 'Hong Kong dollar'),
  c('KRW', '₩', 'South Korean won', 0),
  c('BRL', 'R$', 'Brazilian real'),
  c('MXN', 'MX$', 'Mexican peso'),
  c('ZAR', 'R ', 'South African rand'),
  c('AED', 'AED ', 'UAE dirham'),
  c('SAR', 'SAR ', 'Saudi riyal'),
  c('TRY', '₺', 'Turkish lira'),
  c('PLN', 'zł ', 'Polish zloty'),
  c('THB', '฿', 'Thai baht'),
  c('IDR', 'Rp ', 'Indonesian rupiah', 0),
  c('PHP', '₱', 'Philippine peso'),
  c('NGN', '₦', 'Nigerian naira'),
  c('PKR', 'Rs ', 'Pakistani rupee'),
  c('EGP', 'E£', 'Egyptian pound'),
  c('VND', '₫', 'Vietnamese dong', 0),
  c('ILS', '₪', 'Israeli shekel'),
];

/** Shown first in the selector. */
export const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY'] as const;

export const DEFAULT_CURRENCY = 'USD';

const BY_CODE = new Map(CURRENCIES.map((x) => [x.code, x]));

export const getCurrency = (code: string | null | undefined): Currency | undefined => (code ? BY_CODE.get(code.toUpperCase()) : undefined);

export const isCurrencyCode = (code: unknown): code is string => typeof code === 'string' && BY_CODE.has(code.toUpperCase());

/** "$" for USD, "CHF" for CHF: the symbol without its spacing, for labels such as "Loan amount ($)". */
export const symbolOf = (code: string): string => (getCurrency(code)?.symbol ?? '$').trim();

/** Selector text: "USD · $". */
export const currencyOptionLabel = (cur: Currency): string => `${cur.code} · ${cur.symbol.trim()}`;

/** "US dollar ($)". */
export const currencyLongLabel = (cur: Currency): string => `${cur.name} (${cur.symbol.trim()})`;

// ---------------------------------------------------------------------------------------------------
// Ambient currency. calculate() is a pure function that returns strings, and fmtCurrency() reads this
// when it is set, so one calculator can show any currency without every calculator taking a parameter.
// It is scoped with withCurrency() (always restored), so nothing leaks between pages, tests or builds.
// ---------------------------------------------------------------------------------------------------
let active: Currency | null = null;

export const activeCurrency = (): Currency | null => active;

/** Run `fn` with `code` as the display currency. An unknown or empty code means "the calculator's own". */
export function withCurrency<T>(code: string | null | undefined, fn: () => T): T {
  const previous = active;
  active = getCurrency(code) ?? null;
  try {
    return fn();
  } finally {
    active = previous;
  }
}

// ---------------------------------------------------------------------------------------------------
// Detection. Never the browser's geolocation prompt: a permission pop-up is bad UX and needs no consent here.
// The country comes from Cloudflare (/cdn-cgi/trace, no cookie) with the browser language as the fallback.
// ---------------------------------------------------------------------------------------------------
const EURO_COUNTRIES = ['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'];

const REGION_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  IN: 'INR',
  JP: 'JPY',
  CN: 'CNY',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  BR: 'BRL',
  MX: 'MXN',
  ZA: 'ZAR',
  SG: 'SGD',
  HK: 'HKD',
  KR: 'KRW',
  AE: 'AED',
  SA: 'SAR',
  TR: 'TRY',
  PL: 'PLN',
  NG: 'NGN',
  PK: 'PKR',
  PH: 'PHP',
  ID: 'IDR',
  TH: 'THB',
  VN: 'VND',
  EG: 'EGP',
  IL: 'ILS',
  ...Object.fromEntries(EURO_COUNTRIES.map((r) => [r, 'EUR'])),
};

/** Currency for a two-letter country code, or undefined when we have no match. */
export const currencyForRegion = (region: string | null | undefined): string | undefined => REGION_CURRENCY[(region ?? '').toUpperCase()];

/** Currency from a BCP 47 language tag such as "en-GB" or "pt_BR". A bare "en" says nothing about the country. */
export function currencyFromLanguage(tag: string | null | undefined): string | undefined {
  const region = /^[a-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(tag ?? '')?.[1];
  return currencyForRegion(region);
}

/** True for the machine's own hosts, where Cloudflare's /cdn-cgi/trace does not exist (asking would log a 404 in the console). */
export const isLocalHost = (hostname: string | null | undefined): boolean =>
  /^(localhost|127(\.\d+){3}|\[::1\]|::1)$/i.test(hostname ?? '') || /\.(localhost|local|test)$/i.test(hostname ?? '');

/** Country code from the text Cloudflare serves at /cdn-cgi/trace ("loc=GB"). */
export function regionFromTrace(text: string): string | undefined {
  const loc = /^loc=([A-Za-z]{2})\s*$/m.exec(text)?.[1]?.toUpperCase();
  return loc && loc !== 'XX' && loc !== 'T1' ? loc : undefined;
}
