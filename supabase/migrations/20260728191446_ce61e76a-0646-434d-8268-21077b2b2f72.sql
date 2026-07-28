CREATE TABLE public.game_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  submitter_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog','implemented')),
  rank INTEGER NOT NULL DEFAULT 0,
  implemented_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT game_feedback_description_len CHECK (char_length(description) BETWEEN 3 AND 280),
  CONSTRAINT game_feedback_name_len CHECK (char_length(submitter_name) BETWEEN 2 AND 60)
);

GRANT SELECT, INSERT ON public.game_feedback TO anon;
GRANT SELECT, INSERT ON public.game_feedback TO authenticated;
GRANT ALL ON public.game_feedback TO service_role;

ALTER TABLE public.game_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read game feedback"
  ON public.game_feedback FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can submit game feedback"
  ON public.game_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'backlog' AND implemented_at IS NULL);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_game_feedback_updated_at
  BEFORE UPDATE ON public.game_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX game_feedback_status_rank_idx ON public.game_feedback (status, rank, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_feedback;