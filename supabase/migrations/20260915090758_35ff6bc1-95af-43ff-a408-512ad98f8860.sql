CREATE OR REPLACE FUNCTION public.appointments_public_booking_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_is_owner boolean;
  v_is_admin boolean;
  v_dur int;
  v_start timestamptz;
  v_end timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_conflict boolean;
begin
  -- Propriétaire reconnu EN BASE via auth.uid(), jamais via un champ fourni
  -- par le client.
  select exists (
    select 1 from public.therapists t
    where t.id = NEW.therapist_id and t.user_id = auth.uid()
  ) into v_is_owner;

  if v_is_owner then
    return NEW; -- saisies du praticien : comportement inchangé
  end if;

  v_is_admin := false;
  if auth.uid() is not null then
    begin
      v_is_admin := public.is_admin(auth.uid());
    exception when others then
      v_is_admin := false;
    end;
  end if;
  if v_is_admin then
    return NEW; -- administration : comportement inchangé
  end if;

  -- À partir d'ici : demande publique (anon ou compte non propriétaire).
  if NEW.appointment_date is null or NEW.appointment_time is null then
    raise exception 'BOOKING_INVALID_SLOT' using errcode = '22023';
  end if;

  if NEW.appointment_date < current_date
     or NEW.appointment_date > (current_date + interval '1 year')::date then
    raise exception 'BOOKING_INVALID_DATE' using errcode = '22023';
  end if;

  v_dur := coalesce(nullif(NEW.duration_minutes, 0), 60);
  if v_dur < 15 or v_dur > 480 then
    raise exception 'BOOKING_INVALID_DURATION' using errcode = '22023';
  end if;
  NEW.duration_minutes := v_dur;

  -- Cohérence imposée : les instants sont RECALCULÉS, les valeurs envoyées
  -- par le client sont ignorées (anti-contournement).
  v_start := ((NEW.appointment_date::text || ' ' || NEW.appointment_time::text)::timestamp
              at time zone 'Europe/Zurich');
  v_end := v_start + make_interval(mins => v_dur);
  NEW.start_time := v_start;
  NEW.end_time := v_end;

  -- Sérialisation des demandes publiques concurrentes du même praticien :
  -- un simple SELECT ne verrait pas une insertion concurrente non validée.
  perform pg_advisory_xact_lock(hashtextextended(NEW.therapist_id::text, 0));

  select exists (
    select 1 from public.appointments a
    where a.therapist_id = NEW.therapist_id
      and a.status in ('pending', 'confirmed', 'completed', 'blocked')
      and a.start_time is not null
      and a.end_time is not null
      and a.start_time < v_end
      and v_start < a.end_time
  ) into v_conflict;
  if v_conflict then
    raise exception 'BOOKING_SLOT_CONFLICT' using errcode = '23P01';
  end if;

  select exists (
    select 1 from public.therapist_external_busy b
    where b.therapist_id = NEW.therapist_id
      and b.starts_at < v_end
      and v_start < b.ends_at
  ) into v_conflict;
  if v_conflict then
    raise exception 'BOOKING_SLOT_CONFLICT' using errcode = '23P01';
  end if;

  -- Indisponibilités du praticien. Une séance peut franchir minuit : on
  -- confronte CHAQUE journée locale touchée par l'intervalle, et non la
  -- seule date de départ (sinon un blocage du lendemain était ignoré).
  v_local_start := (v_start at time zone 'Europe/Zurich');
  v_local_end := (v_end at time zone 'Europe/Zurich');
  select exists (
    select 1
    from generate_series(
           v_local_start::date,
           (v_local_end - interval '1 microsecond')::date,
           interval '1 day'
         ) as g(d)
    join public.blocked_periods p
      on p.therapist_id = NEW.therapist_id
     and g.d::date between p.start_date and p.end_date
    where coalesce(p.is_all_day, true)
       or p.start_time is null
       or p.end_time is null
       or ((g.d::date + p.start_time, g.d::date + p.end_time)
            overlaps (v_local_start, v_local_end))
  ) into v_conflict;
  if v_conflict then
    raise exception 'BOOKING_SLOT_CONFLICT' using errcode = '23P01';
  end if;

  return NEW;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.appointments_public_booking_guard() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.appointments_public_booking_guard() TO service_role;