import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./admin-session.server";

export const IMPROVEMENT_KEYS = [
  "extra_lives",
  "navigator_helper",
  "chat_invincible",
  "email_umbrella",
  "resume_checkpoint",
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

  // The winning upgrade is NOT enabled here. Instead we open a "build run":
  // every screen plays the ~30s live-build sequence off the shared timestamp,
  // and the flag is flipped by finalizeBuildRun when the sequence completes.
  await supabaseAdmin
    .from("game_vote_rounds")
    .update({ status: "applied", winner_key: winner[0], applied_at: new Date().toISOString() })
    .eq("id", roundId);

  await supabaseAdmin
    .from("game_build_runs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("status", "running");

  const { data: run } = await supabaseAdmin
    .from("game_build_runs")
    .insert({
      improvement_key: winner[0],
      round_id: roundId,
      votes: winner[1],
      duration_sec: 30,
      status: "running",
      applies_flag: true,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  return { ok: true as const, winner: { key: winner[0], votes: winner[1] }, runId: run?.id ?? null };
}

// ---------------- Live "build" theatre ----------------

/**
 * Completes a build run: flips the winning upgrade's feature flag on.
 * Callable without an admin session (attendee screens finish the run when the
 * timer elapses) but only ever *after* the scripted duration has passed —
 * unless an admin forces it from the dashboard.
 */
export const finalizeBuildRun = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; force?: boolean }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run } = await supabaseAdmin
      .from("game_build_runs")
      .select("id, improvement_key, started_at, duration_sec, status, applies_flag")
      .eq("id", data.id)
      .maybeSingle();
    if (!run) return { ok: false as const, reason: "not_found" as const };
    if (run.status !== "running") return { ok: true as const, alreadyDone: true as const };

    if (data.force) {
      await requireAdmin();
    } else {
      const endsAt = new Date(run.started_at).getTime() + run.duration_sec * 1000;
      if (Date.now() < endsAt - 1000) {
        return { ok: false as const, reason: "too_early" as const };
      }
    }

    if (run.applies_flag) {
      await supabaseAdmin
        .from("game_improvements")
        .update({ enabled: true, updated_at: new Date().toISOString() })
        .eq("key", run.improvement_key);
      await supabaseAdmin
        .from("game_settings")
        .update({ before_after: "after", updated_at: new Date().toISOString() })
        .eq("id", 1);
    }

    await supabaseAdmin
      .from("game_build_runs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", run.id);

    return { ok: true as const, improvementKey: run.improvement_key };
  });

/** Admin: replay the sequence for an upgrade without changing any flags. */
export const replayBuildRun = createServerFn({ method: "POST" })
  .inputValidator((data: { key: ImprovementKey; votes?: number }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("game_build_runs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("status", "running");
    const { data: run, error } = await supabaseAdmin
      .from("game_build_runs")
      .insert({
        improvement_key: data.key,
        votes: data.votes ?? 0,
        duration_sec: 30,
        status: "running",
        applies_flag: false,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true as const, runId: run.id };
  });

/** Admin: stop the current sequence without applying anything. */
export const cancelBuildRun = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("game_build_runs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("status", "running");
  if (error) throw error;
  return { ok: true as const };
});


// ===== Public (unauthenticated) attendee voting =====
// These run server-side with the service-role client so the browser never
// needs read access to `voter_fingerprint` and never calls a SECURITY DEFINER
// RPC directly. All validation happens here.

function cleanFingerprint(fp: unknown): string | null {
  if (typeof fp !== "string") return null;
  const v = fp.trim();
  if (v.length < 8 || v.length > 200) return null;
  return v;
}

export const castRoundVote = createServerFn({ method: "POST" })
  .inputValidator((data: { improvementKey: string; voterFingerprint: string }) => data)
  .handler(async ({ data }) => {
    const fingerprint = cleanFingerprint(data.voterFingerprint);
    const key = typeof data.improvementKey === "string" ? data.improvementKey.trim() : "";
    if (!fingerprint) return { ok: false as const, message: "Invalid voter" };
    if (!key || key.length > 100) return { ok: false as const, message: "Invalid option" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: round } = await supabaseAdmin
      .from("game_vote_rounds")
      .select("id, ends_at")
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!round) return { ok: false as const, message: "No active round" };

    const { data: candidate } = await supabaseAdmin
      .from("game_round_candidates")
      .select("improvement_key")
      .eq("round_id", round.id)
      .eq("improvement_key", key)
      .maybeSingle();
    if (!candidate) return { ok: false as const, message: "Not a candidate in this round" };

    const { data: existing } = await supabaseAdmin
      .from("game_improvement_votes")
      .select("id")
      .eq("round_id", round.id)
      .eq("voter_fingerprint", fingerprint)
      .maybeSingle();
    if (existing) return { ok: false as const, message: "Already voted in this round" };

    const { error } = await supabaseAdmin
      .from("game_improvement_votes")
      .insert({ improvement_key: key, voter_fingerprint: fingerprint, round_id: round.id });
    if (error) return { ok: false as const, message: "Vote could not be recorded" };

    return { ok: true as const, message: "ok" };
  });

export const getMyRoundVote = createServerFn({ method: "POST" })
  .inputValidator((data: { roundId: string; voterFingerprint: string }) => data)
  .handler(async ({ data }): Promise<{ improvementKey: string | null }> => {
    const fingerprint = cleanFingerprint(data.voterFingerprint);
    if (!fingerprint || !data.roundId) return { improvementKey: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("game_improvement_votes")
      .select("improvement_key")
      .eq("round_id", data.roundId)
      .eq("voter_fingerprint", fingerprint)
      .maybeSingle();
    return { improvementKey: row?.improvement_key ?? null };
  });
