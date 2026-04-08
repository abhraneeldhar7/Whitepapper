Whitepapper publishes to Hashnode through the Hashnode GraphQL API.

## Prerequisites

- Hashnode account with a publication
- Hashnode personal access token

## Setup

1. Open Hashnode developer settings
2. Generate token
3. In Whitepapper Integrations, add token
4. Add blog URL so Whitepapper can resolve `publicationId`
5. Choose cloud storage or session-only token usage

## Publish flow

1. Open a paper in Whitepapper editor
2. Open **Distribute**
3. Select **Hashnode**
4. Confirm publish

Whitepapper sets `originalArticleURL` to the Whitepapper paper URL for canonical attribution.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Invalid token | Wrong or expired token | Regenerate and update token |
| Publication not found | Blog URL mismatch | Correct blog URL in integration settings |
| Publish rejected | Platform-side validation issue | Check payload fields and retry |

## Related pages

- [Distribution Overview](/docs/distribution/overview)
- [Platform Status](/docs/distribution/platform-status)
