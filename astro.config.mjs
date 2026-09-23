// @ts-check
import node from "@astrojs/node";
import { defineConfig, envField, memoryCache } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  /* Rendered on demand, because the publish webhook and the response cache
     both need a server. Individual routes can still opt into prerendering
     with `export const prerender = true`. */
  output: "server",
  adapter: node({ mode: "standalone" }),

  site: process.env.PUBLIC_SITE_URL || "http://localhost:4321",
  vite: { plugins: [tailwindcss()] },

  /* Every environment variable is declared once, here, and validated by Astro
     at startup — a missing or malformed one fails the build rather than
     shipping a site that 401s against the CMS. `context: "server"` keeps a
     value out of the client bundle entirely; `access: "secret"` additionally
     keeps it out of the prerendered output. */
  env: {
    schema: {
      CMS_API_URL: envField.string({ context: "server", access: "secret", url: true }),
      CMS_API_KEY: envField.string({ context: "server", access: "secret" }),
      REVALIDATION_SECRET: envField.string({ context: "server", access: "secret" }),

      PUBLIC_SITE_URL: envField.string({ context: "client", access: "public", url: true }),
      PUBLIC_ALLOW_INDEXING: envField.boolean({ context: "client", access: "public", default: false }),
      PUBLIC_SIGNUP_URL: envField.string({ context: "client", access: "public", url: true }),
      PUBLIC_LOGIN_URL: envField.string({ context: "client", access: "public", url: true }),
    },
  },

  /* Astro's response cache is the closest thing here to the Next example's
     ISR: a rendered response is held for `maxAge`, then served stale for up
     to `swr` seconds while it refreshes behind the request. The `tags` are
     real cache tags — the publish webhook (src/pages/api/revalidate/all.js)
     calls cache.invalidate({ tags }) and exactly those entries are dropped.

     Note the cache is a no-op in `astro dev`; build and `astro preview` (or a
     real deployment) to see it work. */
  cache: { provider: memoryCache({ max: 500 }) },

  routeRules: {
    "/": { maxAge: 3600, swr: 86400, tags: ["blogs", "categories"] },
    "/blog": { maxAge: 3600, swr: 86400, tags: ["blogs", "categories"] },
    "/blog/[slug]": { maxAge: 3600, swr: 86400, tags: ["blogs"] },
    "/blog/category/[slug]": { maxAge: 3600, swr: 86400, tags: ["blogs", "categories"] },
    "/sitemap.xml": { maxAge: 3600, swr: 86400, tags: ["blogs", "categories"] },
  },
});
