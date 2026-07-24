import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { improvementsQuery, myGameVotesQuery } from "@/lib/game.queries";
import { getVoterId } from "@/lib/voter";

export function VotePanel() {
  const queryClient = useQueryClient();
  const [voterId, setVoterId] = useState("");
  useEffect(() => setVoterId(getVoterId()), []);

  const { data: improvements = [] } = useQuery(improvementsQuery);
  const { data: myVotes = [] } = useQuery(myGameVotesQuery(voterId));
  const mine = useMemo(() => new Set(myVotes), [myVotes]);

  // Realtime: refetch on any vote or improvement change
  useEffect(() => {
    const channel = supabase
      .channel("game-vote-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_improvement_votes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["game_improvements"] });
          queryClient.invalidateQueries({ queryKey: ["game_votes"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_improvements" },
        () => queryClient.invalidateQueries({ queryKey: ["game_improvements"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  async function toggleVote(key: string) {
    if (!voterId) return;
    if (mine.has(key)) {
      toast.info("You already voted for this.");
      return;
    }
    const { error } = await supabase.from("game_improvement_votes").insert({
      improvement_key: key,
      voter_fingerprint: voterId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vote counted");
    queryClient.invalidateQueries({ queryKey: ["game_improvements"] });
    queryClient.invalidateQueries({ queryKey: ["game_votes"] });
  }

  const totalVotes = improvements.reduce((sum, i) => sum + i.votes, 0);

  return (
    <section className="mt-8 bg-cream/50 border-2 border-mn-blue/30 rounded-xl p-5">
      <header className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-display uppercase tracking-wider text-mn-blue text-xl">
            ★ What should we improve next?
          </h2>
          <p className="text-sm text-dark-gray/70 mt-1">
            Vote for the UX improvements you want to see applied to the trail.
            The presenter can enable the top vote live.
          </p>
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-mn-blue bg-white px-3 py-1 rounded-full ring-1 ring-mn-blue/30">
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"} total
        </span>
      </header>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {improvements.map((imp) => {
          const voted = mine.has(imp.key);
          return (
            <li
              key={imp.key}
              className={`flex items-start gap-3 border-2 rounded-lg p-3 transition-colors ${
                imp.enabled
                  ? "border-mn-green bg-mn-green/10"
                  : voted
                  ? "border-accent-orange bg-white"
                  : "border-light-gray bg-white hover:border-mn-blue/50"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleVote(imp.key)}
                disabled={voted}
                aria-pressed={voted}
                className={`w-11 h-11 rounded border-2 grid place-items-center shrink-0 font-bold text-sm ${
                  voted
                    ? "bg-accent-orange text-white border-accent-orange cursor-default"
                    : "bg-white text-mn-blue border-mn-blue/50 hover:bg-mn-blue hover:text-white"
                }`}
                title={voted ? "You voted for this" : "Vote for this improvement"}
              >
                {voted ? "\u2713" : "+1"}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-mn-blue">{imp.label}</span>
                  {imp.enabled && (
                    <span className="text-[10px] font-black uppercase tracking-widest bg-mn-green text-white px-2 py-0.5 rounded">
                      Live in game
                    </span>
                  )}
                </div>
                <p className="text-xs text-dark-gray/70 mt-1 leading-snug">
                  {imp.description}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-black tabular-nums text-mn-blue">
                  {imp.votes}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-dark-gray/60 font-bold">
                  votes
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
