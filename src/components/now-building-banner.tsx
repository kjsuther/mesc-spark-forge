import { useState } from "react";
import type { NowBuildingItem } from "@/lib/queries";

type Variant = "hero" | "backlog" | "tool";

export function NowBuildingBanner({
  items,
  currentSemver,
  variant,
}: {
  items: NowBuildingItem[];
  currentSemver?: string | null;
  variant: Variant;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 3);
  const hidden = items.length - visible.length;
  const isMulti = items.length > 1;

  if (variant === "hero") {
    return (
      <div className="mt-8 rounded-xl bg-white/10 backdrop-blur px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-mn-green">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-mn-green opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mn-green" />
            </span>
            Now building
            {isMulti && <span className="text-sky-blue/80">({items.length})</span>}
          </span>
          {!isMulti && <span className="text-white font-semibold">{items[0].wish}</span>}
          {currentSemver && (
            <span className="text-[11px] font-bold text-sky-blue tracking-widest uppercase">
              · v{currentSemver} live
            </span>
          )}
        </div>
        {isMulti && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {visible.map((it) => (
              <li
                key={it.id}
                className="max-w-xs truncate rounded-full bg-white/15 px-3 py-1 text-xs text-white"
                title={it.wish}
              >
                {it.wish}
              </li>
            ))}
            {hidden > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="rounded-full bg-accent-gold text-mn-blue font-bold px-3 py-1 text-xs hover:brightness-110"
                >
                  +{hidden} more
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    );
  }

  if (variant === "backlog") {
    return (
      <section className="bg-mn-blue text-white rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-sky-blue">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-mn-green opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mn-green" />
            </span>
            Now Building
            {isMulti && <span className="text-sky-blue/80">({items.length})</span>}
          </span>
        </div>
        {isMulti ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {visible.map((it) => (
              <li
                key={it.id}
                className="max-w-sm truncate rounded-full bg-white/15 px-3 py-1.5 text-sm"
                title={it.wish}
              >
                {it.wish}
              </li>
            ))}
            {hidden > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="rounded-full bg-accent-gold text-mn-blue font-bold px-3 py-1.5 text-sm hover:brightness-110"
                >
                  +{hidden} more
                </button>
              </li>
            )}
          </ul>
        ) : (
          <h2 className="text-xl font-bold mt-2">{items[0].wish}</h2>
        )}
      </section>
    );
  }

  // tool
  return (
    <div className="mb-8 rounded-xl border border-mn-green/30 bg-mn-green/5 p-4">
      <div className="flex flex-wrap gap-3 items-center">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-mn-green">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-mn-green opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-mn-green" />
          </span>
          Now building
          {isMulti && <span className="text-mn-green/70">({items.length})</span>}
        </span>
        {!isMulti && <span className="text-sm font-medium text-mn-blue">{items[0].wish}</span>}
        {currentSemver && (
          <span className="ml-auto text-[10px] font-bold text-dark-gray/60 tracking-widest uppercase">
            v{currentSemver} live
          </span>
        )}
      </div>
      {isMulti && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {visible.map((it) => (
            <li
              key={it.id}
              className="max-w-xs truncate rounded-full bg-mn-blue/10 text-mn-blue px-3 py-1 text-xs"
              title={it.wish}
            >
              {it.wish}
            </li>
          ))}
          {hidden > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="rounded-full bg-accent-gold text-mn-blue font-bold px-3 py-1 text-xs hover:brightness-110"
              >
                +{hidden} more
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
