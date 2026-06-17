import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon, Clock, MapPin, Video, Users, Upload, X,
  ChevronLeft, ChevronRight, Eye, Check, Trash2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { upsertMyEvent, signEventImage } from "@/lib/events.functions";

export type EventDraft = {
  id?: string | null;
  title: string;
  short_description: string;
  long_description: string;
  category: "atelier" | "conference" | "retraite" | "cercle" | "meditation" | "autre";
  event_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string;
  format: "in_person" | "online" | "hybrid";
  location: string;
  online_link: string;
  is_paid: boolean;
  price: string;
  price_description: string;
  reduced_price: string;
  reduced_price_description: string;
  seats: string;
  enable_waitlist: boolean;
  image_url: string; // storage path
};

const CATEGORY_LABEL: Record<EventDraft["category"], string> = {
  atelier: "Atelier",
  conference: "Conférence",
  retraite: "Retraite",
  cercle: "Cercle",
  meditation: "Méditation",
  autre: "Autre",
};

const FORMAT_LABEL: Record<EventDraft["format"], string> = {
  in_person: "Présentiel",
  online: "En ligne",
  hybrid: "Hybride",
};

const EMPTY: EventDraft = {
  id: null, title: "", short_description: "", long_description: "",
  category: "atelier", event_date: "", start_time: "", end_time: "",
  format: "in_person", location: "", online_link: "",
  is_paid: false, price: "", price_description: "",
  reduced_price: "", reduced_price_description: "",
  seats: "", enable_waitlist: false, image_url: "",
};

const STEPS = [
  { id: 1, title: "L'essentiel" },
  { id: 2, title: "Date & lieu" },
  { id: 3, title: "Tarifs & places" },
  { id: 4, title: "Visuel & publication" },
];

const AUTOSAVE_KEY = (id?: string | null) => `holiswiss.eventDraft.${id ?? "new"}`;

function toNumberOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function validateStep(d: EventDraft, step: number): string | null {
  if (step === 1) {
    if (!d.title.trim()) return "Le titre est obligatoire.";
    if (d.short_description.length > 300) return "Description trop longue (max 300).";
  }
  if (step === 2) {
    if (!d.event_date) return "La date est obligatoire.";
    if (!d.start_time) return "L'heure de début est obligatoire.";
    if ((d.format === "in_person" || d.format === "hybrid") && !d.location.trim())
      return "Le lieu est obligatoire pour ce format.";
    if ((d.format === "online" || d.format === "hybrid") && !d.online_link.trim())
      return "Le lien de connexion est obligatoire pour ce format.";
  }
  if (step === 3) {
    const seats = toNumberOrNull(d.seats);
    if (!seats || seats < 1) return "Le nombre de places est obligatoire.";
    if (d.is_paid) {
      const p = toNumberOrNull(d.price);
      if (p == null || p < 0) return "Prix obligatoire pour un événement payant.";
    }
  }
  return null;
}

