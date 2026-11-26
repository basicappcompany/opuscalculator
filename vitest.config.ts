import { configDefaults, defineConfig } from 'vitest/config';

// Astro's tsconfig keeps JSX as-is for its own compiler; tests need it compiled.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  // The Playwright suites (npm run e2e, npm run visual) run in a browser through their own runner, not through vitest.
  test: { exclude: [...configDefaults.exclude, 'tests/e2e/**', 'tests/visual/**'] },
});
