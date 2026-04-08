A paper is the core content unit in Whitepapper.

## Prerequisites

- A Whitepapper account
- Optional: project and collection context

## Paper lifecycle

Every paper has one status:

- `draft`
- `published`
- `archived`

Archived papers stay archived even when collection visibility changes.

## Status inheritance

On create:

- Inside public project/collection: `published`
- Inside private project/collection: `draft`
- Standalone: `draft`

## Public URL

Whitepapper uses one public paper URL pattern:

```
https://whitepapper.antk.in/{username}/{paper-slug}
```

This applies regardless of where the paper lives in your internal hierarchy.

Public access requires:

- Paper status is `published`
- Parent project (if any) is public
- Parent collection (if any) is public

## Slug

Paper slug rules:

- Unique per owner across all papers
- Auto-generated from title
- Duplicate explicit slug fails with conflict

See [Slug collision checks](/docs/slug-collision-checks).

## Metadata

Papers have optional metadata fields for SEO, Open Graph, Twitter cards, and JSON-LD. If metadata is missing, fallback values are generated from paper data.

See [Paper metadata](/docs/seo/paper-metadata).

## Limits

- Max **500 papers** per account
- Max body length: **500,000** characters
- Max embedded images per paper body: **20**

Limit errors:

- `Paper limit reached (500) for this user. Delete an existing paper to create a new one.`
- `Paper content is too long. Maximum length is 500000 characters.`
- `Paper image limit reached (20). Remove some images before saving.`
