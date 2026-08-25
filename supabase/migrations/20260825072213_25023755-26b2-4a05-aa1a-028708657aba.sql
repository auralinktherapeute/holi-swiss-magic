CREATE INDEX IF NOT EXISTS therapists_status_canton_idx
  ON public.therapists (status, canton)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS therapists_status_city_idx
  ON public.therapists (status, city)
  WHERE status = 'active';