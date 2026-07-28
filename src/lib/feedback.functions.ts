import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./admin-session.server";

function clean(value: unknown, min: number, max: number, label: string): string {
  const s = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (s.length < min) throw new Error(`${label} must be at least ${min} characters.`);
  return s.slice(0, max);
}

/** Public: an attendee submits one piece of feedback about the game. */
export const submitGameFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: { description: string; submitterName: string }) => ({
    description: clean(data?.description, 3, 280, "Feedback"),
    submitterName: clean(data?.submitterName, 2, 60, "Your name"),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // New items land at the bottom of the backlog.
    const { data: last } = await supabaseAdmin
      .from("game_feedback")
      .select("rank")
      .order("rank", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("game_feedback").insert({
      description: data.description,
      submitter_name: data.submitterName,
      status: "backlog",
      rank: (last?.rank ?? 0) + 1,
    });
    if (error) throw error;
    return { ok: true as const };
  });

export const setGameFeedbackStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: "backlog" | "implemented" }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("game_feedback")
      .update({
        status: data.status,
        implemented_at: data.status === "implemented" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

/** Persist a new backlog order: ids in the order the admin arranged them. */
export const reorderGameFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: { ids: string[] }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await supabaseAdmin
        .from("game_feedback")
        .update({ rank: i + 1, updated_at: now })
        .eq("id", data.ids[i]);
      if (error) throw error;
    }
    return { ok: true as const };
  });

export const updateGameFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; description: string; submitterName: string }) => ({
    id: data.id,
    description: clean(data?.description, 3, 280, "Feedback"),
    submitterName: clean(data?.submitterName, 2, 60, "Name"),
  }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("game_feedback")
      .update({
        description: data.description,
        submitter_name: data.submitterName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteGameFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("game_feedback").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });
