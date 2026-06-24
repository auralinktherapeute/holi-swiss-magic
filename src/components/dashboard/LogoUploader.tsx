import { useRef, useState } from "react";
import { Upload, Loader2, X, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
const BUCKET = "therapist-assets";
const MAX_SIZE = 2 * 1024 * 1024;

interface Props {
  userId: string;
  value: string;
  onChange: (url: string) => void;
}

export default function LogoUploader({ userId, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non supporté (PNG, JPG ou SVG).");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Fichier trop volumineux (max 2 Mo).");
      return;
    }
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Session expirée.");
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${uid}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      const { data: signed, error: sErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (sErr || !signed?.signedUrl) throw new Error("Impossible de générer le lien.");
      onChange(signed.signedUrl);
      toast.success("Logo téléchargé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec du téléchargement.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full sm:w-auto"
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Télécharger mon logo
          </Button>
          <p className="text-xs text-muted-foreground">PNG, JPG ou SVG (max 2 Mo)</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => setShowUrl(v => !v)}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <LinkIcon className="h-3 w-3" />
            {showUrl ? "Masquer" : "Saisir une URL à la place"}
          </button>
          {showUrl && (
            <Input
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="https://…/logo.png"
              className="bg-background border-border/60"
            />
          )}
        </div>
        {value && (
          <div className="relative shrink-0">
            <img
              src={value}
              alt="Aperçu logo"
              className="h-20 w-20 rounded border border-border/40 object-contain bg-white p-1"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Supprimer le logo"
              className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground shadow"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}