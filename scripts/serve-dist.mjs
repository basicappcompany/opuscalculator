// Serves dist/ over HTTP for the browser suites (npm run e2e, npm run visual, and Playwright's webServer).
//   node scripts/serve-dist.mjs [port]      default port 4173
import { startStaticServer } from './static-server.mjs';

try {
  const { base } = await startStaticServer(undefined, Number(process.argv[2] ?? 4173));
  console.log(`serving dist on ${base}`);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
