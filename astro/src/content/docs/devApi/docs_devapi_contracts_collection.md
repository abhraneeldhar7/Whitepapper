Fetches one collection and its papers.

## Request

```http
GET /dev/collection?id=<collection-id>
GET /dev/collection?slug=<collection-slug>
x-api-key: <your-api-key>
```

Pass exactly one of `id` or `slug`.

## Success response - 200

```ts
type DevCollectionResponse = {
  collection: DevCollection
  papers: DevPaper[]
}
```

## Error responses

| Status | Meaning |
|---|---|
| `400` | Both or neither `id`/`slug` supplied |
| `401` | Missing or invalid API key |
| `403` | Inactive key or cross-project collection |
| `404` | Collection not found |
| `429` | Monthly usage limit exceeded |
\nLast updated: 12th April, 2026\n
