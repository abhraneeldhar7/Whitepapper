FastAPI backend environment variables.

## Required variables

```env
APP_NAME=Whitepapper_API
REDIS_PREFIX=whitepapper
CORS_ORIGINS=https://your-domain.example,http://localhost:4321
PUBLIC_SITE_URL=https://your-domain.example
PUBLIC_API_URL=https://api.your-domain.example
CLERK_SECRET_KEY=sk_test_xxx
CLERK_JWT_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
CLERK_AUTHORIZED_PARTIES=https://your-domain.example,http://localhost:4321
CLERK_WEBHOOK_SIGNING_SECRET=whsec_xxx
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIRESTORE_DATABASE_ID=(default)
FIREBASE_SERVICE_ACCOUNT_JSON={...}
CRON_SECRET=change-me
VALKEY_SERVICE_URI=redis://default:password@host:6379/0
VALKEY_HOST=
VALKEY_PORT=
VALKEY_USER=
VALKEY_PASSWORD=
GROQ_API_KEY=gsk_xxx
```

## Expected outcome

FastAPI can start, authenticate users, access Firestore/Storage, run cache + cron endpoints, and publish MCP OAuth metadata for `https://api.your-domain.example/mcp`.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| 500 at startup | Invalid Firebase service account JSON | Reformat and validate JSON string |
| 401 on cron endpoints | Wrong `CRON_SECRET` | Align header secret with backend env |
| CORS issues | Missing frontend origin | Add all frontend origins to `CORS_ORIGINS` |

## Related pages

- [Environment Files](/docs/self-host/environment-files)
- [Cloud Run Backend](/docs/self-host/cloud-run-backend)
\nLast updated: 12th April, 2026\n
