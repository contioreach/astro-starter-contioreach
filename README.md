# Astro Headless CMS Starter

A complete, production-shaped blog built with **Astro 7** and a **headless CMS**, using [ContioReach](https://contioreach.com) as the content backend.

Not a toy. It ships the things a real content site actually needs and most examples skip: a tagged response cache, an on-demand revalidation webhook, category archives, pagination, a table of contents generated from the article body, full SEO metadata, JSON-LD, and a sitemap — with **no client-side framework at all**.

```bash
npx degit contioreach/astro-starter-contioreach my-blog
cd my-blog && npm install
cp .env.example .env   # add your API key
npm run dev
```

> Looking for another stack? See the [Next.js](https://github.com/contioreach/nextjs-starter-contioreach), [Nuxt](https://github.com/contioreach/nuxtjs-starter-contioreach) and [SvelteKit](https://github.com/contioreach/sveltekit-starter-contioreach) examples.

---

## What's in the box

| Feature | Where |
| --- | --- |
| Blog index with pagination | [`src/pages/blog/index.astro`](src/pages/blog/index.astro) |
| Article page | [`src/pages/blog/[slug].astro`](src/pages/blog/%5Bslug%5D.astro) |
| Category archives | [`src/pages/blog/category/[slug].astro`](src/pages/blog/category/%5Bslug%5D.astro) |
| CMS client and transforms | [`src/lib/cms.js`](src/lib/cms.js) |
| Response cache + tags | [`astro.config.mjs`](astro.config.mjs) |
| On-demand revalidation webhook | [`src/pages/api/revalidate/all.js`](src/pages/api/revalidate/all.js) |
| Table of contents + stable heading anchors | [`src/lib/content.js`](src/lib/content.js) |
| Metadata, Open Graph, JSON-LD | [`src/components/layout/Seo.astro`](src/components/layout/Seo.astro), [`src/lib/schema.js`](src/lib/schema.js) |
| Sitemap and robots | [`src/pages/sitemap.xml.js`](src/pages/sitemap.xml.js), [`src/pages/robots.txt.js`](src/pages/robots.txt.js) |
| Article typography (raw CMS HTML) | [`src/styles/global.css`](src/styles/global.css) |

Styling is Tailwind CSS v4. No UI library, no content collections, no database — the CMS is the only backend.

---

## 1. Environment variables

Copy the template and fill it in:

```bash
cp .env.example .env
```

```env
CMS_API_URL=https://cms-api.contioreach.com
CMS_API_KEY=cms_xxxxxxxxxxxxxxxxxxxxxxxx
REVALIDATION_SECRET=revalidate_xxxxxxxxxxxx
PUBLIC_SITE_URL=http://localhost:4321
PUBLIC_ALLOW_INDEXING=false
PUBLIC_SIGNUP_URL=https://app.contioreach.com/signup
PUBLIC_LOGIN_URL=https://app.contioreach.com/login
```

Get `CMS_API_KEY` and `REVALIDATION_SECRET` from your ContioReach workspace settings (the free plan is enough).

Every variable is declared once, in [`astro.config.mjs`](astro.config.mjs) under `env`, where **Astro validates it for you** — type, URL-ness and presence. A missing or malformed variable fails at startup with a named error instead of quietly 401ing against the CMS. The three CMS values are declared `context: "server", access: "secret"`, so they never enter the client bundle; the `PUBLIC_*` four are the only ones that reach the browser.

**Running the built server:** secrets are read from the real process environment at runtime, not from `.env` (that file is a build-time convenience). So either export them in your host's dashboard, or pass the file explicitly:

```bash
npm run build
node --env-file=.env ./dist/server/entry.mjs
```

---

## 2. Fetching content

Pages call [`src/lib/cms.js`](src/lib/cms.js) directly in their frontmatter — that code runs on the server, so the API key never reaches the browser and there is no `/api/*` hop to hide it behind.

Components never see the API's shape: a transform layer maps it first, so swapping in Contentful, Sanity or Strapi is `apiRequest` plus two `transform*` functions, without touching a component.

The article body is prepared in one pass while rendering ([`src/lib/content.js`](src/lib/content.js)): heading anchors added, and the table of contents built from that same pass so the two cannot drift.

---

## 3. Caching and revalidation

This is the part Astro 7 does unusually well, and it's the closest of the three examples to Next's `revalidateTag`.

**The response cache.** [`astro.config.mjs`](astro.config.mjs) enables a cache provider and declares route rules:

```js
cache: { provider: memoryCache({ max: 500 }) },
routeRules: {
  "/blog/[slug]": { maxAge: 3600, swr: 86400, tags: ["blogs"] },
  // …
}
```

A rendered response is held for `maxAge`, then served **stale** for up to `swr` seconds while it refreshes behind the request — so no visitor waits on the CMS. Because the whole response is cached, a hit never runs your page code or touches the API at all: one cache to reason about rather than a data cache and a page cache that can disagree.

The `tags` are real cache tags. An article also adds its own inside the page:

```astro
Astro.cache.set({ tags: [`blog-${post.slug}`] });
```

**The webhook.** `POST /api/revalidate/all` is what your CMS calls on publish. It checks the shared secret, then drops exactly the entries carrying those tags:

```bash
curl -X POST https://your-site.com/api/revalidate/all \
  -H 'content-type: application/json' \
  -d '{"secret":"revalidate_xxx","post":{"slug":"my-post"}}'
```

Naming a post in the body adds its `blog-<slug>` tag to the purge. The secret is accepted in the body or as an `X-API-Key` header; anything else gets a 401.

You can watch it work through the `X-Astro-Cache` response header — `MISS`, then `HIT`, then `MISS` again after a purge.

**Two things to know:**

- **The cache is a no-op in `astro dev`.** Build and run the server (or `npm run preview`) to exercise it.
- **`memoryCache` is per-process.** A webhook that lands on one instance only invalidates that instance. Before scaling out, use a shared provider, or put a CDN that honours `Cache-Tag` in front — the route rules already emit the headers for it.

---

## 4. No client-side framework

The table of contents scroll-spy, the reading progress bar and the copy-link button are plain `<script>` tags on server-rendered HTML — see [`TableOfContents.astro`](src/components/blog/TableOfContents.astro).

The result, measured on the article page of this repo: **three inline module scripts, about 1.5 KB of JavaScript total, and zero bundles in `dist/client/`.** No React, no Vue, no hydration, no islands to opt into.

---

## 5. SEO

- Canonical, Open Graph, Twitter card, robots and keywords come from one component, [`Seo.astro`](src/components/layout/Seo.astro), given the same props on every route.
- `BlogPosting` and `BreadcrumbList` JSON-LD from [`src/lib/schema.js`](src/lib/schema.js).
- `/sitemap.xml` is generated from the CMS on request; `/robots.txt` follows the same switch as the meta tags.
- Posts fall back to `/og-default.png` when they have no cover image — drop your own into `public/` before launch.
- **Indexing is off by default.** Until `PUBLIC_ALLOW_INDEXING` is `true`, every page ships `noindex, nofollow` and `robots.txt` disallows everything — so a demo deployment can't compete with your posts' canonical home.

---

## 6. Project structure

```
src/
  components/blog/     Cards, listing, hero, TOC, share bar, article detail
  components/layout/   Header, footer, SEO head, JSON-LD
  layouts/             The one HTML shell
  lib/                 CMS client, article prep, formatting, schemas
  pages/               /, /blog, /blog/[slug], /blog/category/[slug], 404
  pages/api/           The revalidation webhook
  styles/global.css    Tailwind entry + article typography for raw CMS HTML
  consts.js            Values that don't vary by environment
astro.config.mjs       Env schema, cache provider, route rules and tags
```

---

## 7. Deploying

`npm run build` produces a Node server in `dist/`. Astro also builds for Vercel, Netlify, Cloudflare and others by swapping the adapter — see [Astro deployment](https://docs.astro.build/en/guides/deploy/). Set the same environment variables there, with `PUBLIC_SITE_URL` pointing at your real domain, and point the CMS publish webhook at `https://your-domain/api/revalidate/all`.

If your host's adapter ships its own cache provider, drop `memoryCache()` and let it use the platform's — the route rules and tags stay exactly as they are.

---

## License

MIT — see [LICENSE](LICENSE). Clone it, strip it back, rebrand it, ship it.
