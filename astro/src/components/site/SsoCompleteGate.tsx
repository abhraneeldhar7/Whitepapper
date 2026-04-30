import { useEffect } from "react";
import { useAuth } from "@clerk/astro/react";

export default function SsoCompleteGate() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    const params = new URLSearchParams(window.location.search);
    const redirectTarget = params.get("redirect_url") || "/dashboard";

    if (isSignedIn) {
      window.location.replace(redirectTarget);
    } else {
      window.location.replace("/login");
    }
  }, [isLoaded, isSignedIn]);

  return null;
}
