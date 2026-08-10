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
  role: string | null;
  role_other: string | null;
  location_state: string | null;
  location_country: string | null;
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
      .select(
        "id, description, submitter_name, status, rank, implemented_at, created_at, role, role_other, location_state, location_country",
      )
      .order("rank", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as GameFeedback[];
  },
});

/** Live dashboard aggregates for the backlog page. */
export function summarizeFeedback(rows: GameFeedback[]) {
  const roles = new Map<string, number>();
  const states = new Map<string, number>();
  const countries = new Map<string, number>();

  for (const r of rows) {
    const role = r.role === "Other" && r.role_other ? `Other — ${r.role_other}` : r.role;
    if (role) roles.set(role, (roles.get(role) ?? 0) + 1);
    if (r.location_country) {
      countries.set(r.location_country, (countries.get(r.location_country) ?? 0) + 1);
    } else if (r.location_state) {
      states.set(r.location_state, (states.get(r.location_state) ?? 0) + 1);
    }
  }

  const sort = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return {
    total: rows.length,
    implemented: rows.filter((r) => r.status === "implemented").length,
    roles: sort(roles),
    states: Object.fromEntries(states) as Record<string, number>,
    stateList: sort(states),
    countries: sort(countries),
    placesRepresented: states.size + countries.size,
  };
}


export function splitFeedback(rows: GameFeedback[]) {
  const backlog = rows
    .filter((r) => r.status === "backlog")
    .sort((a, b) => a.rank - b.rank || a.created_at.localeCompare(b.created_at));
  const implemented = rows
    .filter((r) => r.status === "implemented")
    .sort((a, b) => (b.implemented_at ?? "").localeCompare(a.implemented_at ?? ""));
  return { backlog, implemented };
}
