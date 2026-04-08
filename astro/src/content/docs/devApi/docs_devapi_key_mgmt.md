Each project has one API key lifecycle managed from the project API tab.

## Create

Use `POST /projects/{project_id}/api-key`.

- Returns key summary plus `rawKey`
- `rawKey` is shown once
- New key starts active with usage `0`

## View

Use `GET /projects/{project_id}/api-key`.

Returns key summary or `null`.

## Toggle active state

Use `PATCH /api-keys/{key_id}` with:

```ts
type ApiKeyToggle = {
  isActive: boolean
}
```

Inactive keys return `403` in Dev API calls.

## Reset

Use `POST /api-keys/{key_id}/reset`.

- Invalidates old key immediately
- Returns a new one-time `rawKey`

## Usage tracking

- Usage increments in cache
- Hourly sync job writes cache usage to Firestore
- Monthly reset job sets usage back to `0`

## Related pages

- [Dev API Overview](/docs/dev-api/overview)
- [Authentication](/docs/dev-api/authentication)
- [Caching and Errors](/docs/dev-api/caching-and-errors)
