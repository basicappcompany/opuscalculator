import { expect, test } from '@playwright/test';

/**
 * Visual regression (Prompt 17, step 3): one page per layout, in light and dark, at a desktop and a phone width,
 * 3 x 2 x 2 = 12 snapshots. A layout change that moves any of them fails the run.
 *
 *   Layout A (finance, health)  bmi-calculator
 *   Layout B (math, physics)    percentage-calculator
 *   Layout C (everyday life)    age-calculator    (the plan names tip-calculator, which is not published yet)
 *
 * Baselines are committed in layouts.spec.ts-snapshots/. Playwright names them per browser and operating system
 * (-chromium-win32.png), because text anti-aliasing differs between systems, so the committed set is the Windows one.
 * On another system run `npm run visual -- --update-snapshots` once and review the images before committing them.
 */
const PAGES = [
  { layout: 'A', slug: 'bmi-calculator' },
  { layout: 'B', slug: 'percentage-calculator' },
  { layout: 'C', slug: 'age-calculator' },
] as const;
const SCHEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const { layout, slug } of PAGES) {
  for (const scheme of SCHEMES) {
    for (const viewport of VIEWPORTS) {
      test(`layout ${layout} ${slug} ${scheme} ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(`/calculators/${slug}/`);
        await page.locator('#calculator').waitFor();
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`layout-${layout}-${slug}-${scheme}-${viewport.name}.png`, { fullPage: true });
      });
    }
  }
}
