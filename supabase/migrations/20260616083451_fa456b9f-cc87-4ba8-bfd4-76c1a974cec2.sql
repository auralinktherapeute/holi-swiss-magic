ALTER TABLE public.waiting_list
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS canton text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS accepted_terms boolean DEFAULT false;

ALTER TABLE public.waiting_list
  ALTER COLUMN source SET DEFAULT 'website';