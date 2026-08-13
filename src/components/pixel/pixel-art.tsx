/**
 * Small decorative 16-bit style SVG sprites drawn from a chunky pixel grid.
 * All purely decorative: aria-hidden, pointer-events disabled by the parent.
 */

type SpriteProps = { className?: string; title?: string };

const CREAM = "#F1E4C6";
const NAVY = "#1F3348";
const GOLD = "#D9A441";
const CLAY = "#B4432B";
const GREEN = "#4E6B3A";
const SKY = "#3D6B78";

function Px({
  x,
  y,
  fill,
  w = 1,
  h = 1,
}: {
  x: number;
  y: number;
  fill: string;
  w?: number;
  h?: number;
}) {
  return <rect x={x} y={y} width={w} height={h} fill={fill} shapeRendering="crispEdges" />;
}

/** Pixel coin / power-up token. */
export function PixelCoin({ className = "" }: SpriteProps) {
  return (
    <svg viewBox="0 0 8 8" className={className} aria-hidden="true" role="presentation">
      <Px x={2} y={0} w={4} h={1} fill={GOLD} />
      <Px x={1} y={1} w={6} h={6} fill={GOLD} />
      <Px x={2} y={7} w={4} h={1} fill={GOLD} />
      <Px x={3} y={2} w={2} h={4} fill={CREAM} />
      <Px x={2} y={1} w={1} h={1} fill={CREAM} />
    </svg>
  );
}

/** Pixel question block (the "idea" block). */
export function PixelBlock({ className = "" }: SpriteProps) {
  return (
    <svg viewBox="0 0 8 8" className={className} aria-hidden="true" role="presentation">
      <Px x={0} y={0} w={8} h={8} fill={CLAY} />
      <Px x={1} y={1} w={6} h={6} fill={GOLD} />
      <Px x={3} y={2} w={2} h={1} fill={NAVY} />
      <Px x={4} y={3} w={1} h={1} fill={NAVY} />
      <Px x={3} y={4} w={1} h={1} fill={NAVY} />
      <Px x={3} y={6} w={1} h={1} fill={NAVY} />
    </svg>
  );
}

/** Pixel CRT computer — the "build it" element. */
export function PixelMonitor({ className = "" }: SpriteProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true" role="presentation">
      <Px x={0} y={1} w={12} h={8} fill={NAVY} />
      <Px x={1} y={2} w={10} h={6} fill={SKY} />
      <Px x={2} y={3} w={5} h={1} fill={CREAM} />
      <Px x={2} y={5} w={7} h={1} fill={CREAM} />
      <Px x={2} y={6} w={3} h={1} fill={GOLD} />
      <Px x={5} y={9} w={2} h={2} fill={NAVY} />
      <Px x={3} y={11} w={6} h={1} fill={NAVY} />
    </svg>
  );
}

/** Pixel speech bubble — the "feedback" element. */
export function PixelBubble({ className = "" }: SpriteProps) {
  return (
    <svg viewBox="0 0 12 10" className={className} aria-hidden="true" role="presentation">
      <Px x={0} y={0} w={12} h={7} fill={CREAM} />
      <Px x={2} y={7} w={3} h={2} fill={CREAM} />
      <Px x={2} y={2} w={8} h={1} fill={NAVY} />
      <Px x={2} y={4} w={6} h={1} fill={NAVY} />
    </svg>
  );
}

/** Pixel trail flag — the "outcome" element. */
export function PixelFlag({ className = "" }: SpriteProps) {
  return (
    <svg viewBox="0 0 10 12" className={className} aria-hidden="true" role="presentation">
      <Px x={2} y={0} w={1} h={12} fill={CREAM} />
      <Px x={3} y={1} w={5} h={4} fill={GREEN} />
      <Px x={3} y={2} w={3} h={2} fill={GOLD} />
      <Px x={0} y={11} w={6} h={1} fill={NAVY} />
    </svg>
  );
}

/**
 * A wide pixel-art "level strip": ground blocks, brick platforms, coins,
 * a flag, and a distant skyline. Used as a quiet band between sections.
 */
export function PixelLevelStrip({ className = "" }: SpriteProps) {
  return (
    <div aria-hidden="true" className={`pointer-events-none select-none w-full ${className}`}>
      <svg
        viewBox="0 0 160 40"
        preserveAspectRatio="none"
        className="w-full h-full"
        role="presentation"
      >
        {/* skyline */}
        <g opacity="0.35">
          <Px x={6} y={18} w={8} h={14} fill={NAVY} />
          <Px x={18} y={12} w={6} h={20} fill={NAVY} />
          <Px x={28} y={22} w={10} h={10} fill={NAVY} />
          <Px x={104} y={16} w={7} h={16} fill={NAVY} />
          <Px x={116} y={21} w={11} h={11} fill={NAVY} />
          <Px x={134} y={14} w={6} h={18} fill={NAVY} />
        </g>
        {/* floating platforms */}
        <g opacity="0.55">
          <Px x={44} y={16} w={12} h={3} fill={CLAY} />
          <Px x={70} y={11} w={12} h={3} fill={CLAY} />
          <Px x={96} y={17} w={12} h={3} fill={CLAY} />
        </g>
        {/* coins */}
        <g opacity="0.85">
          <Px x={49} y={11} w={2} h={2} fill={GOLD} />
          <Px x={75} y={6} w={2} h={2} fill={GOLD} />
          <Px x={101} y={12} w={2} h={2} fill={GOLD} />
        </g>
        {/* flag */}
        <Px x={144} y={18} w={1} h={14} fill={CREAM} />
        <Px x={145} y={19} w={5} h={4} fill={GOLD} />
        {/* ground */}
        <Px x={0} y={32} w={160} h={8} fill={GREEN} />
        <g opacity="0.5">
          {Array.from({ length: 20 }, (_, i) => (
            <Px key={i} x={i * 8} y={32} w={4} h={2} fill={NAVY} />
          ))}
        </g>
      </svg>
    </div>
  );
}
