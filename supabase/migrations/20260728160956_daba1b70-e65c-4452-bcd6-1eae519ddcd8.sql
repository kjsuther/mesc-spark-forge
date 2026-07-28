CREATE TABLE public.game_build_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  improvement_key text NOT NULL,
  round_id uuid,
  votes integer NOT NULL DEFAULT 0,
  duration_sec integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'running',
  applies_flag boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.game_build_runs TO anon;
GRANT SELECT ON public.game_build_runs TO authenticated;
GRANT ALL ON public.game_build_runs TO service_role;

ALTER TABLE public.game_build_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Build runs are publicly viewable"
ON public.game_build_runs FOR SELECT
USING (true);

ALTER TABLE public.game_build_runs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_build_runs;