import { useEffect, useState } from "react";

/**
 * One source of truth for "what kind of device is this?".
 *
 * Width alone is a bad proxy: a landscape iPhone is 900+ CSS px wide and an
 * external-monitor browser window can be 700px. We therefore combine pointer
 * capability, touch points, UA hints, and viewport shape, and re-evaluate on
 * every resize / rotation / fullscreen change.
 */
export type DeviceProfile = {
  /** True when the primary input is a finger (phone / tablet). */
  touch: boolean;
  /** True when the device is a phone-sized touch device. */
  phone: boolean;
  tablet: boolean;
  desktop: boolean;
  portrait: boolean;
  /** Landscape phone with very little vertical room (needs compact layout). */
  shortLandscape: boolean;
  vw: number;
  vh: number;
  dpr: number;
};

const DEFAULT_PROFILE: DeviceProfile = {
  touch: false,
  phone: false,
  tablet: false,
  desktop: true,
  portrait: false,
  shortLandscape: false,
  vw: 960,
  vh: 540,
  dpr: 1,
};

function mq(query: string): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(query).matches
  );
}

/** Touch-capable device? Safe to call during render (SSR returns false). */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = mq("(pointer: coarse)") || mq("(any-pointer: coarse)");
  const hasTouch =
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) || "ontouchstart" in window;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  // iPadOS reports a Mac UA but always has touch points.
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua);
  const fineMouse = mq("(pointer: fine)") && !hasTouch;
  if (fineMouse) return false;
  return (coarse && hasTouch) || uaMobile || (hasTouch && !mq("(pointer: fine)"));
}

export function getDeviceProfile(): DeviceProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  const vv = window.visualViewport;
  const vw = Math.round(vv?.width || window.innerWidth || 960);
  const vh = Math.round(vv?.height || window.innerHeight || 540);
  const touch = isTouchDevice();
  const portrait = vh > vw;
  // Longest edge is the reliable size signal, independent of rotation.
  const longEdge = Math.max(vw, vh);
  const tablet = touch && longEdge >= 900;
  return {
    touch,
    phone: touch && !tablet,
    tablet,
    desktop: !touch,
    portrait,
    shortLandscape: touch && !portrait && vh < 430,
    vw,
    vh,
    dpr: window.devicePixelRatio || 1,
  };
}

function sameProfile(a: DeviceProfile, b: DeviceProfile): boolean {
  return (
    a.touch === b.touch &&
    a.phone === b.phone &&
    a.tablet === b.tablet &&
    a.portrait === b.portrait &&
    a.shortLandscape === b.shortLandscape &&
    a.vw === b.vw &&
    a.vh === b.vh &&
    a.dpr === b.dpr
  );
}

/**
 * Reactive device profile. Recomputed (coalesced into one frame) on resize,
 * rotation, fullscreen change, and visual-viewport movement, so layout,
 * controls, and instruction text can never disagree about the device.
 */
export function useDeviceProfile(): DeviceProfile {
  // Start from the SSR-safe default so hydration matches, then correct on mount.
  const [profile, setProfile] = useState<DeviceProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      const next = getDeviceProfile();
      setProfile((prev) => (sameProfile(prev, next) ? prev : next));
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    document.addEventListener("fullscreenchange", schedule);
    document.addEventListener("webkitfullscreenchange", schedule as EventListener);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      document.removeEventListener("fullscreenchange", schedule);
      document.removeEventListener("webkitfullscreenchange", schedule as EventListener);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, []);

  return profile;
}

// ---------------------------------------------------------------- prompts --
// Device-appropriate wording, used by both the React menus and the engine so
// no screen can drift out of sync with the controls the player actually has.

export const continuePrompt = (): string =>
  isTouchDevice() ? "Tap Anywhere to Continue" : "Press Enter, Space, or Click to Continue";

export const readyPrompt = (): string =>
  isTouchDevice() ? "Tap when you're READY" : "Press Enter, Space, or Click when you're READY";

export const jumpPrompt = (): string =>
  isTouchDevice() ? "Tap JUMP" : "Jump (Up Arrow or Space)";

export const restartPrompt = (): string =>
  isTouchDevice()
    ? "Tap the screen to enter your score\nand tell us what to improve"
    : "Press R or Enter to enter your score\nand tell us what to improve";
