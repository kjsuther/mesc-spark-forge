import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type GameScore = {
  id: string;
  display_name: string;
  score: number;
  duration_ms: number;
  mode: "before" | "after";
  created_at: string;
};

const SELECT = "id, display_name, score, duration_ms, mode, created_at";

/** Top-3 only — used by the in-game end screen and the poster/kiosk view. */
const topScoresQuery = {
  queryKey: ["game_scores", "top"] as const,
  queryFn: async (): Promise<GameScore[]> => {
    const { data, error } = await supabase
      .from("game_scores")
      .select(SELECT)
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

/** Every score ever submitted — used by the dedicated /scores page. */
export const allScoresQuery = {
  queryKey: ["game_scores", "all"] as const,
  queryFn: async (): Promise<GameScore[]> => {
    const { data, error } = await supabase
      .from("game_scores")
      .select(SELECT)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(2000);
    if (error) throw error;
    return (data ?? []) as GameScore[];
  },
  refetchInterval: 10000,
  staleTime: 8000,
};

const MEDALS = ["🥇", "🥈", "🥉"];

function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${r.toString().padStart(2, "0")}` : `${r}s`;
}

/**
 * Top-3 board.
 *
 * `variant="poster"` is the dark kiosk styling shown on the admin poster
 * screen; `variant="panel"` is the light in-page styling. Both show medals,
 * name and score only, and both link out to the full list.
 */
export function Leaderboard({
  variant = "panel",
  showViewAll = true,
}: {
  variant?: "panel" | "poster";
  showViewAll?: boolean;
}) {
  const { data: scores = [], isLoading } = useQuery(topScoresQuery);

  if (variant === "poster") {
    return (
      <div className="flex flex-col h-full min-h-0">
        <header className="bg-accent-gold text-mn-blue px-3 py-1.5 border-b-2 border-accent-orange/60">
          <span className="font-display uppercase tracking-widest text-sm">
            ★ Live High Scores · Top 3 ★
          </span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-mn-blue/80 mt-0.5">
            Top 3 win a prize
          </p>
        </header>
        <ol className="flex-1 min-h-0 overflow-hidden p-2 space-y-1">
          {isLoading && <li className="text-cream/70 italic text-sm text-center py-3">Loading…</li>}
          {!isLoading && scores.length === 0 && (
            <li className="text-cream/70 italic text-sm text-center py-3">
              Be the first to finish the trail!
            </li>
          )}
          {scores.map((s, i) => (
            <li
              key={s.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 bg-white/10 border border-white/15 rounded px-2 py-1.5"
            >
              <span aria-hidden="true" className="text-lg leading-none shrink-0">
                {MEDALS[i]}
              </span>
              <span className="min-w-0 truncate font-bold text-cream text-base">
                {s.display_name}
              </span>
              <span className="text-accent-gold font-black text-lg tabular-nums shrink-0">
                {s.score}
              </span>
            </li>
          ))}
        </ol>
        <footer className="text-center text-[10px] font-bold uppercase tracking-widest text-cream/70 py-1 border-t border-white/10">
          Auto-refresh · every 5s
        </footer>
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-lg border-2 border-accent-gold/60 bg-cream/60 overflow-hidden">
      <header className="bg-accent-gold text-mn-blue px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-display uppercase tracking-widest text-sm">
            ★ High Scores · Top 3 ★
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-mn-blue/80">
            Top 3 win a prize
          </p>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-mn-blue/70">
          Updates every 5s
        </span>
      </header>
      <ol className="divide-y divide-mn-blue/10">
        {isLoading && <li className="px-4 py-3 text-sm text-dark-gray/70 italic">Loading…</li>}
        {!isLoading && scores.length === 0 && (
          <li className="px-4 py-3 text-sm text-dark-gray/70 italic">
            No finishers yet — be the first!
          </li>
        )}
        {scores.map((s, i) => (
          <li
            key={s.id}
            className="px-4 py-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-base"
          >
            <span aria-hidden="true" className="text-xl leading-none shrink-0">
              {MEDALS[i]}
            </span>
            <span className="min-w-0 truncate font-bold">{s.display_name}</span>
            <span className="font-black tabular-nums text-right text-mn-blue">{s.score}</span>
          </li>
        ))}
      </ol>
      {showViewAll && (
        <div className="border-t border-mn-blue/10 bg-white/50 px-4 py-2 text-right">
          <Link
            to="/scores"
            className="text-sm font-bold uppercase tracking-wide text-mn-blue underline underline-offset-2 hover:text-accent-orange"
          >
            View all scores →
          </Link>
        </div>
      )}
    </section>
  );
}

const PAGE_SIZE = 25;

/**
 * Full leaderboard: every submitted score, highest first, with name search and
 * "load more" paging so a conference-sized list stays fast. Nothing is ever
 * filtered out of the underlying data.
 */
export function FullLeaderboard() {
  const { data: scores = [], isLoading } = useQuery(allScoresQuery);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scores;
    return scores.filter((s) => s.display_name.toLowerCase().includes(q));
  }, [scores, query]);

  const rows = filtered.slice(0, visible);

  return (
    <section className="mt-6 rounded-lg border-2 border-mn-blue/30 bg-white overflow-hidden">
      <header className="bg-mn-blue text-white px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <span className="font-display uppercase tracking-widest text-sm truncate">
          All scores · {scores.length}
        </span>
        <label className="shrink-0">
          <span className="sr-only">Search by player name</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search names…"
            className="w-40 sm:w-56 rounded border-2 border-white/30 bg-white px-3 py-1.5 text-sm text-dark-gray placeholder:text-dark-gray/50 focus:outline-none focus:ring-2 focus:ring-accent-gold"
          />
        </label>
      </header>

      <ol className="divide-y divide-mn-blue/10">
        {isLoading && <li className="px-4 py-3 text-sm text-dark-gray/70 italic">Loading…</li>}
        {!isLoading && filtered.length === 0 && (
          <li className="px-4 py-3 text-sm text-dark-gray/70 italic">
            {query ? `No players match “${query}”.` : "No scores yet — be the first!"}
          </li>
        )}
        {rows.map((s) => {
          const rank = scores.indexOf(s) + 1;
          return (
            <li
              key={s.id}
              className="px-3 sm:px-4 py-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-base"
            >
              <span className="w-8 shrink-0 text-right font-black tabular-nums text-mn-blue/70">
                {rank <= 3 ? MEDALS[rank - 1] : rank}
              </span>
              <span className="min-w-0 truncate font-bold">{s.display_name}</span>
              <span className="font-black tabular-nums text-right text-mn-blue">{s.score}</span>
              <span className="col-start-2 col-span-2 flex items-center gap-2 text-xs text-dark-gray/70">
                <span className="tabular-nums">{fmtDuration(s.duration_ms)}</span>
                <span className="truncate">
                  {new Date(s.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {visible < filtered.length && (
        <div className="border-t border-mn-blue/10 px-4 py-3 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-lg border-2 border-mn-blue/30 px-5 py-2 text-sm font-bold uppercase tracking-wide text-mn-blue hover:bg-cream transition min-h-11"
          >
            Load more ({filtered.length - visible} left)
          </button>
        </div>
      )}
    </section>
  );
}
