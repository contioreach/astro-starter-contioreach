import { REVALIDATION_SECRET } from "astro:env/server";
import { CACHE_TAGS } from "../../../consts.js";

export const prerender = false;

/* Publish webhook from ContioReach. Fired when a post is published, scheduled,
   deleted, or a published post is edited. Body: { secret, post }; the same
   secret is also accepted as the X-API-Key header.

   This is the closest of the three examples to Next's revalidateTag: the route
   rules in astro.config.mjs attach cache tags to each rendered response, and
   invalidate({ tags }) drops exactly the entries carrying them. */
export async function POST(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const secret = body?.secret || context.request.headers.get("x-api-key");

    if (secret !== REVALIDATION_SECRET) {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }

    const tags = Object.values(CACHE_TAGS);

    /* When the webhook names a post, its own tag goes too — the listings are
       dropped by the shared tags either way. */
    if (body?.post?.slug) tags.push(`blog-${body.post.slug}`);

    await context.cache.invalidate({ tags });

    console.log("Blog cache revalidated", {
      slug: body?.post?.slug ?? null,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      message: "All blog cache revalidated successfully",
      revalidated: { tags },
    });
  } catch (error) {
    console.error("Full revalidation error:", error);
    return Response.json(
      { success: false, error: "Failed to revalidate blog cache", details: error.message },
      { status: 500 },
    );
  }
}
