// Aperçu de la facture (rendu réel HTML/QR) avant toute édition.
// Utilise la fonction serveur existante renderInvoiceHtml — aucun rendu fictif.

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { renderInvoiceHtml } from "@/lib/therapist-invoices.functions";

export function InvoicePreviewDialog({
  invoiceId,
  open,
  onOpenChange,
  onEdit,
  title,
}: {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (id: string) => void;
  title?: string;
}) {
  const renderFn = useServerFn(renderInvoiceHtml);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!open || !invoiceId) return;
    let cancelled = false;
    setHtml(null);
    setError(null);
    renderFn({ data: { id: invoiceId } })
      .then((r: { html: string }) => { if (!cancelled) setHtml(r.html); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || "Aperçu indisponible"); });
    return () => { cancelled = true; };
  }, [open, invoiceId, renderFn]);

  const printFrame = () => {
    const win = frameRef.current?.contentWindow;
    if (!win) { toast.error("Aperçu non chargé"); return; }
    win.focus();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Aperçu de la facture</DialogTitle>
          <DialogDescription>
            {title ?? "Vérifiez le document tel qu'il sera envoyé avant de le modifier."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-[50vh] overflow-hidden rounded-lg border border-border/60 bg-white">
          {error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : html === null ? (
            <div className="flex h-full min-h-[50vh] items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span className="ml-2 text-sm">Génération de l'aperçu…</span>
            </div>
          ) : (
            <iframe
              ref={frameRef}
              title="Aperçu de la facture"
              srcDoc={html}
              className="h-[60vh] w-full"
            />
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button variant="outline" className="min-h-11" disabled={!html} onClick={printFrame}>
            <Printer className="h-4 w-4 mr-2" aria-hidden="true" /> Imprimer / PDF
          </Button>
          {onEdit && invoiceId && (
            <Button className="min-h-11" onClick={() => onEdit(invoiceId)}>
              <Pencil className="h-4 w-4 mr-2" aria-hidden="true" /> Modifier la facture
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InvoicePreviewDialog;
