import { useEffect, useRef, useState } from "react";
import PostRender from "@/components/ui/markdown-render/markdown-render";
import { Button } from "@/components/ui/button";

type ProjectDescriptionViewerProps = {
  content: string;
};

export default function ProjectDescriptionViewer({ content }: ProjectDescriptionViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [maxHeight, setMaxHeight] = useState("300px");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const scrollHeight = containerRef.current.scrollHeight;
      const isOverflowing = scrollHeight > 400;
      setShowMore(isOverflowing);
      
      if (expanded) {
        setMaxHeight(`${scrollHeight}px`);
      } else {
        setMaxHeight("350px");
      }
    }
  }, [content, expanded]);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        style={{ maxHeight }}
        className="overflow-hidden transition-[max-height] duration-300"
      >
        <PostRender content={content} />
      </div>
      {showMore && !expanded && (
        <Button
          variant="ghost"
          onClick={() => setExpanded(true)}
          className="w-full"
        >
          Show more
        </Button>
      )}
      {expanded && showMore && (
        <Button
          variant="ghost"
          onClick={() => setExpanded(false)}
          className="w-full"
        >
          Show less
        </Button>
      )}
    </div>
  );
}
