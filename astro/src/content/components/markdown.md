> This page below the code block is using the markdown render to display content.

## Installation

````bash
npx whitepapper add markdown-render --outdir src/components/ui
````

## Usage

````tsx
import MarkdownRender from "@/components/ui/markdown-render/markdown-render";

export default function ArticlePage() {
  return (
    <MarkdownRender
      content={`# Hello\n\nThis is **MarkdownRender** in action.\n\n- GitHub-flavored markdown\n- Copy buttons for fenced code blocks\n- Safe external links`}
      contentContainerId="article-content"
    />
  );
}
````

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `content` | `string` | Markdown string to render. |
| `contentContainerId` | `string` | Optional DOM id used by table-of-content components to scan the rendered content. |

## Notes

Use this when you want markdown content with a polished reading style, fenced code blocks, and copy buttons without wiring a separate renderer every time.
