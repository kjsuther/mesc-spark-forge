/**
 * Tiny compass rose SVG for the site header badge.
 */
export function CompassRose({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <circle cx="20" cy="20" r="18" fill="#F1E4C6" stroke="#1F3348" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="12" fill="none" stroke="#1F3348" strokeWidth="0.75" opacity="0.5" />
      {/* N/S red-navy needle */}
      <path d="M20,4 L23,20 L20,36 L17,20 Z" fill="#B4432B" />
      <path d="M20,20 L23,20 L20,36 L17,20 Z" fill="#1F3348" />
      {/* E/W bar */}
      <path d="M4,20 L20,17 L36,20 L20,23 Z" fill="#1F3348" opacity="0.75" />
      <circle cx="20" cy="20" r="2" fill="#D9A441" stroke="#1F3348" strokeWidth="0.75" />
    </svg>
  );
}
