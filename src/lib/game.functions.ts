import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./admin-session.server";

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

export const resetLeaderboard = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("game_scores")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
  return { ok: true as const };
});
