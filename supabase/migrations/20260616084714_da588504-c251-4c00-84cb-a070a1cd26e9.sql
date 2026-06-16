GRANT INSERT ON public.waiting_list TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.waiting_list TO authenticated;
GRANT ALL ON public.waiting_list TO service_role;