import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Leaderboard } from "./leaderboard";
import { ScoreEntryOverlay } from "./score-entry-overlay";
import { GameMusic, type MusicTheme } from "@/lib/game-music";
import { setSfxEnabled } from "@/lib/game-sfx";
import type { GameFlags, RunSnapshot, WinResult } from "./game-scenes";
import trailMapBg from "@/assets/game/trail-map-bg-v2.png.asset.json";

import { clampResumeZone, isResumableSnapshot, shouldRecoverGameAfterResume } from "./lifecycle";
import { selectViewportSnapshot } from "./viewport";
import { isTouchDevice, useDeviceProfile } from "@/lib/device";
import { subscribeGamepad, useGamepadConnected } from "@/lib/gamepad";


type Props = {
  onWin?: (result: WinResult) => void;
  onLose?: (result: WinResult) => void;
  /** Poster/projection mode: fill the parent, no hint text, no fullscreen button. */
  presentation?: boolean;
};

// The former database-driven improvement ballot was retired in favor of the
// free-form feedback backlog. Keep these dormant capability hooks explicit.
const BUILD_FLAGS: GameFlags = {
  extra_lives: false,
  navigator_helper: false,
  chat_invincible: false,
  email_umbrella: false,
  resume_checkpoint: false,
};

type TouchInput = { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean };

type LaunchMode = "standard" | "fullscreen";
type MenuScreen = "title" | "explainer" | "trailmap" | "controls" | "scores";

