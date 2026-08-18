import { useEffect, useState } from "react";

/**
 * Obvious attract-mode overlay for the game canvas.
 *
 * The whole surface is a tap/click target so passers-by can stop the demo and
 * start playing immediately. The top and bottom banners use chunky 16-bit
 * styling and a pulsing prompt so the indicator is impossible to miss on a
 * projection screen, desktop, or mobile device.
 */
export function DemoOverlay({ onExit }: { onExit: () => void }) {
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setBlink((b) => !b), 520);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col justify-between"
      style={{ touchAction: "manipulation" }}
      onPointerDown={(e) => {
        e.preventDefault();
        onExit();
      }}
      aria-label="Demo mode. Tap anywhere to play."
      role="button"
    >
      {/* Top banner — compact but high-contrast */}
      <div
        className="w-full border-b-4 border-accent-gold bg-mn-blue px-3 py-3 text-center text-cream shadow-[0_4px_0_#D9A44140]"
        style={{
          fontFamily: '"Press Start 2P", ui-monospace, monospace',
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
        }}
      >
        <p className="text-[11px] tracking-widest text-accent-gold sm:text-sm">
          ★ DEMO MODE ★
        </p>
        <p className="mt-1 hidden text-[8px] leading-relaxed tracking-wider text-cream/90 sm:block sm:text-[10px]">
          Press ESC, click the left joystick button, or tap the screen to play
        </p>
      </div>

      {/* Bottom CTA — large pixel-button that spans the lower safe area */}
      <div className="pointer-events-none flex w-full justify-center p-3 sm:p-4">
        <div
          className="pointer-events-auto inline-flex max-w-full flex-col items-center gap-2 rounded border-[4px] border-cream bg-accent-orange px-4 py-3 text-cream shadow-[0_6px_0_#1F3348] sm:px-6 sm:py-4"
          style={{
            fontFamily: '"Press Start 2P", ui-monospace, monospace',
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          }}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-cream sm:text-xs">
            {blink ? ">>> PLAY NOW <<<" : ">  PLAY NOW  <"}
          </span>
          <span className="text-[7px] tracking-wider text-cream/90 sm:text-[9px]">
            Tap anywhere, press ESC, or click the joystick button
          </span>
        </div>
      </div>
    </div>
  );
}
