import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createSignedImageUrl, imageVariantTransform } from "./storage-image";

describe("createSignedImageUrl", () => {
  it("utilise directement la variante lorsqu'elle est disponible", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "variant" }, error: null });
    await expect(
      createSignedImageUrl({ createSignedUrl }, "photo.jpg", 60, "thumbnail"),
    ).resolves.toBe("variant");
    expect(createSignedUrl).toHaveBeenCalledOnce();
    expect(createSignedUrl).toHaveBeenCalledWith("photo.jpg", 60, {
      transform: imageVariantTransform("thumbnail"),
    });
  });

  it("signe l'original une seule fois si la transformation échoue", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: new Error("unsupported") })
      .mockResolvedValueOnce({ data: { signedUrl: "original" }, error: null });
    await expect(
      createSignedImageUrl({ createSignedUrl }, "photo.jpg", 60, "profile"),
    ).resolves.toBe("original");
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
    expect(createSignedUrl).toHaveBeenLastCalledWith("photo.jpg", 60);
  });

  it("retourne null si la variante et l'original échouent", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: null, error: new Error("failed") });
    await expect(
      createSignedImageUrl({ createSignedUrl }, "photo.jpg", 60, "event"),
    ).resolves.toBeNull();
  });
});

describe("attributs d'images prioritaires", () => {
  it("réserve les dimensions et ne donne la priorité qu'aux images principales", () => {
    const avatar = requireSource("src/components/holiswiss/TherapistAvatar.tsx");
    const event = requireSource("src/routes/$lang.evenements.$id.tsx");
    const eventList = requireSource("src/routes/$lang.evenements.index.tsx");
    expect(avatar).toContain('decoding="async"');
    expect(avatar).toContain('fetchPriority={priority ? "high" : "auto"}');
    expect(event).toContain('fetchPriority="high"');
    expect(event).toContain("width={1280}");
    expect(eventList).toContain('loading="lazy"');
    expect(eventList).toContain("width={640}");
  });
});

function requireSource(path: string): string {
  return readFileSync(path, "utf8");
}
