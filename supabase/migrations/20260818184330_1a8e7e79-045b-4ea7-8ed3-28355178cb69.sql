CREATE TABLE public.game_scores_archive (
  archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id uuid NOT NULL,
  display_name text NOT NULL,
  score integer NOT NULL,
  duration_ms integer NOT NULL,
  mode text NOT NULL,
  created_at timestamptz NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.game_scores_archive TO service_role;
ALTER TABLE public.game_scores_archive ENABLE ROW LEVEL SECURITY;

CREATE INDEX game_scores_archive_deleted_at_idx ON public.game_scores_archive (deleted_at DESC);

CREATE OR REPLACE FUNCTION public.archive_deleted_game_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.game_scores_archive (id, display_name, score, duration_ms, mode, created_at)
  VALUES (OLD.id, OLD.display_name, OLD.score, OLD.duration_ms, OLD.mode, OLD.created_at);
  RETURN OLD;
END;
$$;

CREATE TRIGGER game_scores_archive_on_delete
AFTER DELETE ON public.game_scores
FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_game_score();

CREATE TABLE public.leaderboard_wipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wiped_at timestamptz NOT NULL DEFAULT now(),
  row_count integer NOT NULL DEFAULT 0,
  restored_at timestamptz
);

GRANT ALL ON public.leaderboard_wipes TO service_role;
ALTER TABLE public.leaderboard_wipes ENABLE ROW LEVEL SECURITY;