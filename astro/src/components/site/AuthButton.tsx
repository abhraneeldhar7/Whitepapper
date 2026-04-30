import { useAuth } from "@clerk/astro/react";
import { Button } from "@/components/ui/button";

export default function AuthButton() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <Button disabled>
        <span className="opacity-50">...</span>
      </Button>
    );
  }

  if (isSignedIn) {
    return (
      <a href="/dashboard" data-astro-prefetch="viewport">
        <Button>Dashboard</Button>
      </a>
    );
  }

  return (
    <a href="/login" data-astro-prefetch="viewport">
      <Button>Login</Button>
    </a>
  );
}
