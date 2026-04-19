Whitepapper exposes sitemaps for static pages, public profiles/projects, and public papers.

## Sitemap endpoints

Main entry points:

- `https://whitepapper.antk.in/sitemap.xml`
- `https://whitepapper.antk.in/sitemap-index.xml`

Sub-sitemaps:

- `https://whitepapper.antk.in/sitemaps/public-pages.xml`
- `https://whitepapper.antk.in/sitemaps/docs-pages.xml`
- `https://whitepapper.antk.in/sitemaps/public-projects.xml`
- `https://whitepapper.antk.in/sitemaps/public-papers.xml`

## What each sitemap includes

- `public-pages.xml`: static platform pages (`/`, `/about`, `/blogs`, `/docs`, and related static routes)
- `docs-pages.xml`: docs index and all docs content routes under `/docs/*`
- `public-projects.xml`: profile URLs and public project URLs
- `public-papers.xml`: public paper URLs

## Exclusions

Excluded content includes:

- Private projects
- Private collections and non-publicly accessible paper contexts
- Draft or archived papers
- Routes that return non-public responses

## Refresh behavior

Sitemaps are generated dynamically and served with cache headers:

```http
Cache-Control: public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800
```

Expect up to about 30 minutes of cache delay before updates are reflected.

## Submission

Submit `https://whitepapper.antk.in/sitemap-index.xml` in Google Search Console.
\nLast updated: 12th April, 2026\n
