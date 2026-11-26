import type { APIRoute } from 'astro';
import { buildSitemaps, renderIndex } from '../lib/sitemaps';

// Partitioned by cohort and category, published URLs only (Prompt 6). Replaces the stock sitemap integration,
// which cannot name files by tier.
export const GET: APIRoute = () => new Response(renderIndex(buildSitemaps()), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
