import type { ReactNode } from "react";

/**
 * Star-flanked uppercase display heading with dashed underline.
 * Inspired by the poster's section headers.
 */
export function SectionHeading({
  children,
  icon,
  align = "left",
  as: Tag = "h2",
  className = "",
}: {
  children: ReactNode;
  icon?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={`${align === "center" ? "text-center" : "text-left"} ${className}`}>
      <Tag className="font-display uppercase tracking-wider text-mn-blue text-2xl md:text-3xl inline-flex items-center gap-3">
        <span aria-hidden="true" className="text-accent-orange">★</span>
        {icon && <span aria-hidden="true" className="text-mn-green">{icon}</span>}
        <span>{children}</span>
        <span aria-hidden="true" className="text-accent-orange">★</span>
      </Tag>
      <div
        aria-hidden="true"
        className={`mt-2 h-0 border-t-[3px] border-dashed border-accent-orange/60 w-24 ${
          align === "center" ? "mx-auto" : ""
        }`}
      />
    </div>
  );
}
