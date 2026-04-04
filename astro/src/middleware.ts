import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/write(.*)", "/settings(.*)"]);
const isLoginRoute = createRouteMatcher(["/login"]);
const isNoIndexRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/write(.*)",
  "/settings(.*)",
  "/login(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/unauthorized(.*)",
]);

export const onRequest = clerkMiddleware(async (auth, context, next) => {
  const { isAuthenticated } = auth();
  const noIndexValue = "noindex, nofollow, noarchive";

  if (!isAuthenticated && isProtectedRoute(context.request)) {
    const loginUrl = new URL("/login", context.request.url);
    loginUrl.searchParams.set("redirect_url", context.request.url);
    const redirectResponse = Response.redirect(loginUrl, 302);
    redirectResponse.headers.set("X-Robots-Tag", noIndexValue);
    return redirectResponse;
  }

  if (isAuthenticated && isLoginRoute(context.request)) {
    const url = new URL("/dashboard", context.request.url);
    const redirectResponse = Response.redirect(url, 302);
    redirectResponse.headers.set("X-Robots-Tag", noIndexValue);
    return redirectResponse;
  }

  const response = await next();

  if (isNoIndexRoute(context.request)) {
    response.headers.set("X-Robots-Tag", noIndexValue);
  }

  return response;
});
