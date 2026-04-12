Deploy the Astro frontend from the `astro/` folder to Vercel.

## Steps

1. Create/import Vercel project from this monorepo
2. Set root directory to `astro/`
3. Add all Astro env variables from `astro/.env`
4. Deploy

## Expected outcome

Frontend pages load, auth routes work, and API requests target the configured backend base URL.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Build fails | Missing env vars | Add all required vars in Vercel settings |
| Runtime API errors | Wrong base URL | Fix `PUBLIC_API_BASE_URL` |
| Auth redirect mismatch | Wrong Clerk URLs | Update public Clerk route env vars |

## Related pages

- [Astro Env](/docs/self-host/environment-files/astro-env)
- [Cloud Run Backend](/docs/self-host/cloud-run-backend)
\nLast updated: 12th April, 2026\n
