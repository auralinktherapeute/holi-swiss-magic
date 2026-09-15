import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getBookedAppointmentSlots } from "@/lib/public.functions";
import { logTherapistBookingClick } from "@/lib/analytics.functions";
import { getCurrentAnalyticsSessionId } from "@/hooks/use-session-tracking";
import { z } from "zod";
import { useFormDraft } from "@/hooks/use-form-draft";
import { DraftSavedIndicator } from "@/components/drafts/DraftBanner";
import { useSessionState } from "@/hooks/use-session-state";
import { gridColumnIndex, localDateISO, parseDateOnly, storageDow } from "@/lib/dateUtils";
import { appointmentsToBusyRanges, filterAvailableSlots, isSlotBlocked } from "@/lib/booking-slots";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Avail = { day_of_week: number; start_time: string; end_time: string; is_active: boolean };
type Special = { date: string; start_time: string; end_time: string };
type Block = { start_date: string; end_date: string };
type PartialBlock = { start_date: string; end_date: string; start_time: string | null; end_time: string | null };
type Busy = { startsAt: string; endsAt: string };

export type BookingService = { name: string; duration?: number; price?: number; format?: string; color?: string; description?: string };

// Position de colonne dans la grille lundi→dimanche (affichage uniquement).
// Les comparaisons avec `availabilities.day_of_week` utilisent `storageDow`
// (convention JS getDay : 0 = dimanche), voir src/lib/dateUtils.ts.
function buildSlots(start: string, end: string, slotMin: number): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const out: string[] = [];
  let cur = sh * 60 + sm; const max = eh * 60 + em;
  while (cur + slotMin <= max) {
    out.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
    cur += slotMin;
  }
  return out;
}

