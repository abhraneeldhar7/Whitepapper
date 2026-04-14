export default {
  async fetch(request, env, ctx) {
    try {
      const target = (env.CLOUD_RUN_URL || "").trim();
      if (!target) {
        return new Response("Missing CLOUD_RUN_URL", { status: 500 });
      }
      const incomingUrl = new URL(request.url);
      const upstreamBase = target.endsWith("/") ? target.slice(0, -1) : target;
      const upstreamUrl = `${upstreamBase}${incomingUrl.pathname}${incomingUrl.search}`;

      // Skip cache for SSE and well-known paths
      const isSSE = incomingUrl.pathname.startsWith("/mcp");
      const isWellKnown = incomingUrl.pathname.startsWith("/.well-known");
      const shouldUseCache = request.method === "GET" && !isSSE && !isWellKnown;

      const cache = caches.default;
      const cacheKey = shouldUseCache ? new Request(upstreamUrl, request) : null;
      if (shouldUseCache && cacheKey) {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
      }
      const upstreamHeaders = new Headers(request.headers);
      upstreamHeaders.delete("host");
      const upstreamRequestInit = {
        method: request.method,
        headers: upstreamHeaders,
      };
      if (request.method !== "GET" && request.method !== "HEAD") {
        upstreamRequestInit.body = request.body;
      }

      // For SSE, disable buffering
      if (isSSE) {
        upstreamRequestInit.duplex = "half";
      }

      const upstreamRequest = new Request(upstreamUrl, upstreamRequestInit);
      const response = await fetch(upstreamRequest);
      if (shouldUseCache && cacheKey && response.ok) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Worker error";
      return new Response(`Proxy error: ${message}`, { status: 502 });
    }
  }
}