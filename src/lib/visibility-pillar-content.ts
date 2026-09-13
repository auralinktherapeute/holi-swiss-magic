/**

 * Page pilier « visibilité des thérapeutes » — contenu éditorial validé.
 *
 * Trois langues seulement (fr, de, it), chacune avec son propre slug. Il n'y a
 * PAS de version anglaise : les hreflang ne doivent donc déclarer que les trois
 * variantes réellement servies. Toute langue supplémentaire ici sans page
 * correspondante créerait un hreflang mort.
 *
 * Règles de véracité appliquées au texte (décisions badges, commit 067030e1) :
 * - trois états de certification distincts : déclaré / justificatif examiné /
 *   inscription confirmée auprès du registre à une date donnée ;
 * - aucune vérification automatique auprès d'un organisme officiel ;
 * - aucun partenariat ASCA/RME, aucune promesse de remboursement ;
 * - aucune promesse de citation par une IA ;
 * - couverture = plateforme ouverte aux trois régions linguistiques, sans
 *   prétendre à une présence effective partout ;
 * - aucun chiffre, avis ou statistique inventé.
 */

export const PILLAR_LANGS = ["fr", "de", "it"] as const;
export type PillarLang = (typeof PILLAR_LANGS)[number];

export function isPillarLang(v: string | undefined): v is PillarLang {
  return !!v && (PILLAR_LANGS as readonly string[]).includes(v);
}

export type PillarBlock = { h2: string; paras?: string[]; bullets?: string[] };

export type PillarContent = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string[];
  blocks: PillarBlock[];
  cta: { title: string; text: string; primary: string; secondary: string; directory: string };
  faqTitle: string;
  faq: { q: string; a: string }[];
  sourcesTitle: string;
  breadcrumbHome: string;
  breadcrumb: string;
};

export const PILLAR_SOURCES: { label: string; href: string }[] = [
  { label: "Fondation ASCA", href: "https://asca.ch/" },
  { label: "Registre de Médecine Empirique (RME / EMR)", href: "https://emr.ch/" },
  {
    label: "Google Search Central — données structurées",
    href: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
  },
];

