import { expect, test } from '@playwright/test';
import { announced, expectNoAxeViolations, openCalculator } from './helpers';

test.describe('Mortgage calculator', () => {
  test('matches a reference amortization schedule to the cent', async ({ page }) => {
    await openCalculator(page, 'mortgage-calculator');
    await expect(announced(page)).toContainText('Monthly payment (principal and interest): $2,022.62');

    // $250,000 price, $50,000 down: a $200,000 loan at 6% for 30 years.
    await page.getByLabel(/Home price/).fill('250000');
    await page.getByLabel(/Down payment/).fill('50000');
    await page.getByLabel(/Interest rate/).fill('6');
    await page.getByLabel(/Loan term/).fill('30');
    await expect(announced(page)).toContainText('Monthly payment (principal and interest): $1,199.10');
    await expect(announced(page)).toContainText('Loan amount: $200,000.00');
    // From a month-by-month schedule, with the payment and each month's interest rounded to the cent.
    await expect(announced(page)).toContainText('Total interest: $231,677.04');
    await expect(announced(page)).toContainText('Total paid to the lender: $431,677.04');

    // A shorter term: $100,000 at 5% over 15 years.
    await page.getByLabel(/Home price/).fill('100000');
    await page.getByLabel(/Down payment/).fill('0');
    await page.getByLabel(/Interest rate/).fill('5');
    await page.getByLabel(/Loan term/).fill('15');
    await expect(announced(page)).toContainText('Monthly payment (principal and interest): $790.79');
    await expect(announced(page)).toContainText('Total interest: $42,343.24');

    await expectNoAxeViolations(page);
  });

  test('the currency selector changes the symbol and not the numbers', async ({ page }) => {
    await openCalculator(page, 'mortgage-calculator');
    await page.locator('#currency-select').selectOption('EUR');
    await expect(announced(page)).toContainText('Monthly payment (principal and interest): €2,022.62');
    await expect(page.getByLabel('Home price (€)')).toBeVisible();
    await page.locator('#currency-select').selectOption('JPY');
    await expect(announced(page)).toContainText('¥2,023'); // yen has no decimals
    await page.locator('#currency-select').selectOption('USD');
    await expect(announced(page)).toContainText('$2,022.62');
  });
});
