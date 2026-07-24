DROP TRIGGER IF EXISTS trg_promote_feedback_on_vote ON public.votes;
DROP FUNCTION IF EXISTS public.promote_feedback_on_vote();