import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Trash2, Check, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  listMyPaymentMethods,
  upsertPaymentMethod,
  deletePaymentMethod,
  type PaymentMethod,
  type PaymentMethodType,
} from "@/lib/payment-methods.functions";

const METHODS: Array<{
  type: PaymentMethodType;
  label: string;
  placeholder: string;
  hint: string;
  hasBank?: boolean;
  hasLabel?: boolean;
}> = [
  { type: "twint",       label: "TWINT",       placeholder: "079 123 45 67 ou https://…", hint: "Numéro de téléphone TWINT ou lien direct" },
  { type: "revolut",     label: "Revolut",     placeholder: "https://revolut.me/monpraticien", hint: "Lien Revolut.me" },
  { type: "paypal",      label: "PayPal",      placeholder: "https://paypal.me/monpraticien", hint: "Lien PayPal.me" },
  { type: "postfinance", label: "PostFinance", placeholder: "CH00 0900 0000 0000 0000 0", hint: "IBAN PostFinance (et URL eBill possible)" },
  { type: "iban",        label: "Virement IBAN", placeholder: "CH56 0483 5012 3456 7800 9", hint: "IBAN du compte bancaire", hasBank: true },
  { type: "other",       label: "Autre",       placeholder: "Lien ou information", hint: "Autre moyen de paiement", hasLabel: true },
];

export default function PaymentMethodsPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["payment-methods"], queryFn: () => listMyPaymentMethods() });
  const methods = (q.data ?? []) as PaymentMethod[];

  const upsert = useMutation({
    mutationFn: (data: any) => upsertPaymentMethod({ data }),
    onSuccess: () => { toast.success("Enregistré"); qc.invalidateQueries({ queryKey: ["payment-methods"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deletePaymentMethod({ data: { id } }),
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["payment-methods"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-[rgba(184,110,249,0.25)] bg-[rgba(20,8,40,0.4)] p-3 text-xs text-[#a89bc4]">
        <Lock className="h-4 w-4 text-[#b86ef9] shrink-0 mt-0.5" />
        <p>
          Ces informations sont strictement privées. Elles n'apparaissent que sur vos factures, et uniquement
          si vous les activez explicitement à la création de chaque facture. Elles ne sont jamais visibles
          sur votre profil public ni par les patients.
        </p>
      </div>

      <div className="space-y-3">
        {METHODS.map((def) => {
          const existing = methods.find((m) => m.method_type === def.type);
          return (
            <MethodRow
              key={def.type}
              def={def}
              existing={existing}
              onSave={(payload) => upsert.mutate(payload)}
              onDelete={(id) => del.mutate(id)}
              saving={upsert.isPending}
            />
          );
        })}
      </div>
    </div>
  );
}

function MethodRow({
  def, existing, onSave, onDelete, saving,
}: {
  def: typeof METHODS[number];
  existing?: PaymentMethod;
  onSave: (payload: any) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(existing?.value ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [bank, setBank] = useState(existing?.bank_name ?? "");
  const configured = !!existing;

  const save = () => {
    if (!value.trim()) { toast.error("Valeur requise"); return; }
    onSave({
      id: existing?.id,
      method_type: def.type,
      value: value.trim(),
      label: def.hasLabel ? (label.trim() || null) : null,
      bank_name: def.hasBank ? (bank.trim() || null) : null,
      is_active: true,
    });
  };

  return (
    <div className="rounded-xl border border-[rgba(184,110,249,0.18)] bg-[rgba(20,8,40,0.35)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{def.label}</span>
          {configured ? (
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 gap-1">
              <Check className="h-3 w-3" />Configuré
            </Badge>
          ) : (
            <Badge variant="outline" className="border-[rgba(184,110,249,0.25)] text-[#a89bc4]">Non configuré</Badge>
          )}
        </div>
        {existing && (
          <Button size="sm" variant="ghost" onClick={() => onDelete(existing.id)}
            className="h-8 text-[#ef4444] hover:bg-[#ef4444]/10">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
        <div className="space-y-2">
          {def.hasLabel && (
            <div>
              <Label className="text-xs text-[#a89bc4]">Nom à afficher</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Mon compte pro"
                className="h-10 bg-[rgba(20,8,40,0.55)] border-[rgba(184,110,249,0.2)] text-white" />
            </div>
          )}
          {def.hasBank && (
            <div>
              <Label className="text-xs text-[#a89bc4]">Nom de la banque</Label>
              <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="UBS, Raiffeisen, …"
                className="h-10 bg-[rgba(20,8,40,0.55)] border-[rgba(184,110,249,0.2)] text-white" />
            </div>
          )}
          <div>
            <Label className="text-xs text-[#a89bc4]">{def.hint}</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={def.placeholder}
              className="h-10 bg-[rgba(20,8,40,0.55)] border-[rgba(184,110,249,0.2)] text-white" />
          </div>
        </div>
        <Button onClick={save} disabled={saving}
          className="h-10 gap-2 bg-gradient-to-r from-[#b86ef9] to-[#a855f7] text-white">
          {existing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {existing ? "Mettre à jour" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}