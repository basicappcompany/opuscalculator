import { expect, test, type Page } from '@playwright/test';
import { SKINS } from '../../src/lib/skins-data';
import { expectNoAxeViolations, openCalculator } from './helpers';

// The design preview (owner request, 27 Nov): every design option on the real site, behind ?design.
const token = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test.describe('Design preview', () => {
  test('is invisible to a normal visitor: no Design button, no skins stylesheet, no stored keys', async ({ page }) => {
    await openCalculator(page, 'bmi-calculator');
    await expect(page.locator('[data-design-button]')).toBeHidden();
    await expect(page.locator('link[href="/skins.css"]')).toHaveCount(0);
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^opus-(design|skin|layout|density)$/.test(k)));
    expect(keys).toEqual([]);
  });

  test('?design shows the picker; choosing a skin restyles the real page, survives a reload and applies on other pages', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('opus-currency', 'USD'));
    await page.goto('/calculators/bmi-calculator/?design');
    await page.waitForLoadState('networkidle');
    const before = await token(page, '--color-accent');
    await page.locator('[data-design-button]').click();
    const dialog = page.getByRole('dialog', { name: 'Design preview' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /Ocean/ })).toBeAttached();
    await dialog.getByText('Ocean', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'ocean');
    expect(await token(page, '--color-accent')).not.toBe(before);
    await page.keyboard.press('Escape');

    await page.goto('/calculators/bmi-calculator/'); // no ?design: the preview is remembered on this device
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'ocean');
    await page.goto('/about/');
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'ocean');
    await expect(page.locator('[data-design-button]')).toBeVisible();
  });

  test('the Instrument layout puts inputs and result side by side with the result kept in view, and "back to current" undoes everything', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(() => localStorage.setItem('opus-currency', 'USD'));
    await page.goto('/calculators/mortgage-calculator/?design');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-design-button]').click();
    const dialog = page.getByRole('dialog', { name: 'Design preview' });
    await dialog.getByText('Instrument', { exact: true }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-layout', 'instrument'); // the Instrument skin suggests its layout
    await dialog.getByText('Compact', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await page.keyboard.press('Escape');
    const layout = await page.evaluate(() => {
      const calc = document.querySelector('#calculator')!;
      const result = calc.querySelector('.result-card')!;
      return { columns: getComputedStyle(calc).gridTemplateColumns.split(' ').length, sticky: getComputedStyle(result).position };
    });
    expect(layout).toEqual({ columns: 2, sticky: 'sticky' });
    await expectNoAxeViolations(page);

    await page.locator('[data-design-button]').click();
    await dialog.getByRole('button', { name: 'Back to the current look' }).click();
    for (const attr of ['data-skin', 'data-layout', 'data-density']) await expect(page.locator('html')).not.toHaveAttribute(attr, /.+/);
  });

  test('?design=off removes the preview and its stored choices', async ({ page }) => {
    await page.goto('/about/?design');
    await expect(page.locator('[data-design-button]')).toBeVisible();
    await page.goto('/about/?design=off');
    await expect(page.locator('[data-design-button]')).toBeHidden();
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^opus-(design|skin|layout|density)$/.test(k)));
    expect(keys).toEqual([]);
  });

  test('every skin passes axe in light and dark on a calculator, the money calculator and the home page', async ({ page }) => {
    test.setTimeout(540_000);
    await page.addInitScript(() => localStorage.setItem('opus-currency', 'USD'));
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    const failures: string[] = [];
    for (const path of ['/calculators/bmi-calculator/?design', '/calculators/mortgage-calculator/?design', '/?design']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      for (const skin of SKINS) {
        for (const theme of ['light', 'dark']) {
          await page.evaluate(
            ([s, t]) => {
              document.documentElement.setAttribute('data-skin', s);
              document.documentElement.setAttribute('data-theme', t);
            },
            [skin.id, theme],
          );
          const { violations } = await new AxeBuilder({ page }).analyze();
          for (const v of violations) failures.push(`${path} ${skin.id} ${theme}: ${v.id} (${v.impact}) ${v.nodes[0]?.target?.join(' ')}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
