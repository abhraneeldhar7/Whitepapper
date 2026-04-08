Use this checklist before marking your self-hosted setup production-ready.

## Checklist

- [ ] Frontend deployed from `astro/` and loading correctly
- [ ] Backend deployed from `fastapi/` and `/health` returns ok
- [ ] Worker deployed and `CLOUD_RUN_URL` configured
- [ ] Auth flows work (sign-in, sign-up, dashboard access)
- [ ] Public profile/project/paper pages render
- [ ] Project API key creation and Dev API reads work
- [ ] Hashnode and Dev.to distribution work with valid tokens
- [ ] Cron workflows run successfully (`sync-api-keys-cache`, `reset-api-usage`)

## Expected outcome

All critical runtime paths work without manual intervention.

## Related pages

- [Overview](/docs/self-host/overview)
- [Local Run](/docs/self-host/local-run)
- [Cron Jobs](/docs/self-host/cron-jobs)
