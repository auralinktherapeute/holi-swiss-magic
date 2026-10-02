import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, ChevronLeft, ChevronRight, Clock, MapPin, PenLine, UserRound } from "lucide-react";
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

type Avail = { day_of_week: number; start_time: string; end_time: string; is_active: boolean };
type Special = { date: string; start_time: string; end_time: string };
type Block = { start_date: string; end_date: string };
type PartialBlock = { start_date: string; end_date: string; start_time: string | null; end_time: string | null };
type Busy = { startsAt: string; endsAt: string };
type BookingStep = "slot" | "details";
type FieldErrors = Partial<Record<"name" | "email" | "phone" | "notes", string>>;

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

type Schedule = { avs: Avail[]; specials: Special[]; blocks: Block[]; partialBlocks: PartialBlock[] };

/**
 * Lecture des horaires, disponibilités ponctuelles et indisponibilités.
 *
 * Une seule fonction, utilisée à l'affichage ET au recontrôle final : le
 * recontrôle repartait sinon de données chargées à l'ouverture de la page,
 * qui peuvent avoir des heures d'écart.
 */
async function loadSchedule(therapistId: string): Promise<Schedule> {
  const todayISO = localDateISO(new Date());
  const [aRes, spRes, bRes] = await Promise.all([
    // Horaires HEBDOMADAIRES uniquement : les lignes portant une
    // `specific_date` ont aussi un `day_of_week`, les inclure ouvrirait tous
    // les jours de la semaine correspondants (bug constaté).
    supabase.from("availabilities").select("day_of_week,start_time,end_time,is_active").eq("therapist_id", therapistId).eq("is_active", true).is("specific_date", null).not("day_of_week", "is", null),
    // Disponibilités PONCTUELLES : elles n'ouvrent que leur date exacte.
    supabase.from("availabilities").select("specific_date,start_time,end_time,is_active").eq("therapist_id", therapistId).eq("is_active", true).not("specific_date", "is", null).gte("specific_date", todayISO),
    supabase.from("public_blocked_periods" as never).select("start_date,end_date,is_all_day,start_time,end_time").eq("therapist_id", therapistId),
  ]);
  if (aRes.error || spRes.error || bRes.error) throw new Error("SCHEDULE_READ_FAILED");
  const blockRows = (bRes.data ?? []) as Array<{ start_date: string; end_date: string; is_all_day?: boolean; start_time?: string | null; end_time?: string | null }>;
  return {
    avs: ((aRes.data ?? []) as Avail[]).filter((x) => x.day_of_week !== null),
    specials: ((spRes.data ?? []) as Array<{ specific_date: string; start_time: string; end_time: string }>)
      .map(({ specific_date, start_time, end_time }) => ({ date: specific_date, start_time, end_time })),
    // Seuls les blocages de journée entière ferment la date ; les blocages
    // partiels ferment les créneaux qu'ils recouvrent.
    blocks: blockRows.filter((x) => x.is_all_day !== false).map(({ start_date, end_date }) => ({ start_date, end_date })),
    partialBlocks: blockRows
      .filter((x) => x.is_all_day === false && x.start_time && x.end_time)
      .map(({ start_date, end_date, start_time, end_time }) => ({ start_date, end_date, start_time: start_time ?? null, end_time: end_time ?? null })),
  };
}

/** Créneaux ouverts par les horaires du praticien, hors occupations. */
function openSlotsFor(sched: Pick<Schedule, "avs" | "specials" | "blocks">, dateISO: string, slotMin: number): string[] {
  if (sched.blocks.some((b) => dateISO >= b.start_date && dateISO <= b.end_date)) return [];
  const parsed = parseDateOnly(dateISO);
  if (!parsed) return [];
  const dow = storageDow(parsed);
  const ranges = [
    ...sched.avs.filter((a) => a.day_of_week === dow),
    ...sched.specials.filter((s) => s.date === dateISO),
  ];
  return Array.from(
    new Set(ranges.flatMap((a) => buildSlots(a.start_time.slice(0, 5), a.end_time.slice(0, 5), slotMin))),
  ).sort();
}

