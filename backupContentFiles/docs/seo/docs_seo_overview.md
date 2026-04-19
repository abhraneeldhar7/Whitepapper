Whitepapper treats SEO as a core feature. Public profile, project, and paper pages are server-rendered with metadata and structured data.

## How SEO works in Whitepapper

Whitepapper has two layers:

- **Platform-level SEO:** profile and project pages derive SEO from account and project fields.
- **Paper-level SEO:** paper metadata controls canonical, Open Graph, Twitter tags, and JSON-LD output.

## Canonical URL strategy

Paper canonical defaults to the Whitepapper paper URL:

```
https://whitepapper.antk.in/{username}/{paper-slug}
```

If you syndicate from another source, you can override `canonical` in metadata.

When publishing to Hashnode and Dev.to, Whitepapper sets canonical fields to point back to the Whitepapper source URL.

## Metadata ownership and fallback behavior

Paper metadata values come from the paper metadata object.

If fields are missing, Whitepapper applies fallback values built from paper title, status, thumbnail, and author data. This keeps public pages SEO-complete even when not every field is manually filled.

## robots field

`robots` maps to `<meta name="robots">`.

- Published papers default to `index, follow`
- Non-published states use `noindex, nofollow`

## Related pages

- [Paper metadata](/docs/seo/paper-metadata)
- [Public pages](/docs/seo/public-pages)
- [Sitemaps](/docs/seo/sitemaps)
\nLast updated: 12th April, 2026\n
