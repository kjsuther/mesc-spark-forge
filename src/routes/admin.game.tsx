import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { improvementsQuery, gameSettingsQuery } from "@/lib/game.queries";
import {
  setImprovementEnabled,
  setBeforeAfter,
  applyTopVote,
  resetImprovements,
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
  const toggle = useServerFn(setImprovementEnabled);
  const setMode = useServerFn(setBeforeAfter);
  const applyTop = useServerFn(applyTopVote);
  const reset = useServerFn(resetImprovements);

  useEffect(() => {
    const ch = supabase
      .channel("admin-game")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_improvements" },
        () => qc.invalidateQueries({ queryKey: ["game_improvements"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_improvement_votes" },
        () => qc.invalidateQueries({ queryKey: ["game_improvements"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_settings" },
        () => qc.invalidateQueries({ queryKey: ["game_settings"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const totalVotes = improvements.reduce((s, i) => s + i.votes, 0);
  const mode = settings?.before_after ?? "before";

  async function handleToggle(key: ImprovementKey, enabled: boolean) {
    await toggle({ data: { key, enabled } });
    qc.invalidateQueries({ queryKey: ["game_improvements"] });
    toast.success(`${enabled ? "Enabled" : "Disabled"}`);
  }

  async function handleMode(next: "before" | "after") {
    await setMode({ data: { mode: next } });
    qc.invalidateQueries({ queryKey: ["game_settings"] });
    toast.success(`Broadcasting ${next.toUpperCase()}`);
  }

  async function handleApplyTop() {
    const res = await applyTop();
    qc.invalidateQueries({ queryKey: ["game_improvements"] });
    if (res.key) toast.success(`Applied: ${res.key}`);
    else toast.info("No unapplied improvement has votes yet.");
  }

  async function handleReset() {
    if (!confirm("Reset all improvements to disabled and clear all votes?")) return;
    await reset();
    qc.invalidateQueries({ queryKey: ["game_improvements"] });
    toast.success("Reset");
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-mn-blue uppercase tracking-wide mb-2">
        Demo Game
      </h1>
      <p className="text-sm text-dark-gray/70 mb-6">
        Toggle UX improvements live during the demo. Changes broadcast to every open game canvas
        (including Poster View) in real time.
      </p>

      <section className="mb-6 bg-cream border-2 border-mn-blue/30 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-mn-blue uppercase tracking-wide text-sm mb-1">
              Broadcast Before / After
            </h2>
            <p className="text-xs text-dark-gray/70">
              Flips the game canvas for every viewer.
            </p>
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

      <section className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={handleApplyTop}
          className="bg-mn-blue text-white font-bold text-sm px-4 py-2 rounded hover:brightness-110"
        >
          Apply top-voted improvement
        </button>
        <button
          onClick={handleReset}
          className="bg-white border-2 border-red-500 text-red-600 font-bold text-sm px-4 py-2 rounded hover:bg-red-50"
        >
          Reset all
        </button>
        <span className="ml-auto self-center text-xs font-semibold text-dark-gray/70">
          {totalVotes} total votes cast
        </span>
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
