Every Dev API request must include an `x-api-key` header.

## Header contract

```http
GET /dev/project
x-api-key: wp_your_api_key_here
```

Missing or invalid keys return `401`.

## Key checks order

1. Key exists and is valid
2. Key is active
3. Monthly quota not exceeded

If all pass, endpoint-level project scoping checks run next.

## Scoping behavior

A valid key from project A cannot fetch project B content. Mismatches return `403`.

## Public frontend usage

Using this key client-side is supported for read-only use cases. If you prefer not to expose it in browser requests, proxy from your own server.

## Common auth errors

| Status | Meaning |
|---|---|
| `401` | Missing or invalid key |
| `403` | Inactive key or cross-project access |
| `429` | Monthly usage limit exceeded |
\nLast updated: 12th April, 2026\n
