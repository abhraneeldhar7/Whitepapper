import { cn } from "@/lib/utils"
import type { ComponentType, ReactNode } from "react"

export default function HeroFloatingIcon({
    className,
    Icon,
    children,
}: {
    className?: string
    Icon: ComponentType<{ className?: string, size?: number }>
    children?: ReactNode
}) {
    return (
        <div
            className={cn(
                "aspect-square rounded-[12px] shadow-sm flex items-center justify-center w-fit p-3 md:p-4 z-[-1]",
                className
            )}
        >
            <Icon className="size-6 md:size-9" />
            {children}
        </div>
    )
}