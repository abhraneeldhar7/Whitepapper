import type { PaperDoc, PaperMetadata } from "@/lib/entities";

export const ROOT_OG_IMAGE_PATH = "/assets/ogImages/root.png";

function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function isAppLogoImage(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.endsWith("/applogo.png") || normalized.endsWith("applogo.png");
}

export function resolvePaperSocialImage(
  paper: Pick<PaperDoc, "thumbnailUrl" | "metadata">,
  rootOgImage: string = ROOT_OG_IMAGE_PATH,
): string {
  const metadata = (paper.metadata || null) as PaperMetadata | null;
  const metadataOg = firstNonEmpty(metadata?.ogImage);
  const safeMetadataOg = metadataOg && !isAppLogoImage(metadataOg) ? metadataOg : "";
  return (
    firstNonEmpty(safeMetadataOg, paper.thumbnailUrl, rootOgImage) ||
    rootOgImage
  );
}