/** Single shared detector — see src/lib/device.ts. */
const isCoarsePointer = isTouchDevice;

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
    return selectViewportSnapshot(
      vv
        ? {
            width: vv.width,
            height: vv.height,
            offsetLeft: vv.offsetLeft,
            offsetTop: vv.offsetTop,
          }
        : undefined,
      { width: window.innerWidth, height: window.innerHeight },
      {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      },
    );
  };

  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") {
      return { vw: 960, vh: 540, offsetLeft: 0, offsetTop: 0 };
    }
    return readSize();
  });
  useEffect(() => {
    let raf = 0;
    const read = () => {
      const next = readSize();
      setSize((prev) =>
        prev.vw === next.vw &&
        prev.vh === next.vh &&
        prev.offsetLeft === next.offsetLeft &&
        prev.offsetTop === next.offsetTop
          ? prev
          : next,
      );
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

/**
 * Give a retired canvas's WebGL context back to the browser immediately.
 * Without this, discarded canvases keep their contexts until GC, and mobile
 * browsers (which allow only a handful) start failing the next boot at shader
 * compile time with a generic "failed to load".
 */
function releaseCanvasContext(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  try {
    const gl = (canvas.getContext("webgl2") ||
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* context already gone */
  }
}

export function GameCanvas({ onWin, onLose, presentation = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fauxFullscreen, setFauxFullscreen] = useState(false);
  const [launchMode, setLaunchMode] = useState<LaunchMode | null>(null);
  const [menuScreen, setMenuScreen] = useState<MenuScreen>("title");
  const [showHint, setShowHint] = useState(true);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [engineGeneration, setEngineGeneration] = useState(0);
  const [endResult, setEndResult] = useState<WinResult | null>(null);
  const { portrait } = useOrientation();
  const { vw, vh, offsetLeft, offsetTop } = useViewportSize();
  const device = useDeviceProfile();
  const isTouch = device.touch;
  /** Live pixel height of the canvas box — mobile controls size from this so
   *  they are finger-sized in windowed play and in fullscreen alike. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageBox, setStageBox] = useState({ w: 960, h: 540 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setStageBox((prev) =>
        Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1
          ? prev
          : { w: r.width, h: r.height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  /** The player asked for fullscreen; keep them there across browser hiccups. */
  const fsIntentRef = useRef(false);
  const menuTapHandledUntilRef = useRef(0);
  const resumeZoneRef = useRef(0);
  /** Full run state, kept so a context-loss recovery resumes an honest run. */
  const snapshotRef = useRef<RunSnapshot | null>(null);
  const recoveryPendingRef = useRef(false);

  const music = useMemo(() => new GameMusic(), []);
  const [musicOn, setMusicOn] = useState(false);
  useEffect(
    () => () => {
      music.stop();
    },
    [music],
  );
  /** Set once the player uses the sound toggle themselves — after that we
   *  never override their choice when a run starts. */
  const soundChoiceRef = useRef(false);
  const toggleMusic = useCallback(() => {
    soundChoiceRef.current = true;
    const on = music.toggle();
    setSfxEnabled(on);
    setMusicOn(on);
  }, [music]);

  // The scene drives the mood: boss battle in Zone 7, fanfare on the finale.
  const handleMusicTheme = useCallback(
    (theme: MusicTheme) => {
      music.setTheme(theme);
    },
    [music],
  );

  // Start the game only after the user picks a launch mode
  useEffect(() => {
    if (!launchMode) return;
    const w = window as unknown as { __gameInput?: TouchInput };
    w.__gameInput = { left: false, right: false, jumpReq: false, resetReq: false };

    // Start a fresh run on the default theme.
    music.reset();

    let cancelled = false;
    let destroy: (() => void) | null = null;
    // The canvas this run booted on. The element is keyed by engineGeneration,
    // so by cleanup time canvasRef already points at the NEXT canvas — we must
    // release the old one, never the fresh one (touching a fresh canvas's
    // context would poison it before the engine can claim it).
    let bootedCanvas: HTMLCanvasElement | null = null;
    setEndResult(null);
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        bootedCanvas = canvas;

        // Let the previous engine's frame loop actually stop before booting a
        // new one. The engine keeps some state in module scope, so if the old
        // loop ticks once after the new instance exists it draws with the old
        // instance's textures — which is what turned every label into a solid
        // black block after a restart. Two frames is enough for the retired
        // loop to see its stop flag.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        if (cancelled) return;

        const { startGame } = await import("./game-scenes");
        if (cancelled) return;

        const flags = BUILD_FLAGS;
        const teardown = await startGame({
          canvas,

          flags,
          resumeZone: clampResumeZone(resumeZoneRef.current),
          resumeSnapshot: isResumableSnapshot(snapshotRef.current) ? snapshotRef.current : null,
          onSafeProgress: (zone: number) => {
            resumeZoneRef.current = clampResumeZone(zone);
          },
          onSnapshot: (snap: RunSnapshot | null) => {
            snapshotRef.current = snap;
          },
          onWin: (r: WinResult) => {
            snapshotRef.current = null;
            setEndResult(r);
            onWin?.(r);
          },
          onLose: (r: WinResult) => {
            snapshotRef.current = null;
            setEndResult(r);
            onLose?.(r);
          },
          onMusicTheme: handleMusicTheme,
        });
        // If the effect was torn down while this boot was still in flight, the
        // engine that just came up would otherwise run forever behind the new
        // one — two live WebGL contexts, and eventually a shader-compile
        // failure on mobile. Kill it the moment it exists.
        if (cancelled) {
          teardown();
          releaseCanvasContext(canvas);
          return;
        }
        destroy = teardown;
        recoveryPendingRef.current = false;
        setRecovering(false);
        setLoading(false);
      } catch (err) {
        console.error("[game] failed to start", err);
        if (!cancelled) {
          recoveryPendingRef.current = false;
          setRecovering(false);
          setError(err instanceof Error ? err.message : "Failed to start game");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (destroy) destroy();
      destroy = null;
      // Explicitly hand the retired canvas's graphics context back. Browsers
      // cap live contexts per page, and a discarded canvas holds on to its own
      // long enough that the next boot fails at shader compile ("failed to
      // load shaders" on the second play). The canvas element is keyed per
      // effect run, so the element booted here is always the retired one.
      releaseCanvasContext(bootedCanvas);
      bootedCanvas = null;
    };


    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchMode, engineGeneration]);

  const recoverGame = useCallback(() => {
    if (!launchMode || recoveryPendingRef.current) return;
    recoveryPendingRef.current = true;
    const w = window as unknown as { __gameInput?: TouchInput };
    if (w.__gameInput) {
      w.__gameInput.left = false;
      w.__gameInput.right = false;
      w.__gameInput.jumpReq = false;
      w.__gameInput.resetReq = false;
    }
    setEndResult(null);
    setError(null);
    setRecovering(true);
    setLoading(true);
    // Replacing the element guarantees a fresh graphics context. Reusing the
    // old canvas can retain iOS Safari's corrupted text texture atlas.
    setEngineGeneration((generation) => generation + 1);
  }, [launchMode]);

  // Mobile Safari can discard WebGL textures in the background without a
  // complete context-loss cycle. Recover on either lifecycle signal and let
  // the scene resume at the most recent durable stage.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !launchMode) return;
    let hiddenAt: number | null = null;
    let contextWasLost = false;

    const releaseInput = () => {
      const w = window as unknown as { __gameInput?: TouchInput };
      if (!w.__gameInput) return;
      w.__gameInput.left = false;
      w.__gameInput.right = false;
      w.__gameInput.jumpReq = false;
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextWasLost = true;
      releaseInput();
      music.suspend();
      recoverGame();
    };
    const onContextRestored = () => {
      contextWasLost = false;
      recoverGame();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = performance.now();
        releaseInput();
        music.suspend();
        return;
      }

      music.resume();
      if (
        shouldRecoverGameAfterResume({
          isTouch,
          hiddenAt,
          visibleAt: performance.now(),
          contextWasLost,
        })
      ) {
        recoverGame();
      }
      hiddenAt = null;
      contextWasLost = false;
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (
        shouldRecoverGameAfterResume({
          isTouch,
          hiddenAt,
          visibleAt: performance.now(),
          pageWasRestored: event.persisted,
        })
      ) {
        recoverGame();
      }
    };

    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [engineGeneration, isTouch, launchMode, music, recoverGame]);

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
      if (fsElement) {
        // Native and faux fullscreen are mutually exclusive. Keeping both
        // active makes one Exit tap leave the fixed overlay behind.
        setFauxFullscreen(false);
      } else if (fsIntentRef.current) {
        setFauxFullscreen(true);
      }
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
    const prev = {
      overflow: body.overflow,
      htmlOverflow: html.overflow,
      overscroll: body.overscrollBehavior,
    };
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

  // The engine listens for keys on the canvas, so hand it focus as soon as a
  // run is live (and again after each restart). Without this the player has to
  // click the canvas before the arrow keys do anything.
  useEffect(() => {
    if (!launchMode || loading) return;
    const t = window.setTimeout(() => canvasRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [launchMode, loading, engineGeneration]);

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
      setFauxFullscreen(false);
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
      if (!nativeFullscreenSupported()) {
        setFauxFullscreen(true);
        return;
      }
      // Android Chrome supports it too — take the extra chrome-free pixels
      // when they're on offer, and keep the overlay underneath as a fallback.
      const ok = await requestNativeFullscreen();
      setFauxFullscreen(!ok);
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
      resumeZoneRef.current = 0;
      snapshotRef.current = null;
      snapshotRef.current = null;
      const coarse = isCoarsePointer();
      if (m === "fullscreen" || coarse) {
        fsIntentRef.current = true;
        nudgeMobileBrowserChrome();
        if (coarse) {
          if (nativeFullscreenSupported()) {
            void requestNativeFullscreen().then((ok) => setFauxFullscreen(!ok));
          } else {
            setFauxFullscreen(true);
          }
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
    // Keep requestFullscreen in the original pointer event's user activation.
    if (nativeFullscreenSupported()) {
      void requestNativeFullscreen().then((ok) => setFauxFullscreen(!ok));
    } else {
      setFauxFullscreen(true);
    }
  }, [nativeFullscreenSupported, nudgeMobileBrowserChrome, requestNativeFullscreen]);

  // Every paused menu screen advances the same way: Enter, Space, mouse click,
  // or a tap anywhere on touch devices.
  const advanceMenu = useCallback(() => {
    if (menuScreen === "title") {
      if (!soundChoiceRef.current) {
        try {
          music.start();
        } catch (err) {
          console.warn("[game] music start failed", err);
        }
        setMusicOn(true);
      }
      setMenuScreen("explainer");
      return;
    }

    if (menuScreen === "explainer") {
      setMenuScreen("trailmap");
      return;
    }
    if (menuScreen === "trailmap") {
      setMenuScreen("controls");
      return;
    }
    if (menuScreen === "controls") {
      pickMode("standard");
      return;
    }
    // High scores: continue means "get going".
    setMenuScreen("explainer");
  }, [menuScreen, music, pickMode]);

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

  // ---- USB controller (Trooper 2 arcade stick and other standard gamepads) --
  // Menus advance on any button; during a run the stick drives movement and
  // the main button jumps. Enter is also forwarded to the canvas so in-game
  // "press to continue" prompts respond to the stick too.
  useEffect(() => {
    const w = window as unknown as {
      __gameInput?: TouchInput;
      __gamepadGameCapture?: boolean;
    };
    w.__gamepadGameCapture = true;
    let lastMenuAdvance = 0;
    const unsub = subscribeGamepad((f) => {
      if (error) return;
      if (!launchMode) {
        const now = performance.now();
        if ((f.confirm || f.start) && now - lastMenuAdvance > 260) {
          lastMenuAdvance = now;
          advanceMenu();
        }
        return;
      }
      const input = w.__gameInput;
      if (input) {
        input.left = f.left;
        input.right = f.right;
        if (f.confirm || f.tapUp) input.jumpReq = true;
        if (f.select) input.resetReq = true;
      }
      if (f.left || f.right || f.confirm) setShowHint(false);
      if (f.confirm || f.start) {
        const canvas = canvasRef.current;
        if (canvas) {
          for (const type of ["keydown", "keyup"] as const) {
            canvas.dispatchEvent(
              new KeyboardEvent(type, { key: "Enter", code: "Enter", bubbles: true }),
            );
          }
        }
      }
    });
    return () => {
      w.__gamepadGameCapture = false;
      unsub();
    };
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
    resumeZoneRef.current = 0;
    snapshotRef.current = null;
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
  // the game uses. Menu cards are taller than the game viewport because they
  // include buttons, so short landscape phones use a taller fit baseline to
  // keep Continue / Start controls reachable above mobile browser chrome.
  // large tablets and desktops scale up (nothing is squint-small).
  const uiScale = overlayFs
    ? Math.max(
        isTouch ? 0.56 : 0.82,
        Math.min(1.85, Math.min(vw / 960, vh / (isTouch ? 680 : 540)) * (isTouch ? 1.02 : 1.12)),
      )
    : isTouch
      ? // Windowed mobile: the canvas box is much shorter than the 960x540
        // design box, so menu cards must scale to the box or they clip.
        Math.max(0.4, Math.min(1, Math.min(stageBox.w / 960, stageBox.h / 620)))
      : 1;
  const menuScale =
    overlayFs && isTouch && menuScreen === "trailmap" ? Math.min(uiScale, 0.5) : uiScale;
  const menuSafePadding = overlayFs && isTouch ? 4 : 8;

  // Touch button sizing: proportional to the visible stage, clamped to a
  // comfortable finger target on the smallest phones and prevented from
  // swallowing gameplay on tablets.
  const padUnit = Math.round(Math.max(52, Math.min(84, stageBox.h * 0.2)));
  const padGap = Math.max(8, Math.round(padUnit * 0.14));
  const padEdge = Math.max(10, Math.round(padUnit * 0.18));
  const jumpSize = Math.round(padUnit * 1.15);
  const resetSize = Math.round(padUnit * 0.7);

  const containerStyle: React.CSSProperties = overlayFs
    ? {
        position: fauxFullscreen ? "fixed" : "relative",
        top: fauxFullscreen ? offsetTop : undefined,
        left: fauxFullscreen ? offsetLeft : undefined,
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
          style={{
            padding:
              "calc(env(safe-area-inset-top, 0px) + 24px) calc(env(safe-area-inset-right, 0px) + 24px) calc(env(safe-area-inset-bottom, 0px) + 24px) calc(env(safe-area-inset-left, 0px) + 24px)",
            fontFamily: '"Press Start 2P", ui-monospace, monospace',
          }}
        >
          <div className="max-w-xs">
            <div
              className="mx-auto mb-6 flex h-24 w-16 items-center justify-center rounded-lg border-4 border-cream text-3xl"
              style={{ animation: "rotate-hint 2s ease-in-out infinite" }}
            >
              ↻
            </div>
            <p className="mb-2 text-[10px] tracking-widest text-accent-gold">TURN YOUR PHONE</p>
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
        ref={stageRef}
        className={
          overlayFs
            ? "relative overflow-hidden bg-black"
            : presentation
              ? "relative w-full flex-1 min-h-0 overflow-hidden bg-mn-blue"
              : "relative mx-auto w-full scroll-mt-24 overflow-hidden rounded-lg bg-mn-blue ring-2 ring-mn-blue/60 shadow-lg [aspect-ratio:16/9] max-h-[calc(100svh-9rem)]"
        }
        style={
          overlayFs
            ? {
                // Edge-to-edge: the engine's logical viewport already matches
                // the device aspect, so there is nothing left to letterbox.
                width: fsWidth,
                height: fsHeight,
                margin: 0,
                // Keep canvas-drawn HUD text clear of landscape notches and
                // the home indicator. Controls remain on the outer safe box.
                padding:
                  launchMode && isTouch
                    ? "env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)"
                    : 0,
                boxSizing: "border-box",
              }
            : presentation
              ? { width: "100%", height: "100%" }
              : undefined
        }
      >
        <canvas
          key={`${launchMode ?? "idle"}-${engineGeneration}`}

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
          <ScoreEntryOverlay
            result={endResult}
            onClose={() => {
              // If the player doesn't choose "Play Again", send them back to
              // the title screen so the run doesn't sit idle on the canvas.
              setEndResult(null);
              setLaunchMode(null);
              setMenuScreen("title");
            }}
            onRestart={() => {
              // Restart the run inside the live engine. A full engine reboot
              // was tried here and is WORSE: the engine's glyph atlas outlives
              // a restart, so a second instance draws every label as a black
              // block. Resetting in place keeps text rendering correct.
              setEndResult(null);
              resumeZoneRef.current = 0;
              snapshotRef.current = null;
              const gw = window as unknown as { __gameInput?: TouchInput };
              if (gw.__gameInput) {
                gw.__gameInput.left = false;
                gw.__gameInput.right = false;
                gw.__gameInput.jumpReq = false;
                gw.__gameInput.resetReq = true;
              }
              canvasRef.current?.focus();
            }}
            uiScale={uiScale}
          />
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
            onPointerDown={(e) => {
              // Tap/click anywhere continues — except on the menu buttons
              // themselves, which already have their own action.
              if (performance.now() < menuTapHandledUntilRef.current) return;
              if ((e.target as HTMLElement).closest("button")) return;
              e.preventDefault();
              menuTapHandledUntilRef.current = performance.now() + 900;
              enterFullscreenOnFirstTap();
              advanceMenu();
            }}
          >
            {/* Every menu card measures itself and shrinks to the live canvas
                box, so windowed desktop play can never clip the buttons off
                the bottom the way a fixed scale of 1 did. */}
            <MenuFit baseScale={menuScale} screenKey={menuScreen}>
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
                    className="mx-auto flex w-full max-w-xs flex-col gap-3"
                    style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}
                  >
                    <MenuButton
                      onClick={() => {
                        setMenuScreen("explainer");
                        enterFullscreenOnFirstTap();
                        // Respect an explicit mute made with the sound toggle.
                        if (!soundChoiceRef.current) {
                          setMusicOn(true);
                          try {
                            music.start();
                          } catch (err) {
                            console.warn("[game] music start failed", err);
                          }
                        }
                      }}
                    >
                      ▶ Start Game
                    </MenuButton>
                    <MenuButton
                      onClick={() => {
                        enterFullscreenOnFirstTap();
                        setMenuScreen("scores");
                      }}
                    >
                      ★ High Scores
                    </MenuButton>
                    {/* Full screen is a first-class title-screen option, not a
                      hidden control that only appears mid-run. */}
                    <MenuButton
                      onClick={() => {
                        autoFsDoneRef.current = true;
                        void toggleFullscreen();
                      }}
                    >
                      {isFullscreen || fauxFullscreen ? "⤡ Exit Full Screen" : "⛶ Full Screen"}
                    </MenuButton>
                  </div>
                </div>
              )}

              {menuScreen === "explainer" && (
                <div
                  className="w-full max-w-2xl text-center"
                  style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}
                >
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
                      Applying for health coverage is a LONG road. Without the right tools it can
                      feel impossible &mdash; forms pile up, letters get lost, deadlines slip, and
                      many people GIVE UP before the finish line.
                    </p>
                    <p className="mt-4 text-[9px] leading-[1.9] text-cream sm:text-[11px]">
                      Go as far as you can down the trail. When your run ends, tell us what would
                      have made the journey easier &mdash; the team builds that feedback into the
                      next version.
                    </p>
                  </div>
                  <div className="mx-auto flex max-w-xs flex-col gap-3">
                    <MenuButton onClick={() => setMenuScreen("trailmap")}>▶ Continue</MenuButton>
                    <MenuButton onClick={() => setMenuScreen("title")}>Back</MenuButton>
                  </div>
                </div>
              )}

              {menuScreen === "trailmap" && (
                <TrailMap
                  onContinue={() => setMenuScreen("controls")}
                  onBack={() => setMenuScreen("explainer")}
                />
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
            </MenuFit>
          </div>
        )}

        {/* Music toggle. In windowed play this lives BELOW the canvas so it
            never covers gameplay; fullscreen has no outside space, so it
            stays an overlay button in the top-right safe area. */}
        {launchMode && overlayFs && (
          <button
            type="button"
            onClick={toggleMusic}
            aria-label={musicOn ? "Mute music" : "Play music"}
            className="absolute z-40 h-9 w-9 rounded-md border-2 border-cream bg-mn-blue/80 text-cream text-lg font-black backdrop-blur-sm"
            style={{
              top: "calc(env(safe-area-inset-top, 0px) + 10px)",
              right: "calc(env(safe-area-inset-right, 0px) + 88px)",
              fontFamily: '"Press Start 2P", ui-monospace, monospace',
            }}
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
                {recovering ? "RESTORING…" : "LOADING…"}
              </p>
              <p className="text-[8px] tracking-widest text-cream/70 sm:text-[10px]">
                {recovering
                  ? `Returning to stage ${clampResumeZone(resumeZoneRef.current) + 1}`
                  : "Preparing the trail"}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-40 grid place-items-center bg-mn-blue/95 p-6 text-center text-cream">
            <div>
              <p className="font-bold mb-2">The game hit a snag</p>
              <p className="text-sm opacity-80 mb-4">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  setEngineGeneration((generation) => generation + 1);
                }}
                className="rounded-md border-2 border-accent-gold bg-mn-blue px-5 py-3 text-sm font-bold uppercase tracking-wide text-cream"
              >
                ⟳ Tap to retry
              </button>
            </div>
          </div>
        )}

        {/* Overlay touch controls — always ON TOP of the canvas on touch
            devices, in windowed play as well as fullscreen, so they can never
            scroll out of reach. Gated on real touch capability, never on a
            width breakpoint (a landscape phone is 900px wide). */}
        {launchMode && isTouch && !presentation && !endResult && (
          <>
            {/* D-pad, bottom-left */}
            {/* Thumb joystick, bottom-left. One continuous touch can slide
                across centre to reverse direction with no neutral gap. */}
            <div
              className="pointer-events-none absolute z-30 flex"
              style={{
                left: `calc(env(safe-area-inset-left, 0px) + ${padEdge}px)`,
                bottom: `calc(env(safe-area-inset-bottom, 0px) + ${padEdge}px)`,
              }}
            >
              <JoystickPad
                size={Math.round(padUnit * 1.55)}
                onChange={(dir) => {
                  setBtn("left", dir < 0);
                  setBtn("right", dir > 0);
                }}
              />
            </div>

            {/* Action cluster, bottom-right */}
            <div
              className="pointer-events-none absolute z-30 flex items-end"
              style={{
                gap: padGap + 4,
                right: `calc(env(safe-area-inset-right, 0px) + ${padEdge}px)`,
                bottom: `calc(env(safe-area-inset-bottom, 0px) + ${padEdge}px)`,
              }}
            >
              <PadButton label="RESET" aria="Restart" size={resetSize} dim onDown={reset}>
                ⟳
              </PadButton>
              <PadButton label="JUMP" aria="Jump" size={jumpSize} accent onDown={jump}>
                JUMP
              </PadButton>
            </div>
          </>
        )}
      </div>

      {/* Sound + fullscreen controls, outside the canvas at its lower-right
          corner so they never sit on top of the game. Available from the very
          first screen (title menu), not just once a run has started. */}
      {!overlayFs && !presentation && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-3 select-none">
          <button
            type="button"
            onClick={toggleMusic}
            aria-label={musicOn ? "Mute music" : "Play music"}
            className="inline-flex items-center gap-2 rounded-md border-2 border-mn-blue/40 bg-cream px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-mn-blue hover:bg-white"
          >
            <span aria-hidden>{musicOn ? "🔊" : "🔇"}</span>
            {musicOn ? "Sound on" : "Sound off"}
          </button>
          <button
            type="button"
            aria-label={isFullscreen || fauxFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              autoFsDoneRef.current = true;
              toggleFullscreen();
            }}
            onContextMenu={(e) => e.preventDefault()}
            className="inline-flex touch-none items-center gap-2 rounded-md border-2 border-mn-blue/40 bg-cream px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-mn-blue hover:bg-white"
            style={{ touchAction: "none" }}
          >
            <span aria-hidden>{isFullscreen || fauxFullscreen ? "⤡" : "⛶"}</span>
            {isFullscreen || fauxFullscreen ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      )}

      {/* Control hint below the canvas — worded for the device in use. The
          touch buttons themselves now overlay the canvas in both modes. */}
      {launchMode && !overlayFs && !presentation && (
        <p className="mt-2 text-center text-xs font-semibold text-dark-gray/70">
          {isTouch
            ? "Slide the stick to move · JUMP to hop · ⟳ to restart · ⛶ for full screen"
            : "← → to move · Space / ↑ to jump · R to reset · ⛶ for fullscreen"}
        </p>
      )}
    </div>
  );
}

