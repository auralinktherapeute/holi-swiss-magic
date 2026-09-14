import { describe, it, expect, vi, afterEach } from "vitest";
import {
  loadEssential,
  UNAVAILABLE_MARKER_HEADER,
  UNAVAILABLE_RETRY_AFTER_SECONDS,
} from "./read-health";
import { errorKind, timedRead, timedOptionalRead } from "./read-metrics.server";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadEssential", () => {
  it("renvoie les données quand la lecture réussit", async () => {
    const res = await loadEssential(async () => ({ therapists: [1, 2] }));
    expect(res).toEqual({ ok: true, data: { therapists: [1, 2] } });
  });

  it("signale une panne au lieu de renvoyer un faux résultat vide", async () => {
    const res = await loadEssential(async () => {
      throw new Error("boom");
    });
    expect(res.ok).toBe(false);
    expect("data" in res).toBe(false);
  });

  it("expose un marqueur et un délai de réessai raisonnables", () => {
    expect(UNAVAILABLE_MARKER_HEADER).toBe("x-holiswiss-read-unavailable");
    expect(UNAVAILABLE_RETRY_AFTER_SECONDS).toBeGreaterThanOrEqual(30);
    expect(UNAVAILABLE_RETRY_AFTER_SECONDS).toBeLessThanOrEqual(600);
  });
});

describe("errorKind — aucune donnée identifiante", () => {
  it("garde un code PostgREST court", () => {
    expect(errorKind({ code: "PGRST116" })).toBe("PGRST116");
  });

  it("retombe sur le nom de classe d'erreur", () => {
    expect(errorKind(new TypeError("henry-gerald introuvable"))).toBe("TypeError");
  });

  it("ne renvoie jamais le message, l'URL ni les paramètres", () => {
    const kind = errorKind({
      code: "42501",
      message: "row-level security for user 8f2c: slug=henry-gerald token=abc",
      details: "https://example.supabase.co/rest/v1/therapists?slug=eq.henry-gerald",
    });
    expect(kind).toBe("42501");
    expect(kind).not.toMatch(/henry|token|http|slug/i);
  });

  it("neutralise un code trop long ou suspect", () => {
    expect(errorKind({ code: "slug=henry-gerald&token=abc" })).toBe("unknown");
    expect(errorKind("chaîne brute")).toBe("unknown");
  });
});

describe("instrumentation", () => {
  it("journalise une lecture essentielle sans PII et propage l'échec", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      timedRead("therapist_profile_main", async () => {
        throw Object.assign(new Error("slug henry-gerald"), { code: "PGRST301" });
      }),
    ).rejects.toThrow();
    const line = String(warn.mock.calls[0]?.[0] ?? "");
    expect(line).toContain("op=therapist_profile_main");
    expect(line).toContain("ok=0");
    expect(line).toContain("kind=PGRST301");
    expect(line).not.toMatch(/henry|gerald/i);
    expect(line).toMatch(/ms=\d+/);
  });

  it("dégrade une lecture secondaire sans inventer de contenu", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const reviews = await timedOptionalRead(
      "therapist_profile_reviews",
      async () => {
        throw new Error("down");
      },
      [] as unknown[],
    );
    expect(reviews).toEqual([]);
  });

  it("mesure les lectures réussies", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const out = await timedOptionalRead("directory_canton", async () => [1], []);
    expect(out).toEqual([1]);
    expect(String(info.mock.calls[0]?.[0] ?? "")).toContain("ok=1");
  });
});
