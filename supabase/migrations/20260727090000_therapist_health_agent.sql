-- =====================================================================
-- Agent « Santé de Profil Thérapeute »
-- Adapté au schéma réel de cette base : reviews.comment/author_name/'approved',
-- therapists.subscription_plan, availabilities, appointments, therapist_articles.
-- Entièrement idempotent : peut être rejoué sans risque.
-- =====================================================================

-- 1) Helper admin (basé sur user_roles) ------------------------------------
create or replace function public.is_admin(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _uid and role::text = 'admin');
$$;

-- 2) Galerie du cabinet ----------------------------------------------------
create table if not exists public.therapist_media (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  url text not null,
  kind text not null default 'cabinet',
  created_at timestamptz not null default now()
);
create index if not exists therapist_media_therapist_idx on public.therapist_media(therapist_id);
alter table public.therapist_media enable row level security;

drop policy if exists media_public_read on public.therapist_media;
create policy media_public_read on public.therapist_media for select using (true);

drop policy if exists media_owner_write on public.therapist_media;
create policy media_owner_write on public.therapist_media for all
  using (public.is_admin(auth.uid()) or exists (
    select 1 from public.therapists t where t.id = therapist_id and t.user_id = auth.uid()))
  with check (public.is_admin(auth.uid()) or exists (
    select 1 from public.therapists t where t.id = therapist_id and t.user_id = auth.uid()));

-- 3) Certifications / diplômes --------------------------------------------
create table if not exists public.therapist_certifications (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  name text not null,
  issuer text,
  year int,
  file_url text,                      -- chemin dans le bucket privé therapist-docs
  created_at timestamptz not null default now()
);
create index if not exists therapist_certifications_therapist_idx on public.therapist_certifications(therapist_id);
alter table public.therapist_certifications enable row level security;

drop policy if exists certif_public_read on public.therapist_certifications;
create policy certif_public_read on public.therapist_certifications for select using (true);

drop policy if exists certif_owner_write on public.therapist_certifications;
create policy certif_owner_write on public.therapist_certifications for all
  using (public.is_admin(auth.uid()) or exists (
    select 1 from public.therapists t where t.id = therapist_id and t.user_id = auth.uid()))
  with check (public.is_admin(auth.uid()) or exists (
    select 1 from public.therapists t where t.id = therapist_id and t.user_id = auth.uid()));

-- 4) Réponse du praticien aux avis ----------------------------------------
alter table public.reviews add column if not exists therapist_reply text;
alter table public.reviews add column if not exists therapist_reply_at timestamptz;

-- Le praticien peut répondre à un avis qui le concerne.
drop policy if exists reviews_therapist_reply on public.reviews;
create policy reviews_therapist_reply on public.reviews for update
  using (exists (select 1 from public.therapists t where t.id = reviews.therapist_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.therapists t where t.id = reviews.therapist_id and t.user_id = auth.uid()));

-- 5) Suggestions d'articles (bouton admin « Rédiger l'article suggéré ») ---
create table if not exists public.article_suggestions (
  id uuid primary key default gen_random_uuid(),
  sujet text not null,
  categorie text,
  requete_geo text,
  priorite int not null default 1,
  source text not null default 'manual',
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);
alter table public.article_suggestions enable row level security;
drop policy if exists suggestions_admin_all on public.article_suggestions;
create policy suggestions_admin_all on public.article_suggestions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 6) Tables de scoring -----------------------------------------------------
create table if not exists public.therapist_health_scores (
  therapist_id uuid primary key references public.therapists(id) on delete cascade,
  score_total int not null default 0,
  score_completude int not null default 0,
  score_contenu int not null default 0,
  score_activite int not null default 0,
  score_visibilite int not null default 0,
  grade text not null default 'red',
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  article_idea text,
  article_idea_source text not null default 'rule',
  ai_citability int,
  ai_citability_detail jsonb,
  ai_citability_at timestamptz,
  computed_at timestamptz not null default now()
);

create table if not exists public.therapist_health_score_history (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  score_total int not null,
  breakdown jsonb,
  computed_at timestamptz not null default now()
);
create index if not exists ths_history_idx on public.therapist_health_score_history(therapist_id, computed_at desc);

create table if not exists public.therapist_health_recommendations (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  code text not null,
  label text not null,
  category text,
  impact_points int not null default 0,
  severity text not null default 'info',
  status text not null default 'todo',
  updated_at timestamptz not null default now(),
  unique (therapist_id, code)
);

