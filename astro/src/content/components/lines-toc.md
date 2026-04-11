> Switch to desktop to see this table of content.

## Installation

````bash
npx whitepapper add lines-table-of-content --outdir src/components/ui
````

## Usage

````tsx
import MarkdownRender from "@/components/ui/markdown-render/markdown-render";
import { LinesTableOfContent } from "@/components/ui/toc/linesTableOfContent";

export default function EssayPage() {
  return (
    <>
      <LinesTableOfContent contentContainerId="essay-content" />
      <MarkdownRender
        contentContainerId="essay-content"
        content={`## Opening\n\nContent\n\n## System design\n\nMore content\n\n## Closing\n\nWrap up`}
      />
    </>
  );
}
````

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `contentContainerId` | `string` | Id of the markdown/content wrapper that contains headings to map into the line rail. |

## Notes

The lines TOC is intentionally more expressive than a standard sidebar list. It is best on wide layouts where the right edge can act like an ambient reading instrument.
