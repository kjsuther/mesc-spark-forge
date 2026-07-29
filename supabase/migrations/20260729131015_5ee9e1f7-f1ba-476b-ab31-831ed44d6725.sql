ALTER VIEW public.feedback_public SET (security_invoker = on);

-- Restore a public read path on the base table, but only for non-sensitive columns.
DROP POLICY IF EXISTS "Public can read non-hidden feedback" ON public.feedback;
CREATE POLICY "Public can read non-hidden feedback"
ON public.feedback
FOR SELECT
TO anon, authenticated
USING (hidden = false);

REVOKE SELECT ON public.feedback FROM anon, authenticated;
GRANT SELECT (id, wish, moscow, status, priority_rank, action_slug, shipped_at, hidden, created_at)
  ON public.feedback TO anon, authenticated;
GRANT ALL ON public.feedback TO service_role;