
-- Allow the same voter to vote for the same improvement in different rounds
ALTER TABLE public.game_improvement_votes
  DROP CONSTRAINT IF EXISTS game_improvement_votes_improvement_key_voter_fingerprint_key;

CREATE UNIQUE INDEX IF NOT EXISTS game_improvement_votes_round_voter_key_uniq
  ON public.game_improvement_votes (round_id, voter_fingerprint, improvement_key)
  WHERE round_id IS NOT NULL;

-- Seed the 3 pool improvements that don't yet exist in the toggleable improvements table
INSERT INTO public.game_improvements (key, label, description, enabled, sort_order)
VALUES
  ('plain_language', 'Plain-language forms', 'Simplifies confusing form-monsters in Town so applicants can pass them.', false, 60),
  ('phone_support', 'Phone support hotline', 'A phone icon grants an extra life so one mistake does not restart the journey.', false, 70),
  ('translated_signs', 'Translated signs', 'Adds a second-language line to every trail sign for broader access.', false, 80)
ON CONFLICT (key) DO NOTHING;
