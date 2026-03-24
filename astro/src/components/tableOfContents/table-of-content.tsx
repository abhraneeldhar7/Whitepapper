import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatedThemeToggler } from '../ui/animated-theme-toggler'
// import { AnimatedThemeToggler } from './ui/animated-theme-toggler'

interface Heading {
    id: string
    text: string
    level: number
    element: HTMLElement
}

interface TableOfContentsProps {
    contentRef: React.RefObject<HTMLElement | null>
}

function CircleProgress({ value }: { value: number }) {
    const circumference = 2 * Math.PI * 10
    const strokeDashoffset = circumference - (value || 0) / 100 * circumference

    return (
        <div className="relative w-5 h-5 shrink-0">
            <svg className="w-5 h-5 transform -rotate-90">
                <circle
                    className="text-muted stroke-current"
                    strokeWidth="2"
                    fill="transparent"
                    r="9"
                    cx="10"
                    cy="10"
                />
                <circle
                    className="text-foreground stroke-current transition-all duration-300"
                    strokeWidth="2"
                    fill="transparent"
                    r="9"
                    cx="10"
                    cy="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </svg>
        </div>
    )
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ contentRef }) => {
    const [headings, setHeadings] = useState<Heading[]>([])
    const [activeId, setActiveId] = useState<string>('')
    const [progress, setProgress] = useState(0)
    const [isExpanded, setIsExpanded] = useState(false)
    const [currentHeadingText, setCurrentHeadingText] = useState('')
    const [isNearBottom, setIsNearBottom] = useState(false)

    const tocRef = useRef<HTMLDivElement>(null)
    const scrollListRef = useRef<HTMLDivElement>(null)
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pillRef = useRef<HTMLDivElement>(null)
    const scrollRootRef = useRef<HTMLElement | Window | null>(null)

    // Extract headings from content
    useEffect(() => {
        if (!contentRef.current) return

        const extractHeadings = () => {
            if (!contentRef.current) return

            const headingElements = Array.from(
                contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6')
            ) as HTMLElement[]

            const extractedHeadings = headingElements.map((element, index) => {
                const id = element.id || `heading-${index}`
                if (!element.id) {
                    element.id = id
                }
                return {
                    id,
                    text: element.textContent || '',
                    level: parseInt(element.tagName.substring(1)),
                    element,
                }
            })

            setHeadings(extractedHeadings)

            // Initialize with first heading if available
            if (extractedHeadings.length > 0) {
                setCurrentHeadingText(extractedHeadings[0].text)
                setActiveId(extractedHeadings[0].id)
            }
        }

        // Run immediately and once again in next frame to catch async markdown paint.
        extractHeadings()
        const rafId = window.requestAnimationFrame(extractHeadings)
        let attempts = 0
        const retryId = window.setInterval(() => {
            attempts += 1
            extractHeadings()
            if (attempts >= 20 || (contentRef.current?.querySelector('h1, h2, h3, h4, h5, h6'))) {
                window.clearInterval(retryId)
            }
        }, 120)

        const observer = new MutationObserver(() => {
            extractHeadings()
        })
        observer.observe(contentRef.current, { childList: true, subtree: true })

        return () => {
            window.cancelAnimationFrame(rafId)
            window.clearInterval(retryId)
            observer.disconnect()
        }
    }, [contentRef])

    // Handle scroll progress and Active Heading detection
    const handleScroll = useCallback(() => {
        if (!contentRef.current || headings.length === 0) return

        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current)
        }

        scrollTimeoutRef.current = setTimeout(() => {
            const contentEl = contentRef.current
            if (!contentEl) return

            const scrollRoot = scrollRootRef.current ?? window
            const scrollTop = scrollRoot instanceof Window ? window.scrollY : scrollRoot.scrollTop
            const contentTop = contentEl.offsetTop
            const contentHeight = contentEl.offsetHeight
            const windowHeight = scrollRoot instanceof Window ? window.innerHeight : scrollRoot.clientHeight
            const contentRect = contentEl.getBoundingClientRect()
            const rootBottom = scrollRoot instanceof Window
                ? window.innerHeight
                : scrollRoot.getBoundingClientRect().bottom

            // 1. Calculate Progress
            const contentScrollTop = Math.max(0, scrollTop - contentTop)
            const scrollableDistance = contentHeight - windowHeight

            let progressVal = 0
            if (scrollableDistance > 0) {
                progressVal = Math.min(100, Math.max(0, (contentScrollTop / scrollableDistance) * 100))
                setProgress(progressVal)
            }

            const bottomGap = contentRect.bottom - rootBottom
            // Only hide near the bottom after user has progressed meaningfully.
            setIsNearBottom(scrollableDistance > 0 && bottomGap <= 140 && progressVal > 85)

            // 2. Determine Active Heading
            const upperBound = scrollTop + 60
            let currentActive = headings[0]
            let withinRange: Heading | null = null

            for (let i = 0; i < headings.length; i++) {
                const heading = headings[i]
                const elementTop = heading.element.getBoundingClientRect().top + (scrollRoot instanceof Window ? window.scrollY : scrollRoot.scrollTop)

                if (elementTop >= scrollTop && elementTop <= upperBound) {
                    withinRange = heading
                    break
                }

                if (elementTop <= upperBound) {
                    currentActive = heading
                } else {
                    break
                }
            }

            if (withinRange) {
                currentActive = withinRange
            }

            if (currentActive) {
                setActiveId(currentActive.id)
                setCurrentHeadingText(currentActive.text)
            }

        }, 16)
    }, [contentRef, headings])

    // Attach scroll listener
    useEffect(() => {
        handleScroll()
        const root = document.getElementById('app-scroll-root') ?? window
        scrollRootRef.current = root
        if (root instanceof Window) {
            window.addEventListener('scroll', handleScroll, { passive: true })
        } else {
            root.addEventListener('scroll', handleScroll, { passive: true })
        }
        return () => {
            if (root instanceof Window) {
                window.removeEventListener('scroll', handleScroll)
            } else {
                root.removeEventListener('scroll', handleScroll)
            }
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
        }
    }, [handleScroll])

    // Auto-scroll to active item when expanded
    useEffect(() => {
        if (isExpanded && activeId && scrollListRef.current) {
            const activeElement = document.getElementById(`toc-btn-${activeId}`)
            if (activeElement) {
                // Wait for the expansion transition to finish slightly for smoother visual
                setTimeout(() => {
                    activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' })
                }, 100)
            }
        }
    }, [isExpanded, activeId])

    // Handle heading click
    const scrollToHeading = (id: string) => {
        const element = document.getElementById(id)
        if (element) {
            const root = scrollRootRef.current ?? window
            const rootTop = root instanceof Window ? 0 : root.getBoundingClientRect().top
            const currentScroll = root instanceof Window ? window.scrollY : root.scrollTop
            const elementTop = element.getBoundingClientRect().top - rootTop + currentScroll
            const offset = 60
            if (root instanceof Window) {
                window.scrollTo({ top: elementTop - offset, behavior: 'smooth' })
            } else {
                root.scrollTo({ top: elementTop - offset, behavior: 'smooth' })
            }
        }
        setIsExpanded(false)
    }

    // Close TOC when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isExpanded && tocRef.current && !tocRef.current.contains(event.target as Node)) {
                setIsExpanded(false)
            }
        }

        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isExpanded])

    if (headings.length === 0) return null

    return (
        <>
            <style>{`
                /* Hide scrollbar for Chrome, Safari and Opera */
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                /* Hide scrollbar for IE, Edge and Firefox */
                .no-scrollbar {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
                
                @keyframes slideUpFade {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .animate-slide-up-fade {
                    animation: slideUpFade 0.3s ease-out forwards;
                }
            `}</style>

            {/* Dynamic Island TOC Container */}
            <div
                ref={tocRef}
                className={`fixed z-50 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] bottom-[15px] px-[10px] md:px-0 w-full ${isExpanded
                    ? 'left-1/2 -translate-x-1/2 md:max-w-[400px] max-w-[400px] h-[200px]'
                    : 'bottom-[15px] left-1/2 -translate-x-1/2 max-w-[300px] md:max-w-[300px] h-[45px]'
                    } ${isNearBottom ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100'}`}
            >
                {/* The Pill / Card */}
                <div
                    ref={pillRef}
                    className={`bg-white dark:bg-black text-foreground shadow-lg overflow-hidden h-full flex flex-col transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] border border-border/30 ${isExpanded
                        ? 'rounded-[16px]'
                        : 'rounded-[30px] cursor-pointer'
                        }`}
                    onClick={() => !isExpanded && setIsExpanded(true)}
                >
                    {/* Header Section (Always Visible) */}
                    {/* flex-shrink-0 ensures this stays 45px height regardless of container expansion */}
                    <div className={`flex items-center gap-3 shrink-0 h-[45px] w-full px-3 transition-all duration-300 ${isExpanded ? "opacity-100 border-b border-border/10" : "opacity-100"}`}>
                        <CircleProgress value={progress} />

                        {/* Current heading text area */}
                        <div className="flex-1 min-w-0 h-full relative overflow-hidden flex items-center">
                            {/* We use a key to trigger the animation when text changes */}
                            <div
                                key={currentHeadingText}
                                className="text-[12px] font-[500] truncate w-full animate-slide-up-fade absolute"
                            >
                                {currentHeadingText}
                            </div>
                        </div>

                        {isExpanded &&
                            <AnimatedThemeToggler size={18} className='shrink-0' />
                        }
                    </div>

                    {/* Expanded List Section */}
                    {/* flex-1 ensures it fills the remaining space, min-h-0 allows internal scrolling */}
                    <div className={`flex-1 min-h-0 w-full transition-opacity duration-300 ${isExpanded ? "opacity-100" : "opacity-0"}`}>
                        <div
                            ref={scrollListRef}
                            className="h-full w-full overflow-y-auto no-scrollbar px-2 py-2"
                        >
                            <div className="space-y-[2px]">
                                {headings.map((heading) => (
                                    <button
                                        key={heading.id}
                                        id={`toc-btn-${heading.id}`}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            scrollToHeading(heading.id)
                                        }}
                                        className={`w-full flex items-center rounded-[6px] text-start px-2 py-1.5 transition-colors ${activeId === heading.id
                                            ? 'bg-muted/10 font-[500] text-foreground'
                                            : 'hover:bg-muted/5 font-[400] opacity-[0.7] hover:opacity-[1]'
                                            }`}
                                    >
                                        {/* Indentation lines */}
                                        <div className="flex shrink-0 mr-2">
                                            {[...Array(heading.level - 1)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="w-[6px]" // Smaller indentation
                                                />))}
                                        </div>

                                        <span className="text-[12px] truncate leading-tight">{heading.text}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </>
    )
}

export default TableOfContents
