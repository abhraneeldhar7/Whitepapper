Deploy FastAPI backend from the `fastapi/` folder to Google Cloud Run.

## Steps

1. Build/deploy service from `fastapi/`
2. Apply backend env variables
3. Ensure service is reachable from frontend and worker
4. Verify health endpoint

Health check:

```http
GET /health
```

Expected response:

```json
{"status":"ok"}
```

## Common errors

| Error | Cause | Fix |
|---|---|---|
| 500 on startup | Invalid env config | Validate all required backend env vars |
| 401 webhook/auth issues | Clerk secret mismatch | Align backend Clerk secrets |
| Worker proxy errors | Wrong Cloud Run URL in worker env | Update worker `CLOUD_RUN_URL` |

## Related pages

- [FastAPI Env](/docs/self-host/environment-files/fastapi-env)
- [Cloudflare Worker](/docs/self-host/cloudflare-worker)
