import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { gameFeedbackQuery, summarizeFeedback } from "@/lib/feedback.queries";
import { UsTileMap } from "./us-tile-map";

/** Live mini-dashboard shown above the backlog list. */
export function FeedbackStats() {
  const { data: rows = [] } = useQuery(gameFeedbackQuery);
  const s = summarizeFeedback(rows);
  const [openRoles, setOpenRoles] = useState(false);
  const [openMap, setOpenMap] = useState(false);

  return (
    <section className="rounded-lg border-2 border-mn-blue/30 bg-cream p-4 sm:p-5">
      <h2 className="font-display text-xl uppercase tracking-wide text-mn-blue">
        Feedback at a glance
      </h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat label="Feedback received" value={s.total} tone="blue" />
        <Stat label="Implemented" value={s.implemented} tone="green" />
        <Stat label="States & countries" value={s.placesRepresented} tone="orange" />
      </div>

      <div className="mt-4 space-y-2">
        <Toggle
          open={openRoles}
          onToggle={() => setOpenRoles((v) => !v)}
          label={`Roles who contributed (${s.roles.length})`}
        >
          {s.roles.length === 0 ? (
            <p className="text-sm text-dark-gray/60">No roles recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {s.roles.map(([role, count]) => {
                const max = s.roles[0]?.[1] ?? 1;
                return (
                  <li key={role} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-dark-gray">{role}</span>
                      <span className="tabular-nums text-dark-gray/70">{count}</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded bg-mn-blue/10">
                      <div
                        className="h-2 rounded bg-mn-blue"
                        style={{ width: `${Math.max(6, (count / max) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Toggle>

        <Toggle
          open={openMap}
          onToggle={() => setOpenMap((v) => !v)}
          label="Where feedback came from"
        >
          <UsTileMap counts={s.states} />
          {s.countries.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-mn-blue">
                Outside the US
              </p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {s.countries.map(([c, n]) => (
                  <li
                    key={c}
                    className="rounded border border-mn-blue/30 bg-white px-2 py-1 text-xs text-dark-gray"
                  >
                    {c} · {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Toggle>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "orange";
}) {
  const bg =
    tone === "blue" ? "bg-mn-blue" : tone === "green" ? "bg-mn-green" : "bg-accent-orange";
  return (
    <div className={`rounded-lg ${bg} px-4 py-3 text-white`}>
      <div className="font-display text-3xl tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-white/85">
        {label}
      </div>
    </div>
  );
}

function Toggle({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-mn-blue/25 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-bold uppercase tracking-wide text-mn-blue hover:bg-cream"
      >
        {label}
        <span aria-hidden className="text-base">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="border-t border-light-gray px-4 py-4">{children}</div>}
    </div>
  );
}
