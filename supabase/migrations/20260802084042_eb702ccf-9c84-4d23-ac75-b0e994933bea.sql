-- Marketing — accès agent à la file de sujets soumis (idempotent)

insert into public.app_settings (key, value, updated_at)
values ('marketing_agent_secret', to_jsonb(encode(gen_random_bytes(32), 'hex')), now())
on conflict (key) do nothing;

comment on table public.app_settings is
  'Paramètres applicatifs et secrets partagés. `marketing_agent_secret` autorise le pipeline Claude Code à lire et clôturer les sujets marketing soumis depuis l''admin.';

create or replace function public.marketing_agent_secret_ok(_secret text)
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_attendu text;
begin
  if _secret is null or length(_secret) = 0 then
    return false;
  end if;
  select value #>> '{}' into v_attendu from public.app_settings where key = 'marketing_agent_secret';
  if v_attendu is null then
    return false;
  end if;
  return encode(digest(_secret, 'sha256'), 'hex') = encode(digest(v_attendu, 'sha256'), 'hex');
end;
$$;

revoke execute on function public.marketing_agent_secret_ok(text) from public, anon, authenticated;

create or replace function public.get_pending_marketing_topics(_secret text)
returns table (
  id uuid,
  subject text,
  target_date date,
  network text,
  format text,
  note text,
  created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.marketing_agent_secret_ok(_secret) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
    select t.id, t.subject, t.target_date, t.network, t.format, t.note, t.created_at
    from public.marketing_topics t
    where t.status = 'en_attente'
      and t.target_date <= current_date
    order by t.target_date, t.created_at;
end;
$$;

create or replace function public.close_marketing_topic(
  _secret text,
  _id uuid,
  _reject_reason text default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_touche integer;
begin
  if not public.marketing_agent_secret_ok(_secret) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if _reject_reason is not null and length(trim(_reject_reason)) > 0 then
    update public.marketing_topics
       set reject_reason = _reject_reason, updated_at = now()
     where id = _id and status = 'en_attente';
  else
    update public.marketing_topics
       set status = 'traite', processed_at = now(), updated_at = now()
     where id = _id and status = 'en_attente';
  end if;

  get diagnostics v_touche = row_count;
  return v_touche > 0;
end;
$$;

revoke execute on function public.get_pending_marketing_topics(text) from public;
revoke execute on function public.close_marketing_topic(text, uuid, text) from public;

grant execute on function public.get_pending_marketing_topics(text) to anon, authenticated, service_role;
grant execute on function public.close_marketing_topic(text, uuid, text) to anon, authenticated, service_role;

comment on function public.get_pending_marketing_topics(text) is
  'Sujets marketing en attente dont l''échéance est atteinte. Protégée par marketing_agent_secret — la clé anon seule ne suffit pas.';
comment on function public.close_marketing_topic(text, uuid, text) is
  'Clôt un sujet traité, ou y inscrit un angle de repli (le sujet reste alors en attente pour arbitrage humain).';