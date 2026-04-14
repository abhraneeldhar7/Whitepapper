Self-hosting Whitepapper means deploying three parts from this monorepo:

- Astro frontend (`astro/`)
- FastAPI backend (`fastapi/`)
- Cloudflare proxy worker (`cloudflare-proxy/`)

## Prerequisites

- Access to deployment targets (Vercel, Cloud Run, Cloudflare)
- Clerk, Firebase, and Valkey credentials
- GitHub repository admin access for cron secrets

## Deployment flow

1. Configure env files
2. Run locally
3. Deploy frontend
4. Deploy backend
5. Deploy worker
6. Configure cron jobs
7. Run production checklist

## Expected outcome

A production setup where public pages, dashboard, Dev API, MCP, distribution, and cron sync jobs all work.

## Related pages

- [Environment Files](/docs/self-host/environment-files)
- [Local Run](/docs/self-host/local-run)
- [Production Checklist](/docs/self-host/production-checklist)
\nLast updated: 12th April, 2026\n
