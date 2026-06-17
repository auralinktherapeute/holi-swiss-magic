import { useRef, useState } from "react";
import { Camera, Loader2, User, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/tiff",
  "image/heic",
  "image/heif",
];

interface ProfilePhotoUploaderProps {
  /** auth.users.id of the therapist */
  userId: string;
  /** Current preview URL (signed URL if private bucket, or empty) */
  currentPhotoUrl: string;
  /**
   * Called after a successful upload (or removal) with:
   *  - publicUrl: canonical URL to persist in DB (`therapists.photo_url`)
   *  - previewUrl: signed URL usable immediately for <img src>
   * For removal both are empty strings.
   */
  onPhotoUpdated: (publicUrl: string, previewUrl: string) => void;
  /** Optional fallback initial when no photo */
  initial?: string;
}

const BUCKET = "therapist-photos";

export default function ProfilePhotoUploader({
  userId,
  currentPhotoUrl,
  onPhotoUpdated,
  initial = "T",
}: ProfilePhotoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState<string>("avatar.jpg");
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Format non supporté (JPG, PNG, WEBP, GIF, AVIF, BMP, TIFF, HEIC, HEIF).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image doit faire moins de 5 Mo.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Open crop modal instead of uploading immediately
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropFileName(file.name);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadBlob = async (blob: Blob, originalName: string) => {
    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authUserId = session?.user?.id;
      if (!authUserId) throw new Error("Session expirée. Reconnectez-vous.");
      if (authUserId !== userId) throw new Error("Utilisateur non autorisé.");

      const ext = (originalName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${authUserId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { cacheControl: "3600", upsert: false, contentType: blob.type || "image/jpeg" });
      if (uploadError) throw new Error(`Upload refusé : ${uploadError.message}`);

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      onPhotoUpdated(pub.publicUrl, signed?.signedUrl ?? pub.publicUrl);
      toast.success("Photo de profil mise à jour.");
    } catch (err) {
      console.error("ProfilePhotoUploader:", err);
      toast.error(err instanceof Error ? err.message : "Impossible d'uploader la photo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
      setCropSrc(null);
      await uploadBlob(blob, cropFileName);
    } catch (err) {
      console.error(err);
      toast.error("Recadrage impossible.");
    }
  };

  const handleRemove = () => onPhotoUpdated("", "");

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="h-32 w-32 overflow-hidden rounded-full ring-4 ring-[#b86ef9]/40 shadow-[0_0_40px_-8px_rgba(184,110,249,0.6)]">
          {currentPhotoUrl ? (
            <img src={currentPhotoUrl} alt="Photo de profil" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#3d1a5c] to-[#522870] text-[#d4a5f9]">
              {initial ? (
                <span className="text-5xl font-bold">{initial}</span>
              ) : (
                <User className="h-12 w-12" />
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label="Changer la photo de profil"
          className="absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#b86ef9] to-[#5cc8fa] text-white shadow-lg transition hover:scale-105 disabled:opacity-60"
        >
          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </button>

        {currentPhotoUrl && !isUploading && (
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Supprimer la photo"
            className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#ef4444] to-[#ec4899] text-white shadow-lg transition hover:scale-105"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={handlePhotoUpload}
        />
      </div>

      <p className="mt-4 text-base font-semibold text-white">Photo de profil</p>
      <p className="mt-1 text-xs text-[#a89bc4]">
        JPG, PNG, WEBP, GIF, AVIF, BMP, TIFF, HEIC, HEIF (max 5 Mo)
      </p>

      <Dialog open={!!cropSrc} onOpenChange={(o) => !o && setCropSrc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recadrer la photo</DialogTitle>
          </DialogHeader>
          <div className="relative h-80 w-full overflow-hidden rounded-lg bg-black">
            {cropSrc && (
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                minZoom={1}
                maxZoom={4}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_a, areaPixels) => setCroppedAreaPixels(areaPixels)}
              />
            )}
          </div>
          <div className="flex items-center gap-3 px-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))}
              aria-label="Zoom arrière"
              className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-accent"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.05}
              onValueChange={(v) => setZoom(v[0])}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))}
              aria-label="Zoom avant"
              className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-accent"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCropSrc(null)} disabled={isUploading}>
              Annuler
            </Button>
            <Button onClick={handleCropConfirm} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function getCroppedBlob(src: string, area: Area): Promise<Blob> {
  const img = await loadImage(src);
  const size = Math.max(1, Math.round(Math.min(area.width, area.height)));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}