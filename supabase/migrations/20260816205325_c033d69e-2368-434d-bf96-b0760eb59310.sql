-- Advisor Supabase : function_search_path_mutable
-- Deux fonctions n'avaient pas de clause SET search_path (dernière définition) :
--   * public.immutable_unaccent(text)   — utilise déjà extensions.unaccent PLEINEMENT
--     qualifié, donc son résultat ne dépend pas du search_path ; le warning porte
--     seulement sur l'absence de la clause.
--   * public.set_articles_updated_at()  — trigger n'utilisant que now() (pg_catalog).
--
-- Correctif minimal : ALTER FUNCTION ... SET search_path = ''.
--   - N'altère PAS le corps → aucun index fonctionnel à reconstruire, aucune régression.
--   - Ne change pas la volatilité (immutable_unaccent reste IMMUTABLE, utilisable en index).
--   - search_path vide = tous les noms doivent être qualifiés : c'est déjà le cas
--     (extensions.unaccent qualifié ; now() résolu via pg_catalog toujours accessible).
--
-- Idempotent (ALTER ... SET est rejouable). À appliquer via Lovable.

do $$
begin
  if to_regprocedure('public.immutable_unaccent(text)') is not null then
    alter function public.immutable_unaccent(text) set search_path = '';
  else
    raise notice 'immutable_unaccent(text) absente, ignorée';
  end if;

  if to_regprocedure('public.set_articles_updated_at()') is not null then
    alter function public.set_articles_updated_at() set search_path = '';
  else
    raise notice 'set_articles_updated_at() absente, ignorée';
  end if;
end $$;