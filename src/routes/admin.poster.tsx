import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  feedbackListQuery,
  votesListQuery,
  nowBuildingQuery,
  versionsQuery,
  type Feedback,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/poster")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(feedbackListQuery);
    context.queryClient.ensureQueryData(votesListQuery);
    context.queryClient.ensureQueryData(nowBuildingQuery);
    context.queryClient.ensureQueryData(versionsQuery);
  },
  component: PosterView,
});

const BUCKET_WEIGHT = { must: 3, should: 2, could: 1 } as const;

function PosterView() {
  const { data: feedback } = useSuspenseQuery(feedbackListQuery);
  const { data: votes } = useSuspenseQuery(votesListQuery);
  const { data: nowBuilding } = useSuspenseQuery(nowBuildingQuery);
  const { data: versions } = useSuspenseQuery(versionsQuery);
  const qc = useQueryClient();

  // 5-second refresh
  useEffect(() => {
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["feedback"] });
      qc.invalidateQueries({ queryKey: ["votes"] });
      qc.invalidateQueries({ queryKey: ["now_building"] });
      qc.invalidateQueries({ queryKey: ["versions"] });
    }, 5000);
    return () => clearInterval(id);
  }, [qc]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-poster")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, () => {
        qc.invalidateQueries({ queryKey: ["feedback"] });
        qc.invalidateQueries({ queryKey: ["now_building"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () =>
        qc.invalidateQueries({ queryKey: ["votes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const weighted = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of votes) {
      m.set(v.feedback_id, (m.get(v.feedback_id) ?? 0) + (BUCKET_WEIGHT[v.bucket] ?? 1));
    }
    return m;
  }, [votes]);

  const activeIds = useMemo(() => new Set(nowBuilding.map((n) => n.id)), [nowBuilding]);

  const queue = useMemo(() => {
    return [...feedback]
      .filter((f: Feedback) => (f.status === "planned" || f.status === "new") && !activeIds.has(f.id))
      .sort((a, b) => (weighted.get(b.id) ?? 0) - (weighted.get(a.id) ?? 0))
      .slice(0, 5);
  }, [feedback, weighted, activeIds]);

  const buildingItems = useMemo(() => {
    return nowBuilding.map((nb) => {
      const full = feedback.find((f) => f.id === nb.id);
      return {
        id: nb.id,
        wish: nb.wish,
        weighted: weighted.get(nb.id) ?? 0,
        role: full?.role ?? null,
        state: full?.state ?? null,
      };
    });
  }, [nowBuilding, feedback, weighted]);

  const shipped = feedback.filter((f) => f.status === "shipped").length;
  const totalIdeas = feedback.length;
  const totalVotes = votes.length;
  const current = versions.find((v) => v.is_current) ?? versions[versions.length - 1];

  return (
    <div className="fixed inset-0 bg-mn-blue text-white flex flex-col">
      {/* Top bar with back-link */}
      <div className="flex items-center justify-between px-6 py-2 bg-dark-gray text-cream border-b-2 border-accent-orange/60">
        <span className="font-display uppercase tracking-widest text-sm">
          ★ Blazing Better Trails · Live Poster Board ★
        </span>
        <a
          href="/admin"
          className="text-[11px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded"
        >
          ← Exit poster view
        </a>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-3 p-3 min-h-0">
        {/* LEFT: live tool */}
        <section className="rounded-xl overflow-hidden border-2 border-accent-orange/70 bg-cream flex flex-col min-h-0">
          <header className="bg-accent-orange text-white px-4 py-2 flex items-center justify-between border-b-2 border-accent-gold/60">
            <div className="min-w-0">
              <div className="font-display uppercase tracking-widest text-sm leading-tight">
                ★ Live Demo — Trail to Coverage
              </div>
              <div className="text-[10px] uppercase tracking-widest text-cream/85 mt-0.5">
                Vote below → improvements apply live to the trail
              </div>
            </div>
            <a
              href="/tool"
              target="_blank"
              rel="noopener"
              className="text-[10px] font-bold uppercase tracking-widest bg-white/15 hover:bg-white/25 px-2 py-1 rounded shrink-0"
            >
              Open ↗
            </a>
          </header>

          <iframe
            src="/tool?embed=1"
            title="Live Demo Client Tool"
            className="w-full flex-1 bg-white"
          />

        </section>

        {/* RIGHT: status board */}
        <aside className="flex flex-col gap-3 min-h-0">
          {/* Now building */}
          <section className="rounded-xl overflow-hidden border-2 border-accent-gold/60 bg-mn-blue/40 flex flex-col min-h-0 flex-1">
            <header className="bg-mn-green text-white px-4 py-2 border-b-2 border-accent-gold/60">
              <span className="font-display uppercase tracking-widest text-sm">
                ★ What we&apos;re building now
              </span>
            </header>

            <div className="grid grid-cols-3 gap-2 p-3 border-b border-white/10 text-center">
              <Stat label="Shipped" value={shipped} accent="text-accent-gold" />
              <Stat label="Ideas" value={totalIdeas} accent="text-cream" />
              <Stat label="Votes" value={totalVotes} accent="text-accent-teal" />
            </div>

            <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-cream/70 flex justify-between">
              <span>● Live · in progress</span>
              <span>{current ? `v${current.semver}` : "—"}</span>
            </div>

            <ul className="flex-1 overflow-auto px-3 pb-3 space-y-2">
              {buildingItems.length === 0 && (
                <li className="text-cream/60 italic text-sm text-center py-8">
                  Nothing in progress right now.
                </li>
              )}
              {buildingItems.map((item, idx) => (
                <li
                  key={item.id}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 flex items-start gap-2"
                >
                  <span className="text-[10px] font-black bg-accent-gold text-mn-blue rounded px-1.5 py-0.5 tabular-nums shrink-0 mt-0.5">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-cream leading-snug line-clamp-3">
                      {item.wish}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-cream/60 mt-1">
                      {[item.role, item.state].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-mn-green bg-white/90 rounded px-1.5 py-0.5 shrink-0 uppercase">
                    Building
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* In queue */}
          <section className="rounded-xl overflow-hidden border-2 border-accent-orange/70 bg-dark-gray/60 flex flex-col min-h-0 flex-1">
            <header className="bg-accent-orange text-white px-4 py-2 flex items-center justify-between border-b-2 border-accent-gold/60">
              <span className="font-display uppercase tracking-widest text-sm">
                ★ In queue
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white/15 rounded px-2 py-0.5">
                {queue.length} ideas
              </span>
            </header>
            <ul className="flex-1 overflow-auto p-3 space-y-2">
              {queue.length === 0 && (
                <li className="text-cream/60 italic text-sm text-center py-8">
                  Queue empty — add ideas from Feedback triage.
                </li>
              )}
              {queue.map((item, idx) => (
                <li
                  key={item.id}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 flex items-center gap-2"
                >
                  <span className="text-[11px] font-black bg-accent-gold text-mn-blue rounded w-6 h-6 grid place-items-center tabular-nums shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-cream leading-snug line-clamp-2 font-semibold">
                      {item.wish}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-cream/60 mt-0.5">
                      {item.status === "planned" ? "Planned" : "New"}
                    </p>
                  </div>
                  <span className="text-lg font-black text-cream tabular-nums shrink-0">
                    {weighted.get(item.id) ?? 0}
                  </span>
                </li>
              ))}
            </ul>
            <footer className="text-center text-[10px] font-bold uppercase tracking-widest text-cream/60 py-2 border-t border-white/10">
              — More ideas welcome →
            </footer>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div>
      <div className={`text-2xl font-black tabular-nums ${accent}`}>{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-cream/70">
        {label}
      </div>
    </div>
  );
}
