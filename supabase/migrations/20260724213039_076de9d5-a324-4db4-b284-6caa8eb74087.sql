-- Improvements
CREATE TABLE public.game_improvements (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_improvements TO anon, authenticated;
GRANT ALL ON public.game_improvements TO service_role;
ALTER TABLE public.game_improvements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read improvements"
  ON public.game_improvements FOR SELECT
  TO anon, authenticated USING (true);

-- Votes
CREATE TABLE public.game_improvement_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  improvement_key text NOT NULL REFERENCES public.game_improvements(key) ON DELETE CASCADE,
  voter_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (improvement_key, voter_fingerprint)
);
GRANT SELECT, INSERT, DELETE ON public.game_improvement_votes TO anon, authenticated;
GRANT ALL ON public.game_improvement_votes TO service_role;
ALTER TABLE public.game_improvement_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read game votes"
  ON public.game_improvement_votes FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "Anyone can cast a game vote"
  ON public.game_improvement_votes FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(voter_fingerprint) BETWEEN 8 AND 200
    AND improvement_key IS NOT NULL
  );
CREATE POLICY "Anyone can remove a game vote"
  ON public.game_improvement_votes FOR DELETE
  TO anon, authenticated USING (true);

-- Settings singleton (Before/After broadcast)
CREATE TABLE public.game_settings (
  id int PRIMARY KEY DEFAULT 1,
  before_after text NOT NULL DEFAULT 'before',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_settings_singleton CHECK (id = 1),
  CONSTRAINT game_settings_mode CHECK (before_after IN ('before', 'after'))
);
GRANT SELECT ON public.game_settings TO anon, authenticated;
GRANT ALL ON public.game_settings TO service_role;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read game settings"
  ON public.game_settings FOR SELECT
  TO anon, authenticated USING (true);

INSERT INTO public.game_settings (id, before_after) VALUES (1, 'before');

-- Seed improvements
INSERT INTO public.game_improvements (key, label, description, sort_order) VALUES
  ('clearer_directions', 'Add clearer directions', 'Trail signs become legible and Application Mountain gets stepped markers.', 1),
  ('helper',             'Add a helper',           'A friendly ranger walks ahead and points to the next step.',              2),
  ('documents_earlier',  'Show required documents earlier', 'A HUD shows which documents you still need from the start.',      3),
  ('save_progress',      'Let users save progress', 'A campfire checkpoint appears after the river so you can continue later.', 4),
  ('bridge',             'Add a bridge',           'A solid bridge replaces the tricky log platforms over the river.',         5);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_improvements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_improvement_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_settings;