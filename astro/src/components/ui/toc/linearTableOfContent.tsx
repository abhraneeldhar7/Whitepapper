import React, { useEffect, useState, useRef } from "react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface LinearTableOfContentProps {
  /** The ID of the parent wrapper containing your article/content to scan */
  containerId: string;
  /** Distance from the top of the viewport to use as the active threshold */
  offset?: number;
}

export function LinearTableOfContent({
  containerId,
  offset = 100,
}: LinearTableOfContentProps) {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 });
  
  // Keep track of the list items to calculate the smooth bar position
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  // 1. Scan the container for headings
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const elements = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    const parsedHeadings = elements.map((el) => {
      // Auto-generate an ID if the heading doesn't have one
      if (!el.id) {
        el.id = el.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "heading";
      }
      return {
        id: el.id,
        text: el.textContent || "",
        level: Number(el.tagName.replace("H", "")),
      };
    });

    setHeadings(parsedHeadings);
  }, [containerId]);

  // 2. Scroll Spy logic
  useEffect(() => {
    if (headings.length === 0) return;

    let ticking = false;

    const updateActiveHeading = () => {
      ticking = false;

      const headingElements = headings
        .map((heading) => document.getElementById(heading.id))
        .filter((el): el is HTMLElement => el !== null);

      if (headingElements.length === 0) return;

      // Pick the heading whose top is closest to the reading threshold line.
      const threshold = Math.max(0, offset);
      const closestHeading = headingElements.reduce((best, current) => {
        const bestTop = best.getBoundingClientRect().top;
        const currentTop = current.getBoundingClientRect().top;
        const bestDistance = Math.abs(bestTop - threshold);
        const currentDistance = Math.abs(currentTop - threshold);

        if (currentDistance < bestDistance) {
          return current;
        }

        if (currentDistance === bestDistance) {
          // If equally close, prefer the heading already at/above the threshold.
          const bestIsAbove = bestTop <= threshold;
          const currentIsAbove = currentTop <= threshold;
          if (currentIsAbove && !bestIsAbove) {
            return current;
          }
        }

        return best;
      }, headingElements[0]);

      const currentActiveId = closestHeading.id;

      setActiveId((prev) => (prev === currentActiveId ? prev : currentActiveId));
    };

    const queueUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActiveHeading);
    };

    updateActiveHeading(); // Trigger immediately on mount

    window.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate);

    return () => {
      window.removeEventListener("scroll", queueUpdate);
      window.removeEventListener("resize", queueUpdate);
    };
  }, [containerId, offset, headings]);

  // 3. Smooth Indicator Position Calculation
  useEffect(() => {
    const activeItem = itemRefs.current[activeId];
    if (activeItem) {
      setIndicatorStyle({
        top: activeItem.offsetTop,
        height: activeItem.offsetHeight,
        opacity: 1,
      });
    } else {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [activeId, headings]);

  // 4. Click to scroll handler
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  if (headings.length === 0) return null;

  // Normalize levels so the highest heading in the document gets 0 padding offset
  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <div className="relative text-sm dark:font-[300]">
      {/* Track Background */}
      <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-border" />

      {/* Smooth Animated Active Indicator */}
      <div
        className="absolute left-[-0.5px] w-[2px] bg-foreground transition-all duration-300 ease-in-out rounded-full"
        style={{
          top: `${indicatorStyle.top}px`,
          height: `${indicatorStyle.height}px`,
          opacity: indicatorStyle.opacity,
        }}
      />

      <ul className="flex flex-col relative list-none m-0 p-0">
        {headings.map((heading) => (
          <li
            key={heading.id}
            ref={(el) => {
              itemRefs.current[heading.id] = el;
            }}
            className="relative"
          >
            <a
              href={`#${heading.id}`}
              onClick={(e) => handleClick(e, heading.id)}
              className={`block py-1.5 transition-colors truncate hover:text-foreground ${
                activeId === heading.id
                  ? "text-foreground font-medium"
                  : "text-foreground/60"
              }`}
              style={{
                // Base 16px padding + 6px per nested level
                paddingLeft: `${(heading.level - minLevel) * 6 + 16}px`,
              }}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}