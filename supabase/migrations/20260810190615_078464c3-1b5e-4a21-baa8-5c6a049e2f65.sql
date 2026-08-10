ALTER TABLE public.game_feedback
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS role_other text,
  ADD COLUMN IF NOT EXISTS location_state text,
  ADD COLUMN IF NOT EXISTS location_country text;