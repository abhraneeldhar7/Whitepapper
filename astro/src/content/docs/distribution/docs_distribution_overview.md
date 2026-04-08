Distribution lets you publish papers from Whitepapper to external channels.

## Supported channels

| Platform | Method | Status |
|---|---|---|
| Hashnode | GraphQL API | Live |
| Dev.to | REST API | Live |
| Medium | Import URL flow | Live |

See [Platform status](/docs/distribution/platform-status).

## How distribution works

Whitepapper sends title, body, and metadata-derived fields to the target platform.

The intended flow is to distribute published papers so the canonical source URL is publicly reachable.

## Token storage options

For Hashnode and Dev.to:

- **Store in cloud:** token saved in account settings
- **Session only:** token used for current action and not stored server-side

These behaviors map to user preferences:

- `hashnodeStoreInCloud`
- `devtoStoreInCloud`

## Editor flow

1. Open paper
2. Open **Distribute** action
3. Choose platform
4. Provide token if needed
5. Confirm publish/import

## Sync behavior

Distribution is one-way per action. Post updates are not auto-synced back to platforms.

## Related pages

- [Hashnode](/docs/distribution/hashnode)
- [Dev.to](/docs/distribution/devto)
- [Medium Import](/docs/distribution/medium-import)
