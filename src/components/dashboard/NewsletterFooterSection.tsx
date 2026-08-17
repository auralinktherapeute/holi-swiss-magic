import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getMyNewsletterConsent,
  updateMyNewsletterConsent,
} from "@/lib/newsletter-consent.functions";

/**
 * Rubrique « La Lettre Holiswiss » affichée en bas de l'espace thérapeute.
 * Réservée aux thérapeutes connectés : le consentement est enregistré côté serveur.
 */
export function NewsletterFooterSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchConsent = useServerFn(getMyNewsletterConsent);
  const saveConsent = useServerFn(updateMyNewsletterConsent);
  const [loading, setLoading] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [unsubOpen, setUnsubOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["newsletter-consent"],
    queryFn: () => fetchConsent(),
    staleTime: 60_000,
    retry: false,
  });

  // La rubrique reste visible même si le statut n'est pas encore chargé
  // (ou si la lecture échoue) : le thérapeute doit toujours pouvoir s'inscrire.
  const optIn = data?.optIn === true;
  const wasUnsubscribed = !optIn && Boolean(data?.unsubscribedAt);

  const benefits = [
    t("profile_edit.nlf_b1"),
    t("profile_edit.nlf_b2"),
    t("profile_edit.nlf_b3"),
    t("profile_edit.nlf_b4"),
    t("profile_edit.nlf_b5"),
    t("profile_edit.nlf_b6"),
  ];

  const apply = async (next: boolean) => {
    setLoading(true);
    try {
      await saveConsent({ data: { optIn: next } });
      await qc.invalidateQueries({ queryKey: ["newsletter-consent"] });
      toast.success(
        next
          ? t("profile_edit.newsletter_subscribed")
          : t("profile_edit.newsletter_unsubscribed")
      );
      return true;
    } catch {
      toast.error(t("profile_edit.newsletter_error"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = optIn
    ? t("profile_edit.nlf_state_active")
    : wasUnsubscribed
      ? t("profile_edit.nlf_state_off")
      : t("profile_edit.nlf_state_none");

  return (
    <section
      aria-labelledby="nlf-title"
      className="mt-10 border-t border-[rgba(184,110,249,0.2)] bg-[rgba(20,8,40,0.5)]"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-start gap-3">
          <Mail className="mt-1 h-5 w-5 shrink-0 text-[#b86ef9]" aria-hidden="true" />
          <div>
            <h2 id="nlf-title" className="text-lg font-semibold text-white">
              {t("profile_edit.nlf_title")}
            </h2>
            <p className="text-sm text-[#c9bce0]">{t("profile_edit.nlf_subtitle")}</p>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#a89bc4]">
          {t("profile_edit.nlf_text")}
        </p>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-[#c9bce0]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7de3b8]" aria-hidden="true" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-xl border border-[rgba(184,110,249,0.2)] bg-[rgba(20,8,40,0.7)] p-4 sm:p-5">
          <p
            className={`flex items-start gap-2 text-sm ${optIn ? "text-[#7de3b8]" : "text-[#c9bce0]"}`}
          >
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {statusLabel}
              {optIn && data?.optInAt
                ? ` ${t("profile_edit.newsletter_status_since")} ${new Date(
                    data.optInAt
                  ).toLocaleDateString("fr-CH", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}.`
                : ""}
            </span>
          </p>

          {optIn && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                aria-expanded={prefsOpen}
                onClick={() => setPrefsOpen((v) => !v)}
              >
                {t("profile_edit.newsletter_manage_prefs")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px] text-[#ff8f8f] hover:bg-[rgba(239,68,68,0.12)] hover:text-[#ffb1b1]"
                disabled={loading}
                onClick={() => setUnsubOpen(true)}
              >
                {t("profile_edit.newsletter_unsubscribe_action")}
              </Button>
            </div>
          )}

          {(!optIn || prefsOpen) && (
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={optIn}
                disabled={loading}
                onChange={(e) => {
                  if (!e.target.checked) {
                    setUnsubOpen(true);
                    return;
                  }
                  void apply(true);
                }}
                className="mt-1 h-5 w-5 shrink-0 rounded border-[rgba(184,110,249,0.4)] bg-[rgba(20,8,40,0.5)] text-[#b86ef9] focus:ring-[#b86ef9] focus:ring-offset-0"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-white">
                  {t("profile_edit.nlf_consent")}
                </span>
                <span className="block text-xs text-[#a89bc4]">
                  {t("profile_edit.nlf_optional")}{" "}
                  <a
                    href="/fr/confidentialite"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-[#d4a5f9]"
                  >
                    {t("profile_edit.newsletter_privacy_link")}
                  </a>
                  .
                </span>
              </span>
            </label>
          )}
        </div>
      </div>

      <Dialog open={unsubOpen} onOpenChange={setUnsubOpen}>
        <DialogContent className="border-[rgba(184,110,249,0.25)] bg-[#1a0b2e] text-white">
          <DialogHeader>
            <DialogTitle>{t("profile_edit.newsletter_unsub_confirm_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#a89bc4]">
            {t("profile_edit.newsletter_unsub_confirm_body")}
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setUnsubOpen(false)}
            >
              {t("profile_edit.newsletter_unsub_cancel")}
            </Button>
            <Button
              type="button"
              className="min-h-[44px] bg-[#ef4444] text-white hover:bg-[#dc2626]"
              disabled={loading}
              onClick={async () => {
                const ok = await apply(false);
                if (ok) {
                  setUnsubOpen(false);
                  setPrefsOpen(false);
                }
              }}
            >
              {t("profile_edit.newsletter_unsub_confirm_cta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
