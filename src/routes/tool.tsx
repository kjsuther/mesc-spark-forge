import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { NowBuildingBanner } from "@/components/now-building-banner";
import { SectionHeading } from "@/components/trail/section-heading";
import { GameCanvas } from "@/components/game/game-canvas";
import type { WinResult } from "@/components/game/game-scenes";
import { gameFeedbackQuery, splitFeedback } from "@/lib/feedback.queries";
import { nowBuildingQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tool")({
  head: () => ({
    meta: [
      { title: "Play the Game — Blazing the Trail to Coverage" },
      {
        name: "description",
        content:
          "Play a retro 16-bit video game about applying for health coverage, then tell us what to fix and come back to the version built from your feedback.",
      },
      { property: "og:title", content: "Play Blazing the Trail to Coverage" },
      {
        property: "og:description",
        content:
          "A retro video game about the trail to health coverage. Play it, give feedback, replay the improved version.",
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
            This is a real, playable <b>16-bit video game</b> — a short trail from{" "}
            <b>"I need health coverage"</b> to <b>Covered!</b>, complete with the barriers people
            actually hit when they apply. Play it, then tell us what to fix. We build your feedback
            into the game during the session and you come back to play the better version.
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
              Current version
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

        <InstallPrompt />

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


        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/feedback"
            className="inline-flex items-center gap-2 rounded-lg bg-mn-blue px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110 transition"
          >
            ✎ Share feedback on the game
          </Link>
          <Link
            to="/backlog"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-mn-blue/30 px-5 py-3 text-sm font-bold uppercase tracking-wide text-mn-blue hover:bg-cream transition"
          >
            📋 View the backlog
          </Link>
          <Link
            to="/scores"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-accent-gold px-5 py-3 text-sm font-bold uppercase tracking-wide text-mn-blue hover:bg-cream transition"
          >
            ★ High scores
          </Link>
        </div>

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
