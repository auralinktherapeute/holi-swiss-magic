export const CHARTER_VERSION = "v1";

export const CHARTER_TITLE = "Charte de Bienveillance — Salons Holiswiss";

export const CHARTER_INTRO = "Je m'engage à :";

export const CHARTER_POINTS: { title: string; body: string }[] = [
  {
    title: "Respecter autrui",
    body: "Reconnaître la dignité de chacun, indépendamment de son approche, de son parcours ou de ses opinions.",
  },
  {
    title: "Écouter avec bienveillance",
    body: "Accueillir les différences sans jugement.",
  },
  {
    title: "Exprimer mes idées avec clarté et respect",
    body: "Pas d'attaques personnelles, de sarcasmes ni de généralisations.",
  },
  {
    title: "Garder la confidentialité",
    body: "Ne pas partager hors du salon les échanges et témoignages qui y sont partagés.",
  },
  {
    title: "Reconnaître mes erreurs",
    body: "M'excuser si je blesse quelqu'un, et apprendre de la situation.",
  },
  {
    title: "Signaler les débordements",
    body: "Prévenir les modérateurs plutôt que d'entrer en conflit direct.",
  },
  {
    title: "Contribuer positivement",
    body: "Partager ressources, conseils et encouragements.",
  },
];

export const CHARTER_FOOTER =
  "En acceptant, je comprends que tout manquement peut entraîner un avertissement, une suspension ou un bannissement.";

export const CHARTER_MARKDOWN = `# ${CHARTER_TITLE}

${CHARTER_INTRO}
${CHARTER_POINTS.map((p, i) => `${i + 1}. ${p.title} (${p.body})`).join("\n")}

${CHARTER_FOOTER}`;
