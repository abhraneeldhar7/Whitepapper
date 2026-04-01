# Best practices

Use these baseline practices before shipping.

## Security

- Never store API keys in frontend code or public repositories.
- Keep secrets in environment variables or a secure secret manager.
- Rotate keys regularly and revoke unused credentials.

## API design

- Keep endpoint naming consistent and predictable.
- Validate request payloads and return stable response shapes.
- Use clear error codes and actionable error messages.

## Reliability

- Add logging for each request path and failure mode.
- Use retries with backoff for external API calls.
- Add timeouts to prevent hanging requests.

## Performance

- Cache safe, repeated reads where possible.
- Paginate large responses.
- Monitor latency and error rate for each route.

## Team workflow

- Review API changes before merge.
- Keep docs updated with every endpoint change.
- Use staging before production deployments.
