import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api/client";

type WelcomeRedirectGateProps = {
  redirectUrl: string;
};

const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function WelcomeRedirectGate({ redirectUrl }: WelcomeRedirectGateProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const waitForProvisioning = async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (cancelled) {
          return;
        }

        try {
          await apiClient.get("/users/me");
          if (!cancelled) {
            window.location.replace(redirectUrl);
          }
          return;
        } catch {
          await sleep(RETRY_DELAY_MS);
        }
      }

      if (!cancelled) {
        setFailed(true);
      }
    };

    waitForProvisioning();

    return () => {
      cancelled = true;
    };
  }, [redirectUrl]);

  if (!failed) {
    return null;
  }

  return (
    <div className="mt-4 text-center text-sm opacity-70">
      Finishing account setup. Please wait a moment and try again.
    </div>
  );
}
