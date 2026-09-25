// Moteur de traduction des profils praticiens (serveur uniquement).
import {
  PROFILE_LANGS,
  isProfileLang,
  sourceHash,
  type LangTranslation,
  type ProfileLang,
  type ProfileTranslations,
} from "@/lib/profile-translations";

const MODEL = "openai/gpt-6-astra";
const LANG_NAMES: Record<ProfileLang, string> = { fr: "français", de: "allemand (Suisse)", it: "italien", en: "anglais" };

type Row = {
  id: string;
  title: string | null;
  short_bio: string | null;
  bio: string | null;
  specialties: string[] | null;
  services: any;
  profile_translations: any;
};

async function callModel(system: string, prompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY manquant.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions: system,
      input: prompt,
      text: { format: { type: "json_object" } },
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`Traduction indisponible (HTTP ${res.status}) ${body.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") out += ev.delta;
        if (ev.type === "response.failed" || ev.type === "error") throw new Error("Traduction refusée par le service.");
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Traduction")) throw e;
      }
    }
  }
  if (!out.trim()) throw new Error("Réponse de traduction vide.");
  return out;
}

const SYSTEM = `Tu traduis des profils de praticiens bien-être pour Holiswiss, annuaire suisse.
Règles :
- Traduction fidèle, naturelle, ton chaleureux. Tutoiement/vouvoiement : conserver celui de l'original.
- Ne rien ajouter, ne rien retirer, aucune promesse de guérison ni vocabulaire médical absent de l'original.
- Conserver les noms propres, lieux, chiffres, sauts de ligne.
- Termes spécialisés (soins esséniens, magnétisme, lithothérapie, radiesthésie, reiki...) : utiliser l'équivalent reconnu dans la langue cible.
- Chaque liste garde exactement le même nombre d'éléments, dans le même ordre.
Réponds uniquement en JSON valide.`;

export async function translateTherapistRow(row: Row, opts: { force?: boolean } = {}): Promise<ProfileTranslations> {
  const existing = (row.profile_translations ?? {}) as ProfileTranslations;
  const hash = sourceHash(row);
  const services = (Array.isArray(row.services) ? row.services : [])
    .filter((s: any) => s?.id && (s?.name || s?.description))
    .map((s: any) => ({ id: String(s.id), name: s.name ?? "", description: s.description ?? "" }));
  const specialties = Array.isArray(row.specialties) ? row.specialties : [];

  // Langues à (re)traduire : absentes, ou périmées. Une traduction relue par le
  // praticien est conservée tant que la source n'a pas changé.
  const src = {
    title: row.title ?? "",
    short_bio: row.short_bio ?? "",
    bio: row.bio ?? "",
    specialties,
    services,
  };
  if (!src.title && !src.short_bio && !src.bio && !specialties.length && !services.length) {
    return { ...existing, source_lang: existing.source_lang ?? "fr", source_hash: hash, langs: existing.langs ?? {} };
  }

  const prompt = `Détecte la langue source (fr, de, it ou en) de ce profil, puis traduis-le dans les TROIS autres langues parmi fr, de, it, en.
Format de réponse :
{"source_lang":"fr","translations":{"<code>":{"title":"","short_bio":"","bio":"","specialties":[...],"services":[{"id":"","name":"","description":""}]}}}

PROFIL :
${JSON.stringify(src)}`;

  const text = await callModel(SYSTEM, prompt);
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Traduction illisible.");
    parsed = JSON.parse(m[0]);
  }
  const source: ProfileLang = isProfileLang(parsed?.source_lang) ? parsed.source_lang : "fr";
  const now = new Date().toISOString();
  const langs: Partial<Record<ProfileLang, LangTranslation>> = {};
  for (const l of PROFILE_LANGS) {
    if (l === source) continue;
    const prev = existing.langs?.[l];
    if (!opts.force && prev && prev.source_hash === hash && existing.source_lang === source) {
      langs[l] = prev; // à jour (relue ou non) : on ne touche pas
      continue;
    }
    const t = parsed?.translations?.[l];
    if (!t) continue;
    const svc: Record<string, { name: string; description: string }> = {};
    for (const s of Array.isArray(t.services) ? t.services : []) {
      if (s?.id && services.some((o: { id: string }) => o.id === String(s.id))) {
        svc[String(s.id)] = { name: String(s.name ?? ""), description: String(s.description ?? "") };
      }
    }
    const specs = Array.isArray(t.specialties) && t.specialties.length === specialties.length
      ? t.specialties.map((x: unknown) => String(x ?? ""))
      : null;
    langs[l] = {
      title: typeof t.title === "string" ? t.title : null,
      short_bio: typeof t.short_bio === "string" ? t.short_bio : null,
      bio: typeof t.bio === "string" ? t.bio : null,
      specialties: specs,
      services: svc,
      status: "auto",
      source_hash: hash,
      updated_at: now,
    };
  }
  return { source_lang: source, source_hash: hash, langs };
}

export const TRANSLATION_SELECT = "id,title,short_bio,bio,specialties,services,profile_translations";
