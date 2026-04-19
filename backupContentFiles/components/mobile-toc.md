## Installation

````bash
npx whitepapper add mobile-table-of-content --outdir src/components/ui
````

## Usage

````tsx
import MarkdownRender from "@/components/ui/markdown-render/markdown-render";
import MobileTableOfContent from "@/components/ui/toc/mobileTableOfContent";

export default function PostPage() {
  return (
    <>
      <MobileTableOfContent contentContainerId="mobile-docs-content" topOffset={60} />
      <MarkdownRender
        contentContainerId="mobile-docs-content"
        content={`## Intro\n\nContent\n\n## Deep dive\n\nMore content`}
      />
    </>
  );
}
````

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `contentContainerId` | `string` | Id of the content wrapper used to discover headings and track reading progress. |
| `topOffset` | `number` | Offset used when scrolling to a heading after tapping it in the mobile sheet. |

## Notes

This variant is built for dense reading on phones. It stays out of the way until needed, then expands into a compact heading navigator.
