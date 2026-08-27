import { Facebook, Instagram, Linkedin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  SOCIAL_META,
  SOCIAL_NETWORKS,
  normalizeSocialUrl,
  socialUrlError,
  type SocialNetwork,
} from "@/lib/social-links";

export type SocialFormState = Record<SocialNetwork, { url: string; visible: boolean }>;

export const EMPTY_SOCIAL_FORM: SocialFormState = {
  instagram: { url: "", visible: false },
  facebook: { url: "", visible: false },
  linkedin: { url: "", visible: false },
};

const ICONS: Record<SocialNetwork, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
};

/**
 * Édition des réseaux sociaux du praticien.
 * L'interrupteur d'affichage est désactivé tant que l'URL n'est pas valide ;
 * le lien reste conservé lorsque l'affichage est coupé.
 */
export function SocialLinksEditor({
  value,
  onChange,
  inputClass,
}: {
  value: SocialFormState;
  onChange: (next: SocialFormState) => void;
  inputClass?: string;
}) {
  const set = (network: SocialNetwork, patch: Partial<{ url: string; visible: boolean }>) => {
    const current = value[network] ?? { url: "", visible: false };
    const next = { ...current, ...patch };
    if (patch.url !== undefined && !normalizeSocialUrl(network, patch.url)) next.visible = false;
    onChange({ ...value, [network]: next });
  };

  const preview = SOCIAL_NETWORKS.filter(
    (n) => value[n]?.visible && normalizeSocialUrl(n, value[n]?.url ?? ""),
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#a89bc4]">
        Renseignez uniquement les réseaux que vous utilisez. Une icône n'apparaît sur votre
        profil public que si le lien est valide (https) et l'affichage activé.
      </p>

      {SOCIAL_NETWORKS.map((network) => {
        const entry = value[network] ?? { url: "", visible: false };
        const Icon = ICONS[network];
        const error = socialUrlError(network, entry.url);
        const valid = !!normalizeSocialUrl(network, entry.url);
        const inputId = `social-${network}`;
        return (
          <div
            key={network}
            className="rounded-xl border border-[rgba(184,110,249,0.18)] bg-[rgba(20,8,40,0.4)] p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-4 w-4 text-[#b86ef9]" aria-hidden />
              <Label htmlFor={inputId} className="font-semibold text-white">
                {SOCIAL_META[network].label}
              </Label>
            </div>

            <Input
              id={inputId}
              type="url"
              inputMode="url"
              value={entry.url}
              maxLength={300}
              placeholder={SOCIAL_META[network].placeholder}
              onChange={(e) => set(network, { url: e.target.value })}
              className={inputClass}
              aria-invalid={!!error}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
            {error && (
              <p id={`${inputId}-error`} className="mt-1.5 text-xs text-[#fca5a5]">
                {error}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Switch
                  id={`${inputId}-visible`}
                  checked={!!entry.visible && valid}
                  disabled={!valid}
                  onCheckedChange={(v) => set(network, { visible: v })}
                />
                <Label
                  htmlFor={`${inputId}-visible`}
                  className={`cursor-pointer text-sm ${valid ? "" : "opacity-60"}`}
                >
                  Afficher sur mon profil public
                </Label>
              </div>
              {entry.url && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 px-3 text-xs text-[#d4a5f9] hover:bg-[#b86ef9]/10"
                  onClick={() => set(network, { url: "", visible: false })}
                >
                  Supprimer le lien
                </Button>
              )}
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border border-[rgba(184,110,249,0.18)] bg-[rgba(20,8,40,0.25)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#a89bc4]">
          Aperçu du rendu public
        </p>
        {preview.length === 0 ? (
          <p className="text-xs text-[#a89bc4]">Aucune icône ne sera affichée sur votre profil.</p>
        ) : (
          <ul className="flex flex-wrap items-center gap-2">
            {preview.map((network) => {
              const Icon = ICONS[network];
              return (
                <li
                  key={network}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.12)] text-[#b86ef9]"
                  title={SOCIAL_META[network].label}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{SOCIAL_META[network].label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default SocialLinksEditor;
