Whitepapper publishes to Dev.to through the Dev.to REST API.

## Prerequisites

- Dev.to account
- Dev.to API key

## Setup

1. In Dev.to, generate API key from Settings -> Extensions
2. In Whitepapper Integrations, add the key
3. Choose cloud storage or session-only token usage

## Publish flow

1. Open paper in Whitepapper editor
2. Open **Distribute**
3. Select **Dev.to**
4. Confirm publish

Whitepapper sends canonical URL pointing to the Whitepapper paper URL.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Invalid API key | Revoked or incorrect key | Regenerate and update key |
| Rate limited | Dev.to API rate limits | Retry later |
| Publish rejected | Payload validation issue | Review title/body/tags and retry |

## Related pages

- [Distribution Overview](/docs/distribution/overview)
- [Platform Status](/docs/distribution/platform-status)
