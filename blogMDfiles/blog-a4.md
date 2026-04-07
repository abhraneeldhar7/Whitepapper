# How to Generate SEO Metadata Automatically From a Content API

**Meta title:** Auto-Generate SEO Metadata From a Content API  Practical Guide  
**Meta description:** Stop writing meta titles and descriptions by hand. Here's how to build a metadata generation system on top of any content API, with fallback logic and override support.  
**Slug:** `/blog/auto-generate-seo-metadata-content-api`  
**Category:** Programmatic SEO and Content Operations  
**Cluster role:** Supporting (links to pillar: Programmatic SEO for API-First CMS)

---

Writing SEO metadata by hand is one of those tasks that feels fine for the first twenty pages and becomes an unmanageable chore at two hundred. Worse, when it's manual, it's inconsistent. One page gets a great meta description. The next gets left blank. Another gets a 300-character description that Google truncates into gibberish.

If your content lives in an API-first CMS, you can solve this permanently. Your content already has structured fields  title, description, author, dates. A metadata generation system reads those fields, applies your formatting rules, and outputs valid SEO tags for every page automatically. Authors focus on content. The system handles the SEO.

---

## What Metadata You Actually Need

Before building anything, get clear on what tags you're generating. Here's the full list that matters:

**In the `<head>` of every page:**
- `<title>`  shown in browser tabs and search results
- `<meta name="description">`  the snippet shown under your title in search
- `<link rel="canonical">`  the definitive URL for this content
- `<meta name="robots">`  whether to index this page and follow its links

**Open Graph (for social sharing):**
- `og:title`
- `og:description`
- `og:image`
- `og:url`
- `og:type` (usually `article` for posts, `website` for home/product pages)

**Twitter/X cards:**
- `twitter:card` (usually `summary_large_image`)
- `twitter:title`
- `twitter:description`
- `twitter:image`

**Structured data (JSON-LD):**
- `Article` schema for blog posts
- `Person` or `ProfilePage` schema for user pages
- `Organization` and `WebSite` schema for the homepage

That's a lot of tags. The good news: most of them share the same source data. You derive them all from a handful of content fields.

---

## The Content Fields You Need on Every Item

For the metadata system to work, each content item in your CMS needs these fields:

| Field | Used for |
|---|---|
| `title` | `<title>`, `og:title`, `twitter:title` |
| `excerpt` or `description` | `<meta name="description">`, `og:description` |
| `slug` | `canonical` URL construction |
| `coverImageUrl` | `og:image`, `twitter:image` |
| `publishedAt` | `Article` schema `datePublished` |
| `updatedAt` | `Article` schema `dateModified`, sitemap `lastmod` |
| `authorName` | `Article` schema `author` |

Optional but recommended:
- `metaTitle`  override the `<title>` independently of the display title
- `metaDescription`  override the meta description independently of the excerpt
- `ogImageUrl`  separate OG image if different from cover
- `noindex` (boolean)  explicitly exclude from indexing

With these fields in your content model, you have everything needed to generate complete metadata for any piece of content.

---

## Building the Metadata Helper

Create a single file  `seo.ts`  that all pages import. It takes a content object and a page URL, and returns a complete metadata object.

```ts
// lib/seo.ts

interface ContentItem {
  title: string;
  metaTitle?: string;
  excerpt?: string;
  metaDescription?: string;
  slug: string;
  coverImageUrl?: string;
  ogImageUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
  authorName?: string;
  noindex?: boolean;
}

const SITE_NAME = 'Whitepaper';
const BASE_URL = 'https://whitepaper.so';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-default.png`;

export function buildMeta(content: ContentItem, canonicalUrl: string) {
  const title = content.metaTitle
    ? `${content.metaTitle} | ${SITE_NAME}`
    : `${content.title} | ${SITE_NAME}`;

  const description =
    content.metaDescription ||
    content.excerpt ||
    `Read ${content.title} on ${SITE_NAME}.`;

  const ogImage = content.ogImageUrl || content.coverImageUrl || DEFAULT_OG_IMAGE;

  return {
    title,
    description: description.slice(0, 160), // hard cap at 160 chars
    canonical: canonicalUrl,
    robots: content.noindex ? 'noindex, nofollow' : 'index, follow',
    og: {
      title: content.metaTitle || content.title,
      description: description.slice(0, 200),
      image: ogImage,
      url: canonicalUrl,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: content.metaTitle || content.title,
      description: description.slice(0, 200),
      image: ogImage,
    },
  };
}
```

Every page on your site calls `buildMeta()` and passes the result to your layout. Your layout renders all the tags. No page writes `<meta>` tags directly.

---

## Handling the Fallback Chain

The most important design decision in a metadata system is the fallback chain  what do you use when a field is missing?

A good fallback chain for descriptions:
1. `metaDescription` (explicit SEO override) → use if present
2. `excerpt` (author-written summary) → use if present
3. First 160 characters of body content → use if body is available
4. Generic fallback like "Read [title] on [site name]" → last resort

Never leave a meta description blank. Google will generate one from your page content, which is often okay, but you lose control of what snippet appears in search results. Even a generic fallback is better than nothing.

For the `<title>` tag, the fallback chain is simpler:
1. `metaTitle` → use if present
2. `title + " | " + site name` → default

---

## Canonical URLs: Get Them Right

The canonical tag is what tells Google "this is the real URL for this content." It prevents duplicate content issues when the same page is accessible at multiple URLs.

The canonical should always be:
- The full absolute URL (including `https://`)
- The normalized version (lowercase, no `@` prefix, no trailing slash inconsistency)
- Self-referencing on unique pages (a page's canonical points to itself)

In your `buildMeta` function, you pass `canonicalUrl` explicitly from the page. The page constructs this from the current URL, normalized:

```ts
// In your Astro page
const handle = Astro.params.handle.toLowerCase().replace(/^@/, '');
const canonical = `https://whitepaper.so/${handle}`;
const meta = buildMeta(profile, canonical);
```

Never derive the canonical from `window.location` or any client-side value. It must be set server-side so it's consistent regardless of how someone reached the page.

---

## Testing Your Metadata Output

Once your system is built, verify it's working correctly:

**Check raw HTML.** View source on several pages and confirm all expected tags are present and populated. Look specifically for blank `content=""` attributes  those are missing data bugs.

**Use the Rich Results Test.** Google's tool at `search.google.com/test/rich-results` renders your page and shows all detected structured data. Good for catching JSON-LD issues.

**Check Open Graph with the sharing debugger.** Facebook's sharing debugger (`developers.facebook.com/tools/debug`) shows exactly how your page will appear when shared on social. Run your most important pages through it.

**Audit for title length.** Titles over 60 characters get truncated in search results. Check your title generation logic produces titles in the 50-60 character range for most pages.

---

## The Ongoing Maintenance Advantage

The real value of a centralized metadata system isn't the initial build. It's what happens six months later when you need to change your site name, adjust your title format, or add a new tag type.

Without this system, that's a find-and-replace across dozens of page files with a high chance of missing something. With it, you change one function in `seo.ts` and every page on the site is updated.

That leverage is why building this system early  even before you have a lot of content  is worth the few hours it takes.

---

*Part of our series on Programmatic SEO for API-First CMS. Start with [the pillar guide](#) or read about [handling canonical URLs at scale](#).*
