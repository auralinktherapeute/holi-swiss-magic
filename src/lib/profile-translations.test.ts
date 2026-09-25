import { describe, it, expect } from "vitest";
import { localizeProfile, sourceHash } from "./profile-translations";

const base = {
  title: "Magnétiseur",
  short_bio: "Intro",
  bio: "Bio FR",
  specialties: ["Reiki", "Magnétisme"],
  services: [{ id: "s1", name: "Séance", description: "Desc" }],
};
const hash = sourceHash(base);
const withTr = (extra: object = {}) => ({
  ...base,
  profile_translations: {
    source_lang: "fr",
    source_hash: hash,
    langs: {
      de: {
        title: "Magnetiseur", short_bio: "Einführung", bio: "Bio DE",
        specialties: ["Reiki", "Magnetismus"], services: { s1: { name: "Sitzung", description: "" } },
        status: "auto", source_hash: hash, ...extra,
      },
    },
  },
});

describe("localizeProfile", () => {
  it("langue d'origine : texte inchangé, aucune mention", () => {
    const r: any = localizeProfile(withTr(), "fr");
    expect(r.bio).toBe("Bio FR");
    expect(r.translationNotice).toBeNull();
  });
  it("traduction présente : champs traduits + mention automatique", () => {
    const r: any = localizeProfile(withTr(), "de");
    expect(r.bio).toBe("Bio DE");
    expect(r.specialties).toEqual(["Reiki", "Magnetismus"]);
    expect(r.services[0].name).toBe("Sitzung");
    expect(r.services[0].description).toBe("Desc"); // traduction vide → original, jamais vide
    expect(r.translationNotice).toBe("Automatische Übersetzung");
  });
  it("relue : aucune mention", () => {
    expect((localizeProfile(withTr({ status: "reviewed" }), "de") as any).translationNotice).toBeNull();
  });
  it("traduction manquante : original + mention « contenu original »", () => {
    const r: any = localizeProfile(withTr(), "it");
    expect(r.bio).toBe("Bio FR");
    expect(r.translationNotice).toBe("Contenuto originale in francese");
  });
  it("source modifiée depuis la traduction : repli sur l'original", () => {
    const r: any = localizeProfile({ ...withTr(), bio: "Nouvelle bio" , profile_translations: { ...withTr().profile_translations, source_hash: "autre" } }, "de");
    expect(r.bio).toBe("Nouvelle bio");
    expect(r.translationNotice).toBe("Originalinhalt auf Französisch");
  });
});
