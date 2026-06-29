
ALTER TABLE public.waiting_list
  ADD COLUMN IF NOT EXISTS invitation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invitation_token uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

ALTER TABLE public.waiting_list
  DROP CONSTRAINT IF EXISTS waiting_list_invitation_status_check;
ALTER TABLE public.waiting_list
  ADD CONSTRAINT waiting_list_invitation_status_check
  CHECK (invitation_status IN ('pending','invited','registered'));

CREATE INDEX IF NOT EXISTS waiting_list_invitation_token_idx
  ON public.waiting_list(invitation_token) WHERE invitation_token IS NOT NULL;

-- Trigger: prevent non-admin updates of invitation fields
CREATE OR REPLACE FUNCTION public.waiting_list_protect_invitation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses (auth.uid() IS NULL)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.invitation_status := OLD.invitation_status;
  NEW.invitation_token  := OLD.invitation_token;
  NEW.invited_at        := OLD.invited_at;
  NEW.token_expires_at  := OLD.token_expires_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_waiting_list_protect_invitation_fields ON public.waiting_list;
CREATE TRIGGER trg_waiting_list_protect_invitation_fields
  BEFORE UPDATE ON public.waiting_list
  FOR EACH ROW EXECUTE FUNCTION public.waiting_list_protect_invitation_fields();
