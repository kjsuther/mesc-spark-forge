import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { gameFeedbackQuery, splitFeedback, type GameFeedback } from "@/lib/feedback.queries";
import {
  setGameFeedbackStatus,
  reorderGameFeedback,
  updateGameFeedback,
  deleteGameFeedback,
} from "@/lib/feedback.functions";

export const Route = createFileRoute("/admin/feedback")({
  head: () => ({
    meta: [
      { title: "Player Feedback — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminFeedbackPage,
});

function AdminFeedbackPage() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery(gameFeedbackQuery);
  const setStatus = useServerFn(setGameFeedbackStatus);
  const reorder = useServerFn(reorderGameFeedback);
  const update = useServerFn(updateGameFeedback);
  const remove = useServerFn(deleteGameFeedback);

  const [order, setOrder] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<GameFeedback | null>(null);

  useEffect(() => {
    const ch = supabase
      .channel("admin-game-feedback")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_feedback" }, () =>
        qc.invalidateQueries({ queryKey: ["game_feedback"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const { backlog, implemented } = splitFeedback(rows);
  const ordered = order
    ? (order.map((id) => backlog.find((b) => b.id === id)).filter(Boolean) as GameFeedback[])
    : backlog;
  // Any newly-arrived item that isn't in the local draft order yet.
  const list = order
    ? [...ordered, ...backlog.filter((b) => !order.includes(b.id))]
    : backlog;

  function move(index: number, dir: -1 | 1) {
    const next = list.map((f) => f.id);
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  async function saveOrder() {
    if (!order) return;
    try {
      await reorder({ data: { ids: list.map((f) => f.id) } });
      setOrder(null);
      toast.success("Backlog order saved — live on the site and poster view.");
      qc.invalidateQueries({ queryKey: ["game_feedback"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save order");
    }
  }

  async function handleStatus(f: GameFeedback, status: "backlog" | "implemented") {
    await setStatus({ data: { id: f.id, status } });
    toast.success(status === "implemented" ? "Marked implemented" : "Moved back to backlog");
    qc.invalidateQueries({ queryKey: ["game_feedback"] });
  }

  async function handleDelete(f: GameFeedback) {
    if (!confirm("Delete this feedback item?")) return;
    await remove({ data: { id: f.id } });
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["game_feedback"] });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await update({
        data: {
          id: editing.id,
          description: editing.description,
          submitterName: editing.submitter_name,
        },
      });
      setEditing(null);
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["game_feedback"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-mn-blue uppercase tracking-wide mb-2">
        Player Feedback
      </h1>
      <p className="text-sm text-dark-gray/70 mb-6">
        Rank the backlog in the order you plan to build it — attendees and the poster view see
        exactly this order. Mark an item <b>Implemented</b> once the change is live in the game.
      </p>

      <section className="mb-8 rounded-lg border-2 border-accent-orange/60 bg-white">
        <header className="flex items-center justify-between gap-3 border-b-2 border-accent-orange/40 bg-accent-orange px-4 py-2 text-white">
          <h2 className="text-sm font-black uppercase tracking-wide">
            Backlog ({list.length})
          </h2>
          {order && (
            <div className="flex gap-2">
              <button
                onClick={() => setOrder(null)}
                className="rounded bg-white/20 px-3 py-1 text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={saveOrder}
                className="rounded bg-white px-3 py-1 text-xs font-black uppercase text-accent-orange"
              >
                Save order
              </button>
            </div>
          )}
        </header>
        {list.length === 0 ? (
          <p className="px-4 py-6 text-sm text-dark-gray/60">No feedback submitted yet.</p>
        ) : (
          <ol className="divide-y divide-light-gray">
            {list.map((f, i) => (
              <li key={f.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded bg-mn-blue text-xs font-black text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-dark-gray">{f.description}</p>
                  <p className="text-xs font-semibold text-dark-gray/60">
                    — {f.submitter_name} · {new Date(f.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="rounded border-2 border-mn-blue/30 px-2 py-1 text-xs font-bold text-mn-blue disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === list.length - 1}
                    aria-label="Move down"
                    className="rounded border-2 border-mn-blue/30 px-2 py-1 text-xs font-bold text-mn-blue disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => setEditing(f)}
                    className="rounded border-2 border-mn-blue/30 px-2 py-1 text-xs font-bold text-mn-blue"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleStatus(f, "implemented")}
                    className="rounded bg-mn-green px-3 py-1 text-xs font-black uppercase text-white hover:brightness-110"
                  >
                    Implemented
                  </button>
                  <button
                    onClick={() => handleDelete(f)}
                    className="rounded border-2 border-red-500 px-2 py-1 text-xs font-bold text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-lg border-2 border-mn-green/60 bg-white">
        <header className="border-b-2 border-mn-green/40 bg-mn-green px-4 py-2 text-white">
          <h2 className="text-sm font-black uppercase tracking-wide">
            Implemented ({implemented.length})
          </h2>
        </header>
        {implemented.length === 0 ? (
          <p className="px-4 py-6 text-sm text-dark-gray/60">Nothing shipped yet.</p>
        ) : (
          <ul className="divide-y divide-light-gray">
            {implemented.map((f) => (
              <li key={f.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="mt-1 text-mn-green">✓</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-dark-gray">{f.description}</p>
                  <p className="text-xs font-semibold text-dark-gray/60">
                    — {f.submitter_name}
                    {f.implemented_at
                      ? ` · shipped ${new Date(f.implemented_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleStatus(f, "backlog")}
                    className="rounded border-2 border-mn-blue/30 px-2 py-1 text-xs font-bold text-mn-blue"
                  >
                    Back to backlog
                  </button>
                  <button
                    onClick={() => handleDelete(f)}
                    className="rounded border-2 border-red-500 px-2 py-1 text-xs font-bold text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg rounded-lg border-2 border-mn-blue bg-white p-5"
          >
            <h3 className="mb-3 font-display text-xl uppercase text-mn-blue">Edit feedback</h3>
            <textarea
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              rows={3}
              maxLength={280}
              className="w-full rounded border-2 border-mn-blue/40 px-3 py-2 text-sm"
            />
            <input
              value={editing.submitter_name}
              onChange={(e) => setEditing({ ...editing, submitter_name: e.target.value })}
              maxLength={60}
              className="mt-2 w-full rounded border-2 border-mn-blue/40 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded border-2 border-mn-blue/30 px-4 py-2 text-sm font-bold text-mn-blue"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-mn-blue px-4 py-2 text-sm font-black uppercase text-white"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
