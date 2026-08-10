import { createServerFn } from "@tanstack/react-start";
import { getAdminSession, passwordMatches, requireAdmin } from "./admin-session.server";
import { buildToolSnapshot } from "./snapshot";

export const getAdminStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await getAdminSession();
    return { unlocked: !!session.data.unlocked };
  } catch {
    return { unlocked: false };
  }
});

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new Error("ADMIN_PASSWORD not set");
    if (!passwordMatches(data.password ?? "", expected)) {
      return { ok: false as const };
    }
    const session = await getAdminSession();
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});

type FeedbackStatus = "new" | "planned" | "in_progress" | "shipped";

export const listAllFeedbackAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [feedbackRes, votesRes] = await Promise.all([
    supabaseAdmin.from("feedback").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("votes").select("feedback_id, bucket"),
  ]);
  if (feedbackRes.error) throw feedbackRes.error;
  if (votesRes.error) throw votesRes.error;
  const tally = new Map<
    string,
    { must: number; should: number; could: number; total: number; weighted: number }
  >();
  for (const v of votesRes.data ?? []) {
    const cur = tally.get(v.feedback_id) ?? { must: 0, should: 0, could: 0, total: 0, weighted: 0 };
    if (v.bucket === "must") {
      cur.must += 1;
      cur.weighted += 3;
    } else if (v.bucket === "should") {
      cur.should += 1;
      cur.weighted += 2;
    } else if (v.bucket === "could") {
      cur.could += 1;
      cur.weighted += 1;
    }
    cur.total += 1;
    tally.set(v.feedback_id, cur);
  }
  return (feedbackRes.data ?? []).map((f) => ({
    ...f,
    votes: tally.get(f.id) ?? { must: 0, should: 0, could: 0, total: 0, weighted: 0 },
  }));
});

export const setFeedbackStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: FeedbackStatus }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shipped_at = data.status === "shipped" ? new Date().toISOString() : null;
    const { error } = await supabaseAdmin
      .from("feedback")
      .update({ status: data.status, shipped_at })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const setFeedbackHidden = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; hidden: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("feedback")
      .update({ hidden: data.hidden })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const setCurrentWork = createServerFn({ method: "POST" })
  .inputValidator((data: { title: string; description?: string | null }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("current_work").upsert(
      {
        id: 1,
        feature_title: data.title,
        feature_description: data.description ?? null,
        started_at: now,
        updated_at: now,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    return { ok: true as const };
  });

export const publishVersion = createServerFn({ method: "POST" })
  .inputValidator((data: { semver: string; title: string; notes?: string | null }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Flip is_current off everywhere first
    const { error: clearErr } = await supabaseAdmin
      .from("versions")
      .update({ is_current: false })
      .eq("is_current", true);
    if (clearErr) throw clearErr;
    const { error } = await supabaseAdmin.from("versions").insert({
      semver: data.semver,
      title: data.title,
      notes: data.notes ?? null,
      is_current: true,
      released_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { ok: true as const };
  });

export const shipIt = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      semver: string;
      title: string;
      notes?: string | null;
      feedbackIds?: string[] | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    // 1. Flip is_current off, insert new version marked current.
    const { error: clearErr } = await supabaseAdmin
      .from("versions")
      .update({ is_current: false })
      .eq("is_current", true);
    if (clearErr) throw clearErr;
    const snapshot = buildToolSnapshot();
    const { error: insertErr } = await supabaseAdmin.from("versions").insert({
      semver: data.semver,
      title: data.title,
      notes: data.notes ?? null,
      is_current: true,
      released_at: now,
      snapshot: JSON.parse(JSON.stringify(snapshot)),
    });
    if (insertErr) throw insertErr;

    // 2. Mark linked feedback items shipped, if any.
    const ids = (data.feedbackIds ?? []).filter(Boolean);
    if (ids.length) {
      const { error: fbErr } = await supabaseAdmin
        .from("feedback")
        .update({ status: "shipped", shipped_at: now })
        .in("id", ids);
      if (fbErr) throw fbErr;
    }

    // 3. Clear the Now Building banner.
    const { error: delErr } = await supabaseAdmin.from("current_work").delete().eq("id", 1);
    if (delErr) throw delErr;

    return { ok: true as const, semver: data.semver };
  });

export const startBuilding = createServerFn({ method: "POST" })
  .inputValidator((data: { feedbackId: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: fb, error: fbErr } = await supabaseAdmin
      .from("feedback")
      .select("id, wish")
      .eq("id", data.feedbackId)
      .maybeSingle();
    if (fbErr) throw fbErr;
    if (!fb) throw new Error("Feedback not found");
    const now = new Date().toISOString();
    const { error: cwErr } = await supabaseAdmin.from("current_work").upsert(
      {
        id: 1,
        feature_title: fb.wish,
        feature_description: null,
        started_at: now,
        updated_at: now,
      },
      { onConflict: "id" },
    );
    if (cwErr) throw cwErr;
    const { error: statusErr } = await supabaseAdmin
      .from("feedback")
      .update({ status: "in_progress" })
      .eq("id", data.feedbackId);
    if (statusErr) throw statusErr;
    return { ok: true as const };
  });

export const deleteFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("feedback").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const clearCurrentWork = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("current_work").delete().eq("id", 1);
  if (error) throw error;
  return { ok: true as const };
});

