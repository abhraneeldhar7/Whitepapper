import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";
import type { APIContext, MiddlewareNext } from "astro";
import { resolveSafeRedirectTarget } from "@/lib/authRedirect";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/write(.*)", "/settings(.*)", "/mcp/connect(.*)"]);
const isLoginRoute = createRouteMatcher(["/login"]);

const clerkHandler = clerkMiddleware(async (auth, context, next) => {
  const { isAuthenticated, redirectToSignIn } = auth();

  if (!isAuthenticated && isProtectedRoute(context.request)) {
    return redirectToSignIn({ returnBackUrl: context.request.url });
  }

  if (isAuthenticated && isLoginRoute(context.request)) {
    const currentUrl = new URL(context.request.url);
    const url = new URL(
      resolveSafeRedirectTarget(currentUrl.searchParams.get("redirect_url"), currentUrl.origin),
      currentUrl.origin,
    );
    const redirectResponse = Response.redirect(url, 302);
    return redirectResponse;
  }

  const response = await next();

  return response;
});

export const onRequest = async (context: APIContext, next: MiddlewareNext) => {
  return clerkHandler(context, next);
};