-- Admin uniquement : ces scores ne doivent jamais fuiter côté thérapeute.
alter table public.therapist_health_scores enable row level security;
alter table public.therapist_health_score_history enable row level security;
alter table public.therapist_health_recommendations enable row level security;

drop policy if exists ths_admin on public.therapist_health_scores;
create policy ths_admin on public.therapist_health_scores for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists thsh_admin on public.therapist_health_score_history;
create policy thsh_admin on public.therapist_health_score_history for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists thr_admin on public.therapist_health_recommendations;
create policy thr_admin on public.therapist_health_recommendations for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 7) Idée d'article déterministe (l'IA peut la remplacer ensuite) ----------
create or replace function public.suggest_article_idea(_specs text[])
returns text language sql immutable as $$
  select case
    when _specs is null or array_length(_specs,1) is null
      then 'Comment choisir son thérapeute en Suisse : 5 critères concrets'
    else 'Ce que la ' || _specs[1] || ' peut vraiment apporter : bienfaits, séance type et remboursement en Suisse'
  end;
$$;

-- 8) Signaux bruts par thérapeute -----------------------------------------
create or replace function public.therapist_health_signals(_id uuid default null)
returns table (
  therapist_id uuid, specialties text[], has_photo boolean, bio_len int,
  n_specialties int, n_languages int, has_geo boolean, has_price boolean,
  n_modes int, n_avail int, n_media int, n_reviews int, avg_rating numeric,
  n_reply int, n_articles int, n_events int, n_certifications int,
  last_login timestamptz, profile_updated timestamptz, appts_90d int,
  last_content_at timestamptz, has_meta boolean, slug text, verified boolean,
  has_web boolean, is_premium boolean
) language sql stable security definer set search_path = public, auth as $$
  select
    t.id,
    t.specialties,
    coalesce(t.photo_url,'') <> '',
    coalesce(length(t.bio),0),
    coalesce(array_length(t.specialties,1),0),
    coalesce(array_length(t.languages,1),0),
    coalesce(t.city,'') <> '' and coalesce(t.canton,'') <> '',
    coalesce(t.price_min,0) > 0,
    coalesce(array_length(t.consultation_modes,1),0),
    (select count(*)::int from public.availabilities a where a.therapist_id = t.id and coalesce(a.is_active,true)),
    (select count(*)::int from public.therapist_media m where m.therapist_id = t.id and m.kind = 'cabinet'),
    (select count(*)::int from public.reviews r where r.therapist_id = t.id and r.status::text = 'approved'),
    (select avg(r.rating)::numeric(3,1) from public.reviews r where r.therapist_id = t.id and r.status::text = 'approved'),
    (select count(*)::int from public.reviews r where r.therapist_id = t.id and r.status::text = 'approved'
       and coalesce(r.therapist_reply,'') <> ''),
    (select count(*)::int from public.therapist_articles ta where ta.therapist_id = t.id),
    (select count(*)::int from public.events e where e.therapist_id = t.id and coalesce(e.status::text,'') <> 'rejected'),
    (select count(*)::int from public.therapist_certifications c where c.therapist_id = t.id),
    (select u.last_sign_in_at from auth.users u where u.id = t.user_id),
    t.updated_at,
    (select count(*)::int from public.appointments ap where ap.therapist_id = t.id
       and ap.appointment_date >= (current_date - 90) and ap.status::text in ('confirmed','completed')),
    greatest(
      (select max(ta.created_at) from public.therapist_articles ta where ta.therapist_id = t.id),
      (select max(e.created_at) from public.events e where e.therapist_id = t.id)
    ),
    coalesce(t.meta_title,'') <> '' and coalesce(t.meta_description,'') <> '',
    t.slug,
    coalesce(t.verified,false),
    coalesce(t.website,'') <> '' or coalesce(t.google_reviews_url,'') <> '',
    coalesce(t.subscription_plan,'basic') <> 'basic'
  from public.therapists t
  where (_id is null or t.id = _id);
$$;

