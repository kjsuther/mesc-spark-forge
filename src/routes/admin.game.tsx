import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getLastWipe, resetLeaderboard, restoreLastWipe } from "@/lib/game.functions";
import { gameFeedbackQuery, splitFeedback } from "@/lib/feedback.queries";

export const Route = createFileRoute("/admin/game")({
  head: () => ({
    meta: [{ title: "Demo Game — Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminGamePage,
});

function AdminGamePage() {
  const wipeScores = useServerFn(resetLeaderboard);
  const restoreScores = useServerFn(restoreLastWipe);
  const fetchLastWipe = useServerFn(getLastWipe);
  const { data: rows = [] } = useQuery(gameFeedbackQuery);
  const { backlog, implemented } = splitFeedback(rows);
  const { data: lastWipe, refetch: refetchWipe } = useQuery({
    queryKey: ["leaderboard_wipes", "last"],
    queryFn: () => fetchLastWipe(),
  });

  async function handleResetScores() {
    if (!confirm("Wipe the entire High Scores leaderboard? This cannot be undone.")) return;
    try {
      await wipeScores();
      toast.success("High scores cleared.");
      refetchWipe();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset high scores");
    }
  }

  async function handleRestoreScores() {
    if (!confirm("Restore the scores removed by the most recent wipe?")) return;
    try {
      const res = await restoreScores();
      toast.success(`Restored ${res.restored} score${res.restored === 1 ? "" : "s"}.`);
      refetchWipe();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to restore high scores");
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
        <button
          onClick={handleRestoreScores}
          className="rounded border-2 border-mn-green px-4 py-2 text-sm font-bold uppercase text-mn-green hover:bg-mn-green/10"
        >
          Restore last wipe
        </button>
      </section>

      <section className="rounded-lg border-2 border-dark-gray/20 bg-cream p-4 text-sm text-dark-gray/80">
        <strong className="font-black uppercase tracking-wide text-mn-blue">Leaderboard log</strong>
        <p className="mt-1">
          {lastWipe
            ? `Last wipe: ${new Date(lastWipe.wiped_at).toLocaleString()} — ${lastWipe.row_count} score${lastWipe.row_count === 1 ? "" : "s"} removed${lastWipe.restored_at ? " (restored)" : ""}.`
            : "No leaderboard wipe on record. Scores are never cleared by publishing an update."}
        </p>
        <p className="mt-1 text-xs">
          Every deleted score is archived automatically, so a wipe can always be undone.
        </p>
      </section>
    </div>
  );
}

