import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MapPin, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  communesForNpa,
  normalizePostalCode,
  resolveCity,
  validateTherapistLocation,
  type LocationErrorCode,
  type NpaCommune,
  type NpaIndex,
} from "@/lib/city-normalize";

/**
 * NPA → commune officielle → canton.
 *
 * Remplace la saisie libre de la ville (incident « acacias », 25/09/2026) :
 * la ville n'est plus tapée, elle est CHOISIE parmi les communes que le
 * répertoire officiel des localités (swisstopo) rattache au NPA.
 *
 * Pourquoi pas AddressAutocomplete : ce composant ne renvoie qu'un libellé
 * Google Places (« Les Acacias, Genève, Suisse »), sans NPA ni commune OFS ni
 * canton, et retombe en saisie libre quand la clé Maps manque. Il reproduirait
 * exactement le défaut à corriger.
 *
 * Le référentiel (~50 Ko compressés) est chargé à la demande.
 */

export type SwissLocationValue = { postalCode: string; city: string; canton: string };

type Props = {
  value: SwissLocationValue;
  onChange: (next: SwissLocationValue) => void;
  /** Statut de la fiche : « active » rend la ville obligatoire. */
  status?: string | null;
  /**
   * Ville et NPA tels qu'enregistrés en base. Tant que la saisie leur est
   * identique, une localisation non conforme n'est qu'un avertissement (non
   * bloquant) : seule une modification déclenche la vérification stricte.
   */
  initial?: { city: string | null; postalCode: string | null } | null;
  /** Remonte l'erreur bloquante courante (null si la localisation est valide). */
  onValidityChange?: (error: { code: LocationErrorCode; message: string } | null) => void;
  inputClassName?: string;
  selectClassName?: string;
  labelClassName?: string;
  hintClassName?: string;
  /** id du champ NPA — permet au parent d'y ramener le focus. */
  npaInputId?: string;
};

function uniqueByName(list: NpaCommune[]): NpaCommune[] {
  const seen = new Set<string>();
  return list.filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true)));
}

