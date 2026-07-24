DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    wish IS NOT NULL
    AND length(btrim(wish)) BETWEEN 1 AND 2000
    AND (organization IS NULL OR length(organization) <= 200)
    AND (role IS NULL OR length(role) <= 200)
    AND (state IS NULL OR length(state) <= 100)
    AND (email IS NULL OR email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    AND moscow IN ('must','should','could')
    AND status = 'new'
    AND hidden = false
    AND shipped_at IS NULL
    AND priority_rank IS NULL
  );

DROP POLICY IF EXISTS "Anyone can cast a vote" ON public.votes;
CREATE POLICY "Anyone can cast a vote"
  ON public.votes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket IN ('must','should','could')
    AND voter_fingerprint IS NOT NULL
    AND length(voter_fingerprint) BETWEEN 8 AND 200
    AND feedback_id IS NOT NULL
  );