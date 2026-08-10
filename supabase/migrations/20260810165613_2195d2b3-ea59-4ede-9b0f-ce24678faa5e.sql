-- 1. FEEDBACK: stop exposing raw table (email column) to anon/authenticated
DROP POLICY IF EXISTS "Public can read non-hidden feedback" ON public.feedback;
REVOKE SELECT ON public.feedback FROM anon, authenticated;

-- serve public feedback through the existing safe view, owner-privileged
ALTER VIEW public.feedback_public SET (security_invoker = off);
GRANT SELECT ON public.feedback_public TO anon, authenticated;

-- keep submissions working
GRANT INSERT ON public.feedback TO anon, authenticated;
GRANT ALL ON public.feedback TO service_role;

-- 2. VOTES: stop exposing voter_fingerprint
DROP POLICY IF EXISTS "Public can read vote tallies" ON public.votes;
REVOKE SELECT ON public.votes FROM anon, authenticated;
GRANT INSERT ON public.votes TO anon, authenticated;
GRANT ALL ON public.votes TO service_role;

CREATE OR REPLACE VIEW public.vote_tallies
WITH (security_invoker = off) AS
  SELECT feedback_id, bucket, count(*)::bigint AS vote_count
  FROM public.votes
  GROUP BY feedback_id, bucket;

GRANT SELECT ON public.vote_tallies TO anon, authenticated;

-- 3. STORAGE: explicit ownership rules for the private team-photos bucket.
-- Only trusted server-side code (service role, which bypasses RLS) may touch
-- these objects; browser clients are explicitly denied.
DROP POLICY IF EXISTS "team-photos no client select" ON storage.objects;
DROP POLICY IF EXISTS "team-photos no client insert" ON storage.objects;
DROP POLICY IF EXISTS "team-photos no client update" ON storage.objects;
DROP POLICY IF EXISTS "team-photos no client delete" ON storage.objects;

CREATE POLICY "team-photos no client select"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'team-photos' AND false);

CREATE POLICY "team-photos no client insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'team-photos' AND false);

CREATE POLICY "team-photos no client update"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'team-photos' AND false)
  WITH CHECK (bucket_id = 'team-photos' AND false);

CREATE POLICY "team-photos no client delete"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'team-photos' AND false);