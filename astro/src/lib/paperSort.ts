import type { PaperDoc } from "@/lib/types";

function toTimestamp(value?: string | null): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortPapersLatestFirst(papers: PaperDoc[]): PaperDoc[] {
  return [...papers].sort((a, b) => {
    const byUpdatedAt = toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt);
    if (byUpdatedAt !== 0) {
      return byUpdatedAt;
    }
    return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
  });
}
