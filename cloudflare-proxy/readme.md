# Whitepapper Cloudflare Proxy

This worker exists for one practical reason: mapping `api.antk.in` to Whitepapper's Cloud Run API because direct custom domain mapping on the current GCP setup (Mumbai region) is restricted.

No fancy deployment pipeline here right now. When I change worker logic, I update the code in Cloudflare Workers directly.

## Why This Proxy Exists

- GCP Cloud Run domain mapping limitation in current setup.
- Need a stable public API domain: `api.antk.in`.
- Need edge cache in front of dynamic API responses.
- Need better global response times for content-heavy pages.

## What It Does

- Proxies incoming requests from Cloudflare to the Cloud Run backend.
- Caches eligible GET responses at Cloudflare edge (`caches.default`).
- Returns cached responses fast on repeat hits.
- Keeps API domain stable even if backend infra changes.

## Current Performance Behavior

- Edge cache is active for cacheable GET endpoints.
- Closest POP for me is usually Bangalore.
- Repeat page refreshes are around ~150ms when cached.
- Public content pages are DB-backed (blogs, use-cases, features, etc.), not hardcoded files.

## Important Constraints

- `SSE` and `MCP` endpoints are intentionally disabled in this worker path right now because of stale token handling issues.
- Do not enable those endpoints through cache/proxy route until auth-token lifecycle is fixed end-to-end.

## Required Runtime Configuration

Set this before using the worker:

- `CLOUD_RUN_URL`: upstream Cloud Run base URL

If this is missing or wrong, requests will fail or route to the wrong origin.

## Update Workflow (Current, Manual)

I am intentionally not using Wrangler-triggered deploy automation here yet.

Current flow:

1. Update worker code in this repo.
2. Copy changes to Cloudflare Worker editor.
3. Save and deploy.
4. Smoke-test key routes (`/health`, public API reads, cached endpoints).
5. Verify cache behavior and status codes.

## What To Verify After Each Change

- Proxy routes still point to correct upstream.
- Cache only applies where intended (mainly GET, non-sensitive responses).
- Auth-required or token-sensitive endpoints are not accidentally cached.
- SSE/MCP remain blocked in this layer.
- Response headers and status codes are preserved.

## Troubleshooting Notes

- Sudden slow responses: likely cache miss or cache bypass path.
- Fresh backend change not visible: edge cache still warm; purge/selective invalidate if needed.
- Wrong data served: inspect cache key construction and endpoint-specific cache policy.
- Unexpected auth behavior: ensure private routes are not passing through cache.

## Security and Safety Notes

- Never cache authenticated/private payloads.
- Keep API key/token-bearing routes out of edge cache policy.
- Review any new endpoint before adding cache rules.

## Future Improvements (Planned)

- Move from manual copy-deploy to Wrangler-managed deploy flow.
- Add environment-specific worker config (dev/stage/prod).
- Add explicit route policy docs for cache vs no-cache endpoints.
- Revisit SSE/MCP routing once stale-token issue is solved.

## Quick Reminder

This proxy is an edge performance and domain-mapping layer, not the source of truth.
Source of truth remains the FastAPI backend + Firestore/Redis data path.