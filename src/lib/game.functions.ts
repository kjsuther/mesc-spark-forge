import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./admin-session.server";

export const IMPROVEMENT_KEYS = [
  "clearer_directions",
  "helper",
  "documents_earlier",
  "save_progress",
  "bridge",
] as const;

export type ImprovementKey = (typeof IMPROVEMENT_KEYS)[number];

export const setImprovementEnabled = createServerFn({ method: "POST" })
  .inputValidator((data: { key: ImprovementKey; enabled: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("game_improvements")
      .update({ enabled: data.enabled, updated_at: new Date().toISOString() })
      .eq("key", data.key);
    if (error) throw error;
    return { ok: true as const };
  });

export const applyTopVote = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: improvements, error: iErr }, { data: votes, error: vErr }] = await Promise.all([
    supabaseAdmin.from("game_improvements").select("key, enabled"),
    supabaseAdmin.from("game_improvement_votes").select("improvement_key"),
  ]);
  if (iErr) throw iErr;
  if (vErr) throw vErr;
  const tally = new Map<string, number>();
  for (const v of votes ?? []) {
    tally.set(v.improvement_key, (tally.get(v.improvement_key) ?? 0) + 1);
  }
  const disabled = (improvements ?? []).filter((i) => !i.enabled);
  if (disabled.length === 0) return { ok: true as const, key: null };
  const top = disabled
    .map((i) => ({ key: i.key, votes: tally.get(i.key) ?? 0 }))
    .sort((a, b) => b.votes - a.votes)[0];
  if (!top || top.votes === 0) return { ok: true as const, key: null };
  const { error } = await supabaseAdmin
    .from("game_improvements")
    .update({ enabled: true, updated_at: new Date().toISOString() })
    .eq("key", top.key);
  if (error) throw error;
  return { ok: true as const, key: top.key };
});

export const resetImprovements = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("game_improvements")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .neq("key", "");
  if (error) throw error;
  const { error: vErr } = await supabaseAdmin
    .from("game_improvement_votes")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (vErr) throw vErr;
  return { ok: true as const };
});

export const setBeforeAfter = createServerFn({ method: "POST" })
  .inputValidator((data: { mode: "before" | "after" }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("game_settings")
      .update({ before_after: data.mode, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw error;
    return { ok: true as const };
  });
