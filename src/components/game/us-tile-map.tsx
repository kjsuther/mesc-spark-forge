import { useState } from "react";
import { US_STATES } from "@/lib/feedback-options";

/**
 * Compact self-contained tile map of the US (classic grid layout, no external
 * map library). Each state is a square shaded by how much feedback came from it.
 */
const GRID: Record<string, [col: number, row: number]> = {
  AK: [0, 0],
  ME: [11, 0],
  VT: [10, 1],
  NH: [11, 1],
  WA: [1, 1],
  ID: [2, 1],
  MT: [3, 1],
  ND: [4, 1],
  MN: [5, 1],
  IL: [6, 1],
  WI: [7, 1],
  MI: [8, 1],
  NY: [9, 1],
  MA: [10, 2],
  RI: [11, 2],
  OR: [1, 2],
  NV: [2, 2],
  WY: [3, 2],
  SD: [4, 2],
  IA: [5, 2],
  IN: [6, 2],
  OH: [7, 2],
  PA: [8, 2],
  NJ: [9, 2],
  CT: [10, 3],
  CA: [1, 3],
  UT: [2, 3],
  CO: [3, 3],
  NE: [4, 3],
  MO: [5, 3],
  KY: [6, 3],
  WV: [7, 3],
  VA: [8, 3],
  MD: [9, 3],
  DE: [10, 4],
  AZ: [2, 4],
  NM: [3, 4],
  KS: [4, 4],
  AR: [5, 4],
  TN: [6, 4],
  NC: [7, 4],
  SC: [8, 4],
  DC: [9, 4],
  OK: [4, 5],
  LA: [5, 5],
  MS: [6, 5],
  AL: [7, 5],
  GA: [8, 5],
  HI: [1, 6],
  TX: [4, 6],
  FL: [9, 6],
  PR: [11, 6],
  VI: [12, 6],
  GU: [0, 6],
};

const CELL = 34;
const GAP = 3;

export function UsTileMap({ counts }: { counts: Record<string, number> }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...Object.values(counts));
  const cols = 13;
  const rows = 7;

  return (
    <div>
      <svg
        viewBox={`0 0 ${cols * (CELL + GAP)} ${rows * (CELL + GAP)}`}
        className="w-full max-w-2xl"
        role="img"
        aria-label="Map of US states feedback came from"
      >
        {US_STATES.map(({ code, name }) => {
          const pos = GRID[code];
          if (!pos) return null;
          const [c, r] = pos;
          const n = counts[name] ?? 0;
          const intensity = n === 0 ? 0 : 0.25 + (n / max) * 0.75;
          return (
            <g
              key={code}
              onMouseEnter={() => setHover(code)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(code)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(code)}
              tabIndex={0}
              className="cursor-pointer outline-none"
            >
              <title>{`${name}: ${n} ${n === 1 ? "item" : "items"}`}</title>
              <rect
                x={c * (CELL + GAP)}
                y={r * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={4}
                className={
                  n === 0
                    ? "fill-light-gray stroke-mn-blue/15"
                    : "fill-mn-blue stroke-mn-blue/40"
                }
                style={n > 0 ? { fillOpacity: intensity } : undefined}
                strokeWidth={hover === code ? 2 : 1}
              />
              <text
                x={c * (CELL + GAP) + CELL / 2}
                y={r * (CELL + GAP) + CELL / 2 + 4}
                textAnchor="middle"
                className={`text-[11px] font-bold ${
                  n > 0 && intensity > 0.55 ? "fill-white" : "fill-dark-gray/70"
                }`}
              >
                {code}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-dark-gray/70">
        {hover
          ? `${US_STATES.find((s) => s.code === hover)?.name}: ${
              counts[US_STATES.find((s) => s.code === hover)?.name ?? ""] ?? 0
            } feedback item(s)`
          : "Hover or tap a state to see its feedback count. Darker = more feedback."}
      </p>
    </div>
  );
}
