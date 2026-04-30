import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/astro/react";

export default function WelcomeGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const redirected = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (redirected.current) return;

    if (isSignedIn) {
      redirected.current = true;
      const params = new URLSearchParams(window.location.search);
      const redirectTarget = params.get("redirect_url") || "/dashboard";
      window.location.replace(redirectTarget);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (redirected.current) return;
      redirected.current = true;
      window.location.replace("/dashboard");
    }, 8000);

    return () => clearTimeout(timeout);
  }, []);

  return null;
}
