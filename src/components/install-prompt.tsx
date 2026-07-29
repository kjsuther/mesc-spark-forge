import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "trail-install-prompt-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return (
    iosStandalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in window);
}

/**
 * Mobile-only banner explaining how to get rid of the browser URL bar and tabs:
 * install the game to the home screen so it launches with no browser chrome.
 * Android/Chrome gets a one-tap install button; iOS gets Share → Add to Home Screen.
 */
export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (!isTouchDevice() || isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Storage blocked — still show the banner.
    }
    setIos(isIos());
    setShow(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore storage failures.
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setShow(false);
    setDeferred(null);
  };

  return (
    <div className="mb-4 rounded-lg border-2 border-mn-blue bg-mn-blue/5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-mn-blue">
            📱 Hide the browser bars
          </p>
          <p className="mt-1 text-sm text-dark-gray/80">
            {deferred
              ? "Install the game to your home screen and it opens with no URL bar or tabs — full screen, like an app."
              : ios
                ? "Tap the Share button in Safari, then “Add to Home Screen.” Launching from that icon opens the game full screen with no URL bar or tabs."
                : "Use your browser menu → “Install app” or “Add to Home screen.” Launching from that icon opens the game full screen with no URL bar or tabs."}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install tip"
          className="shrink-0 rounded px-2 py-1 text-lg leading-none text-dark-gray/50 hover:text-dark-gray"
        >
          ×
        </button>
      </div>
      {deferred && (
        <button
          type="button"
          onClick={install}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-mn-blue px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110 transition"
        >
          Install the game
        </button>
      )}
    </div>
  );
}
