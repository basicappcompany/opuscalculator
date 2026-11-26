import { expect, test } from '@playwright/test';
import { announced, expectNoAxeViolations, openCalculator } from './helpers';

// The calculator page is built tool-first (UX rebuild, item 20.14): the tool is on the first screen, the answer's actions sit on the
// result card, and the "Use with AI" dialog follows the numbers the visitor typed.
const FIRST_INPUT = {
  'bmi-calculator': /^Weight$/,
  'mortgage-calculator': /Home price/,
  'percentage-calculator': /What do you want to find/,
  'age-calculator': /Date of birth/,
} as const;

test.describe('Tool first', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const [slug, label] of Object.entries(FIRST_INPUT)) {
    test(`on a phone the first input of ${slug} is on the first screen`, async ({ page }) => {
      await openCalculator(page, slug);
      await expect(page.getByLabel(label).first()).toBeInViewport();
      // One sentence under the title, not a paragraph: the rest of the intro is further down the page.
      const lede = await page.locator('[data-lede]').innerText();
      expect(lede.split(/[.!?]\s/).length, lede).toBeLessThanOrEqual(2);
    });
  }
});

test.describe('Answer and actions together', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('on a desktop the result is in the first screen, beside the inputs, with Copy and Share result on the card', async ({ page }) => {
    for (const slug of ['bmi-calculator', 'percentage-calculator', 'age-calculator']) {
      await openCalculator(page, slug);
      const card = page.locator('#calculator .result-card');
      await expect(card, slug).toBeInViewport({ ratio: 0.6 });
      await expect(card.getByRole('button', { name: 'Copy results' }), slug).toBeVisible();
      await expect(card.getByRole('button', { name: 'Share result' }), slug).toBeVisible();
    }
  });

  test('Use with AI explains how to connect, and its prompt follows the numbers typed', async ({ page }) => {
    await openCalculator(page, 'bmi-calculator');
    await page.locator('[data-toolbar="ai"]').click();
    const dialog = page.getByRole('dialog', { name: 'Use this calculator with AI' });
    await expect(dialog).toBeVisible();
    const prompt = dialog.getByLabel('1. Ask your assistant');
    await expect(prompt).toHaveValue(/https:\/\/opuscalculator\.com\/mcp.*slug "bmi-calculator".*the calculator defaults/);
    await expect(dialog.getByLabel('MCP server address')).toHaveValue('https://opuscalculator.com/mcp');
    await expect(dialog.getByLabel('Claude Code, one command')).toHaveValue('claude mcp add --transport http opus-calculator https://opuscalculator.com/mcp');
    await expect(dialog.getByRole('link', { name: /Markdown copy of this calculator/ })).toHaveAttribute(
      'href',
      'https://opuscalculator.com/calculators/bmi-calculator.md',
    );
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');

    await page.getByLabel('Weight', { exact: true }).fill('85');
    await expect(announced(page)).toContainText('Your BMI: 27.8');
    await page.locator('[data-toolbar="ai"]').click();
    await expect(prompt).toHaveValue(/inputs \{"weight":"85"\}/);
    await expect(dialog.getByText('This prompt carries the numbers you entered.')).toBeVisible();
  });
});
