
-- feedback
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  wish text NOT NULL CHECK (char_length(wish) BETWEEN 3 AND 500),
  organization text,
  role text,
  state text,
  email text,
  notify_on_launch boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','planned','in_progress','shipped')),
  moscow text NOT NULL DEFAULT 'could' CHECK (moscow IN ('must','should','could')),
  priority_rank int,
  action_slug text,
  shipped_at timestamptz
);
GRANT SELECT, INSERT ON public.feedback TO anon, authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read feedback" ON public.feedback FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can submit feedback" ON public.feedback FOR INSERT TO anon, authenticated WITH CHECK (true);

-- votes
CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  voter_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feedback_id, voter_fingerprint)
);
CREATE INDEX votes_voter_idx ON public.votes(voter_fingerprint);
CREATE INDEX votes_feedback_idx ON public.votes(feedback_id);
GRANT SELECT, INSERT ON public.votes TO anon, authenticated;
GRANT ALL ON public.votes TO service_role;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read votes" ON public.votes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can cast a vote" ON public.votes FOR INSERT TO anon, authenticated WITH CHECK (true);

-- versions
CREATE TABLE public.versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semver text NOT NULL UNIQUE,
  released_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  notes text,
  is_current boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.versions TO anon, authenticated;
GRANT ALL ON public.versions TO service_role;
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read versions" ON public.versions FOR SELECT TO anon, authenticated USING (true);

-- current_work (singleton)
CREATE TABLE public.current_work (
  id smallint PRIMARY KEY CHECK (id = 1),
  feature_title text NOT NULL,
  feature_description text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.current_work TO anon, authenticated;
GRANT ALL ON public.current_work TO service_role;
ALTER TABLE public.current_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read current work" ON public.current_work FOR SELECT TO anon, authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.current_work;
ALTER PUBLICATION supabase_realtime ADD TABLE public.versions;
