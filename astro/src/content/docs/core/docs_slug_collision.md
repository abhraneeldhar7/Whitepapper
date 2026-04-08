A slug is the URL-friendly identifier for projects, collections, and papers.

## Prerequisites

- A Whitepapper account

## Normalization

Slug normalization rules:

1. Convert to lowercase
2. Replace spaces with `-`
3. Replace non `[a-z0-9-]` characters with `-`
4. Collapse repeated `-`
5. Trim leading/trailing `-`

## Uniqueness scope

| Entity | Unique within |
|---|---|
| Project slug | Owner account |
| Collection slug | Parent project |
| Paper slug | Owner account |

## Availability check endpoints

```http
GET /projects/slug/available?slug=<slug>&projectId=<optional>
GET /collections/slug/available?slug=<slug>&projectId=<projectId>&collectionId=<optional>
GET /papers/slug/available?slug=<slug>&paperId=<optional>
```

## Collision behavior

| Operation | Behavior |
|---|---|
| Project create | Auto-adjusts to a unique slug |
| Collection create | Auto-adjusts to a unique slug |
| Project update with duplicate slug | Fails with conflict |
| Collection update with duplicate slug | Fails with conflict |
| Paper create with duplicate explicit slug | Fails with conflict |

Auto-adjusted slugs use a short random suffix, not a simple increment.

## Reserved path behavior

- Username routes have reserved values (for example: `api`, `dashboard`, `docs`, `sitemaps`).
- Project and paper reserved slug lists are currently empty in code, but this can be expanded later.
- Empty or invalid normalized slugs are always unavailable.
