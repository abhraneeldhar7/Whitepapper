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

## Related pages

- [Astro Env](/docs/self-host/environment-files/astro-env)
- [FastAPI Env](/docs/self-host/environment-files/fastapi-env)
