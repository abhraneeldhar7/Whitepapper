# Whitepapper npm Components

Reusable UI components from Whitepapper, installable through the `whitepapper` CLI.

This registry is meant for React projects that want production-used components for markdown rendering and table-of-contents UX.

## Package

- CLI name: `whitepapper`
- Registry source: `npm-components/registry/registry.json`

## Install CLI

```bash
npm i -g whitepapper
```

or run without global install:

```bash
npx whitepapper list
```

## Commands

List available components:

```bash
whitepapper list
```

Install one or multiple components:

```bash
whitepapper add markdown-render
whitepapper add toc
whitepapper add markdown-render mobile-table-of-content
```

Install into a custom output directory:

```bash
whitepapper add toc --outdir src/components/ui
```

## Installer Behavior

The CLI now handles dependency setup directly.

- If a dependency is missing, it is installed.
- If a dependency already exists, it is updated to the latest compatible release.
- Existing component files trigger an overwrite prompt before writing.
- If overwrite is denied, the component install is skipped safely.
- Package manager is auto-detected (`pnpm`, `yarn`, `bun`, fallback `npm`).

## Component Catalog

## 1) `markdown-render`

Reading-first markdown renderer with:

- GitHub-flavored markdown support
- Shiki syntax highlighting
- Copy button for code blocks
- Responsive table wrapper
- Safe external link behavior

### Files

- `markdown-render/markdown-render.tsx`
- `markdown-render/markdown-render.css`

### Dependencies

- `react`
- `lucide-react`
- `react-markdown`
- `remark-gfm`
- `rehype-raw`
- `@shikijs/rehype`
- `shiki`

### Props

```ts
type PostRenderProps = {
	content: string
	contentContainerId?: string
}
```

- `content`: markdown string to render.
- `contentContainerId`: optional container id used by TOC components to scan headings.

### Usage

```tsx
import MarkdownRender from "./components/ui/markdown-render/markdown-render"

export default function ArticlePage() {
	return (
		<MarkdownRender
			contentContainerId="article-content"
			content={"# Hello\n\nThis is **markdown**."}
		/>
	)
}
```

## 2) `toc`

Bundle that includes all TOC variants plus the animated theme toggler used by mobile TOC.

### Files

- `toc/linearTableOfContent.tsx`
- `toc/linesTableOfContent.tsx`
- `toc/mobileTableOfContent.tsx`
- `animated-theme-toggler.tsx`

### Dependencies

- `react`
- `lucide-react`
- `react-dom`

### Components Included

- `LinearTableOfContent`
- `LinesTableOfContent`
- `MobileTableOfContent`
- `AnimatedThemeToggler`

## 3) `linear-table-of-content`

Minimal desktop TOC rail with active heading tracking and smooth indicator.

### File

- `toc/linearTableOfContent.tsx`

### Dependencies

- `react`

### Props

```ts
type LinearTableOfContentProps = {
	containerId: string
	offset?: number
}
```

- `containerId`: id of the content wrapper to scan headings from.
- `offset`: active heading threshold from viewport top (default `100`).

### Usage

```tsx
import { LinearTableOfContent } from "./components/ui/toc/linearTableOfContent"

<LinearTableOfContent containerId="article-content" offset={100} />
```

## 4) `lines-table-of-content`

Interactive right-edge line TOC with hover expansion and active heading highlight.

### File

- `toc/linesTableOfContent.tsx`

### Dependencies

- `react`

### Props

```ts
type TableOfContentsProps = {
	contentContainerId: string
}
```

- `contentContainerId`: id of article/content wrapper to inspect for headings.

### Usage

```tsx
import { LinesTableOfContent } from "./components/ui/toc/linesTableOfContent"

<LinesTableOfContent contentContainerId="article-content" />
```

## 5) `mobile-table-of-content`

Mobile bottom-sheet TOC with:

- Reading progress indicator
- Active heading state
- Expand/collapse interaction
- Animated theme toggler integration

### Files

- `toc/mobileTableOfContent.tsx`
- `animated-theme-toggler.tsx`

### Dependencies

- `react`
- `lucide-react`
- `react-dom`

### Props

```ts
type MobileTableOfContentProps = {
	contentContainerId: string
	topOffset?: number
}
```

- `contentContainerId`: id of article/content wrapper to inspect for headings.
- `topOffset`: scroll offset when navigating to heading (default `60`).

### Usage

```tsx
import MobileTableOfContent from "./components/ui/toc/mobileTableOfContent"

<MobileTableOfContent contentContainerId="article-content" topOffset={60} />
```

## Styling Notes

- `markdown-render` ships its own CSS file and should be imported with the component.
- TOC components use utility-first class names; make sure your project includes matching utility styles.
- `AnimatedThemeToggler` expects your app to toggle the `dark` class on `document.documentElement`.

## Requirements

- Node.js `>=18.17.0`
- React project environment

## Troubleshooting

- If a component install is skipped, it usually means you declined overwrite.
- If highlighting fails, verify `shiki` and `@shikijs/rehype` are installed.
- If theme toggler icons fail, verify `lucide-react` is installed.
- If animation transition API is unsupported in browser, theme toggle still works (without transition effect).

## Registry Maintenance

When updating component source from the app codebase:

1. Sync source files into `npm-components/registry/*`.
2. Verify imports are package-consumer safe (no app-internal aliases).
3. Ensure required dependencies are declared in `registry/registry.json`.
4. Test install flow using `whitepapper add <component>` in a clean React app.