/**
 * Fits a pre-game menu card inside the live canvas box.
 *
 * The card is laid out at its natural size and then scaled down by whatever
 * factor is needed to fit; a transform does not change layout size, so the
 * measurement stays stable and never oscillates. Screens differ in height
 * (title vs. trail map vs. high scores), so the fit is measured per screen and
 * re-measured on every resize / zoom / fullscreen change through the
 * ResizeObserver on both the box and the content.
 */
function MenuFit({
  baseScale,
  screenKey,
  children,
}: {
  baseScale: number;
  screenKey: string;
  children: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(baseScale);

  useEffect(() => {
    const boxEl = boxRef.current;
    const contentEl = contentRef.current;
    if (!boxEl || !contentEl) return;
    const measure = () => {
      const b = boxEl.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0) return;
      setBox((prev) =>
        Math.abs(prev.w - b.width) < 1 && Math.abs(prev.h - b.height) < 1
          ? prev
          : { w: b.width, h: b.height },
      );
      // The card is the layout child; a transform never changes offset sizes,
      // so this natural size stays stable while we scale it.
      const card = contentEl.firstElementChild as HTMLElement | null;
      const cw = card?.offsetWidth ?? 0;
      const ch = card?.offsetHeight ?? 0;
      if (cw <= 0 || ch <= 0) return;
      const fit = Math.min(baseScale, (b.width - 8) / cw, (b.height - 8) / ch);
      const next = Math.max(0.4, Math.min(baseScale, fit));
      setScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(boxEl);
    ro.observe(contentEl);
    return () => ro.disconnect();
  }, [baseScale, screenKey]);

  return (
    <div ref={boxRef} className="grid h-full w-full place-items-center overflow-hidden">
      <div style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
        <div
          ref={contentRef}
          className="flex items-center justify-center"
          style={box.w > 0 ? { width: box.w, height: box.h } : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );

}


function MenuButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const firedUntilRef = useRef(0);
  const fire = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    if (now < firedUntilRef.current) return;
    // Ignore follow-up touch/click events generated from the same physical tap.
    firedUntilRef.current = now + 1200;
    onClick();
  };
  return (
    <button
      type="button"
      // Fire on pointerdown so the menu action is committed before mobile
      // browsers enter fullscreen or animate their address-bar chrome.
      onPointerDown={fire}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
        fire(e);
      }}
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
  const activePointerRef = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);

  const release = useCallback(
    (pointerId?: number) => {
      if (activePointerRef.current === null) return;
      if (pointerId !== undefined && pointerId !== activePointerRef.current) return;
      activePointerRef.current = null;
      setPressed(false);
      onUp?.();
    },
    [onUp],
  );

  // Safety net: if the browser eats the pointerup (scroll takeover, gesture
  // cancel, tab switch, fullscreen transition) the direction must not stick —
  // and, just as important, the stale pointer id must be cleared so the NEXT
  // tap is not swallowed. These listeners stay mounted for the button's whole
  // life, not only while it reads as pressed.
  useEffect(() => {
    const off = () => release();
    const offId = (e: PointerEvent) => release(e.pointerId);
    window.addEventListener("pointerup", offId);
    window.addEventListener("pointercancel", offId);
    window.addEventListener("blur", off);
    document.addEventListener("visibilitychange", off);
    return () => {
      window.removeEventListener("pointerup", offId);
      window.removeEventListener("pointercancel", offId);
      window.removeEventListener("blur", off);
      document.removeEventListener("visibilitychange", off);
    };
  }, [release]);


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
        // Never drop a fresh press: if a previous pointer's up/cancel was
        // swallowed (fullscreen or orientation transitions do this), adopt the
        // new pointer instead of ignoring the tap.
        if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) {
          release();
        }
        activePointerRef.current = e.pointerId;
        setPressed(true);
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
        release(e.pointerId);
      }}
      // Deliberately NO pointerleave/pointerout handler: with pointer capture
      // a finger that drifts a couple of pixels still fires those, which used
      // to cancel movement mid-hold.
      onPointerCancel={(e) => release(e.pointerId)}
      onLostPointerCapture={(e) => release(e.pointerId)}
      onContextMenu={(e) => e.preventDefault()}
      className="pointer-events-auto relative touch-none select-none font-black text-cream"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        background: bg,
        border: `3px solid ${border}`,
        // Press feedback is colour/inset only — the button must never move out
        // from under a finger that is still holding it.
        filter: pressed ? "brightness(1.35)" : undefined,
        boxShadow: pressed
          ? "inset 0 4px 0 rgba(0,0,0,0.45), inset 0 -2px 0 rgba(255,255,255,0.12)"
          : "inset 0 -4px 0 rgba(0,0,0,0.35), inset 0 3px 0 rgba(255,255,255,0.22), 0 3px 0 rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        // Scale the glyph with the button so it stays legible at any size.
        fontSize: accent ? Math.round(size * 0.2) : Math.round(size * 0.38),
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