export const PILLAR: Record<PillarLang, PillarContent> = {
  fr: {
    slug: "visibilite-therapeute-suisse",
    title: "Visibilité des thérapeutes en Suisse | Holiswiss",
    description:
      "Développez la visibilité de votre cabinet en Suisse sur Google, les moteurs IA et les recherches locales grâce à un profil Holiswiss complet.",
    h1: "Développez votre visibilité de thérapeute en Suisse",
    intro: [
      "Être un excellent thérapeute ne suffit pas toujours pour être trouvé. En Suisse, les patients recherchent un praticien selon sa spécialité, sa localisation, les langues parlées, ses disponibilités et les éléments qui inspirent confiance. Ils utilisent Google, les annuaires spécialisés et, de plus en plus, les intelligences artificielles pour comparer les solutions.",
      "Holiswiss aide les thérapeutes à présenter leur activité de manière claire, structurée et adaptée au marché suisse. L’objectif n’est pas de promettre une première position, mais de réunir les informations et les outils qui augmentent les chances d’être compris, trouvé et choisi.",
    ],
    blocks: [
      {
        h2: "Comment améliorer la visibilité de son cabinet ?",
        paras: ["Une visibilité durable repose sur plusieurs signaux cohérents :"],
        bullets: [
          "une identité professionnelle identique sur tous les supports ;",
          "une fiche complète avec photo, biographie, spécialités et localisation ;",
          "des certifications affichées avec un état explicite : déclaré par le thérapeute, justificatif examiné par Holiswiss, ou inscription confirmée auprès du registre à une date donnée ;",
          "des informations pratiques à jour ;",
          "des avis publiés après modération ;",
          "des contenus utiles répondant aux questions des patients ;",
          "des liens et mentions provenant de sources suisses pertinentes.",
        ],
      },
      {
        h2: "Être trouvé sur Google et dans les moteurs IA",
        paras: [
          "Google et les assistants IA ne lisent pas une activité comme un humain. Ils s’appuient sur les informations accessibles, leur cohérence, leur précision et les sources qui les confirment.",
        ],
        bullets: [
          "qui vous êtes ;",
          "où vous exercez ;",
          "quelles approches vous proposez ;",
          "dans quelles langues vous accompagnez ;",
          "quelles certifications vous déclarez, et ce que Holiswiss a réellement contrôlé ;",
          "comment prendre rendez-vous ;",
          "à quelles questions vous êtes légitime pour répondre.",
        ],
      },
      {
        h2: "Quelle place occupent ASCA et le RME ?",
        paras: [
          "ASCA et le Registre de Médecine Empirique (RME/EMR) sont des organismes de référence en Suisse pour la reconnaissance de nombreuses pratiques de médecine complémentaire. Leur présence constitue un signal de confiance important, notamment lorsque les patients s’interrogent sur un éventuel remboursement par leur assurance complémentaire.",
          "Holiswiss n’est ni un partenaire ni un représentant de ces organismes, ne les remplace pas et ne décide pas du remboursement. La plateforme permet d’afficher les reconnaissances déclarées par le thérapeute et de distinguer trois états distincts : une information simplement déclarée, un justificatif examiné par Holiswiss, ou une inscription confirmée auprès du registre après un contrôle manuel daté. Aucune vérification n’est effectuée automatiquement auprès d’un organisme. Le patient doit toujours confirmer la couverture directement auprès de son assureur.",
        ],
      },
      {
        h2: "Une visibilité pensée pour toute la Suisse",
        paras: [
          "La recherche thérapeutique est locale et multilingue. Holiswiss organise les profils par canton, ville, spécialité et langue afin d’aider les patients à identifier une personne adaptée à proximité.",
          "La plateforme est ouverte aux thérapeutes des trois régions linguistiques — Suisse romande, Suisse alémanique, Suisse italienne — ainsi qu’aux cabinets proposant des consultations dans plusieurs langues ou à distance. Le nombre de praticiens inscrits varie selon les régions et les spécialités : l’annuaire montre l’état réel des inscriptions, sans le compléter.",
        ],
      },
      {
        h2: "Holiswiss, plus qu’un annuaire",
        paras: [
          "La visibilité est plus efficace lorsqu’elle est reliée à la gestion quotidienne du cabinet. Holiswiss rassemble progressivement profil public, réservation, agenda, avis, contenus, CRM et outils administratifs dans un même environnement.",
          "Le thérapeute garde la responsabilité de ses informations et peut les mettre à jour à tout moment. Holiswiss fournit la structure nécessaire pour les présenter de façon cohérente aux patients, aux moteurs de recherche et aux assistants IA.",
        ],
      },
    ],
    cta: {
      title: "Rendez votre activité plus facile à trouver",
      text: "Complétez votre profil Holiswiss pour présenter clairement votre cabinet, vos spécialités, vos langues et vos certifications.",
      primary: "Créer ou compléter mon profil",
      secondary: "Découvrir les solutions Holiswiss",
      directory: "Parcourir l’annuaire des thérapeutes",
    },
    faqTitle: "Questions fréquentes",
    faq: [
      {
        q: "Comment être visible en tant que thérapeute en Suisse ?",
        a: "Commencez par compléter vos informations professionnelles, votre localisation, vos spécialités, vos langues, vos disponibilités et vos preuves de confiance. Maintenez ensuite ces informations cohérentes sur votre site, votre profil Google et les annuaires spécialisés comme Holiswiss.",
      },
      {
        q: "Holiswiss peut-il garantir ma présence dans ChatGPT ou Google ?",
        a: "Non. Aucun prestataire sérieux ne peut garantir une citation ou une position. Holiswiss améliore la structure, la cohérence et l’accessibilité des informations afin d’augmenter leur capacité à être découvertes et comprises.",
      },
      {
        q: "Une reconnaissance ASCA ou RME garantit-elle le remboursement ?",
        a: "Non. La reconnaissance du thérapeute est un élément important, mais la couverture dépend du contrat du patient, de l’assureur, de la méthode et des conditions applicables. Le patient doit confirmer le remboursement auprès de son assurance complémentaire.",
      },
      {
        q: "Pourquoi renseigner les langues parlées ?",
        a: "La Suisse est multilingue. Les langues permettent de proposer votre profil aux personnes susceptibles de comprendre votre accompagnement et d’améliorer la pertinence des recherches régionales.",
      },
      {
        q: "Que signifient les différents états d’une certification sur Holiswiss ?",
        a: "Trois états sont possibles. « Déclaré par le thérapeute » signifie que l’information a été saisie par le praticien, sans intervention de Holiswiss. « Justificatif examiné par Holiswiss » signifie qu’un administrateur a regardé le document transmis. « Inscription confirmée auprès du registre le [date] » n’apparaît qu’après un contrôle manuel réellement effectué et documenté. Aucun état n’est attribué automatiquement, et un contrôle Holiswiss ne remplace pas une certification délivrée par l’organisme concerné.",
      },
    ],
    sourcesTitle: "Sources utiles",
    breadcrumbHome: "Accueil",
    breadcrumb: "Visibilité des thérapeutes",
  },

  de: {
    slug: "sichtbarkeit-therapeuten-schweiz",
    title: "Sichtbarkeit für Therapeuten in der Schweiz | Holiswiss",
    description:
      "Verbessern Sie die Sichtbarkeit Ihrer Praxis in der Schweiz bei Google, in KI-Suchsystemen und in der lokalen Suche mit Holiswiss.",
    h1: "Mehr Sichtbarkeit für Ihre therapeutische Praxis in der Schweiz",
    intro: [
      "Fachliche Qualität allein reicht nicht immer aus, um gefunden zu werden. Patientinnen und Patienten suchen in der Schweiz nach Methode, Ort, Sprache, Verfügbarkeit und vertrauensbildenden Nachweisen. Dafür nutzen sie Google, spezialisierte Verzeichnisse und zunehmend auch KI-gestützte Suchsysteme.",
      "Holiswiss unterstützt Therapeutinnen und Therapeuten dabei, ihre Tätigkeit klar, strukturiert und passend zum Schweizer Markt darzustellen. Es geht nicht um das Versprechen einer bestimmten Platzierung, sondern darum, die Voraussetzungen zu verbessern, um verstanden, gefunden und ausgewählt zu werden.",
    ],
    blocks: [
      {
        h2: "Was verbessert die Sichtbarkeit einer Praxis?",
        paras: ["Eine nachhaltige Präsenz entsteht durch konsistente und überprüfbare Informationen:"],
        bullets: [
          "einheitliche berufliche Angaben auf allen Plattformen;",
          "ein vollständiges Profil mit Foto, Beschreibung, Methoden und Standort;",
          "Zertifizierungen mit klar ausgewiesenem Status: von der therapeutischen Person angegeben, Nachweis von Holiswiss geprüft, oder Registereintrag an einem bestimmten Datum bestätigt;",
          "aktuelle Kontakt- und Praxisinformationen;",
          "Bewertungen, die nach einer Moderation veröffentlicht werden;",
          "hilfreiche Inhalte zu häufigen Fragen;",
          "Erwähnungen und Verlinkungen durch relevante Schweizer Quellen.",
        ],
      },
      {
        h2: "Bei Google und in KI-Suchsystemen gefunden werden",
        paras: [
          "Suchmaschinen und KI-Assistenten bewerten eine Praxis anhand öffentlich zugänglicher Informationen, ihrer Konsistenz, Genauigkeit und Bestätigung durch andere Quellen.",
        ],
        bullets: [
          "wer Sie sind;",
          "wo Sie tätig sind;",
          "welche Methoden Sie anbieten;",
          "in welchen Sprachen Sie beraten;",
          "welche Zertifizierungen Sie angeben und was Holiswiss tatsächlich kontrolliert hat;",
          "wie eine Terminvereinbarung möglich ist;",
          "zu welchen Themen Sie fachlich Auskunft geben können.",
        ],
      },
      {
        h2: "Welche Bedeutung haben EMR und ASCA?",
        paras: [
          "Das ErfahrungsMedizinische Register (EMR) und ASCA sind wichtige Schweizer Referenzstellen für zahlreiche Methoden der Komplementärmedizin. Eine entsprechende Anerkennung kann für Patientinnen und Patienten relevant sein, insbesondere im Zusammenhang mit Zusatzversicherungen.",
          "Holiswiss ist weder Partner noch Vertretung dieser Stellen, ersetzt sie nicht und entscheidet nicht über eine Kostenübernahme. Die Plattform zeigt angegebene Anerkennungen transparent und unterscheidet drei Zustände: eine reine Angabe der therapeutischen Person, einen von Holiswiss geprüften Nachweis, oder einen an einem bestimmten Datum manuell bestätigten Registereintrag. Es findet keine automatische Prüfung bei einer Organisation statt. Die Versicherungsdeckung muss immer direkt beim jeweiligen Versicherer abgeklärt werden.",
        ],
      },
      {
        h2: "Sichtbarkeit in allen Sprachregionen",
        paras: [
          "Die Suche nach einer therapeutischen Begleitung ist lokal und mehrsprachig. Holiswiss strukturiert Profile nach Kanton, Ort, Methode und Sprache.",
          "Die Plattform steht Therapeutinnen und Therapeuten aus allen drei Sprachregionen offen — Deutschschweiz, Romandie, italienische Schweiz — sowie mehrsprachigen Praxen und Online-Beratungen. Die Anzahl eingetragener Personen unterscheidet sich je nach Region und Methode: Das Verzeichnis zeigt den tatsächlichen Stand der Einträge.",
        ],
      },
      {
        h2: "Mehr als ein Verzeichnis",
        paras: [
          "Sichtbarkeit wirkt besser, wenn sie mit dem Praxisalltag verbunden ist. Holiswiss vereint schrittweise öffentliches Profil, Terminbuchung, Agenda, Bewertungen, Fachinhalte, CRM und administrative Werkzeuge.",
          "Die Verantwortung für die Angaben bleibt bei der therapeutischen Person, die sie jederzeit aktualisieren kann. Holiswiss stellt die Struktur bereit, um sie gegenüber Patientinnen, Patienten, Suchmaschinen und KI-Assistenten konsistent darzustellen.",
        ],
      },
    ],
    cta: {
      title: "Machen Sie Ihre Praxis leichter auffindbar",
      text: "Vervollständigen Sie Ihr Holiswiss-Profil mit Standort, Methoden, Sprachen und Zertifizierungen.",
      primary: "Profil erstellen oder vervollständigen",
      secondary: "Holiswiss-Lösungen entdecken",
      directory: "Therapeuten-Verzeichnis durchsuchen",
    },
    faqTitle: "Häufige Fragen",
    faq: [
      {
        q: "Wie werde ich als Therapeutin oder Therapeut in der Schweiz besser sichtbar?",
        a: "Vervollständigen Sie Ihre beruflichen Angaben, Ihren Standort, Ihre Methoden, Sprachen und Verfügbarkeiten. Halten Sie diese Informationen auf Ihrer Website, Ihrem Google-Unternehmensprofil und spezialisierten Plattformen konsistent.",
      },
      {
        q: "Garantiert Holiswiss eine Erwähnung bei ChatGPT oder eine Position bei Google?",
        a: "Nein. Eine seriöse Plattform kann weder eine KI-Erwähnung noch eine bestimmte Platzierung garantieren. Holiswiss verbessert die Struktur, Konsistenz und Zugänglichkeit Ihrer Informationen.",
      },
      {
        q: "Garantiert eine EMR- oder ASCA-Anerkennung eine Rückerstattung?",
        a: "Nein. Die Kostenübernahme hängt vom Versicherungsvertrag, der Methode, der behandelnden Person und den Bedingungen des Versicherers ab. Patientinnen und Patienten müssen dies bei ihrer Zusatzversicherung abklären.",
      },
      {
        q: "Warum sind die gesprochenen Sprachen wichtig?",
        a: "Die Schweiz ist mehrsprachig. Sprachangaben erhöhen die Relevanz regionaler Suchergebnisse und helfen Patientinnen und Patienten, eine passende Begleitung zu finden.",
      },
      {
        q: "Was bedeuten die Zertifizierungs-Status auf Holiswiss?",
        a: "Es gibt drei Zustände. « Von der Therapeutin/dem Therapeuten angegeben » bedeutet, dass die Angabe ohne Zutun von Holiswiss erfasst wurde. « Nachweis von Holiswiss geprüft » bedeutet, dass eine Administratorin oder ein Administrator das eingereichte Dokument angesehen hat. « Registereintrag bestätigt am [Datum] » erscheint nur nach einer tatsächlich durchgeführten und dokumentierten manuellen Kontrolle. Kein Status wird automatisch zugewiesen, und eine Kontrolle von Holiswiss ersetzt keine von der Organisation ausgestellte Zertifizierung.",
      },
    ],
    sourcesTitle: "Nützliche Quellen",
    breadcrumbHome: "Startseite",
    breadcrumb: "Sichtbarkeit für Therapeuten",
  },

  it: {
    slug: "visibilita-terapeuti-svizzera",
    title: "Visibilità per terapeuti in Svizzera | Holiswiss",
    description:
      "Migliorate la visibilità del vostro studio in Svizzera su Google, nei motori di ricerca IA e nelle ricerche locali con Holiswiss.",
    h1: "Più visibilità per il vostro studio terapeutico in Svizzera",
    intro: [
      "La qualità professionale non è sempre sufficiente per farsi trovare. In Svizzera, le persone cercano un terapeuta in base al metodo, alla località, alle lingue parlate, alla disponibilità e agli elementi che ispirano fiducia. Utilizzano Google, elenchi specializzati e sempre più spesso sistemi di ricerca basati sull’intelligenza artificiale.",
      "Holiswiss aiuta terapeute e terapeuti a presentare la propria attività in modo chiaro, strutturato e adatto al mercato svizzero. L’obiettivo non è promettere una posizione precisa, ma creare condizioni migliori per essere compresi, trovati e scelti.",
    ],
    blocks: [
      {
        h2: "Come aumentare la visibilità dello studio",
        paras: ["Una presenza duratura si basa su informazioni coerenti e verificabili:"],
        bullets: [
          "dati professionali uniformi su tutti i canali;",
          "un profilo completo con foto, descrizione, metodi e località;",
          "certificazioni presentate con uno stato esplicito: dichiarato dal terapeuta, documento esaminato da Holiswiss, oppure iscrizione confermata presso il registro in una data precisa;",
          "informazioni pratiche aggiornate;",
          "recensioni pubblicate dopo moderazione;",
          "contenuti utili che rispondono alle domande delle persone;",
          "menzioni e collegamenti provenienti da fonti svizzere pertinenti.",
        ],
      },
      {
        h2: "Essere trovati su Google e nei motori IA",
        paras: [
          "I motori di ricerca e gli assistenti IA utilizzano le informazioni pubblicamente accessibili, la loro coerenza, precisione e conferma da parte di altre fonti.",
        ],
        bullets: [
          "chi siete;",
          "dove esercitate;",
          "quali metodi proponete;",
          "in quali lingue lavorate;",
          "quali certificazioni dichiarate e che cosa Holiswiss ha effettivamente controllato;",
          "come prenotare un appuntamento;",
          "su quali temi possedete competenze specifiche.",
        ],
      },
      {
        h2: "Qual è il ruolo di RME e ASCA?",
        paras: [
          "Il Registro di Medicina Empirica (RME/EMR) e ASCA sono importanti enti di riferimento svizzeri per numerosi metodi di medicina complementare. Il loro riconoscimento può essere rilevante per le persone che desiderano verificare un eventuale rimborso tramite l’assicurazione complementare.",
          "Holiswiss non è partner né rappresentante di questi enti, non li sostituisce e non decide in merito al rimborso. La piattaforma mostra in modo trasparente i riconoscimenti dichiarati e distingue tre stati: un’informazione dichiarata dal terapeuta, un documento esaminato da Holiswiss, oppure un’iscrizione confermata presso il registro dopo un controllo manuale datato. Nessuna verifica avviene automaticamente presso un ente. La copertura deve sempre essere confermata direttamente con l’assicuratore.",
        ],
      },
      {
        h2: "Visibilità in tutte le regioni linguistiche",
        paras: [
          "La ricerca di un terapeuta è locale e multilingue. Holiswiss organizza i profili per cantone, città, specialità e lingua.",
          "La piattaforma è aperta a terapeute e terapeuti delle tre regioni linguistiche — Svizzera italiana, Svizzera tedesca, Svizzera romanda — e agli studi multilingue o con consulenze a distanza. Il numero di professionisti iscritti varia secondo la regione e la specialità: l’elenco mostra la situazione reale delle iscrizioni.",
        ],
      },
      {
        h2: "Più di un elenco",
        paras: [
          "La visibilità è più efficace quando è collegata alla gestione quotidiana dello studio. Holiswiss riunisce progressivamente profilo pubblico, prenotazioni, agenda, recensioni, contenuti professionali, CRM e strumenti amministrativi.",
          "La responsabilità delle informazioni resta del terapeuta, che può aggiornarle in qualsiasi momento. Holiswiss fornisce la struttura per presentarle in modo coerente a pazienti, motori di ricerca e assistenti IA.",
        ],
      },
    ],
    cta: {
      title: "Rendete il vostro studio più facile da trovare",
      text: "Completate il profilo Holiswiss con località, metodi, lingue e certificazioni.",
      primary: "Creare o completare il profilo",
      secondary: "Scoprire le soluzioni Holiswiss",
      directory: "Sfogliare l’elenco dei terapeuti",
    },
    faqTitle: "Domande frequenti",
    faq: [
      {
        q: "Come può un terapeuta aumentare la propria visibilità in Svizzera?",
        a: "È importante completare i dati professionali, la località, i metodi, le lingue e le disponibilità, mantenendo le stesse informazioni sul sito, sul profilo Google e negli elenchi specializzati.",
      },
      {
        q: "Holiswiss garantisce una citazione su ChatGPT o una posizione su Google?",
        a: "No. Nessuna piattaforma seria può garantire una citazione o una determinata posizione. Holiswiss migliora la struttura, la coerenza e l’accessibilità delle informazioni.",
      },
      {
        q: "Un riconoscimento RME o ASCA garantisce il rimborso?",
        a: "No. Il rimborso dipende dal contratto assicurativo, dal metodo, dal terapeuta e dalle condizioni dell’assicuratore. Le persone devono chiedere conferma alla propria assicurazione complementare.",
      },
      {
        q: "Perché è importante indicare le lingue parlate?",
        a: "La Svizzera è multilingue. Le lingue migliorano la pertinenza delle ricerche regionali e aiutano a trovare una persona con cui comunicare adeguatamente.",
      },
      {
        q: "Che cosa significano gli stati di una certificazione su Holiswiss?",
        a: "Esistono tre stati. « Dichiarato dal terapeuta » significa che l’informazione è stata inserita dal professionista, senza intervento di Holiswiss. « Documento esaminato da Holiswiss » significa che un amministratore ha esaminato il documento trasmesso. « Iscrizione confermata presso il registro il [data] » appare solo dopo un controllo manuale effettivamente svolto e documentato. Nessuno stato è attribuito automaticamente e un controllo di Holiswiss non sostituisce una certificazione rilasciata dall’ente interessato.",
      },
    ],
    sourcesTitle: "Fonti utili",
    breadcrumbHome: "Home",
    breadcrumb: "Visibilità per terapeuti",
  },
};

