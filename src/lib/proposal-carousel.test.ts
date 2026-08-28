import { describe, expect, it } from "vitest";
import { captionToSlides } from "@/lib/proposal-carousel";

const sixBlockCaption = [
  "22h15. Votre futur patient est enfin au calme.",
  "Ne laissez plus la routine de demain effacer les bonnes intentions de ce soir.",
  "Le patient réserve en trois clics.",
  "Votre agenda se remplit pendant que vous décrochez.",
  "La sérénité est pour vous deux.",
  "Lien en bio pour automatiser votre cabinet.",
].join("\n\n");

describe("captionToSlides avec une structure choisie", () => {
  it.each([2, 3, 4, 5] as const)("produit exactement %i pages depuis une caption de 6 blocs", (count) => {
    const slides = captionToSlides(sixBlockCaption, count);

    expect(slides).toHaveLength(count);
    expect(slides[0]?.kind).toBe("hook");
    expect(slides.at(-1)?.kind).toBe("cta");
  });

  it("divise une caption trop courte jusqu'au nombre demandé", () => {
    expect(
      captionToSlides(
        "Une première phrase accrocheuse. Une deuxième explique le bénéfice. Une troisième invite à agir.",
        3,
      ),
    ).toHaveLength(3);
  });
});