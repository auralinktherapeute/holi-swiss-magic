
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiting_list;
ALTER TABLE public.waiting_list REPLICA IDENTITY FULL;

GRANT UPDATE, DELETE ON public.waiting_list TO authenticated;

CREATE POLICY "Admins can update waiting list"
ON public.waiting_list FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete waiting list"
ON public.waiting_list FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
