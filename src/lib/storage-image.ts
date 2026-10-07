export type ImageVariant = "thumbnail" | "profile" | "event";

type Transform = {
  width: number;
  height?: number;
  resize: "contain";
  quality: number;
};

const TRANSFORMS: Record<ImageVariant, Transform> = {
  thumbnail: { width: 320, height: 320, resize: "contain", quality: 75 },
  profile: { width: 768, height: 768, resize: "contain", quality: 82 },
  event: { width: 1280, resize: "contain", quality: 82 },
};

type SignedUrlResult = {
  data: { signedUrl?: string | null } | null;
  error: unknown;
};

type StorageBucket = {
  createSignedUrl: (
    path: string,
    expiresIn: number,
    options?: { transform: Transform },
  ) => PromiseLike<SignedUrlResult>;
};

/**
 * Signe une variante redimensionnée. Si la transformation est refusée, une
 * seule nouvelle tentative signe l'original afin de ne jamais casser l'image.
 */
export async function createSignedImageUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn: number,
  variant: ImageVariant,
): Promise<string | null> {
  const transformed = await bucket.createSignedUrl(path, expiresIn, {
    transform: TRANSFORMS[variant],
  });
  if (!transformed.error && transformed.data?.signedUrl) return transformed.data.signedUrl;

  const original = await bucket.createSignedUrl(path, expiresIn);
  return original.error ? null : (original.data?.signedUrl ?? null);
}

export function imageVariantTransform(variant: ImageVariant): Transform {
  return { ...TRANSFORMS[variant] };
}
