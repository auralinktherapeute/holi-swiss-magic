import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  CalendarSync, Copy, RefreshCw, Download, Upload, Info, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  getMyCalendarSync, setCalendarExport, regenerateExportToken,
  setCalendarImport, runMyCalendarImport,
} from "@/lib/calendar-sync.functions";

const SITE = "https://holiswiss.ch";

function feedUrl(token: string | null) {
  return token ? `${SITE}/agenda/${token}/holiswiss.ics` : "";
}

function frDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString("fr-CH", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Synchronisation d'agenda — export et import, indépendants.
 *
 * Les deux interrupteurs sont séparés parce que les besoins le sont : voir ses
 * rendez-vous Holiswiss dans son téléphone, et empêcher qu'on réserve pendant
 * qu'on est occupé ailleurs, sont deux choses différentes. Rien n'est activé
 * par défaut.
 */
export default function CalendarSyncPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["calendar-sync"], queryFn: () => getMyCalendarSync() });
  const s = q.data;

  const [url, setUrl] = useState("");
  useEffect(() => { if (s?.import_url != null) setUrl(s.import_url); }, [s?.import_url]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["calendar-sync"] });

  const toggleExport = useMutation({
    mutationFn: (enabled: boolean) => setCalendarExport({ data: { enabled } }),
    onSuccess: (r) => { toast.success(r.enabled ? "Export activé" : "Export désactivé"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const regen = useMutation({
    mutationFn: () => regenerateExportToken(),
    onSuccess: () => { toast.success("Nouveau lien engendré — l'ancien ne fonctionne plus"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveImport = useMutation({
    mutationFn: (v: { enabled: boolean; url: string | null }) => setCalendarImport({ data: v }),
    onSuccess: (r) => { toast.success(r.enabled ? "Import activé" : "Import désactivé"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const runImport = useMutation({
    mutationFn: () => runMyCalendarImport(),
    onSuccess: (r) => {
      toast.success(`${r.count} créneau${r.count > 1 ? "x" : ""} importé${r.count > 1 ? "s" : ""}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Lien copié ✓"); }
    catch { toast.error("Impossible de copier le lien"); }
  };

  const link = feedUrl(s?.export_token ?? null);
  const lastSync = frDate(s?.import_last_sync_at ?? null);

  return (
    <Card className="rounded-2xl border-border bg-card/70">
      <CardContent className="space-y-7 p-5">
        <div className="flex items-center gap-2">
          <CalendarSync className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold text-foreground">Synchroniser avec mon agenda</h2>
        </div>

        {/* ───────────────── Export ───────────────── */}
        <section aria-labelledby="cal-export-title" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="cal-export-title" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Exporter mes rendez-vous
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Vos rendez-vous Holiswiss apparaissent dans Google Agenda, Apple Calendrier ou Outlook.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Switch
                id="cal-export"
                checked={s?.export_enabled ?? false}
                disabled={toggleExport.isPending || q.isLoading}
                onCheckedChange={(v) => toggleExport.mutate(v)}
              />
              <Label htmlFor="cal-export" className="cursor-pointer text-sm">Activer</Label>
            </div>
          </div>

          {s?.export_enabled && link && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 font-mono text-xs" />
                <Button type="button" size="sm" variant="outline" onClick={() => copy(link)}>
                  <Copy className="mr-1.5 h-4 w-4" /> Copier
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => regen.mutate()} disabled={regen.isPending}>
                  <RefreshCw className={`mr-1.5 h-4 w-4 ${regen.isPending ? "animate-spin" : ""}`} /> Nouveau lien
                </Button>
              </div>

              {/* Ce que le praticien doit comprendre AVANT de coller ce lien. */}
              <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
                <p className="flex items-start gap-2 text-xs leading-relaxed text-foreground/80">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-light" aria-hidden="true" />
                  <span>
                    <strong className="font-medium">Chaque rendez-vous n'affiche que le prénom et le type de séance</strong>
                    {" "}— par exemple « Marie — Suivi ». Ni nom de famille, ni e-mail, ni téléphone, ni notes
                    ne sortent de Holiswiss. Ce lien fonctionne sans mot de passe : toute personne qui l'obtient
                    verrait votre agenda. C'est pourquoi il en dit le moins possible.
                  </span>
                </p>
                <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f59e0b]" aria-hidden="true" />
                  <span>
                    Ne le publiez pas et ne le transférez pas. Si vous l'avez partagé par erreur,
                    « Nouveau lien » invalide l'ancien immédiatement.
                  </span>
                </p>
                {/* La légende — une icône par événement n'existe pas dans le format iCal. */}
                <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <CalendarSync className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-light" aria-hidden="true" />
                  <span>
                    Dans votre agenda, ces rendez-vous arrivent sous un calendrier nommé
                    {" "}<strong className="font-medium text-foreground/90">Holiswiss — mes rendez-vous</strong>.
                    Vous pouvez lui donner une couleur pour les repérer d'un coup d'œil : le format iCal
                    ne permet pas d'attacher une icône à chaque événement.
                  </span>
                </p>
              </div>
            </>
          )}
        </section>

        <div className="border-t border-border" />

        {/* ───────────────── Import ───────────────── */}
        <section aria-labelledby="cal-import-title" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="cal-import-title" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Importer mon agenda personnel
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Vos occupations privées bloquent les créneaux : personne ne peut réserver pendant ce temps-là.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Switch
                id="cal-import"
                checked={s?.import_enabled ?? false}
                disabled={saveImport.isPending || q.isLoading}
                onCheckedChange={(v) => saveImport.mutate({ enabled: v, url: url.trim() || null })}
              />
              <Label htmlFor="cal-import" className="cursor-pointer text-sm">Activer</Label>
            </div>
          </div>

          <div>
            <Label htmlFor="cal-import-url" className="text-xs">Adresse iCal de votre agenda</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Input
                id="cal-import-url"
                value={url}
                maxLength={2000}
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                onChange={(e) => setUrl(e.target.value)}
                className="min-w-0 flex-1 font-mono text-xs"
              />
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => saveImport.mutate({ enabled: s?.import_enabled ?? false, url: url.trim() || null })}
                disabled={saveImport.isPending}
              >
                Enregistrer
              </Button>
              <Button
                type="button" size="sm"
                onClick={() => runImport.mutate()}
                disabled={runImport.isPending || !s?.import_enabled}
                className="holi-cta rounded-xl"
              >
                <RefreshCw className={`mr-1.5 h-4 w-4 ${runImport.isPending ? "animate-spin" : ""}`} />
                Synchroniser
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Dans Google Agenda : Paramètres → votre agenda → « Adresse secrète au format iCal ».
              Sur Apple : Partager l'agenda → Agenda public.
            </p>
          </div>

          {/* L'état du dernier import, dit franchement — succès comme échec. */}
          {s?.import_last_status && (
            <p
              role="status"
              className={`flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${
                s.import_last_status === "ok"
                  ? "border-border bg-surface text-foreground/80"
                  : "border-[#f59e0b]/35 bg-[#f59e0b]/10 text-foreground/85"
              }`}
            >
              {s.import_last_status === "ok"
                ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f59e0b]" aria-hidden="true" />}
              <span>
                {s.import_last_status === "ok" ? (
                  <>
                    {s.import_last_count} créneau{s.import_last_count > 1 ? "x" : ""} occupé
                    {s.import_last_count > 1 ? "s" : ""} importé{s.import_last_count > 1 ? "s" : ""}
                    {lastSync ? ` le ${lastSync}` : ""}.
                    {s.import_skipped_recurring > 0 && (
                      <>
                        {" "}
                        <strong className="font-medium">
                          {s.import_skipped_recurring} événement{s.import_skipped_recurring > 1 ? "s" : ""} à
                          répétition complexe (mensuelle ou annuelle) n'{s.import_skipped_recurring > 1 ? "ont" : "a"} pas
                          été développé{s.import_skipped_recurring > 1 ? "s" : ""}
                        </strong>{" "}
                        : seule la première occurrence est bloquée. Vérifiez ces dates à la main.
                      </>
                    )}
                  </>
                ) : (
                  <>{s.import_last_error ?? "Le dernier import a échoué."}{lastSync ? ` (${lastSync})` : ""}</>
                )}
              </span>
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
