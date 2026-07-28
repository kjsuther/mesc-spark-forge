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

// NOTE: public feedback/vote browsing was removed from the site. The browser
// has no read access to submitter emails or voter fingerprints — those columns
// are restricted by column-level grants and are only reachable through
// admin-authenticated server functions.


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
