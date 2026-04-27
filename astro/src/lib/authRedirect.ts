const DEFAULT_REDIRECT_PATH = "/dashboard";

export function resolveSafeRedirectTarget(raw: string | null | undefined, origin: string): string {
  if (!raw) {
    return DEFAULT_REDIRECT_PATH;
  }

  try {
    const parsed = new URL(raw, origin);
    if (parsed.origin !== origin) {
      return DEFAULT_REDIRECT_PATH;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_REDIRECT_PATH;
  }
}

export function getDefaultRedirectPath(): string {
  return DEFAULT_REDIRECT_PATH;
}
