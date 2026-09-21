/**
 * Comportement RÉEL de `inspect()` face aux pannes de l'API Search Console —
 * `fetch` simulé, pas d'appel réseau. Le point commun de tous ces cas : un
 * échec doit ressortir comme un échec explicite, jamais comme « pas de
 * données » (ce qui se lirait comme une désindexation) et jamais comme une
 * exception qui arrêterait le lot entier.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspect } from "../../supabase/functions/run-indexation/gsc";

const URL_OK = "https://holiswiss.ch/fr/therapeutes";

function mockFetch(impl: (input: unknown, init?: unknown) => unknown) {
  vi.stubGlobal("fetch", vi.fn(impl as never));
}

afterEach(() => vi.unstubAllGlobals());

describe("inspect", () => {
  it("succès : renvoie l'inspection normalisée", async () => {
    mockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => ({
        inspectionResult: {
          indexStatusResult: {
            verdict: "PASS",
            coverageState: "Submitted and indexed",
            lastCrawlTime: "2026-09-18T10:00:00Z",
            googleCanonical: URL_OK,
            robotsTxtState: "ALLOWED",
            indexingState: "INDEXING_ALLOWED",
          },
        },
      }),
    }));
    const out = await inspect("t", "sc-domain:holiswiss.ch", URL_OK);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.inspection.verdict).toBe("PASS");
      expect(out.inspection.url).toBe(URL_OK);
    }
  });

  it("403 (compte de service non autorisé) : échec explicite", async () => {
    mockFetch(() => ({ ok: false, status: 403, json: async () => ({}) }));
    const out = await inspect("t", "sc-domain:holiswiss.ch", URL_OK);
    expect(out).toEqual({ ok: false, error: "HTTP 403" });
  });

  it("429 (quota) : échec explicite, pas une désindexation", async () => {
    mockFetch(() => ({ ok: false, status: 429, json: async () => ({}) }));
    const out = await inspect("t", "sc-domain:holiswiss.ch", URL_OK);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("HTTP 429");
  });

  it("JSON invalide : échec explicite, aucune exception propagée", async () => {
    mockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON at position 0");
      },
    }));
    const out = await inspect("t", "sc-domain:holiswiss.ch", URL_OK);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/corps illisible/);
  });

  it("coupure pendant la lecture du corps : échec explicite", async () => {
    mockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => {
        const e = new Error("aborted");
        e.name = "TimeoutError";
        throw e;
      },
    }));
    const out = await inspect("t", "sc-domain:holiswiss.ch", URL_OK, 15000);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/timeout 15000 ms à la lecture du corps/);
  });

  it("panne réseau : échec explicite", async () => {
    mockFetch(() => {
      throw new TypeError("network error");
    });
    const out = await inspect("t", "sc-domain:holiswiss.ch", URL_OK);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/réseau \(network error\)/);
  });

  it("délai dépassé sur la requête : échec explicite mentionnant le délai", async () => {
    mockFetch(() => {
      const e = new Error("signal timed out");
      e.name = "TimeoutError";
      throw e;
    });
    const out = await inspect("t", "sc-domain:holiswiss.ch", URL_OK, 15000);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/timeout 15000 ms/);
  });

  it("réponse 200 sans indexStatusResult : échec explicite", async () => {
    mockFetch(() => ({ ok: true, status: 200, json: async () => ({ inspectionResult: {} }) }));
    const out = await inspect("t", "sc-domain:holiswiss.ch", URL_OK);
    expect(out).toEqual({ ok: false, error: "réponse sans indexStatusResult" });
  });

  it("corps vide (null) : échec explicite, pas d'accès sur null", async () => {
    mockFetch(() => ({ ok: true, status: 200, json: async () => null }));
    const out = await inspect("t", "sc-domain:holiswiss.ch", URL_OK);
    expect(out.ok).toBe(false);
  });

  it("borne le temps d'attente via un signal d'abandon", async () => {
    const seen: { signal?: unknown } = {};
    mockFetch((_input, init) => {
      seen.signal = (init as { signal?: unknown } | undefined)?.signal;
      return { ok: true, status: 200, json: async () => ({ inspectionResult: {} }) };
    });
    await inspect("t", "sc-domain:holiswiss.ch", URL_OK, 1234);
    expect(seen.signal).toBeInstanceOf(AbortSignal);
  });
});
