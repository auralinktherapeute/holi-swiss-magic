-- Add trend + reactivity + recap tracking columns to therapist_health_scores
ALTER TABLE public.therapist_health_scores
  ADD COLUMN IF NOT EXISTS score_previous integer,
  ADD COLUMN IF NOT EXISTS score_reactivite integer,
  ADD COLUMN IF NOT EXISTS last_recap_sent_at timestamptz;

-- Rewrite compute_therapist_health_one to snapshot previous score before update.
-- Everything else identical to the current live function.
CREATE OR REPLACE FUNCTION public.compute_therapist_health_one(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  s record; c int; ct int; a int; v int; total int; grade text;
  strengths jsonb; gaps jsonb; recos jsonb; art text; rate numeric;
  dl numeric; du numeric; dc numeric; active_codes text[]; found boolean := false;
  prev int;
begin
  for s in select * from public.therapist_health_signals(_id) loop
    found := true;
    c:=0; ct:=0; a:=0; v:=0; strengths:='[]'::jsonb; gaps:='[]'::jsonb; recos:='[]'::jsonb;

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

    if s.n_reviews>=6 then ct:=ct+8; elsif s.n_reviews>=3 then ct:=ct+6; elsif s.n_reviews>=1 then ct:=ct+3;
    else recos:=recos||jsonb_build_object('code','get_reviews','label','Sollicitez un avis client après chaque séance','category','contenu','impact_points',8,'severity','warning'); end if;
    if s.n_reviews>0 and coalesce(s.avg_rating,0)>=4 then ct:=ct+4; strengths:=strengths||jsonb_build_object('key','rating','label','Excellente note moyenne ('||s.avg_rating||'/5)'); end if;
    if s.n_articles>=1 then ct:=ct+5; strengths:=strengths||jsonb_build_object('key','article','label','Article publié dans Voix d''experts');
    else recos:=recos||jsonb_build_object('code','write_article','label','Publiez un article dans Voix d''experts','category','contenu','impact_points',5,'severity','warning'); end if;
    if s.n_events>=1 then ct:=ct+3; else recos:=recos||jsonb_build_object('code','create_event','label','Créez un événement ou atelier découverte','category','contenu','impact_points',3,'severity','info'); end if;
    if s.n_certifications>=1 then ct:=ct+5; strengths:=strengths||jsonb_build_object('key','certif','label','Certifications / diplômes téléversés');
    else recos:=recos||jsonb_build_object('code','add_certifications','label','Téléversez vos certifications ou diplômes','category','contenu','impact_points',5,'severity','warning'); end if;

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

    -- Snapshot previous score before update (for ↑/↓ trend UI)
    select score_total into prev from public.therapist_health_scores where therapist_id = s.therapist_id;

    insert into public.therapist_health_scores as ths
      (therapist_id,score_total,score_previous,score_completude,score_contenu,score_activite,score_visibilite,grade,strengths,gaps,article_idea,computed_at)
    values (s.therapist_id,total,prev,c,ct,a,v,grade,strengths,gaps,art,now())
    on conflict (therapist_id) do update set
      score_previous=ths.score_total,
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
$function$;

-- Keep execute restricted to service_role (as hardened earlier)
REVOKE EXECUTE ON FUNCTION public.compute_therapist_health_one(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_therapist_health_one(uuid) TO service_role;