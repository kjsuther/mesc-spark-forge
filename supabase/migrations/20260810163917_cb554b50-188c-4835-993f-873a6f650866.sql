CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  title text NOT NULL DEFAULT '',
  bio text,
  photo_path text,
  sort_order integer NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.team_members TO anon, authenticated;
GRANT ALL ON public.team_members TO service_role;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read visible team members"
ON public.team_members FOR SELECT
TO anon, authenticated
USING (hidden = false);

CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.team_members (full_name, title, sort_order) VALUES
  ('Kevin Sutherland', 'Founder & Chief Value Officer, Strategic Innovation Consulting', 10),
  ('Lauren Siegel', 'Medicaid Systems Transformation Coordinator', 20),
  ('Pamela "PJ" Weiner', 'Deputy Assistant Commissioner, Health Care Administration (MN DHS)', 30),
  ('Nekheti Nefer-Ra', 'MES Modernization and Implementation Manager, Health Care Administration (MN DHS)', 40),
  ('Dustin "Dusty" Letica', 'Deputy Director of Public Health & Human Services (St. Louis County, MN)', 50),
  ('Rebecca "Becky" Melang', 'Enterprise Technology Manager, Business Solutions Office (MN DHS)', 60),
  ('Matthew "Matt" Woods', 'Director of Medicaid Business Integration, Payments and Provider Services, Health Care Administration (MN DHS)', 70),
  ('Donald "Don" Ortega', 'Business Analysis Supervisor, Minnesota IT Services (MNIT)', 80),
  ('Ryan Smith', 'Modernization Consultant, Health Care Administration (MN DHS)', 90);