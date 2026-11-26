import type { APIRoute } from 'astro';
import { buildSitemaps, renderSitemap, type SitemapFile } from '../lib/sitemaps';

export function getStaticPaths() {
  return buildSitemaps().map((file) => ({ params: { name: file.name.replace(/^sitemap-/, '') }, props: { file } }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(renderSitemap(props.file as SitemapFile), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
