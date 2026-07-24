import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { getVoterId, MAX_VOTES_PER_ATTENDEE } from "./voter";

export const feedbackSchema = z.object({
  wish: z.string().trim().min(3, "Please tell us a little more").max(500, "Keep it under 500 characters"),
  organization: z.string().trim().max(120).optional().or(z.literal("")),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  state: z.string().trim().max(60).optional().or(z.literal("")),
  email: z.string().trim().email("That doesn't look like an email").max(200).optional().or(z.literal("")),
  notify_on_launch: z.boolean().optional(),
  action_slug: z.string().trim().max(80).optional().or(z.literal("")),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

export async function submitFeedback(input: FeedbackInput) {
  const parsed = feedbackSchema.parse(input);
  const row = {
    wish: parsed.wish,
    organization: parsed.organization || null,
    role: parsed.role || null,
    state: parsed.state || null,
    email: parsed.email || null,
    notify_on_launch: parsed.notify_on_launch ?? false,
    action_slug: parsed.action_slug || null,
  };
  const { data, error } = await supabase.from("feedback").insert(row).select().single();
  if (error) throw error;
  return data;
}

export type VoteBucket = "must" | "should" | "could";
export type VoteResult =
  | { ok: true }
  | { ok: false; reason: "no_votes_left" | "bucket_locked" | "locked"; lockedBucket?: VoteBucket };

export async function castVote(feedbackId: string, bucket: VoteBucket): Promise<VoteResult> {
  const voter = getVoterId();

  // Voting is only allowed on items still in the "new" column. Once an admin
  // promotes an item to planned/in_progress/shipped, it's locked in.
  const { data: item, error: itemErr } = await supabase
    .from("feedback")
    .select("status")
    .eq("id", feedbackId)
    .maybeSingle();
  if (itemErr) throw itemErr;
  if (!item || item.status !== "new") return { ok: false, reason: "locked" };

  // Check total votes remaining — go through the security-definer RPC so
  // anon doesn't need SELECT on the fingerprint column.
  const { data: mine, error: mineErr } = await supabase.rpc("get_my_votes", {
    _voter_fingerprint: voter,
  });
  if (mineErr) throw mineErr;

  const list = mine ?? [];
  if (list.length >= MAX_VOTES_PER_ATTENDEE) return { ok: false, reason: "no_votes_left" };

  // Enforce single-bucket-per-item: if voter already picked a different bucket for this item, reject.
  const existingOnItem = list.find((v) => v.feedback_id === feedbackId);
  if (existingOnItem && existingOnItem.bucket !== bucket) {
    return { ok: false, reason: "bucket_locked", lockedBucket: existingOnItem.bucket as VoteBucket };
  }

  const { error } = await supabase
    .from("votes")
    .insert({ feedback_id: feedbackId, voter_fingerprint: voter, bucket });
  if (error) throw error;
  return { ok: true };
}

export async function removeVote(feedbackId: string, bucket: VoteBucket): Promise<{ ok: boolean }> {
  const voter = getVoterId();
  if (!voter) return { ok: false };
  // Public DELETE on votes is disabled; go through the security-definer RPC
  // that only deletes rows matching the caller's fingerprint.
  const { data, error } = await supabase.rpc("remove_vote", {
    _feedback_id: feedbackId,
    _bucket: bucket,
    _voter_fingerprint: voter,
  });
  if (error) throw error;
  return { ok: !!data };
}
