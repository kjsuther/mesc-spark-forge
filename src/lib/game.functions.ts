import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./admin-session.server";

export const IMPROVEMENT_KEYS = [
  "clearer_directions",
  "helper",
  "documents_earlier",
  "save_progress",
  "bridge",
  "plain_language",
  "phone_support",
  "translated_signs",
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
  const { error: rErr } = await supabaseAdmin
    .from("game_vote_rounds")
    .update({ status: "ended" })
    .eq("status", "active");
  if (rErr) throw rErr;
  return { ok: true as const };
});

// ---------------- Round-based voting ----------------

// Start a new voting round. Ends any active round first. Duration in seconds.
export const startVoteRound = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { candidateKeys?: string[]; durationSec?: number; count?: number }) => data,
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const durationSec = Math.min(Math.max(data.durationSec ?? 300, 30), 1800);

    // End any active round
    await supabaseAdmin
      .from("game_vote_rounds")
      .update({ status: "ended" })
      .eq("status", "active");

    // Pick candidates: use provided list, or auto-pick 3 random not-yet-enabled
    let candidateKeys = data.candidateKeys ?? [];
    if (candidateKeys.length === 0) {
      const { data: pool, error: pErr } = await supabaseAdmin
        .from("game_improvements")
        .select("key, enabled");
      if (pErr) throw pErr;
      const disabled = (pool ?? []).filter((p) => !p.enabled).map((p) => p.key);
      const shuffled = disabled.sort(() => Math.random() - 0.5);
      candidateKeys = shuffled.slice(0, Math.min(data.count ?? 3, disabled.length));
    }
    if (candidateKeys.length < 2) {
      throw new Error("Need at least 2 candidate improvements to start a round.");
    }

    const endsAt = new Date(Date.now() + durationSec * 1000).toISOString();
    const { data: round, error: rErr } = await supabaseAdmin
      .from("game_vote_rounds")
      .insert({ ends_at: endsAt, status: "active" })
      .select("id, ends_at")
      .single();
    if (rErr || !round) throw rErr ?? new Error("Failed to create round");

    const rows = candidateKeys.map((k) => ({ round_id: round.id, improvement_key: k }));
    const { error: cErr } = await supabaseAdmin.from("game_round_candidates").insert(rows);
    if (cErr) throw cErr;

    return { ok: true as const, roundId: round.id, endsAt: round.ends_at };
  });

// End the current active round and apply the winning improvement (top votes).
export const endAndApplyRound = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: round } = await supabaseAdmin
    .from("game_vote_rounds")
    .select("id")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!round) {
    // Fall back: use most recent ended round
    const { data: ended } = await supabaseAdmin
      .from("game_vote_rounds")
      .select("id")
      .eq("status", "ended")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ended) return { ok: true as const, winner: null };
    return applyRound(supabaseAdmin, ended.id);
  }

  return applyRound(supabaseAdmin, round.id);
});

async function applyRound(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  roundId: string,
) {
  const { data: candidates } = await supabaseAdmin
    .from("game_round_candidates")
    .select("improvement_key")
    .eq("round_id", roundId);
  const { data: votes } = await supabaseAdmin
    .from("game_improvement_votes")
    .select("improvement_key")
    .eq("round_id", roundId);

  const tally = new Map<string, number>();
  for (const c of candidates ?? []) tally.set(c.improvement_key, 0);
  for (const v of votes ?? []) tally.set(v.improvement_key, (tally.get(v.improvement_key) ?? 0) + 1);

  const winner = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!winner) return { ok: true as const, winner: null };

  await supabaseAdmin
    .from("game_improvements")
    .update({ enabled: true, updated_at: new Date().toISOString() })
    .eq("key", winner[0]);
  await supabaseAdmin
    .from("game_vote_rounds")
    .update({ status: "applied", winner_key: winner[0], applied_at: new Date().toISOString() })
    .eq("id", roundId);

  return { ok: true as const, winner: { key: winner[0], votes: winner[1] } };
}
