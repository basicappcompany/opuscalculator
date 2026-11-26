// Runs a TypeScript script with the project's own Vite resolution, so it can import src/lib/registry.ts
// (which uses import.meta.glob) the same way the Astro build does. No extra dependency: Vite ships with Astro.
//
//   node scripts/run.mjs scripts/count-calculators.ts [args...]
//
// Environment flags (COHORT_2_PUBLISHED=true and so on) are read exactly as in a build.
import { createServer } from 'vite';
import { resolve } from 'node:path';

const [, , script, ...args] = process.argv;
if (!script) {
  console.error('usage: node scripts/run.mjs <script.ts> [args...]');
  process.exit(2);
}

const server = await createServer({
  root: process.cwd(),
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});

let code = 0;
try {
  const mod = await server.ssrLoadModule(resolve(script));
  if (typeof mod.default === 'function') code = (await mod.default(args)) ?? 0;
} catch (error) {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  code = 1;
} finally {
  await server.close();
}
process.exit(code);
