import { PUBLIC_ALLOW_INDEXING, PUBLIC_SITE_URL } from "astro:env/client";

export function GET() {
  /* Belt and braces with the per-page `noindex` tags: while the site is closed
     off, crawlers are turned away at the door too. */
  const body = PUBLIC_ALLOW_INDEXING
    ? `User-agent: *\nAllow: /\n\nSitemap: ${PUBLIC_SITE_URL}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
