import { describe, expect, it } from "vitest";
import { isSafeRegistryUrl, validateRegistryUrl } from "./certification-registry-url";

describe("validateRegistryUrl", () => {
  it("accepte les domaines officiels en https", () => {
    for (const u of [
      "https://www.asca.ch/annuaire/12345",
      "https://asca.ch/",
      "https://rme.ch/?id=7",
      "https://www.emr.ch/de/therapeut/9",
    ]) {
      const r = validateRegistryUrl(u);
      expect(r.ok, u).toBe(true);
    }
  });

  it("refuse http, les sous-domaines non prévus et les domaines ressemblants", () => {
    for (const u of [
      "http://asca.ch/x",
      "https://asca.ch.evil.com/x",
      "https://evil.com/asca.ch",
      "https://fake-asca.ch/x",
      "https://annuaire.asca.ch/x",
      "javascript:alert(1)",
      "//asca.ch/x",
    ]) {
      expect(validateRegistryUrl(u).ok, u).toBe(false);
    }
  });

  it("refuse identifiants intégrés et port explicite", () => {
    expect(validateRegistryUrl("https://user:pass@asca.ch/x").ok).toBe(false);
    expect(validateRegistryUrl("https://asca.ch:8443/x").ok).toBe(false);
  });

  it("refuse au-delà de 2000 caractères", () => {
    expect(validateRegistryUrl(`https://asca.ch/${"a".repeat(2100)}`).ok).toBe(false);
  });

  it("isSafeRegistryUrl est cohérent avec la validation", () => {
    expect(isSafeRegistryUrl("https://www.rme.ch/x")).toBe(true);
    expect(isSafeRegistryUrl("https://evil.com")).toBe(false);
    expect(isSafeRegistryUrl(null)).toBe(false);
  });
});
