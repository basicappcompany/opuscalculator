import { expect, test } from '@playwright/test';
import { announced, expectNoAxeViolations, openCalculator } from './helpers';

test.describe('BMI calculator', () => {
  test('metric values, imperial toggle, reset', async ({ page }) => {
    await openCalculator(page, 'bmi-calculator');

    // The default result is in the page before any input: 70 kg, 175 cm.
    await expect(announced(page)).toContainText('Your BMI: 22.9');

    // Metric: 85 kg at 175 cm is a BMI of 27.8.
    await page.getByLabel('Weight', { exact: true }).fill('85');
    await expect(announced(page)).toContainText('Your BMI: 27.8');
    await expect(announced(page)).toContainText('Weight category (WHO): Overweight');

    // Imperial: the typed numbers are converted, so the same person has (to rounding) the same BMI.
    await page.getByRole('button', { name: 'lb · in' }).click();
    await expect(page.getByRole('button', { name: 'lb · in' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Weight', { exact: true })).toHaveValue(/^187\.\d/);
    await expect(announced(page)).toContainText(/Your BMI: 27\.[89]/);

    // Reset returns the defaults and the default result.
    await page.getByRole('button', { name: 'Clear all changes' }).click();
    await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('70');
    await expect(page.getByLabel('Height', { exact: true })).toHaveValue('175');
    await expect(announced(page)).toContainText('Your BMI: 22.9');

    await expectNoAxeViolations(page);
  });

  test('an invalid value keeps the last result and marks it stale', async ({ page }) => {
    await openCalculator(page, 'bmi-calculator');
    await page.getByLabel('Weight', { exact: true }).fill('abc');
    await expect(page.locator('.stale-tag')).toBeVisible();
    await expect(page.getByLabel('Weight', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(announced(page)).toContainText('Your BMI: 22.9'); // the last valid result is kept
    await expectNoAxeViolations(page);
  });
});
