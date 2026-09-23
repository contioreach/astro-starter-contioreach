import { CMS_API_KEY, CMS_API_URL } from "astro:env/server";
import { API_ENDPOINTS, EMPTY_META } from "../consts.js";

/* Every read goes through here. There is no data cache in front of it on
   purpose: Astro caches the *rendered response* instead (see `routeRules` in
   astro.config.mjs), so a cache hit never reaches this file at all. One cache
   to reason about rather than two that can disagree. */
async function apiRequest(endpoint) {
  const response = await fetch(`${CMS_API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": CMS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error?.message || "API request failed");
  }

  return data;
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.append(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function getBlogs(params = {}) {
  return apiRequest(
    API_ENDPOINTS.BLOGS +
      query({
        page: params.page,
        limit: params.limit,
        category: params.category,
        author: params.author,
        tags: params.tags,
        search: params.search,
        minimal: params.minimal,
      }),
  );
}

// minimal=false so the detail page gets the full HTML body.
export function getBlogBySlug(slug) {
  return apiRequest(API_ENDPOINTS.BLOGS + query({ slug, minimal: "false" }));
}

export function getBlogsByCategory(categorySlug, params = {}) {
  return getBlogs({ ...params, category: categorySlug });
}

export function getCategories(params = {}) {
  return apiRequest(
    API_ENDPOINTS.CATEGORIES +
      query({ page: params.page, limit: params.limit, id: params.id, slug: params.slug }),
  );
}

export function getAuthors(params = {}) {
  return apiRequest(
    API_ENDPOINTS.AUTHORS +
      query({ page: params.page, limit: params.limit, id: params.id, slug: params.slug }),
  );
}

export function getTags(params = {}) {
  return apiRequest(
    API_ENDPOINTS.TAGS +
      query({ page: params.page, limit: params.limit, id: params.id, slug: params.slug }),
  );
}

/* ---- transforms ----
   Components never see the API's shape. Swapping in Contentful, Sanity or
   Strapi is apiRequest above plus these two functions. */

export function transformBlogForDisplay(blog) {
  return {
    id: blog.id,
    slug: blog.slug,
    title: blog.title,
    excerpt: blog.excerpt,
    description: blog.description,
    coverImage: blog.coverImage,
    content: blog.content,
    publishedAt: blog.publishedAt,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
    primaryKeyword: blog.primaryKeyword,
    readingTime: blog.readingTime ? `${blog.readingTime} min read` : null,
    author: blog.authors?.[0] || null,
    authors: blog.authors || [],
    tags: blog.tags || [],
    categories: blog.categories || [],
    category: blog.categories?.[0]?.name || "Uncategorized",
    categorySlug: blog.categories?.[0]?.slug || null,
  };
}

export function transformBlogsForDisplay(blogs) {
  return (blogs || []).map(transformBlogForDisplay);
}

/* ---- page-level loaders ---- */

export async function getPost(slug) {
  try {
    const response = await getBlogBySlug(slug);
    // The API returns a list even when queried by slug.
    const blog = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!response.success || !blog) return null;
    return transformBlogForDisplay(blog);
  } catch (error) {
    console.error("Failed to fetch blog post:", error);
    return null;
  }
}

export async function getCategory(slug) {
  try {
    const response = await getCategories({ slug });
    return response.success && response.data?.length ? response.data[0] : null;
  } catch (error) {
    console.error("Failed to fetch category:", error);
    return null;
  }
}

export async function getRelated(categorySlug, currentId) {
  if (!categorySlug) return [];
  try {
    // Fetch 4 so the current post can be dropped and 3 still remain.
    const response = await getBlogsByCategory(categorySlug, { page: 1, limit: 4, minimal: "true" });
    if (!response.success) return [];
    return transformBlogsForDisplay(response.data)
      .filter((blog) => blog.id !== currentId)
      .slice(0, 3);
  } catch (error) {
    console.error("Failed to fetch related blogs:", error);
    return [];
  }
}

/* Fetch a page of posts plus the category list in one call site, with the
   error handling every listing page needs. A CMS outage renders an empty
   state; it never takes the page down. */
export async function loadListing({ page = 1, limit = 12, category } = {}) {
  const [postsResult, categoriesResult] = await Promise.allSettled([
    category
      ? getBlogsByCategory(category, { page, limit, minimal: "true" })
      : getBlogs({ page, limit, minimal: "true" }),
    getCategories({ limit: 100 }),
  ]);

  let posts = [];
  let meta = { ...EMPTY_META, page, limit };

  if (postsResult.status === "fulfilled" && postsResult.value.success) {
    posts = transformBlogsForDisplay(postsResult.value.data);
    meta = postsResult.value.meta || meta;
  } else if (postsResult.status === "rejected") {
    console.error("API Error:", postsResult.reason);
  }

  const categories =
    categoriesResult.status === "fulfilled" ? categoriesResult.value.data || [] : [];

  return { posts, meta, categories };
}

/* ---- helpers for the sitemap ---- */

export async function getAllBlogSlugs() {
  try {
    const response = await getBlogs({ minimal: "true", limit: 1000 });
    return response.data.map((blog) => ({ slug: blog.slug }));
  } catch (error) {
    console.error("Error fetching blog slugs:", error);
    return [];
  }
}

export async function getAllCategorySlugs() {
  try {
    const response = await getCategories({ limit: 100 });
    return response.data.map((category) => ({ slug: category.slug }));
  } catch (error) {
    console.error("Error fetching category slugs:", error);
    return [];
  }
}
