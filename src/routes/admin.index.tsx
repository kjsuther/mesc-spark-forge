import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listAllFeedbackAdmin,
  setFeedbackStatus,
  setFeedbackHidden,
  startBuilding,
  deleteFeedback,
} from "@/lib/admin.functions";

type Status = "new" | "planned" | "in_progress" | "shipped";
type SortMode = "votes" | "newest";

export const Route = createFileRoute("/admin/")({
  component: AdminBacklog,
});

const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  planned: "Planned",
  in_progress: "Building",
  shipped: "Shipped",
};

function AdminBacklog() {
  const router = useRouter();
  const fetchAll = useServerFn(listAllFeedbackAdmin);
  const changeStatus = useServerFn(setFeedbackStatus);
  const changeHidden = useServerFn(setFeedbackHidden);
  const startBuild = useServerFn(startBuilding);
  const removeFeedback = useServerFn(deleteFeedback);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: () => fetchAll(),
    refetchInterval: 10_000,
  });

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("votes");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; wish: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);

  async function onDropToColumn(target: Status, id: string, currentStatus: Status) {
    setDraggingId(null);
    setDragOverCol(null);
    if (currentStatus === target) return;
    if (target === "in_progress") {
      // Route through startBuilding so current_work stays in sync as an alias.
      await startBuild({ data: { feedbackId: id } });
    } else {
      await changeStatus({ data: { id, status: target } });
    }
    toast.success(`Moved to ${STATUS_LABELS[target]}`);
    refetch();
    router.invalidate();
  }

  async function onStatus(id: string, status: Status) {
    await changeStatus({ data: { id, status } });
    toast.success(`Moved to ${STATUS_LABELS[status]}`);
    refetch();
    router.invalidate();
  }

  async function onHide(id: string, hidden: boolean) {
    await changeHidden({ data: { id, hidden } });
    toast.success(hidden ? "Hidden from public" : "Restored to public", {
      action: {
        label: "Undo",
        onClick: async () => {
          await changeHidden({ data: { id, hidden: !hidden } });
          toast.success(!hidden ? "Hidden from public" : "Restored to public");
          refetch();
          router.invalidate();
        },
      },
    });
    refetch();
    router.invalidate();
  }

  async function onStartBuilding(id: string, wish: string) {
    if (!confirm(`Set "Now Building" to this idea and move it to Building?\n\n"${wish}"`)) return;
    await startBuild({ data: { feedbackId: id } });
    toast.success("Now building this idea");
    refetch();
    router.invalidate();
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteConfirm !== "DELETE") return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    setDeleteConfirm("");
    await removeFeedback({ data: { id } });
    toast.success("Deleted");
    refetch();
    router.invalidate();
  }

  const items = data ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((f) =>
        [f.wish, f.role, f.organization, f.state, f.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
    : items;

  const columns: { key: Status; label: string; accent: string }[] = [
    { key: "new", label: "New", accent: "border-light-gray" },
    { key: "planned", label: "Planned", accent: "border-accent-gold" },
    { key: "in_progress", label: "Building", accent: "border-accent-teal" },
    { key: "shipped", label: "Shipped", accent: "border-mn-green" },
  ];

  function copyEmail(email: string) {
    navigator.clipboard.writeText(email).then(
      () => toast.success(`Copied ${email}`),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-mn-blue uppercase tracking-wide">Feedback triage</h1>
          <p className="text-sm text-dark-gray/70 mt-1 max-w-2xl">
            Move ideas across the pipeline, hide spam, or delete forever. Weighted vote: Must=3,
            Should=2, Nice=1. Marking as <strong>Shipped</strong> stamps the ship time.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs font-bold uppercase tracking-widest bg-mn-blue text-white px-3 py-2 rounded shrink-0"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search wish, org, role, state, email…"
          className="flex-1 min-w-[240px] border-2 border-light-gray focus:border-mn-blue rounded-lg px-3 py-2 text-sm outline-none"
        />
        <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-dark-gray/70">
          Sort:
          <button
            onClick={() => setSort("votes")}
            className={`px-2 py-1 rounded ${sort === "votes" ? "bg-mn-blue text-white" : "bg-light-gray/50"}`}
          >
            Votes
          </button>
          <button
            onClick={() => setSort("newest")}
            className={`px-2 py-1 rounded ${sort === "newest" ? "bg-mn-blue text-white" : "bg-light-gray/50"}`}
          >
            Newest
          </button>
        </div>
        <span className="text-xs text-dark-gray/60 tabular-nums">
          {filtered.length} / {items.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colItems = filtered
            .filter((f) => f.status === col.key)
            .sort((a, b) => {
              if (sort === "newest") {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              }
              return (b.votes?.weighted ?? 0) - (a.votes?.weighted ?? 0);
            });
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverCol !== col.key) setDragOverCol(col.key);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverCol === col.key) setDragOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                const item = items.find((it) => it.id === id);
                if (!id || !item) return;
                onDropToColumn(col.key, id, item.status as Status);
              }}
              className={`border-2 ${col.accent} rounded-2xl p-3 bg-white transition-colors ${
                dragOverCol === col.key ? "ring-2 ring-mn-blue/60 bg-mn-blue/5 border-dashed" : ""
              }`}
            >
              <h2 className="text-xs font-black uppercase tracking-widest text-mn-blue mb-3 flex justify-between">
                {col.label}
                <span className="tabular-nums">{colItems.length}</span>
              </h2>
              <ul className="space-y-3">
                {colItems.map((f) => {
                  const v = f.votes ?? { must: 0, should: 0, could: 0, total: 0, weighted: 0 };
                  const isExpanded = expanded[f.id];
                  const isLong = f.wish.length > 240;
                  return (
                    <li
                      key={f.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", f.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(f.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverCol(null);
                      }}
                      className={`rounded-lg p-3 text-sm cursor-grab active:cursor-grabbing ${
                        f.hidden ? "bg-red-50 border border-red-300" : "bg-cream/50"
                      } ${draggingId === f.id ? "opacity-40" : ""}`}
                    >
                      <p
                        className={`font-semibold text-mn-blue mb-2 leading-snug whitespace-pre-wrap break-words ${
                          !isExpanded && isLong ? "line-clamp-6" : ""
                        }`}
                      >
                        &ldquo;{f.wish}&rdquo;
                      </p>
                      {isLong && (
                        <button
                          onClick={() => setExpanded((s) => ({ ...s, [f.id]: !s[f.id] }))}
                          className="text-[11px] font-bold uppercase tracking-widest text-mn-blue hover:underline mb-2"
                        >
                          {isExpanded ? "Show less" : "Show full"}
                        </button>
                      )}
                      <p className="text-[11px] text-dark-gray/60 mb-1">
                        {f.role || "—"} · {f.organization || "—"} · {f.state || "—"}
                      </p>
                      {f.email && (
                        <p className="text-[11px] mb-2 flex items-center gap-1 break-all">
                          <a href={`mailto:${f.email}`} className="text-mn-blue hover:underline font-semibold">
                            {f.email}
                          </a>
                          {f.notify_on_launch && (
                            <span className="bg-accent-gold text-mn-blue px-1 rounded text-[9px] font-black uppercase">
                              Notify
                            </span>
                          )}
                          <button
                            onClick={() => copyEmail(f.email!)}
                            className="ml-auto text-[10px] font-bold uppercase text-dark-gray/70 hover:text-mn-blue"
                            title="Copy email"
                          >
                            Copy
                          </button>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mb-2 text-[10px] font-bold tabular-nums">
                        <span className="bg-mn-green text-white rounded px-1.5 py-0.5">Must {v.must}</span>
                        <span className="bg-accent-teal text-white rounded px-1.5 py-0.5">
                          Should {v.should}
                        </span>
                        <span className="bg-dark-gray text-white rounded px-1.5 py-0.5">Nice {v.could}</span>
                        <span className="bg-mn-blue text-white rounded px-1.5 py-0.5">
                          Wt {v.weighted}
                        </span>
                      </div>
                      <p className="text-[11px] text-dark-gray/60 mb-3 tabular-nums">
                        Received {new Date(f.created_at).toLocaleString()}
                        {f.shipped_at ? ` · Shipped ${new Date(f.shipped_at).toLocaleString()}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-1 items-center">
                        {(f.status === "new" || f.status === "planned") && (
                          <button
                            onClick={() => onStartBuilding(f.id, f.wish)}
                            className="text-[11px] font-bold bg-accent-teal text-white px-2 py-1 rounded hover:brightness-110"
                          >
                            ▶ Start building
                          </button>
                        )}
                        <label className="text-[11px] font-bold flex items-center gap-1">
                          <span className="sr-only">Move to</span>
                          <select
                            value=""
                            onChange={(e) => {
                              const v = e.target.value as Status | "";
                              if (v) onStatus(f.id, v);
                            }}
                            className="text-[11px] font-bold bg-mn-blue text-white px-2 py-1 rounded hover:brightness-110 cursor-pointer"
                          >
                            <option value="">Move to…</option>
                            {columns
                              .filter((c) => c.key !== f.status)
                              .map((c) => (
                                <option key={c.key} value={c.key}>
                                  {c.label}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button
                          onClick={() => onHide(f.id, !f.hidden)}
                          className={`text-[11px] font-bold px-2 py-1 rounded ${
                            f.hidden ? "bg-mn-green text-white" : "bg-red-600 text-white"
                          } hover:brightness-110`}
                        >
                          {f.hidden ? "Restore" : "Hide"}
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTarget({ id: f.id, wish: f.wish });
                            setDeleteConfirm("");
                          }}
                          className="text-[11px] font-bold px-2 py-1 rounded bg-white border border-red-600 text-red-700 hover:bg-red-600 hover:text-white ml-auto"
                          title="Permanently delete"
                          aria-label="Delete feedback"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
                {colItems.length === 0 && (
                  <li className="text-xs italic text-dark-gray/50 text-center py-4">Empty</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirm("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete this feedback?</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3">
              <p className="text-sm bg-cream border border-light-gray rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-auto">
                &ldquo;{deleteTarget.wish}&rdquo;
              </p>
              <p className="text-sm text-dark-gray/70">
                This cannot be undone. Type <span className="font-black text-red-700">DELETE</span> to
                confirm.
              </p>
              <input
                autoFocus
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deleteConfirm === "DELETE") confirmDelete();
                }}
                className="w-full border-2 border-light-gray focus:border-red-600 rounded-lg px-3 py-2 outline-none font-mono"
                placeholder="Type DELETE"
              />
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirm("");
              }}
              className="text-sm font-bold px-4 py-2 rounded bg-light-gray/50 hover:bg-light-gray"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleteConfirm !== "DELETE"}
              className="text-sm font-bold px-4 py-2 rounded bg-red-600 text-white disabled:opacity-40 hover:brightness-110"
            >
              Delete forever
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
