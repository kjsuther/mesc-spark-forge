import { Compass, Map as MapIcon, Flag, Mountain } from "lucide-react";

type Milestone = {
  label: string;
  sub?: string;
};

const ICONS = [Compass, MapIcon, Mountain, Flag] as const;

/**
 * Dashed red curved trail with numbered pins — inspired by the poster's
 * "Practical Path Forward" curve. Purely presentational; parent supplies data.
 */
export function TrailPath({
  milestones,
  className = "",
}: {
  milestones: Milestone[];
  className?: string;
}) {
  const n = milestones.length;
  // Evenly space along a curve
  const points = milestones.map((_, i) => {
    const x = 80 + (i * (1040 / Math.max(1, n - 1)));
    // sine-like rise so it feels like ascending a trail
    const y = 200 - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 90;
    return { x, y };
  });

  const pathD = points
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(" ");

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <svg
          viewBox="0 0 1200 260"
          preserveAspectRatio="none"
          className="w-full h-40 md:h-56 motion-reduce:[--dash-anim:none]"
          aria-hidden="true"
        >
          {/* soft mountains behind trail */}
          <path
            d="M0,230 L200,170 L400,220 L620,150 L820,220 L1000,170 L1200,210 L1200,260 L0,260 Z"
            fill="#4E6B3A"
            opacity="0.15"
          />
          {/* dashed trail */}
          <path
            d={pathD}
            fill="none"
            stroke="#B4432B"
            strokeWidth="4"
            strokeDasharray="10 8"
            strokeLinecap="round"
          />
          {/* pin dots */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="14" fill="#1F3348" />
              <circle cx={p.x} cy={p.y} r="14" fill="none" stroke="#F1E4C6" strokeWidth="2" />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill="#F1E4C6"
                fontFamily="Inter, sans-serif"
              >
                {i + 1}
              </text>
            </g>
          ))}
        </svg>

        {/* Labels below pins, absolutely positioned in a flex row for a11y text */}
        <div className="hidden md:flex justify-between px-6 -mt-2">
          {milestones.map((m, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div key={i} className="flex flex-col items-center text-center w-32">
                <Icon className="h-4 w-4 text-mn-blue mb-1" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider text-mn-blue leading-tight">
                  {m.label}
                </span>
                {m.sub && (
                  <span className="text-[10px] text-dark-gray/60 mt-0.5">{m.sub}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: stacked list under the SVG */}
      <ol className="md:hidden mt-4 space-y-2">
        {milestones.map((m, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span className="w-7 h-7 rounded-full bg-mn-blue text-cream grid place-items-center font-bold text-xs shrink-0">
                {i + 1}
              </span>
              <Icon className="h-4 w-4 text-accent-orange shrink-0" aria-hidden="true" />
              <span className="font-semibold text-mn-blue">{m.label}</span>
              {m.sub && <span className="text-dark-gray/60 text-xs">· {m.sub}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
