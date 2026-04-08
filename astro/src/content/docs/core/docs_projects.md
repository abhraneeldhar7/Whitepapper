A project is the top-level container for content in Whitepapper.

## Prerequisites

- A Whitepapper account

## What a project contains

- Project standalone papers
- Collections
- One project-scoped API key
- A public project page when `isPublic` is true

## Visibility

Project visibility is controlled by `isPublic`.

- **Public:** project page is accessible, and public papers are accessible.
- **Private:** project and nested content are not publicly accessible.

Changing project visibility propagates to collections and their paper visibility behavior.

## Slug

Project public URL pattern:

```
https://whitepapper.antk.in/{username}/p/{project-slug}
```

Rules:

- Unique per owner
- Auto-generated from project name
- Manual updates can fail with `409` if slug already exists under the same owner

See [Slug collision checks](/docs/slug-collision-checks).

## Logo and description

- `logoUrl` is optional
- Description max length is **50,000** characters

## Limits

- Max **50 projects** per account
- Error on limit breach: `Project limit reached (50). Delete an existing project to create a new one.`

## API tab

From the API tab you can:

- Create key
- View usage summary
- Toggle active state
- Reset key

## Publishing behavior for project-level papers

A new paper directly inside a project inherits project visibility:

- Public project: starts as `published`
- Private project: starts as `draft`
