import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Leaderboard } from "./leaderboard";
import { ScoreEntryOverlay } from "./score-entry-overlay";
import { GameMusic, type MusicTheme } from "@/lib/game-music";
import type { GameFlags, WinResult } from "./game-scenes";
import trailMapBg from "@/assets/game/trail-map-bg-v2.png.asset.json";

type Props = {
  mode: "before" | "after";
  onWin?: (result: WinResult) => void;
  onLose?: (result: WinResult) => void;
  /** Poster/projection mode: fill the parent, no hint text, no fullscreen button. */
  presentation?: boolean;
};

const EMPTY_FLAGS: GameFlags = {
  extra_lives: false,
  navigator_helper: false,
  chat_invincible: false,
  email_umbrella: false,
  resume_checkpoint: false,
};

type TouchInput = { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean };

type LaunchMode = "standard" | "fullscreen";
type MenuScreen = "title" | "explainer" | "trailmap" | "controls" | "scores";

const isCoarsePointer = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

function useOrientation() {
  const [portrait, setPortrait] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerHeight > window.innerWidth;
  });
  useEffect(() => {
    const update = () => setPortrait(window.innerHeight > window.innerWidth);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return { portrait };
}

/** The real, currently-visible viewport. `visualViewport` is the only value
 *  that is accurate on iOS Safari while the URL bar animates in and out, so
 *  it wins over `innerWidth/innerHeight` whenever it exists. */
function useViewportSize() {
  const readSize = () => {
    const vv = window.visualViewport;
    const widths = [vv?.width, window.innerWidth, document.documentElement.clientWidth].filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0,
    );
    const heights = [vv?.height, window.innerHeight, document.documentElement.clientHeight].filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0,
    );
    return {
      vw: Math.round(Math.min(...widths)),
      vh: Math.round(Math.min(...heights)),
    };
  };

  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return { vw: 960, vh: 540 };
    return readSize();
  });
  useEffect(() => {
    let raf = 0;
    const read = () => {
      const { vw, vh } = readSize();
      setSize((prev) => (prev.vw === vw && prev.vh === vh ? prev : { vw, vh }));
    };
    // Coalesce bursts (rotation fires resize several times) into one frame.
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
  return size;
}


export function GameCanvas({ mode, onWin, onLose, presentation = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fauxFullscreen, setFauxFullscreen] = useState(false);
  const [launchMode, setLaunchMode] = useState<LaunchMode | null>(null);
  const [menuScreen, setMenuScreen] = useState<MenuScreen>("title");
  const [showHint, setShowHint] = useState(true);
  const [loading, setLoading] = useState(false);
  const [endResult, setEndResult] = useState<WinResult | null>(null);
  const { portrait } = useOrientation();
  const { vw, vh } = useViewportSize();
  const [isTouch] = useState(() => isCoarsePointer());
  /** The player asked for fullscreen; keep them there across browser hiccups. */
  const fsIntentRef = useRef(false);

  const music = useMemo(() => new GameMusic(), []);
  const [musicOn, setMusicOn] = useState(false);
  useEffect(() => () => { music.stop(); }, [music]);
  const toggleMusic = useCallback(() => {
    setMusicOn(music.toggle());
  }, [music]);
  // The scene drives the mood: boss battle in Zone 7, fanfare on the finale.
  const handleMusicTheme = useCallback(
    (theme: MusicTheme) => { music.setTheme(theme); },
    [music],
  );
  // Switching between the frozen original build and the current build is a
  // full restart of the engine.
  const key = mode;

  // Start the game only after the user picks a launch mode
  useEffect(() => {
    if (!launchMode) return;
    const w = window as unknown as { __gameInput?: TouchInput };
    w.__gameInput = { left: false, right: false, jumpReq: false, resetReq: false };

    // Start a fresh run on the default theme.
    music.reset();

    let cancelled = false;
    let destroy: (() => void) | null = null;
    setEndResult(null);
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // "before" runs the frozen original build; "after" runs the current
        // build that carries every implemented piece of player feedback.
        const { startGame } =
          mode === "before"
            ? await import("./original/game-scenes")
            : await import("./game-scenes");
        if (cancelled) return;
        const flags = EMPTY_FLAGS;
        destroy = await startGame({
          canvas, flags, mode,
          onWin: (r) => { setEndResult(r); onWin?.(r); },
          onLose: (r) => { setEndResult(r); onLose?.(r); },
          onMusicTheme: handleMusicTheme,
        });
        if (!cancelled) setLoading(false);
      } catch (err) {
        console.error("[game] failed to start", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to start game");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (destroy) destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, launchMode]);

  // Back at the menus, drop the music mood back to the default theme.
  useEffect(() => {
    if (!launchMode) music.setTheme("adventure");
  }, [launchMode, music]);


  // Auto-hide the mobile hint after 6s
  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(t);
  }, [showHint]);

  // Native fullscreen tracking. If the browser drops out of fullscreen on its
  // own (rotation on some Android builds, an OS gesture, a tab switch) but the
  // player never asked to leave, fall back to the in-page fullscreen overlay
  // instead of dumping them back into the small page layout.
  useEffect(() => {
    const onFsChange = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      setIsFullscreen(!!fsElement);
      if (!fsElement && fsIntentRef.current) setFauxFullscreen(true);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange as EventListener);
    };
  }, []);

  // Lock the page behind the game while any fullscreen mode is active so the
  // document can never scroll a few pixels and reveal browser chrome.
  useEffect(() => {
    if (!fauxFullscreen) return;
    const body = document.body.style;
    const html = document.documentElement.style;
    const prev = { overflow: body.overflow, htmlOverflow: html.overflow, overscroll: body.overscrollBehavior };
    body.overflow = "hidden";
    html.overflow = "hidden";
    body.overscrollBehavior = "none";
    return () => {
      body.overflow = prev.overflow;
      html.overflow = prev.htmlOverflow;
      body.overscrollBehavior = prev.overscroll;
    };
  }, [fauxFullscreen]);

  // Keep the engine's backing buffer in step with the CSS box after every
  // layout-changing event. Kaplay watches the canvas with a ResizeObserver, so
  // all we have to do is make sure a real layout pass happens on the frames
  // right after a rotation / fullscreen transition — iOS Safari reports stale
  // sizes for a beat or two after both.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const timers: number[] = [];
    const nudge = () => {
      // Reading a layout property forces the pending reflow to resolve.
      void canvas.offsetWidth;
      void canvas.offsetHeight;
    };
    raf = requestAnimationFrame(nudge);
    for (const delay of [120, 400, 900]) {
      timers.push(window.setTimeout(nudge, delay));
    }
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => clearTimeout(t));
    };
  }, [vw, vh, isFullscreen, fauxFullscreen, launchMode]);


  // Block context menu and pull-to-refresh on the game surface
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const block = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", block);
    el.addEventListener("gesturestart", block as EventListener);
    return () => {
      el.removeEventListener("contextmenu", block);
      el.removeEventListener("gesturestart", block as EventListener);
    };
  }, []);

  const focusCanvas = () => canvasRef.current?.focus();

  const nativeFullscreenSupported = useCallback(() => {
    const el = containerRef.current;
    if (!el) return false;
    const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    return !!(anyEl.requestFullscreen || anyEl.webkitRequestFullscreen);
  }, []);

  const requestNativeFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return false;
    const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    try {
      if (anyEl.requestFullscreen) {
        await anyEl.requestFullscreen();
        return true;
      }
      if (anyEl.webkitRequestFullscreen) {
        await anyEl.webkitRequestFullscreen();
        return true;
      }
    } catch (err) {
      console.warn("[game] native fullscreen failed", err);
    }
    return false;
  }, []);

  const exitNativeFullscreen = useCallback(async () => {
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
    try {
      if (doc.exitFullscreen) await doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    } catch (err) {
      console.warn("[game] exit fullscreen failed", err);
    }
  }, []);

  const nudgeMobileBrowserChrome = useCallback(() => {
    if (!isCoarsePointer()) return;
    // Browsers only hide their top/bottom controls after a user gesture. This
    // small scroll nudge helps Chrome/Samsung Internet tuck the chrome away,
    // while iOS safely stays on the faux fullscreen overlay path.
    const visibleHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - visibleHeight);
    const targetY = Math.min(1, maxScroll);
    window.scrollTo(0, targetY);
    window.setTimeout(() => window.scrollTo(0, targetY), 120);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      fsIntentRef.current = false;
      await exitNativeFullscreen();
      return;
    }
    if (fauxFullscreen) {
      fsIntentRef.current = false;
      setFauxFullscreen(false);
      return;
    }
    fsIntentRef.current = true;
    nudgeMobileBrowserChrome();
    // On touch devices the in-page overlay is the better fullscreen: iOS
    // Safari refuses element fullscreen entirely, and on Android the native
    // one is dropped by rotation. The overlay is stable everywhere and the
    // engine resizes into it normally.
    if (isCoarsePointer()) {
      setFauxFullscreen(true);
      // Android Chrome supports it too — take the extra chrome-free pixels
      // when they're on offer, and keep the overlay underneath as a fallback.
      if (nativeFullscreenSupported()) void requestNativeFullscreen();
      return;
    }
    if (!nativeFullscreenSupported()) {
      setFauxFullscreen(true);
      return;
    }
    const ok = await requestNativeFullscreen();
    if (!ok) setFauxFullscreen(true);
  }, [
    isFullscreen,
    fauxFullscreen,
    requestNativeFullscreen,
    exitNativeFullscreen,
    nativeFullscreenSupported,
    nudgeMobileBrowserChrome,
  ]);

  // User picked a mode. On mobile / touch devices we go straight to the
  // in-page fullscreen overlay so the launch is instantaneous and the canvas
  // gets the whole viewport without waiting on a fullscreen promise.
  const pickMode = useCallback(
    (m: LaunchMode) => {
      const coarse = isCoarsePointer();
      if (m === "fullscreen" || coarse) {
        fsIntentRef.current = true;
        nudgeMobileBrowserChrome();
        if (coarse) {
          setFauxFullscreen(true);
          if (nativeFullscreenSupported()) void requestNativeFullscreen();
        } else if (nativeFullscreenSupported()) {
          // Fire-and-forget; do not await so setLaunchMode is synchronous.
          void requestNativeFullscreen().then((ok) => {
            if (!ok) setFauxFullscreen(true);
          });
        } else {
          setFauxFullscreen(true);
        }
      }
      setLaunchMode(m);
    },
    [requestNativeFullscreen, nativeFullscreenSupported, nudgeMobileBrowserChrome],

  );

  // Touch devices: the very first tap anywhere in the game (menu buttons or
  // the "tap anywhere" layer) takes over the whole screen, so the title,
  // story, trail map and controls screens are already fullscreen. Runs once —
  // if the player then exits fullscreen manually, we leave them alone.
  const autoFsDoneRef = useRef(false);
  const enterFullscreenOnFirstTap = useCallback(() => {
    if (autoFsDoneRef.current) return;
    if (!isCoarsePointer()) return;
    autoFsDoneRef.current = true;

    fsIntentRef.current = true;
    nudgeMobileBrowserChrome();
    setFauxFullscreen(true);
    // Native fullscreen also hides the browser chrome where it's allowed.
    if (nativeFullscreenSupported()) void requestNativeFullscreen();
  }, [nativeFullscreenSupported, nudgeMobileBrowserChrome, requestNativeFullscreen]);



  // Every paused menu screen advances the same way: Enter, Space, mouse click,
  // or a tap anywhere on touch devices.
  const advanceMenu = useCallback(() => {
    setMenuScreen((screen) => {
      if (screen === "title") {
        music.start();
        setMusicOn(true);
        return "explainer";
      }
      if (screen === "explainer") return "trailmap";
      if (screen === "trailmap") return "controls";
      if (screen === "controls") {
        pickMode("standard");
        return screen;
      }
      // High scores: continue means "get going".
      return "explainer";
    });
  }, [pickMode]);

  useEffect(() => {
    if (launchMode || error) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      // Let the focused button handle its own activation.
      if ((e.target as HTMLElement | null)?.closest?.("button, input, textarea")) return;
      e.preventDefault();
      advanceMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [launchMode, error, advanceMenu]);


  function setBtn(k: "left" | "right", v: boolean) {
    const w = window as unknown as { __gameInput?: TouchInput };
    if (w.__gameInput) w.__gameInput[k] = v;
    if (v) setShowHint(false);
  }
  function jump() {
    const w = window as unknown as { __gameInput?: TouchInput };
    if (w.__gameInput) w.__gameInput.jumpReq = true;
    setShowHint(false);
  }
  function reset() {
    const w = window as unknown as { __gameInput?: TouchInput };
    if (w.__gameInput) w.__gameInput.resetReq = true;
  }

  const overlayFs = isFullscreen || fauxFullscreen;

  // Exact pixel sizing beats 100vh/100dvh on mobile: `visualViewport` is the
  // only number that matches what the player can actually see while iOS
  // Safari's URL bar is mid-animation.
  const fsWidth = overlayFs ? `${vw}px` : undefined;
  const fsHeight = overlayFs ? `${vh}px` : undefined;

  // Menus, pause cards, and instruction screens are plain HTML, so they scale
  // independently of the canvas. Anchor them to the same 960x540 design box
  // the game uses: short landscape phones shrink slightly (nothing clips),
  // large tablets and desktops scale up (nothing is squint-small).
  const uiScale = overlayFs
    ? Math.max(
        isTouch ? 0.56 : 0.82,
        Math.min(1.85, Math.min(vw / 960, vh / 540) * (isTouch ? 1.06 : 1.12)),
      )
    : 1;
  const menuSafePadding = overlayFs && isTouch ? 4 : 8;


  const containerStyle: React.CSSProperties = overlayFs
    ? {
        position: fauxFullscreen ? "fixed" : "relative",
        inset: fauxFullscreen ? 0 : undefined,
        width: fsWidth,
        height: fsHeight,
        maxWidth: "100%",
        margin: 0,
        padding: 0,
        // Black behind the canvas so any residual letterbox reads as a bezel.
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        overscrollBehavior: "none",
        overflow: "hidden",
        zIndex: fauxFullscreen ? 9999 : undefined,
      }
    : {
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        overscrollBehavior: "contain",
        ...(presentation
          ? { width: "100%", height: "100%", display: "flex", flexDirection: "column" as const }
          : {}),
      };

  const showRotatePrompt = isTouch && portrait;


  return (
    <div ref={containerRef} className="relative w-full" style={containerStyle}>
      {/* Rotate-to-landscape overlay for touch devices held in portrait.
          Shown BEFORE launch too, so mobile users are never stuck on a
          squished title screen with no visible action. */}
      {showRotatePrompt && (
        <div
          className="fixed inset-0 z-[10000] grid place-items-center bg-mn-blue p-6 text-center text-cream"
          style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}
        >
          <div className="max-w-xs">
            <div
              className="mx-auto mb-6 flex h-24 w-16 items-center justify-center rounded-lg border-4 border-cream text-3xl"
              style={{ animation: "rotate-hint 2s ease-in-out infinite" }}
            >
              ↻
            </div>
            <p className="mb-2 text-[10px] tracking-widest text-accent-gold">
              TURN YOUR PHONE
            </p>
            <p className="text-[8px] leading-relaxed tracking-wider text-cream/90">
              Blazing the Trail is a landscape adventure. Rotate sideways to play.
            </p>
            {launchMode && (
              <button
                type="button"
                onPointerUp={(e) => {
                  e.preventDefault();
                  setLaunchMode(null);
                  setFauxFullscreen(false);
                  setMenuScreen("title");
                }}
                className="mt-6 rounded border-2 border-accent-gold bg-accent-orange px-4 py-2 text-[10px] font-black uppercase tracking-widest text-cream"
                style={{ touchAction: "manipulation" }}
              >
                ✕ Exit
              </button>
            )}
          </div>
          <style>{`@keyframes rotate-hint { 0%,45% { transform: rotate(0deg); } 55%,100% { transform: rotate(-90deg); } }`}</style>
        </div>
      )}

      {launchMode && overlayFs && (
        <button
          type="button"
          aria-label="Exit fullscreen"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFullscreen();
          }}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute z-40 rounded bg-mn-blue/80 px-3 py-2 text-xs font-black uppercase tracking-widest text-cream shadow-lg touch-none"
          style={{
            touchAction: "none",
            // Clear of notches, Dynamic Island, and rounded corners.
            top: "calc(env(safe-area-inset-top, 0px) + 8px)",
            right: "calc(env(safe-area-inset-right, 0px) + 8px)",
            minHeight: 40,
          }}
        >
          ✕ Exit
        </button>
      )}


      <div
        className={
          overlayFs
            ? "relative overflow-hidden bg-black"
            : presentation
              ? "relative w-full flex-1 min-h-0 overflow-hidden bg-mn-blue"
              : "relative w-full overflow-hidden rounded-lg bg-mn-blue ring-2 ring-mn-blue/60 shadow-lg"
        }
        style={
          overlayFs
            ? {
                // Edge-to-edge: the engine's logical viewport already matches
                // the device aspect, so there is nothing left to letterbox.
                width: fsWidth,
                height: fsHeight,
                margin: 0,
                padding: 0,
              }
            : presentation
              ? { width: "100%", height: "100%" }
              : undefined
        }
      >
        <canvas
          ref={canvasRef}
          onPointerDown={focusCanvas}
          onContextMenu={(e) => e.preventDefault()}
          className="block w-full h-full touch-none select-none"
          style={{
            // NOTE: the engine rewrites this element's cssText on boot
            // (width/height 100% + pixelated), so the wrapper above is the
            // real source of truth for size. Only the pre-boot placeholder
            // shape is declared here.
            ...(presentation || overlayFs ? {} : { aspectRatio: "16 / 9" }),
            width: "100%",
            height: "100%",
            imageRendering: "pixelated",
            touchAction: "none",
            display: "block",
          }}
          tabIndex={0}
          aria-label="Blazing the Trail to Coverage game"
        />



        {/* In-window SNES name entry the moment a run ends */}
        {endResult && !presentation && launchMode && (
          <ScoreEntryOverlay result={endResult} onClose={() => setEndResult(null)} />
        )}

        {/* SNES-style title / launch / high-score screen */}
        {!launchMode && !error && (
          <div
            className="absolute inset-0 z-30 grid place-items-center overflow-hidden bg-mn-blue text-cream"
            style={{
              padding: [
                `calc(env(safe-area-inset-top, 0px) + ${menuSafePadding}px)`,
                `calc(env(safe-area-inset-right, 0px) + ${menuSafePadding + 4}px)`,
                `calc(env(safe-area-inset-bottom, 0px) + ${menuSafePadding}px)`,
                `calc(env(safe-area-inset-left, 0px) + ${menuSafePadding + 4}px)`,
              ].join(" "),
              touchAction: "manipulation",
            }}
            onClick={(e) => {
              // Tap/click anywhere continues — except on the menu buttons
              // themselves, which already have their own action.
              if ((e.target as HTMLElement).closest("button")) return;
              enterFullscreenOnFirstTap();
              advanceMenu();
            }}

          >
            {/* One scale factor for every menu card: keeps text legible on
                big screens and stops short landscape phones from clipping. */}
            <div
              className="grid h-full w-full place-items-center"
              style={{ transform: `scale(${uiScale})`, transformOrigin: "center" }}

            >


            {menuScreen === "title" && (
              <div className="w-full max-w-lg text-center">
                <div
                  className="relative mx-auto mb-6 border-[6px] border-cream bg-mn-blue px-5 py-8"
                  style={{
                    imageRendering: "pixelated",
                    boxShadow:
                      "0 0 0 6px var(--color-mn-blue), 0 0 0 12px var(--color-accent-gold), 0 0 0 18px var(--color-mn-blue), 0 0 0 22px var(--color-accent-orange)",
                    fontFamily: '"Press Start 2P", ui-monospace, monospace',
                  }}
                >
                  <p className="mb-3 text-[8px] leading-relaxed tracking-widest text-accent-gold sm:text-[10px]">
                    ★ MINNESOTA HEALTH COVERAGE QUEST ★
                  </p>
                  <h2
                    className="text-[18px] leading-[1.4] text-cream sm:text-[28px]"
                    style={{
                      textShadow:
                        "3px 3px 0 var(--color-accent-orange), 6px 6px 0 rgba(0,0,0,0.4)",
                    }}
                  >
                    BLAZING
                    <br />
                    THE TRAIL
                    <br />
                    TO COVERAGE
                  </h2>
                  <p className="mt-5 animate-pulse text-[8px] tracking-widest text-cream sm:text-[10px]">
                    - PRESS START -
                  </p>
                </div>
                <div
                  className="mx-auto flex max-w-xs flex-col gap-3"
                  style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}
                >
                  <MenuButton onClick={() => { enterFullscreenOnFirstTap(); music.start(); setMusicOn(true); setMenuScreen("explainer"); }}>▶ Start Game</MenuButton>
                  <MenuButton onClick={() => { enterFullscreenOnFirstTap(); setMenuScreen("scores"); }}>★ High Scores</MenuButton>
                  {/* Full screen is a first-class title-screen option, not a
                      hidden control that only appears mid-run. */}
                  <MenuButton onClick={() => { autoFsDoneRef.current = true; void toggleFullscreen(); }}>
                    {isFullscreen || fauxFullscreen ? "⤡ Exit Full Screen" : "⛶ Full Screen"}
                  </MenuButton>


                </div>
              </div>
            )}

            {menuScreen === "explainer" && (
              <div className="w-full max-w-2xl text-center" style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}>
                <div
                  className="mx-auto mb-5 border-[6px] border-cream bg-mn-blue px-5 py-6 text-left"
                  style={{
                    imageRendering: "pixelated",
                    boxShadow:
                      "0 0 0 6px var(--color-mn-blue), 0 0 0 12px var(--color-accent-gold), 0 0 0 18px var(--color-mn-blue)",
                  }}
                >
                  <p className="mb-3 text-center text-[9px] tracking-widest text-accent-gold sm:text-[11px]">
                    ★ THE JOURNEY ★
                  </p>
                  <p className="text-[9px] leading-[1.9] text-cream sm:text-[11px]">
                    Applying for health coverage is a LONG road. Without the
                    right tools it can feel impossible &mdash; forms pile up,
                    letters get lost, deadlines slip, and many people GIVE UP
                    before the finish line.
                  </p>
                  <p className="mt-4 text-[9px] leading-[1.9] text-cream sm:text-[11px]">
                    Go as far as you can down the trail. When your run ends,
                    tell us what would have made the journey easier &mdash; the
                    team builds that feedback into the next version.
                  </p>
                </div>
                <div className="mx-auto flex max-w-xs flex-col gap-3">
                  <MenuButton onClick={() => setMenuScreen("trailmap")}>▶ Continue</MenuButton>
                  <MenuButton onClick={() => setMenuScreen("title")}>Back</MenuButton>
                </div>

              </div>
            )}

            {menuScreen === "trailmap" && (
              <TrailMap onContinue={() => setMenuScreen("controls")} onBack={() => setMenuScreen("explainer")} />
            )}

            {menuScreen === "controls" && (
              <ControlsScreen
                onContinue={() => pickMode("standard")}
                onBack={() => setMenuScreen("trailmap")}
              />
            )}

            {menuScreen === "scores" && (
              <div className="grid h-full w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
                <header className="text-center">
                  <p className="text-xs font-black uppercase tracking-widest text-accent-gold">
                    Live Scoreboard
                  </p>
                  <h3 className="font-display text-2xl uppercase text-cream sm:text-4xl">
                    High Scores
                  </h3>
                </header>
                <div className="min-h-0 overflow-auto rounded border-2 border-accent-gold bg-mn-blue/80">
                  <Leaderboard variant="poster" />
                </div>
                <div className="mx-auto flex w-full max-w-sm gap-3">
                  <MenuButton onClick={() => setMenuScreen("title")}>Back</MenuButton>
                  <MenuButton onClick={() => setMenuScreen("explainer")}>Start</MenuButton>
                </div>
              </div>
            )}
            </div>
          </div>
        )}


        {/* Music toggle (visible whenever a game is running) */}
        {launchMode && (
          <button
            type="button"
            onClick={toggleMusic}
            aria-label={musicOn ? "Mute music" : "Play music"}
            className="absolute top-2 right-14 z-40 h-9 w-9 rounded-md border-2 border-cream bg-mn-blue/80 text-cream text-lg font-black backdrop-blur-sm"
            style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}
          >
            {musicOn ? "🔊" : "🔇"}
          </button>
        )}

        {/* Loading overlay between Start tap and first frame */}
        {launchMode && loading && !error && (
          <div
            className="absolute inset-0 z-30 grid place-items-center bg-mn-blue text-cream"
            style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}
          >
            <div className="text-center">
              <p className="mb-3 animate-pulse text-[10px] tracking-widest text-accent-gold sm:text-xs">
                LOADING…
              </p>
              <p className="text-[8px] tracking-widest text-cream/70 sm:text-[10px]">
                Preparing the trail
              </p>
            </div>
          </div>
        )}

        {/* Fullscreen toggle overlay button (only while game is running, non-fs) */}
        {launchMode && !overlayFs && !presentation && (
          <button
            type="button"
            aria-label="Enter fullscreen"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFullscreen();
            }}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute right-2 top-2 z-20 rounded bg-mn-blue/75 px-2 py-1 text-xs font-bold text-cream hover:bg-mn-blue touch-none"
            style={{ touchAction: "none" }}
          >
            ⛶ Full
          </button>
        )}

        {error && (
          <div className="absolute inset-0 grid place-items-center bg-mn-blue/90 p-6 text-center text-cream">
            <div>
              <p className="font-bold mb-2">Game failed to load</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* Overlay touch controls — sit ON TOP of the canvas in fullscreen so
            the game fills the whole viewport. Only shown on touch devices. */}
        {launchMode && overlayFs && isTouch && (
          <>
            {/* D-pad, bottom-left */}
            <div
              className="pointer-events-none absolute z-30 flex gap-1"
              style={{
                left: "calc(env(safe-area-inset-left, 0px) + 12px)",
                bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
              }}
            >
              <PadButton label="LEFT" aria="Move left" size={72}
                onDown={() => setBtn("left", true)} onUp={() => setBtn("left", false)}>◀</PadButton>
              <PadButton label="RIGHT" aria="Move right" size={72}
                onDown={() => setBtn("right", true)} onUp={() => setBtn("right", false)}>▶</PadButton>
            </div>
            {/* Action cluster, bottom-right */}
            <div
              className="pointer-events-none absolute z-30 flex items-end gap-2"
              style={{
                right: "calc(env(safe-area-inset-right, 0px) + 12px)",
                bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
              }}
            >
              <PadButton label="RESET" aria="Restart" size={52} dim onDown={reset}>⟳</PadButton>
              <PadButton label="JUMP" aria="Jump" size={92} accent onDown={jump}>JUMP</PadButton>
            </div>
          </>
        )}
      </div>

      {/* Inline touch controls (non-fullscreen mobile) */}
      {launchMode && !overlayFs && !presentation && (
        <>
          {showHint && (
            <p className="mt-2 text-center text-[11px] font-semibold text-mn-blue md:hidden">
              Hold ◀ ▶ to move · JUMP to hop · ⟳ to restart
            </p>
          )}
          <div className="mt-3 flex items-end justify-between gap-2 md:hidden select-none">
            <div className="flex gap-1">
              <PadButton label="LEFT" aria="Move left" size={60}
                onDown={() => setBtn("left", true)} onUp={() => setBtn("left", false)}>◀</PadButton>
              <PadButton label="RIGHT" aria="Move right" size={60}
                onDown={() => setBtn("right", true)} onUp={() => setBtn("right", false)}>▶</PadButton>
            </div>
            <div className="flex items-end gap-2">
              <PadButton label="RESET" aria="Restart" size={48} dim onDown={reset}>⟳</PadButton>
              <PadButton label="JUMP" aria="Jump" size={76} accent onDown={jump}>JUMP</PadButton>
            </div>
          </div>
        </>
      )}

      {launchMode && !overlayFs && !presentation && (
        <p className="mt-2 text-xs text-dark-gray/60 text-center hidden md:block">
          ← → to move · Space / ↑ to jump · R to reset · ⛶ for fullscreen
        </p>
      )}
    </div>
  );
}


function MenuButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const firedRef = useRef(false);
  const fire = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (firedRef.current) return;
    firedRef.current = true;
    // Reset shortly so re-mounts / re-renders don't lock the button.
    setTimeout(() => {
      firedRef.current = false;
    }, 400);
    onClick();
  };
  return (
    <button
      type="button"
      // Use pointerup so touch and mouse both fire immediately; iOS Safari
      // sometimes drops synthetic click events under containers with
      // touch-action:none / user-select:none.
      onPointerUp={fire}
      onClick={fire}
      onContextMenu={(e) => e.preventDefault()}
      className="flex-1 touch-none select-none border-2 border-accent-gold bg-accent-orange px-4 py-3 text-sm font-black uppercase tracking-widest text-cream shadow-[4px_4px_0_var(--color-accent-gold)] active:translate-x-1 active:translate-y-1 active:shadow-none"
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
    >
      {children}
    </button>
  );
}


function PadButton({
  children,
  onDown,
  onUp,
  aria,
  label,
  size = 72,
  accent,
  dim,
}: {
  children: React.ReactNode;
  onDown: () => void;
  onUp?: () => void;
  aria: string;
  label: string;
  size?: number;
  accent?: boolean;
  dim?: boolean;
}) {
  const bg = accent
    ? "rgba(214, 90, 49, 0.82)" // orange
    : dim
      ? "rgba(30, 41, 82, 0.55)"
      : "rgba(30, 41, 82, 0.72)";
  const border = accent ? "var(--color-accent-gold)" : "var(--color-cream)";
  return (
    <button
      type="button"
      aria-label={aria}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
        } catch {
          /* noop */
        }
        onDown();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onUp?.();
      }}
      onPointerLeave={() => onUp?.()}
      onPointerCancel={() => onUp?.()}
      onContextMenu={(e) => e.preventDefault()}
      className="pointer-events-auto relative touch-none select-none font-black text-cream active:translate-y-[2px]"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        background: bg,
        border: `3px solid ${border}`,
        boxShadow:
          "inset 0 -4px 0 rgba(0,0,0,0.35), inset 0 3px 0 rgba(255,255,255,0.22), 0 3px 0 rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        fontSize: size >= 88 ? 18 : size >= 68 ? 26 : 20,
        fontFamily: '"Press Start 2P", ui-monospace, monospace',
        letterSpacing: 1,
        touchAction: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: 5,
          fontSize: 7,
          letterSpacing: 1,
          color: "rgba(245, 232, 199, 0.85)",
          fontFamily: '"Press Start 2P", ui-monospace, monospace',
        }}
      >
        {label}
      </span>
      <span style={{ display: "inline-block", lineHeight: 1 }}>{children}</span>
    </button>
  );
}

