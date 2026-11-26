import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Opens a calculator page and waits for its React island to hydrate (a keystroke before that would be ignored).
 * The visitor's chosen currency is pinned first (it wins over detection, see src/lib/currency-store.ts): on a deployed
 * site the page re-formats to the currency detected for the visitor (Cloudflare country or browser language), and the
 * tests assert exact numbers with the calculators' own currency symbol. Pass a code to test another currency.
 */
export async function openCalculator(page: Page, slug: string, currency = 'USD'): Promise<void> {
  await page.addInitScript((code) => {
    try {
      localStorage.setItem('opus-currency', code);
    } catch {
      /* site data blocked: nothing to pin */
    }
  }, currency);
  await page.goto(`/calculators/${slug}/`);
  await page.locator('#calculator').waitFor();
  await page.waitForLoadState('networkidle');
}

/** The text a screen reader is told: every result, announced once it has settled. Same text the page shows. */
export const announced = (page: Page) => page.locator('#calculator output[aria-live="polite"]');

/** Fails the test on any axe violation, listing each rule and the first element it hit. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.map((v) => `${v.id} (${v.impact}): ${v.help} - ${v.nodes[0]?.target?.join(' ')}`),
    'axe-core violations',
  ).toEqual([]);
}
