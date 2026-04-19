Astro frontend environment variables.

## Required variables

```env
PUBLIC_API_BASE_URL=http://127.0.0.1:8000
PUBLIC_SITE_URL=http://localhost:4321
PRODUCTION_BASE_URL=https://your-domain.example
PUBLIC_PRODUCTION_BASE_URL=https://your-domain.example
ENVIRONMENT=DEVELOPMENT
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
PUBLIC_CLERK_SIGN_IN_URL=/login
PUBLIC_CLERK_SIGN_UP_URL=/login
PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
WHITEPAPPER_API_KEY=wp_xxx
```

## Expected outcome

Astro can render public pages and authenticated flows, and can call backend endpoints.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| 401 on server-side calls | Invalid `WHITEPAPPER_API_KEY` | Regenerate key and update env |
| Redirect loops in auth | Wrong Clerk route env values | Match sign-in/sign-up redirect values |
| Broken API calls | Incorrect `PUBLIC_API_BASE_URL` | Point to backend base URL |

## Related pages

- [Environment Files](/docs/self-host/environment-files)
- [Vercel Frontend](/docs/self-host/vercel-frontend)
\nLast updated: 12th April, 2026\n
