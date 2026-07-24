-- 1. Pool of curated improvements the admin can draw from
CREATE TABLE public.game_improvement_pool (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL,
  baseline_pain text NOT NULL,
  code_hook text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_improvement_pool TO anon, authenticated;
GRANT ALL ON public.game_improvement_pool TO service_role;
ALTER TABLE public.game_improvement_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read pool" ON public.game_improvement_pool FOR SELECT TO anon, authenticated USING (true);

-- 2. Voting rounds
CREATE TABLE public.game_vote_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','applied')),
  winner_key text,
  applied_at timestamptz
);
GRANT SELECT ON public.game_vote_rounds TO anon, authenticated;
GRANT ALL ON public.game_vote_rounds TO service_role;
ALTER TABLE public.game_vote_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read rounds" ON public.game_vote_rounds FOR SELECT TO anon, authenticated USING (true);

-- 3. Round candidates (subset of pool for a given round)
CREATE TABLE public.game_round_candidates (
  round_id uuid NOT NULL REFERENCES public.game_vote_rounds(id) ON DELETE CASCADE,
  improvement_key text NOT NULL,
  PRIMARY KEY (round_id, improvement_key)
);
GRANT SELECT ON public.game_round_candidates TO anon, authenticated;
GRANT ALL ON public.game_round_candidates TO service_role;
ALTER TABLE public.game_round_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read round candidates" ON public.game_round_candidates FOR SELECT TO anon, authenticated USING (true);

-- 4. Add round_id to existing votes table (nullable for backfill)
ALTER TABLE public.game_improvement_votes ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES public.game_vote_rounds(id) ON DELETE CASCADE;

-- 5. Secure vote-casting: only during active round, only for candidates, dedupe per (round, fingerprint)
CREATE OR REPLACE FUNCTION public.cast_round_vote(_improvement_key text, _voter_fingerprint text)
RETURNS TABLE(ok boolean, message text, new_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  active_round public.game_vote_rounds%ROWTYPE;
  is_candidate boolean;
  already_voted boolean;
  tally bigint;
BEGIN
  IF _voter_fingerprint IS NULL OR length(_voter_fingerprint) < 8 THEN
    RETURN QUERY SELECT false, 'Invalid voter'::text, 0::bigint; RETURN;
  END IF;
  SELECT * INTO active_round FROM public.game_vote_rounds
    WHERE status = 'active' AND ends_at > now()
    ORDER BY started_at DESC LIMIT 1;
  IF active_round.id IS NULL THEN
    RETURN QUERY SELECT false, 'No active round'::text, 0::bigint; RETURN;
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.game_round_candidates
    WHERE round_id = active_round.id AND improvement_key = _improvement_key) INTO is_candidate;
  IF NOT is_candidate THEN
    RETURN QUERY SELECT false, 'Not a candidate in this round'::text, 0::bigint; RETURN;
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.game_improvement_votes
    WHERE round_id = active_round.id AND voter_fingerprint = _voter_fingerprint) INTO already_voted;
  IF already_voted THEN
    RETURN QUERY SELECT false, 'Already voted in this round'::text, 0::bigint; RETURN;
  END IF;
  INSERT INTO public.game_improvement_votes(improvement_key, voter_fingerprint, round_id)
    VALUES (_improvement_key, _voter_fingerprint, active_round.id);
  SELECT count(*) INTO tally FROM public.game_improvement_votes
    WHERE round_id = active_round.id AND improvement_key = _improvement_key;
  RETURN QUERY SELECT true, 'ok'::text, tally;
END; $$;

GRANT EXECUTE ON FUNCTION public.cast_round_vote(text, text) TO anon, authenticated;

-- 6. Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_vote_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_round_candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_improvement_pool;

-- 7. Seed pool with the existing 5 improvements + a few extras for admin choice
INSERT INTO public.game_improvement_pool (key, label, description, baseline_pain, code_hook) VALUES
  ('clearer_directions','Add clearer directions','Correct signpost glows; stamp queue accepts on first try.','Trial-and-error signposts + random rejections','clearer_directions'),
  ('helper','Add a helper','Friendly guide walks ahead and marks safe river platforms.','Unmarked deadly river platforms','helper'),
  ('documents_earlier','Show required documents earlier','Backpack HUD lists required docs from spawn; docs pulse.','Player learns docs are missing at mountain gate','documents_earlier'),
  ('save_progress','Let users save progress','Campfire checkpoints at each biome; deaths respawn there.','No checkpoints, one death = full restart','save_progress'),
  ('bridge','Add a bridge','A solid bridge spans the river.','Impossible-jump river platforms','bridge'),
  ('plain_language','Plain-language forms','Form-paper enemies become friendly; fewer knockbacks.','Confusing form enemies drain lives','plain_language'),
  ('phone_support','Phone support hotline','A hotline hint appears at each barrier.','Stuck players have no help','phone_support'),
  ('translated_signs','Translated signs','Signposts show icons + multiple languages.','English-only signs mislead','translated_signs')
ON CONFLICT (key) DO NOTHING;