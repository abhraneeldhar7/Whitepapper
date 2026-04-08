Use this page as the contract index for all Dev API endpoints.

## Header contract

All Dev API routes require:

```http
x-api-key: <project_api_key>
```

## Response entity model

```ts
type DevProject = Omit<ProjectDoc, "ownerId"> & { ownerId: null }
type DevCollection = Omit<CollectionDoc, "ownerId"> & { ownerId: null }
type DevPaper = Omit<PaperDoc, "ownerId"> & { ownerId: null }

type DevProjectResponse = {
  project: DevProject
  collections: DevCollection[]
}

type DevCollectionResponse = {
  collection: DevCollection
  papers: DevPaper[]
}

type DevPaperResponse = {
  paper: DevPaper
}

type ApiError = {
  detail: string
}
```

## Endpoint index

- `GET /dev/project`
- `GET /dev/collection?id=<id>` or `GET /dev/collection?slug=<slug>`
- `GET /dev/paper?id=<id>` or `GET /dev/paper?slug=<slug>`

## Error baseline

Common statuses:

- `400` invalid query shape
- `401` missing/invalid key
- `403` inactive key or scope violation
- `404` collection/paper not found
- `429` monthly limit exceeded

## Related pages

- [Project Endpoint](/docs/dev-api/contracts/project-endpoint)
- [Collection Endpoint](/docs/dev-api/contracts/collection-endpoint)
- [Paper Endpoint](/docs/dev-api/contracts/paper-endpoint)
- [Caching and Errors](/docs/dev-api/caching-and-errors)
