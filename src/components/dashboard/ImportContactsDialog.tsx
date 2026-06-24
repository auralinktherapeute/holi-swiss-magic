import { useRef, useState } from "react";
import { Upload, Loader2, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { bulkImportContacts } from "@/lib/crm-therapist.functions";

type Row = {
  first_name: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  private_notes?: string | null;
};

const FIELD_ALIASES: Record<keyof Row, string[]> = {
  first_name: ["prenom", "prénom", "firstname", "first_name", "first name", "given name"],
  last_name: ["nom", "lastname", "last_name", "last name", "surname", "family name"],
  email: ["email", "e-mail", "mail", "courriel"],
  phone: ["telephone", "téléphone", "tel", "tél", "phone", "mobile", "portable"],
  date_of_birth: ["date_de_naissance", "date de naissance", "naissance", "dob", "birthdate", "birth date", "date of birth"],
  private_notes: ["notes", "note", "remarques", "commentaire", "commentaires", "comment"],
};

const norm = (s: string) =>
  s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]/g, " ")
    .trim();

function mapHeaders(headers: string[]): Partial<Record<keyof Row, number>> {
  const map: Partial<Record<keyof Row, number>> = {};
  const normalized = headers.map(h => norm(String(h ?? "")));
  (Object.keys(FIELD_ALIASES) as (keyof Row)[]).forEach(field => {
    const aliases = FIELD_ALIASES[field].map(norm);
    const idx = normalized.findIndex(h => aliases.includes(h));
    if (idx >= 0) map[field] = idx;
  });
  return map;
}

function parseDateLike(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const [_, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export default function ImportContactsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [matched, setMatched] = useState<Partial<Record<keyof Row, number>>>({});
  const [strategy, setStrategy] = useState<"skip" | "update">("skip");
  const [result, setResult] = useState<{ imported: number; updated: number; skipped: number } | null>(null);

  const importMut = useMutation({
    mutationFn: () => bulkImportContacts({ data: { rows, onDuplicate: strategy } }),
    onSuccess: (res) => {
      setResult({ imported: res.imported, updated: res.updated, skipped: res.skipped });
      qc.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast.success(`${res.imported + res.updated} contact(s) importé(s)`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Échec de l'import"),
  });

  const reset = () => {
    setFileName(""); setRows([]); setHeaders([]); setMatched({}); setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: "" });
      if (aoa.length < 2) {
        toast.error("Le fichier ne contient pas de données.");
        return;
      }
      const hdr = aoa[0].map(String);
      const map = mapHeaders(hdr);
      if (map.first_name === undefined) {
        toast.error("Colonne 'Prénom' introuvable dans le fichier.");
        setHeaders(hdr);
        setMatched(map);
        return;
      }
      const parsed: Row[] = [];
      for (let i = 1; i < aoa.length; i++) {
        const r = aoa[i];
        const get = (k: keyof Row) => (map[k] !== undefined ? r[map[k]!] : undefined);
        const first = String(get("first_name") ?? "").trim();
        if (!first) continue;
        parsed.push({
          first_name: first,
          last_name: String(get("last_name") ?? "").trim(),
          email: String(get("email") ?? "").trim() || null,
          phone: String(get("phone") ?? "").trim() || null,
          date_of_birth: parseDateLike(get("date_of_birth")),
          private_notes: String(get("private_notes") ?? "").trim() || null,
        });
      }
      setHeaders(hdr);
      setMatched(map);
      setRows(parsed);
    } catch (err) {
      toast.error("Fichier illisible (CSV, XLSX ou XLS attendu).");
    }
  };

  const close = () => { reset(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl bg-surface border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importer des contacts
          </DialogTitle>
        </DialogHeader>

        {!result && (
          <div className="space-y-4">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handleFile}
              />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {fileName ? "Changer de fichier" : "Choisir un fichier"}
              </Button>
              {fileName && <span className="ml-3 text-sm text-muted-foreground">{fileName}</span>}
              <p className="text-xs text-muted-foreground mt-2">
                Formats acceptés : CSV, XLSX, XLS. Colonnes reconnues : prénom, nom, email, téléphone, date de naissance, notes.
              </p>
            </div>

            {headers.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Colonnes détectées :</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(FIELD_ALIASES) as (keyof Row)[]).map(f => (
                    <span key={f} className={`px-2 py-0.5 rounded-full border text-xs ${matched[f] !== undefined ? "border-primary/50 text-primary bg-primary/10" : "border-border/40 text-muted-foreground"}`}>
                      {f === "first_name" ? "Prénom" : f === "last_name" ? "Nom" : f === "email" ? "Email" : f === "phone" ? "Téléphone" : f === "date_of_birth" ? "Date naiss." : "Notes"}
                      {matched[f] !== undefined ? ` ✓` : " —"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {rows.length > 0 && (
              <>
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <div className="px-3 py-2 bg-background/50 text-xs font-medium border-b border-border/60">
                    Aperçu — {rows.length} contact(s) seront importés. Vérifiez les données.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-background/30 text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Prénom</th>
                          <th className="px-2 py-1.5 text-left">Nom</th>
                          <th className="px-2 py-1.5 text-left">Email</th>
                          <th className="px-2 py-1.5 text-left">Téléphone</th>
                          <th className="px-2 py-1.5 text-left">Naiss.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 5).map((r, i) => (
                          <tr key={i} className="border-t border-border/40">
                            <td className="px-2 py-1.5">{r.first_name}</td>
                            <td className="px-2 py-1.5">{r.last_name}</td>
                            <td className="px-2 py-1.5">{r.email}</td>
                            <td className="px-2 py-1.5">{r.phone}</td>
                            <td className="px-2 py-1.5">{r.date_of_birth}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Si un contact existe déjà (même email)</Label>
                  <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v as any)} className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="skip" id="skip" />
                      <span className="text-sm">Ignorer</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="update" id="update" />
                      <span className="text-sm">Mettre à jour</span>
                    </label>
                  </RadioGroup>
                </div>
              </>
            )}
          </div>
        )}

        {result && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-lg font-semibold">Import terminé</p>
            <p className="text-sm text-muted-foreground">
              {result.imported} contact(s) importé(s) avec succès.
              {result.updated > 0 && ` ${result.updated} mis à jour.`}
              {result.skipped > 0 && ` ${result.skipped} ignoré(s).`}
            </p>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="ghost" onClick={close}>Annuler</Button>
              <Button
                onClick={() => importMut.mutate()}
                disabled={rows.length === 0 || importMut.isPending}
                className="bg-primary"
              >
                {importMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Importer {rows.length > 0 ? `(${rows.length})` : ""}
              </Button>
            </>
          ) : (
            <Button onClick={close} className="bg-primary">Terminer</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}