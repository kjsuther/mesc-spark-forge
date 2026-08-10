import { useState } from "react";
import { US_STATE_SHAPES } from "@/lib/us-states-geo";

/**
 * Real geographic map of the United States. Each state is shaded by how much
 * feedback came from it and labeled with that count.
 */
export function UsTileMap({ counts }: { counts: Record<string, number> }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...Object.values(counts));
  const hoverCount = hover ? (counts[hover] ?? 0) : 0;

  return (
    <div>
      <svg
        viewBox="0 0 960 600"
        className="w-full"
        role="img"
        aria-label="Map of the United States shaded by how much feedback came from each state"
      >
        {US_STATE_SHAPES.map(({ name, d }) => {
          const n = counts[name] ?? 0;
          const intensity = n === 0 ? 0 : 0.3 + (n / max) * 0.7;
          return (
            <path
              key={name}
              d={d}
              tabIndex={0}
              onMouseEnter={() => setHover(name)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(name)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(name)}
              className={`cursor-pointer outline-none ${
                n === 0 ? "fill-light-gray stroke-mn-blue/25" : "fill-mn-blue stroke-mn-blue/60"
              }`}
              style={n > 0 ? { fillOpacity: intensity } : undefined}
              strokeWidth={hover === name ? 2.5 : 1}
            >
              <title>{`${name}: ${n} ${n === 1 ? "item" : "items"}`}</title>
            </path>
          );
        })}

        {US_STATE_SHAPES.map(({ name, cx, cy }) => {
          const n = counts[name] ?? 0;
          if (n === 0) return null;
          const intensity = 0.3 + (n / max) * 0.7;
          return (
            <g key={`label-${name}`} pointerEvents="none">
              <circle cx={cx} cy={cy} r={14} className="fill-white" opacity={0.85} />
              <text
                x={cx}
                y={cy + 6}
                textAnchor="middle"
                className="fill-mn-blue text-[18px] font-bold"
                style={{ fillOpacity: Math.max(0.85, intensity) }}
              >
                {n}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-dark-gray/70">
        {hover
          ? `${hover}: ${hoverCount} feedback item(s)`
          : "Numbers show how many feedback items came from each state. Darker = more feedback. Hover or tap a state for details."}
      </p>
    </div>
  );
}
