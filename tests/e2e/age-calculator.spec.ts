import { expect, test } from '@playwright/test';
import { announced, expectNoAxeViolations, openCalculator } from './helpers';

test.describe('Age calculator', () => {
  test('date inputs give years, months and days', async ({ page }) => {
    await openCalculator(page, 'age-calculator');
    await expect(announced(page)).toContainText('Age: 36 years, 5 months, 7 days'); // 15 Jun 1990 to 22 Nov 2026

    await page.getByLabel('Date of birth').fill('1990-05-15');
    await expect(announced(page)).toContainText('Age: 36 years, 6 months, 7 days');
    await expect(announced(page)).toContainText('Total days: 13,340');

    // A leap-day birthday, counted on a non-leap year: 29 Feb 2000 to 28 Feb 2023.
    await page.getByLabel('Date of birth').fill('2000-02-29');
    await page.getByLabel('Age at date').fill('2023-02-28');
    await expect(announced(page)).toContainText('Age: 22 years, 11 months, 30 days');

    await expectNoAxeViolations(page);
  });
});
