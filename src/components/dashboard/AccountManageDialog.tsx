import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Pause, Trash2, AlertTriangle, Lightbulb } from "lucide-react";
import { pauseMyAccount, deleteMyAccount } from "@/lib/account.functions";
import { signOutCompletely } from "@/lib/auth-utils";

type View = "choice" | "pause-confirm" | "delete-warn" | "delete-confirm";

export function AccountManageDialog() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("choice");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const doPause = useServerFn(pauseMyAccount);
  const doDelete = useServerFn(deleteMyAccount);

  function reset() {
    setView("choice");
    setConfirmText("");
    setBusy(false);
  }

  async function onPause() {
    setBusy(true);
    try {
      await doPause();
      await signOutCompletely(queryClient);
      toast.success("Votre profil est en pause. À bientôt sur Holiswiss 🌿");
      setOpen(false);
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await doDelete({ data: { confirm: "SUPPRIMER" } });
      await signOutCompletely(queryClient);
      toast.success("Votre compte a été supprimé. Merci pour votre confiance. 🌿");
      setOpen(false);
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); }}
        className="text-[11px] text-muted-foreground hover:text-foreground hover:underline transition-colors"
      >
        Gérer mon compte
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg">
          {view === "choice" && (
            <>
              <DialogHeader>
                <DialogTitle>Gérer mon compte</DialogTitle>
                <DialogDescription>Choisissez une option ci-dessous.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setView("pause-confirm")}
                  className="w-full text-left rounded-lg border border-border p-4 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="flex items-center gap-2 font-medium"><Pause className="h-4 w-4" /> Mettre mon profil en pause</div>
                  <p className="mt-1 text-sm text-muted-foreground">Votre profil sera masqué du site et des recherches. Vos données, réservations et paramètres sont conservés. Vous pouvez réactiver à tout moment.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setView("delete-warn")}
                  className="w-full text-left rounded-lg border border-border p-4 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-destructive"
                >
                  <div className="flex items-center gap-2 font-medium text-red-600"><Trash2 className="h-4 w-4" /> Supprimer mon compte</div>
                  <p className="mt-1 text-sm text-muted-foreground">Cette action est irréversible. Toutes vos données seront effacées.</p>
                </button>
              </div>
            </>
          )}

          {view === "pause-confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>Mettre le profil en pause ?</DialogTitle>
                <DialogDescription>Votre profil sera invisible jusqu'à votre réactivation. Aucune donnée ne sera perdue.</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setView("choice")} disabled={busy}>Annuler</Button>
                <Button onClick={onPause} disabled={busy}>Confirmer la pause</Button>
              </DialogFooter>
            </>
          )}

          {view === "delete-warn" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" /> Suppression définitive
                </DialogTitle>
                <DialogDescription className="text-foreground">
                  Vous êtes sur le point de supprimer définitivement votre compte Holiswiss. Cette action est irréversible. Votre profil, vos réservations, vos avis, vos articles et toutes vos données seront définitivement supprimés. Il faudra tout recréer depuis zéro si vous souhaitez revenir.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
                <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Saviez-vous que vous pouvez simplement mettre votre profil en pause ? Votre compte sera masqué mais toutes vos données resteront intactes.</p>
              </div>
              <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col">
                <Button onClick={() => setView("pause-confirm")}>Mettre en pause plutôt</Button>
                <button
                  type="button"
                  onClick={() => setView("delete-confirm")}
                  className="text-xs text-muted-foreground hover:text-red-600 hover:underline self-center"
                >
                  Non, je veux vraiment supprimer
                </button>
              </DialogFooter>
            </>
          )}

          {view === "delete-confirm" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-red-600">Confirmation finale</DialogTitle>
                <DialogDescription>
                  Pour confirmer, tapez exactement : <span className="font-mono font-semibold text-foreground">SUPPRIMER</span>
                </DialogDescription>
              </DialogHeader>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="SUPPRIMER"
                autoFocus
                aria-label="Confirmation de suppression"
              />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setView("delete-warn")} disabled={busy}>Retour</Button>
                <Button
                  variant="destructive"
                  onClick={onDelete}
                  disabled={confirmText !== "SUPPRIMER" || busy}
                >
                  Supprimer définitivement mon compte
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}