## Installation

````bash
npx whitepapper add linear-table-of-content --outdir src/components/ui
````

## Usage

````tsx
import MarkdownRender from "@/components/ui/markdown-render/markdown-render";
import { LinearTableOfContent } from "@/components/ui/toc/linearTableOfContent";

export default function DocsPage() {
  return (
    <div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden md:block">
        <LinearTableOfContent containerId="docs-content" offset={100} />
      </aside>

      <MarkdownRender
        contentContainerId="docs-content"
        content={`## Section one\n\nContent\n\n## Section two\n\nMore content`}
      />
    </div>
  );
}
````

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `containerId` | `string` | Id of the rendered content wrapper whose headings should be indexed. |
| `offset` | `number` | Scroll offset used to determine the active heading and click target position. |

## Notes

Linear TOC works best when your article has a clear heading hierarchy and enough vertical space for the rail to breathe.
