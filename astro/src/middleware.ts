import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/write(.*)", "/settings(.*)"]);
const isLoginRoute = createRouteMatcher(["/sign-in", "/sign-up"]);

export const onRequest = clerkMiddleware((auth, context, next) => {
  const { isAuthenticated, redirectToSignIn } = auth();

  if (!isAuthenticated && isProtectedRoute(context.request)) {
    return redirectToSignIn({ returnBackUrl: context.request.url });
  }
  if (isAuthenticated && isLoginRoute(context.request)) {
    const url = new URL("/dashboard", context.request.url);
    return Response.redirect(url, 302);
  }

  return next();
});
