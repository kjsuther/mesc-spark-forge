import { useCallback, useEffect, useRef, useState } from "react";
import { Leaderboard } from "./leaderboard";
import type { GameFlags, WinResult } from "./game-scenes";

type Props = {
  flags: GameFlags;
  mode: "before" | "after";
  onWin?: (result: WinResult) => void;
  onLose?: (result: WinResult) => void;
};

type TouchInput = { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean };

type LaunchMode = "standard" | "fullscreen";
type MenuScreen = "title" | "scores";

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

export function GameCanvas({ flags, mode, onWin, onLose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fauxFullscreen, setFauxFullscreen] = useState(false);
  const [launchMode, setLaunchMode] = useState<LaunchMode | null>(null);
  const [menuScreen, setMenuScreen] = useState<MenuScreen>("title");
  const [showHint, setShowHint] = useState(true);
  const [loading, setLoading] = useState(false);
  const { portrait } = useOrientation();
  const [isTouch] = useState(() => isCoarsePointer());
  const key = `${mode}|${Object.entries(flags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v ? 1 : 0}`)
    .join(",")}`;

  // Start the game only after the user picks a launch mode
  useEffect(() => {
    if (!launchMode) return;
    const w = window as unknown as { __gameInput?: TouchInput };
    w.__gameInput = { left: false, right: false, jumpReq: false, resetReq: false };

    let cancelled = false;
    let destroy: (() => void) | null = null;
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { startGame } = await import("./game-scenes");
        if (cancelled) return;
        destroy = await startGame({ canvas, flags, mode, onWin, onLose });
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

  // Auto-hide the mobile hint after 6s
  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(t);
  }, [showHint]);

  // Native fullscreen tracking
  useEffect(() => {
    const onFsChange = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      setIsFullscreen(!!fsElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange as EventListener);
    };
  }, []);

  // Lock body scroll while in faux-fullscreen (iOS Safari fallback)
  useEffect(() => {
    if (!fauxFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fauxFullscreen]);

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

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitNativeFullscreen();
      return;
    }
    if (fauxFullscreen) {
      setFauxFullscreen(false);
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
  ]);

  // User picked a mode. On mobile / touch devices we skip native fullscreen
  // (unsupported on iOS Safari for divs, and awaiting the promise loses the
  // user gesture) and go straight to faux-fullscreen so the launch is
  // instantaneous and the canvas gets the whole viewport.
  const pickMode = useCallback(
    (m: LaunchMode) => {
      const coarse = isCoarsePointer();
      if (m === "fullscreen" || coarse) {
        if (!coarse && nativeFullscreenSupported()) {
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
    [requestNativeFullscreen, nativeFullscreenSupported],
  );


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

  const containerStyle: React.CSSProperties = overlayFs
    ? {
        position: fauxFullscreen ? "fixed" : "relative",
        inset: fauxFullscreen ? 0 : undefined,
        width: fauxFullscreen ? "100vw" : "100vw",
        height: fauxFullscreen ? "100dvh" : "100vh",
        background: "var(--color-mn-blue)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        overscrollBehavior: "contain",
        zIndex: fauxFullscreen ? 9999 : undefined,
      }
    : {
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        overscrollBehavior: "contain",
      };

  return (
    <div ref={containerRef} className="relative w-full" style={containerStyle}>
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
          className="absolute right-2 top-2 z-40 rounded bg-mn-blue/80 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-cream shadow-lg touch-none"
          style={{ touchAction: "none" }}
        >
          ✕ Exit
        </button>
      )}

      <div
        className={
          overlayFs
            ? "relative overflow-hidden bg-mn-blue"
            : "relative w-full overflow-hidden rounded-lg bg-mn-blue ring-2 ring-mn-blue/60 shadow-lg"
        }
        style={
          overlayFs
            ? {
                width: "min(100vw, calc((100dvh - 96px) * 16 / 9))",
                maxHeight: "calc(100dvh - 96px)",
                aspectRatio: "16 / 9",
              }
            : undefined
        }
      >
        <canvas
          ref={canvasRef}
          onPointerDown={focusCanvas}
          onContextMenu={(e) => e.preventDefault()}
          className="block w-full h-full touch-none select-none"
          style={{
            // Hard 16:9 lock so the canvas box always matches the game's
            // logical aspect ratio. Combined with the fixed pixelDensity in
            // game-scenes.ts, this means CSS-pixel size or DPR changes can
            // never squeeze or stretch a sprite.
            aspectRatio: "16 / 9",
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            imageRendering: "pixelated",
            touchAction: "none",
            display: "block",
          }}
          tabIndex={0}
          aria-label="Blazing the Trail to Coverage game"
        />


        {/* SNES-style title / launch / high-score screen */}
        {!launchMode && !error && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-mn-blue p-4 text-cream">
            {menuScreen === "title" && (
              <div className="w-full max-w-lg text-center">
                {/* SNES-style title card: pixel border, blinking press start */}
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
                  <MenuButton onClick={() => pickMode("standard")}>▶ Start Game</MenuButton>
                  <MenuButton onClick={() => pickMode("fullscreen")}>⛶ Fullscreen</MenuButton>
                  <MenuButton onClick={() => setMenuScreen("scores")}>★ High Scores</MenuButton>
                </div>
              </div>
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
                  <MenuButton onClick={() => pickMode("standard")}>Start</MenuButton>
                </div>
              </div>
            )}
          </div>
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


        {/* Fullscreen toggle overlay button (only while game is running) */}
        {launchMode && !overlayFs && (
          <button
            type="button"
            aria-label={overlayFs ? "Exit fullscreen" : "Enter fullscreen"}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFullscreen();
            }}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute right-2 top-2 z-20 rounded bg-mn-blue/75 px-2 py-1 text-xs font-bold text-cream hover:bg-mn-blue touch-none"
            style={{ touchAction: "none" }}
          >
            {overlayFs ? "✕ Exit" : "⛶ Full"}
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
      </div>

      {/* Fullscreen controls live outside the canvas so they never cover the trail. */}
      {launchMode && overlayFs && (
        <div
          className="grid w-full max-w-[720px] grid-cols-[minmax(0,1fr)_auto] items-end gap-2 px-3 pt-2 select-none"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
        >
          <div className="flex min-w-0 gap-2">
            <LabeledTouch compact label="Left" aria="Move left" onDown={() => setBtn("left", true)} onUp={() => setBtn("left", false)}>◀</LabeledTouch>
            <LabeledTouch compact label="Right" aria="Move right" onDown={() => setBtn("right", true)} onUp={() => setBtn("right", false)}>▶</LabeledTouch>
          </div>
          <div className="flex items-end gap-2">
            <LabeledTouch compact label="Restart" aria="Restart" onDown={reset}>⟳</LabeledTouch>
            <LabeledTouch compact label="Jump" aria="Jump" onDown={jump} big>JUMP</LabeledTouch>
          </div>
        </div>
      )}

      {/* Inline touch controls (non-fullscreen mobile) */}
      {launchMode && !overlayFs && (
        <>
          {showHint && (
            <p className="mt-2 text-center text-[11px] font-semibold text-mn-blue md:hidden">
              Hold ◀ ▶ to move · JUMP to hop · ⟳ to restart
            </p>
          )}
          <div className="mt-3 flex items-end justify-between gap-2 md:hidden select-none">
            <div className="flex gap-2">
              <LabeledTouch compact label="Left" aria="Move left" onDown={() => setBtn("left", true)} onUp={() => setBtn("left", false)}>◀</LabeledTouch>
              <LabeledTouch compact label="Right" aria="Move right" onDown={() => setBtn("right", true)} onUp={() => setBtn("right", false)}>▶</LabeledTouch>
            </div>
            <div className="flex items-end gap-2">
              <LabeledTouch compact label="Restart" aria="Restart" onDown={reset}>⟳</LabeledTouch>
              <LabeledTouch compact label="Jump" aria="Jump" onDown={jump} big>JUMP</LabeledTouch>
            </div>
          </div>
        </>
      )}

      {launchMode && !overlayFs && (
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


function LabeledTouch({
  children,
  onDown,
  onUp,
  aria,
  big,
  compact,
  label,
}: {
  children: React.ReactNode;
  onDown: () => void;
  onUp?: () => void;
  aria: string;
  big?: boolean;
  compact?: boolean;
  label: string;
}) {
  const sizeClass = compact
    ? big
      ? "h-14 w-16 text-sm"
      : "h-12 w-12 text-xl"
    : big
      ? "h-20 w-20 text-base sm:h-24 sm:w-24 sm:text-lg"
      : "h-14 w-14 text-xl sm:h-16 sm:w-16 sm:text-2xl";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={aria}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
          } catch {
            // Some mobile browsers and automated touch events don't expose an active pointer capture target.
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
        className={`rounded-full bg-mn-blue font-black text-cream shadow-lg active:brightness-125 touch-none select-none ${sizeClass}`}
        style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      >
        {children}
      </button>
      <span className="rounded bg-mn-blue/70 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-cream drop-shadow sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}
