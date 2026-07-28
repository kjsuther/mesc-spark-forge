import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { NowBuildingBanner } from "@/components/now-building-banner";
import { SectionHeading } from "@/components/trail/section-heading";
import { GameCanvas } from "@/components/game/game-canvas";
import { Leaderboard } from "@/components/game/leaderboard";
import { FeedbackForm } from "@/components/game/feedback-form";
import { FeedbackBoard } from "@/components/game/feedback-board";
import type { WinResult } from "@/components/game/game-scenes";
import { gameFeedbackQuery, splitFeedback } from "@/lib/feedback.queries";
import { nowBuildingQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tool")({
  head: () => ({
    meta: [
      { title: "Blazing the Trail to Coverage — MN DHS Demo" },
      {
        name: "description",
        content:
          "A tiny retro side-scroller about applying for health coverage. Play it, tell us what to fix, and come back to a version built from your feedback.",
      },
      { property: "og:title", content: "Blazing the Trail to Coverage" },
      {
        property: "og:description",
        content:
          "Play the trail to health coverage, leave feedback, and watch the game improve from it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(gameFeedbackQuery);
    context.queryClient.ensureQueryData(nowBuildingQuery);
  },
  component: ToolPage,
});

function ToolPage() {
  const { data: nowBuilding } = useSuspenseQuery(nowBuildingQuery);
  const { data: feedback } = useSuspenseQuery(gameFeedbackQuery);
  const qc = useQueryClient();
  // The current build (everything shipped from feedback) is the default.
  const [mode, setMode] = useState<"before" | "after">("after");

  useEffect(() => {
    const channel = supabase
      .channel("tool-game-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_feedback" }, () =>
        qc.invalidateQueries({ queryKey: ["game_feedback"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, () =>
        qc.invalidateQueries({ queryKey: ["now_building"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { implemented } = splitFeedback(feedback);

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray font-sans">
      <SiteChrome />

      <main id="main-content" className="max-w-6xl w-full mx-auto py-10 px-4 sm:px-6 flex-1">
        <NowBuildingBanner items={nowBuilding} variant="tool" />

        <header className="mb-6">
          <SectionHeading as="h1">Blazing the Trail to Coverage</SectionHeading>
          <p className="text-lg text-dark-gray/80 max-w-2xl mt-3">
            A short 16-bit trail from <b>"I need health coverage"</b> to <b>Covered!</b> —
            complete with real barriers people hit when applying. Play it, tell us what to fix,
            and come back to play the version built from your feedback.
          </p>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Game version"
            className="inline-flex bg-cream border-2 border-mn-blue/40 rounded-full p-1"
          >
            <button
              role="tab"
              aria-selected={mode === "after"}
              onClick={() => setMode("after")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide transition-colors ${
                mode === "after" ? "bg-mn-green text-white" : "text-mn-blue"
              }`}
            >
              After feedback
            </button>
            <button
              role="tab"
              aria-selected={mode === "before"}
              onClick={() => setMode("before")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide transition-colors ${
                mode === "before" ? "bg-accent-orange text-white" : "text-mn-blue"
              }`}
            >
              Original version
            </button>
          </div>
          <span className="text-xs font-semibold text-dark-gray/70">
            {mode === "after"
              ? `${implemented.length} player suggestion${implemented.length === 1 ? "" : "s"} built into this version`
              : "The original build — no player feedback applied"}
          </span>
        </div>

        <div className="mb-4 rounded-lg border-2 border-accent-orange bg-accent-orange/10 px-4 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-mn-blue">
            ⌨ Best played on a desktop or laptop
          </p>
          <p className="mt-1 text-sm text-dark-gray/80">
            Keyboard controls (arrow keys + space) give the smoothest run. Mobile works, but the
            on-screen controls are cramped — if you're on a phone, turn it sideways into landscape.
          </p>
        </div>

        <ClientGameCanvas mode={mode} />

        <FeedbackForm />

        <FeedbackBoard />

        <Leaderboard variant="panel" />

        <p className="mt-8 text-center text-sm text-dark-gray/70 italic max-w-2xl mx-auto">
          Every trail starts somewhere. Better trails are built by listening to the people who use
          them.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

function ClientGameCanvas(props: {
  mode: "before" | "after";
  onWin?: (result: WinResult) => void;
  onLose?: (result: WinResult) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div
        className="w-full bg-black rounded-lg ring-2 ring-mn-blue/60 grid place-items-center text-white"
        style={{ aspectRatio: "16 / 9" }}
      >
        Loading game…
      </div>
    );
  }
  return <GameCanvas {...props} />;
}
