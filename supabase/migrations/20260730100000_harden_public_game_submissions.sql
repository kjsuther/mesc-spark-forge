-- Public clients submit through validated TanStack server functions. Keep
-- leaderboard/backlog reads public, but close the direct anonymous insert
-- path that allowed forged scores and unthrottled feedback.
DROP POLICY IF EXISTS "Anyone can submit a score" ON public.game_scores;
REVOKE INSERT ON public.game_scores FROM anon, authenticated;

DROP POLICY IF EXISTS "Anyone can submit game feedback" ON public.game_feedback;
REVOKE INSERT ON public.game_feedback FROM anon, authenticated;
