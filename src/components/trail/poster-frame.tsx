import type { ReactNode } from "react";

type Tone = "navy" | "red" | "gold" | "green";

const TONES: Record<Tone, { bar: string; text: string; ring: string }> = {
  navy: { bar: "bg-mn-blue", text: "text-cream", ring: "ring-mn-blue/40" },
  red: { bar: "bg-accent-orange", text: "text-cream", ring: "ring-accent-orange/40" },
  gold: { bar: "bg-accent-gold", text: "text-mn-blue", ring: "ring-accent-gold/50" },
  green: { bar: "bg-mn-green", text: "text-cream", ring: "ring-mn-green/40" },
};

/**
 * Poster-style panel: outer border + inset "double-line" feel, star corners,
 * and an optional colored header bar. Inspired by the poster's paneling.
 */
export function PosterFrame({
  title,
  tone = "navy",
  children,
  className = "",
  eyebrow,
}: {
  title?: string;
  tone?: Tone;
  children: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section
      className={`relative rounded-lg bg-cream/60 border-2 border-mn-blue/70 shadow-[0_1px_0_0_rgba(31,51,72,0.15)] ${className}`}
    >
      {/* inner hairline to get the double-border poster feel */}
      <div className="pointer-events-none absolute inset-1 rounded-md border border-mn-blue/25" />

      {/* star corner glyphs */}
      <StarGlyph className="absolute -top-2 -left-2" />
      <StarGlyph className="absolute -top-2 -right-2" />
      <StarGlyph className="absolute -bottom-2 -left-2" />
      <StarGlyph className="absolute -bottom-2 -right-2" />

      {title && (
        <header
          className={`relative rounded-t-md ${t.bar} ${t.text} px-5 py-2 flex items-center gap-3`}
        >
          <span aria-hidden="true">★</span>
          <h2 className="font-display uppercase tracking-widest text-sm md:text-base flex-1">
            {title}
          </h2>
          {eyebrow}
          <span aria-hidden="true">★</span>
        </header>
      )}

      <div className="relative p-5 md:p-6">{children}</div>
    </section>
  );
}

function StarGlyph({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`h-4 w-4 grid place-items-center rounded-full bg-cream text-accent-orange text-[10px] font-black shadow ring-1 ring-mn-blue/40 ${className}`}
    >
      ★
    </span>
  );
}
