/* Article body preparation, shared by the renderer and the table of contents
   so the two always agree on heading ids. This runs once while rendering the
   article page, and because that response is cached it does not even run
   again on the next visit. */

export function cleanHeadingText(html) {
  return String(html)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyHeading(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* Articles legitimately repeat a heading, and bare slugs would then produce
   duplicate DOM ids — invalid HTML, and every anchor after the first would
   scroll to the wrong place. Repeats get `-2`, `-3`, and so on. Callers must
   consume an id for *every* heading, including ones they skip, or the two
   sequences drift apart. */
function createHeadingIdFactory() {
  const seen = new Map();
  return function nextId(text, existingId) {
    const base = existingId || slugifyHeading(text) || "section";
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}

const HEADING_RE = /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi;

/* Minimal markdown fallback for posts whose body was stored as plain text. */
function markdownToHtml(text) {
  return text
    .split("\n")
    .map((line) => {
      const heading = line.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${heading[2]}</h${level}>`;
      }
      if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
      if (/^\d+\.\s/.test(line)) return `<li>${line.replace(/^\d+\.\s/, "")}</li>`;
      const bolded = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      if (bolded.trim() && !bolded.startsWith("<")) return `<p>${bolded}</p>`;
      return bolded;
    })
    .join("\n");
}

/* Returns { html, toc } — the body with stable heading ids and wrapped tables,
   plus the headings the TOC renders. */
export function prepareContent(content) {
  if (!content || typeof content !== "string") return { html: "", toc: [] };

  const source = /<[^>]*>/.test(content) ? content : markdownToHtml(content);

  const toc = [];
  const nextId = createHeadingIdFactory();

  const withIds = source.replace(HEADING_RE, (match, level, attributes, inner) => {
    const existing = attributes.match(/\sid=["']([^"']*)["']/i);
    const title = cleanHeadingText(inner);
    const id = nextId(title, existing ? existing[1] : null);

    // h2 and h3 carry the article's structure; h1 is the page title and h4+
    // is too fine-grained for a sidebar.
    if (title && Number(level) >= 2 && Number(level) <= 3) {
      toc.push({ id, title, level: Number(level) });
    }

    // An author-supplied id is left alone unless the source repeats it, in
    // which case the later one is rewritten so inbound anchors still work.
    if (existing && existing[1] === id) return match;
    const cleaned = attributes.replace(/\sid=["'][^"']*["']/i, "");
    return `<h${level}${cleaned} id="${id}">${inner}</h${level}>`;
  });

  // Wide tables scroll inside their own container rather than clipping.
  const html = withIds
    .replace(/<table/gi, '<div class="blog-table-wrap"><table')
    .replace(/<\/table>/gi, "</table></div>");

  return { html, toc };
}
