Configure scheduled jobs for API key usage maintenance.

## Required GitHub secrets

- `API_BASE_URL`
- `CRON_SECRET`

## Workflows

- Hourly: `sync-api-keys-cache`
- Monthly: `reset-api-usage`

These call backend endpoints:

- `POST /sync-api-keys-cache`
- `POST /reset-api-usage`

Both require `x-cron-secret` header.

## Expected outcome

Usage counters stay synchronized and monthly limits reset correctly.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| 401 from cron endpoint | Secret mismatch | Align GitHub secret and backend `CRON_SECRET` |
| Workflow fails to reach API | Wrong `API_BASE_URL` | Update secret to deployed backend base URL |

## Related pages

- [FastAPI Env](/docs/self-host/environment-files/fastapi-env)
- [Production Checklist](/docs/self-host/production-checklist)
\nLast updated: 12th April, 2026\n
