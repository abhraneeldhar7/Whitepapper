Use environment files to configure Astro and FastAPI for local and production runs.

## Prerequisites

- Cloned repository
- Access to required secrets

## Required files

- `astro/.env`
- `fastapi/.env`

Create from examples:

```bash
copy astro\.env.example astro\.env
copy fastapi\.env.example fastapi\.env
```

## Expected outcome

Both services can boot with valid credentials and URLs.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Missing env variable | Incomplete `.env` file | Copy all keys from example files |
| Auth failures | Clerk keys mismatch | Verify publishable and secret key pairs |
| API/frontend mismatch | Wrong base URLs | Align `PUBLIC_API_BASE_URL` and site URLs |
| MCP connect opens but auth fails | Missing `PUBLIC_API_URL` or `PUBLIC_SITE_URL` in FastAPI | Set both URLs so OAuth can redirect to the right backend and frontend |

## Related pages

- [Astro Env](/docs/self-host/environment-files/astro-env)
- [FastAPI Env](/docs/self-host/environment-files/fastapi-env)
\nLast updated: 12th April, 2026\n
