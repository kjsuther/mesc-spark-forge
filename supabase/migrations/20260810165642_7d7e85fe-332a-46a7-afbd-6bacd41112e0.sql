-- Revert owner-privileged views; use column-level grants instead
ALTER VIEW public.feedback_public SET (security_invoker = on);
ALTER VIEW public.vote_tallies SET (security_invoker = on);

-- FEEDBACK: allow reads of non-sensitive columns only
DROP POLICY IF EXISTS "Public can read non-hidden feedback" ON public.feedback;
CREATE POLICY "Public can read non-hidden feedback"
  ON public.feedback FOR SELECT TO anon, authenticated
  USING (hidden = false);

REVOKE SELECT ON public.feedback FROM anon, authenticated;
GRANT SELECT (id, wish, moscow, status, priority_rank, action_slug, shipped_at, created_at, hidden)
  ON public.feedback TO anon, authenticated;

-- VOTES: allow reads of tally columns only (no voter_fingerprint)
DROP POLICY IF EXISTS "Public can read vote tallies" ON public.votes;
CREATE POLICY "Public can read vote tallies"
  ON public.votes FOR SELECT TO anon, authenticated
  USING (true);

REVOKE SELECT ON public.votes FROM anon, authenticated;
GRANT SELECT (id, feedback_id, bucket, created_at) ON public.votes TO anon, authenticated;