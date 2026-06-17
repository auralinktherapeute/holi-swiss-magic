import { useEffect, useState } from "react";
import { resolveTherapistPhotoUrl } from "@/lib/therapistPhoto";

interface Props {
  photoUrl?: string | null;
  alt: string;
  fallback?: string;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Renders a therapist's avatar. Because the storage bucket is private, we
 * resolve the stored URL into a fresh signed URL before rendering.
 */
export function TherapistAvatar({
  photoUrl,
  alt,
  fallback,
  className = "h-full w-full object-cover",
  fallbackClassName = "flex h-full w-full items-center justify-center text-lg font-bold text-[#b86ef9]",
}: Props) {
  const [src, setSrc] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSrc("");
    if (!photoUrl) return;
    resolveTherapistPhotoUrl(photoUrl).then((u) => {
      if (!cancelled) setSrc(u);
    });
    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  if (!photoUrl || failed || !src) {
    return <div className={fallbackClassName}>{fallback ?? alt.charAt(0).toUpperCase()}</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}