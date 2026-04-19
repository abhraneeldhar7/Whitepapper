The Dev API exposes read-only project-scoped content for frontend and integration use.

## What it is

- Read-only HTTP API
- Scoped by one API key per project
- Endpoints for project, collection, and paper reads

Base URL:

```
https://whitepapper.antk.in/api
```

## Project scoping

A key can access only the project it belongs to. Cross-project collection or paper requests return `403`.

## Owner identity masking

`ownerId` is returned as `null` in Dev API response entities (`project`, `collection`, `paper`).

## Usage limit

- `limitPerMonth`: 10,000 requests per key
- Exceeded usage returns `429`
- Usage resets monthly

## Public visibility behavior

Dev API returns only content that passes public visibility checks:

- Project must be public
- Collection must be public when requested
- Paper must be `published`

## Related pages

- [Authentication](/docs/dev-api/authentication)
- [API Key Management](/docs/dev-api/api-key-management)
- [Contracts](/docs/dev-api/contracts)
- [Caching and Errors](/docs/dev-api/caching-and-errors)
\nLast updated: 12th April, 2026\n
