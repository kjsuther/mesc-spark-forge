import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./admin-session.server";
import { validateGameScoreSubmission } from "./score-validation";

/**
 * Legacy upgrade keys. The five preset upgrades are gone as a product
 * concept — feedback is now free-form — but the engine's feature-flag
 * plumbing still keys off these names, so the type stays.
 */
export const IMPROVEMENT_KEYS = [
  "extra_lives",
  "navigator_helper",
  "chat_invincible",
  "email_umbrella",
  "resume_checkpoint",
] as const;

export type ImprovementKey = (typeof IMPROVEMENT_KEYS)[number];

export const submitGameScore = createServerFn({ method: "POST" })
  .validator(validateGameScoreSubmission)
  .handler(async ({ data }) => {
    const [{ supabaseAdmin }, { enforceSubmissionCooldown }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("./public-submission.server"),
    ]);
    enforceSubmissionCooldown("score", 5_000);
    const { error } = await supabaseAdmin.from("game_scores").insert({
      display_name: data.displayName,
      score: data.score,
      duration_ms: data.durationMs,
      mode: data.mode,
    });
    if (error) throw error;
    return { ok: true as const };
  });

export const resetLeaderboard = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("game_scores")
    .select("id", { count: "exact", head: true });
  const { error } = await supabaseAdmin
    .from("game_scores")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
  // Deleted rows are copied into game_scores_archive by a database trigger,
  // so a wipe is always recoverable via restoreLastWipe().
  await supabaseAdmin.from("leaderboard_wipes").insert({ row_count: count ?? 0 });
  return { ok: true as const, removed: count ?? 0 };
});

/** Most recent wipe (for the admin banner). */
export const getLastWipe = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("leaderboard_wipes")
    .select("id, wiped_at, row_count, restored_at")
    .order("wiped_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
});

/** Re-inserts every score archived by the most recent wipe. */
export const restoreLastWipe = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: wipe } = await supabaseAdmin
    .from("leaderboard_wipes")
    .select("id, wiped_at, restored_at")
    .order("wiped_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!wipe) throw new Error("No wipe on record.");
  if (wipe.restored_at) throw new Error("That wipe has already been restored.");

  // Archive rows written within a short window of the wipe belong to it.
  const from = new Date(new Date(wipe.wiped_at).getTime() - 60_000).toISOString();
  const to = new Date(new Date(wipe.wiped_at).getTime() + 60_000).toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from("game_scores_archive")
    .select("id, display_name, score, duration_ms, mode, created_at")
    .gte("deleted_at", from)
    .lte("deleted_at", to);
  if (error) throw error;
  if (rows && rows.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("game_scores").upsert(rows);
    if (insertError) throw insertError;
  }
  await supabaseAdmin
    .from("leaderboard_wipes")
    .update({ restored_at: new Date().toISOString() })
    .eq("id", wipe.id);
  return { ok: true as const, restored: rows?.length ?? 0 };
});

