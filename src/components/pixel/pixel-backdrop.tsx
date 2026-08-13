import { PixelCoin, PixelBlock, PixelMonitor, PixelBubble, PixelFlag } from "./pixel-art";

/**
 * Site-wide decorative 16-bit backdrop.
 *
 * Fixed behind all content at low opacity: a chunky pixel grid, a few
 * floating game props, and a pixel ground line. Purely decorative and
 * never interactive, so page text keeps full contrast.
 */
export function PixelBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* chunky pixel grid */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(31,51,72,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(31,51,72,0.05) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      {/* floating props — hidden on small screens to keep mobile clean */}
      <div className="hidden md:block">
        <PixelBlock className="absolute left-[3%] top-[18%] w-10 opacity-[0.13]" />
        <PixelCoin className="absolute left-[8%] top-[46%] w-6 opacity-[0.15]" />
        <PixelMonitor className="absolute right-[4%] top-[26%] w-14 opacity-[0.12]" />
        <PixelBubble className="absolute right-[9%] top-[58%] w-12 opacity-[0.12]" />
        <PixelFlag className="absolute left-[6%] bottom-[16%] w-8 opacity-[0.13]" />
        <PixelCoin className="absolute right-[6%] bottom-[22%] w-6 opacity-[0.15]" />
      </div>

      {/* pixel ground strip pinned to the bottom of the viewport */}
      <div
        className="absolute inset-x-0 bottom-0 h-4 opacity-[0.1]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, #1F3348 0 8px, transparent 8px 16px)",
          backgroundSize: "16px 8px",
          backgroundRepeat: "repeat-x",
          backgroundPosition: "bottom",
        }}
      />
    </div>
  );
}
