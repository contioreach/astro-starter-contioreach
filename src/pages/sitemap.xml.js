import { PUBLIC_SITE_URL } from "astro:env/client";
import { getAllBlogSlugs, getAllCategorySlugs } from "../lib/cms.js";

function entry(loc, lastmod, priority) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;
}

export async function GET() {
  const [posts, categories] = await Promise.all([getAllBlogSlugs(), getAllCategorySlugs()]);
  const now = new Date().toISOString();

  const urls = [
    entry(`${PUBLIC_SITE_URL}/`, now, 1),
    entry(`${PUBLIC_SITE_URL}/blog`, now, 0.9),
    ...categories.map((c) => entry(`${PUBLIC_SITE_URL}/blog/category/${c.slug}`, now, 0.7)),
    ...posts.map((p) => entry(`${PUBLIC_SITE_URL}/blog/${p.slug}`, now, 0.8)),
  ];

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
