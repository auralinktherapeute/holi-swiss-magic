-- 1) Dérivation automatique de l'instant (timestamptz) depuis la date + heure murale suisse.
create or replace function public.appointments_fill_times()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_dur int;
begin
  v_dur := coalesce(nullif(NEW.duration_minutes, 0), 60);

  if NEW.start_time is null and NEW.appointment_date is not null and NEW.appointment_time is not null then
    NEW.start_time := ((NEW.appointment_date::text || ' ' || NEW.appointment_time::text)::timestamp
                        at time zone 'Europe/Zurich');
  end if;

  if NEW.end_time is null and NEW.start_time is not null then
    NEW.end_time := NEW.start_time + make_interval(mins => v_dur);
  end if;

  -- Cohérence inverse : si seul l'instant est fourni, remplir la date/heure murale.
  if NEW.appointment_date is null and NEW.start_time is not null then
    NEW.appointment_date := (NEW.start_time at time zone 'Europe/Zurich')::date;
  end if;
  if NEW.appointment_time is null and NEW.start_time is not null then
    NEW.appointment_time := (NEW.start_time at time zone 'Europe/Zurich')::time;
  end if;

  return NEW;
end;
$$;

revoke execute on function public.appointments_fill_times() from public, anon, authenticated;

drop trigger if exists trg_appointments_fill_times on public.appointments;
create trigger trg_appointments_fill_times
  before insert or update on public.appointments
  for each row execute function public.appointments_fill_times();

-- 2) Rattrapage des rendez-vous existants sans instant.
update public.appointments
set start_time = ((appointment_date::text || ' ' || appointment_time::text)::timestamp at time zone 'Europe/Zurich')
where start_time is null and appointment_date is not null and appointment_time is not null;

update public.appointments
set end_time = start_time + make_interval(mins => coalesce(nullif(duration_minutes, 0), 60))
where end_time is null and start_time is not null;

-- 3) Index d'affichage.
create index if not exists idx_appointments_therapist_start on public.appointments (therapist_id, start_time);
create index if not exists idx_appointments_therapist_status on public.appointments (therapist_id, status);
create index if not exists idx_appointments_client on public.appointments (client_id);