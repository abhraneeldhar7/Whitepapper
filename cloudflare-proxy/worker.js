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
        // Preserve upstream redirect responses (302/303/etc.) so the client browser
        // executes OAuth navigation with its own cookie/session context.
        redirect: "manual",
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
      const responseHeaders = new Headers(response.headers);
      const exposedHeaders = new Set(
        String(responseHeaders.get("access-control-expose-headers") || "")
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      );
      exposedHeaders.add("mcp-session-id");
      exposedHeaders.add("www-authenticate");
      responseHeaders.set("access-control-expose-headers", Array.from(exposedHeaders).join(", "));
      responseHeaders.set("cache-control", responseHeaders.get("cache-control") || "no-store, no-cache");
      const proxiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
      if (shouldUseCache && cacheKey && response.ok) {
        ctx.waitUntil(cache.put(cacheKey, proxiedResponse.clone()));
      }
      return proxiedResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Worker error";
      return new Response(`Proxy error: ${message}`, { status: 502 });
    }
  }
}
