export function formatDate(value, { month = "short" } = {}) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month, day: "numeric" });
}

export function initials(name) {
  if (!name) return "CR";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "") || name.slice(0, 2)).toUpperCase();
}

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* Reading time is optional in the CMS. When it is missing, estimate it from
   the body so the byline never renders a hole. */
export function readingTimeFor(post) {
  if (post.readingTime) return post.readingTime;
  const body = post.content || post.html;
  if (!body) return null;
  const words = String(body).replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 225))} min read`;
}
