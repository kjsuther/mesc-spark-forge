
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Public can read feedback" ON public.feedback;
CREATE POLICY "Public can read feedback"
  ON public.feedback FOR SELECT
  TO anon, authenticated
  USING (hidden = false);

GRANT DELETE ON public.votes TO anon, authenticated;
DROP POLICY IF EXISTS "Voters can remove their own vote" ON public.votes;
CREATE POLICY "Voters can remove their own vote"
  ON public.votes FOR DELETE
  TO anon, authenticated
  USING (true);
