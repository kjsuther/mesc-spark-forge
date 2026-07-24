import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ImprovementKey } from "./game.functions";

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

export function myGameVotesQuery(voterId: string) {
  return queryOptions({
    queryKey: ["game_votes", "mine", voterId],
    queryFn: async (): Promise<string[]> => {
      if (!voterId) return [];
      const { data, error } = await supabase
        .from("game_improvement_votes")
        .select("improvement_key")
        .eq("voter_fingerprint", voterId);
      if (error) throw error;
      return (data ?? []).map((r) => r.improvement_key);
    },
    enabled: !!voterId,
  });
}

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
