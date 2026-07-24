import { useEffect, useRef, useState } from "react";
import type { GameFlags } from "./game-scenes";

type Props = {
  flags: GameFlags;
  mode: "before" | "after";
  onWin?: () => void;
};

export function GameCanvas({ flags, mode, onWin }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Serialize flags + mode so parent-driven changes actually remount the game
  const key = `${mode}|${Object.entries(flags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v ? 1 : 0}`)
    .join(",")}`;

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    setError(null);

    (async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { startGame } = await import("./game-scenes");
        if (cancelled) return;
        destroy = await startGame({ canvas, flags, mode, onWin });
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

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden ring-2 ring-mn-blue/60 shadow-lg">
      <canvas
        ref={canvasRef}
        className="w-full h-auto block"
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
  );
}
