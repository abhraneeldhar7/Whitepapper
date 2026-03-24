import { ArrowUpRight } from "lucide-react";

type WorkspaceCardProps = {
  title: string;
  description: string;
  meta: string;
  href: string;
  actionLabel: string;
};

export default function WorkspaceCard({
  title,
  description,
  meta,
  href,
  actionLabel,
}: WorkspaceCardProps) {
  return (
    <a
      href={href}
      className="group flex min-h-36 flex-col justify-between rounded-xl border border-border bg-muted p-4 transition hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div className="space-y-1">
        <h3 className="line-clamp-1 text-sm font-[400]">{title}</h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{meta}</span>
        <span className="inline-flex items-center gap-1 text-foreground">
          {actionLabel}
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>
    </a>
  );
}
