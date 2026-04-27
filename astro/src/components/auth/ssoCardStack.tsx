"use client"
import React, { useState, useEffect, useRef, useCallback } from "react";

// Type definitions
interface Card {
    id: number;
    image: { src: string };
    heading: string;
}


// import EventElonImg from "@/assets/landingPage/hero_light.png"
// import RisavFootball from "@/assets/landingPage/carImg.jpg"
// import MarketplaceImg from "@/assets/landingPage/metatags_editor_light.png"
// import OrgImg from "@/assets/landingPage/editor_light.png"
// import ProjectsImg from "@/assets/landingPage/blogsPage.png"
// import ContentImg from "@/assets/landingPage/blueBgPattern.jpg"

// const initialCards: Card[] = [
//     {
//         id: 1,
//         image: EventElonImg,
//         heading: "Events engine",
//     },
//     {
//         id: 2,
//         image: RisavFootball,
//         heading: "Campus activity",
//     },
//     {
//         id: 3,
//         image: OrgImg,
//         heading: "Clubs Identity",
//     },
//     {
//         id: 4,
//         image: MarketplaceImg,
//         heading: "Marketplace",
//     },
//     {
//         id: 5,
//         image: ProjectsImg,
//         heading: "Projects Showcase",
//     },
//     {
//         id: 6,
//         image: ContentImg,
//         heading: "Content Engine",
//     },
// ];

const ANIMATION_MS = 450;
const AUTO_ADVANCE_MS = 2000;

const slotStyles = [
    { scale: 1, top: 0, opacity: 1, zIndex: 30 },
    { scale: 0.94, top: 24, opacity: 1, zIndex: 20 },
    { scale: 0.88, top: 48, opacity: 1, zIndex: 10 },
    { scale: 0.82, top: 72, opacity: 0, zIndex: 0 },
] as const;

const SSOCardStack: React.FC = () => {
    // const cards = initialCards;
    const cards = [];
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [isCycling, setIsCycling] = useState<boolean>(false);
    const [isLeaveActive, setIsLeaveActive] = useState<boolean>(false);
    const [leavingCard, setLeavingCard] = useState<Card | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rafRef = useRef<number | null>(null);
    const fallbackRafTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeIndexRef = useRef<number>(0);
    const isCyclingRef = useRef<boolean>(false);

    useEffect(() => {
        activeIndexRef.current = activeIndex;
    }, [activeIndex]);

    useEffect(() => {
        isCyclingRef.current = isCycling;
    }, [isCycling]);

    const dismissTopCard = useCallback((): void => {
        if (cards.length < 2 || isCyclingRef.current) return;

        isCyclingRef.current = true;
        setIsCycling(true);
        setIsLeaveActive(false);
        setLeavingCard(cards[activeIndexRef.current]);

        if (rafRef.current !== null && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
            window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (fallbackRafTimeoutRef.current) {
            clearTimeout(fallbackRafTimeoutRef.current);
            fallbackRafTimeoutRef.current = null;
        }

        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
            rafRef.current = window.requestAnimationFrame((): void => {
                setIsLeaveActive(true);
            });
        } else {
            fallbackRafTimeoutRef.current = setTimeout((): void => {
                setIsLeaveActive(true);
            }, 16);
        }

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout((): void => {
            setActiveIndex((prev: number): number => (prev + 1) % cards.length);
            setIsLeaveActive(false);
            setLeavingCard(null);
            setIsCycling(false);
            isCyclingRef.current = false;
        }, ANIMATION_MS);
    }, [cards]);

    useEffect((): (() => void) => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval((): void => {
            dismissTopCard();
        }, AUTO_ADVANCE_MS);

        return (): void => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (rafRef.current !== null && typeof window !== "undefined") {
                window.cancelAnimationFrame(rafRef.current);
            }
            if (fallbackRafTimeoutRef.current) {
                clearTimeout(fallbackRafTimeoutRef.current);
            }
        };
    }, [dismissTopCard]);

    const getStackCard = (relativeOffset: number): Card => {
        const idx = (activeIndex + relativeOffset) % cards.length;
        return cards[idx];
    };

    const stackOffsets = isCycling ? [1, 2, 3, 4] : [0, 1, 2, 3];

    return (
        <div
            className="flex items-center w-full justify-center"
            style={{ paddingLeft: "15px", paddingRight: "15px" }}
        >
            <div
                className="relative w-full"
                style={{
                    maxWidth: "350px",
                    height: "400px",
                }}
            >
                {stackOffsets.map((offset: number, slotIndex: number): React.ReactElement => {
                    const card = getStackCard(offset);
                    const slot = slotStyles[slotIndex];

                    return (
                        <div
                            key={card.id}
                            className="absolute left-0 right-0 w-full rounded-xl shadow-xl overflow-hidden mx-auto transition-[transform,top,opacity] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] bg-muted border-[3px] dark:border-border border-card"
                            style={{
                                width: "100%",
                                height: "400px",
                                transform: `scale(${slot.scale})`,
                                opacity: slot.opacity,
                                zIndex: slot.zIndex,
                                top: `${slot.top}px`,
                                margin: "0 auto",
                            }}
                        >
                            <img src={card.image.src} height={400} width={400} className="absolute z-[-1] h-full w-full top-0 left-0 object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-5">
                                <h3 className="text-white text-xl font-semibold">{card.heading}</h3>
                            </div>
                        </div>
                    );
                })}

                {leavingCard && (
                    <div
                        key={`leaving-${leavingCard.id}`}
                        className="absolute left-0 right-0 w-full rounded-xl shadow-xl overflow-hidden mx-auto transition-all duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                        style={{
                            width: "100%",
                            height: "400px",
                            transform: isLeaveActive ? "translateY(135%) translateX(50px) rotate(20deg)" : "translateY(0) translateX(0px) rotate(0deg)",
                            opacity: isLeaveActive ? 0 : 1,
                            zIndex: 40,
                            top: "0px",
                            margin: "0 auto",
                            backgroundColor: "#1f2937",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                        }}
                    >
                        <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${leavingCard.image.src})` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                            <h3 className="text-white text-xl font-semibold">{leavingCard.heading}</h3>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SSOCardStack;