// SNES-style top-down trail map. The overlay traces the trail painted on the
// map artwork: waypoints below are measured marker centers of the printed
// 1-8 stops in the image's own 800x400 coordinate space.
const TRAIL_STOPS: { x: number; y: number; label: string }[] = [
  { x: 92, y: 275, label: "1. Find the Trail" },
  { x: 163, y: 192, label: "2. Create Account" },
  { x: 261, y: 213, label: "3. River of Paperwork" },
  { x: 383, y: 138, label: "4. Gather Documents" },
  { x: 333, y: 268, label: "5. Answer the Mail" },
  { x: 570, y: 299, label: "6. Await a Decision" },
  { x: 638, y: 193, label: "7. Choose a Plan" },
  { x: 726, y: 193, label: "8. Coverage Begins!" },
];

// Cubic beziers hand-tuned to hug the painted dashed trail between stops.
const TRAIL_PATH_D = [
  "M 92 275",
  "C 104 240, 128 208, 163 192",
  "C 196 178, 232 190, 261 213",
  "C 300 208, 344 172, 383 138",
  "C 374 178, 366 240, 333 268",
  "C 392 322, 486 334, 570 299",
  "C 604 288, 626 240, 638 193",
  "C 664 182, 700 182, 726 193",
].join(" ");

