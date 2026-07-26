import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Trash2, FileText, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyCertifications,
  addCertification,
  deleteCertification,
} from "@/lib/therapist-profile-extra.functions";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const BUCKET = "therapist-docs";

/** Certifications / diplômes (PDF ou image, privés). userId = auth.users.id */
export default function CertificationsUploader({ userId }: { userId: string }) {
  const fetchList = useServerFn(listMyCertifications);
  const add = useServerFn(addCertification);
  const del = useServerFn(deleteCertification);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<{ id: string; name: string; issuer: string | null; year: number | null; fileUrl: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [year, setYear] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchList();
      setRows(res.rows);
    } catch (e: any) {
      toast.error(e?.message ?? "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Indiquez le nom du document.");
    setBusy(true);
    try {
      let filePath: string | null = null;
      if (file) {
        if (!ACCEPTED.includes(file.type)) {
          setBusy(false);
          return toast.error("Format : PDF, JPG, PNG ou WEBP.");
        }
        if (file.size > 10 * 1024 * 1024) {
          setBusy(false);
          return toast.error("Fichier trop lourd (max 10 Mo).");
        }
        const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
        filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: false, contentType: file.type });
        if (upErr) {
          setBusy(false);
          return toast.error(`Upload refusé : ${upErr.message}`);
        }
      }
      await add({
        data: {
          name: name.trim(),
          issuer: issuer.trim() || null,
          year: year ? Number(year) : null,
          file_path: filePath,
        },
      });
      toast.success("Certification ajoutée.");
      setName(""); setIssuer(""); setYear(""); setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Ajout impossible");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await del({ data: { id } });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e: any) {
      toast.error(e?.message ?? "Suppression impossible");
    }
  };

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-base font-semibold text-white">Certifications & diplômes</h3>
        <p className="text-xs text-[#a89bc4]">Documents privés (PDF ou image). Le nom renforce la confiance des patients.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : (
        <ul className="mb-4 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-white/85">
                <FileText className="h-4 w-4 shrink-0 text-[#5cc8fa]" />
                <span className="truncate">
                  {r.name}
                  {r.issuer ? <span className="text-white/45"> · {r.issuer}</span> : null}
                  {r.year ? <span className="text-white/45"> · {r.year}</span> : null}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {r.fileUrl && (
                  <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-cyan-300" aria-label="Voir le document">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button type="button" onClick={() => remove(r.id)} aria-label="Supprimer" className="text-white/40 hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
          {rows.length === 0 && <li className="text-sm text-white/40">Aucune certification pour l'instant.</li>}
        </ul>
      )}

      {/* Formulaire d'ajout */}
      <div className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-2">
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du document *"
          className="rounded-md border border-white/15 bg-[#1a0a2e] px-3 py-2 text-sm text-white placeholder:text-white/30"
        />
        <input
          value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Organisme (ex. ASCA, RME)"
          className="rounded-md border border-white/15 bg-[#1a0a2e] px-3 py-2 text-sm text-white placeholder:text-white/30"
        />
        <input
          value={year} onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="Année"
          className="rounded-md border border-white/15 bg-[#1a0a2e] px-3 py-2 text-sm text-white placeholder:text-white/30"
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-[#1a0a2e] px-3 py-2 text-sm text-white/70">
          <Upload className="h-4 w-4" />
          <span className="truncate">{file ? file.name : "Choisir un fichier (PDF/image)"}</span>
          <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <div className="sm:col-span-2">
          <button
            type="button" onClick={submit} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Ajouter la certification
          </button>
        </div>
      </div>
    </div>
  );
}
