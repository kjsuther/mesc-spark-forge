-- ============ FEEDBACK: hide submitter contact info from public reads ============
DROP POLICY IF EXISTS "Public can read non-hidden feedback" ON public.feedback;
REVOKE SELECT ON public.feedback FROM anon, authenticated;

DROP VIEW IF EXISTS public.feedback_public;
CREATE VIEW public.feedback_public AS
SELECT
  id,
  wish,
  moscow,
  status,
  priority_rank,
  action_slug,
  shipped_at,
  created_at
FROM public.feedback
WHERE hidden = false;

GRANT SELECT ON public.feedback_public TO anon, authenticated;
GRANT ALL ON public.feedback_public TO service_role;

-- ============ VOTES: allow reading tallies, never the voter fingerprint ============
DROP POLICY IF EXISTS "Public can read vote tallies" ON public.votes;
CREATE POLICY "Public can read vote tallies"
ON public.votes
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE SELECT ON public.votes FROM anon, authenticated;
GRANT SELECT (id, feedback_id, bucket, created_at) ON public.votes TO anon, authenticated;
GRANT ALL ON public.votes TO service_role;