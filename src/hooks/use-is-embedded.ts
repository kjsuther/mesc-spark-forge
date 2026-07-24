import { useEffect, useState } from "react";

/**
 * True when the current page is rendered inside an iframe (e.g. the admin
 * poster view). Used to hide the top-level site chrome so attendees can't
 * accidentally navigate away from the Demo Client Tool.
 *
 * Returns false during SSR and on first client render to avoid hydration
 * mismatch; flips to true on mount if window.top !== window.self.
 */
export function useIsEmbedded(): boolean {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("embed") === "1") {
        setEmbedded(true);
        return;
      }
      if (window.self !== window.top) {
        setEmbedded(true);
      }
    } catch {
      // Cross-origin access denied → definitely embedded.
      setEmbedded(true);
    }
  }, []);
  return embedded;
}

