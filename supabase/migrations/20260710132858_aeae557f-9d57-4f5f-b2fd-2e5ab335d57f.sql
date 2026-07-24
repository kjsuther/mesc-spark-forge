CREATE OR REPLACE FUNCTION public.promote_feedback_on_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.feedback
     SET status = 'planned'
   WHERE id = NEW.feedback_id
     AND status = 'new';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_feedback_on_vote ON public.votes;
CREATE TRIGGER trg_promote_feedback_on_vote
AFTER INSERT ON public.votes
FOR EACH ROW
EXECUTE FUNCTION public.promote_feedback_on_vote();