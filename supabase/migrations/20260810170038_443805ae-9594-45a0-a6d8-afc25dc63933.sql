-- FEEDBACK: remove blanket public read, allow only safe columns
DROP POLICY IF EXISTS "Public can read non-hidden feedback" ON public.feedback;
REVOKE SELECT ON public.feedback FROM anon, authenticated;

CREATE POLICY "Public can read non-sensitive feedback"
ON public.feedback
FOR SELECT
TO anon, authenticated
USING (hidden = false);

GRANT SELECT (id, wish, moscow, status, priority_rank, action_slug, shipped_at, created_at, hidden)
ON public.feedback TO anon, authenticated;
GRANT ALL ON public.feedback TO service_role;

-- VOTES: remove raw row read, allow only tally columns (no voter_fingerprint)
DROP POLICY IF EXISTS "Public can read vote tallies" ON public.votes;
REVOKE SELECT ON public.votes FROM anon, authenticated;

CREATE POLICY "Public can read vote tally columns"
ON public.votes
FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT (id, feedback_id, bucket, created_at) ON public.votes TO anon, authenticated;
GRANT ALL ON public.votes TO service_role;

-- Ensure the safe views stay readable
GRANT SELECT ON public.feedback_public TO anon, authenticated;
GRANT SELECT ON public.vote_tallies TO anon, authenticated;