export const SITE = "https://holiswiss.ch";

/** URL absolue de la page pilier dans une langue. */
export function pillarUrl(lang: PillarLang) {
  return `${SITE}/${lang}/${PILLAR[lang].slug}`;
}

/**
 * hreflang réciproques — UNIQUEMENT les trois variantes réellement servies.
 * `x-default` pointe sur le français, langue par défaut du site.
 */
export function pillarHreflangLinks() {
  const links = PILLAR_LANGS.map((l) => ({
    rel: "alternate" as const,
    hrefLang: l,
    href: pillarUrl(l),
  }));
  links.push({ rel: "alternate" as const, hrefLang: "x-default", href: pillarUrl("fr") });
  return links;
}

/** `head()` complet d'une variante : métadonnées, canonical, hreflang, JSON-LD. */
export function pillarHead(lang: PillarLang) {
  const c = PILLAR[lang];
  const url = pillarUrl(lang);
  const ogLocale = { fr: "fr_CH", de: "de_CH", it: "it_CH" }[lang];

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: c.h1,
    description: c.description,
    inLanguage: lang,
    // Rattachement aux entités déjà définies dans __root.tsx : aucune
    // organisation dupliquée n'est créée ici.
    isPartOf: { "@id": `${SITE}/#website` },
    publisher: { "@id": `${SITE}/#organization` },
    about: { "@id": `${SITE}/#organization` },
    breadcrumb: { "@id": `${url}#breadcrumb` },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: c.breadcrumbHome, item: `${SITE}/${lang}` },
      { "@type": "ListItem", position: 2, name: c.breadcrumb, item: url },
    ],
  };

  // Les questions du balisage sont exactement celles affichées dans la page.
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    inLanguage: lang,
    isPartOf: { "@id": `${url}#webpage` },
    mainEntity: c.faq.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return {
    meta: [
      { title: c.title },
      { name: "description", content: c.description },
      { property: "og:title", content: c.title },
      { property: "og:description", content: c.description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: ogLocale },
    ],
    links: [{ rel: "canonical" as const, href: url }, ...pillarHreflangLinks()],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(webPage) },
      { type: "application/ld+json", children: JSON.stringify(breadcrumb) },
      { type: "application/ld+json", children: JSON.stringify(faqPage) },
    ],
  };
}
