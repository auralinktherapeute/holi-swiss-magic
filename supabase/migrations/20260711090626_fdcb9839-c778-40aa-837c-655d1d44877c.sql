
UPDATE public.crm_client_contacts
SET email = lower(btrim(email))
WHERE email IS NOT NULL AND email <> lower(btrim(email));

CREATE UNIQUE INDEX IF NOT EXISTS crm_client_contacts_therapist_email_key
ON public.crm_client_contacts (therapist_id, lower(email))
WHERE email IS NOT NULL AND email <> '';
