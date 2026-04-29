# Whitepapper npm Components

Reusable React components from [Whitepapper](https://whitepapper.antk.in) — a markdown-first content platform for developers. These are extracted from production use and work in any React project.

## Package

- **CLI name:** `whitepapper`
- **Registry:** `npm-components/registry/registry.json`

## Quick Start

```bash
# List available components
npx whitepapper list

# Install a component (defaults to current directory)
npx whitepapper add markdown-render

# Install to a custom directory
npx whitepapper add markdown-render --outdir src/components
```

Or install globally:

```bash
npm i -g whitepapper
whitepapper add markdown-render
```

---

## Components

### 1. `markdown-render`

![markdown-render](https://raw.githubusercontent.com/abhraneeldhar7/whitepapper/master/astro/src/assets/components/markdownRender.png)

A reading-first React markdown renderer with:

- GitHub-flavored markdown (tables, task lists, strikethrough)
- Code syntax highlighting via [Shiki](https://shiki.style) (light/dark themes)
- Copy-to-clipboard button on code blocks
- Language tag display on code blocks
- Sanitized HTML (via `rehype-sanitize`)
- Safe external link handling (opens in new tab)
- Responsive table wrapper with horizontal scroll
- Lazy-loaded images with auto alt-text fallback
- Print-friendly styles

#### Install

```bash
npx whitepapper add markdown-render
```

#### Files

```
markdown-render/markdown-render.tsx
markdown-render/markdown-render.css
markdown-render/MarkdownCopyButtonClient.tsx
```

#### Dependencies

`react`, `react-markdown`, `remark-gfm`, `rehype-raw`, `rehype-sanitize`, `@shikijs/rehype`, `shiki`, `lucide-react`

#### Props

```ts
type MarkdownRenderProps = {
  content: string
  contentContainerId?: string
}
```

| Prop | Type | Description |
|------|------|-------------|
| `content` | `string` | Markdown string to render |
| `contentContainerId` | `string` (optional) | ID used by TOC components to scan headings |

#### Usage

```tsx
import MarkdownRender from "./markdown-render/markdown-render";

export default function Article({ body }: { body: string }) {
  return (
    <MarkdownRender contentContainerId="article-content" content={body} />
  );
}
```

---

### 2. `linear-table-of-content`

![linear-table-of-content](https://raw.githubusercontent.com/abhraneeldhar7/whitepapper/master/astro/src/assets/components/linearToc.png)

Desktop sidebar table of contents with active heading tracking and smooth indicator bar.

#### Install

```bash
npx whitepapper add linear-table-of-content
```

#### Files

```
toc/linearTableOfContent.tsx
```

#### Dependencies

`react`

#### Props

```ts
type LinearTableOfContentProps = {
  containerId: string
  offset?: number
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `containerId` | `string` | — | ID of the content wrapper to scan headings from |
| `offset` | `number` | `100` | Active heading threshold from viewport top |

#### Usage

```tsx
import { LinearTableOfContent } from "./toc/linearTableOfContent";

<LinearTableOfContent containerId="article-content" offset={100} />
```

---

### 3. `lines-table-of-content`

![lines-table-of-content](https://raw.githubusercontent.com/abhraneeldhar7/whitepapper/master/astro/src/assets/components/linesToc.png)

Interactive right-edge line TOC with hover expansion and active heading highlight.

#### Install

```bash
npx whitepapper add lines-table-of-content
```

#### Files

```
toc/linesTableOfContent.tsx
```

#### Dependencies

`react`

#### Props

```ts
type LinesTableOfContentProps = {
  contentContainerId: string
}
```

| Prop | Type | Description |
|------|------|-------------|
| `contentContainerId` | `string` | ID of the content wrapper to scan headings from |

#### Usage

```tsx
import { LinesTableOfContent } from "./toc/linesTableOfContent";

<LinesTableOfContent contentContainerId="article-content" />
```

---

### 4. `mobile-table-of-content`

![mobile-table-of-content](https://raw.githubusercontent.com/abhraneeldhar7/whitepapper/master/astro/src/assets/components/mobileToc.png)

Mobile bottom-sheet TOC with reading progress indicator, active heading state, and animated theme toggler.

#### Install

```bash
npx whitepapper add mobile-table-of-content
```

#### Files

```
toc/mobileTableOfContent.tsx
toc/animated-theme-toggler.tsx
```

#### Dependencies

`react`, `lucide-react`, `react-dom`

#### Props

```ts
type MobileTableOfContentProps = {
  contentContainerId: string
  topOffset?: number
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `contentContainerId` | `string` | — | ID of the content wrapper to scan headings from |
| `topOffset` | `number` | `60` | Scroll offset when navigating to a heading |

#### Usage

```tsx
import MobileTableOfContent from "./toc/mobileTableOfContent";

<MobileTableOfContent contentContainerId="article-content" topOffset={60} />
```

---

## Styling

- **`markdown-render`** ships its own CSS — import is included in the component file.
- **TOC components** expect these CSS classes to exist in your project (Tailwind recommended):
  `bg-border`, `bg-foreground`, `bg-background`, `bg-muted`, `text-foreground`, `text-muted-foreground`
- **`AnimatedThemeToggler`** toggles the `dark` class on `document.documentElement`.

### Dark Mode

TOC components rely on the `dark` class on `<html>`. Toggle it with:

```ts
document.documentElement.classList.toggle("dark");
```

## Requirements

- Node.js `>=18.17.0`
- React `>=18`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Syntax highlighting not working | Install deps: `npm install shiki @shikijs/rehype` |
| Theme toggler icons missing | Install `lucide-react` |
| TOC looks unstyled | Add Tailwind CSS or define utility classes |
| `import.meta.env` error | Falls back to `window.location.origin` — works everywhere |

## Development

1. Sync source files from `astro/src/components/ui/` to `npm-components/registry/`
2. Remove Astro-specific imports (`@/lib/seo`, `astro/jsx-runtime`)
3. Update `registry/registry.json` with changed deps
4. Test: `npx whitepapper add markdown-render --outdir ./test-components`
