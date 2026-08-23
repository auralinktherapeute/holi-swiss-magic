do $$
declare
  v_pillar uuid;
  v_extra text := '';
  r record;
begin
  select id into v_pillar
  from public.articles
  where slug = 'remboursement-asca-rme-naturopathie-acupuncture-suisse';

  if v_pillar is null then
    raise notice 'Article pilier introuvable, migration ignoree.';
    return;
  end if;

  for r in
    select slug, title_fr, body_fr
    from public.articles
    where slug in (
      'remboursement-lamal-assurances-complementaires-therapies-holistiques-suisse',
      'remboursement-lamal-naturopathie-acupuncture-canton-suisse',
      'remboursement-osteopathie-suisse-2024-lamal',
      'therapies-remboursees-suisse-lamal'
    )
    and status <> 'rejected'
    order by slug
  loop
    v_extra := v_extra
      || E'\n\n## ' || r.title_fr || E'\n\n'
      || regexp_replace(coalesce(r.body_fr, ''), '^\s*#\s+[^\n]*\n', '');
  end loop;

  if length(v_extra) > 0 then
    update public.articles
    set body_fr = coalesce(body_fr, '') || v_extra,
        updated_at = now()
    where id = v_pillar
      and position('## Naturopathie : Guide du remboursement en Suisse en 2024' in coalesce(body_fr, '')) = 0;
  end if;

  update public.articles
  set status = 'validated',
      published_at = coalesce(published_at, now()),
      meta_title_fr = coalesce(meta_title_fr, 'Remboursement ASCA / RME en Suisse : le guide'),
      meta_description_fr = coalesce(
        meta_description_fr,
        'LAMal, assurances complementaires, labels ASCA et RME : tout savoir pour se faire rembourser ses seances de therapie en Suisse.'
      ),
      updated_at = now()
  where id = v_pillar;

  update public.articles
  set status = 'rejected',
      published_at = null,
      updated_at = now()
  where slug in (
    'remboursement-lamal-assurances-complementaires-therapies-holistiques-suisse',
    'remboursement-lamal-naturopathie-acupuncture-canton-suisse',
    'remboursement-osteopathie-suisse-2024-lamal',
    'therapies-remboursees-suisse-lamal'
  );
end $$;