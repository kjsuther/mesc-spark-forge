ALTER TABLE public.game_feedback REPLICA IDENTITY FULL;

DROP TABLE IF EXISTS public.game_build_runs CASCADE;
DROP TABLE IF EXISTS public.game_improvement_votes CASCADE;
DROP TABLE IF EXISTS public.game_round_candidates CASCADE;
DROP TABLE IF EXISTS public.game_vote_rounds CASCADE;
DROP TABLE IF EXISTS public.game_improvements CASCADE;
DROP TABLE IF EXISTS public.game_settings CASCADE;
DROP FUNCTION IF EXISTS public.cast_round_vote(text, text);