
CREATE TABLE public.waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  source text NOT NULL DEFAULT 'popup',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.waiting_list TO anon, authenticated;
GRANT SELECT ON public.waiting_list TO authenticated;
GRANT ALL ON public.waiting_list TO service_role;

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waiting list"
ON public.waiting_list FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can read waiting list"
ON public.waiting_list FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_waiting_list_updated_at
BEFORE UPDATE ON public.waiting_list
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.waiting_list_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.waiting_list;
$$;

GRANT EXECUTE ON FUNCTION public.waiting_list_count() TO anon, authenticated;
