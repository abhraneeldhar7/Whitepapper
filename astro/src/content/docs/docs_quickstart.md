Get from a blank account to a published paper and a working Dev API call in about 15 minutes.

## Prerequisites

- A Whitepapper account at [whitepapper.antk.in](https://whitepapper.antk.in)
- Basic familiarity with Markdown
- A way to make HTTP requests (`curl`, Postman, browser, or your own code)

## Create a project

1. Open **Dashboard**.
2. Click **New Project**.
3. Enter a project name.
4. Set visibility to **Public** if you want public access.
5. Click **Create**.

Project URL pattern:

```
https://whitepapper.antk.in/{username}/p/{project-slug}
```

## Create a paper

1. Open your project.
2. Click **New Paper**.
3. Add a title and body.
4. Save your draft.

## Publish the paper

1. Open the paper in the editor.
2. Set status to **Public** and save.
3. The paper becomes publicly accessible if parent visibility allows it.

Paper URL pattern:

```
https://whitepapper.antk.in/{username}/{paper-slug}
```

## Generate an API key

1. Open the project.
2. Go to the **API** tab.
3. Click **Generate API Key**.
4. Copy the key immediately.

Each project has one key. The key is scoped to that project.

## Make your first API call

Base URL:

```
https://whitepapper.antk.in/api
```

Request:

```http
GET /dev/project
x-api-key: <your-api-key>
```

```bash
curl https://whitepapper.antk.in/api/dev/project \
  -H "x-api-key: YOUR_API_KEY"
```

## Common errors

| What you see | What it means | Fix |
|---|---|---|
| `401` | API key missing or invalid | Send the correct `x-api-key` header |
| `403` | Key inactive or wrong project scope | Re-enable key or use the right project's key |
| `404` | Collection/paper not found | Verify the `id` or `slug` |
| `429` | Monthly quota exceeded | Wait for monthly reset |

## Related pages

- [Projects](/docs/projects)
- [Papers](/docs/papers)
- [Dev API Overview](/docs/dev-api/overview)
