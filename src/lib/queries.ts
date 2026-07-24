import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Feedback = {
  id: string;
  created_at: string;
  wish: string;
  organization: string | null;
  role: string | null;
  state: string | null;
  moscow: "must" | "should" | "could";
  status: "new" | "planned" | "in_progress" | "shipped";
  priority_rank: number | null;
  action_slug: string | null;
  shipped_at: string | null;
};

export type Vote = { id: string; feedback_id: string; voter_fingerprint: string | null; bucket: "must" | "should" | "could" };
export type Version = {
  id: string;
  semver: string;
  released_at: string;
  title: string;
  notes: string | null;
  is_current: boolean;
  snapshot: import("./snapshot").ToolSnapshot | null;
};
export type CurrentWork = {
  id: number;
  feature_title: string;
  feature_description: string | null;
  started_at: string;
  updated_at: string;
};

// Public column list — excludes email + notify_on_launch, which are restricted
// by column-level GRANTs so they never reach the browser.
const PUBLIC_FEEDBACK_COLUMNS =
  "id, created_at, wish, organization, role, state, moscow, status, priority_rank, action_slug, shipped_at, hidden";

export const feedbackListQuery = queryOptions({
  queryKey: ["feedback"],
  queryFn: async (): Promise<Feedback[]> => {
    const { data, error } = await supabase
      .from("feedback")
      .select(PUBLIC_FEEDBACK_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Feedback[];
  },
  refetchInterval: 10_000,
  refetchIntervalInBackground: false,
});

// Aggregate votes for everyone: voter_fingerprint is column-restricted and never
// returned publicly. Personal vote membership is fetched separately via
// myVotesQuery, which filters server-side by fingerprint.
export const votesListQuery = queryOptions({
  queryKey: ["votes"],
  queryFn: async (): Promise<Vote[]> => {
    const { data, error } = await supabase.from("votes").select("id, feedback_id, bucket");
    if (error) throw error;
    return (data ?? []).map((v) => ({ ...v, voter_fingerprint: null })) as Vote[];
  },
  refetchInterval: 10_000,
  refetchIntervalInBackground: false,
});

export function myVotesQuery(voterId: string) {
  return queryOptions({
    queryKey: ["votes", "mine", voterId],
    queryFn: async (): Promise<{ id: string; feedback_id: string; bucket: "must" | "should" | "could" }[]> => {
      if (!voterId) return [];
      const { data, error } = await supabase.rpc("get_my_votes", {
        _voter_fingerprint: voterId,
      });
      if (error) throw error;
      return (data ?? []) as { id: string; feedback_id: string; bucket: "must" | "should" | "could" }[];
    },
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    enabled: !!voterId,
  });
}

export const versionsQuery = queryOptions({
  queryKey: ["versions"],
  queryFn: async (): Promise<Version[]> => {
    const { data, error } = await supabase
      .from("versions")
      .select("*")
      .order("released_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Version[];
  },
});

export const currentWorkQuery = queryOptions({
  queryKey: ["current_work"],
  queryFn: async (): Promise<CurrentWork | null> => {
    const { data, error } = await supabase
      .from("current_work")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data as CurrentWork | null;
  },
});

export type NowBuildingItem = { id: string; wish: string; started_at: string };

export const nowBuildingQuery = queryOptions({
  queryKey: ["now_building"],
  queryFn: async (): Promise<NowBuildingItem[]> => {
    const { data, error } = await supabase
      .from("feedback")
      .select("id, wish, created_at")
      .eq("status", "in_progress")
      .eq("hidden", false)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, wish: r.wish, started_at: r.created_at }));
  },
  refetchInterval: 15_000,
  refetchIntervalInBackground: false,
});
