import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Leaderboard } from "@/components/game/leaderboard";
import { BuildTheater } from "@/components/build-theater";
import { activeRoundQuery, improvementsQuery } from "@/lib/game.queries";

export const Route = createFileRoute("/admin/poster")({
  head: () => ({
    meta: [
      { title: "Poster View — Blazing the Trail" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(activeRoundQuery);
    context.queryClient.ensureQueryData(improvementsQuery);
  },
  component: PosterView,
});

function fmtCountdown(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function useCountdown(endsAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return 0;
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
}

function PosterView() {
  const qc = useQueryClient();
  const { data: round } = useQuery(activeRoundQuery);
  const { data: improvements = [] } = useQuery(improvementsQuery);

  useEffect(() => {
    const channel = supabase
      .channel("admin-poster-game")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_vote_rounds" }, () =>
        qc.invalidateQueries({ queryKey: ["game_round"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_improvement_votes" },
        () => qc.invalidateQueries({ queryKey: ["game_round"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "game_improvements" }, () =>
        qc.invalidateQueries({ queryKey: ["game_improvements"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const secondsLeft = useCountdown(round?.endsAt ?? null);
  const totalVotes = useMemo(
    () => (round?.candidates ?? []).reduce((n, c) => n + c.votes, 0),
    [round],
  );
  const rankedCandidates = useMemo(() => {
    return [...(round?.candidates ?? [])].sort((a, b) => b.votes - a.votes);
  }, [round]);
  const appliedList = useMemo(() => improvements.filter((i) => i.enabled), [improvements]);

  return (
    <div className="min-h-screen bg-mn-blue text-cream flex flex-col">
      <header className="px-6 py-3 border-b-2 border-accent-orange/70 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-accent-gold">
            ★ MESC 2026 · Live Poster ★
          </div>
          <h1 className="font-display uppercase tracking-widest text-xl md:text-2xl">
            Blazing the Trail to Coverage
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-xs uppercase tracking-widest">
            <div className="text-cream/60">Upgrades applied</div>
            <div className="text-accent-gold font-black text-lg tabular-nums">
              {appliedList.length}
            </div>
          </div>
          <Link
            to="/admin/game"
            className="inline-flex items-center gap-2 rounded border-2 border-cream/40 bg-cream/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-cream hover:bg-cream/20"
          >
            ✕ Exit Poster
          </Link>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)] gap-3 p-3 min-h-0">
        {/* Live game */}
        <section className="rounded-lg overflow-hidden bg-black ring-2 ring-accent-gold/60 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            <iframe
              src="/embed"
              title="Live game"
              className="w-full h-full block bg-black"
              allow="autoplay; fullscreen"
            />
          </div>
        </section>


        {/* Sidebar: leaderboard + votes */}
        <aside className="grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 min-h-0">
          <div className="rounded-lg bg-mn-blue/40 ring-2 ring-accent-gold/50 overflow-hidden min-h-0">
            <Leaderboard variant="poster" />
          </div>

          <div className="rounded-lg bg-mn-blue/40 ring-2 ring-accent-gold/50 overflow-hidden flex flex-col min-h-0">
            <header className="bg-accent-orange text-white px-4 py-2 border-b-2 border-accent-gold/60 flex items-center justify-between gap-2">
              <span className="font-display uppercase tracking-widest text-sm">
                ★ Next upgrade · Live vote
              </span>
              {round && secondsLeft > 0 ? (
                <span className="text-[11px] font-black bg-white/15 rounded px-2 py-0.5 tabular-nums">
                  {fmtCountdown(secondsLeft)}
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-widest text-cream/70">
                  Idle
                </span>
              )}
            </header>
            <div className="flex-1 overflow-auto p-2 min-h-0">
              {round && rankedCandidates.length > 0 ? (
                <ol className="space-y-1.5">
                  {rankedCandidates.map((c, i) => {
                    const pct = totalVotes ? Math.round((c.votes / totalVotes) * 100) : 0;
                    return (
                      <li
                        key={c.key}
                        className="relative bg-white/5 border border-white/10 rounded overflow-hidden"
                      >
                        <div
                          className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${
                            i === 0 ? "bg-accent-gold/25" : "bg-white/10"
                          }`}
                          style={{ width: `${pct}%` }}
                          aria-hidden="true"
                        />
                        <div className="relative flex items-center gap-2 px-2 py-1.5">
                          <span
                            className={`w-6 h-6 grid place-items-center rounded text-[11px] font-black shrink-0 ${
                              i === 0
                                ? "bg-accent-gold text-mn-blue"
                                : i < 3
                                  ? "bg-accent-orange text-white"
                                  : "bg-white/15 text-cream"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="flex-1 min-w-0 truncate font-bold text-cream text-sm">
                            {c.label}
                          </span>
                          <span className="text-accent-gold font-black tabular-nums shrink-0 text-sm">
                            {c.votes}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="h-full grid place-items-center text-center text-cream/70 text-sm p-6">
                  <div>
                    <div className="font-display uppercase tracking-widest text-accent-gold text-xs mb-2">
                      No round active
                    </div>
                    <p className="text-xs">
                      Start a 10-minute vote from the Game & Voting admin page. The five candidate
                      upgrades and live tallies will appear here.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <footer className="text-center text-[9px] font-bold uppercase tracking-widest text-cream/60 py-1.5 border-t border-white/10">
              Auto-refresh · realtime
            </footer>
          </div>
        </aside>
      </div>
    </div>
  );
}
