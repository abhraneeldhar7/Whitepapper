const MOBILE_USER_AGENT_REGEX =
  /Mobi|Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile|WPDesktop/i;

export function isMobileUserAgent(userAgent?: string | null): boolean {
  const value = String(userAgent || "").trim();
  if (!value) {
    return false;
  }
  return MOBILE_USER_AGENT_REGEX.test(value);
}

export function isDesktopUserAgent(userAgent?: string | null): boolean {
  return !isMobileUserAgent(userAgent);
}

