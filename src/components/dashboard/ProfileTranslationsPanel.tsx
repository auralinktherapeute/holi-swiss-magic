import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Languages, RefreshCw, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getMyProfileTranslations,
  saveMyProfileTranslation,
  translateMyProfile,
} from "@/lib/profile-translation.functions";
import type { LangTranslation, ProfileLang, ProfileTranslations } from "@/lib/profile-translations";

const LABEL: Record<ProfileLang, string> = { fr: "Français", de: "Deutsch", it: "Italiano", en: "English" };

type Draft = {
  title: string;
  short_bio: string;
  bio: string;
  specialties: string[];
  services: Record<string, { name: string; description: string }>;
};

const fieldCls =
  "w-full rounded-lg border border-[rgba(184,110,249,0.25)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]";

export function ProfileTranslationsPanel() {
  const qc = useQueryClient();
  const fetchTr = useServerFn(getMyProfileTranslations);
  const runTranslate = useServerFn(translateMyProfile);
  const saveTr = useServerFn(saveMyProfileTranslation);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-profile-translations"],
    queryFn: () => fetchTr(),
  });
  const [lang, setLang] = useState<ProfileLang>("de");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"translate" | "save" | null>(null);

  const row = data?.row as any;
  const tr = (row?.profile_translations ?? {}) as ProfileTranslations;
  const source: ProfileLang = (tr.source_lang as ProfileLang) ?? "fr";
  const targets = (["fr", "de", "it", "en"] as ProfileLang[]).filter((l) => l !== source);
  const services: any[] = Array.isArray(row?.services) ? row.services.filter((s: any) => s?.id && s?.name) : [];
  const specs: string[] = Array.isArray(row?.specialties) ? row.specialties : [];
  const current: LangTranslation | undefined = tr.langs?.[lang];
  const stale = !!current && current.source_hash !== data?.currentHash;

  useEffect(() => {
    if (!targets.includes(lang) && targets[0]) setLang(targets[0]);
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!row) return;
    setDraft({
      title: current?.title ?? "",
      short_bio: current?.short_bio ?? "",
      bio: current?.bio ?? "",
      specialties: specs.map((_, i) => current?.specialties?.[i] ?? ""),
      services: Object.fromEntries(
        services.map((s) => [s.id, { name: current?.services?.[s.id]?.name ?? "", description: current?.services?.[s.id]?.description ?? "" }]),
      ),
    });
  }, [row, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTranslate = async () => {
    setBusy("translate");
    try {
      await runTranslate();
      await qc.invalidateQueries({ queryKey: ["my-profile-translations"] });
      toast.success("Traductions mises à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Traduction impossible. Réessayez plus tard.");
    } finally {
      setBusy(null);
    }
  };

  const onSave = async () => {
    if (!draft) return;
    setBusy("save");
    try {
      await saveTr({ data: { lang, fields: draft } });
      await qc.invalidateQueries({ queryKey: ["my-profile-translations"] });
      toast.success(`Traduction ${LABEL[lang]} enregistrée et marquée comme relue.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-labelledby="translations-title"
      className="mt-8 rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[rgba(26,10,46,0.6)] p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="translations-title" className="flex items-center gap-2 text-lg font-bold text-white">
            <Languages className="h-5 w-5 text-[#b86ef9]" aria-hidden /> Traductions de votre profil
          </h2>
          <p className="mt-1 text-sm text-[#d4c4e0]">
            Votre texte est traduit automatiquement pour les visiteurs des autres langues. Relisez et corrigez si besoin.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onTranslate} disabled={busy !== null}
          className="min-h-11 gap-2 border-[rgba(184,110,249,0.4)] bg-transparent text-white hover:bg-white/5">
          <RefreshCw className={`h-4 w-4 ${busy === "translate" ? "animate-spin" : ""}`} aria-hidden />
          {busy === "translate" ? "Traduction…" : "Traduire à nouveau"}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-[#d4c4e0]" aria-live="polite">Chargement…</p>}
      {isError && (
        <div role="alert" className="flex items-center gap-3 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4" aria-hidden /> Traductions indisponibles pour le moment.
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => refetch()}>Réessayer</Button>
        </div>
      )}

      {row && draft && (
        <>
          <div role="tablist" aria-label="Langue de traduction" className="mb-4 flex flex-wrap gap-2">
            {targets.map((l) => {
              const st = tr.langs?.[l];
              return (
                <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)}
                  className={`min-h-11 rounded-full border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] ${
                    lang === l ? "border-[#b86ef9] bg-[rgba(184,110,249,0.2)] text-white" : "border-white/15 text-[#d4c4e0] hover:bg-white/5"
                  }`}>
                  {LABEL[l]}
                  <span className="ml-2 text-xs opacity-80">
                    {!st ? "· à traduire" : st.status === "reviewed" ? "· relue" : "· automatique"}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mb-4 flex items-center gap-2 text-xs text-[#d4c4e0]" aria-live="polite">
            {!current ? (
              <><AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden /> Pas encore de traduction : votre texte original est affiché aux visiteurs.</>
            ) : stale ? (
              <><AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden /> Votre profil a changé depuis cette traduction : cliquez « Traduire à nouveau ».</>
            ) : current.status === "reviewed" ? (
              <><CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden /> Traduction relue par vous.</>
            ) : (
              <><AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden /> Traduction automatique non vérifiée.</>
            )}
          </p>

          <div className="space-y-5">
            {(
              [
                ["title", "Métier", false],
                ["short_bio", "Phrase d'introduction", true],
                ["bio", "À propos", true],
              ] as const
            ).map(([k, label, multi]) =>
              (row[k] ?? "").trim() ? (
                <div key={k} className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-[#d4c4e0]">{label} — original ({LABEL[source]})</p>
                    <p className="whitespace-pre-line rounded-lg bg-white/5 px-3 py-2 text-sm text-white/80">{row[k]}</p>
                  </div>
                  <div>
                    <label htmlFor={`tr-${k}`} className="mb-1 block text-xs font-medium text-[#d4c4e0]">{label} — {LABEL[lang]}</label>
                    {multi ? (
                      <textarea id={`tr-${k}`} rows={k === "bio" ? 8 : 3} className={fieldCls} value={draft[k]}
                        onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
                    ) : (
                      <input id={`tr-${k}`} className={fieldCls} value={draft[k]}
                        onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
                    )}
                  </div>
                </div>
              ) : null,
            )}

            {specs.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-[#d4c4e0]">Spécialités</legend>
                <div className="grid gap-2 md:grid-cols-2">
                  {specs.map((s, i) => (
                    <div key={`${s}-${i}`} className="flex items-center gap-2">
                      <span className="w-1/2 truncate text-sm text-white/70" title={s}>{s}</span>
                      <input aria-label={`${s} — ${LABEL[lang]}`} className={fieldCls} value={draft.specialties[i] ?? ""}
                        onChange={(e) => {
                          const next = [...draft.specialties];
                          next[i] = e.target.value;
                          setDraft({ ...draft, specialties: next });
                        }} />
                    </div>
                  ))}
                </div>
              </fieldset>
            )}

            {services.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-[#d4c4e0]">Prestations</legend>
                <div className="space-y-2">
                  {services.map((s) => (
                    <div key={s.id} className="grid gap-2 md:grid-cols-2">
                      <span className="text-sm text-white/70">{s.name}</span>
                      <input aria-label={`${s.name} — ${LABEL[lang]}`} className={fieldCls}
                        value={draft.services[s.id]?.name ?? ""}
                        onChange={(e) => setDraft({
                          ...draft,
                          services: { ...draft.services, [s.id]: { name: e.target.value, description: draft.services[s.id]?.description ?? "" } },
                        })} />
                    </div>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <Button type="button" onClick={onSave} disabled={busy !== null}
              className="min-h-11 gap-2 bg-gradient-to-r from-[#b86ef9] to-[#a855f7] text-white">
              <Save className="h-4 w-4" aria-hidden />
              {busy === "save" ? "…" : `Valider la traduction ${LABEL[lang]}`}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
