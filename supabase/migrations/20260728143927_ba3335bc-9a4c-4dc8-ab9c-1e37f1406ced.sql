-- 1. feedback: column-level grants so email / org / role / state / notify fields
--    are never readable by anon or authenticated clients.
REVOKE SELECT ON public.feedback FROM anon, authenticated;
GRANT SELECT (id, created_at, wish, status, hidden) ON public.feedback TO anon, authenticated;

-- 2. votes: no public read path at all (admin reads go through service_role).
DROP POLICY IF EXISTS "Public can read votes" ON public.votes;
REVOKE SELECT ON public.votes FROM anon, authenticated;

-- 3. game_improvement_votes: public tallies stay, voter_fingerprint is revoked.
REVOKE SELECT ON public.game_improvement_votes FROM anon, authenticated;
GRANT SELECT (id, improvement_key, round_id, created_at) ON public.game_improvement_votes TO anon, authenticated;

-- 4. SECURITY DEFINER helpers are no longer callable from the browser.
REVOKE EXECUTE ON FUNCTION public.cast_round_vote(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_votes(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_vote(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_round_vote(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_votes(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_vote(uuid, text, text) TO service_role;