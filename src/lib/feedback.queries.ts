import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GameFeedback = {
  id: string;
  description: string;
  submitter_name: string;
  status: "backlog" | "implemented";
  rank: number;
  implemented_at: string | null;
  created_at: string;
};

/**
 * The public feedback board. Backlog items appear in the order the poster
 * team ranked them; implemented items appear newest-first.
 */
export const gameFeedbackQuery = queryOptions({
  queryKey: ["game_feedback"],
  queryFn: async (): Promise<GameFeedback[]> => {
    const { data, error } = await supabase
      .from("game_feedback")
      .select("id, description, submitter_name, status, rank, implemented_at, created_at")
      .order("rank", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as GameFeedback[];
  },
});

export function splitFeedback(rows: GameFeedback[]) {
  const backlog = rows
    .filter((r) => r.status === "backlog")
    .sort((a, b) => a.rank - b.rank || a.created_at.localeCompare(b.created_at));
  const implemented = rows
    .filter((r) => r.status === "implemented")
    .sort((a, b) => (b.implemented_at ?? "").localeCompare(a.implemented_at ?? ""));
  return { backlog, implemented };
}
