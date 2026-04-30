import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/write(.*)",
  "/settings(.*)",
  "/mcp/connect(.*)"
]);

const isPublicAuthRoute = createRouteMatcher([
  "/login(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-complete(.*)"
]);

export const onRequest = clerkMiddleware(async (auth, context, next) => {
  const { userId, redirectToSignIn } = auth();
  const url = new URL(context.request.url);

  if (!userId && isProtectedRoute(context.request)) {
    return redirectToSignIn({ returnBackUrl: url.href });
  }

  if (userId && isPublicAuthRoute(context.request)) {
    const searchParams = url.searchParams;
    const redirectTarget = searchParams.get("redirect_url") || "/dashboard";
    return context.redirect(redirectTarget);
  }

  return next();
});