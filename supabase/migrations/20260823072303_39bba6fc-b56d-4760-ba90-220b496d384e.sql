CREATE TABLE public.admin_section_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('waitlist', 'reviews', 'articles')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section)
);

GRANT SELECT, INSERT, UPDATE ON public.admin_section_reads TO authenticated;
GRANT ALL ON public.admin_section_reads TO service_role;

ALTER TABLE public.admin_section_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read own section acknowledgements"
ON public.admin_section_reads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins create own section acknowledgements"
ON public.admin_section_reads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update own section acknowledgements"
ON public.admin_section_reads
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.set_admin_section_reads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_admin_section_reads_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_section_reads_updated_at() TO service_role;

CREATE TRIGGER set_admin_section_reads_updated_at
BEFORE UPDATE ON public.admin_section_reads
FOR EACH ROW
EXECUTE FUNCTION public.set_admin_section_reads_updated_at();

CREATE INDEX admin_section_reads_lookup_idx
ON public.admin_section_reads (user_id, section, last_seen_at DESC);