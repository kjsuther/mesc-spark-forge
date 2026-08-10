import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { resetLeaderboard } from "@/lib/game.functions";
import { gameFeedbackQuery, splitFeedback } from "@/lib/feedback.queries";

export const Route = createFileRoute("/admin/game")({
  head: () => ({
    meta: [{ title: "Demo Game — Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminGamePage,
});

function AdminGamePage() {
  const wipeScores = useServerFn(resetLeaderboard);
  const { data: rows = [] } = useQuery(gameFeedbackQuery);
  const { backlog, implemented } = splitFeedback(rows);

  async function handleResetScores() {
    if (!confirm("Wipe the entire High Scores leaderboard? This cannot be undone.")) return;
    try {
      await wipeScores();
      toast.success("High scores cleared.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset high scores");
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-mn-blue uppercase tracking-wide mb-2">Demo Game</h1>
      <p className="text-sm text-dark-gray/70 mb-6">
        Players play the game, leave feedback, and the poster team builds it. Manage the backlog on
        the Player Feedback page — this page holds the game's housekeeping controls.
      </p>

      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border-2 border-accent-orange/60 bg-cream p-4">
          <div className="text-xs font-black uppercase tracking-wide text-accent-orange">
            Backlog
          </div>
          <div className="text-3xl font-black tabular-nums text-mn-blue">{backlog.length}</div>
        </div>
        <div className="rounded-lg border-2 border-mn-green/60 bg-cream p-4">
          <div className="text-xs font-black uppercase tracking-wide text-mn-green">
            Implemented
          </div>
          <div className="text-3xl font-black tabular-nums text-mn-blue">{implemented.length}</div>
        </div>
      </section>

      <section className="mb-6 flex flex-wrap gap-2">
        <Link
          to="/admin/feedback"
          className="rounded bg-mn-blue px-4 py-2 text-sm font-black uppercase text-white hover:brightness-110"
        >
          Manage player feedback
        </Link>
        <Link
          to="/admin/poster"
          className="rounded border-2 border-mn-blue px-4 py-2 text-sm font-bold uppercase text-mn-blue"
        >
          Open poster view
        </Link>
        <button
          onClick={handleResetScores}
          className="rounded border-2 border-red-500 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
        >
          Reset High Scores leaderboard
        </button>
      </section>
    </div>
  );
}
