import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WinResult } from "./game-scenes";

const LS_KEY = "trailGame.name.v1";

export function computeScore(r: WinResult): number {
  return Math.max(0, 10000 - Math.floor(r.durationMs / 100)) + r.docs * 250 + r.lives * 500;
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
      duration_ms: result.durationMs,
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

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-lg border-2 border-accent-gold/70 bg-cream p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
    >
      <div className="flex-1">
        <p className="text-sm font-bold text-mn-blue">
          ★ You covered the trail — score: {score.toLocaleString()}
        </p>
        <p className="text-xs text-dark-gray/70">
          Enter your name to post to the live leaderboard.
        </p>
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
