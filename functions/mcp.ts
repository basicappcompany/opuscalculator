// Cloudflare Pages Function: the Opus Calculator MCP server at /mcp (plan/PROMPT 19, item 20.7).
//
// MCP over plain HTTP, stateless: POST one JSON-RPC message, get one JSON reply (HTTP 202 and no body for a
// notification). Read-only: it runs calculators and nothing else, stores nothing and calls no other service.
// The calculators and the protocol handler are in .mcp/mcp-core.mjs, bundled by scripts/build-mcp.ts during
// `npm run build` (generated, git-ignored), so the answers are the ones the pages show.
//
// Which calculators exist for a caller comes from /calculators.json, written by the same build as the site: the server
// cannot expose a page the site does not publish (CLAUDE.md rule 6).
//
// Limits: a 16 KB body, short values, and a best-effort per-IP rate limit that lives in one isolate's memory. That is a
// speed bump, not a guarantee: for a hard limit add a Cloudflare rate limiting rule on /mcp (README "MCP server").

import { overLimit } from '../src/mcp/rate-limit';

// @ts-expect-error the bundle is generated at build time and untyped; the error is the same whether or not it exists yet
import * as core from '../.mcp/mcp-core.mjs';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}
interface Context {
  request: Request;
  env: Env;
}
interface Core {
  MAX_BODY_BYTES: number;
  handleMcp: (message: unknown, published: ReadonlySet<string>) => unknown;
}
const mcp = core as unknown as Core;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id',
};
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS };

const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
const rpcError = (status: number, code: number, message: string): Response => json({ jsonrpc: '2.0', id: null, error: { code, message } }, status);

// Published slugs, cached for a minute per isolate.
let published: { at: number; slugs: Set<string> } | null = null;
async function publishedSlugs(request: Request, env: Env): Promise<Set<string>> {
  if (published && Date.now() - published.at < 60_000) return published.slugs;
  const res = await env.ASSETS.fetch(new Request(new URL('/calculators.json', request.url)));
  if (!res.ok) throw new Error(`calculators.json answered ${res.status}`);
  const data = (await res.json()) as { calculators?: { slug?: string }[] };
  const slugs = new Set((data.calculators ?? []).map((c) => c.slug).filter((s): s is string => typeof s === 'string'));
  published = { at: Date.now(), slugs };
  return slugs;
}

export const onRequestOptions = (): Response => new Response(null, { status: 204, headers: CORS });

export const onRequestGet = (): Response =>
  json(
    {
      name: 'Opus Calculator MCP server',
      transport: 'Streamable HTTP, stateless: POST one JSON-RPC message to this URL',
      tools: ['list_calculators', 'describe_calculator', 'calculate'],
      docs: 'https://opuscalculator.com/llms.txt',
    },
    405,
    { Allow: 'POST, OPTIONS' },
  );

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
  if (overLimit(request.headers.get('CF-Connecting-IP') ?? 'unknown')) return rpcError(429, -32000, 'Too many requests. Try again in a minute.');
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > mcp.MAX_BODY_BYTES) return rpcError(413, -32600, 'Request too large.');
  const body = await request.text();
  if (body.length > mcp.MAX_BODY_BYTES) return rpcError(413, -32600, 'Request too large.');
  let message: unknown;
  try {
    message = JSON.parse(body);
  } catch {
    return rpcError(400, -32700, 'Parse error: the body is not valid JSON.');
  }
  let slugs: Set<string>;
  try {
    slugs = await publishedSlugs(request, env);
  } catch {
    return rpcError(503, -32000, 'The calculator index is unavailable. Try again shortly.');
  }
  const reply = mcp.handleMcp(message, slugs);
  return reply === null ? new Response(null, { status: 202, headers: CORS }) : json(reply);
};
