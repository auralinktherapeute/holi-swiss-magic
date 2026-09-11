import { useRef, useState } from "react";
import { Upload, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const BUCKET = "organization-logos";
const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024;
const MAX_DIM = 512;
const SIGNED_TTL = 60 * 60 * 24 * 365 * 5;

interface Props {
  value: string;
  onChange: (url: string) => void;
}

/** Extrait le chemin objet depuis une URL signée Supabase du bucket. */
function pathFromSignedUrl(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

/** Redimensionne (≤512px, ratio conservé) et convertit en WebP, ou PNG si transparence. */
async function processRaster(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Traitement de l'image impossible.");
  ctx.drawImage(bitmap, 0, 0, w, h);

  // Détection de transparence : on conserve alors le PNG (rendu plus sûr).
  let hasAlpha = false;
  try {
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) {
        hasAlpha = true;
        break;
      }
    }
  } catch {
    hasAlpha = file.type === "image/png";
  }

  const type = hasAlpha ? "image/png" : "image/webp";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, hasAlpha ? undefined : 0.9),
  );
  if (!blob) throw new Error("Conversion de l'image impossible.");
  return { blob, ext: hasAlpha ? "png" : "webp", type };
}

export default function OrganizationLogoUploader({ value, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non supporté, utilisez PNG, JPG, SVG ou WebP");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Fichier trop volumineux, 2 Mo maximum");
      return;
    }
    setBusy(true);
    try {
      let body: Blob = file;
      let ext = "svg";
      let type = file.type;
      if (file.type !== "image/svg+xml") {
        const out = await processRaster(file);
        body = out.blob;
        ext = out.ext;
        type = out.type;
      }
      const path = `organization-logos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, body, { cacheControl: "3600", upsert: false, contentType: type });
      if (upErr) throw new Error(upErr.message);
      const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
      if (sErr || !signed?.signedUrl) throw new Error("Impossible de générer le lien du logo.");
      onChange(signed.signedUrl);
      toast.success("Logo téléversé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec du téléversement.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeLogo = async () => {
    const path = value ? pathFromSignedUrl(value) : null;
    setBusy(true);
    try {
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      onChange("");
      toast.success("Logo supprimé.");
    } catch {
      onChange("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          className={`flex-1 rounded-xl border border-dashed p-4 text-center transition-colors ${
            dragOver ? "border-[#b86ef9] bg-[#b86ef9]/10" : "border-white/20"
          }`}
        >
          <p className="text-sm text-white/70">Glissez-déposez le logo ici</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Choisir un fichier
          </Button>
          <p className="mt-2 text-xs text-white/50">PNG, JPG, SVG ou WebP — 2 Mo max, redimensionné à 512px</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </div>
        {value && (
          <div className="shrink-0 space-y-2 text-center">
            <img
              src={value}
              alt="Aperçu du logo"
              className="h-20 w-20 rounded border border-white/15 object-contain bg-white/10 p-1"
            />
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={removeLogo}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
