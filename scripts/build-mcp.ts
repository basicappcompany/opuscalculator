// Bundles every calculator and the MCP protocol handler into .mcp/mcp-core.mjs, which functions/mcp.ts imports.
// Runs inside `npm run build`, before Cloudflare compiles the Functions, so the bundle always matches the site's code.
// Fails the build if the bundle would not fit a Cloudflare Worker (3 MB compressed on the free plan).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

export const OUT_DIR = '.mcp';
export const OUT_FILE = 'mcp-core.mjs';
/** The Worker size limit on the free plan is 3 MB compressed; stop well before it so growth to about 4,000 calculators still fits. */
export const MAX_GZIP_BYTES = 2.4 * 1024 * 1024;

export default async function main(): Promise<number> {
  await build({
    configFile: false,
    root: process.cwd(),
    logLevel: 'warn',
    build: {
      ssr: 'src/mcp/entry.ts',
      outDir: OUT_DIR,
      emptyOutDir: true,
      minify: true,
      target: 'es2022',
      rollupOptions: { output: { entryFileNames: OUT_FILE, format: 'es' } },
    },
    ssr: { noExternal: true, target: 'webworker' },
  });
  const bytes = readFileSync(join(OUT_DIR, OUT_FILE));
  const gzip = gzipSync(bytes).length;
  const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
  if (gzip > MAX_GZIP_BYTES) {
    console.error(`build-mcp FAILED: the MCP bundle is ${kb(gzip)} gzipped, over the ${kb(MAX_GZIP_BYTES)} budget (a Worker may be 3 MB compressed).`);
    return 1;
  }
  console.log(`build-mcp OK: ${OUT_DIR}/${OUT_FILE} ${kb(bytes.length)} (${kb(gzip)} gzipped) of ${kb(MAX_GZIP_BYTES)} budget.`);
  return 0;
}
