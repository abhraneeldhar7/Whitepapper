# Whitepapper npm Components

Reusable React components from [Whitepapper](https://whitepapper.antk.in) — a markdown-first content platform for developers. These components are extracted from production use and designed to work in any React project.

## Package

- **CLI name:** `whitepapper`
- **Registry:** `npm-components/registry/registry.json`
- **License:** MIT

## Quick Start

```bash
# List available components
npx whitepapper list

# Install a component
npx whitepapper add markdown-render

# Install multiple components at once
npx whitepapper add toc
npx whitepapper add markdown-render mobile-table-of-content

# Install to a custom directory
npx whitepapper add toc --outdir src/components/ui
```

Or install globally:

```bash
npm i -g whitepapper
whitepapper add markdown-render
```

---

## Components

### 1. `markdown-render`

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

#### Files installed

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

- `content` — markdown string to render
- `contentContainerId` — optional ID used by TOC components to scan headings

#### Usage

```tsx
import MarkdownRender from "./components/ui/markdown-render/markdown-render";

export default function Article({ body }: { body: string }) {
  return (
    <MarkdownRender
      contentContainerId="article-content"
      content={body}
    />
  );
}
```

---

### 2. `toc` (bundle)

All three table-of-contents variants plus the animated theme toggler. Use this when you want all TOC options available.

#### Files installed

```
toc/linearTableOfContent.tsx
toc/linesTableOfContent.tsx
toc/mobileTableOfContent.tsx
toc/animated-theme-toggler.tsx
```

#### Dependencies

`react`, `lucide-react`, `react-dom`

#### Exports

- `LinearTableOfContent` — desktop sidebar rail with smooth indicator
- `LinesTableOfContent` — interactive right-edge line rail
- `MobileTableOfContent` — mobile bottom-sheet with reading progress
- `AnimatedThemeToggler` — theme toggle used by mobile TOC

#### Usage

```tsx
import { LinearTableOfContent } from "./components/ui/toc/linearTableOfContent";
import { LinesTableOfContent } from "./components/ui/toc/linesTableOfContent";
import MobileTableOfContent from "./components/ui/toc/mobileTableOfContent";

// Desktop rail
<LinearTableOfContent containerId="article-content" offset={100} />

// Interactive line TOC
<LinesTableOfContent contentContainerId="article-content" />

// Mobile bottom-sheet
<MobileTableOfContent contentContainerId="article-content" topOffset={60} />
```

---

### 3. `linear-table-of-content`

Standalone desktop TOC with active heading tracking and smooth indicator bar.

#### Props

```ts
type LinearTableOfContentProps = {
  containerId: string
  offset?: number  // default 100
}
```

---

### 4. `lines-table-of-content`

Standalone interactive right-edge line TOC with hover expansion.

#### Props

```ts
type LinesTableOfContentProps = {
  contentContainerId: string
}
```

---

### 5. `mobile-table-of-content`

Standalone mobile bottom-sheet TOC with reading progress and animated theme toggler.

#### Props

```ts
type MobileTableOfContentProps = {
  contentContainerId: string
  topOffset?: number  // default 60
}
```

---

## Styling

- **`markdown-render`** ships its own CSS file. Import it alongside the component — the import is already in the component file.
- **TOC components** use utility class names (`bg-border`, `text-foreground`, etc.). Make sure your project has matching CSS variables defined or add fallback classes. The classes used are:
  - `bg-border`, `bg-foreground`, `bg-background`, `bg-muted`
  - `text-foreground`, `text-muted-foreground`
  - `dark:font-[300]`, `dark:border-white/25`, etc.
- **`AnimatedThemeToggler`** expects your app to toggle the `dark` class on `document.documentElement`.

### Dark Mode

The TOC components rely on the `dark` class on `<html>`. You can toggle it with:

```ts
document.documentElement.classList.toggle("dark");
```

The `AnimatedThemeToggler` component handles this automatically.

---

## Requirements

- Node.js `>=18.17.0`
- React `>=18`
- A React project (Vite, Next.js, Remix, CRA, etc.)

---

## Troubleshooting

| Problem | Likely Fix |
|---------|------------|
| Syntax highlighting not working | Run `npm install shiki @shikijs/rehype` |
| Theme toggler icons missing | Run `npm install lucide-react` |
| TOC looks unstyled | Add Tailwind CSS or define the utility classes used |
| Component install skipped | You declined the overwrite prompt — run again |
| `import.meta.env` error | The component falls back to `window.location.origin` — works in all modern bundlers |
| Animation not working | Browser doesn't support the Web Animations API — feature degrades gracefully |

---

## Development

To update components from the main Whitepapper codebase:

1. Sync source files from `astro/src/components/ui/` to `npm-components/registry/`
2. Remove any Astro-specific imports (`@/lib/seo`, `astro/jsx-runtime`, etc.)
3. Verify dependencies in `registry/registry.json`
4. Test the install flow in a clean React project:
   ```bash
   npx whitepapper add markdown-render --outdir ./test-components
   ```

---

## Registry Structure

```
npm-components/
├── registry/
│   ├── registry.json              # component definitions & dependency manifests
│   ├── markdown-render/
│   │   ├── markdown-render.tsx
│   │   ├── markdown-render.css
│   │   └── MarkdownCopyButtonClient.tsx
│   └── toc/
│       ├── linearTableOfContent.tsx
│       ├── linesTableOfContent.tsx
│       ├── mobileTableOfContent.tsx
│       └── animated-theme-toggler.tsx
├── cli/                           # CLI installer source
└── README.md                      # this file
```
