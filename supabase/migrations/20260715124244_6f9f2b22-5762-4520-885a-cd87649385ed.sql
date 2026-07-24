CREATE OR REPLACE FUNCTION public.get_my_votes(_voter_fingerprint text)
RETURNS TABLE(id uuid, feedback_id uuid, bucket text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.feedback_id, v.bucket
  FROM public.votes v
  WHERE _voter_fingerprint IS NOT NULL
    AND length(_voter_fingerprint) > 0
    AND v.voter_fingerprint = _voter_fingerprint;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_votes(text) TO anon, authenticated;