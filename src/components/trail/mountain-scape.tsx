type Variant = "hero" | "band" | "footer";

/**
 * Layered mountain silhouettes with a small trail flag and sun.
 * Purely decorative — pointer-events disabled, aria-hidden.
 */
export function MountainScape({
  variant = "hero",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  const heights: Record<Variant, string> = {
    hero: "h-40 md:h-56",
    band: "h-16 md:h-24",
    footer: "h-14 md:h-20",
  };

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none w-full ${heights[variant]} ${className}`}
    >
      <svg
        viewBox="0 0 1200 240"
        preserveAspectRatio="none"
        className="w-full h-full"
        role="presentation"
      >
        {/* faint sun */}
        {variant === "hero" && <circle cx="960" cy="70" r="42" fill="#D9A441" opacity="0.25" />}
        {/* back ridge — deep navy */}
        <path
          d="M0,180 L120,90 L220,150 L340,60 L460,140 L580,80 L720,160 L860,70 L1000,150 L1120,90 L1200,140 L1200,240 L0,240 Z"
          fill="#1F3348"
          opacity="0.35"
        />
        {/* middle ridge — forest green */}
        <path
          d="M0,210 L100,140 L240,190 L360,120 L500,180 L640,130 L780,200 L920,140 L1060,190 L1200,150 L1200,240 L0,240 Z"
          fill="#4E6B3A"
          opacity="0.55"
        />
        {/* front ridge — trail red / clay */}
        <path
          d="M0,230 L140,180 L280,220 L440,170 L600,215 L760,175 L900,220 L1060,185 L1200,215 L1200,240 L0,240 Z"
          fill="#B4432B"
          opacity="0.85"
        />
        {/* dashed trail winding up to the flag */}
        {variant === "hero" && (
          <path
            d="M 20,225 C 120,215 180,200 240,205 S 360,175 430,178 S 560,150 640,130"
            fill="none"
            stroke="#F1E4C6"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeDasharray="2 6"
            opacity="0.85"
          />
        )}
        {/* trail flag on middle ridge */}
        {variant !== "footer" && (
          <g transform="translate(640 130)">
            <line x1="0" y1="0" x2="0" y2="-22" stroke="#F1E4C6" strokeWidth="2" />
            <path d="M0,-22 L14,-17 L0,-12 Z" fill="#D9A441" />
          </g>
        )}
      </svg>
    </div>
  );
}
