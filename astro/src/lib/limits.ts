export const MAX_PROJECTS_PER_USER = 50;
export const MAX_COLLECTIONS_PER_PROJECT = 10;
export const MAX_PAPERS_PER_USER = 500;

export const MAX_DESCRIPTION_LENGTH = 50000;
export const MAX_PAPER_BODY_LENGTH = 500000;
export const MAX_IMAGES_PER_PAPER = 20;

export const DEV_API_LIMIT_PER_MONTH = 10000;

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(([^)\s]+)[^)]*\)/gi;
const HTML_IMAGE_PATTERN = /<img[^>]+src=["']([^"']+)["']/gi;

export function countImagesInContent(content: string | null | undefined): number {
  const body = content || "";
  const markdownCount = [...body.matchAll(MARKDOWN_IMAGE_PATTERN)].length;
  const htmlCount = [...body.matchAll(HTML_IMAGE_PATTERN)].length;
  return markdownCount + htmlCount;
}
