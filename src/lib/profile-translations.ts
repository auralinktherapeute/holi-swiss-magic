// Traductions du contenu rédigé par le praticien (module partagé client/serveur).
// Le texte original reste dans les colonnes d'origine ; les traductions vivent
// dans `therapists.profile_translations`. Jamais de champ vide : à défaut de
// traduction, on affiche l'original avec une mention discrète.

export const PROFILE_LANGS = ["fr", "de", "it", "en"] as const;
export type ProfileLang = (typeof PROFILE_LANGS)[number];

export type ServiceTr = { name?: string | null; description?: string | null };
export type LangTranslation = {
  title?: string | null;
  short_bio?: string | null;
  bio?: string | null;
  specialties?: string[] | null;
  services?: Record<string, ServiceTr> | null;
  status?: "auto" | "reviewed";
  source_hash?: string;
  updated_at?: string;
};
export type ProfileTranslations = {
  source_lang?: ProfileLang;
  source_hash?: string;
  langs?: Partial<Record<ProfileLang, LangTranslation>>;
};

export type SourceFields = {
  title?: string | null;
  short_bio?: string | null;
  bio?: string | null;
  specialties?: string[] | null;
  services?: unknown;
};

/** Empreinte stable (FNV-1a) du contenu source — détecte une traduction périmée. */
export function sourceHash(src: SourceFields): string {
  const services = Array.isArray(src.services)
    ? (src.services as any[]).map((s) => [s?.id ?? "", s?.name ?? "", s?.description ?? ""])
    : [];
  const str = JSON.stringify([src.title ?? "", src.short_bio ?? "", src.bio ?? "", src.specialties ?? [], services]);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

const ORIGINAL_NOTICE: Record<ProfileLang, Record<ProfileLang, string>> = {
  fr: { fr: "", de: "Contenu original en allemand", it: "Contenu original en italien", en: "Contenu original en anglais" },
  de: { fr: "Originalinhalt auf Französisch", de: "", it: "Originalinhalt auf Italienisch", en: "Originalinhalt auf Englisch" },
  it: { fr: "Contenuto originale in francese", de: "Contenuto originale in tedesco", it: "", en: "Contenuto originale in inglese" },
  en: { fr: "Original content in French", de: "Original content in German", it: "Original content in Italian", en: "" },
};
const AUTO_NOTICE: Record<ProfileLang, string> = {
  fr: "Traduction automatique",
  de: "Automatische Übersetzung",
  it: "Traduzione automatica",
  en: "Automatic translation",
};

export function isProfileLang(v: unknown): v is ProfileLang {
  return typeof v === "string" && (PROFILE_LANGS as readonly string[]).includes(v);
}

/**
 * Remplace les champs rédigés par le praticien par leur traduction dans `lang`.
 * Chaque champ retombe individuellement sur l'original si sa traduction manque.
 * `translationNotice` : texte discret à afficher (null si contenu dans sa langue et relu).
 */
export function localizeProfile<T extends Record<string, any>>(
  th: T | null | undefined,
  lang: string,
): (T & { translationNotice: string | null }) | null | undefined {
  if (!th) return th as null | undefined;
  const tr = (th.profile_translations ?? {}) as ProfileTranslations;
  const target: ProfileLang = isProfileLang(lang) ? lang : "fr";
  const source: ProfileLang = isProfileLang(tr.source_lang) ? tr.source_lang : "fr";
  if (target === source) return { ...th, translationNotice: null };

  const l = tr.langs?.[target];
  // Traduction absente ou périmée (source modifiée depuis) → original + mention.
  const fresh = !!l && (!tr.source_hash || l.source_hash === tr.source_hash);
  if (!fresh) return { ...th, translationNotice: ORIGINAL_NOTICE[target][source] || null };

  const pick = (tv: string | null | undefined, orig: string | null | undefined) =>
    orig && typeof tv === "string" && tv.trim() ? tv : orig;

  const origSpecs: string[] = Array.isArray(th.specialties) ? th.specialties : [];
  const trSpecs = Array.isArray(l!.specialties) && l!.specialties.length === origSpecs.length ? l!.specialties : null;
  const services = Array.isArray(th.services)
    ? (th.services as any[]).map((s) => {
        const st = s?.id ? l!.services?.[s.id] : undefined;
        if (!st) return s;
        return { ...s, name: pick(st.name, s.name), description: pick(st.description, s.description) };
      })
    : th.services;

  return {
    ...th,
    title: pick(l!.title, th.title),
    short_bio: pick(l!.short_bio, th.short_bio),
    bio: pick(l!.bio, th.bio),
    specialties: trSpecs ? origSpecs.map((o, i) => pick(trSpecs[i], o)) : origSpecs,
    services,
    translationNotice: l!.status === "reviewed" ? null : AUTO_NOTICE[target],
  };
}
