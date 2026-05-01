import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse h-[24px] w-full rounded-[5px] bg-foreground/15", className)}
      {...props}
    />
  )
}

export { Skeleton }
