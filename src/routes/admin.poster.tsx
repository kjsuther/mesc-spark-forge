import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
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

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

function PosterView() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery(gameFeedbackQuery);
  const [fullscreen, setFullscreen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);

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

  const enterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement as FsEl;
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch {
      // User denied or unsupported — leave the prompt visible.
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      const d = document as FsDoc;
      if (d.exitFullscreen) await d.exitFullscreen();
      else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  // Track fullscreen state (covers Esc / browser-initiated exits).
  useEffect(() => {
    const sync = () => {
      const fs = isFullscreen();
      setFullscreen(fs);
      setChromeVisible(!fs);
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync as EventListener);
    };
  }, []);

  // Auto-enter on the first user gesture anywhere on the page.
  useEffect(() => {
    if (fullscreen) return;
    const onGesture = () => {
      if (!isFullscreen()) void enterFullscreen();
    };
    window.addEventListener("pointerdown", onGesture, { capture: true });
    window.addEventListener("keydown", onGesture, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture, { capture: true });
      window.removeEventListener("keydown", onGesture, { capture: true });
    };
  }, [fullscreen, enterFullscreen]);

  // While fullscreen, reveal operator chrome only near the top edge.
  useEffect(() => {
    if (!fullscreen) return;
    const onMove = (e: PointerEvent) => setChromeVisible(e.clientY <= 60);
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [fullscreen]);

  const { implemented } = splitFeedback(rows);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-mn-blue text-cream flex flex-col">
      <header
        className={`px-6 py-3 border-b-2 border-accent-orange/70 flex items-center justify-between gap-3 flex-wrap transition-opacity duration-200 ${
          fullscreen
            ? `absolute inset-x-0 top-0 z-30 bg-mn-blue/95 backdrop-blur ${
                chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              }`
            : "relative opacity-100"
        }`}
      >
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
          <button
            type="button"
            onClick={() => void (fullscreen ? exitFullscreen() : enterFullscreen())}
            className="inline-flex items-center gap-2 rounded border-2 border-accent-gold/70 bg-accent-gold/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-gold hover:bg-accent-gold/30"
          >
            {fullscreen ? "⤢ Exit Fullscreen" : "⛶ Go Fullscreen"}
          </button>
          <Link
            to="/admin/feedback"
            className="inline-flex items-center gap-2 rounded border-2 border-cream/40 bg-cream/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-cream hover:bg-cream/20"
          >
            ✕ Exit Poster
          </Link>
        </div>
      </header>

      {!fullscreen && (
        <button
          type="button"
          onClick={() => void enterFullscreen()}
          className="absolute bottom-4 right-4 z-40 rounded-lg border-2 border-accent-gold bg-mn-blue/95 px-4 py-3 text-xs font-black uppercase tracking-widest text-accent-gold shadow-lg hover:bg-accent-gold/20"
        >
          ⛶ Fill the screen
        </button>
      )}

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

        <aside className="grid grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3 min-h-0">
          <div className="rounded-lg bg-mn-blue/40 ring-2 ring-accent-gold/50 overflow-hidden min-h-0">
            <Leaderboard variant="poster" />
          </div>
          <div className="rounded-lg bg-mn-blue/40 ring-2 ring-accent-gold/50 overflow-hidden min-h-0">
            <FeedbackBoard variant="poster-implemented" />
          </div>
          <div className="rounded-lg bg-mn-blue/40 ring-2 ring-accent-gold/50 overflow-hidden min-h-0">
            <FeedbackBoard variant="poster" />
          </div>
        </aside>
      </div>
    </div>
  );
}
