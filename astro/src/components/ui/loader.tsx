import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type LoaderProps = {
  size?: number;
  className?: string;
};

export function Loader({ size = 20, className }: LoaderProps) {
  return <LoaderCircle size={size} className={cn("animate-spin", className)} />;
}
