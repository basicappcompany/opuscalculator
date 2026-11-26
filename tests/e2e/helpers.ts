import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Opens a calculator page and waits for its React island to hydrate (a keystroke before that would be ignored). */
export async function openCalculator(page: Page, slug: string): Promise<void> {
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
