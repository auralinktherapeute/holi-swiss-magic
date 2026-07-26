import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { listMyCabinetPhotos, addCabinetPhoto, deleteCabinetPhoto } from "@/lib/therapist-profile-extra.functions";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"];
const BUCKET = "therapist-photos";

/** Galerie de photos du cabinet (upload multiple + prévisualisation). userId = auth.users.id */
export default function CabinetPhotosUploader({ userId }: { userId: string }) {
  const fetchList = useServerFn(listMyCabinetPhotos);
  const add = useServerFn(addCabinetPhoto);
  const del = useServerFn(deleteCabinetPhoto);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [photos, setPhotos] = useState<{ id: string; signedUrl: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchList();
      setPhotos(res.rows);
    } catch (e: any) {
      toast.error(e?.message ?? "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      for (const file of files) {
        if (!ACCEPTED.includes(file.type)) {
          toast.error(`"${file.name}" : format non supporté.`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`"${file.name}" : max 5 Mo.`);
          continue;
        }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${userId}/cabinet/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) {
          toast.error(`Upload refusé : ${upErr.message}`);
          continue;
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        await add({ data: { url: pub.publicUrl } });
      }
      toast.success("Photos ajoutées.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await del({ data: { id } });
      setPhotos((p) => p.filter((x) => x.id !== id));
    } catch (e: any) {
      toast.error(e?.message ?? "Suppression impossible");
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Photos du cabinet</h3>
          <p className="text-xs text-[#a89bc4]">Montrez votre espace de travail (jusqu'à plusieurs photos, max 5 Mo).</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Ajouter des photos
        </button>
        <input ref={inputRef} type="file" multiple accept={ACCEPTED.join(",")} className="hidden" onChange={onFiles} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : photos.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-white/15 py-8 text-center text-white/40">
          <Camera className="mb-2 h-6 w-6" />
          Aucune photo pour l'instant.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-white/10">
              <img src={p.signedUrl} alt="Cabinet" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label="Supprimer"
                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
