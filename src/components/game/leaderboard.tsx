import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GameScore = {
  id: string;
  display_name: string;
  score: number;
  duration_ms: number;
  mode: "before" | "after";
  created_at: string;
};

const leaderboardQuery = {
  queryKey: ["game_scores", "top"] as const,
  queryFn: async (): Promise<GameScore[]> => {
    const { data, error } = await supabase
      .from("game_scores")
      .select("id, display_name, score, duration_ms, mode, created_at")
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(3);
    if (error) throw error;
    return (data ?? []) as GameScore[];
  },
  refetchInterval: 5000,
  refetchIntervalInBackground: true,
  staleTime: 4000,
};

function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${r.toString().padStart(2, "0")}` : `${r}s`;
}

export function Leaderboard({ variant = "panel" }: { variant?: "panel" | "poster" }) {
  const { data: scores = [], isLoading } = useQuery(leaderboardQuery);

  if (variant === "poster") {
    return (
      <div className="flex flex-col h-full">
        <header className="bg-accent-gold text-mn-blue px-4 py-2 border-b-2 border-accent-orange/60">
          <span className="font-display uppercase tracking-widest text-sm">
            ★ Live High Scores · Top 3
          </span>
        </header>
        <ol className="flex-1 overflow-auto p-2 space-y-1">
          {isLoading && (
            <li className="text-cream/60 italic text-sm text-center py-4">Loading…</li>
          )}
          {!isLoading && scores.length === 0 && (
            <li className="text-cream/60 italic text-sm text-center py-4">
              Be the first to finish the trail!
            </li>
          )}
          {scores.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-2 bg-white/5 border border-white/10 rounded px-2 py-1.5"
            >
              <span
                className={`w-6 h-6 grid place-items-center rounded text-[11px] font-black tabular-nums shrink-0 ${
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
                {s.display_name}
              </span>
              <span
                className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                  s.mode === "after" ? "bg-mn-green/80 text-white" : "bg-accent-orange/80 text-white"
                }`}
              >
                {s.mode}
              </span>
              <span className="text-cream/70 text-[10px] tabular-nums shrink-0 w-10 text-right">
                {fmtDuration(s.duration_ms)}
              </span>
              <span className="text-accent-gold font-black tabular-nums shrink-0 w-14 text-right">
                {s.score}
              </span>
            </li>
          ))}
        </ol>
        <footer className="text-center text-[9px] font-bold uppercase tracking-widest text-cream/60 py-1.5 border-t border-white/10">
          Auto-refresh · every 5s
        </footer>
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-lg border-2 border-accent-gold/60 bg-cream/60 overflow-hidden">
      <header className="bg-accent-gold text-mn-blue px-4 py-2 flex items-center justify-between">
        <span className="font-display uppercase tracking-widest text-sm">
          ★ High Scores · Top 3
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-mn-blue/70">
          Updates every 5s
        </span>
      </header>
      <ol className="divide-y divide-mn-blue/10">
        {isLoading && (
          <li className="px-4 py-3 text-sm text-dark-gray/60 italic">Loading…</li>
        )}
        {!isLoading && scores.length === 0 && (
          <li className="px-4 py-3 text-sm text-dark-gray/60 italic">
            No finishers yet — be the first!
          </li>
        )}
        {scores.map((s, i) => (
          <li
            key={s.id}
            className="px-4 py-2 flex items-center gap-3 text-sm"
          >
            <span
              className={`w-6 h-6 grid place-items-center rounded text-[11px] font-black tabular-nums shrink-0 ${
                i === 0
                  ? "bg-accent-gold text-mn-blue"
                  : i < 3
                    ? "bg-accent-orange text-white"
                    : "bg-mn-blue/10 text-mn-blue"
              }`}
            >
              {i + 1}
            </span>
            <span className="flex-1 min-w-0 truncate font-bold">{s.display_name}</span>
            <span
              className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                s.mode === "after"
                  ? "bg-mn-green/15 text-mn-green"
                  : "bg-accent-orange/15 text-accent-orange"
              }`}
            >
              {s.mode}
            </span>
            <span className="text-dark-gray/60 text-xs tabular-nums w-10 text-right">
              {fmtDuration(s.duration_ms)}
            </span>
            <span className="font-black tabular-nums w-14 text-right text-mn-blue">
              {s.score}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
