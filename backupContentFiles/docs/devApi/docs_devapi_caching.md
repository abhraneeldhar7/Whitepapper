## Cache headers

Successful Dev API responses include:

```http
Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=300
Vary: x-api-key
```

This means cached responses can remain visible for up to about 5 minutes before refresh.

## Usage increment behavior

Usage increments after key validation and endpoint-level success flow. Increment is cached first, then synced to Firestore hourly.

Operational notes:

- Dashboard usage can lag behind real-time usage
- Quota enforcement uses cached usage and stays accurate

## Error reference

| Status | Meaning | Fix |
|---|---|---|
| `400` | Invalid query shape | Pass exactly one of `id` or `slug` where required |
| `401` | Missing or invalid key | Send valid `x-api-key` |
| `403` | Inactive key or scope mismatch | Re-enable key or use matching project key |
| `404` | Resource not found | Verify `id` or `slug` |
| `429` | Monthly limit exceeded | Wait for reset |

## Error schema

```ts
type ApiError = {
  detail: string
}
```

## Troubleshooting stale content

If API output looks stale, wait for cache expiry (~5 minutes). If your own CDN is in front, purge that layer separately.
\nLast updated: 12th April, 2026\n
