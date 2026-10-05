import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updateContactDetails } from "@/lib/crm-therapist.functions";

type Fields = {
  first_name: string; last_name: string; email: string; phone: string; date_of_birth: string;
  address_line1: string; address_line2: string; postal_code: string; city: string; canton: string; country: string;
};

const FIELDS: { key: keyof Fields; label: string; type?: string; auto?: string; full?: boolean }[] = [
  { key: "first_name", label: "Prénom *", auto: "given-name" },
  { key: "last_name", label: "Nom", auto: "family-name" },
  { key: "email", label: "Adresse e-mail", type: "email", auto: "email" },
  { key: "phone", label: "Téléphone", type: "tel", auto: "tel" },
  { key: "date_of_birth", label: "Date de naissance", type: "date" },
  { key: "address_line1", label: "Adresse (rue et numéro)", auto: "address-line1", full: true },
  { key: "address_line2", label: "Complément d'adresse", auto: "address-line2", full: true },
  { key: "postal_code", label: "NPA", auto: "postal-code" },
  { key: "city", label: "Ville", auto: "address-level2" },
  { key: "canton", label: "Canton / région", auto: "address-level1" },
  { key: "country", label: "Pays", auto: "country-name" },
];

export function EditClientDialog({ client, onClose, onSaved }: {
  client: any; onClose: () => void; onSaved: () => void;
}) {
  const fn = useServerFn(updateContactDetails);
  const [f, setF] = useState<Fields>(() => {
    const o = {} as Fields;
    for (const { key } of FIELDS) o[key] = String(client?.[key] ?? "").slice(0, key === "date_of_birth" ? 10 : undefined);
    if (!o.country) o.country = "Suisse";
    return o;
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => fn({ data: { id: client.id, ...f } }),
    onSuccess: () => { toast.success("Coordonnées enregistrées."); onSaved(); onClose(); },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      setError(msg.includes("E-mail") || msg.includes("email") ? "Adresse e-mail invalide." : msg.includes("Prénom") ? "Le prénom est requis." : "Échec de l'enregistrement. Réessayez.");
    },
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Modifier les coordonnées</DialogTitle></DialogHeader>
        <form
          noValidate
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!f.first_name.trim()) { setError("Le prénom est requis."); return; }
            save.mutate();
          }}
        >
          {FIELDS.map(({ key, label, type, auto, full }) => (
            <div key={key} className={full ? "sm:col-span-2" : ""}>
              <Label htmlFor={`ec-${key}`}>{label}</Label>
              <Input
                id={`ec-${key}`} type={type ?? "text"} autoComplete={auto} className="mt-1 min-h-11"
                value={f[key]} onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))}
              />
            </div>
          ))}
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Adresse, NPA et ville sont nécessaires pour générer la QR-facture.
          </p>
          {error && <p role="alert" className="sm:col-span-2 text-sm text-destructive">{error}</p>}
          <DialogFooter className="sm:col-span-2 gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="min-h-11" disabled={save.isPending}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
