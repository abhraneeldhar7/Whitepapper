import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';

export const DesktopTableOfContents = ({ contentRef }: { contentRef: React.RefObject<HTMLDivElement> }) => {
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // 1. Scan the container for headings
  useLayoutEffect(() => {
    if (contentRef.current) {
      const elements = Array.from(
        contentRef.current.querySelectorAll("h2, h3")
      ).map((elem) => ({
        id: elem.id,
        text: elem.textContent || "",
        level: Number(elem.tagName.substring(1)),
      }));
      
      setHeadings(elements);
    }
  }, [contentRef]);

  // 2. Handle Scroll Detection
  useEffect(() => {
    const handleScroll = () => {
      const scrollMargin = 80;
      let currentActiveId = "";
      let minDistance = Infinity;

      headings.forEach((heading) => {
        const element = document.getElementById(heading.id);
        if (element) {
          const rect = element.getBoundingClientRect();
          const distance = Math.abs(rect.top - scrollMargin);

          if (distance < minDistance) {
            minDistance = distance;
            currentActiveId = heading.id;
          }
        }
      });
      setActiveId(currentActiveId);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const offsetPosition = (elementRect - bodyRect) - offset;

      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  };

  return (
    <nav className="w-64 sticky top-20 h-fit p-4">
      <p className="text-[14px] font-semibold text-blue-500/80 mb-4 uppercase tracking-wider">
        On This Page
      </p>
      <ul className="space-y-3">
        {headings.map((heading) => (
          <li
            key={heading.id}
            style={{ paddingLeft: `${(heading.level - 2) * 16}px` }}
          >
            <button
              onClick={() => scrollToHeading(heading.id)}
              className={`text-[16px] text-left transition-all duration-200 ${
                activeId === heading.id
                  ? "text-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};