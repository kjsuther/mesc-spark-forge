import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Leaderboard } from "@/components/game/leaderboard";
import { FeedbackBoard } from "@/components/game/feedback-board";
import { gameFeedbackQuery, splitFeedback } from "@/lib/feedback.queries";

export const Route = createFileRoute("/admin/poster")({
  head: () => ({
    meta: [
      { title: "Poster View — Blazing the Trail" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(gameFeedbackQuery);
  },
  component: PosterView,
});

function PosterView() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery(gameFeedbackQuery);

  useEffect(() => {
    const channel = supabase
      .channel("admin-poster-game")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_feedback" }, () =>
        qc.invalidateQueries({ queryKey: ["game_feedback"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { implemented } = splitFeedback(rows);

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
            <div className="text-cream/60">Feedback implemented</div>
            <div className="text-accent-gold font-black text-lg tabular-nums">
              {implemented.length}
            </div>
          </div>
          <Link
            to="/admin/feedback"
            className="inline-flex items-center gap-2 rounded border-2 border-cream/40 bg-cream/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-cream hover:bg-cream/20"
          >
            ✕ Exit Poster
          </Link>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)] gap-3 p-3 min-h-0">
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

        <aside className="grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 min-h-0">
          <div className="rounded-lg bg-mn-blue/40 ring-2 ring-accent-gold/50 overflow-hidden min-h-0">
            <Leaderboard variant="poster" />
          </div>
          <div className="rounded-lg bg-mn-blue/40 ring-2 ring-accent-gold/50 overflow-hidden min-h-0">
            <FeedbackBoard variant="poster" />
          </div>
        </aside>
      </div>
    </div>
  );
}
