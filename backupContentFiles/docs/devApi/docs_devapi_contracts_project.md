Fetches the project associated with the API key and its collections.

## Request

```http
GET /dev/project
x-api-key: <your-api-key>
```

## Success response - 200

```ts
type DevProjectResponse = {
  project: DevProject
  collections: DevCollection[]
}
```

`ownerId` is masked as `null` in all entities.

## Error responses

| Status | Meaning |
|---|---|
| `401` | Missing or invalid API key |
| `403` | Inactive key |
| `429` | Monthly usage limit exceeded |
\nLast updated: 12th April, 2026\n
