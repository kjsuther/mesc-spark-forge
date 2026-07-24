import { useCallback, useEffect, useRef, useState } from "react";
import type { GameFlags, WinResult } from "./game-scenes";

type Props = {
  flags: GameFlags;
  mode: "before" | "after";
  onWin?: (result: WinResult) => void;
  onLose?: (result: WinResult) => void;
};

type TouchInput = { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean };

type LaunchMode = "standard" | "fullscreen";

export function GameCanvas({ flags, mode, onWin, onLose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fauxFullscreen, setFauxFullscreen] = useState(false);
  const [launchMode, setLaunchMode] = useState<LaunchMode | null>(null);
  const [showHint, setShowHint] = useState(true);
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

    (async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { startGame } = await import("./game-scenes");
        if (cancelled) return;
        destroy = await startGame({ canvas, flags, mode, onWin, onLose });
      } catch (err) {
        console.error("[game] failed to start", err);
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to start game");
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
    const ok = await requestNativeFullscreen();
    if (!ok) setFauxFullscreen(true);
  }, [isFullscreen, fauxFullscreen, requestNativeFullscreen, exitNativeFullscreen]);

  // User picked a mode. Fullscreen MUST be requested synchronously from the click.
  const pickMode = useCallback(
    async (m: LaunchMode) => {
      if (m === "fullscreen") {
        const ok = await requestNativeFullscreen();
        if (!ok) setFauxFullscreen(true);
      }
      setLaunchMode(m);
    },
    [requestNativeFullscreen],
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
        background: "#000",
        display: "flex",
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
      <div
        className={
          overlayFs
            ? "relative bg-black overflow-hidden"
            : "relative w-full bg-black rounded-lg overflow-hidden ring-2 ring-mn-blue/60 shadow-lg"
        }
        style={
          overlayFs
            ? { width: "min(100vw, calc(100dvh * 16 / 9))", aspectRatio: "16 / 9" }
            : undefined
        }
      >
        <canvas
          ref={canvasRef}
          onPointerDown={focusCanvas}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full h-full block touch-none select-none"
          style={{
            aspectRatio: "16 / 9",
            imageRendering: "pixelated",
            touchAction: "none",
            display: "block",
          }}
          tabIndex={0}
          aria-label="Blazing the Trail to Coverage game"
        />

        {/* Pre-game launch modal — asks Standard vs Fullscreen */}
        {!launchMode && !error && (
          <div className="absolute inset-0 z-30 bg-black/85 text-white grid place-items-center p-6">
            <div className="max-w-md w-full text-center">
              <p className="text-xs uppercase tracking-widest text-accent-gold mb-2">
                Blazing the Trail to Coverage
              </p>
              <h3 className="text-2xl font-black mb-4">How do you want to play?</h3>
              <p className="text-sm opacity-80 mb-6">
                Fullscreen is recommended on mobile so buttons don't crowd the trail.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => pickMode("standard")}
                  className="flex-1 bg-white text-black font-black uppercase tracking-widest text-sm rounded px-4 py-3"
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => pickMode("fullscreen")}
                  className="flex-1 bg-accent-orange text-white font-black uppercase tracking-widest text-sm rounded px-4 py-3"
                >
                  ⛶ Fullscreen
                </button>
              </div>
              <p className="text-[11px] opacity-60 mt-4">
                You can switch anytime with the ⛶ button in the top-right corner.
              </p>
            </div>
          </div>
        )}

        {/* Fullscreen toggle overlay button (only while game is running) */}
        {launchMode && (
          <button
            type="button"
            aria-label={overlayFs ? "Exit fullscreen" : "Enter fullscreen"}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFullscreen();
            }}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute top-2 right-2 z-20 bg-black/60 text-white text-xs font-bold rounded px-2 py-1 hover:bg-black/80 touch-none"
            style={{ touchAction: "none" }}
          >
            {overlayFs ? "✕ Exit" : "⛶ Full"}
          </button>
        )}

        {/* Touch controls in fullscreen overlay */}
        {launchMode && overlayFs && (
          <div
            className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pointer-events-none"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            <div className="flex gap-3 pointer-events-auto">
              <LabeledTouch label="Left" aria="Move left" onDown={() => setBtn("left", true)} onUp={() => setBtn("left", false)}>◀</LabeledTouch>
              <LabeledTouch label="Right" aria="Move right" onDown={() => setBtn("right", true)} onUp={() => setBtn("right", false)}>▶</LabeledTouch>
            </div>
            <div className="flex items-end gap-3 pointer-events-auto">
              <LabeledTouch label="Restart" aria="Restart" onDown={reset}>⟳</LabeledTouch>
              <LabeledTouch label="Jump" aria="Jump" onDown={jump} big>JUMP</LabeledTouch>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 text-white p-6 text-center">
            <div>
              <p className="font-bold mb-2">Game failed to load</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Inline touch controls (non-fullscreen mobile) */}
      {launchMode && !overlayFs && (
        <>
          {showHint && (
            <p className="mt-2 text-center text-[11px] font-semibold text-mn-blue md:hidden">
              Hold ◀ ▶ to move · JUMP to hop · ⟳ to restart
            </p>
          )}
          <div className="mt-3 flex items-end justify-between gap-4 md:hidden select-none">
            <div className="flex gap-3">
              <LabeledTouch label="Left" aria="Move left" onDown={() => setBtn("left", true)} onUp={() => setBtn("left", false)}>◀</LabeledTouch>
              <LabeledTouch label="Right" aria="Move right" onDown={() => setBtn("right", true)} onUp={() => setBtn("right", false)}>▶</LabeledTouch>
            </div>
            <div className="flex items-end gap-3">
              <LabeledTouch label="Restart" aria="Restart" onDown={reset}>⟳</LabeledTouch>
              <LabeledTouch label="Jump" aria="Jump" onDown={jump} big>JUMP</LabeledTouch>
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

function LabeledTouch({
  children,
  onDown,
  onUp,
  aria,
  big,
  label,
}: {
  children: React.ReactNode;
  onDown: () => void;
  onUp?: () => void;
  aria: string;
  big?: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={aria}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
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
        className={`bg-mn-blue text-white font-black rounded-full active:brightness-125 shadow-lg touch-none select-none ${
          big ? "w-24 h-24 text-lg" : "w-16 h-16 text-2xl"
        }`}
        style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      >
        {children}
      </button>
      <span className="text-[10px] font-black uppercase tracking-widest text-white drop-shadow bg-black/50 rounded px-1.5 py-0.5">
        {label}
      </span>
    </div>
  );
}
