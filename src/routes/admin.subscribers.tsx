import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  listLaunchSubscribers,
  markSubscribersNotified,
  unmarkSubscriberNotified,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/subscribers")({
  head: () => ({
    meta: [
      { title: "Launch Subscribers — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SubscribersPage,
});

type FilterMode = "unnotified" | "notified" | "all";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function csvEscape(v: string | null | undefined): string {
  const s = (v ?? "").toString();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function SubscribersPage() {
  const fetchList = useServerFn(listLaunchSubscribers);
  const markMany = useServerFn(markSubscribersNotified);
  const unmark = useServerFn(unmarkSubscriberNotified);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["admin-launch-subscribers"],
    queryFn: () => fetchList(),
    refetchInterval: 30_000,
  });

  const [filter, setFilter] = useState<FilterMode>("unnotified");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const rows = data ?? [];
  const notNotifiedCount = rows.filter((r) => !r.launch_notified_at).length;
  const notifiedCount = rows.length - notNotifiedCount;

  const filtered = useMemo(() => {
    if (filter === "unnotified") return rows.filter((r) => !r.launch_notified_at);
    if (filter === "notified") return rows.filter((r) => r.launch_notified_at);
    return rows;
  }, [rows, filter]);

  async function copyAll() {
    const emails = filtered.map((r) => r.email).filter(Boolean).join(", ");
    if (!emails) {
      toast.error("No emails in the current view.");
      return;
    }
    try {
      await navigator.clipboard.writeText(emails);
      toast.success(`Copied ${filtered.length} email${filtered.length === 1 ? "" : "s"} to clipboard.`);
    } catch {
      toast.error("Copy failed. Try downloading the CSV instead.");
    }
  }

  function downloadCsv() {
    if (!filtered.length) {
      toast.error("No rows to export.");
      return;
    }
    const header = ["email", "organization", "role", "state", "wish", "submitted_at", "notified_at"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push([
        csvEscape(r.email),
        csvEscape(r.organization),
        csvEscape(r.role),
        csvEscape(r.state),
        csvEscape(r.wish),
        csvEscape(r.created_at),
        csvEscape(r.launch_notified_at),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `launch-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function markAllShown() {
    const ids = filtered.filter((r) => !r.launch_notified_at).map((r) => r.id);
    if (!ids.length) {
      toast.info("Nothing to mark — everyone in this view is already notified.");
      return;
    }
    if (!window.confirm(`Mark ${ids.length} subscriber${ids.length === 1 ? "" : "s"} as notified?`)) return;
    setBusy(true);
    try {
      await markMany({ data: { ids } });
      toast.success(`Marked ${ids.length} as notified.`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark notified.");
    } finally {
      setBusy(false);
    }
  }

  async function markOne(id: string) {
    setBusy(true);
    try {
      await markMany({ data: { ids: [id] } });
      toast.success("Marked as notified.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function unmarkOne(id: string) {
    setBusy(true);
    try {
      await unmark({ data: { id } });
      toast.success("Un-marked. They'll show as not yet notified.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-mn-blue uppercase tracking-wide">Launch Subscribers</h1>
        <p className="text-sm text-dark-gray/80 mt-1 max-w-2xl">
          People who checked "Email me when the final version of this tool ships" on the feedback form.
          Copy the list into your mail client's BCC field, or download a CSV — then mark them as notified
          so the same person doesn't get the email twice.
        </p>
      </header>

      <div className="flex flex-wrap gap-3 items-center bg-cream border border-light-gray rounded-lg px-4 py-3 text-sm font-semibold">
        <span>Total: <span className="text-mn-blue tabular-nums">{rows.length}</span></span>
        <span className="text-dark-gray/40">·</span>
        <span>Not yet notified: <span className="text-amber-700 tabular-nums">{notNotifiedCount}</span></span>
        <span className="text-dark-gray/40">·</span>
        <span>Already notified: <span className="text-mn-green tabular-nums">{notifiedCount}</span></span>
        {isFetching && <span className="ml-auto text-xs font-normal text-dark-gray/50">Refreshing…</span>}
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="inline-flex rounded-md border border-light-gray overflow-hidden text-sm font-semibold">
          {([
            ["unnotified", `Not yet notified (${notNotifiedCount})`],
            ["notified", `Already notified (${notifiedCount})`],
            ["all", `All (${rows.length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 transition-colors ${
                filter === key ? "bg-mn-blue text-white" : "bg-white hover:bg-cream"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyAll}
            disabled={!filtered.length}
            className="text-sm font-bold bg-mn-blue text-white px-3 py-1.5 rounded hover:bg-mn-blue/90 disabled:opacity-40"
          >
            Copy all emails ({filtered.length})
          </button>
          <button
            onClick={downloadCsv}
            disabled={!filtered.length}
            className="text-sm font-bold bg-white border border-mn-blue text-mn-blue px-3 py-1.5 rounded hover:bg-cream disabled:opacity-40"
          >
            Download CSV
          </button>
          {filter !== "notified" && (
            <button
              onClick={markAllShown}
              disabled={busy || !filtered.some((r) => !r.launch_notified_at)}
              className="text-sm font-bold bg-mn-green text-white px-3 py-1.5 rounded hover:bg-mn-green/90 disabled:opacity-40"
            >
              Mark all shown as notified
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-light-gray rounded-lg py-12 px-6 text-center text-dark-gray/70">
          {rows.length === 0
            ? "No opt-ins yet. When someone checks \"Email me when the final version ships\" on the feedback form, they'll show up here."
            : "Nothing in this view. Try a different filter."}
        </div>
      ) : (
        <div className="overflow-x-auto border border-light-gray rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase tracking-wider font-bold text-dark-gray/70">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Who</th>
                <th className="px-3 py-2">Their wish</th>
                <th className="px-3 py-2 whitespace-nowrap">Submitted</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const notified = !!r.launch_notified_at;
                const isExpanded = expanded[r.id];
                const wish = r.wish ?? "";
                const showTruncate = wish.length > 120;
                return (
                  <tr key={r.id} className="border-t border-light-gray align-top">
                    <td className="px-3 py-2">
                      <a href={`mailto:${r.email}`} className="text-mn-blue hover:underline font-semibold break-all">
                        {r.email}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-dark-gray/80">
                      <div className="font-semibold">{r.organization || "—"}</div>
                      <div className="text-xs text-dark-gray/60">
                        {[r.role, r.state].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-dark-gray/80 max-w-md">
                      {isExpanded || !showTruncate ? wish : `${wish.slice(0, 120)}…`}
                      {showTruncate && (
                        <button
                          onClick={() => setExpanded((e) => ({ ...e, [r.id]: !isExpanded }))}
                          className="ml-1 text-xs text-mn-blue hover:underline"
                        >
                          {isExpanded ? "less" : "more"}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-dark-gray/70 whitespace-nowrap">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      {notified ? (
                        <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-mn-green/15 text-mn-green whitespace-nowrap">
                          Notified {fmtDate(r.launch_notified_at)}
                        </span>
                      ) : (
                        <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 whitespace-nowrap">
                          Not yet notified
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {notified ? (
                        <button
                          onClick={() => unmarkOne(r.id)}
                          disabled={busy}
                          className="text-xs font-bold text-dark-gray/70 hover:text-mn-blue disabled:opacity-40"
                        >
                          Un-mark
                        </button>
                      ) : (
                        <button
                          onClick={() => markOne(r.id)}
                          disabled={busy}
                          className="text-xs font-bold bg-mn-green text-white px-2 py-1 rounded hover:bg-mn-green/90 disabled:opacity-40"
                        >
                          Mark notified
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