/** Blocages partiels du jour, convertis en intervalles horaires. */
function partialRangesFor(partialBlocks: PartialBlock[], dateISO: string): Busy[] {
  return appointmentsToBusyRanges(
    partialBlocks
      .filter((p) => dateISO >= p.start_date && dateISO <= p.end_date && p.start_time && p.end_time)
      .map((p) => {
        const [sh, sm] = (p.start_time as string).split(":").map(Number);
        const [eh, em] = (p.end_time as string).split(":").map(Number);
        const minutes = Math.max(1, eh * 60 + em - (sh * 60 + sm));
        return { date: dateISO, time: p.start_time, durationMinutes: minutes };
      }),
  );
}


export function BookingWidget({
  therapistId,
  therapistName,
  services = [],
  locationLabel,
}: {
  therapistId: string;
  therapistName?: string;
  services?: BookingService[];
  locationLabel?: string | null;
}) {
  const { t } = useTranslation();
  const fetchBookedSlots = useServerFn(getBookedAppointmentSlots);
  const logBookingClick = useServerFn(logTherapistBookingClick);
  const formId = useId();
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
  const [step, setStep] = useSessionState<BookingStep>(`${statePrefix}.step`, "slot");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as Array<keyof typeof form>) delete next[key];
      return next;
    });
    setFormTouched(true);
  };

  // Clé du triplet praticien / jour / durée. Les créneaux ne sont réputés
  // vérifiés que pour CE triplet : après un changement de service ou de jour,
  // et même après restauration de la session, plus rien n'est réservable tant
  // que la vérification n'a pas été refaite.
  const slotsKey = selectedDate ? `${therapistId}|${selectedDate}|${slotMin}` : null;
  const [verifiedKey, setVerifiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSchedLoading(true);
    setSchedError(false);
    const fail = () => {
      if (cancelled) return;
      // Aucune donnée partielle : mieux vaut « indisponible » qu'un agenda
      // faussement ouvert.
      setAvs([]); setSpecials([]); setBlocks([]); setPartialBlocks([]);
      setSelectedDate(null); setSelectedTime(null); setStep("slot");
      setVerifiedKey(null);
      setSchedError(true); setSchedLoading(false);
    };
    loadSchedule(therapistId)
      .then((sched) => {
        if (cancelled) return;
        setAvs(sched.avs);
        setSpecials(sched.specials);
        setBlocks(sched.blocks);
        setPartialBlocks(sched.partialBlocks);
        setSchedLoading(false);
      })
      .catch(fail);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistId, schedReload]);


  useEffect(() => {
    // Toute réponse d'une requête antérieure est écartée — y compris au
    // démontage et quand la date vient d'être annulée, cas où une réponse
    // tardive rouvrait auparavant des créneaux pour un jour plus sélectionné.
    const token = ++slotsReqRef.current;
    setVerifiedKey(null);
    if (!slotsKey || !selectedDate) {
      setBookedRanges([]); setBusy([]); setSlotsError(false); setSlotsLoading(false);
      return;
    }
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
        setVerifiedKey(slotsKey);
        setSlotsLoading(false);
      })
      .catch(() => {
        if (token !== slotsReqRef.current) return;
        setBookedRanges([]); setBusy([]);
        setSelectedTime(null);
        setStep("slot");
        setSlotsError(true); setSlotsLoading(false);
      });
    return () => { ++slotsReqRef.current; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBookedSlots, slotsKey, slotsReload]);




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
  const partialBlockRanges = useMemo<Busy[]>(
    () => (selectedDate ? partialRangesFor(partialBlocks, selectedDate) : []),
    [partialBlocks, selectedDate],
  );

  const allBusyRanges = useMemo<Busy[]>(
    () => [...bookedRanges, ...busy, ...partialBlockRanges],
    [bookedRanges, busy, partialBlockRanges],
  );

  // Les créneaux ne sont considérés vérifiés que pour le triplet courant.
  const slotsVerified =
    !!selectedDate && verifiedKey === slotsKey && !schedLoading && !schedError && !slotsLoading && !slotsError;

  const slotsForDay = useMemo(() => {
    if (!selectedDate) return [];
    // Tant que les occupations ne sont pas connues (chargement, panne, ou
    // vérification faite pour un AUTRE jour/service), on n'affiche AUCUN
    // créneau : une fausse disponibilité coûte un déplacement.
    if (!slotsVerified) return [];
    const all = openSlotsFor({ avs, specials, blocks }, selectedDate, slotMin);

    // Un créneau qui chevauche un rendez-vous existant, un blocage partiel ou
    // une occupation importée de l'agenda personnel n'est pas réservable — la
    // DURÉE ENTIÈRE compte, pas seulement l'heure de départ.
    //
    // Le calcul est ancré sur le fuseau du THÉRAPEUTE, pas sur celui du
    // navigateur : « 09:00 » est l'heure murale du praticien, telle que la
    // base la stocke.
    return filterAvailableSlots(all, selectedDate, slotMin, allBusyRanges);
  }, [selectedDate, avs, specials, blocks, allBusyRanges, slotMin, slotsVerified]);


  // Sélection devenue caduque (créneau pris entre-temps, durée changée) :
  // on l'efface SANS toucher au formulaire déjà rempli.
  useEffect(() => {
    if (!selectedTime || !slotsVerified) return;
    if (!slotsForDay.includes(selectedTime)) {
      setSelectedTime(null);
      setStep("slot");
      toast.info(t("booking.slot_expired"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsForDay, selectedTime, slotsVerified]);


  const validateForm = (): boolean => {
    const parsed = schema.safeParse(form);
    if (parsed.success) {
      setFieldErrors({});
      return true;
    }
    const next: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "name" || field === "email" || field === "phone" || field === "notes") {
        next[field] = issue.message;
      }
    }
    setFieldErrors(next);
    toast.error(parsed.error.issues[0].message);
    return false;
  };

  const openDetailsStep = (time: string) => {
    if (services.length > 0 && !selectedService) { toast.error(t("booking.choose_service")); return; }
    if (!selectedDate) { toast.error(t("booking.choose_slot")); return; }
    if (schedLoading || slotsLoading) { toast.info(t("booking.slots_loading")); return; }
    if (schedError || slotsError) { toast.error(t("booking.slots_error")); return; }
    if (!slotsVerified || !slotsForDay.includes(time)) {
      setSelectedTime(null);
      setStep("slot");
      toast.error(t("booking.choose_slot"));
      return;
    }
    setSelectedTime(time);
    setFieldErrors({});
    setStep("details");
  };

  const submitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) void confirmBooking();
  };

  const confirmBooking = async () => {
    if (!selectedDate || !selectedTime) return;
    if (schedLoading || slotsLoading) { toast.info(t("booking.slots_loading")); return; }
    if (schedError || slotsError || !slotsVerified || !slotsForDay.includes(selectedTime)) {
      setStep("slot");
      setSelectedTime(null);
      toast.error(t("booking.slots_error"));
      return;
    }
    const parsed = schema.safeParse(form);
    if (!validateForm()) return;
    const parsed = schema.parse(form);
    setSubmitting(true);

    // Recontrôle au moment de l'envoi : la page a pu rester ouverte longtemps.
    // On RECHARGE aussi horaires et indisponibilités — s'appuyer sur ceux du
    // premier rendu laissait passer un créneau fermé depuis. Ce contrôle ne
    // remplace pas la garantie en base, il évite un refus sec.
    try {
      const [fresh, sched] = await Promise.all([
        fetchBookedSlots({ data: { therapistId, appointmentDate: selectedDate } }),
        loadSchedule(therapistId),
      ]);
      const payload = fresh as { booked?: Parameters<typeof appointmentsToBusyRanges>[0]; busy?: Busy[] };
      const ranges = [
        ...appointmentsToBusyRanges(payload.booked ?? []),
        ...(payload.busy ?? []),
        ...partialRangesFor(sched.partialBlocks, selectedDate),
      ];
      const stillOpen = openSlotsFor(sched, selectedDate, slotMin).includes(selectedTime);
      if (!stillOpen || isSlotBlocked(selectedTime, selectedDate, slotMin, ranges)) {
        setSubmitting(false);
        setStep("slot");
        setSelectedTime(null);
        setSchedReload((n) => n + 1);
        setSlotsReload((n) => n + 1);
        toast.error(t("booking.slot_taken"));
        return;
      }
    } catch {
      setSubmitting(false);
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
    if (error) {
      console.error("[booking] appointment insert failed", error);
      // Refus de la garantie posée en base : le créneau vient d'être pris.
      if (/BOOKING_SLOT_CONFLICT/.test(error.message ?? "")) {
        setSelectedTime(null);
        setStep("slot");
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
    setStep("slot");
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
  const summaryRows = [
    therapistName ? { label: t("booking.summary_therapist"), value: therapistName, icon: UserRound } : null,
    selectedService ? { label: t("booking.summary_service"), value: selectedService.name, icon: CalendarCheck } : null,
    selectedDate ? { label: t("booking.summary_date"), value: selectedDate, icon: CalendarCheck } : null,
    selectedTime ? { label: t("booking.summary_time"), value: selectedTime, icon: Clock } : null,
    { label: t("booking.summary_duration"), value: `${slotMin} min`, icon: Clock },
    selectedService?.price != null ? { label: t("booking.summary_price"), value: `${selectedService.price} CHF`, icon: CalendarCheck } : null,
    locationLabel ? { label: t("booking.summary_location"), value: locationLabel, icon: MapPin } : null,
  ].filter((row): row is { label: string; value: string; icon: typeof CalendarCheck } => Boolean(row));
  const stepItems = [t("booking.step_slot"), t("booking.step_details"), t("booking.step_confirmation")];

  if (step === "details" && selectedDate && selectedTime && (services.length === 0 || selectedService)) {
    return (
      <section className="fixed inset-0 z-50 overflow-y-auto bg-background/95 px-4 py-6 backdrop-blur-md sm:px-6 lg:px-10" aria-labelledby={`${formId}-title`}>
        <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-6xl items-center">
          <Card className="w-full overflow-hidden border-border bg-card/95 shadow-2xl shadow-primary/20">
            <CardHeader className="border-b border-border bg-surface/60 p-5 sm:p-8">
              <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-medium text-primary">{t("booking.confirmation_title")}</p>
                  <CardTitle id={`${formId}-title`} className="text-2xl leading-tight sm:text-3xl">
                    {t("booking.details_title")}
                  </CardTitle>
                </div>
                <ol className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[520px]" aria-label={t("booking.steps_label")}>
                  {stepItems.map((label, index) => {
                    const active = index === 1;
                    const done = index === 0;
                    return (
                      <li
                        key={label}
                        className={`min-h-11 rounded-md border px-3 py-2 ${active || done ? "border-primary/60 bg-primary/15 text-foreground" : "border-border bg-surface/50 text-muted-foreground"}`}
                        aria-current={active ? "step" : undefined}
                      >
                        <span className="block text-xs font-semibold text-primary">{index + 1}</span>
                        <span className="font-medium">{label}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </CardHeader>

            <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <aside className="border-b border-border bg-surface/40 p-5 sm:p-8 lg:border-b-0 lg:border-r">
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-medium text-primary">{t("booking.summary_title")}</p>
                    <h3 className="mt-1 text-xl font-semibold text-foreground">{selectedService?.name ?? t("booking.title")}</h3>
                  </div>
                  <dl className="space-y-3">
                    {summaryRows.map(({ label, value, icon: Icon }) => (
                      <div key={label} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-md border border-border bg-card/60 p-3">
                        <div className="grid h-11 w-11 place-items-center rounded-md bg-primary/15 text-primary">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
                          <dd className="mt-1 break-words text-sm font-semibold text-foreground">{value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full"
                    onClick={() => setStep("slot")}
                    disabled={submitting}
                  >
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    {t("booking.edit_slot")}
                  </Button>
                </div>
              </aside>

              <form onSubmit={submitDetails} className="space-y-5 p-5 sm:p-8" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-name`}>{t("booking.full_name")}</Label>
                    <Input
                      id={`${formId}-name`}
                      value={form.name}
                      onChange={(e) => updateForm({ name: e.target.value })}
                      required
                      maxLength={120}
                      className="min-h-12 bg-input"
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={fieldErrors.name ? `${formId}-name-error` : undefined}
                    />
                    {fieldErrors.name && <p id={`${formId}-name-error`} className="text-sm text-destructive" aria-live="polite">{fieldErrors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-email`}>{t("booking.email_label")}</Label>
                    <Input
                      id={`${formId}-email`}
                      type="email"
                      value={form.email}
                      onChange={(e) => updateForm({ email: e.target.value })}
                      required
                      maxLength={200}
                      className="min-h-12 bg-input"
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? `${formId}-email-error` : undefined}
                    />
                    {fieldErrors.email && <p id={`${formId}-email-error`} className="text-sm text-destructive" aria-live="polite">{fieldErrors.email}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-phone`}>{t("booking.phone_optional")}</Label>
                  <Input
                    id={`${formId}-phone`}
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateForm({ phone: e.target.value })}
                    maxLength={40}
                    className="min-h-12 bg-input"
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? `${formId}-phone-error` : undefined}
                  />
                  {fieldErrors.phone && <p id={`${formId}-phone-error`} className="text-sm text-destructive" aria-live="polite">{fieldErrors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-notes`}>{t("booking.message_optional")}</Label>
                  <Textarea
                    id={`${formId}-notes`}
                    value={form.notes}
                    onChange={(e) => updateForm({ notes: e.target.value })}
                    maxLength={1000}
                    rows={6}
                    className="min-h-36 bg-input"
                    aria-invalid={Boolean(fieldErrors.notes)}
                    aria-describedby={fieldErrors.notes ? `${formId}-notes-error` : undefined}
                  />
                  {fieldErrors.notes && <p id={`${formId}-notes-error`} className="text-sm text-destructive" aria-live="polite">{fieldErrors.notes}</p>}
                </div>
                <div className="flex justify-end"><DraftSavedIndicator status={draftStatus} savedAt={savedAt} /></div>
                <Button type="submit" disabled={submitting} className="min-h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {submitting ? t("booking.sending") : "Confirmer la réservation"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

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
                setStep("slot");
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

        {schedError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 space-y-3" aria-live="polite">
            <p className="text-sm text-foreground">{t("booking.schedule_error")}</p>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setSchedReload((n) => n + 1)}>
              {t("booking.retry")}
            </Button>
          </div>
        ) : schedLoading ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">{t("booking.slots_loading")}</p>
        ) : (
        <div className={services.length > 0 && !selectedService ? "pointer-events-none opacity-40" : ""} aria-disabled={services.length > 0 && !selectedService}>

          {services.length > 0 && <div className="text-sm font-medium mb-2">2. Choisissez une date</div>}
          <div className="flex items-center justify-between mb-3">
            <Button type="button" size="sm" variant="ghost" aria-label={t("booking.prev_month")}
              onClick={() => { const d = new Date(month); d.setMonth(d.getMonth() - 1); setMonth(d); setSelectedDate(null); setSelectedTime(null); setStep("slot"); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium capitalize">{monthLabel}</div>
            <Button type="button" size="sm" variant="ghost" aria-label={t("booking.next_month")}
              onClick={() => { const d = new Date(month); d.setMonth(d.getMonth() + 1); setMonth(d); setSelectedDate(null); setSelectedTime(null); setStep("slot"); }}>
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
                <button key={i} type="button" onClick={() => { setSelectedDate(c.iso); setSelectedTime(null); setStep("slot"); }}
                  className={`${base} font-medium ${isSel ? "text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                  style={isSel && accent ? { background: accent, color: "#fff" } : isSel ? undefined : (accent ? { background: `${accent}1a`, color: accent } : undefined)}>
                  {c.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
        )}


        {selectedDate && (
          <div>
            <div className="text-sm font-medium mb-2">{t("booking.available_slots")}</div>
            <div aria-live="polite">
              {slotsLoading ? (
                <p className="text-sm text-muted-foreground">{t("booking.slots_loading")}</p>
              ) : slotsError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-3">
                  <p className="text-sm text-foreground">{t("booking.slots_error")}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setSlotsReload((n) => n + 1)}
                  >
                    {t("booking.retry")}
                  </Button>
                </div>
              ) : slotsForDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("booking.no_slots")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slotsForDay.map((s) => {
                    const sel = selectedTime === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => openDetailsStep(s)}
                        className="min-h-11 min-w-11 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Badge
                          className={`cursor-pointer px-3 py-1.5 text-sm ${sel ? "text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                          style={sel && accent ? { background: accent, color: "#fff" } : (!sel && accent ? { background: `${accent}1a`, color: accent } : undefined)}
                        >
                          {s}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}


        {selectedDate && selectedTime && (services.length === 0 || selectedService) && (
          <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-foreground" aria-live="polite">
            {t("booking.details_opened")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}