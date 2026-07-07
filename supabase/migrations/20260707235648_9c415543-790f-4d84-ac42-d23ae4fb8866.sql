
UPDATE public.therapists
SET search_tokens = to_tsvector('simple',
  public.immutable_unaccent(
    coalesce(first_name,'') || ' ' ||
    coalesce(last_name,'')  || ' ' ||
    coalesce(title,'')      || ' ' ||
    coalesce(city,'')       || ' ' ||
    coalesce(canton,'')     || ' ' ||
    coalesce(short_bio,'')  || ' ' ||
    coalesce(bio,'')        || ' ' ||
    array_to_string(coalesce(specialties,'{}'::text[]),' ') || ' ' ||
    array_to_string(coalesce(approaches,'{}'::text[]),' ')  || ' ' ||
    coalesce(slug,'')
  )
);
