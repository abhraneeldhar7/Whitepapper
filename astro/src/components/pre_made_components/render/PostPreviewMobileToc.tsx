import { useEffect, useRef, useState } from "react";

import TableOfContents from "@/components/tableOfContents/table-of-content";

type Props = {
  contentContainerId: string;
  topOffset?: number;
};

export default function PostPreviewMobileToc({ contentContainerId, topOffset }: Props) {
  const contentRef = useRef<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const node = document.getElementById(contentContainerId);
    if (!node) return;

    contentRef.current = node as HTMLElement;
    setIsReady(true);
  }, [contentContainerId]);

  if (!isReady) return null;

  return <TableOfContents contentRef={contentRef} topOffset={topOffset} />;
}
