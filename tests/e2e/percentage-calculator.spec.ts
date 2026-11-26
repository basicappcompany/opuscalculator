import { expect, test } from '@playwright/test';
import { announced, expectNoAxeViolations, openCalculator } from './helpers';

test.describe('Percentage calculator', () => {
  test('switching what is solved for changes the question and the answer', async ({ page }) => {
    await openCalculator(page, 'percentage-calculator');
    const mode = page.getByLabel('What do you want to find?');

    // What is A% of B? 15% of 200 by default, then 25% of 80.
    await expect(announced(page)).toContainText('15% of 200 is 30');
    await page.getByLabel('Value A').fill('25');
    await page.getByLabel('Value B').fill('80');
    await expect(announced(page)).toContainText('25% of 80 is 20');

    // A is what percent of B? 30 of 200.
    await mode.selectOption({ label: 'A is what percent of B?' });
    await page.getByLabel('Value A').fill('30');
    await page.getByLabel('Value B').fill('200');
    await expect(announced(page)).toContainText('30 is 15% of 200');

    // Percentage change from A to B: 50 to 75 is a 50% increase.
    await mode.selectOption({ label: 'Percentage change from A to B' });
    await page.getByLabel('Value A').fill('50');
    await page.getByLabel('Value B').fill('75');
    await expect(announced(page)).toContainText('+50%');

    await expectNoAxeViolations(page);
  });
});
