import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CalendarDays, Clock, MapPin, User, Wallet, Timer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type BookingFormValues = {
  name: string; email: string; phone: string; notes: string;
  address: string; postal_code: string; city: string; country: string;
};
export type BookingFieldErrors = Partial<Record<keyof BookingFormValues, string>>;

export type BookingDetailsStepProps = {
  therapistName?: string;
  serviceName?: string | null;
  serviceColor?: string;
  date: string;
  time: string;
  durationMin: number;
  price?: number | null;
  locationLabel?: string | null;
  form: BookingFormValues;
  errors: BookingFieldErrors;
  submitting: boolean;
  onChange: (patch: Partial<BookingFormValues>) => void;
  onBack: () => void;
  onSubmit: () => void;
  draftIndicator?: React.ReactNode;
};

/**
 * Étape 2 du parcours : récapitulatif + coordonnées. Purement présentationnelle :
 * aucune écriture ici, la réservation n'est créée que par `onSubmit`
 * (clic final sur « Confirmer la réservation »).
 */
export function BookingDetailsStep(p: BookingDetailsStepProps) {
  const { t } = useTranslation();
  const uid = useId();
  const ids = { name: `${uid}-name`, email: `${uid}-email`, phone: `${uid}-phone`, notes: `${uid}-notes`,
    address: `${uid}-address`, postal_code: `${uid}-npa`, city: `${uid}-city`, country: `${uid}-country` };
  const err = (k: keyof BookingFormValues) =>
    p.errors[k] ? <p id={`${ids[k]}-err`} className="mt-1 text-sm text-destructive" role="alert">{p.errors[k]}</p> : null;
  const aria = (k: keyof BookingFormValues) =>
    p.errors[k] ? { "aria-invalid": true as const, "aria-describedby": `${ids[k]}-err` } : {};

  const steps = [
    t("booking.step_slot", "1. Créneau"),
    t("booking.step_details", "2. Coordonnées"),
    t("booking.step_confirm", "3. Confirmation"),
  ];

  const row = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-primary" aria-hidden>{icon}</span>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-medium text-foreground break-words">{value}</div>
      </div>
    </div>
  );

  // Rendu dans <body> : un ancêtre de la colonne latérale (transform /
  // backdrop-filter) piégeait sinon le `position: fixed` dans la colonne étroite.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setPortalTarget(document.body); }, []);

  const content = (
    <section
      aria-labelledby={`${uid}-title`}
      data-testid="booking-details-step"
      className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-background/95 backdrop-blur-sm"
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" className="min-h-11 gap-2" onClick={p.onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("booking.edit_slot", "Modifier le créneau")}
          </Button>
          <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label={t("booking.steps_label", "Étapes de réservation")}>
            {steps.map((s, i) => (
              <li
                key={s}
                aria-current={i === 1 ? "step" : undefined}
                className={`rounded-full border px-3 py-1 ${i === 1 ? "border-primary bg-primary/15 text-primary" : i === 0 ? "border-border text-foreground" : "border-border text-muted-foreground"}`}
              >
                {s}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-xl">
          <h2 id={`${uid}-title`} className="border-b border-border px-6 py-5 text-xl font-semibold text-foreground">
            {t("booking.details_title", "Vos coordonnées")}
          </h2>
          <div className="grid gap-0 md:grid-cols-2">
            <div className="space-y-4 border-b border-border p-6 md:border-b-0 md:border-r">
              <div className="text-sm font-medium text-muted-foreground">{t("booking.summary", "Récapitulatif")}</div>
              {p.therapistName && row(<User className="h-4 w-4" />, t("booking.summary_therapist", "Thérapeute"), p.therapistName)}
              {p.serviceName && row(<Sparkles className="h-4 w-4" />, t("booking.summary_service", "Prestation"), p.serviceName)}
              {row(<CalendarDays className="h-4 w-4" />, t("booking.summary_date", "Date"), p.date)}
              {row(<Clock className="h-4 w-4" />, t("booking.summary_time", "Heure"), p.time)}
              {row(<Timer className="h-4 w-4" />, t("booking.summary_duration", "Durée"), `${p.durationMin} min`)}
              {p.price != null && row(<Wallet className="h-4 w-4" />, t("booking.summary_price", "Tarif"), `${p.price} CHF`)}
              {p.locationLabel && row(<MapPin className="h-4 w-4" />, t("booking.summary_location", "Lieu"), p.locationLabel)}
            </div>

            <form
              noValidate
              className="space-y-4 p-6"
              onSubmit={(e) => { e.preventDefault(); p.onSubmit(); }}
            >
              <div>
                <Label htmlFor={ids.name}>{t("booking.full_name")}</Label>
                <Input id={ids.name} autoComplete="name" className="mt-1 min-h-11" value={p.form.name} maxLength={120}
                  onChange={(e) => p.onChange({ name: e.target.value })} {...aria("name")} />
                {err("name")}
              </div>
              <div>
                <Label htmlFor={ids.email}>{t("booking.email_label", "Adresse e-mail")}</Label>
                <Input id={ids.email} type="email" autoComplete="email" className="mt-1 min-h-11" value={p.form.email} maxLength={200}
                  onChange={(e) => p.onChange({ email: e.target.value })} {...aria("email")} />
                {err("email")}
              </div>
              <div>
                <Label htmlFor={ids.phone}>{t("booking.phone_optional")}</Label>
                <Input id={ids.phone} type="tel" autoComplete="tel" className="mt-1 min-h-11" value={p.form.phone} maxLength={40}
                  onChange={(e) => p.onChange({ phone: e.target.value })} {...aria("phone")} />
                {err("phone")}
              </div>
              <div>
                <Label htmlFor={ids.address}>{t("booking.address_optional", "Adresse (optionnel)")}</Label>
                <Input id={ids.address} autoComplete="street-address" className="mt-1 min-h-11" value={p.form.address} maxLength={200}
                  onChange={(e) => p.onChange({ address: e.target.value })} {...aria("address")} />
                {err("address")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={ids.postal_code}>{t("booking.postal_code_optional", "NPA (optionnel)")}</Label>
                  <Input id={ids.postal_code} autoComplete="postal-code" className="mt-1 min-h-11" value={p.form.postal_code} maxLength={12}
                    onChange={(e) => p.onChange({ postal_code: e.target.value })} {...aria("postal_code")} />
                  {err("postal_code")}
                </div>
                <div>
                  <Label htmlFor={ids.city}>{t("booking.city_optional", "Ville (optionnel)")}</Label>
                  <Input id={ids.city} autoComplete="address-level2" className="mt-1 min-h-11" value={p.form.city} maxLength={120}
                    onChange={(e) => p.onChange({ city: e.target.value })} {...aria("city")} />
                  {err("city")}
                </div>
              </div>
              <div>
                <Label htmlFor={ids.country}>{t("booking.country_optional", "Pays (optionnel)")}</Label>
                <Input id={ids.country} autoComplete="country-name" className="mt-1 min-h-11" value={p.form.country} maxLength={80}
                  onChange={(e) => p.onChange({ country: e.target.value })} {...aria("country")} />
                {err("country")}
              </div>
              <div>
                <Label htmlFor={ids.notes}>{t("booking.message_optional")}</Label>
                <Textarea id={ids.notes} className="mt-1" rows={4} value={p.form.notes} maxLength={1000}
                  onChange={(e) => p.onChange({ notes: e.target.value })} {...aria("notes")} />
                {err("notes")}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("booking.commitment", "Ce rendez-vous sera réservé exclusivement pour vous. Merci de respecter cet engagement ou de l'annuler 24h avant.")}
              </p>
              {p.draftIndicator && <div className="flex justify-end">{p.draftIndicator}</div>}
              <Button type="submit" disabled={p.submitting} className="min-h-11 w-full bg-primary hover:bg-primary/90">
                {p.submitting ? t("booking.sending") : t("booking.confirm_booking", "Confirmer la réservation")}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
  return portalTarget ? createPortal(content, portalTarget) : content;
}
