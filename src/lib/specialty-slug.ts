/**
 * Slug d'URL d'une spécialité pour une langue — source unique, partagée par le
 * sitemap et par les liens de navigation (bulles de l'accueil, pages famille).
 *
 * Repli sur le slug de base quand la variante localisée manque (colonne absente
 * de la requête ou non renseignée) : la route `/$lang/specialites/$specialtySlug`
 * retrouve alors la spécialité par son slug de base et redirige vers l'URL
 * localisée canonique. Un lien n'aboutit donc jamais en 404.
 */
export type SpecialtySlugs = {
  slug: string;
  slug_de?: string | null;
  slug_it?: string | null;
  slug_en?: string | null;
};

export function specSlugForLang(s: SpecialtySlugs, lang: string): string {
  return (
    (lang === "de" ? s.slug_de : lang === "it" ? s.slug_it : lang === "en" ? s.slug_en : null) ||
    s.slug
  );
}
