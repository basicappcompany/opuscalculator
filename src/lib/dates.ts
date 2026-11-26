/** Calendar helpers on ISO dates (YYYY-MM-DD). UTC throughout so daylight saving never shifts a day. All pure. */

export const parseIso = (iso: string): { y: number; m: number; d: number } => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
};

export const utcMs = (iso: string): number => {
  const { y, m, d } = parseIso(iso);
  return Date.UTC(y, m - 1, d);
};

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();
export const isLeap = (year: number): boolean => daysInMonth(year, 2) === 29;

export const daysBetween = (startIso: string, endIso: string): number => Math.round((utcMs(endIso) - utcMs(startIso)) / 86400000);

/**
 * Years, months and days from start to end (end must not be before start), counted like a person would:
 * the largest whole number of months that fits, then the leftover days. When the start day does not exist
 * in a month (31st, or 29 Feb in a non-leap year) the anniversary is the last day of that month, except that
 * a 29 February start is observed on 1 March in non-leap years.
 */
export function ymd(startIso: string, endIso: string): { years: number; months: number; days: number } {
  const s = parseIso(startIso);
  const e = parseIso(endIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const anchor = (months: number): string => {
    const t = s.m - 1 + months;
    const y = s.y + Math.floor(t / 12);
    const m = (((t % 12) + 12) % 12) + 1;
    const dim = daysInMonth(y, m);
    if (s.d <= dim) return `${y}-${pad(m)}-${pad(s.d)}`;
    if (s.m === 2 && s.d === 29) return `${y}-03-01`;
    return `${y}-${pad(m)}-${pad(dim)}`;
  };
  let months = (e.y - s.y) * 12 + (e.m - s.m);
  if (daysBetween(anchor(months), endIso) < 0) months -= 1;
  return { years: Math.floor(months / 12), months: months % 12, days: daysBetween(anchor(months), endIso) };
}

/** Monday to Friday days in the half-open range [start, end). */
export function weekdaysBetween(startIso: string, endIso: string): number {
  const total = daysBetween(startIso, endIso);
  if (total <= 0) return 0;
  const startDow = new Date(utcMs(startIso)).getUTCDay(); // 0 = Sunday
  const full = Math.floor(total / 7);
  let count = full * 5;
  for (let k = 0; k < total % 7; k++) {
    const dow = (startDow + k) % 7;
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export const addDaysIso = (iso: string, days: number): string => new Date(utcMs(iso) + days * 86400000).toISOString().slice(0, 10);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const longDate = (iso: string): string => {
  const { y, m, d } = parseIso(iso);
  return `${WEEKDAYS[new Date(utcMs(iso)).getUTCDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
};
