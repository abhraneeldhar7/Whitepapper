import type { JSX } from 'astro/jsx-runtime';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface Heading {
  element: Element;
  text: string;
  level: number;
  position: number;
  id: string;
}

interface TableOfContentsProps {
  contentRef: React.RefObject<HTMLElement | null>;
}

export const LinesTableOfContent: React.FC<TableOfContentsProps> = ({ contentRef }) => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const tocRef = useRef<HTMLDivElement>(null);
  const lineCount: number = 40;
  const scrollRootRef = useRef<HTMLElement | Window | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialActiveSetRef = useRef<boolean>(false);
  const headingLineMapRef = useRef<Map<number, number>>(new Map());

  const getAbsoluteTop = useCallback((element: Element, root: HTMLElement | Window): number => {
    const rect = element.getBoundingClientRect();
    if (root instanceof Window) {
      return rect.top + window.scrollY;
    }
    const rootRect = root.getBoundingClientRect();
    return rect.top - rootRect.top + root.scrollTop;
  }, []);

  // Extract headings from content
  useEffect(() => {
    if (!contentRef.current) return;

    const extractHeadings = () => {
      if (!contentRef.current) return;

      const elements = contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const root = scrollRootRef.current ?? document.getElementById('app-scroll-root') ?? window;
      const contentAbsoluteTop = getAbsoluteTop(contentRef.current, root);
      const contentHeight = Math.max(1, contentRef.current.scrollHeight);

      const headingData: Heading[] = Array.from(elements).map((heading, index) => {
        const id = heading.id || `heading-${index}`;
        if (!heading.id) {
          heading.id = id;
        }

        const headingAbsoluteTop = getAbsoluteTop(heading, root);
        const relativeTop = (headingAbsoluteTop - contentAbsoluteTop) / contentHeight;

        return {
          element: heading,
          text: heading.textContent || '',
          level: parseInt(heading.tagName[1]),
          position: Math.min(1, Math.max(0, relativeTop)),
          id: id
        };
      });

      setHeadings(headingData);
    };

    extractHeadings();

    // Retry a few times for dynamic content
    let attempts = 0;
    const retryId = window.setInterval(() => {
      attempts += 1;
      extractHeadings();
      if (attempts >= 20 || (contentRef.current?.querySelector('h1, h2, h3, h4, h5, h6'))) {
        window.clearInterval(retryId);
      }
    }, 120);

    const observer = new MutationObserver(extractHeadings);
    observer.observe(contentRef.current, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => {
      window.clearInterval(retryId);
      observer.disconnect();
    };
  }, [contentRef, getAbsoluteTop]);

  const headingLineMap = useMemo(() => {
    const map = new Map<number, number>();
    if (headings.length === 0) return map;

    const maxLineIndex = lineCount - 1;

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const remainingHeadings = headings.length - i - 1;
      const minAllowed = i === 0 ? 0 : (map.get(i - 1) ?? 0) + 1;
      const maxAllowed = Math.max(minAllowed, maxLineIndex - remainingHeadings);

      const rawLine = Math.round(heading.position * maxLineIndex);
      const lineIndex = Math.min(maxAllowed, Math.max(minAllowed, rawLine));
      map.set(i, lineIndex);
    }

    return map;
  }, [headings, lineCount]);

  useEffect(() => {
    headingLineMapRef.current = headingLineMap;
  }, [headingLineMap]);

  const headingIndexForLine = useCallback((lineIndex: number): number => {
    for (let i = 0; i < headings.length; i++) {
      if (headingLineMapRef.current.get(i) === lineIndex) {
        return i;
      }
    }
    return -1;
  }, [headings]);

  // Find closest heading to a line position
  const findClosestHeadingIndex = useCallback((lineIndex: number): number => {
    if (headings.length === 0) return -1;

    let closestIndex = 0;
    let smallestDistance = Math.abs((headingLineMapRef.current.get(0) ?? 0) - lineIndex);

    for (let i = 1; i < headings.length; i++) {
      const mappedLine = headingLineMapRef.current.get(i) ?? 0;
      const distance = Math.abs(mappedLine - lineIndex);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }, [headings]);

  // Handle scroll to determine active heading and active normal line
  const handleScroll = useCallback(() => {
    if (!contentRef.current || headings.length === 0) return;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      const contentEl = contentRef.current;
      if (!contentEl) return;

      const scrollRoot = scrollRootRef.current ?? window;
      // Find active heading (the one that crossed 50px from top)
      let activeHeading: Heading | null = null;
      const rootTop = scrollRoot instanceof Window ? 0 : scrollRoot.getBoundingClientRect().top;
      const thresholdTop = rootTop + 50;

      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        const headingElement = heading.element as HTMLElement;

        if (headingElement.getBoundingClientRect().top <= thresholdTop) {
          activeHeading = heading;
        } else {
          break;
        }
      }

      if (activeHeading) {
        setActiveId(activeHeading.id);
      } else if (headings.length > 0 && !initialActiveSetRef.current) {
        // Set first heading as active on initial load if no active heading found
        setActiveId(headings[0].id);
      }

      initialActiveSetRef.current = true;
    }, 16);
  }, [contentRef, headings]);

  // Set initial active heading on mount
  useEffect(() => {
    if (headings.length > 0 && !initialActiveSetRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        handleScroll();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [headings, handleScroll]);

  // Attach scroll listener
  useEffect(() => {
    handleScroll();

    const root = document.getElementById('app-scroll-root') ?? window;
    scrollRootRef.current = root;

    if (root instanceof Window) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    } else {
      root.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (root instanceof Window) {
        window.removeEventListener('scroll', handleScroll);
      } else {
        root.removeEventListener('scroll', handleScroll);
      }
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [handleScroll]);

  const handleLineClick = (lineIndex: number): void => {
    if (!contentRef.current || headings.length === 0) return;

    const closestHeadingIndex = headingIndexForLine(lineIndex);
    const isHeadingLine = closestHeadingIndex !== -1;

    if (!isHeadingLine || !headings[closestHeadingIndex]) return;

    const root = scrollRootRef.current ?? window;
    const heading = headings[closestHeadingIndex];
    const headingElement = heading.element as HTMLElement;

    const rootTop = root instanceof Window ? 0 : root.getBoundingClientRect().top;
    const currentScroll = root instanceof Window ? window.scrollY : root.scrollTop;
    const elementTop = headingElement.getBoundingClientRect().top - rootTop + currentScroll;
    const offset = 50;

    if (root instanceof Window) {
      window.scrollTo({ top: elementTop - offset, behavior: 'smooth' });
    } else {
      root.scrollTo({ top: elementTop - offset, behavior: 'smooth' });
    }
  };

  const renderLines = (): JSX.Element[] => {
    const lines: JSX.Element[] = [];

    for (let i = 0; i < lineCount; i++) {
      const closestHeadingIndex = headingIndexForLine(i);
      const isHeadingLine = closestHeadingIndex !== -1;

      // Check if this line corresponds to the active heading
      const isActiveHeading = isHeadingLine &&
        closestHeadingIndex !== -1 &&
        headings[closestHeadingIndex]?.id === activeId;

      // Width based on type and hover state
      let width = 'w-[8px]'; // Default width for normal lines (not hovered)
      if (isHeadingLine) {
        width = 'w-[12px]'; // Heading lines are 10px wide (not hovered)
      }

      let height = 'h-[1px]'
      
      // Color based on active state
      let bgColor = 'bg-muted-foreground';
      if (isActiveHeading) {
        height = 'h-[3px]'
        width = 'w-[20px]'; // Active heading line is wider
        bgColor = 'bg-primary'; // Active heading gets primary color
      }

      // Override width on hover
      if (isHovering) {
        if (isHeadingLine) {
          width = 'w-[20px]'; // Heading lines 14px on hover
        } else {
          width = 'w-[12px]'; // Normal lines 8px on hover
        }
      }

      lines.push(
        <div
          key={i}
          className="relative flex items-center justify-end w-full"
          style={{ height: '24px' }}
        >
          {/* Heading text on hover - with opacity transition */}
          <div
            className={`
              cursor-pointer select-none
              absolute right-0 mr-5 px-3 py-1.5 text-[15px] rounded-md 
              max-w-[400px] truncate text-muted-foreground
              transition-opacity duration-200
              ${isHovering && isHeadingLine && headings[closestHeadingIndex]
                ? 'opacity-100 cursor-pointer hover:text-foreground'
                : 'opacity-0 pointer-events-none'
              }
            `}
            onClick={(e) => {
              e.stopPropagation();
              if (isHeadingLine && headings[closestHeadingIndex]) {
                handleLineClick(i);
              }
            }}
          >
            {isHeadingLine && headings[closestHeadingIndex] && headings[closestHeadingIndex].text}
          </div>

          {/* Line indicator */}
          <div
            className={`
              ${width} ${height} ${bgColor} rounded-full ${isHeadingLine ? 'cursor-pointer' : ''}
              transition-all duration-200
              ${isHeadingLine ? 'opacity-100' : 'opacity-80 hover:opacity-100'}
            `}
            onClick={(e) => {
              if (isHeadingLine) {
                e.stopPropagation();
                handleLineClick(i);
              }
            }}
            aria-label={isHeadingLine && headings[closestHeadingIndex] ? `Navigate to: ${headings[closestHeadingIndex].text}` : undefined}
          />
        </div>
      );
    }

    return lines;
  };

  return (
    <div
      ref={tocRef}
      className="fixed right-0 top-0 h-screen flex items-center z-50"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Hover detection area - 100px from right edge */}
      <div className="absolute inset-y-0 left-0 w-[200px] -ml-[100px]" />

      {/* Table of contents */}
      <div className="h-full flex flex-col justify-center py-8 pr-3">
        <div className="flex flex-col justify-between h-full">
          {renderLines()}
        </div>
      </div>
    </div>
  );
};