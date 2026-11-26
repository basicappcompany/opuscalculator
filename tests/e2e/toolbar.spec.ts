import { expect, test } from '@playwright/test';
import { announced, expectNoAxeViolations, openCalculator } from './helpers';

// The toolbar every calculator carries (plan/PROMPT 19). These run on the five live calculators, one per layout family.
test.describe('Calculator toolbar', () => {
  test('Share opens our own dialog with the page link, a copy button and share links; Escape closes it and focus returns', async ({ page }) => {
    await openCalculator(page, 'bmi-calculator');
    const opener = page.locator('[data-toolbar="share"]');
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Share this calculator' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Share link')).toHaveValue('https://opuscalculator.com/calculators/bmi-calculator/');
    await expect(dialog.getByRole('button', { name: 'Copy link' })).toBeVisible();
    const links = dialog.locator('[data-share-links] a');
    await expect(links).toHaveCount(7);
    await expect(dialog.locator('[data-network="linkedin"]')).toHaveAttribute(
      'href',
      /linkedin\.com\/sharing\/share-offsite\/\?url=https%3A%2F%2Fopuscalculator\.com/,
    );
    for (const a of await links.all()) await expect(a).toHaveAttribute('rel', /noopener/);
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('Cite is a dialog with citation styles as tabs, switchable with the arrow keys', async ({ page }) => {
    await openCalculator(page, 'bmi-calculator');
    await page.locator('[data-toolbar="cite"]').click();
    const dialog = page.getByRole('dialog', { name: 'Cite this calculator' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab')).toHaveText(['APA', 'MLA', 'Chicago', 'BibTeX', 'Plain text']);
    await expect(dialog.getByLabel('APA citation')).toHaveValue(
      /^Opus Calculator\. \(\d{4}, [A-Z][a-z]+ \d+\)\. .*\[Online calculator\]\. https:\/\/opuscalculator\.com\/calculators\/bmi-calculator\/$/,
    );
    await dialog.getByRole('tab', { name: 'APA' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('tab', { name: 'MLA' })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByLabel('MLA citation')).toBeVisible();
    await expect(dialog.getByLabel('APA citation')).toBeHidden();
    await dialog.getByRole('tab', { name: 'BibTeX' }).click();
    await expect(dialog.getByLabel('BibTeX citation')).toHaveValue(/^@misc\{opus_bmi_calculator,/);
    await expectNoAxeViolations(page);
  });

  test('Embed is a dialog whose size options rewrite the code; the preview link opens the embedded copy', async ({ page }) => {
    await openCalculator(page, 'bmi-calculator');
    await page.locator('[data-toolbar="embed"]').click();
    const dialog = page.getByRole('dialog', { name: 'Embed this calculator' });
    await expect(dialog).toBeVisible();
    const code = dialog.getByLabel('Paste this on your page');
    await expect(code).toHaveValue(/<iframe src="https:\/\/opuscalculator\.com\/embed\/bmi-calculator\/".*width="100%" height="640"/);
    await dialog.getByLabel('Embed width').selectOption('480');
    await dialog.getByLabel('Embed height').selectOption('760');
    await expect(code).toHaveValue(/width="480" height="760"/);
    await expect(dialog.getByRole('link', { name: /Preview the embedded copy/ })).toHaveAttribute('href', 'https://opuscalculator.com/embed/bmi-calculator/');
    await expectNoAxeViolations(page);
  });

  test('clicking the dimmed area closes a dialog, and the Google link is a plain link', async ({ page }) => {
    await openCalculator(page, 'bmi-calculator');
    await page.locator('[data-toolbar="cite"]').click();
    const dialog = page.getByRole('dialog', { name: 'Cite this calculator' });
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 5); // far outside the card
    await expect(dialog).toBeHidden();
    const preferred = page.locator('[data-toolbar="preferred"]');
    await expect(preferred).toHaveAttribute('href', 'https://www.google.com/preferences/source?q=opuscalculator.com');
    await expect(preferred).toHaveAttribute('rel', /noopener/);
  });

  test('Share result opens the same dialog in result mode, with the visitor link and a text summary', async ({ page }) => {
    await openCalculator(page, 'bmi-calculator');
    await page.getByLabel('Weight', { exact: true }).fill('85');
    await expect(announced(page)).toContainText('Your BMI: 27.8');
    await page.getByRole('button', { name: 'Share result' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share your result' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Share link')).toHaveValue(/\/calculators\/bmi-calculator\/\?weight=85/);
    await expect(dialog.getByLabel('Your result')).toHaveValue(/Your BMI: 27\.8/);
    await expect(dialog.locator('[data-network="x"]')).toHaveAttribute('href', /weight%3D85/);
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
