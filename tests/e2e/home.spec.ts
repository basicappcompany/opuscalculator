import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './helpers';

// Home page, site search and the agents page (UX rebuild, agent-first branding).
test.use({ viewport: { width: 1280, height: 800 } });

test('the home page leads with the agent-first promise, search and the MCP address', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Exact calculators for people and AI agents');
  await expect(page.getByLabel('MCP server address')).toHaveValue('https://opuscalculator.com/mcp');
  await expectNoAxeViolations(page);
});

test('search opens with the / key, filters the published calculators and opens one', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: 'Search calculators' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox').fill('mortg');
  await expect(dialog.getByRole('link', { name: /Mortgage Calculator/ })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /BMI Calculator/ })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await dialog.getByRole('searchbox').press('Enter');
  await expect(page).toHaveURL(/\/calculators\/mortgage-calculator\//);
});

test('the agents page explains the MCP set-up and is linked from the footer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'For AI agents' }).click();
  await expect(page).toHaveURL(/\/agents\//);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Opus Calculator for AI agents');
  await expect(page.getByLabel('Claude Code, one command')).toHaveValue('claude mcp add --transport http opus-calculator https://opuscalculator.com/mcp');
  await expectNoAxeViolations(page);
});

test('the MCP address can be copied from the home page and from /agents', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  for (const path of ['/', '/agents/']) {
    await page.goto(path);
    const button = page.locator('[data-copy-for$="-mcp"]');
    await button.click();
    await expect(button).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://opuscalculator.com/mcp');
  }
});
