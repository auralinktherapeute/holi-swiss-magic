import { describe, expect, it } from "vitest";
import {
  TEMPLATES, renderTemplate, type DocumentTemplateContext,
} from "@/lib/cabinet-document-templates";

const ctx: DocumentTemplateContext = {
  therapist: {
    name: "Cabinet <Lumière>",
    profession: "Naturopathe",
    address: "Rue du Lac 4, 1000 Lausanne",
    email: "pro@example.ch",
    phone: "+41 21 000 00 00",
    ide: "CHE-123.456.789",
  },
  client: { full_name: "Anne Dupont", email: "anne@example.ch", date_of_birth: "1985-04-12" },
  sessions: [{ date: "2026-08-20", time: "14:30", service: "Séance de suivi" }],
  currency: "CHF",
};

describe("modèles de documents du cabinet", () => {
  it("expose trois modèles", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["attestation", "consentement", "recu"]);
  });

  it("échappe le HTML des données saisies", () => {
    const html = renderTemplate("attestation", ctx);
    expect(html).toContain("Cabinet &lt;Lumière&gt;");
    expect(html).not.toContain("<Lumière>");
  });

  it("listent les séances dans l'attestation sans détail clinique", () => {
    const html = renderTemplate("attestation", ctx);
    expect(html).toContain("Séance de suivi");
    expect(html).toContain("secret professionnel");
  });

  it("ajoute une ligne de signature client sur le consentement uniquement", () => {
    expect(renderTemplate("consentement", ctx).match(/class="line"/g)).toHaveLength(2);
    expect(renderTemplate("attestation", ctx).match(/class="line"/g)).toHaveLength(1);
  });

  it("formate le montant du reçu et reste neutre sans montant", () => {
    expect(renderTemplate("recu", ctx, { amount: 120 })).toMatch(/120/);
    expect(renderTemplate("recu", ctx, { amount: null })).toContain("…………");
  });
});
