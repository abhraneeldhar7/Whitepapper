export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const target = env.CLOUD_RUN_URL;
    const newUrl = target + url.pathname + url.search;

    const cacheKey = new Request(newUrl, request);
    const cache = caches.default;

    // return from cache if exists
    let response = await cache.match(cacheKey);
    if (response) return response;

    // otherwise hit Cloud Run
    const newRequest = new Request(newUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });

    response = await fetch(newRequest);

    // cache it if FastAPI said s-maxage
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  }
}