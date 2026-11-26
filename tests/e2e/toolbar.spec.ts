import { expect, test } from '@playwright/test';
import { announced, expectNoAxeViolations, openCalculator } from './helpers';

// The toolbar every calculator carries (plan/PROMPT 19). These run on the five live calculators, one per layout family.
test.describe('Calculator toolbar', () => {
  test('cite, embed and the Google link are in the page, with the right text', async ({ page }) => {
    await openCalculator(page, 'bmi-calculator');
    await page.locator('[data-toolbar="cite"] summary').click();
    await expect(page.getByLabel('APA')).toHaveValue(
      /^Opus Calculator\. \(\d{4}, [A-Z][a-z]+ \d+\)\. .*\[Online calculator\]\. https:\/\/opuscalculator\.com\/calculators\/bmi-calculator\/$/,
    );

    await page.locator('[data-toolbar="embed"] summary').click();
    await expect(page.getByLabel('Paste this on your page')).toHaveValue(/<iframe src="https:\/\/opuscalculator\.com\/embed\/bmi-calculator\/"/);

    const preferred = page.locator('[data-toolbar="preferred"]');
    await expect(preferred).toHaveAttribute('href', 'https://www.google.com/preferences/source?q=opuscalculator.com');
    await expect(preferred).toHaveAttribute('rel', /noopener/);
    await expectNoAxeViolations(page);
  });

  test('Clear all changes is disabled with a reason until something changes, then restores the defaults', async ({ page }) => {
    await openCalculator(page, 'bmi-calculator');
    const clear = page.getByRole('button', { name: 'Clear all changes' });
    await expect(clear).toHaveAttribute('aria-disabled', 'true');
    await expect(clear).toHaveAccessibleDescription('Nothing has changed yet.');

    await page.getByLabel('Weight', { exact: true }).fill('85');
    await expect(clear).not.toHaveAttribute('aria-disabled', 'true');
    await clear.click();
    await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('70');
    await expect(clear).toHaveAttribute('aria-disabled', 'true');
  });

  test('a shared-result link restores the inputs and the result; the HTML stays the default state', async ({ page, request }) => {
    const slug = 'mortgage-calculator';
    // Raw HTML (no JavaScript, the first paint): still the defaults even when the URL carries inputs.
    const raw = await (await request.get(`/calculators/${slug}/?homePrice=300000`)).text();
    expect(raw).toContain('value="400000"');

    await page.addInitScript(() => localStorage.setItem('opus-currency', 'USD'));
    await page.goto(`/calculators/${slug}/?homePrice=300000&downPayment=60000`);
    await page.locator('#calculator').waitFor();
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel(/Home price/)).toHaveValue('300000');
    await expect(page.getByLabel(/Down payment/)).toHaveValue('60000');
    // $240,000 at 6.5% over 30 years.
    await expect(announced(page)).toContainText('Loan amount: $240,000.00');
    await expect(page.getByRole('button', { name: 'Clear all changes' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('the embedded copy is the calculator alone, noindex, canonical to the real page, and still computes', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('opus-currency', 'USD'));
    await page.goto('/embed/percentage-calculator/');
    await page.locator('#calculator').waitFor();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://opuscalculator.com/calculators/percentage-calculator/');
    await expect(page.getByRole('link', { name: 'Opus Calculator' })).toHaveAttribute('href', 'https://opuscalculator.com/calculators/percentage-calculator/');
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
  });
});
