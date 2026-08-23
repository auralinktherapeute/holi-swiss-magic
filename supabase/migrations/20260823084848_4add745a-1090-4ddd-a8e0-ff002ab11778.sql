do $$
declare
  v_pillar uuid;
  r record;
begin
  select id into v_pillar from public.articles
  where slug = 'remboursement-asca-rme-naturopathie-acupuncture-suisse';
  if v_pillar is null then return; end if;

  select slug, title_fr, body_fr into r from public.articles
  where slug = 'remboursement-osteopathie-suisse-2024-lamal-assurances'
    and status <> 'rejected';

  if found then
    update public.articles
    set body_fr = coalesce(body_fr, '') || E'\n\n## ' || r.title_fr || E'\n\n'
        || regexp_replace(coalesce(r.body_fr, ''), '^\s*#\s+[^\n]*\n', ''),
        updated_at = now()
    where id = v_pillar
      and position('## ' || r.title_fr in coalesce(body_fr, '')) = 0;

    update public.articles
    set status = 'rejected', published_at = null, updated_at = now()
    where slug = 'remboursement-osteopathie-suisse-2024-lamal-assurances';
  end if;
end $$;