/** Pre-run "how to play" briefing — shown once after the journey map so the
 *  player knows the controls on whichever device they're on. */
function ControlsScreen({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(
      typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches,
    );
  }, []);

  const desktop: Array<[string, string]> = [
    ["← →", "Move"],
    ["Space / ↑", "Jump"],
    ["R", "Restart run"],
    ["Esc", "Pause"],
  ];
  const mobile: Array<[string, string]> = [
    ["◀ ▶", "Move"],
    ["⤒", "Jump"],
    ["Tap", "Continue screens"],
    ["⛶", "Full screen"],
  ];

  const Column = ({
    heading,
    rows,
    active,
  }: {
    heading: string;
    rows: Array<[string, string]>;
    active: boolean;
  }) => (
    <div
      className="flex-1 border-4 px-3 py-3"
      style={{
        borderColor: active ? "var(--color-accent-gold)" : "rgba(255,255,255,0.35)",
        background: active ? "rgba(255,220,90,0.12)" : "rgba(0,0,0,0.25)",
      }}
    >
      <p
        className="mb-3 text-center text-[8px] tracking-widest sm:text-[10px]"
        style={{ color: active ? "var(--color-accent-gold)" : "var(--color-cream)" }}
      >
        {heading}
        {active ? " ★" : ""}
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map(([key, action]) => (
          <li key={action} className="flex items-center justify-between gap-2">
            <span className="text-[8px] text-accent-gold sm:text-[10px]">{key}</span>
            <span className="text-[7px] text-cream sm:text-[9px]">{action}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div
      className="w-full max-w-2xl text-center"
      style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}
    >
      <div
        className="mx-auto mb-5 border-[6px] border-cream bg-mn-blue px-4 py-5"
        style={{
          imageRendering: "pixelated",
          boxShadow:
            "0 0 0 6px var(--color-mn-blue), 0 0 0 12px var(--color-accent-gold), 0 0 0 18px var(--color-mn-blue)",
        }}
      >
        <p className="mb-4 text-[9px] tracking-widest text-accent-gold sm:text-[11px]">
          ★ HOW TO PLAY ★
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Column heading="DESKTOP" rows={desktop} active={!touch} />
          <Column heading="MOBILE" rows={mobile} active={touch} />
        </div>
        <p className="mt-4 text-[7px] leading-[1.9] text-cream sm:text-[9px]">
          Reach the clinic at the end of the trail. Collect your documents, dodge
          the barriers, and don&apos;t give up.
        </p>
      </div>
      <div className="mx-auto flex max-w-xs flex-col gap-3">
        <MenuButton onClick={onContinue}>▶ Start Run</MenuButton>
        <MenuButton onClick={onBack}>Back</MenuButton>
      </div>
    </div>
  );
}

