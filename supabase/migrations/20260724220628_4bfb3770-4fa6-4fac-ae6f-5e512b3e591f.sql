CREATE TABLE public.game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  score integer NOT NULL,
  duration_ms integer NOT NULL,
  mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.game_scores TO anon;
GRANT SELECT, INSERT ON public.game_scores TO authenticated;
GRANT ALL ON public.game_scores TO service_role;

ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read scores" ON public.game_scores
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can submit a score" ON public.game_scores
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(display_name)) BETWEEN 1 AND 40
    AND score >= 0
    AND duration_ms > 0
    AND mode IN ('before','after')
  );

CREATE INDEX game_scores_score_idx ON public.game_scores (score DESC, created_at ASC);