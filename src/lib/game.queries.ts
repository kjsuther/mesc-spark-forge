import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ImprovementKey } from "./game.functions";
import { getMyRoundVote } from "./game.functions";


export type Improvement = {
  key: ImprovementKey;
  label: string;
  description: string;
  enabled: boolean;
  sort_order: number;
};

export type ImprovementWithVotes = Improvement & { votes: number };

export const improvementsQuery = queryOptions({
  queryKey: ["game_improvements"],
  queryFn: async (): Promise<ImprovementWithVotes[]> => {
    const [imp, votes] = await Promise.all([
      supabase
        .from("game_improvements")
        .select("key, label, description, enabled, sort_order")
        .order("sort_order", { ascending: true }),
      supabase.from("game_improvement_votes").select("improvement_key"),
    ]);
    if (imp.error) throw imp.error;
    if (votes.error) throw votes.error;
    const tally = new Map<string, number>();
    for (const v of votes.data ?? []) {
      tally.set(v.improvement_key, (tally.get(v.improvement_key) ?? 0) + 1);
    }
    return (imp.data ?? []).map((i) => ({
      ...(i as Improvement),
      votes: tally.get(i.key) ?? 0,
    }));
  },
});




export const gameSettingsQuery = queryOptions({
  queryKey: ["game_settings"],
  queryFn: async (): Promise<{ before_after: "before" | "after" }> => {
    const { data, error } = await supabase
      .from("game_settings")
      .select("before_after")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return { before_after: (data?.before_after as "before" | "after") ?? "before" };
  },
});

export type ActiveRound = {
  id: string;
  endsAt: string;
  candidates: {
    key: string;
    label: string;
    description: string;
    votes: number;
  }[];
} | null;

export const activeRoundQuery = queryOptions({
  queryKey: ["game_round", "active"],
  queryFn: async (): Promise<ActiveRound> => {
    const { data: round } = await supabase
      .from("game_vote_rounds")
      .select("id, ends_at, status")
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!round) return null;

    const [{ data: cands }, { data: votes }, { data: imp }] = await Promise.all([
      supabase
        .from("game_round_candidates")
        .select("improvement_key")
        .eq("round_id", round.id),
      supabase
        .from("game_improvement_votes")
        .select("improvement_key")
        .eq("round_id", round.id),
      supabase.from("game_improvements").select("key, label, description"),
    ]);
    const impMap = new Map((imp ?? []).map((i) => [i.key, i]));
    const tally = new Map<string, number>();
    for (const v of votes ?? []) tally.set(v.improvement_key, (tally.get(v.improvement_key) ?? 0) + 1);
    return {
      id: round.id,
      endsAt: round.ends_at,
      candidates: (cands ?? []).map((c) => {
        const meta = impMap.get(c.improvement_key);
        return {
          key: c.improvement_key,
          label: meta?.label ?? c.improvement_key,
          description: meta?.description ?? "",
          votes: tally.get(c.improvement_key) ?? 0,
        };
      }),
    };
  },
});

export function myRoundVoteQuery(voterId: string, roundId: string | null) {
  return queryOptions({
    queryKey: ["game_round", "my-vote", roundId, voterId],
    queryFn: async (): Promise<string | null> => {
      if (!voterId || !roundId) return null;
      // Server-side lookup: the browser has no read access to voter fingerprints.
      const res = await getMyRoundVote({ data: { roundId, voterFingerprint: voterId } });
      return res.improvementKey;
    },

    enabled: !!voterId && !!roundId,
  });
}
