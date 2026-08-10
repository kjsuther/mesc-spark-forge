import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  shipIt,
  clearNowBuilding,
  listAllFeedbackAdmin,
  setFeedbackStatus,
  startBuilding,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/now-building")({
  component: NowBuildingAdmin,
});

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+.][\w.-]+)?$/;

function bumpPatch(semver: string | null | undefined): string {
  if (!semver) return "";
  const m = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(semver.trim());
  if (!m) return "";
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

function NowBuildingAdmin() {
  const router = useRouter();
  const ship = useServerFn(shipIt);
  const clearAll = useServerFn(clearNowBuilding);
  const fetchAll = useServerFn(listAllFeedbackAdmin);
  const changeStatus = useServerFn(setFeedbackStatus);
  const startBuild = useServerFn(startBuilding);

  const { data: currentVersion, refetch: refetchVersion } = useQuery({
    queryKey: ["admin-current-version"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("versions")
        .select("semver")
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: allFeedback, refetch: refetchFeedback } = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: () => fetchAll(),
    refetchInterval: 10_000,
  });

  const inProgress = useMemo(
    () => (allFeedback ?? []).filter((f) => f.status === "in_progress" && !f.hidden),
    [allFeedback],
  );

  const topCandidates = useMemo(() => {
    const rows = allFeedback ?? [];
    return rows
      .filter((r) => (r.status === "planned" || r.status === "new") && !r.hidden)
      .sort((a, b) => (b.votes?.weighted ?? 0) - (a.votes?.weighted ?? 0))
      .slice(0, 3);
  }, [allFeedback]);

  async function onClearBanner() {
    if (!confirm("Move all in-progress items back to Planned and hide the Now Building banner?"))
      return;
    await clearAll();
    toast.success("Banner cleared");
    refetchFeedback();
    router.invalidate();
  }

  async function onMoveBack(id: string) {
    await changeStatus({ data: { id, status: "planned" } });
    toast.success("Moved back to Planned");
    refetchFeedback();
    router.invalidate();
  }

  async function onStartBuilding(id: string, wish: string) {
    if (!confirm(`Add to Now Building?\n\n"${wish}"`)) return;
    await startBuild({ data: { feedbackId: id } });
    toast.success("Added to Now Building");
    refetchFeedback();
    router.invalidate();
  }

  // Ship It — derived state
  const suggestedSemver = useMemo(
    () => bumpPatch(currentVersion?.semver),
    [currentVersion?.semver],
  );
  const [shipFeedbackIds, setShipFeedbackIds] = useState<string[]>([]);
  const [shipSemver, setShipSemver] = useState("");
  const [shipTitle, setShipTitle] = useState("");
  const [shipNotes, setShipNotes] = useState("");
  const [shipTouched, setShipTouched] = useState({ semver: false, title: false, notes: false });
  const [shipping, setShipping] = useState(false);

  // Auto-select all in-progress items by default; keep selection in sync as items appear/disappear.
  useEffect(() => {
    const validIds = new Set(inProgress.map((f) => f.id));
    setShipFeedbackIds((prev) => {
      const filtered = prev.filter((id) => validIds.has(id));
      // If nothing user-picked yet, default to all in-progress.
      if (filtered.length === 0 && inProgress.length > 0) {
        return inProgress.map((f) => f.id);
      }
      return filtered;
    });
  }, [inProgress]);

  const selectedItems = inProgress.filter((f) => shipFeedbackIds.includes(f.id));

  // Auto-generate a version title from selected wishes.
  const autoTitle = useMemo(() => {
    const shorten = (w: string, maxWords = 6) => {
      const cleaned = w.replace(/[.!?]+$/, "").trim();
      const words = cleaned.split(/\s+/);
      if (words.length <= maxWords) return cleaned;
      return words.slice(0, maxWords).join(" ") + "…";
    };
    const n = selectedItems.length;
    if (n === 0) return "";
    if (n === 1) return shorten(selectedItems[0].wish, 10);
    if (n === 2)
      return `${shorten(selectedItems[0].wish, 5)} & ${shorten(selectedItems[1].wish, 5)}`;
    return `Release with ${n} updates: ${shorten(selectedItems[0].wish, 4)}, ${shorten(selectedItems[1].wish, 4)} & ${n - 2} more`;
  }, [selectedItems]);

  const effectiveSemver = shipTouched.semver ? shipSemver : suggestedSemver;
  const effectiveTitle = shipTouched.title ? shipTitle : autoTitle;
  const effectiveNotes = shipTouched.notes
    ? shipNotes
    : selectedItems.length > 1
      ? selectedItems.map((s) => `• ${s.wish}`).join("\n")
      : "";

  const semverValid = SEMVER_RE.test(effectiveSemver.trim());
  const titleValid = effectiveTitle.trim().length > 0;

  function toggleShipId(id: string) {
    setShipFeedbackIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setShipTouched((t) => ({ ...t, title: false, notes: false }));
  }

  function resetShipDraft() {
    setShipTouched({ semver: false, title: false, notes: false });
    setShipSemver("");
    setShipTitle("");
    setShipNotes("");
  }

  async function onShip(e: React.FormEvent) {
    e.preventDefault();
    if (!semverValid) {
      toast.error("Semver must look like 1.2.3");
      return;
    }
    if (!titleValid) {
      toast.error("Version title is required.");
      return;
    }
    setShipping(true);
    try {
      await ship({
        data: {
          semver: effectiveSemver.trim(),
          title: effectiveTitle.trim(),
          notes: effectiveNotes.trim() || null,
          feedbackIds: shipFeedbackIds,
        },
      });
      toast.success(`Shipped v${effectiveSemver} — ${effectiveTitle}`);
      setShipFeedbackIds([]);
      resetShipDraft();
      refetchFeedback();
      refetchVersion();
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ship failed");
    } finally {
      setShipping(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-12">
      <nav className="flex gap-3 text-xs font-bold uppercase tracking-widest text-mn-blue">
        <a href="#now-building" className="hover:underline">
          Now Building
        </a>
        <span className="text-dark-gray/40">/</span>
        <a href="#ship-release" className="hover:underline">
          Ship a release
        </a>
      </nav>

      <section id="now-building">
        <h1 className="font-display text-3xl text-mn-blue uppercase tracking-wide mb-2">
          Now Building
        </h1>
        <p className="text-sm text-dark-gray/70 mb-4">
          Anything you drop into the <strong>Building</strong> column on Feedback Triage — or add
          from the candidates list below — shows up in the live "Now Building" banner. No retyping.
        </p>

        <div className="mb-6 border-2 border-mn-blue/30 rounded-2xl bg-mn-blue/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-mn-blue">
              Currently building ({inProgress.length})
            </p>
            {inProgress.length > 0 && (
              <button
                type="button"
                onClick={onClearBanner}
                className="text-[11px] font-bold uppercase tracking-widest bg-white border-2 border-red-600 text-red-700 px-3 py-1.5 rounded hover:bg-red-600 hover:text-white"
              >
                Clear banner
              </button>
            )}
          </div>
          {inProgress.length === 0 ? (
            <p className="text-sm text-dark-gray/60 italic">
              Nothing in Building. Use the Feedback Triage kanban (drag a card into Building) or the
              candidates list below.
            </p>
          ) : (
            <ul className="space-y-2">
              {inProgress.map((f) => (
                <li
                  key={f.id}
                  className="flex items-start gap-2 bg-white rounded-lg p-3 border border-mn-blue/20"
                >
                  <span className="text-[10px] font-black bg-mn-blue text-white rounded px-1.5 py-0.5 tabular-nums shrink-0 mt-0.5">
                    Wt {f.votes?.weighted ?? 0}
                  </span>
                  <span className="flex-1 text-sm leading-snug">{f.wish}</span>
                  <button
                    type="button"
                    onClick={() => onMoveBack(f.id)}
                    className="text-[11px] font-bold uppercase bg-white border border-mn-blue text-mn-blue px-2 py-1 rounded hover:bg-mn-blue hover:text-white shrink-0"
                    title="Move back to Planned"
                  >
                    ← Planned
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {topCandidates.length > 0 && (
          <div className="border-2 border-accent-gold/60 rounded-xl p-3 bg-accent-gold/5">
            <p className="text-[11px] font-black uppercase tracking-widest text-mn-blue mb-2">
              ★ Top-voted candidates
            </p>
            <ul className="space-y-2">
              {topCandidates.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  <span className="text-[10px] font-black bg-mn-blue text-white rounded px-1.5 py-0.5 tabular-nums shrink-0 mt-0.5">
                    Wt {c.votes?.weighted ?? 0}
                  </span>
                  <span className="flex-1 leading-snug">{c.wish}</span>
                  <button
                    type="button"
                    onClick={() => onStartBuilding(c.id, c.wish)}
                    className="text-[11px] font-bold uppercase bg-accent-gold text-mn-blue px-2 py-1 rounded hover:brightness-110 shrink-0"
                  >
                    Start building
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section id="ship-release" className="border-t-2 border-light-gray pt-8">
        <h2 className="font-display text-3xl text-mn-green uppercase tracking-wide mb-2">
          Ship it live
        </h2>
        <p className="text-sm text-dark-gray/70 mb-6">
          Publishes a new version, marks the linked feedback item shipped, and removes it from Now
          Building. Current live version:{" "}
          <span className="font-bold text-mn-blue">
            {currentVersion?.semver ? `v${currentVersion.semver}` : "none yet"}
          </span>
          .
        </p>
        <form onSubmit={onShip} className="space-y-4">
          <fieldset className="block">
            <legend className="text-xs font-bold uppercase tracking-widest text-mn-blue mb-2">
              Which items are you shipping?{" "}
              {selectedItems.length > 0 && (
                <span className="text-dark-gray/60 normal-case font-normal">
                  ({selectedItems.length} selected)
                </span>
              )}
            </legend>
            {inProgress.length === 0 ? (
              <p className="text-[11px] text-dark-gray/60">
                Nothing in Building — the ship form will use whatever title/notes you type.
              </p>
            ) : (
              <ul className="space-y-2 border-2 border-light-gray rounded-lg p-3 bg-white">
                {inProgress.map((f) => {
                  const checked = shipFeedbackIds.includes(f.id);
                  return (
                    <li key={f.id}>
                      <label className="flex items-start gap-3 cursor-pointer hover:bg-mn-blue/5 rounded p-2 -m-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleShipId(f.id)}
                          className="mt-1 h-4 w-4 accent-mn-green shrink-0"
                        />
                        <span className="flex-1 text-sm leading-snug">{f.wish}</span>
                        <span className="text-[10px] font-black bg-mn-blue text-white rounded px-1.5 py-0.5 tabular-nums shrink-0 mt-0.5">
                          Wt {f.votes?.weighted ?? 0}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-mn-blue">
                Semver
              </span>
              <input
                type="text"
                placeholder={suggestedSemver || "0.1.0"}
                value={effectiveSemver}
                onChange={(e) => {
                  setShipTouched((t) => ({ ...t, semver: true }));
                  setShipSemver(e.target.value);
                }}
                pattern="^\d+\.\d+\.\d+(?:[-+.][\w.-]+)?$"
                className={`mt-1 w-full border-2 rounded-lg px-4 py-3 outline-none tabular-nums ${
                  effectiveSemver && !semverValid
                    ? "border-red-500 focus:border-red-600"
                    : "border-light-gray focus:border-mn-blue"
                }`}
                required
              />
              {effectiveSemver && !semverValid && (
                <p className="text-[11px] text-red-700 mt-1">Must look like 1.2.3</p>
              )}
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-bold uppercase tracking-widest text-mn-blue">
                Version title
              </span>
              <input
                type="text"
                value={effectiveTitle}
                onChange={(e) => {
                  setShipTouched((t) => ({ ...t, title: true }));
                  setShipTitle(e.target.value);
                }}
                className="mt-1 w-full border-2 border-light-gray focus:border-mn-blue rounded-lg px-4 py-3 outline-none"
                required
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-mn-blue">
              Changelog notes
            </span>
            <textarea
              rows={4}
              value={effectiveNotes}
              onChange={(e) => {
                setShipTouched((t) => ({ ...t, notes: true }));
                setShipNotes(e.target.value);
              }}
              className="mt-1 w-full border-2 border-light-gray focus:border-mn-blue rounded-lg px-4 py-3 outline-none"
            />
          </label>

          {(shipTouched.semver || shipTouched.title || shipTouched.notes) && (
            <button
              type="button"
              onClick={resetShipDraft}
              className="text-[11px] font-bold uppercase tracking-widest text-mn-blue hover:underline"
            >
              Reset to defaults
            </button>
          )}

          <button
            type="submit"
            disabled={shipping || !semverValid || !titleValid}
            className="bg-mn-green text-white font-black uppercase tracking-widest px-8 py-4 rounded-lg hover:brightness-110 disabled:opacity-50"
          >
            {shipping ? "Shipping…" : "🚀 Ship it live"}
          </button>
        </form>
      </section>
    </div>
  );
}
