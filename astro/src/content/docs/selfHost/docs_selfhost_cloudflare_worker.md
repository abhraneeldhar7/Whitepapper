Deploy the Cloudflare Worker proxy from `cloudflare-proxy/`.

## Steps

1. Configure worker project in `cloudflare-proxy/`
2. Set worker secret/env `CLOUD_RUN_URL` to backend URL
3. Deploy worker
4. Validate proxy pass-through and cache behavior

## Expected outcome

GET requests are proxied and cached via `caches.default`.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `Missing CLOUD_RUN_URL` | Env not set | Set worker env variable |
| 502 proxy error | Backend unreachable | Verify Cloud Run URL and network |
| Stale responses | Expected cache behavior | Purge cache when needed |

## Related pages

- [Cloud Run Backend](/docs/self-host/cloud-run-backend)
- [Cron Jobs](/docs/self-host/cron-jobs)