export function BookingWidget({ therapistId, therapistName, services = [] }: { therapistId: string; therapistName?: string; services?: BookingService[] }) {
  const { t } = useTranslation();
  const fetchBookedSlots = useServerFn(getBookedAppointmentSlots);
  const logBookingClick = useServerFn(logTherapistBookingClick);
  const DAY_LABELS = t("booking.days", { returnObjects: true }) as string[];
  const MONTHS = t("booking.months", { returnObjects: true }) as string[];
  const schema = z.object({
    name: z.string().trim().min(2, t("booking.name_too_short")).max(120),
    email: z.string().trim().email(t("booking.email_invalid")).max(200),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    notes: z.string().max(1000).optional().or(z.literal("")),
  });
  const statePrefix = `booking.${therapistId}`;
  const [selectedServiceIdx, setSelectedServiceIdx] = useSessionState<number | null>(`${statePrefix}.serviceIdx`, null);
  const [month, setMonth] = useSessionState(`${statePrefix}.month`, () => { const d = new Date(); d.setDate(1); return d; });
  const [avs, setAvs] = useState<Avail[]>([]);
  const [specials, setSpecials] = useState<Special[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [partialBlocks, setPartialBlocks] = useState<PartialBlock[]>([]);
  // Rendez-vous existants convertis en INTERVALLES (durée comprise), et
  // occupations importées de l'agenda personnel du praticien.
  const [bookedRanges, setBookedRanges] = useState<Busy[]>([]);
  const [busy, setBusy] = useState<Busy[]>([]);
  // Les horaires et les occupations sont des lectures ESSENTIELLES : en cas
  // d'échec on n'affiche AUCUN créneau, jamais une fausse disponibilité.
  const [schedLoading, setSchedLoading] = useState(true);
  const [schedError, setSchedError] = useState(false);
  const [schedReload, setSchedReload] = useState(0);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [slotsReload, setSlotsReload] = useState(0);
  // Jeton de requête : une réponse arrivée après un changement de jour, de
  // praticien ou de service doit être ignorée, pas appliquée.
  const slotsReqRef = useRef(0);


  const [selectedDate, setSelectedDate] = useSessionState<string | null>(`${statePrefix}.selectedDate`, null);
  const [selectedTime, setSelectedTime] = useSessionState<string | null>(`${statePrefix}.selectedTime`, null);
  const [form, setForm] = useSessionState(`${statePrefix}.form`, { name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const autoRestoredRef = useRef(false);

  const selectedService: BookingService | null =
    selectedServiceIdx !== null && services[selectedServiceIdx] ? services[selectedServiceIdx] : null;
  const slotMin = Math.max(15, Number(selectedService?.duration) || 60);
  const accent = selectedService?.color;

  const { initialDraft, status: draftStatus, savedAt, clearDraft, dismissDraft } = useFormDraft({
    formType: `booking:${therapistId}`,
    data: form,
    enabled: formTouched && !success,
  });
  useEffect(() => {
    if (autoRestoredRef.current || !initialDraft) return;
    autoRestoredRef.current = true;
    setForm(initialDraft as typeof form);
    setFormTouched(true);
    dismissDraft();
  }, [dismissDraft, initialDraft]);

  const updateForm = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setFormTouched(true);
  };

  useEffect(() => {
    let cancelled = false;
    setSchedLoading(true);
    setSchedError(false);
    const fail = () => {
      if (cancelled) return;
      // Aucune donnée partielle : mieux vaut « indisponible » qu'un agenda
      // faussement ouvert.
      setAvs([]); setSpecials([]); setBlocks([]); setPartialBlocks([]);
      setSelectedDate(null); setSelectedTime(null);
      setSchedError(true); setSchedLoading(false);
    };
    (async () => {
      const todayISO = localDateISO(new Date());
      const [aRes, spRes, bRes] = await Promise.all([
        // Horaires HEBDOMADAIRES uniquement : les lignes portant une
        // `specific_date` ont aussi un `day_of_week`, les inclure ouvrirait
        // tous les jours de la semaine correspondants (bug constaté).
        supabase.from("availabilities").select("day_of_week,start_time,end_time,is_active").eq("therapist_id", therapistId).eq("is_active", true).is("specific_date", null).not("day_of_week", "is", null),
        // Disponibilités PONCTUELLES : elles n'ouvrent que leur date exacte.
        supabase.from("availabilities").select("specific_date,start_time,end_time,is_active").eq("therapist_id", therapistId).eq("is_active", true).not("specific_date", "is", null).gte("specific_date", todayISO),
        supabase.from("public_blocked_periods" as never).select("start_date,end_date,is_all_day,start_time,end_time").eq("therapist_id", therapistId),
      ]);
      if (cancelled) return;
      // Une erreur sur l'une de ces trois lectures était jusqu'ici ignorée.
      if (aRes.error || spRes.error || bRes.error) { fail(); return; }
      const a = aRes.data, sp = spRes.data, b = bRes.data;
      setAvs((a ?? []).filter((x) => x.day_of_week !== null) as Avail[]);
      setSpecials(((sp ?? []) as Array<{ specific_date: string; start_time: string; end_time: string }>)
        .map(({ specific_date, start_time, end_time }) => ({ date: specific_date, start_time, end_time })));
      const blockRows = (b ?? []) as Array<{ start_date: string; end_date: string; is_all_day?: boolean; start_time?: string | null; end_time?: string | null }>;
      // Seuls les blocages de journée entière ferment la date ; les blocages
      // partiels ferment les créneaux qu'ils recouvrent (voir slotsForDay).
      setBlocks(blockRows
        .filter((x) => x.is_all_day !== false)
        .map(({ start_date, end_date }) => ({ start_date, end_date })));
      setPartialBlocks(blockRows
        .filter((x) => x.is_all_day === false && x.start_time && x.end_time)
        .map(({ start_date, end_date, start_time, end_time }) => ({ start_date, end_date, start_time: start_time ?? null, end_time: end_time ?? null })));
      setSchedLoading(false);
    })().catch(fail);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistId, schedReload]);


  useEffect(() => {
    if (!selectedDate) {
      setBookedRanges([]); setBusy([]); setSlotsError(false); setSlotsLoading(false);
      return;
    }
    // Nouveau jeton : toute réponse d'une requête antérieure sera écartée.
    const token = ++slotsReqRef.current;
    setSlotsLoading(true);
    setSlotsError(false);
    setBookedRanges([]);
    setBusy([]);
    fetchBookedSlots({ data: { therapistId, appointmentDate: selectedDate } })
      .then((res) => {
        if (token !== slotsReqRef.current) return;
        const payload = res as { booked?: Parameters<typeof appointmentsToBusyRanges>[0]; busy?: Busy[] };
        setBookedRanges(appointmentsToBusyRanges(payload.booked ?? []));
        setBusy(payload.busy ?? []);
        setSlotsLoading(false);
      })
      .catch(() => {
        if (token !== slotsReqRef.current) return;
        setBookedRanges([]); setBusy([]);
        setSelectedTime(null);
        setSlotsError(true); setSlotsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBookedSlots, selectedDate, therapistId, slotMin, slotsReload]);



  const days = useMemo(() => {
    const first = new Date(month);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const lead = gridColumnIndex(first);
    const cells: ({ date: Date; iso: string; available: boolean; blocked: boolean; past: boolean } | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let d = 1; d <= last.getDate(); d++) {
      const date = new Date(month.getFullYear(), month.getMonth(), d);
      const iso = localDateISO(date);
      const dow = storageDow(date);
      const hasAvail = avs.some((a) => a.day_of_week === dow) || specials.some((s) => s.date === iso);
      const blocked = blocks.some((b) => iso >= b.start_date && iso <= b.end_date);
      const past = date < today;
      cells.push({ date, iso, available: hasAvail && !blocked && !past, blocked, past });
    }
    return cells;
  }, [month, avs, specials, blocks]);

  // Blocages partiels du jour sélectionné, convertis en intervalles.
  const partialBlockRanges = useMemo<Busy[]>(() => {
    if (!selectedDate) return [];
    return appointmentsToBusyRanges(
      partialBlocks
        .filter((p) => selectedDate >= p.start_date && selectedDate <= p.end_date && p.start_time && p.end_time)
        .map((p) => {
          const [sh, sm] = (p.start_time as string).split(":").map(Number);
          const [eh, em] = (p.end_time as string).split(":").map(Number);
          const minutes = Math.max(1, (eh * 60 + em) - (sh * 60 + sm));
          return { date: selectedDate, time: p.start_time, durationMinutes: minutes };
        }),
    );
  }, [partialBlocks, selectedDate]);

  const allBusyRanges = useMemo<Busy[]>(
    () => [...bookedRanges, ...busy, ...partialBlockRanges],
    [bookedRanges, busy, partialBlockRanges],
  );

  const slotsForDay = useMemo(() => {
    if (!selectedDate) return [];
    // Tant que les occupations ne sont pas connues (chargement ou panne), on
    // n'affiche AUCUN créneau : une fausse disponibilité coûte un déplacement.
    if (schedLoading || schedError || slotsLoading || slotsError) return [];
    const parsed = parseDateOnly(selectedDate);
    if (!parsed) return [];
    const dow = storageDow(parsed);
    const dayAvs = avs.filter((a) => a.day_of_week === dow);
    const daySpecials = specials.filter((s) => s.date === selectedDate);
    const ranges = [
      ...dayAvs.map((a) => ({ start_time: a.start_time, end_time: a.end_time })),
      ...daySpecials.map((s) => ({ start_time: s.start_time, end_time: s.end_time })),
    ];
    const all = Array.from(
      new Set(ranges.flatMap((a) => buildSlots(a.start_time.slice(0, 5), a.end_time.slice(0, 5), slotMin))),
    ).sort();

    // Un créneau qui chevauche un rendez-vous existant, un blocage partiel ou
    // une occupation importée de l'agenda personnel n'est pas réservable — la
    // DURÉE ENTIÈRE compte, pas seulement l'heure de départ.
    //
    // Le calcul est ancré sur le fuseau du THÉRAPEUTE, pas sur celui du
    // navigateur : « 09:00 » est l'heure murale du praticien, telle que la
    // base la stocke. Construire l'instant avec `new Date(y, m, d, h, min)`
    // aurait utilisé le fuseau du visiteur — juste depuis la Suisse, faux
    // d'une heure depuis Londres, de plusieurs depuis un autre continent.
    return filterAvailableSlots(all, selectedDate, slotMin, allBusyRanges);
  }, [selectedDate, avs, specials, allBusyRanges, slotMin, schedLoading, schedError, slotsLoading, slotsError]);

  // Sélection devenue caduque (créneau pris entre-temps, durée changée) :
  // on l'efface SANS toucher au formulaire déjà rempli.
  useEffect(() => {
    if (!selectedTime || slotsLoading || slotsError || schedLoading || schedError) return;
    if (!slotsForDay.includes(selectedTime)) {
      setSelectedTime(null);
      toast.info(t("booking.slot_expired"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsForDay, selectedTime, slotsLoading, slotsError, schedLoading, schedError]);


  const openConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (services.length > 0 && !selectedService) { toast.error("Veuillez choisir un service."); return; }
    if (!selectedDate || !selectedTime) { toast.error(t("booking.choose_slot")); return; }
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setConfirmOpen(true);
  };

  const confirmBooking = async () => {
    if (!selectedDate || !selectedTime) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);

    // Recontrôle au moment de l'envoi : la page a pu rester ouverte longtemps.
    // Ce contrôle ne remplace pas la garantie en base, il évite un refus sec.
    try {
      const fresh = await fetchBookedSlots({ data: { therapistId, appointmentDate: selectedDate } });
      const payload = fresh as { booked?: Parameters<typeof appointmentsToBusyRanges>[0]; busy?: Busy[] };
      const ranges = [
        ...appointmentsToBusyRanges(payload.booked ?? []),
        ...(payload.busy ?? []),
        ...partialBlockRanges,
      ];
      if (isSlotBlocked(selectedTime, selectedDate, slotMin, ranges)) {
        setSubmitting(false);
        setConfirmOpen(false);
        setSelectedTime(null);
        setSlotsReload((n) => n + 1);
        toast.error(t("booking.slot_taken"));
        return;
      }
    } catch {
      setSubmitting(false);
      setConfirmOpen(false);
      toast.error(t("booking.slots_error"));
      return;
    }

    // Analytics maison : clic de confirmation, indépendant du succès de
    // l'insertion ci-dessous (mesure l'intention, pas la conversion —
    // celle-ci reste lisible via la table appointments).
    logBookingClick({
      data: { therapistId, sessionId: getCurrentAnalyticsSessionId() ?? undefined },
    }).catch((e) => console.error("[analytics] logTherapistBookingClick failed:", e));
    const { error } = await supabase.from("appointments").insert({
      therapist_id: therapistId,
      patient_name: parsed.data.name,
      patient_email: parsed.data.email,
      patient_phone: parsed.data.phone || null,
      appointment_date: selectedDate,
      appointment_time: selectedTime,
      duration_minutes: slotMin,
      service_name: selectedService?.name ?? null,
      notes: parsed.data.notes || null,
      status: "pending",
    });
    setSubmitting(false);
    setConfirmOpen(false);
    if (error) {
      console.error("[booking] appointment insert failed", error);
      // Refus de la garantie posée en base : le créneau vient d'être pris.
      if (/BOOKING_SLOT_CONFLICT/.test(error.message ?? "")) {
        setSelectedTime(null);
        setSlotsReload((n) => n + 1);
        toast.error(t("booking.slot_taken"));
        return;
      }
      toast.error(t("booking.error_generic", "Impossible d'envoyer la demande. Veuillez réessayer."));
      return;
    }
    // eslint-disable-next-line no-console
    console.log("[booking] confirmation email →", parsed.data.email, { selectedDate, selectedTime });
    setSuccess(true);
    await clearDraft();
    toast.success(t("booking.request_sent_toast"));
  };


  if (success) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 text-center space-y-3">
          <div className="text-lg font-semibold text-foreground">{t("booking.request_sent_title")}</div>
          <p className="text-sm text-muted-foreground">{t("booking.request_sent_desc")}</p>
        </CardContent>
      </Card>
    );
  }

  const monthLabel = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg">{t("booking.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {services.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">1. Choisissez un service</div>
            <Select
              value={selectedServiceIdx !== null ? String(selectedServiceIdx) : undefined}
              onValueChange={(v) => {
                setSelectedServiceIdx(Number(v));
                setSelectedDate(null);
                setSelectedTime(null);
              }}
            >
              <SelectTrigger
                className="w-full h-11 border-border bg-card/60 hover:bg-card transition-colors"
                style={accent ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}33` } : undefined}
              >
                <SelectValue placeholder="Sélectionner un type de séance…">
                  {selectedService && (
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: selectedService.color ?? "hsl(var(--primary))" }}
                      />
                      <span className="font-medium">{selectedService.name}</span>
                      <span className="text-xs text-muted-foreground">
                        · {selectedService.duration ? `${selectedService.duration} min` : "durée libre"}
                        {selectedService.price != null ? ` · ${selectedService.price} CHF` : ""}
                      </span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {services.map((s, i) => (
                  <SelectItem key={`${s.name}-${i}`} value={String(i)}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: s.color ?? "hsl(var(--primary))" }}
                      />
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        · {s.duration ? `${s.duration} min` : "durée libre"}
                        {s.price != null ? ` · ${s.price} CHF` : ""}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className={services.length > 0 && !selectedService ? "pointer-events-none opacity-40" : ""} aria-disabled={services.length > 0 && !selectedService}>
          {services.length > 0 && <div className="text-sm font-medium mb-2">2. Choisissez une date</div>}
          <div className="flex items-center justify-between mb-3">
            <Button type="button" size="sm" variant="ghost" aria-label={t("booking.prev_month")}
              onClick={() => { const d = new Date(month); d.setMonth(d.getMonth() - 1); setMonth(d); setSelectedDate(null); setSelectedTime(null); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium capitalize">{monthLabel}</div>
            <Button type="button" size="sm" variant="ghost" aria-label={t("booking.next_month")}
              onClick={() => { const d = new Date(month); d.setMonth(d.getMonth() + 1); setMonth(d); setSelectedDate(null); setSelectedTime(null); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
            {DAY_LABELS.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((c, i) => {
              if (!c) return <div key={i} />;
              const isSel = selectedDate === c.iso;
              const base = "h-10 rounded-md text-sm flex items-center justify-center transition-colors";
              if (c.past) return <div key={i} className={`${base} text-muted-foreground/40`}>{c.date.getDate()}</div>;
              if (c.blocked) return <div key={i} className={`${base} bg-muted/30 text-muted-foreground/60 line-through`}>{c.date.getDate()}</div>;
              if (!c.available) return <div key={i} className={`${base} text-muted-foreground/50`}>{c.date.getDate()}</div>;
              return (
                <button key={i} type="button" onClick={() => { setSelectedDate(c.iso); setSelectedTime(null); }}
                  className={`${base} font-medium ${isSel ? "text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                  style={isSel && accent ? { background: accent, color: "#fff" } : isSel ? undefined : (accent ? { background: `${accent}1a`, color: accent } : undefined)}>
                  {c.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <div>
            <div className="text-sm font-medium mb-2">{t("booking.available_slots")}</div>
            {slotsForDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("booking.no_slots")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slotsForDay.map((s) => {
                  const sel = selectedTime === s;
                  return (
                    <Badge key={s} onClick={() => setSelectedTime(s)}
                      className={`cursor-pointer px-3 py-1.5 text-sm ${sel ? "text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                      style={sel && accent ? { background: accent, color: "#fff" } : (!sel && accent ? { background: `${accent}1a`, color: accent } : undefined)}>
                      {s}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedDate && selectedTime && (services.length === 0 || selectedService) && (
          <form onSubmit={openConfirm} className="space-y-3 border-t border-border pt-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="font-medium mb-1">Récapitulatif</div>
              {selectedService && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Service :</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: selectedService.color ?? "hsl(var(--primary))" }} />
                  <strong>{selectedService.name}</strong>
                </div>
              )}
              <div><span className="text-muted-foreground">Date :</span> <strong>{selectedDate}</strong> à <strong>{selectedTime}</strong></div>
              <div><span className="text-muted-foreground">Durée :</span> <strong>{slotMin} min</strong>{selectedService?.price != null && <> · <span className="text-muted-foreground">Tarif :</span> <strong>{selectedService.price} CHF</strong></>}</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label htmlFor="bk-name">{t("booking.full_name")}</Label>
                <Input id="bk-name" value={form.name} onChange={(e) => updateForm({ name: e.target.value })} required maxLength={120} /></div>
              <div><Label htmlFor="bk-email">{t("auth.email")}</Label>
                <Input id="bk-email" type="email" value={form.email} onChange={(e) => updateForm({ email: e.target.value })} required maxLength={200} /></div>
            </div>
            <div><Label htmlFor="bk-phone">{t("booking.phone_optional")}</Label>
              <Input id="bk-phone" type="tel" value={form.phone} onChange={(e) => updateForm({ phone: e.target.value })} maxLength={40} /></div>
            <div><Label htmlFor="bk-notes">{t("booking.message_optional")}</Label>
              <Textarea id="bk-notes" value={form.notes} onChange={(e) => updateForm({ notes: e.target.value })} maxLength={1000} rows={3} /></div>
            <div className="flex justify-end"><DraftSavedIndicator status={draftStatus} savedAt={savedAt} /></div>
            <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90">
              {submitting ? t("booking.sending") : t("booking.book_at", { date: selectedDate, time: selectedTime })}
            </Button>
          </form>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!submitting) setConfirmOpen(o); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer votre rendez-vous</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-foreground">
                    {therapistName && <div><span className="text-muted-foreground">Thérapeute :</span> <strong>{therapistName}</strong></div>}
                    {selectedService && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Service :</span>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: selectedService.color ?? "hsl(var(--primary))" }} />
                        <strong>{selectedService.name}</strong>
                      </div>
                    )}
                    {selectedDate && <div><span className="text-muted-foreground">Date :</span> <strong>{selectedDate}</strong></div>}
                    {selectedTime && <div><span className="text-muted-foreground">Heure :</span> <strong>{selectedTime}</strong></div>}
                    <div><span className="text-muted-foreground">Durée :</span> <strong>{slotMin} min</strong></div>
                    {selectedService?.price != null && <div><span className="text-muted-foreground">Tarif :</span> <strong>{selectedService.price} CHF</strong></div>}
                  </div>
                  <p className="leading-relaxed">
                    Ce rendez-vous sera réservé exclusivement pour vous. Un thérapeute se prépare pour vous accueillir — merci de respecter cet engagement ou de l'annuler 24h avant. Merci.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                disabled={submitting}
                onClick={(e) => { e.preventDefault(); void confirmBooking(); }}
                className="bg-primary hover:bg-primary/90"
              >
                {submitting ? "Envoi…" : "✅ Confirmer mon rendez-vous"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}