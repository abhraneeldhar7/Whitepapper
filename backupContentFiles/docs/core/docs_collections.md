A collection groups related papers inside a project.

## Prerequisites

- A Whitepapper account
- At least one project

## What a collection contains

- Papers
- A project-scoped unique slug
- Visibility (`isPublic`)

A collection belongs to exactly one project.

## Visibility

Collection visibility is controlled by `isPublic`.

- **Public:** collection papers can be publicly accessible when parent project is public.
- **Private:** collection papers are not publicly accessible.

Propagation rules:

- Public collection sets non-archived papers to `published`
- Private collection sets non-archived papers to `draft`
- Archived papers remain archived

## Slug

Collection slug is used in Dev API queries:

```http
GET /dev/collection?slug=my-collection
```

Rules:

- Unique per project
- Auto-generated from collection name
- Duplicate manual updates fail with conflict

See [Slug collision checks](/docs/slug-collision-checks).

## Description

- Max length: **50,000** characters
- Returned in Dev API responses
- Displayed in project collection listings

## Limits

- Max **10 collections** per project
- Error on limit breach: `Collection limit reached (10) for this project.`

## Publishing behavior for papers in collections

A new paper inside a collection inherits collection visibility:

- Public collection: starts as `published`
- Private collection: starts as `draft`
\nLast updated: 12th April, 2026\n
