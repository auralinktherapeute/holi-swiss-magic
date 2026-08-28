import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const BUCKET = "invoice-logos";
export const LOGO_STORAGE_PREFIX = `storage://${BUCKET}/`;

const ACCEPTED = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "image/avif", "image/bmp", "image/tiff", "image/svg+xml",
];

export function isStoredLogo(value: string | null | undefined): boolean {
  return !!value && value.startsWith(LOGO_STORAGE_PREFIX);
}

/** Preview URL for a stored or external logo value. */
async function resolvePreview(value: string): Promise<string> {
  if (!isStoredLogo(value)) return value;
  const path = value.slice(LOGO_STORAGE_PREFIX.length);
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}

export default function InvoiceLogoUploader({
  value, onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!value) { setPreview(""); return; }
    resolvePreview(value).then((u) => { if (alive) setPreview(u); });
    return () => { alive = false; };
  }, [value]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Formats acceptés : JPG, PNG, WEBP, GIF, AVIF, BMP, TIFF, SVG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) { toast.error("Le fichier doit faire moins de 5 Mo."); return; }

    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("Session expirée, reconnectez-vous.");
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${userId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (error) throw error;
      onChange(`${LOGO_STORAGE_PREFIX}${path}`);
      toast.success("Logo importé");
    } catch (err: any) {
      toast.error(err?.message ?? "Import impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="invoice-logo-input">Logo ou photo (facultatif)</Label>
      <div className="flex items-center gap-3">
        <div className="h-16 w-28 shrink-0 rounded-md border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
          {preview
            ? <img src={preview} alt="Aperçu du logo de facturation" className="max-h-full max-w-full object-contain" />
            : <ImagePlus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id="invoice-logo-input"
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={onFile}
          />
          <Button
            type="button" variant="outline" size="sm" disabled={busy}
            className="min-h-11"
            onClick={() => inputRef.current?.click()}
          >
            {busy
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />Import…</>
              : <><ImagePlus className="h-4 w-4 mr-2" aria-hidden="true" />{value ? "Remplacer" : "Importer une image"}</>}
          </Button>
          {value && (
            <Button
              type="button" variant="ghost" size="sm" className="min-h-11 text-destructive"
              onClick={() => onChange("")} disabled={busy}
            >
              <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />Retirer
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        JPG, PNG, WEBP, GIF, AVIF, BMP, TIFF ou SVG — 5 Mo max. Affiché en haut de vos factures.
      </p>
    </div>
  );
}