-- 9) Calcul du score d'un thérapeute --------------------------------------
create or replace function public.compute_therapist_health_one(_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s record; c int; ct int; a int; v int; total int; grade text;
  strengths jsonb; gaps jsonb; recos jsonb; art text; rate numeric;
  dl numeric; du numeric; dc numeric; active_codes text[]; found boolean := false;
begin
  for s in select * from public.therapist_health_signals(_id) loop
    found := true;
    c:=0; ct:=0; a:=0; v:=0; strengths:='[]'::jsonb; gaps:='[]'::jsonb; recos:='[]'::jsonb;

    -- Complétude /35
    if s.has_photo then c:=c+6; strengths:=strengths||jsonb_build_object('key','photo','label','Photo de profil présente');
    else gaps:=gaps||jsonb_build_object('key','photo','label','Aucune photo de profil','severity','critical');
      recos:=recos||jsonb_build_object('code','add_photo','label','Ajoutez une photo de profil professionnelle','category','completude','impact_points',6,'severity','critical'); end if;
    if s.bio_len>=300 then c:=c+6; strengths:=strengths||jsonb_build_object('key','bio','label','Présentation complète');
    else recos:=recos||jsonb_build_object('code','expand_bio','label','Étoffez votre présentation ('||s.bio_len||'/300 caractères conseillés)','category','completude','impact_points',6,'severity',case when s.bio_len=0 then 'critical' else 'warning' end); end if;
    if s.n_specialties>=3 then c:=c+4; elsif s.n_specialties>=1 then c:=c+2;
    else recos:=recos||jsonb_build_object('code','add_specialties','label','Renseignez au moins 3 spécialités','category','completude','impact_points',4,'severity','warning'); end if;
    if s.n_languages>=1 then c:=c+3; else recos:=recos||jsonb_build_object('code','add_languages','label','Indiquez les langues parlées','category','completude','impact_points',3,'severity','warning'); end if;
    if s.has_geo then c:=c+3; else recos:=recos||jsonb_build_object('code','add_geo','label','Complétez ville et canton','category','completude','impact_points',3,'severity','critical'); end if;
    if s.has_price then c:=c+4; else recos:=recos||jsonb_build_object('code','add_price','label','Ajoutez vos tarifs','category','completude','impact_points',4,'severity','warning'); end if;
    if s.n_modes>=1 then c:=c+3; else recos:=recos||jsonb_build_object('code','add_modes','label','Précisez les modalités (présentiel / à distance)','category','completude','impact_points',3,'severity','warning'); end if;
    if s.n_avail>0 then c:=c+4; else recos:=recos||jsonb_build_object('code','add_availability','label','Agenda vide : ajoutez des créneaux de disponibilité','category','completude','impact_points',4,'severity','critical'); end if;
    if s.n_media>=2 then c:=c+2; strengths:=strengths||jsonb_build_object('key','media','label','Galerie du cabinet renseignée');
    elsif s.n_media=1 then c:=c+1;
    else recos:=recos||jsonb_build_object('code','add_cabinet_photos','label','Ajoutez des photos de votre cabinet','category','completude','impact_points',2,'severity','info'); end if;

    -- Contenu /25
    if s.n_reviews>=6 then ct:=ct+8; elsif s.n_reviews>=3 then ct:=ct+6; elsif s.n_reviews>=1 then ct:=ct+3;
    else recos:=recos||jsonb_build_object('code','get_reviews','label','Sollicitez un avis client après chaque séance','category','contenu','impact_points',8,'severity','warning'); end if;
    if s.n_reviews>0 and coalesce(s.avg_rating,0)>=4 then ct:=ct+4; strengths:=strengths||jsonb_build_object('key','rating','label','Excellente note moyenne ('||s.avg_rating||'/5)'); end if;
    if s.n_articles>=1 then ct:=ct+5; strengths:=strengths||jsonb_build_object('key','article','label','Article publié dans Voix d''experts');
    else recos:=recos||jsonb_build_object('code','write_article','label','Publiez un article dans Voix d''experts','category','contenu','impact_points',5,'severity','warning'); end if;
    if s.n_events>=1 then ct:=ct+3; else recos:=recos||jsonb_build_object('code','create_event','label','Créez un événement ou atelier découverte','category','contenu','impact_points',3,'severity','info'); end if;
    if s.n_certifications>=1 then ct:=ct+5; strengths:=strengths||jsonb_build_object('key','certif','label','Certifications / diplômes téléversés');
    else recos:=recos||jsonb_build_object('code','add_certifications','label','Téléversez vos certifications ou diplômes','category','contenu','impact_points',5,'severity','warning'); end if;

    -- Activité /20
    dl:=case when s.last_login is null then 99999 else extract(epoch from (now()-s.last_login))/86400 end;
    if dl<=30 then a:=a+5; elsif dl<=90 then a:=a+3; end if;
    if dl>90 then recos:=recos||jsonb_build_object('code','reengage','label','Inactivité prolongée : relance à programmer','category','activite','impact_points',5,'severity','critical'); end if;
    du:=case when s.profile_updated is null then 99999 else extract(epoch from (now()-s.profile_updated))/86400 end;
    if du<=60 then a:=a+3; end if;
    if s.appts_90d>=5 then a:=a+5; elsif s.appts_90d>=1 then a:=a+3; end if;
    dc:=case when s.last_content_at is null then 99999 else extract(epoch from (now()-s.last_content_at))/86400 end;
    if dc<=180 then a:=a+3; end if;
    if s.n_reviews=0 then a:=a+4;
    else
      rate := s.n_reply::numeric / nullif(s.n_reviews,0);
      if rate>=0.5 then a:=a+4; strengths:=strengths||jsonb_build_object('key','reply','label','Répond à ses avis clients');
      elsif s.n_reply>0 then a:=a+2;
      else recos:=recos||jsonb_build_object('code','reply_reviews','label','Répondez à vos avis clients','category','activite','impact_points',4,'severity','warning'); end if;
    end if;

    -- Visibilité /20
    if s.has_meta then v:=v+5; strengths:=strengths||jsonb_build_object('key','seo','label','Métadonnées SEO renseignées');
    else recos:=recos||jsonb_build_object('code','add_meta','label','Complétez le titre et la description SEO','category','visibilite','impact_points',5,'severity','warning'); end if;
    if s.slug is not null and s.verified then v:=v+3; end if;
    if s.n_specialties>=3 then v:=v+4; else recos:=recos||jsonb_build_object('code','kw_specialties','label','Ajoutez des mots-clés de spécialité (recherche interne)','category','visibilite','impact_points',4,'severity','info'); end if;
    if s.has_web then v:=v+5; strengths:=strengths||jsonb_build_object('key','web','label','Présence web externe (site / avis Google)');
    else recos:=recos||jsonb_build_object('code','add_website','label','Ajoutez votre site web ou votre page d''avis Google','category','visibilite','impact_points',5,'severity','info'); end if;
    if s.is_premium then v:=v+3; end if;

    c:=least(c,35); ct:=least(ct,25); a:=least(a,20); v:=least(v,20); total:=c+ct+a+v;
    grade:=case when total>=75 then 'green' when total>=45 then 'orange' else 'red' end;
    art:=public.suggest_article_idea(s.specialties);

    insert into public.therapist_health_scores as ths
      (therapist_id,score_total,score_completude,score_contenu,score_activite,score_visibilite,grade,strengths,gaps,article_idea,computed_at)
    values (s.therapist_id,total,c,ct,a,v,grade,strengths,gaps,art,now())
    on conflict (therapist_id) do update set
      score_total=excluded.score_total,score_completude=excluded.score_completude,score_contenu=excluded.score_contenu,
      score_activite=excluded.score_activite,score_visibilite=excluded.score_visibilite,grade=excluded.grade,
      strengths=excluded.strengths,gaps=excluded.gaps,computed_at=now(),
      article_idea = case when ths.article_idea_source='llm' then ths.article_idea else excluded.article_idea end;

    insert into public.therapist_health_score_history (therapist_id,score_total,breakdown)
    values (s.therapist_id,total,jsonb_build_object('completude',c,'contenu',ct,'activite',a,'visibilite',v));

    active_codes:=array(select jsonb_array_elements(recos)->>'code');
    insert into public.therapist_health_recommendations (therapist_id,code,label,category,impact_points,severity,updated_at)
    select s.therapist_id,r->>'code',r->>'label',r->>'category',(r->>'impact_points')::int,r->>'severity',now()
    from jsonb_array_elements(recos) r
    on conflict (therapist_id,code) do update set
      label=excluded.label,category=excluded.category,impact_points=excluded.impact_points,severity=excluded.severity,updated_at=now();
    update public.therapist_health_recommendations
      set status='resolved',updated_at=now()
      where therapist_id=s.therapist_id and status='todo' and not (code = any(active_codes));
  end loop;
  return found;
end;
$$;

-- 10) Scan complet ---------------------------------------------------------
create or replace function public.compute_therapist_health()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.therapists loop
    perform public.compute_therapist_health_one(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function public.compute_therapist_health() to authenticated, service_role;
grant execute on function public.compute_therapist_health_one(uuid) to authenticated, service_role;
grant execute on function public.is_admin(uuid) to authenticated, anon, service_role;

-- 11) Bucket privé pour les diplômes --------------------------------------
insert into storage.buckets (id, name, public)
values ('therapist-docs','therapist-docs', false)
on conflict (id) do nothing;

drop policy if exists docs_owner_all on storage.objects;
create policy docs_owner_all on storage.objects for all
  using (bucket_id = 'therapist-docs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'therapist-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists docs_admin_read on storage.objects;
create policy docs_admin_read on storage.objects for select
  using (bucket_id = 'therapist-docs' and public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