export function SwissLocationFields({
  value, onChange, status, initial, onValidityChange,
  inputClassName, selectClassName, labelClassName, hintClassName, npaInputId,
}: Props) {
  const { t } = useTranslation();
  const uid = useId();
  const npaId = npaInputId ?? `${uid}-npa`;
  const communeId = `${uid}-commune`;
  const npaHintId = `${uid}-npa-hint`;
  const communeHintId = `${uid}-commune-hint`;
  const errorId = `${uid}-error`;

  const [index, setIndex] = useState<NpaIndex | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let alive = true;
    import("@/lib/swiss-npa")
      .then((m) => alive && setIndex(m.getSwissNpaIndex()))
      .catch(() => alive && setLoadFailed(true));
    return () => { alive = false; };
  }, []);

  const npa = normalizePostalCode(value.postalCode);
  const communes = useMemo(
    () => (index && /^\d{4}$/.test(npa) ? uniqueByName(communesForNpa(index, npa)) : []),
    [index, npa],
  );

  // Commune retenue pour la saisie actuelle (nom officiel), si elle est déterminée.
  const resolved = useMemo(() => {
    if (!index || communes.length === 0 || !value.city.trim()) return null;
    const r = resolveCity(index, npa, value.city);
    if (r.kind === "exact" || r.kind === "variant") return r.commune;
    if (r.kind === "locality" && r.communes.length === 1) return r.communes[0];
    return null;
  }, [index, communes, npa, value.city]);

  // Validation qui BLOQUE l'enregistrement : tient compte des valeurs en base
  // (même règle que le serveur).
  const validation = useMemo(
    () => (index ? validateTherapistLocation(index, {
      city: value.city, postalCode: value.postalCode, status,
      previous: initial ? { city: initial.city, postalCode: initial.postalCode } : null,
    }) : null),
    [index, value.city, value.postalCode, status, initial],
  );
  // Validation stricte, sans tolérance : sert à AVERTIR quand une fiche
  // existante non modifiée n'est pas conforme.
  const strict = useMemo(
    () => (index ? validateTherapistLocation(index, { city: value.city, postalCode: value.postalCode, status }) : null),
    [index, value.city, value.postalCode, status],
  );

  const messageFor = (v: typeof validation) =>
    v && !v.ok
      ? t(`profile_edit.location_error_${v.code}`, { npa, city: value.city.trim(), communes: v.candidates.join(", ") })
      : null;
  const errorText = useMemo(() => messageFor(validation), [validation, t, npa, value.city]); // eslint-disable-line react-hooks/exhaustive-deps
  const warningText = useMemo(
    () => (validation?.ok ? messageFor(strict) : null),
    [validation, strict, t, npa, value.city], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!onValidityChange) return;
    onValidityChange(validation && !validation.ok && errorText ? { code: validation.code, message: errorText } : null);
  }, [validation, errorText, onValidityChange]);

  // NPA d'une seule commune : on la sélectionne dès que l'utilisateur a tapé le NPA.
  useEffect(() => {
    if (!touched || communes.length !== 1) return;
    const only = communes[0];
    if (value.city !== only.name || value.canton !== only.canton) {
      onChange({ postalCode: npa, city: only.name, canton: only.canton });
    }
  }, [touched, communes, npa, value.city, value.canton, onChange]);

  const onNpaChange = (raw: string) => {
    setTouched(true);
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (!index || digits.length !== 4) {
      // Saisie en cours : on ne touche pas encore à la commune.
      onChange({ ...value, postalCode: digits });
      return;
    }
    // NPA complet : la commune actuelle est conservée si elle appartient au
    // nouveau NPA (sous sa forme officielle), sinon il faut la rechoisir.
    const r = value.city.trim() ? resolveCity(index, digits, value.city) : null;
    const keep =
      r && (r.kind === "exact" || r.kind === "variant") ? r.commune
      : r && r.kind === "locality" && r.communes.length === 1 ? r.communes[0]
      : null;
    onChange({
      postalCode: digits,
      city: keep ? keep.name : "",
      canton: keep ? keep.canton : value.canton,
    });
  };

  const onCommuneChange = (name: string) => {
    setTouched(true);
    const c = communes.find((x) => x.name === name);
    onChange({ postalCode: npa, city: c?.name ?? "", canton: c?.canton ?? value.canton });
  };

  // Affichée dès le chargement : une fiche existante mal localisée (ville sans
  // NPA, quartier…) doit savoir tout de suite ce qui bloquera l'enregistrement.
  // Exception : « 4 chiffres » n'est pas affiché pendant la frappe du NPA
  // (l'enregistrement reste bloqué tant qu'il est incomplet).
  const typingNpa = touched && validation && !validation.ok && validation.code === "npa_invalid" && npa.length < 4;
  const showError = Boolean(errorText) && !typingNpa;
  // Fiche existante non modifiée dont la ville n'est pas sous sa forme
  // officielle (« Bienne ») : le serveur la conserve telle quelle, donc on
  // n'annonce pas de renommage ; la liste reste vide pour que le thérapeute
  // puisse choisir la forme officielle s'il le souhaite.
  const unchangedVariant = Boolean(
    validation?.ok && validation.unchanged && resolved && resolved.name !== value.city.trim(),
  );
  const shownCommune = unchangedVariant ? null : resolved;
  const selectValue = shownCommune?.name ?? "";
  const legacyCity = value.city.trim() && !shownCommune ? value.city.trim() : null;
  const willRename = shownCommune && value.city.trim() && shownCommune.name !== value.city.trim();

  // Astérisque : la localisation n'est obligatoire que pour une fiche publiée,
  // ou dès qu'une ville est saisie (le NPA devient alors nécessaire).
  const required = status === "active" || value.city.trim() !== "";
  const labelCls = labelClassName ?? "text-sm font-medium";
  const hintCls = hintClassName ?? "text-xs text-muted-foreground";

  return (
    <>
      <div className="space-y-2">
        <label htmlFor={npaId} className={cn("block", labelCls)}>
          {t("profile_edit.postal_code")}{required ? " *" : ""}
        </label>
        <div className="relative">
          <MapPin aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
          <Input
            id={npaId}
            value={value.postalCode}
            onChange={(e) => onNpaChange(e.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="1227"
            aria-describedby={[npaHintId, showError || warningText ? errorId : ""].filter(Boolean).join(" ")}
            aria-invalid={showError && validation && !validation.ok && validation.code.startsWith("npa") ? true : undefined}
            className={cn(inputClassName, "pl-9 tabular-nums tracking-wider")}
          />
          {!index && !loadFailed && (
            <Loader2 aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin opacity-60" />
          )}
        </div>
        <p id={npaHintId} className={hintCls}>
          {loadFailed ? t("profile_edit.location_load_failed") : t("profile_edit.location_npa_hint")}
        </p>
        <p className={cn(hintCls, "opacity-80")}>{t("profile_edit.location_source")}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor={communeId} className={cn("block", labelCls)}>
          {t("profile_edit.city")}{required ? " *" : ""}
        </label>
        <select
          id={communeId}
          value={selectValue}
          onChange={(e) => onCommuneChange(e.target.value)}
          disabled={communes.length === 0}
          aria-describedby={[communeHintId, showError || warningText ? errorId : ""].filter(Boolean).join(" ")}
          aria-invalid={showError && validation && !validation.ok && validation.code.startsWith("city") ? true : undefined}
          className={cn(selectClassName, "disabled:cursor-not-allowed disabled:opacity-60")}
        >
          <option value="" className="bg-[#1a0a2e]">
            {communes.length === 0 ? t("profile_edit.location_enter_npa") : t("profile_edit.location_choose")}
          </option>
          {communes.map((c) => (
            <option key={c.name} value={c.name} className="bg-[#1a0a2e]">
              {c.name} ({c.canton})
            </option>
          ))}
        </select>
        <p id={communeHintId} className={cn(hintCls, "flex items-start gap-1.5")} aria-live="polite">
          {shownCommune ? (
            <>
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22d3ee]" />
              <span>
                {willRename
                  ? t("profile_edit.location_saved_as", { city: shownCommune.name, canton: shownCommune.canton })
                  : t("profile_edit.location_ok", { canton: shownCommune.canton })}
              </span>
            </>
          ) : legacyCity ? (
            <span>{t("profile_edit.location_current", { city: legacyCity })}</span>
          ) : null}
        </p>
        {showError && errorText && (
          <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-red-300">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorText}</span>
          </p>
        )}
        {!showError && warningText && (
          // Fiche existante non conforme, localisation non modifiée : on
          // informe sans bloquer (pas de role="alert" à l'ouverture de la page).
          <p id={errorId} role="status" className="flex items-start gap-1.5 text-xs text-amber-200">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t("profile_edit.location_warning_unchanged")} {warningText}</span>
          </p>
        )}
      </div>

    </>
  );
}
