
-- 1. Feedback: column-level restriction so email + notify_on_launch are not publicly readable
REVOKE SELECT ON public.feedback FROM anon, authenticated;
GRANT SELECT (id, created_at, wish, organization, role, state, status, moscow, priority_rank, action_slug, shipped_at, hidden)
  ON public.feedback TO anon, authenticated;
GRANT INSERT ON public.feedback TO anon, authenticated;
GRANT ALL ON public.feedback TO service_role;

-- 2. Votes: column-level restriction so voter_fingerprint is not publicly readable
REVOKE SELECT ON public.votes FROM anon, authenticated;
GRANT SELECT (id, feedback_id, bucket, created_at) ON public.votes TO anon, authenticated;
GRANT INSERT ON public.votes TO anon, authenticated;
GRANT ALL ON public.votes TO service_role;

-- 3. Votes: remove permissive DELETE policy; deletes now go through remove_vote()
DROP POLICY IF EXISTS "Voters can remove their own vote" ON public.votes;

-- 4. Security-definer helper: caller must supply their fingerprint, and only rows
--    matching that fingerprint + feedback + bucket are deleted.
CREATE OR REPLACE FUNCTION public.remove_vote(
  _feedback_id uuid,
  _bucket text,
  _voter_fingerprint text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  IF _voter_fingerprint IS NULL OR length(_voter_fingerprint) = 0 THEN
    RETURN false;
  END IF;

  SELECT id INTO target_id
  FROM public.votes
  WHERE feedback_id = _feedback_id
    AND bucket = _bucket
    AND voter_fingerprint = _voter_fingerprint
  ORDER BY created_at DESC
  LIMIT 1;

  IF target_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.votes WHERE id = target_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_vote(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.remove_vote(uuid, text, text) TO anon, authenticated;
