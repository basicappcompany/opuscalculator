// Entry point of the bundle that functions/mcp.ts imports. Built by scripts/build-mcp.ts into .mcp/mcp-core.mjs.
import { buildCatalog } from './catalog';
import { MAX_BODY_BYTES, SERVER_INFO, handleMcpMessage } from './protocol';

const catalog = buildCatalog();

export { MAX_BODY_BYTES, SERVER_INFO };
export const calculatorCount = catalog.size;
/** `published` is the set of slugs in /calculators.json: what the site publishes, nothing more. */
export const handleMcp = (message: unknown, published: ReadonlySet<string>) => handleMcpMessage(message, { catalog, published });
