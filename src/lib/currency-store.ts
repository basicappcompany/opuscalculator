import { DEFAULT_CURRENCY, currencyForRegion, currencyFromLanguage, isCurrencyCode, isLocalHost, regionFromTrace } from './currency';

/**
 * The visitor's display currency, shared by the header selector and every calculator widget on the page.
 * Browser only. Pages are static, so the HTML always ships the calculator's own currency and this re-formats after load.
 *
 * Order of precedence:
 *   1. what the visitor chose (kept in localStorage, so it follows them between pages and visits),
 *   2. detected: Cloudflare's country for the visitor (/cdn-cgi/trace), else the country in the browser language,
 *   3. USD.
 * Detection never asks for the browser's geolocation permission and sets no cookie.
 */
export type CurrencySource = 'chosen' | 'detected' | 'default';

export interface CurrencyState {
  code: string;
  source: CurrencySource;
  /** Short reason shown to the visitor, e.g. "from your browser language". */
  detail: string;
}

export const CURRENCY_EVENT = 'opus:currency';
export const OPEN_SELECTOR_EVENT = 'opus:open-currency';
const CHOSEN_KEY = 'opus-currency';
const DETECTED_KEY = 'opus-currency-detected';

type Holder = { __opusCurrency?: CurrencyState; __opusCurrencyStarted?: boolean };
const root = (): Holder => globalThis as unknown as Holder;

const read = (storage: 'localStorage' | 'sessionStorage', key: string): string | null => {
  try {
    return globalThis[storage]?.getItem(key) ?? null;
  } catch {
    return null; // private mode, blocked site data
  }
};
const write = (storage: 'localStorage' | 'sessionStorage', key: string, value: string): void => {
  try {
    globalThis[storage]?.setItem(key, value);
  } catch {
    /* nothing useful to do */
  }
};

export function getCurrencyState(): CurrencyState {
  return root().__opusCurrency ?? { code: DEFAULT_CURRENCY, source: 'default', detail: '' };
}

function publish(next: CurrencyState): void {
  const prev = getCurrencyState();
  root().__opusCurrency = next;
  if (prev.code !== next.code || prev.source !== next.source) globalThis.dispatchEvent?.(new CustomEvent(CURRENCY_EVENT, { detail: next }));
}

/** Subscribe to changes. Returns the unsubscribe function. */
export function onCurrencyChange(fn: (state: CurrencyState) => void): () => void {
  const handler = () => fn(getCurrencyState());
  globalThis.addEventListener?.(CURRENCY_EVENT, handler);
  return () => globalThis.removeEventListener?.(CURRENCY_EVENT, handler);
}

/** The visitor picked a currency. It wins over detection from now on. */
export function chooseCurrency(code: string): void {
  if (!isCurrencyCode(code)) return;
  const upper = code.toUpperCase();
  write('localStorage', CHOSEN_KEY, upper);
  publish({ code: upper, source: 'chosen', detail: 'your choice' });
}

/** Back to detection (forget the choice). */
export function clearChosenCurrency(): void {
  try {
    globalThis.localStorage?.removeItem(CHOSEN_KEY);
  } catch {
    /* ignore */
  }
  publish(detectedNow() ?? { code: DEFAULT_CURRENCY, source: 'default', detail: '' });
}

function detectedNow(): CurrencyState | null {
  const cached = read('sessionStorage', DETECTED_KEY);
  if (cached && isCurrencyCode(cached.split('|')[0])) {
    const [code, why] = cached.split('|');
    return { code, source: 'detected', detail: why || 'from your location' };
  }
  const fromLanguage = currencyFromLanguage(globalThis.navigator?.language);
  return fromLanguage ? { code: fromLanguage, source: 'detected', detail: 'from your browser language' } : null;
}

/**
 * Start once per page: apply what is saved or detected right away, then refine with the visitor's country from
 * Cloudflare in the background (a 1.5 s limit; locally and off Cloudflare the request just fails and is ignored).
 */
export function startCurrency(): void {
  if (root().__opusCurrencyStarted) return;
  root().__opusCurrencyStarted = true;

  const chosen = read('localStorage', CHOSEN_KEY);
  if (chosen && isCurrencyCode(chosen)) {
    publish({ code: chosen.toUpperCase(), source: 'chosen', detail: 'your choice' });
    return;
  }
  const now = detectedNow();
  if (now) publish(now);

  if (read('sessionStorage', DETECTED_KEY) || typeof fetch !== 'function' || isLocalHost(globalThis.location?.hostname)) return;
  const abort = typeof AbortController === 'function' ? new AbortController() : undefined;
  const timer = setTimeout(() => abort?.abort(), 1500);
  fetch('/cdn-cgi/trace', { signal: abort?.signal, cache: 'no-store' })
    .then((r) => (r.ok ? r.text() : ''))
    .then((text) => {
      const code = currencyForRegion(regionFromTrace(text));
      if (!code) return;
      write('sessionStorage', DETECTED_KEY, `${code}|from your location`);
      // The visitor may have chosen while this was in flight: a choice always wins.
      if (getCurrencyState().source !== 'chosen') publish({ code, source: 'detected', detail: 'from your location' });
    })
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
}
