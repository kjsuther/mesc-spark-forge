import { useCallback, useEffect, useRef, useState } from "react";
import type { GameFlags, WinResult } from "./game-scenes";

type Props = {
  flags: GameFlags;
  mode: "before" | "after";
  onWin?: (result: WinResult) => void;
  onLose?: () => void;
};

type TouchInput = { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean };

export function GameCanvas({ flags, mode, onWin, onLose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const key = `${mode}|${Object.entries(flags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v ? 1 : 0}`)
    .join(",")}`;

  useEffect(() => {
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
  }, [key]);

  // Fullscreen tracking
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

  // Block context menu and pull-to-refresh on the game surface
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const block = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", block);
    // Prevent gesture / pinch on iOS
    el.addEventListener("gesturestart", block as EventListener);
    return () => {
      el.removeEventListener("contextmenu", block);
      el.removeEventListener("gesturestart", block as EventListener);
    };
  }, []);

  const focusCanvas = () => canvasRef.current?.focus();

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      webkitFullscreenElement?: Element;
    };
    const anyEl = el as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      } else {
        if (anyEl.requestFullscreen) await anyEl.requestFullscreen();
        else if (anyEl.webkitRequestFullscreen) await anyEl.webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn("[game] fullscreen toggle failed", err);
    }
  }, []);

  function setBtn(k: "left" | "right", v: boolean) {
    const w = window as unknown as { __gameInput?: TouchInput };
    if (w.__gameInput) w.__gameInput[k] = v;
  }
  function jump() {
    const w = window as unknown as { __gameInput?: TouchInput };
    if (w.__gameInput) w.__gameInput.jumpReq = true;
  }
  function reset() {
    const w = window as unknown as { __gameInput?: TouchInput };
    if (w.__gameInput) w.__gameInput.resetReq = true;
  }

  const containerStyle: React.CSSProperties = isFullscreen
    ? {
        width: "100vw",
        height: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        overscrollBehavior: "contain",
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
          isFullscreen
            ? "relative bg-black overflow-hidden"
            : "relative w-full bg-black rounded-lg overflow-hidden ring-2 ring-mn-blue/60 shadow-lg"
        }
        style={
          isFullscreen
            ? { width: "min(100vw, calc(100vh * 16 / 9))", aspectRatio: "16 / 9" }
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

        {/* Fullscreen toggle overlay button */}
        <button
          type="button"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFullscreen();
          }}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute top-2 right-2 z-20 bg-black/60 text-white text-xs font-bold rounded px-2 py-1 hover:bg-black/80 touch-none"
          style={{ touchAction: "none" }}
        >
          {isFullscreen ? "✕ Exit" : "⛶ Full"}
        </button>

        {/* Touch controls — in fullscreen, overlay them at bottom of the canvas */}
        {isFullscreen && (
          <div
            className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pointer-events-none"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            <div className="flex gap-3 pointer-events-auto">
              <TouchButton aria="Move left" onDown={() => setBtn("left", true)} onUp={() => setBtn("left", false)}>◀</TouchButton>
              <TouchButton aria="Move right" onDown={() => setBtn("right", true)} onUp={() => setBtn("right", false)}>▶</TouchButton>
            </div>
            <div className="flex items-center gap-3 pointer-events-auto">
              <TouchButton aria="Restart" onDown={reset}>⟳</TouchButton>
              <TouchButton aria="Jump" onDown={jump} big>JUMP</TouchButton>
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
      {!isFullscreen && (
        <div className="mt-3 flex items-center justify-between gap-4 md:hidden select-none">
          <div className="flex gap-3">
            <TouchButton aria="Move left" onDown={() => setBtn("left", true)} onUp={() => setBtn("left", false)}>◀</TouchButton>
            <TouchButton aria="Move right" onDown={() => setBtn("right", true)} onUp={() => setBtn("right", false)}>▶</TouchButton>
          </div>
          <div className="flex items-center gap-3">
            <TouchButton aria="Restart" onDown={reset}>⟳</TouchButton>
            <TouchButton aria="Jump" onDown={jump} big>JUMP</TouchButton>
          </div>
        </div>
      )}

      {!isFullscreen && (
        <p className="mt-2 text-xs text-dark-gray/60 text-center hidden md:block">
          ← → to move · Space / ↑ to jump · R to reset · ⛶ for fullscreen
        </p>
      )}
    </div>
  );
}

function TouchButton({
  children,
  onDown,
  onUp,
  aria,
  big,
}: {
  children: React.ReactNode;
  onDown: () => void;
  onUp?: () => void;
  aria: string;
  big?: boolean;
}) {
  return (
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
  );
}
