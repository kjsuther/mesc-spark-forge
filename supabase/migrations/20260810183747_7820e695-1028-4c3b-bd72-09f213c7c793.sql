ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS goes_by text,
  ADD COLUMN IF NOT EXISTS organization text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read visible team members" ON public.team_members;
CREATE POLICY "Public can read visible team members"
  ON public.team_members
  FOR SELECT
  TO anon, authenticated
  USING (hidden = false);