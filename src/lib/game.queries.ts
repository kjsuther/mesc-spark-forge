import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

