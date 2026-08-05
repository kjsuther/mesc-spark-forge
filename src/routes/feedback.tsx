import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { SectionHeading } from "@/components/trail/section-heading";
import { FeedbackForm } from "@/components/game/feedback-form";
import { gameFeedbackQuery } from "@/lib/feedback.queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Share Feedback — Blazing the Trail to Coverage" },
      {
        name: "description",
        content:
          "Just played the game? Tell us what to improve. Every idea lands on the public backlog and the poster team builds it live during the session.",
      },
      { property: "og:title", content: "Share Feedback — Blazing the Trail to Coverage" },
      {
        property: "og:description",
        content: "Tell us what to change in the game. We build it live and you replay it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(gameFeedbackQuery);
  },
  component: FeedbackPage,
});

function FeedbackPage() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("feedback-page-live")
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

      <main id="main-content" className="max-w-4xl w-full mx-auto py-10 px-4 sm:px-6 flex-1">
        <header className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-mn-green mb-2">
            Step 2 of 3
          </p>
          <SectionHeading as="h1">Share feedback on the game</SectionHeading>
          <p className="text-lg text-dark-gray/80 max-w-2xl mt-3">
            You just played a 16-bit video game about applying for health coverage. What tripped
            you up? What would make the trail clearer, fairer, or more fun? Drop it below — the
            poster team builds items live during the session, then you come back and replay the
            improved version.
          </p>
        </header>

        <FeedbackForm />

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/backlog"
            className="inline-flex items-center gap-2 rounded-lg bg-mn-blue px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110 transition"
          >
            📋 See the feedback backlog
          </Link>
          <Link
            to="/tool"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-orange px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110 transition ring-1 ring-accent-gold/60"
          >
            ▶ Back to the game
          </Link>
          <Link
            to="/scores"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-mn-blue/30 px-5 py-3 text-sm font-bold uppercase tracking-wide text-mn-blue hover:bg-cream transition"
          >
            ★ High scores
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
