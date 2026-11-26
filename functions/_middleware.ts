// Cloudflare Pages Function. Two jobs, both cheap and both for the cases a static file cannot handle:
//
//  1. 410 Gone for pages that were deliberately deleted (Prompt 8, item 3). The Pages `_redirects` file supports only the
//     redirect codes 301, 302, 303, 307 and 308, so a static site cannot return 410 any other way.
//  2. 401 for anything under /admin/ that arrives without a Cloudflare Access token (Prompt 15, step 2). Cloudflare Access
//     in front of /admin/* is the real gate and answers before this code runs; this is the second lock, so that if the Access
//     rule is ever removed or misconfigured, /admin/ fails closed instead of open. It checks that the token is present; it
//     does not verify its signature, which needs your Access team domain and audience tag (see README "Protect /admin").
//
// To stop the Function running on every request, the build writes dist/_routes.json (scripts/verify-dist.ts) so that it is
// invoked only for /admin/* and the paths in src/config/gone.json.
//
// STATUS: written from the Cloudflare documentation and unit-tested as plain functions, but NOT deployed or tested on
// Cloudflare Pages. Check with `curl -I` on a gone URL and on /admin/ after the first deploy (items 12.12 and 12.10).
import gone from '../src/config/gone.json';

interface Context {
  request: Request;
  next: () => Promise<Response>;
}

export const goneResponse = (): Response =>
  new Response('410 Gone: this page has been removed.', {
    status: 410,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });

export const isGone = (pathname: string, paths: readonly string[] = (gone as { paths: string[] }).paths): boolean =>
  paths.includes(pathname.endsWith('/') ? pathname : `${pathname}/`);

export const isAdminPath = (pathname: string): boolean => pathname === '/admin' || pathname.startsWith('/admin/');

/** Cloudflare Access adds this header to every request it lets through. A request without it did not pass Access. */
export const hasAccessToken = (headers: Headers): boolean => (headers.get('Cf-Access-Jwt-Assertion') ?? '').trim() !== '';

export const unauthorizedResponse = (): Response =>
  new Response('401 Unauthorized: sign in through Cloudflare Access.', {
    status: 401,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export const onRequest = async (context: Context): Promise<Response> => {
  const { pathname } = new URL(context.request.url);
  if (isAdminPath(pathname) && !hasAccessToken(context.request.headers)) return unauthorizedResponse();
  return isGone(pathname) ? goneResponse() : context.next();
};