/**
 * Compact digital thumbstick for touch play. Horizontal axis only: sliding a
 * held thumb across the centre reverses direction inside one gesture, which
 * the old two-button D-pad could not do (it needed a release + retap).
 * Vertical movement is ignored so JUMP stays a separate, simultaneously
 * holdable button.
 */
function JoystickPad({ size, onChange }: { size: number; onChange: (dir: -1 | 0 | 1) => void }) {
  const activePointerRef = useRef<number | null>(null);
  const originRef = useRef(0);
  const dirRef = useRef<-1 | 0 | 1>(0);
  const [knob, setKnob] = useState(0);
  const [active, setActive] = useState(false);

  const radius = size / 2;
  const maxTravel = radius * 0.62;
  const deadZone = radius * 0.18;

  const emit = useCallback(
    (dir: -1 | 0 | 1) => {
      if (dirRef.current === dir) return;
      dirRef.current = dir;
      onChange(dir);
    },
    [onChange],
  );

  const release = useCallback(
    (pointerId?: number) => {
      if (activePointerRef.current === null) return;
      if (pointerId !== undefined && pointerId !== activePointerRef.current) return;
      activePointerRef.current = null;
      setActive(false);
      setKnob(0);
      emit(0);
    },
    [emit],
  );

  // Safety net: a swallowed pointerup (gesture takeover, fullscreen or
  // orientation transition, tab switch) must never leave the hero running.
  useEffect(() => {
    const off = () => release();
    const offId = (e: PointerEvent) => release(e.pointerId);
    window.addEventListener("pointerup", offId);
    window.addEventListener("pointercancel", offId);
    window.addEventListener("blur", off);
    document.addEventListener("visibilitychange", off);
    return () => {
      window.removeEventListener("pointerup", offId);
      window.removeEventListener("pointercancel", offId);
      window.removeEventListener("blur", off);
      document.removeEventListener("visibilitychange", off);
    };
  }, [release]);

  const track = (clientX: number) => {
    const dx = clientX - originRef.current;
    const clamped = Math.max(-maxTravel, Math.min(maxTravel, dx));
    setKnob(clamped);
    emit(dx > deadZone ? 1 : dx < -deadZone ? -1 : 0);
  };

  return (
    <div
      role="slider"
      aria-label="Move left or right"
      aria-valuemin={-1}
      aria-valuemax={1}
      aria-valuenow={dirRef.current}
      tabIndex={-1}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) {
          release();
        }
        activePointerRef.current = e.pointerId;
        // Anchor to the pad centre so the first press already registers the
        // direction the thumb landed on.
        originRef.current = e.currentTarget.getBoundingClientRect().left + radius;
        setActive(true);
        try {
          (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
        } catch {
          /* noop */
        }
        track(e.clientX);
      }}
      onPointerMove={(e) => {
        if (activePointerRef.current !== e.pointerId) return;
        e.preventDefault();
        track(e.clientX);
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        e.stopPropagation();
        release(e.pointerId);
      }}
      onPointerCancel={(e) => release(e.pointerId)}
      onLostPointerCapture={(e) => release(e.pointerId)}
      onContextMenu={(e) => e.preventDefault()}
      className="pointer-events-auto relative touch-none select-none"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(30, 41, 82, 0.62)",
        border: "3px solid var(--color-cream)",
        boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.35), inset 0 3px 0 rgba(255,255,255,0.18)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        touchAction: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: "translateY(-50%)",
          display: "flex",
          justifyContent: "space-between",
          padding: `0 ${Math.round(size * 0.09)}px`,
          fontSize: Math.round(size * 0.14),
          lineHeight: 1,
          color: "rgba(245, 232, 199, 0.7)",
        }}
      >
        <span>◀</span>
        <span>▶</span>
      </span>
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: Math.round(size * 0.46),
          height: Math.round(size * 0.46),
          marginTop: Math.round(size * -0.23),
          marginLeft: Math.round(size * -0.23),
          transform: `translateX(${knob}px)`,
          borderRadius: "50%",
          background: active ? "var(--color-accent-gold)" : "rgba(245, 232, 199, 0.85)",
          border: "2px solid rgba(30, 41, 82, 0.8)",
          boxShadow: "0 2px 0 rgba(0,0,0,0.45)",
        }}
      />
    </div>
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
  const pad = useGamepadConnected();
  // Shared detector, so the instruction card can never disagree with whether
  // the on-screen pads are actually rendered.
  useEffect(() => {
    setTouch(isTouchDevice());
  }, []);

  const desktop: Array<[string, string]> = [
    ["← →", "Move"],
    ["Space / ↑", "Jump"],
    ["R", "Restart run"],
    ["Esc", "Pause"],
  ];
  const mobile: Array<[string, string]> = [
    ["STICK ◀ ▶", "Slide to move (slide across to turn)"],
    ["⤒", "Jump"],
    ["Tap", "Continue screens"],
    ["⛶", "Full screen"],
  ];
  const gamepad: Array<[string, string]> = [
    ["STICK ← →", "Move"],
    ["BUTTON 1", "Jump / Continue"],
    ["STICK ↑", "Jump"],
    ["SELECT", "Restart run"],
  ];

  const rows = pad ? gamepad : touch ? mobile : desktop;
  const heading = pad
    ? "JOYSTICK CONTROLS"
    : touch
      ? "MOBILE CONTROLS"
      : "DESKTOP / LAPTOP CONTROLS";


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
        <div
          className="border-4 px-4 py-4"
          style={{
            borderColor: "var(--color-accent-gold)",
            background: "rgba(255,220,90,0.12)",
          }}
        >
          <p className="mb-4 text-center text-[9px] tracking-widest text-accent-gold sm:text-[11px]">
            {heading}
          </p>
          <ul className="mx-auto flex max-w-sm flex-col gap-3">
            {rows.map(([key, action]) => (
              <li key={action} className="flex items-center justify-between gap-3">
                <span className="text-[10px] text-accent-gold sm:text-[12px]">{key}</span>
                <span className="text-[9px] text-cream sm:text-[11px]">{action}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-[7px] leading-[1.9] text-cream sm:text-[9px]">
          Reach the clinic at the end of the trail. Collect your documents, dodge the barriers, and
          don&apos;t give up.
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
    <div
      className="w-full max-w-3xl text-center"
      style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}
    >
      <p className="mb-4 text-[10px] tracking-widest text-accent-gold sm:text-[12px]">
        ★ THE TRAIL AHEAD ★
      </p>
      <div
        className="relative mx-auto mb-5 aspect-[2/1] w-full overflow-hidden border-[6px] border-cream"
        style={{
          imageRendering: "pixelated",
          boxShadow: "0 0 0 6px var(--color-mn-blue), 0 0 0 12px var(--color-accent-gold)",
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
