The editor is where you write, save, publish, and manage papers.

## Editor layout

Main areas:

- Top bar: status, save, open, metadata, distribution actions
- Writing area: Markdown/WYSIWYG editor
- Side sheet: slug, thumbnail, metadata controls, and preferences

## Save behavior

There is no automatic background server save. Changes remain local to the open editor session until you save.

Use:

- **Save** button in the top bar
- `Ctrl+S` / `Cmd+S` shortcut

When saved, title, body, slug, status, thumbnail, and metadata changes are persisted.

## Publish and draft flow

Editor status values map to API status values:

- UI `draft` -> API `draft`
- UI `public` -> API `published`

When status is public and saved, the public paper URL is live if parent visibility rules allow public access.

## Metadata action

The metadata dialog lets you:

- Generate metadata with AI
- Edit metadata fields manually
- Save metadata changes as part of paper save flow

See [Metadata workflow](/docs/editor/metadata-workflow).

## Distribution action

Distribution is available from the editor action dialog for Hashnode, Dev.to, and Medium import.

See [Distribution overview](/docs/distribution/overview).

## Archive

Archived papers are not publicly accessible and are excluded from collection visibility propagation.
\nLast updated: 12th April, 2026\n
