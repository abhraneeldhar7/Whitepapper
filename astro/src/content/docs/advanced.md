# Advanced

Set up a full local environment for deep testing.

## Local stack overview

- Astro app for frontend.
- FastAPI service for backend routes.
- Cloudflare worker/proxy for edge behavior.
- CDN-style caching simulation for response validation.

## 1. Install dependencies

- Install frontend dependencies in the Astro folder.
- Install backend dependencies in the FastAPI folder.
- Configure required environment variables.

## 2. Run services locally

- Start Astro dev server.
- Start FastAPI service.
- Start the Cloudflare proxy/worker for local routing.

## 3. Validate CDN behavior

- Test cached vs uncached requests.
- Check cache headers and TTL values.
- Confirm stale-while-revalidate behavior in local tests.

## 4. Production-like checks

- Add test data and run endpoint smoke tests.
- Verify auth flow and protected routes.
- Monitor logs and latency while load testing.

## Next

Document your local setup script so new teammates can bootstrap fast.
