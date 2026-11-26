import { expect, test } from '@playwright/test';
import { announced, expectNoAxeViolations, openCalculator } from './helpers';

test.describe('Compound interest calculator', () => {
  test('final balance and interest, to the cent', async ({ page }) => {
    await openCalculator(page, 'compound-interest-calculator');
    await expect(announced(page)).toContainText('$16,470.09'); // $10,000 at 5% for 10 years, compounded monthly

    await page.getByLabel(/Starting amount/).fill('20000');
    await expect(announced(page)).toContainText('$32,940.19');
    await expect(announced(page)).toContainText('$12,940.19');
    await expect(announced(page)).toContainText('5.12%'); // effective annual rate

    // Compounded annually instead: 20,000 at 5% for 10 years is 32,577.89.
    await page.getByLabel('Compounded').selectOption('1');
    await expect(announced(page)).toContainText('$32,577.89');

    await expectNoAxeViolations(page);
  });
});
