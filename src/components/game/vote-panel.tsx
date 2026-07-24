import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  improvementsQuery,
  activeRoundQuery,
  myRoundVoteQuery,
} from "@/lib/game.queries";
import { getVoterId } from "@/lib/voter";

export function VotePanel({ highlight = false }: { highlight?: boolean }) {
  const queryClient = useQueryClient();
  const [voterId, setVoterId] = useState("");
  useEffect(() => setVoterId(getVoterId()), []);

  const { data: improvements = [] } = useQuery(improvementsQuery);
  const { data: round } = useQuery(activeRoundQuery);
  const { data: myVote } = useQuery(myRoundVoteQuery(voterId, round?.id ?? null));

  useEffect(() => {
    const channel = supabase
      .channel("game-vote-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_improvement_votes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["game_improvements"] });
          queryClient.invalidateQueries({ queryKey: ["game_round"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_improvements" },
        () => queryClient.invalidateQueries({ queryKey: ["game_improvements"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_vote_rounds" },
        () => queryClient.invalidateQueries({ queryKey: ["game_round"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const secondsLeft = useCountdown(round?.endsAt ?? null);
  const roundActive = !!round && secondsLeft > 0;

  const appliedList = useMemo(() => improvements.filter((i) => i.enabled), [improvements]);

  async function castRoundVote(key: string) {
    if (!voterId || !round) return;
    if (myVote) {
      toast.info("You've already voted in this round.");
      return;
    }
    const { data, error } = await supabase.rpc("cast_round_vote", {
      _improvement_key: key,
      _voter_fingerprint: voterId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const first = Array.isArray(data) ? data[0] : data;
    if (first && !first.ok) {
      toast.error(first.message ?? "Vote rejected");
      return;
    }
    toast.success("Vote counted");
    queryClient.invalidateQueries({ queryKey: ["game_round"] });
  }

  return (
    <section
      className={`mt-8 rounded-xl p-5 border-2 ${
        highlight
          ? "border-accent-orange bg-accent-orange/10 shadow-lg"
          : "border-mn-blue/30 bg-cream/50"
      }`}
    >
      <header className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-display uppercase tracking-wider text-mn-blue text-xl">
            ★ What should we improve next?
          </h2>
          <p className="text-sm text-dark-gray/70 mt-1">
            {roundActive
              ? "A voting round is live. Pick the improvement you want added to the trail — the winner ships when the timer ends."
              : "No round active yet. The presenter will open a 5-minute vote soon."}
          </p>
        </div>
        {roundActive && (
          <span className="text-xs font-bold uppercase tracking-widest text-white bg-accent-orange px-3 py-1 rounded-full">
            {fmtCountdown(secondsLeft)} left
          </span>
        )}
      </header>

      {roundActive && round ? (
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {round.candidates.map((c) => {
            const voted = myVote === c.key;
            const disabled = !!myVote && !voted;
            return (
              <li
                key={c.key}
                className={`border-2 rounded-lg p-3 transition-colors bg-white ${
                  voted
                    ? "border-accent-orange"
                    : disabled
                    ? "border-light-gray opacity-70"
                    : "border-mn-blue/40 hover:border-mn-blue"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => castRoundVote(c.key)}
                    disabled={!!myVote}
                    aria-pressed={voted}
                    className={`w-11 h-11 rounded-full border-2 grid place-items-center shrink-0 font-black text-sm ${
                      voted
                        ? "bg-accent-orange text-white border-accent-orange"
                        : "bg-white text-mn-blue border-mn-blue/50 hover:bg-mn-blue hover:text-white"
                    }`}
                  >
                    {voted ? "\u2713" : "+1"}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-mn-blue">{c.label}</div>
                    <p className="text-xs text-dark-gray/70 mt-1 leading-snug">{c.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-black tabular-nums text-mn-blue">{c.votes}</div>
                    <div className="text-[9px] uppercase tracking-widest text-dark-gray/60 font-bold">
                      votes
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-center py-6 text-sm text-dark-gray/70">
          <p className="mb-2">Waiting for the next voting round to open…</p>
          {appliedList.length > 0 && (
            <p className="text-xs">
              Already applied: <b>{appliedList.map((a) => a.label).join(", ")}</b>
            </p>
          )}
        </div>
      )}
    </section>
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
