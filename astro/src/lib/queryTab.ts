export function readTabFromQuery<T extends string>(allowedTabs: readonly T[], fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const rawTab = new URLSearchParams(window.location.search).get("tab");
  if (rawTab && allowedTabs.includes(rawTab as T)) {
    return rawTab as T;
  }

  return fallback;
}

export function writeTabToQuery(tab: string): void {
  const params = new URLSearchParams(window.location.search);
  params.set("tab", tab);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.pushState({}, "", url);
}
