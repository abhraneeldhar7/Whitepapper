import { useEffect, useRef, useState } from "react";

import { LinesTableOfContent } from "@/components/tableOfContents/linesTableOfContent";

type Props = {
  contentContainerId: string;
};

export default function PostPreviewDesktopToc({ contentContainerId }: Props) {
  const contentRef = useRef<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const node = document.getElementById(contentContainerId);
    if (!node) return;

    contentRef.current = node as HTMLElement;
    setIsReady(true);
  }, [contentContainerId]);

  if (!isReady) return null;

  return <LinesTableOfContent contentRef={contentRef} />;
}