function PreviewCard({ d, signedImageUrl }: { d: EventDraft; signedImageUrl: string | null }) {
  const dateLabel = d.event_date
    ? new Date(d.event_date).toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Date à définir";
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-primary-xlight to-muted">
        {signedImageUrl ? (
          <img src={signedImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
            Aperçu visuel
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-card/90 backdrop-blur px-2.5 py-1 text-xs font-medium">
          {CATEGORY_LABEL[d.category]}
        </span>
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-lg leading-tight truncate">{d.title || "Titre de votre événement"}</h3>
        {d.short_description && <p className="text-sm text-muted-foreground line-clamp-2">{d.short_description}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
          <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" />{dateLabel}</span>
          {d.start_time && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{d.start_time}{d.end_time ? `–${d.end_time}` : ""}</span>}
          {(d.format === "in_person" || d.format === "hybrid") && d.location && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{d.location}</span>
          )}
          {(d.format === "online" || d.format === "hybrid") && (
            <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" />En ligne</span>
          )}
          {d.seats && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{d.seats} places</span>}
        </div>
        <div className="pt-2">
          <span className="text-base font-semibold">
            {d.is_paid ? (d.price ? `${d.price} CHF` : "Tarif à définir") : "Gratuit"}
          </span>
        </div>
      </div>
    </div>
  );
}

type Props = {
  initial?: EventDraft;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
};

export function EventFormWizard({ initial, onSaved, onCancel }: Props) {
  const [draft, setDraft] = useState<EventDraft>(initial ?? EMPTY);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [signedImage, setSignedImage] = useState<string | null>(null);
  const upsert = useServerFn(upsertMyEvent);
  const signImage = useServerFn(signEventImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore autosave (only if no initial id and empty title)
  useEffect(() => {
    if (initial?.id) return;
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY(initial?.id));
      if (raw) {
        const parsed = JSON.parse(raw) as EventDraft;
        if (parsed && typeof parsed === "object") setDraft({ ...EMPTY, ...parsed });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave to localStorage every 30s
  useEffect(() => {
    const id = window.setInterval(() => {
      try { localStorage.setItem(AUTOSAVE_KEY(draft.id), JSON.stringify(draft)); } catch {}
    }, 30000);
    return () => window.clearInterval(id);
  }, [draft]);

  // Resolve image preview URL
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!draft.image_url) { setSignedImage(null); return; }
      try {
        const { url } = await signImage({ data: { path: draft.image_url } });
        if (!cancelled) setSignedImage(url);
      } catch { if (!cancelled) setSignedImage(null); }
    })();
    return () => { cancelled = true; };
  }, [draft.image_url, signImage]);

  const update = (patch: Partial<EventDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const goNext = () => {
    const err = validateStep(draft, step);
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  };
  const goPrev = () => { setError(null); setStep((s) => Math.max(1, s - 1)); };

  const persist = async (submit: boolean) => {
    for (let i = 1; i <= (submit ? 3 : step); i++) {
      const err = validateStep(draft, i);
      if (err) { setError(`Étape ${i} : ${err}`); setStep(i); return; }
    }
    setSaving(true);
    try {
      const { event } = await upsert({
        data: {
          id: draft.id ?? null,
          title: draft.title,
          short_description: draft.short_description || null,
          long_description: draft.long_description || null,
          category: draft.category,
          event_date: draft.event_date || null,
          start_time: draft.start_time || null,
          end_time: draft.end_time || null,
          format: draft.format,
          location: draft.location || null,
          online_link: draft.online_link || null,
          is_paid: draft.is_paid,
          price: toNumberOrNull(draft.price),
          price_description: draft.price_description || null,
          reduced_price: toNumberOrNull(draft.reduced_price),
          reduced_price_description: draft.reduced_price_description || null,
          seats: toNumberOrNull(draft.seats) ? Math.trunc(toNumberOrNull(draft.seats)!) : null,
          enable_waitlist: draft.enable_waitlist,
          image_url: draft.image_url || null,
          submit,
        },
      });
      try { localStorage.removeItem(AUTOSAVE_KEY(draft.id)); } catch {}
      toast.success(submit ? "Événement soumis pour validation." : "Brouillon enregistré.");
      if (event?.id) {
        setDraft((d) => ({ ...d, id: event.id as string }));
        onSaved?.(event.id as string);
      }
    } catch (e: any) {
      setError(e?.message ?? "Erreur d'enregistrement.");
      toast.error(e?.message ?? "Erreur d'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Image uniquement."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image > 5 Mo."); return; }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non authentifié.");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("event-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      update({ image_url: path });
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de l'upload.");
    } finally {
      setUploading(false);
    }
  };

  const progress = useMemo(() => Math.round((step / 4) * 100), [step]);

  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
      {/* Form column */}
      <div className="min-w-0">
        {/* Sticky progress */}
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur pb-3 pt-1 -mt-1">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Étape {step}/4 — {STEPS[step - 1].title}</div>
            <button type="button" onClick={() => setPreviewOpen(true)} className="lg:hidden inline-flex items-center gap-1 text-sm text-primary">
              <Eye className="h-4 w-4" /> Aperçu
            </button>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="hidden sm:flex justify-between mt-2 text-xs text-muted-foreground">
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setError(null); setStep(s.id); }}
                className={`transition-colors ${s.id === step ? "text-primary font-medium" : "hover:text-foreground"}`}
              >
                {s.id}. {s.title}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="my-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-5 pt-4"
          >
            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="title">Titre de l'événement *</Label>
                  <Input id="title" value={draft.title} onChange={(e) => update({ title: e.target.value })} maxLength={160} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label htmlFor="short">Description courte</Label>
                    <span className="text-xs text-muted-foreground">{draft.short_description.length}/300</span>
                  </div>
                  <Textarea id="short" rows={3} maxLength={300} value={draft.short_description} onChange={(e) => update({ short_description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="long">Programme détaillé</Label>
                  <Textarea id="long" rows={6} maxLength={5000} value={draft.long_description} onChange={(e) => update({ long_description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Catégorie</Label>
                  <Select value={draft.category} onValueChange={(v) => update({ category: v as EventDraft["category"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABEL) as EventDraft["category"][]).map((c) => (
                        <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="date">Date *</Label>
                    <Input id="date" type="date" value={draft.event_date} onChange={(e) => update({ event_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="start">Début *</Label>
                    <Input id="start" type="time" value={draft.start_time} onChange={(e) => update({ start_time: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end">Fin</Label>
                    <Input id="end" type="time" value={draft.end_time} onChange={(e) => update({ end_time: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(FORMAT_LABEL) as EventDraft["format"][]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => update({ format: f })}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                          draft.format === f ? "border-primary bg-primary-xlight text-primary" : "border-border hover:bg-muted"
                        }`}
                      >
                        {FORMAT_LABEL[f]}
                      </button>
                    ))}
                  </div>
                </div>
                {(draft.format === "in_person" || draft.format === "hybrid") && (
                  <div className="space-y-1.5">
                    <Label htmlFor="loc">Adresse / Lieu *</Label>
                    <Input id="loc" value={draft.location} onChange={(e) => update({ location: e.target.value })} placeholder="Rue, ville, canton" />
                  </div>
                )}
                {(draft.format === "online" || draft.format === "hybrid") && (
                  <div className="space-y-1.5">
                    <Label htmlFor="link">Lien de connexion *</Label>
                    <Input id="link" type="url" value={draft.online_link} onChange={(e) => update({ online_link: e.target.value })} placeholder="https://meet.google.com/..." />
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="font-medium text-sm">Événement payant</div>
                    <div className="text-xs text-muted-foreground">Désactivé = gratuit</div>
                  </div>
                  <Switch checked={draft.is_paid} onCheckedChange={(v) => update({ is_paid: v })} />
                </div>
                {draft.is_paid && (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="price">Tarif (CHF) *</Label>
                        <Input id="price" type="number" min="0" step="0.5" value={draft.price} onChange={(e) => update({ price: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pdesc">Description du tarif</Label>
                        <Input id="pdesc" value={draft.price_description} onChange={(e) => update({ price_description: e.target.value })} placeholder="ex. Plein tarif" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="rprice">Tarif réduit (CHF)</Label>
                        <Input id="rprice" type="number" min="0" step="0.5" value={draft.reduced_price} onChange={(e) => update({ reduced_price: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rdesc">Description tarif réduit</Label>
                        <Input id="rdesc" value={draft.reduced_price_description} onChange={(e) => update({ reduced_price_description: e.target.value })} placeholder="ex. Étudiant, AVS" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="seats">Nombre de places *</Label>
                  <Input id="seats" type="number" min="1" value={draft.seats} onChange={(e) => update({ seats: e.target.value })} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="font-medium text-sm">Liste d'attente automatique</div>
                    <div className="text-xs text-muted-foreground">Activée si l'événement est complet</div>
                  </div>
                  <Switch checked={draft.enable_waitlist} onCheckedChange={(v) => update({ enable_waitlist: v })} />
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="space-y-2">
                  <Label>Image de couverture</Label>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
                    }}
                    className="relative rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center"
                  >
                    {signedImage ? (
                      <div className="relative">
                        <img src={signedImage} alt="" className="mx-auto max-h-64 rounded-lg object-cover" />
                        <button
                          type="button"
                          onClick={() => update({ image_url: "" })}
                          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 text-xs"
                        >
                          <X className="h-3 w-3" /> Retirer
                        </button>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">Glissez une image ici ou</p>
                        <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Choisir un fichier
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">JPG, PNG · max 5 Mo</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="text-sm font-medium mb-2">Récapitulatif</div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li><strong className="text-foreground">{draft.title || "—"}</strong> · {CATEGORY_LABEL[draft.category]}</li>
                    <li>{draft.event_date || "Date ?"} {draft.start_time && `· ${draft.start_time}`}{draft.end_time && `–${draft.end_time}`}</li>
                    <li>{FORMAT_LABEL[draft.format]}{draft.location ? ` · ${draft.location}` : ""}</li>
                    <li>{draft.is_paid ? `${draft.price || "?"} CHF` : "Gratuit"} · {draft.seats || "?"} places</li>
                  </ul>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Nav buttons (sticky on mobile) */}
        <div className="sticky bottom-0 left-0 right-0 z-10 mt-6 -mx-4 sm:mx-0 border-t border-border bg-background/95 backdrop-blur px-4 sm:px-0 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={goPrev} disabled={step === 1 || saving}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Annuler</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => persist(false)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Enregistrer brouillon
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={goNext} disabled={saving}>
                Suivant <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={() => persist(true)} disabled={saving}>
                <Check className="h-4 w-4 mr-1" /> Soumettre pour validation
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Preview column (desktop) */}
      <div className="hidden lg:block">
        <div className="sticky top-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Aperçu en direct</div>
          <PreviewCard d={draft} signedImageUrl={signedImage} />
        </div>
      </div>

      {/* Mobile preview modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Aperçu</DialogTitle></DialogHeader>
          <PreviewCard d={draft} signedImageUrl={signedImage} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { EMPTY as EMPTY_EVENT_DRAFT };