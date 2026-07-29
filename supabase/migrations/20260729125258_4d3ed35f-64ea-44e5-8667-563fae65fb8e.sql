DROP VIEW IF EXISTS public.feedback_public;

-- Public read is allowed again, but only for non-PII columns via column-level grants.
CREATE POLICY "Public can read non-hidden feedback"
ON public.feedback
FOR SELECT
TO anon, authenticated
USING (hidden = false);

REVOKE SELECT ON public.feedback FROM anon, authenticated;
GRANT SELECT (id, wish, status, moscow, priority_rank, action_slug, created_at, shipped_at, hidden)
ON public.feedback TO anon, authenticated;
GRANT ALL ON public.feedback TO service_role;