function TrailMap({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [len, setLen] = useState(0);
  const [progress, setProgress] = useState(0);
  const [marker, setMarker] = useState<{ x: number; y: number }>(TRAIL_STOPS[0]);

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    setLen(el.getTotalLength());
  }, []);

  useEffect(() => {
    if (!len) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setProgress(1);
      setMarker(TRAIL_STOPS[TRAIL_STOPS.length - 1]);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const DURATION = 3400;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      setProgress(p);
      const el = pathRef.current;
      if (el) {
        const pt = el.getPointAtLength(p * len);
        setMarker({ x: pt.x, y: pt.y });
      }
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [len]);

  // Which stops the line has reached (stops are ~evenly spaced along the path).
  const reached = Math.max(
    1,
    Math.min(TRAIL_STOPS.length, Math.round(progress * (TRAIL_STOPS.length - 1)) + 1),
  );

  return (
    <div className="w-full max-w-3xl text-center" style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}>
      <p className="mb-4 text-[10px] tracking-widest text-accent-gold sm:text-[12px]">★ THE TRAIL AHEAD ★</p>
      <div
        className="relative mx-auto mb-5 aspect-[2/1] w-full overflow-hidden border-[6px] border-cream"
        style={{
          imageRendering: "pixelated",
          boxShadow:
            "0 0 0 6px var(--color-mn-blue), 0 0 0 12px var(--color-accent-gold)",
          backgroundImage: `url(${trailMapBg.url})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      >
        <svg
          viewBox="0 0 800 400"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {/* Faint full route so the destination is always readable */}
          <path
            ref={pathRef}
            d={TRAIL_PATH_D}
            fill="none"
            stroke="rgba(43,30,16,0.35)"
            strokeWidth={7}
            strokeLinecap="round"
          />
          {/* Animated highlight drawn along the painted trail */}
          {len > 0 && (
            <>
              <path
                d={TRAIL_PATH_D}
                fill="none"
                stroke="rgba(20,14,6,0.55)"
                strokeWidth={9}
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={len * (1 - progress)}
              />
              <path
                d={TRAIL_PATH_D}
                fill="none"
                stroke="#F5C243"
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={len * (1 - progress)}
              />
            </>
          )}

          {/* Stop highlights centered on the printed markers */}
          {TRAIL_STOPS.map((s, i) => {
            const on = i < reached;
            return (
              <g key={s.label}>
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={on ? 17 : 14}
                  fill="none"
                  stroke={on ? "#F5C243" : "rgba(43,30,16,0.35)"}
                  strokeWidth={on ? 4 : 2}
                  opacity={on ? 1 : 0.6}
                >
                  {on && (
                    <animate
                      attributeName="r"
                      values="15;19;15"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
              </g>
            );
          })}

          {/* Traveling marker */}
          {len > 0 && progress < 1 && (
            <>
              <circle cx={marker.x} cy={marker.y} r={9} fill="#2a1c0c" />
              <circle cx={marker.x} cy={marker.y} r={6} fill="#F5E8C7" />
            </>
          )}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-1.5">
          <span className="rounded-sm border-2 border-accent-gold bg-mn-blue/90 px-2 py-1 text-[7px] leading-relaxed text-accent-gold shadow-[2px_2px_0_rgba(0,0,0,0.6)] sm:text-[9px]">
            {TRAIL_STOPS[reached - 1].label}
          </span>
        </div>
      </div>
      <div className="mx-auto flex max-w-xs flex-col gap-3">
        <MenuButton onClick={onContinue}>▶ Begin Journey</MenuButton>
        <MenuButton onClick={onBack}>Back</MenuButton>
      </div>
    </div>
  );
}



