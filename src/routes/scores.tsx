import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { SectionHeading } from "@/components/trail/section-heading";
import { Leaderboard, FullLeaderboard } from "@/components/game/leaderboard";

export const Route = createFileRoute("/scores")({
  head: () => ({
    meta: [
      { title: "High Scores — Blazing the Trail to Coverage" },
      {
        name: "description",
        content:
          "The top 3 runs on the trail to health coverage, updated live as players finish the game.",
      },
      { property: "og:title", content: "High Scores — Blazing the Trail to Coverage" },
      {
        property: "og:description",
        content: "See the top 3 runs on the trail to health coverage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScoresPage,
});

function ScoresPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray font-sans">
      <SiteChrome />

      <main id="main-content" className="max-w-3xl w-full mx-auto py-10 px-4 sm:px-6 flex-1">
        <header className="mb-2">
          <SectionHeading as="h1">High scores</SectionHeading>
          <p className="text-lg text-dark-gray/80 max-w-2xl mt-3">
            The podium up top wins a prize, then every run ever submitted below. Ties break in favour
            of whoever got there first.
          </p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-lg border-2 border-accent-gold bg-accent-gold/10 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-mn-blue">
            ★ Top 3 scores win a prize ★
          </p>
        </header>

        <Leaderboard variant="panel" showViewAll={false} />
        <FullLeaderboard />

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/tool"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-orange px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110 transition ring-1 ring-accent-gold/60"
          >
            ▶ Beat these scores
          </Link>
          <Link
            to="/feedback"
            className="inline-flex items-center gap-2 rounded-lg bg-mn-blue px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110 transition"
          >
            ✎ Share feedback
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
