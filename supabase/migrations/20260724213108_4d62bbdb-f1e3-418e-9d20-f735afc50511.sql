DROP POLICY IF EXISTS "Anyone can remove a game vote" ON public.game_improvement_votes;
REVOKE DELETE ON public.game_improvement_votes FROM anon, authenticated;