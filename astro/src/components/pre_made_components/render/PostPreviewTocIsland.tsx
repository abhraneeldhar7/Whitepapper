import { useEffect, useRef, useState } from "react";
import TableOfContents from "@/components/tableOfContents/table-of-content";
import { LinesTableOfContent } from "@/components/tableOfContents/linesTableOfContent";

type Props = {
  contentContainerId: string;
};

export default function PostPreviewTocIsland({ contentContainerId }: Props) {
  const contentRef = useRef<HTMLElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const node = document.getElementById(contentContainerId);
    if (!node) return;

    contentRef.current = node as HTMLElement;
    setIsReady(true);

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateIsDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(event.matches);
    };

    updateIsDesktop(mediaQuery);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateIsDesktop);
      return () => {
        mediaQuery.removeEventListener("change", updateIsDesktop);
      };
    }

    mediaQuery.addListener(updateIsDesktop);
    return () => {
      mediaQuery.removeListener(updateIsDesktop);
    };
  }, [contentContainerId]);

  if (!isReady) return null;

  return isDesktop ? (
    <LinesTableOfContent contentRef={contentRef} />
  ) : (
    <TableOfContents contentRef={contentRef} />
  );
}
