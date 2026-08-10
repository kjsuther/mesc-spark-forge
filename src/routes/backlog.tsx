import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { SectionHeading } from "@/components/trail/section-heading";
import { FeedbackBoard } from "@/components/game/feedback-board";
import { FeedbackStats } from "@/components/game/feedback-stats";

import { gameFeedbackQuery } from "@/lib/feedback.queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/backlog")({
  head: () => ({
    meta: [
      { title: "Feedback Backlog — Blazing the Trail to Coverage" },
      {
        name: "description",
        content:
          "Everything players have asked us to change in the game, in build order, plus everything already shipped into the current version.",
      },
      { property: "og:title", content: "Feedback Backlog — Blazing the Trail to Coverage" },
      {
        property: "og:description",
        content: "What's queued up next and what's already been built from player feedback.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(gameFeedbackQuery);
  },
  component: BacklogPage,
});

function BacklogPage() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("backlog-page-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_feedback" }, () =>
        qc.invalidateQueries({ queryKey: ["game_feedback"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray font-sans">
      <SiteChrome />

      <main id="main-content" className="max-w-5xl w-full mx-auto py-10 px-4 sm:px-6 flex-1">
        <header className="mb-2">
          <SectionHeading as="h1">Feedback backlog</SectionHeading>
          <p className="text-lg text-dark-gray/80 max-w-2xl mt-3">
            Every idea players have submitted about the game — ranked in the order the poster team
            plans to build it, alongside everything already shipped into the current version.
          </p>
        </header>

        <div className="mt-6">
          <FeedbackStats />
        </div>

        <FeedbackBoard />


        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/feedback"
            className="inline-flex items-center gap-2 rounded-lg bg-mn-blue px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110 transition"
          >
            ✎ Add your feedback
          </Link>
          <Link
            to="/tool"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-orange px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110 transition ring-1 ring-accent-gold/60"
          >
            ▶ Play the game
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
