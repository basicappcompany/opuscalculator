/**
 * A best-effort rate limit for the MCP Function: 60 requests a minute per address, counted in one isolate's memory.
 * It is a speed bump, not a guarantee (another isolate has its own count). For a hard limit use a Cloudflare rate limiting
 * rule on /mcp (README, "MCP server").
 */
const WINDOW_MS = 60_000;
export const LIMIT = 60;
const MAX_TRACKED = 5_000;

const hits = new Map<string, { windowStart: number; count: number }>();

/** True once `ip` has made more than LIMIT requests in the current minute. */
export function overLimit(ip: string, now = Date.now()): boolean {
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    if (hits.size > MAX_TRACKED) hits.clear(); // never let the map grow without bound
    hits.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}
