import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * Pop-up de confirmation commun (devise du cabinet et devise d'un client).
 * Fermer ou annuler n'enregistre rien ; « Confirmer » reste désactivé tant
 * que la case n'est pas cochée (et que `canConfirm` est faux).
 */
export function CurrencyChangeDialog(p: {
  open: boolean;
  title: string;
  warning: string;
  ackLabel: string;
  children?: ReactNode;
  canConfirm?: boolean;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [ack, setAck] = useState(false);
  useEffect(() => { if (p.open) setAck(false); }, [p.open]);

  return (
    <Dialog open={p.open} onOpenChange={(o) => { if (!o && !p.pending) p.onCancel(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="currency-change-dialog">
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{p.warning}</div>
          </DialogDescription>
        </DialogHeader>
        {p.children}
        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <Checkbox id={`${id}-ack`} checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
          <Label htmlFor={`${id}-ack`} className="text-sm font-medium leading-snug cursor-pointer">{p.ackLabel}</Label>
        </div>
        {p.error && <p role="alert" className="text-sm text-destructive">{p.error}</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={p.pending} onClick={p.onCancel}>
            {t("currency.cancel")}
          </Button>
          <Button type="button" className="min-h-11" disabled={!ack || p.canConfirm === false || p.pending} onClick={p.onConfirm}>
            {p.pending ? t("currency.saving") : t("currency.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
