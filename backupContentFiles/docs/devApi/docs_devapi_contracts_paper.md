Fetches one paper by id or slug.

## Request

```http
GET /dev/paper?id=<paper-id>
GET /dev/paper?slug=<paper-slug>
x-api-key: <your-api-key>
```

Pass exactly one of `id` or `slug`.

## Success response - 200

```ts
type DevPaperResponse = {
  paper: DevPaper
}
```

## Example canonical field

Typical metadata canonical in response uses the public paper pattern:

```txt
https://whitepapper.antk.in/{username}/{paper-slug}
```

## Error responses

| Status | Meaning |
|---|---|
| `400` | Both or neither `id`/`slug` supplied |
| `401` | Missing or invalid API key |
| `403` | Inactive key or cross-project paper |
| `404` | Paper not found |
| `429` | Monthly usage limit exceeded |
\nLast updated: 12th April, 2026\n