export const setCurrentVersion = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: clearErr } = await supabaseAdmin
      .from("versions")
      .update({ is_current: false })
      .eq("is_current", true);
    if (clearErr) throw clearErr;
    const { error } = await supabaseAdmin
      .from("versions")
      .update({ is_current: true })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteVersion = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: findErr } = await supabaseAdmin
      .from("versions")
      .select("is_current")
      .eq("id", data.id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!row) throw new Error("Version not found");
    if (row.is_current)
      throw new Error("Cannot delete the current version. Make another version current first.");
    const { error } = await supabaseAdmin.from("versions").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const updateVersion = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; title: string; notes?: string | null }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("versions")
      .update({ title: data.title, notes: data.notes ?? null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const getAdminOverview = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [versionRes, feedbackRes, votesRes] = await Promise.all([
    supabaseAdmin.from("versions").select("semver").eq("is_current", true).maybeSingle(),
    supabaseAdmin.from("feedback").select("id, hidden, status, wish"),
    supabaseAdmin.from("votes").select("id"),
  ]);
  const rows = feedbackRes.data ?? [];
  const nowBuilding = rows
    .filter((r) => r.status === "in_progress" && !r.hidden)
    .map((r) => r.wish);
  return {
    currentVersion: versionRes.data?.semver ?? null,
    nowBuilding,
    totalFeedback: rows.length,
    hiddenCount: rows.filter((r) => r.hidden).length,
    newCount: rows.filter((r) => r.status === "new").length,
    totalVotes: (votesRes.data ?? []).length,
  };
});

export const clearNowBuilding = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("feedback")
    .update({ status: "planned" })
    .eq("status", "in_progress");
  if (error) throw error;
  const { error: cwErr } = await supabaseAdmin.from("current_work").delete().eq("id", 1);
  if (cwErr) throw cwErr;
  return { ok: true as const };
});

export const listLaunchSubscribers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("feedback")
    .select("id, email, organization, role, state, wish, created_at, launch_notified_at")
    .eq("notify_on_launch", true)
    .not("email", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
});

export const markSubscribersNotified = createServerFn({ method: "POST" })
  .inputValidator((data: { ids: string[] }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (!data.ids.length) return { ok: true as const, count: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("feedback")
      .update({ launch_notified_at: new Date().toISOString() })
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true as const, count: data.ids.length };
  });

export const unmarkSubscriberNotified = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("feedback")
      .update({ launch_notified_at: null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });
