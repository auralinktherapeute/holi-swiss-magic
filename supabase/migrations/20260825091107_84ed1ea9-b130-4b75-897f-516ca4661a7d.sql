do $$
declare
  f text;
  helpers text[] := array[
    'has_role(uuid, public.app_role)',
    'is_admin(uuid)',
    'is_therapist_owner(uuid)',
    'is_elite_pro(uuid)',
    'is_verified_therapist(uuid)'
  ];
begin
  foreach f in array helpers loop
    if to_regprocedure('public.' || f) is not null then
      execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
      raise notice 'EXECUTE retabli -> %', f;
    else
      raise notice 'fonction absente, ignoree -> %', f;
    end if;
  end loop;
end $$;

comment on function public.has_role(uuid, public.app_role) is
  'Helper RLS. DOIT rester executable par anon et authenticated : les policies de lecture publique (therapists, therapist_specialties) le traversent. Le revoquer casse silencieusement toutes les pages specialite - constate en production le 25/08/2026.';