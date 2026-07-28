import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  improvementsQuery,
  gameSettingsQuery,
  activeRoundQuery,
  activeBuildRunQuery,
} from "@/lib/game.queries";
import {
  setImprovementEnabled,
  setBeforeAfter,
  resetImprovements,
  resetLeaderboard,
  startVoteRound,
  endAndApplyRound,
  finalizeBuildRun,
  replayBuildRun,
  cancelBuildRun,
  IMPROVEMENT_KEYS,
  type ImprovementKey,
} from "@/lib/game.functions";

export const Route = createFileRoute("/admin/game")({
  head: () => ({
    meta: [
      { title: "Demo Game — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminGamePage,
});

function AdminGamePage() {
  const qc = useQueryClient();
  const { data: improvements = [] } = useQuery(improvementsQuery);
  const { data: settings } = useQuery(gameSettingsQuery);
  const { data: round } = useQuery(activeRoundQuery);
  const { data: buildRun } = useQuery(activeBuildRunQuery);
  const toggle = useServerFn(setImprovementEnabled);
  const setMode = useServerFn(setBeforeAfter);
  const reset = useServerFn(resetImprovements);
  const startRound = useServerFn(startVoteRound);
  const endRound = useServerFn(endAndApplyRound);
  const wipeScores = useServerFn(resetLeaderboard);
  const finishBuild = useServerFn(finalizeBuildRun);
  const replayBuild = useServerFn(replayBuildRun);
  const stopBuild = useServerFn(cancelBuildRun);

  const [selected, setSelected] = useState<Set<ImprovementKey>>(new Set());
  const [durationMin, setDurationMin] = useState(10);
  const [replayKey, setReplayKey] = useState<ImprovementKey>(IMPROVEMENT_KEYS[0]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-game")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_improvements" }, () =>
        qc.invalidateQueries({ queryKey: ["game_improvements"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_improvement_votes" },
        () => {
          qc.invalidateQueries({ queryKey: ["game_improvements"] });
          qc.invalidateQueries({ queryKey: ["game_round"] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "game_settings" }, () =>
        qc.invalidateQueries({ queryKey: ["game_settings"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "game_vote_rounds" }, () =>
        qc.invalidateQueries({ queryKey: ["game_round"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "game_build_runs" }, () =>
        qc.invalidateQueries({ queryKey: ["game_build_run"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const mode = settings?.before_after ?? "before";
  const disabledImprovements = useMemo(
    () => improvements.filter((i) => !i.enabled),
    [improvements],
  );
  const secondsLeft = useCountdown(round?.endsAt ?? null);
  const buildEndsAt = buildRun
    ? new Date(new Date(buildRun.startedAt).getTime() + buildRun.durationSec * 1000).toISOString()
    : null;
  const buildSecondsLeft = useCountdown(buildEndsAt);
  const buildLabel =
    improvements.find((i) => i.key === buildRun?.improvementKey)?.label ??
    buildRun?.improvementKey ??
    "";


  async function handleToggle(key: ImprovementKey, enabled: boolean) {
    await toggle({ data: { key, enabled } });
    toast.success(enabled ? "Enabled" : "Disabled");
  }
  async function handleMode(next: "before" | "after") {
    await setMode({ data: { mode: next } });
    toast.success(`Broadcasting ${next.toUpperCase()}`);
  }
  async function handleReset() {
    if (!confirm("Reset all improvements to disabled and clear all votes?")) return;
    await reset();
    toast.success("Reset");
  }
  async function handleStartRound(auto: boolean) {
    try {
      const keys = auto ? undefined : Array.from(selected);
      const res = await startRound({
        data: { candidateKeys: keys, durationSec: durationMin * 60, count: 5 },
      });
      toast.success(`Round started (${durationMin} min)`);
      setSelected(new Set());
      void res;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start round");
    }
  }
  async function handleEndRound() {
    const res = await endRound();
    if (res.winner) toast.success(`Applied winner: ${res.winner.key} (${res.winner.votes} votes)`);
    else toast.info("No winner to apply");
  }
  async function handleResetScores() {
    if (!confirm("Wipe the entire High Scores leaderboard? This cannot be undone.")) return;
    try {
      await wipeScores();
      toast.success("High scores cleared.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset high scores");
    }
  }

  function toggleSelect(k: ImprovementKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-mn-blue uppercase tracking-wide mb-2">
        Demo Game
      </h1>
      <p className="text-sm text-dark-gray/70 mb-6">
        Toggle UX improvements live, or run a 5-minute voting round so attendees pick the next
        one to apply.
      </p>

      {/* Before/After */}
      <section className="mb-6 bg-cream border-2 border-mn-blue/30 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-mn-blue uppercase tracking-wide text-sm mb-1">
              Broadcast Before / After
            </h2>
            <p className="text-xs text-dark-gray/70">Flips the game for every viewer.</p>
          </div>
          <div className="inline-flex rounded-full border-2 border-mn-blue/40 bg-white p-1">
            <button
              onClick={() => handleMode("before")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase ${
                mode === "before" ? "bg-accent-orange text-white" : "text-mn-blue"
              }`}
            >
              Before
            </button>
            <button
              onClick={() => handleMode("after")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase ${
                mode === "after" ? "bg-mn-green text-white" : "text-mn-blue"
              }`}
            >
              After
            </button>
          </div>
        </div>
      </section>

      {/* Voting round */}
      <section className="mb-6 bg-white border-2 border-accent-orange/60 rounded-lg p-4">
        <h2 className="font-bold text-mn-blue uppercase tracking-wide text-sm mb-3">
          Live Voting Round
        </h2>
        {round ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-semibold text-dark-gray">
                Round in progress — <b>{fmtCountdown(secondsLeft)}</b> remaining
              </span>
              <button
                onClick={handleEndRound}
                className="bg-mn-green text-white font-bold text-sm px-4 py-2 rounded hover:brightness-110"
              >
                End round & apply winner
              </button>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {round.candidates.map((c) => (
                <li key={c.key} className="border-2 border-light-gray rounded p-2 bg-cream">
                  <div className="font-bold text-mn-blue text-sm">{c.label}</div>
                  <div className="text-xs text-dark-gray/70">{c.description}</div>
                  <div className="text-lg font-black text-accent-orange mt-1 tabular-nums">
                    {c.votes} votes
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-dark-gray/70">
              Start a voting round. Attendees will see a countdown and can cast one vote. Pick
              candidates below or leave empty to auto-pick 5.
            </p>
            <div className="flex flex-wrap gap-2">
              {disabledImprovements.map((imp) => (
                <button
                  key={imp.key}
                  onClick={() => toggleSelect(imp.key)}
                  className={`text-xs font-bold px-3 py-1 rounded-full border-2 ${
                    selected.has(imp.key)
                      ? "bg-mn-blue text-white border-mn-blue"
                      : "bg-white text-mn-blue border-mn-blue/40"
                  }`}
                >
                  {imp.label}
                </button>
              ))}
              {disabledImprovements.length === 0 && (
                <span className="text-xs text-dark-gray/60">
                  All improvements already applied.
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs font-semibold text-dark-gray">
                Duration:{" "}
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={durationMin}
                  onChange={(e) => setDurationMin(Math.max(1, Number(e.target.value) || 5))}
                  className="w-16 border-2 border-mn-blue/40 rounded px-2 py-1 ml-1"
                />{" "}
                min
              </label>
              <button
                onClick={() => handleStartRound(false)}
                disabled={selected.size < 2 || disabledImprovements.length < 2}
                className="bg-mn-blue text-white font-bold text-sm px-4 py-2 rounded hover:brightness-110 disabled:opacity-40"
              >
                Start round ({selected.size} picked)
              </button>
              <button
                onClick={() => handleStartRound(true)}
                disabled={disabledImprovements.length < 2}
                className="bg-accent-orange text-white font-bold text-sm px-4 py-2 rounded hover:brightness-110 disabled:opacity-40"
              >
                Start next round ({disabledImprovements.length} option{disabledImprovements.length === 1 ? "" : "s"})
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={handleReset}
          className="bg-white border-2 border-red-500 text-red-600 font-bold text-sm px-4 py-2 rounded hover:bg-red-50"
        >
          Reset all improvements & votes
        </button>
        <button
          onClick={handleResetScores}
          className="bg-white border-2 border-red-500 text-red-600 font-bold text-sm px-4 py-2 rounded hover:bg-red-50"
        >
          Reset High Scores leaderboard
        </button>
      </section>

      <div className="border-2 border-light-gray rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-mn-blue text-white text-left">
            <tr>
              <th className="px-4 py-2 font-bold">Improvement</th>
              <th className="px-4 py-2 font-bold text-right">Votes</th>
              <th className="px-4 py-2 font-bold text-center">In game</th>
            </tr>
          </thead>
          <tbody>
            {IMPROVEMENT_KEYS.map((key) => {
              const imp = improvements.find((i) => i.key === key);
              if (!imp) return null;
              return (
                <tr key={key} className="border-t border-light-gray">
                  <td className="px-4 py-3">
                    <div className="font-bold text-mn-blue">{imp.label}</div>
                    <div className="text-xs text-dark-gray/70">{imp.description}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-black tabular-nums text-mn-blue text-lg">
                    {imp.votes}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={imp.enabled}
                        onChange={(e) => handleToggle(key, e.target.checked)}
                        className="h-5 w-5 accent-mn-green"
                      />
                      <span
                        className={`text-xs font-bold uppercase tracking-wide ${
                          imp.enabled ? "text-mn-green" : "text-dark-gray/50"
                        }`}
                      >
                        {imp.enabled ? "On" : "Off"}
                      </span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useCountdown(endsAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return 0;
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
}

function fmtCountdown(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
