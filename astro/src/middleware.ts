import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";
import type { APIContext, MiddlewareNext } from "astro";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/write(.*)", "/settings(.*)", "/mcp/connect(.*)"]);
const isLoginRoute = createRouteMatcher(["/login"]);

function resolveSafeRedirectTarget(requestUrl: string): string {
  const currentUrl = new URL(requestUrl);
  const raw = currentUrl.searchParams.get("redirect_url");
  if (!raw) {
    return "/dashboard";
  }

  try {
    const parsed = new URL(raw, currentUrl.origin);
    if (parsed.origin !== currentUrl.origin) {
      return "/dashboard";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/dashboard";
  }
}

const clerkHandler = clerkMiddleware(async (auth, context, next) => {
  const { isAuthenticated, redirectToSignIn } = auth();

  if (!isAuthenticated && isProtectedRoute(context.request)) {
    return redirectToSignIn({ returnBackUrl: context.request.url });
  }

  if (isAuthenticated && isLoginRoute(context.request)) {
    const url = new URL(resolveSafeRedirectTarget(context.request.url), context.request.url);
    const redirectResponse = Response.redirect(url, 302);
    return redirectResponse;
  }

  const response = await next();

  return response;
});

export const onRequest = async (context: APIContext, next: MiddlewareNext) => {
  return clerkHandler(context, next);
};
