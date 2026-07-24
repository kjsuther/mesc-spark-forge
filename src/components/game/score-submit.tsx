import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WinResult } from "./game-scenes";

const LS_KEY = "trailGame.name.v1";

const STEP_LABELS = [
  "Step 1 · Learn you may qualify",
  "Step 2 · Start your application",
  "Step 3 · Submit your documents",
  "Step 4 · Wait for review",
  "Step 5 · Enroll in coverage",
];

export function computeScore(r: WinResult): number {
  // Score is now accumulated per-step during play (distance, jumps, enemies passed,
  // docs, zones, deaths) inside the game scene, plus win-only bonuses at end.
  return r.score;
}


export function ScoreSubmit({
  result,
  onDone,
}: {
  result: WinResult;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [first, setFirst] = useState("");
  const [initial, setInitial] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const score = computeScore(result);
  const stepLabel = STEP_LABELS[Math.min(STEP_LABELS.length - 1, Math.max(0, result.farthestZone))];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const j = JSON.parse(raw) as { first?: string; initial?: string };
        if (j.first) setFirst(j.first);
        if (j.initial) setInitial(j.initial);
      }
    } catch {
      // ignore
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const f = first.trim();
    const i = initial.trim().slice(0, 1).toUpperCase();
    if (!f) {
      toast.error("Enter your first name");
      return;
    }
    if (!i) {
      toast.error("Enter your last-name initial");
      return;
    }
    const display = `${f.slice(0, 24)} ${i}.`;
    setSubmitting(true);
    const { error } = await supabase.from("game_scores").insert({
      display_name: display,
      score,
      duration_ms: Math.max(1, result.durationMs),
      mode: result.mode,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not save score");
      return;
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ first: f, initial: i }));
    } catch {
      // ignore
    }
    setSubmitted(true);
    qc.invalidateQueries({ queryKey: ["game_scores"] });
    toast.success(`Score submitted: ${score.toLocaleString()}`);
    onDone?.();
  }

  if (submitted) {
    return (
      <div className="mt-4 rounded-lg border-2 border-mn-green/60 bg-mn-green/10 p-4 text-center">
        <p className="font-bold text-mn-green">
          Score saved · {score.toLocaleString()} pts
        </p>
        <p className="text-xs text-dark-gray/70 mt-1">
          Check the High Scores board below.
        </p>
      </div>
    );
  }

  const headline = result.won
    ? `★ You covered the trail — score: ${score.toLocaleString()}`
    : `You made it to ${stepLabel} — score: ${score.toLocaleString()}`;
  const sub = `Distance ${result.distancePx.toLocaleString()}px · Docs ${result.docs}/3 · Zones ${result.farthestZone + 1}/5 · Jumps ${result.jumpsLanded} · Enemies passed ${result.enemiesPassed}${result.deaths ? ` · Deaths ${result.deaths}` : ""}`;


  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-lg border-2 border-accent-gold/70 bg-cream p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
    >
      <div className="flex-1">
        <p className="text-sm font-bold text-mn-blue">{headline}</p>
        <p className="text-xs text-dark-gray/70">{sub}</p>
      </div>
      <label className="flex flex-col text-[11px] font-bold uppercase tracking-widest text-mn-blue/80">
        First name
        <input
          type="text"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          maxLength={24}
          className="mt-1 border-2 border-mn-blue/40 rounded px-2 py-1 text-sm font-normal normal-case tracking-normal text-dark-gray bg-white"
          placeholder="Jane"
        />
      </label>
      <label className="flex flex-col text-[11px] font-bold uppercase tracking-widest text-mn-blue/80 w-full sm:w-20">
        Last initial
        <input
          type="text"
          value={initial}
          onChange={(e) => setInitial(e.target.value.slice(0, 1).toUpperCase())}
          maxLength={1}
          className="mt-1 border-2 border-mn-blue/40 rounded px-2 py-1 text-sm font-normal normal-case tracking-normal text-dark-gray bg-white uppercase"
          placeholder="D"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="bg-accent-orange text-white font-black uppercase tracking-widest text-sm rounded px-4 py-2 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Submit"}
      </button>
    </form>
  );
}
