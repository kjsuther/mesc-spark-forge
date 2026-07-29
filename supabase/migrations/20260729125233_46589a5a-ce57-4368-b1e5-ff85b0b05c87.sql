-- Remove public read access to the raw feedback table (contains email/PII)
DROP POLICY IF EXISTS "Public can read feedback" ON public.feedback;

REVOKE SELECT ON public.feedback FROM anon;
REVOKE SELECT ON public.feedback FROM authenticated;
GRANT INSERT ON public.feedback TO anon, authenticated;
GRANT ALL ON public.feedback TO service_role;

-- Public-safe projection: no email, organization, role, or state
CREATE OR REPLACE VIEW public.feedback_public
WITH (security_invoker = off) AS
SELECT id, wish, status, moscow, priority_rank, action_slug, created_at, shipped_at
FROM public.feedback
WHERE hidden = false;

GRANT SELECT ON public.feedback_public TO anon, authenticated;
GRANT ALL ON public.feedback_public TO service_role;