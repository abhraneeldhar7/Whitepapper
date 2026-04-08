This page documents paper metadata fields and how they map to rendered SEO output.

## Basic SEO fields

| Field | Output | Notes |
|---|---|---|
| `title` | `<title>` | Browser tab and search title |
| `metaDescription` | `<meta name="description">` | Search snippet description |
| `canonical` | `<link rel="canonical">` | Canonical source URL |
| `robots` | `<meta name="robots">` | Indexing directives |
| `keywords` | `<meta name="keywords">` when present | Optional keyword hint |

## Open Graph fields

| Field | Output tag |
|---|---|
| `ogTitle` | `og:title` |
| `ogDescription` | `og:description` |
| `ogImage` | `og:image` |
| `ogImageWidth` | `og:image:width` |
| `ogImageHeight` | `og:image:height` |
| `ogImageAlt` | `og:image:alt` |
| `ogLocale` | `og:locale` |
| `ogPublishedTime` | `article:published_time` |
| `ogModifiedTime` | `article:modified_time` |
| `ogAuthorUrl` | `article:author` |
| `ogTags` | `article:tag` (one per value) |

## Twitter fields

| Field | Output tag |
|---|---|
| `twitterTitle` | `twitter:title` |
| `twitterDescription` | `twitter:description` |
| `twitterImage` | `twitter:image` |
| `twitterImageAlt` | `twitter:image:alt` |
| `twitterCreator` | `twitter:creator` when present |

## JSON-LD related fields

| Field | JSON-LD usage |
|---|---|
| `headline` | `headline` |
| `abstract` | `abstract` |
| `keywords` | `keywords` |
| `articleSection` | `articleSection` |
| `wordCount` | `wordCount` |
| `inLanguage` | `inLanguage` |
| `datePublished` | `datePublished` |
| `dateModified` | `dateModified` |
| `authorName` | `author.name` |
| `authorUrl` | `author.url` |
| `coverImageUrl` | `image.url` |
| `publisherName` | `publisher.name` |
| `publisherUrl` | `publisher.url` |
| `isAccessibleForFree` | `isAccessibleForFree` |
| `license` | `license` |

`readingTimeMinutes`, `authorHandle`, and `authorId` are part of data model usage but not direct JSON-LD keys.

## Fallback behavior

If metadata is partial or missing, fallback values are generated from paper and author data. Public paper pages still render a complete SEO baseline.

## When fields are rendered

Metadata is rendered on public paper pages. Private or non-publicly accessible content is not indexable.
