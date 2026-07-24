import { useEffect, useRef, useState } from "react";
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
  // Serialize flags + mode so parent-driven changes actually remount the game
  const key = `${mode}|${Object.entries(flags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v ? 1 : 0}`)
    .join(",")}`;

  useEffect(() => {
    // Global input state read by the kaplay scene
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

  // Focus canvas on tap so keyboard works after touch
  const focusCanvas = () => canvasRef.current?.focus();

  function setBtn(k: "left" | "right", v: boolean) {
    const w = window as unknown as { __gameInput?: TouchInput };
    if (w.__gameInput) w.__gameInput[k] = v;
  }
  function jump() {
    const w = window as unknown as { __gameInput?: TouchInput };
    if (w.__gameInput) w.__gameInput.jumpReq = true;
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative w-full bg-black rounded-lg overflow-hidden ring-2 ring-mn-blue/60 shadow-lg">
        <canvas
          ref={canvasRef}
          onPointerDown={focusCanvas}
          className="w-full h-auto block touch-none select-none"
          style={{ aspectRatio: "16 / 9", imageRendering: "pixelated" }}
          tabIndex={0}
          aria-label="Blazing the Trail to Coverage game"
        />
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 text-white p-6 text-center">
            <div>
              <p className="font-bold mb-2">Game failed to load</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Touch controls — visible on mobile/tablet, ignored on desktop-with-mouse */}
      <div className="mt-3 flex items-center justify-between gap-4 md:hidden select-none">
        <div className="flex gap-3">
          <TouchButton
            aria="Move left"
            onDown={() => setBtn("left", true)}
            onUp={() => setBtn("left", false)}
          >
            ◀
          </TouchButton>
          <TouchButton
            aria="Move right"
            onDown={() => setBtn("right", true)}
            onUp={() => setBtn("right", false)}
          >
            ▶
          </TouchButton>
        </div>
        <TouchButton aria="Jump" onDown={jump} big>
          JUMP
        </TouchButton>
      </div>
      <p className="mt-2 text-xs text-dark-gray/60 text-center hidden md:block">
        ← → to move · Space / ↑ to jump · R to reset
      </p>
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
        onDown();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        onUp?.();
      }}
      onPointerLeave={() => onUp?.()}
      onPointerCancel={() => onUp?.()}
      className={`bg-mn-blue text-white font-black rounded-full active:brightness-125 shadow-lg touch-none ${
        big ? "w-24 h-24 text-lg" : "w-16 h-16 text-2xl"
      }`}
    >
      {children}
    </button>
  );
}
